import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Transfer } from "../models/sectionTransfer.model.js";
import { Section } from "../models/section.model.js";


// CREATE TRANSFER
// Moves budget from one section to another for the authenticated user.
// The source section's `spent` is increased (less available) and
// the destination section's `monthlyBudget` is increased (more available).
// Both sections must belong to the logged-in user and must be different.
export const createTransfer = asyncHandler(async (req, res) => {

    //1. Pull the required fields from the request body
    const { fromSection: fromSectionId, toSection: toSectionId, amount, reason } = req.body;

    //2. Validate required fields
    if (!fromSectionId) {
        throw new ApiError(400, "Source section (fromSection) is required");
    }

    if (!toSectionId) {
        throw new ApiError(400, "Destination section (toSection) is required");
    }

    if (amount === undefined || typeof amount !== "number" || amount <= 0) {
        throw new ApiError(400, "Amount must be a valid number greater than zero");
    }

    //3. Source and destination must be different sections
    if (fromSectionId.toString() === toSectionId.toString()) {
        throw new ApiError(400, "Source and destination sections must be different");
    }

    //4. Find both sections and confirm they belong to the requesting user
    const fromSection = await Section.findById(fromSectionId);

    if (!fromSection) {
        throw new ApiError(404, "Source section not found");
    }

    if (fromSection.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to transfer from this section");
    }

    const toSection = await Section.findById(toSectionId);

    if (!toSection) {
        throw new ApiError(404, "Destination section not found");
    }

    if (toSection.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to transfer to this section");
    }

    //5. Check that the source section has enough available balance
    const available = fromSection.monthlyBudget - fromSection.spent;

    if (amount > available) {
        throw new ApiError(400, "Insufficient balance in source section", [
            { field: "amount", available, shortBy: amount - available }
        ]);
    }

    //6. Create the transfer document
    const transfer = await Transfer.create({
        user: req.user._id,
        fromSection: fromSectionId,
        toSection: toSectionId,
        amount,
        reason: reason ?? "",
    });

    //7. Update both sections atomically
    //   Source: increase spent (less available budget)
    //   Destination: increase monthlyBudget (more available budget)
    await Section.findByIdAndUpdate(
        fromSectionId,
        { $inc: { spent: amount } }
    );

    await Section.findByIdAndUpdate(
        toSectionId,
        { $inc: { monthlyBudget: amount } }
    );

    //8. Populate section details on the response for convenience
    const populatedTransfer = await Transfer.findById(transfer._id)
        .populate("fromSection", "name emoji monthlyBudget spent")
        .populate("toSection", "name emoji monthlyBudget spent");

    //9. Send back the newly created transfer
    return res.status(201).json(
        new ApiResponse(201, populatedTransfer, "Transfer created successfully")
    );
});


// GET USER TRANSFERS
// Returns all transfers belonging to the authenticated user, newest first.
// Supports optional query filters: fromSection, toSection.
export const getUserTransfers = asyncHandler(async (req, res) => {

    //1. Build the base filter — always scoped to the current user
    const filter = { user: req.user._id };

    //2. Apply optional query-string filters
    const { fromSection, toSection } = req.query;

    if (fromSection) {
        filter.fromSection = fromSection;
    }

    if (toSection) {
        filter.toSection = toSection;
    }

    //3. Fetch matching transfers with section details populated
    const transfers = await Transfer.find(filter)
        .populate("fromSection", "name emoji monthlyBudget spent")
        .populate("toSection", "name emoji monthlyBudget spent")
        .sort({ createdAt: -1 });

    //4. Return the list — an empty array is still a valid 200 response
    return res.status(200).json(
        new ApiResponse(200, transfers, "Transfers fetched successfully")
    );
});


// GET TRANSFER BY ID
// Returns a single transfer by its database ID, after verifying ownership.
export const getTransferById = asyncHandler(async (req, res) => {

    //1. The transfer ID comes from the URL parameter
    const { transferId } = req.params;

    //2. Look up the transfer with section details populated
    const transfer = await Transfer.findById(transferId)
        .populate("fromSection", "name emoji monthlyBudget spent")
        .populate("toSection", "name emoji monthlyBudget spent");

    //3. If no transfer was found, return a 404
    if (!transfer) {
        throw new ApiError(404, "Transfer not found");
    }

    //4. Make sure this transfer belongs to the requesting user
    if (transfer.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to view this transfer");
    }

    //5. All good — return the transfer
    return res.status(200).json(
        new ApiResponse(200, transfer, "Transfer fetched successfully")
    );
});


// UPDATE TRANSFER
// Updates an existing transfer's fields. Only provided fields are modified.
// If amount, fromSection, or toSection changes, the affected sections' balances
// are reversed and re-applied to stay in sync.
export const updateTransfer = asyncHandler(async (req, res) => {

    //1. Transfer ID from the URL, update payload from the body
    const { transferId } = req.params;
    const { fromSection: newFromId, toSection: newToId, amount, reason } = req.body;

    //2. At least one updatable field must be provided
    if (
        amount === undefined &&
        newFromId === undefined &&
        newToId === undefined &&
        reason === undefined
    ) {
        throw new ApiError(400, "Please provide at least one field to update");
    }

    //3. Validate individual fields if provided
    if (amount !== undefined && (typeof amount !== "number" || amount <= 0)) {
        throw new ApiError(400, "Amount must be a valid number greater than zero");
    }

    //4. Find the existing transfer and confirm ownership
    const transfer = await Transfer.findById(transferId);

    if (!transfer) {
        throw new ApiError(404, "Transfer not found");
    }

    if (transfer.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to update this transfer");
    }

    //5. Determine the effective new values (fall back to existing if not provided)
    const effectiveFromId = newFromId ?? transfer.fromSection;
    const effectiveToId = newToId ?? transfer.toSection;
    const effectiveAmount = amount ?? transfer.amount;

    //6. Source and destination must still be different after update
    if (effectiveFromId.toString() === effectiveToId.toString()) {
        throw new ApiError(400, "Source and destination sections must be different");
    }

    //7. If sections are being changed, validate the new sections
    let newFromSection = null;
    let newToSection = null;

    if (newFromId && newFromId.toString() !== transfer.fromSection.toString()) {
        newFromSection = await Section.findById(newFromId);

        if (!newFromSection) {
            throw new ApiError(404, "New source section not found");
        }

        if (newFromSection.user.toString() !== req.user._id.toString()) {
            throw new ApiError(403, "You are not authorized to transfer from this section");
        }
    }

    if (newToId && newToId.toString() !== transfer.toSection.toString()) {
        newToSection = await Section.findById(newToId);

        if (!newToSection) {
            throw new ApiError(404, "New destination section not found");
        }

        if (newToSection.user.toString() !== req.user._id.toString()) {
            throw new ApiError(403, "You are not authorized to transfer to this section");
        }
    }

    //8. Check that the effective source section has enough available balance
    //   We need to calculate the source section's balance after reversing the old transfer
    const effectiveFromSection = newFromSection || await Section.findById(effectiveFromId);

    if (!effectiveFromSection) {
        throw new ApiError(404, "Source section not found");
    }

    let availableInSource = effectiveFromSection.monthlyBudget - effectiveFromSection.spent;

    //   If the effective source is the same as the old source,
    //   the old transfer had increased its spent value, so add that amount back.
    if (effectiveFromId.toString() === transfer.fromSection.toString()) {
        availableInSource += transfer.amount;
    }

    //   If the effective source is the old destination,
    //   the old transfer had increased its monthlyBudget, so remove that amount.
    if (effectiveFromId.toString() === transfer.toSection.toString()) {
        availableInSource -= transfer.amount;
    }

    if (effectiveAmount > availableInSource) {
        throw new ApiError(400, "Insufficient balance in source section", [
            { field: "amount", available: availableInSource, shortBy: effectiveAmount - availableInSource }
        ]);
    }

    //9. Reverse the old transfer's impact on the original sections
    //   Old source: spent was increased → decrease it
    //   Old destination: monthlyBudget was increased → decrease it
    await Section.findByIdAndUpdate(
        transfer.fromSection,
        { $inc: { spent: -transfer.amount } }
    );

    await Section.findByIdAndUpdate(
        transfer.toSection,
        { $inc: { monthlyBudget: -transfer.amount } }
    );

    //10. Apply the new transfer's impact on the (possibly new) sections
    await Section.findByIdAndUpdate(
        effectiveFromId,
        { $inc: { spent: effectiveAmount } }
    );

    await Section.findByIdAndUpdate(
        effectiveToId,
        { $inc: { monthlyBudget: effectiveAmount } }
    );

    //11. Build the update object with only the provided fields
    const updateFields = {};

    if (amount !== undefined) updateFields.amount = amount;
    if (newFromId !== undefined) updateFields.fromSection = newFromId;
    if (newToId !== undefined) updateFields.toSection = newToId;
    if (reason !== undefined) updateFields.reason = reason;

    //12. Apply the update and return the new document
    const updatedTransfer = await Transfer.findByIdAndUpdate(
        transferId,
        { $set: updateFields },
        { new: true }
    )
        .populate("fromSection", "name emoji monthlyBudget spent")
        .populate("toSection", "name emoji monthlyBudget spent");

    return res.status(200).json(
        new ApiResponse(200, updatedTransfer, "Transfer updated successfully")
    );
});


// DELETE TRANSFER
// Permanently removes a transfer and reverses its impact on both sections.
// Only the owner can delete their own transfer.
export const deleteTransfer = asyncHandler(async (req, res) => {

    //1. Transfer ID comes from the URL parameter
    const { transferId } = req.params;

    //2. Find the transfer and verify it exists
    const transfer = await Transfer.findById(transferId);

    if (!transfer) {
        throw new ApiError(404, "Transfer not found");
    }

    //3. Only the owner is allowed to delete their own transfer
    if (transfer.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this transfer");
    }

    //4. Reverse the transfer's impact on both sections
    //   Source: spent was increased → decrease it
    //   Destination: monthlyBudget was increased → decrease it
    await Section.findByIdAndUpdate(
        transfer.fromSection,
        { $inc: { spent: -transfer.amount } }
    );

    await Section.findByIdAndUpdate(
        transfer.toSection,
        { $inc: { monthlyBudget: -transfer.amount } }
    );

    //5. Delete the document from the database
    await Transfer.findByIdAndDelete(transferId);

    //6. Confirm deletion
    return res.status(200).json(
        new ApiResponse(200, {}, "Transfer deleted successfully")
    );
});

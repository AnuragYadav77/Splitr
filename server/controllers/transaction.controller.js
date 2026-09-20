import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Transaction } from "../models/transaction.model.js";
import { Section } from "../models/section.model.js";


// CREATE TRANSACTION
// Creates a new transaction linked to a specific section for the authenticated user.
// For debit transactions, the section's budget is checked (unless isOverride is true).
// The section's `spent` field is atomically updated to reflect the new spending.
export const createTransaction = asyncHandler(async (req, res) => {

    //1. Pull the required fields from the request body
    const { amount, section: sectionId, merchant, direction, isOverride } = req.body;

    //2. Validate required fields
    if (!merchant || typeof merchant !== "string" || merchant.trim() === "") {
        throw new ApiError(400, "Merchant name is required");
    }

    if (amount === undefined || typeof amount !== "number" || amount <= 0) {
        throw new ApiError(400, "Amount must be a valid number greater than zero");
    }

    if (!sectionId) {
        throw new ApiError(400, "Section is required");
    }

    if (!direction || !["debit", "credit"].includes(direction)) {
        throw new ApiError(400, "Direction must be either 'debit' or 'credit'");
    }

    //3. Find the section and confirm it belongs to the requesting user
    const section = await Section.findById(sectionId);

    if (!section) {
        throw new ApiError(404, "Section not found");
    }

    if (section.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to transact against this section");
    }

    //4. For debit transactions, check if the section has sufficient budget remaining
    //   (unless the user explicitly triggers an override)
    if (direction === "debit" && !isOverride) {
        const remaining = section.monthlyBudget - section.spent;

        if (amount > remaining) {
            throw new ApiError(400, "Insufficient section budget", [
                { field: "amount", shortBy: amount - remaining }
            ]);
        }
    }

    //5. Create the transaction document
    const transaction = await Transaction.create({
        user: req.user._id,
        amount,
        section: sectionId,
        merchant: merchant.trim(),
        direction,
        isOverride: isOverride ?? false,
    });

    //6. Update the section's spent counter atomically
    //   Debit → increase spent; Credit (refund) → decrease spent
    const spentDelta = direction === "debit" ? amount : -amount;

    await Section.findByIdAndUpdate(
        sectionId,
        { $inc: { spent: spentDelta } }
    );

    //7. Populate the section details on the response for convenience
    const populatedTransaction = await Transaction.findById(transaction._id)
        .populate("section", "name emoji monthlyBudget spent");

    //8. Send back the newly created transaction
    return res.status(201).json(
        new ApiResponse(201, populatedTransaction, "Transaction created successfully")
    );
});


// GET USER TRANSACTIONS
// Returns all transactions belonging to the authenticated user, newest first.
// Supports optional query filters: section, direction, and merchant.
export const getUserTransactions = asyncHandler(async (req, res) => {

    //1. Build the base filter — always scoped to the current user
    const filter = { user: req.user._id };

    //2. Apply optional query-string filters
    const { section, direction, merchant } = req.query;

    if (section) {
        filter.section = section;
    }

    if (direction && ["debit", "credit"].includes(direction)) {
        filter.direction = direction;
    }

    if (merchant) {
        filter.merchant = { $regex: merchant, $options: "i" };
    }

    //3. Fetch matching transactions with section details populated
    const transactions = await Transaction.find(filter)
        .populate("section", "name emoji monthlyBudget spent")
        .sort({ createdAt: -1 });

    //4. Return the list — an empty array is still a valid 200 response
    return res.status(200).json(
        new ApiResponse(200, transactions, "Transactions fetched successfully")
    );
});


// GET TRANSACTION BY ID
// Returns a single transaction by its database ID, after verifying ownership.
export const getTransactionById = asyncHandler(async (req, res) => {

    //1. The transaction ID comes from the URL parameter
    const { transactionId } = req.params;

    //2. Look up the transaction with section details populated
    const transaction = await Transaction.findById(transactionId)
        .populate("section", "name emoji monthlyBudget spent");

    //3. If no transaction was found, return a 404
    if (!transaction) {
        throw new ApiError(404, "Transaction not found");
    }

    //4. Make sure this transaction belongs to the requesting user
    if (transaction.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to view this transaction");
    }

    //5. All good — return the transaction
    return res.status(200).json(
        new ApiResponse(200, transaction, "Transaction fetched successfully")
    );
});


// UPDATE TRANSACTION
// Updates an existing transaction's fields. Only provided fields are modified.
// If amount, section, or direction changes, the affected section(s) spent counters
// are re-adjusted to stay in sync.
export const updateTransaction = asyncHandler(async (req, res) => {

    //1. Transaction ID from the URL, update payload from the body
    const { transactionId } = req.params;
    const { amount, section: newSectionId, merchant, direction, isOverride } = req.body;

    //2. At least one updatable field must be provided
    if (
        amount === undefined &&
        newSectionId === undefined &&
        merchant === undefined &&
        direction === undefined &&
        isOverride === undefined
    ) {
        throw new ApiError(400, "Please provide at least one field to update");
    }

    //3. Validate individual fields if provided
    if (merchant !== undefined && (typeof merchant !== "string" || merchant.trim() === "")) {
        throw new ApiError(400, "Merchant name cannot be empty");
    }

    if (amount !== undefined && (typeof amount !== "number" || amount <= 0)) {
        throw new ApiError(400, "Amount must be a valid number greater than zero");
    }

    if (direction !== undefined && !["debit", "credit"].includes(direction)) {
        throw new ApiError(400, "Direction must be either 'debit' or 'credit'");
    }

    //4. Find the existing transaction and confirm ownership
    const transaction = await Transaction.findById(transactionId);

    if (!transaction) {
        throw new ApiError(404, "Transaction not found");
    }

    if (transaction.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to update this transaction");
    }

    //5. If the section is being changed, validate the new section
    let newSection = null;

    if (newSectionId && newSectionId.toString() !== transaction.section.toString()) {
        newSection = await Section.findById(newSectionId);

        if (!newSection) {
            throw new ApiError(404, "New section not found");
        }

        if (newSection.user.toString() !== req.user._id.toString()) {
            throw new ApiError(403, "You are not authorized to transact against this section");
        }
    }

    //6. Determine the effective new values (fall back to existing values if not provided)
    const effectiveAmount = amount ?? transaction.amount;
    const effectiveDirection = direction ?? transaction.direction;
    const effectiveSectionId = newSectionId ?? transaction.section;
    const effectiveIsOverride = isOverride ?? transaction.isOverride;

    //7. Check the effective transaction against the section's budget
    //   Only debit transactions consume section budget.
    //   The old transaction's impact is removed before calculating the new spent amount.
    const targetSection = newSection || await Section.findById(effectiveSectionId);

    if (!targetSection) {
        throw new ApiError(404, "Section not found");
    }

    let targetSectionSpent = targetSection.spent;

    // If the transaction stays in the same section, remove its old impact first.
    if (effectiveSectionId.toString() === transaction.section.toString()) {
        const oldSpentDelta = transaction.direction === "debit"
            ? transaction.amount
            : -transaction.amount;

        targetSectionSpent -= oldSpentDelta;
    }

    if (effectiveDirection === "debit" && !effectiveIsOverride) {
        const remaining = targetSection.monthlyBudget - targetSectionSpent;

        if (effectiveAmount > remaining) {
            throw new ApiError(400, "Insufficient section budget", [
                { field: "amount", shortBy: effectiveAmount - remaining }
            ]);
        }
    }

    //8. Reverse the old transaction's impact on the original section's spent counter
    //   Old debit added to spent → subtract it; Old credit subtracted → add it back
    const oldSpentDelta = transaction.direction === "debit"
        ? -transaction.amount
        : transaction.amount;

    await Section.findByIdAndUpdate(
        transaction.section,
        { $inc: { spent: oldSpentDelta } }
    );

    //9. Apply the new transaction's impact on the (possibly new) section's spent counter
    const newSpentDelta = effectiveDirection === "debit"
        ? effectiveAmount
        : -effectiveAmount;

    await Section.findByIdAndUpdate(
        effectiveSectionId,
        { $inc: { spent: newSpentDelta } }
    );

    //10. Build the update object and apply the update
    const updateFields = {};

    if (amount !== undefined) updateFields.amount = amount;
    if (newSectionId !== undefined) updateFields.section = newSectionId;
    if (merchant !== undefined) updateFields.merchant = merchant.trim();
    if (direction !== undefined) updateFields.direction = direction;
    if (isOverride !== undefined) updateFields.isOverride = isOverride;

    const updatedTransaction = await Transaction.findByIdAndUpdate(
        transactionId,
        { $set: updateFields },
        { new: true }
    ).populate("section", "name emoji monthlyBudget spent");

    return res.status(200).json(
        new ApiResponse(200, updatedTransaction, "Transaction updated successfully")
    );
});


// DELETE TRANSACTION
// Permanently removes a transaction and reverses its impact on the section's spent counter.
// Only the owner can delete their own transaction.
export const deleteTransaction = asyncHandler(async (req, res) => {

    //1. Transaction ID comes from the URL parameter
    const { transactionId } = req.params;

    //2. Find the transaction and verify it exists
    const transaction = await Transaction.findById(transactionId);

    if (!transaction) {
        throw new ApiError(404, "Transaction not found");
    }

    //3. Only the owner is allowed to delete their own transaction
    if (transaction.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this transaction");
    }

    //4. Reverse the transaction's impact on the section's spent counter
    //   Debit had increased spent → decrease it; Credit had decreased → increase it
    const spentReversal = transaction.direction === "debit"
        ? -transaction.amount
        : transaction.amount;

    await Section.findByIdAndUpdate(
        transaction.section,
        { $inc: { spent: spentReversal } }
    );

    //5. Delete the document from the database
    await Transaction.findByIdAndDelete(transactionId);

    //6. Confirm deletion
    return res.status(200).json(
        new ApiResponse(200, {}, "Transaction deleted successfully")
    );
});
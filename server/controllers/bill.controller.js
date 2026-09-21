import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Bill } from "../models/bill.model.js";


// CREATE BILL
// Creates a new fixed bill (e.g., "Rent", "Netflix") for the authenticated user.
// Each bill tracks a name, amount, due day of the month, and payment status.
export const createBill = asyncHandler(async (req, res) => {

    //1. Pull the required fields from the request body
    const { name, amount, dueDay } = req.body;

    //2. Name, amount, and dueDay are all required — reject early if missing
    if (!name || !name.trim()) {
        throw new ApiError(400, "Bill name is required");
    }

    if (amount === undefined || typeof amount !== "number" || amount <= 0) {
        throw new ApiError(400, "Amount must be a valid number greater than zero");
    }

    if (
        dueDay === undefined ||
        typeof dueDay !== "number" ||
        !Number.isInteger(dueDay) ||
        dueDay < 1 ||
        dueDay > 31
    ) {
        throw new ApiError(400, "Due day must be an integer between 1 and 31");
    }

    //3. Create the bill document and tie it to the current user
    const bill = await Bill.create({
        user: req.user._id,
        name: name.trim(),
        amount,
        dueDay,
        isPaid: false,
    });

    //4. Send back the newly created bill
    return res.status(201).json(
        new ApiResponse(201, bill, "Bill created successfully")
    );
});


// GET USER BILLS
// Returns all bills belonging to the authenticated user, sorted by due day.
export const getUserBills = asyncHandler(async (req, res) => {

    //1. Find every bill owned by this user, ordered by due day
    const bills = await Bill.find({ user: req.user._id })
        .sort({ dueDay: 1 });

    //2. Return the list — an empty array is still a valid 200 response
    return res.status(200).json(
        new ApiResponse(200, bills, "Bills fetched successfully")
    );
});


// GET BILL BY ID
// Returns a single bill by its database ID, after verifying ownership.
export const getBillById = asyncHandler(async (req, res) => {

    //1. The bill ID comes from the URL parameter
    const { billId } = req.params;

    //2. Look up the bill in the database
    const bill = await Bill.findById(billId);

    //3. If no bill was found, return a 404
    if (!bill) {
        throw new ApiError(404, "Bill not found");
    }

    //4. Make sure this bill belongs to the requesting user
    if (bill.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to view this bill");
    }

    //5. All good — return the bill
    return res.status(200).json(
        new ApiResponse(200, bill, "Bill fetched successfully")
    );
});


// UPDATE BILL
// Updates an existing bill's fields. Only provided fields are modified.
export const updateBill = asyncHandler(async (req, res) => {

    //1. Bill ID from the URL, update payload from the body
    const { billId } = req.params;
    const { name, amount, dueDay } = req.body;

    //2. At least one updatable field must be provided
    if (
        name === undefined &&
        amount === undefined &&
        dueDay === undefined
    ) {
        throw new ApiError(400, "Please provide at least one field to update");
    }

    //3. Validate individual fields if provided
    if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
        throw new ApiError(400, "Bill name cannot be empty");
    }

    if (amount !== undefined && (typeof amount !== "number" || amount <= 0)) {
        throw new ApiError(400, "Amount must be a valid number greater than zero");
    }

    if (
        dueDay !== undefined &&
        (
            typeof dueDay !== "number" ||
            !Number.isInteger(dueDay) ||
            dueDay < 1 ||
            dueDay > 31
        )
    ) {
        throw new ApiError(400, "Due day must be an integer between 1 and 31");
    }

    //4. Find the existing bill and confirm ownership
    const bill = await Bill.findById(billId);

    if (!bill) {
        throw new ApiError(404, "Bill not found");
    }

    if (bill.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to update this bill");
    }

    //5. Build the update object with only the provided fields
    const updateFields = {};
    if (name !== undefined) updateFields.name = name.trim();
    if (amount !== undefined) updateFields.amount = amount;
    if (dueDay !== undefined) updateFields.dueDay = dueDay;

    //6. Apply the update and return the new document
    const updatedBill = await Bill.findByIdAndUpdate(
        billId,
        { $set: updateFields },
        { new: true }
    );

    return res.status(200).json(
        new ApiResponse(200, updatedBill, "Bill updated successfully")
    );
});


// DELETE BILL
// Permanently removes a bill. Only the owner can delete their own bill.
export const deleteBill = asyncHandler(async (req, res) => {

    //1. Bill ID comes from the URL parameter
    const { billId } = req.params;

    //2. Find the bill and verify it exists
    const bill = await Bill.findById(billId);

    if (!bill) {
        throw new ApiError(404, "Bill not found");
    }

    //3. Only the owner is allowed to delete their own bill
    if (bill.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this bill");
    }

    //4. Delete the document from the database
    await Bill.findByIdAndDelete(billId);

    //5. Confirm deletion
    return res.status(200).json(
        new ApiResponse(200, {}, "Bill deleted successfully")
    );
});


// MARK BILL AS PAID
// Toggles (or sets) the `isPaid` flag to true for the given bill.
export const markBillAsPaid = asyncHandler(async (req, res) => {

    //1. Bill ID from the URL parameter
    const { billId } = req.params;

    //2. Find the bill and verify ownership
    const bill = await Bill.findById(billId);

    if (!bill) {
        throw new ApiError(404, "Bill not found");
    }

    if (bill.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to modify this bill");
    }

    //3. If already paid, let the caller know — no double-pays
    if (bill.isPaid) {
        throw new ApiError(400, "Bill is already marked as paid");
    }

    //4. Update the isPaid flag
    const updatedBill = await Bill.findByIdAndUpdate(
        billId,
        { $set: { isPaid: true } },
        { new: true }
    );

    return res.status(200).json(
        new ApiResponse(200, updatedBill, "Bill marked as paid")
    );
});


// MARK BILL AS UNPAID
// Resets the `isPaid` flag to false. Useful for month-end rollovers or corrections.
export const markBillAsUnpaid = asyncHandler(async (req, res) => {

    //1. Bill ID from the URL parameter
    const { billId } = req.params;

    //2. Find the bill and verify ownership
    const bill = await Bill.findById(billId);

    if (!bill) {
        throw new ApiError(404, "Bill not found");
    }

    if (bill.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to modify this bill");
    }

    //3. If already unpaid, no action needed
    if (!bill.isPaid) {
        throw new ApiError(400, "Bill is already marked as unpaid");
    }

    //4. Reset the isPaid flag
    const updatedBill = await Bill.findByIdAndUpdate(
        billId,
        { $set: { isPaid: false } },
        { new: true }
    );

    return res.status(200).json(
        new ApiResponse(200, updatedBill, "Bill marked as unpaid")
    );
});


// RESET ALL BILLS
// Sets isPaid to false for all of the authenticated user's bills.
// Intended for month-end rollover when all bills need to restart.
export const resetAllBills = asyncHandler(async (req, res) => {

    //1. Bulk-update all bills for this user
    const result = await Bill.updateMany(
        { user: req.user._id },
        { $set: { isPaid: false } }
    );

    return res.status(200).json(
        new ApiResponse(
            200,
            { modifiedCount: result.modifiedCount },
            "All bills reset to unpaid"
        )
    );
});

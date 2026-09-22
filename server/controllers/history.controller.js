import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { History } from "../models/monthlyHistory.model.js";


// CREATE HISTORY
// Creates a new monthly history record for the authenticated user.
// Each record tracks the month, total budgeted, total spent, total saved, and emergency overrides.
export const createHistory = asyncHandler(async (req, res) => {

    //1. Pull the required fields from the request body
    const { month, totalBudgeted, totalSpent, totalSaved, emergencyOverride } = req.body;

    //2. month is required
    if (!month || typeof month !== "string" || !month.trim()) {
        throw new ApiError(400, "Month is required and must be a non-empty string");
    }

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month.trim())) {
        throw new ApiError(400, "Month must be in YYYY-MM format");
    }

    //3. totalBudgeted is required and must be a valid number
    if (totalBudgeted === undefined || typeof totalBudgeted !== "number") {
        throw new ApiError(400, "Total budgeted is required and must be a valid number");
    }

    //4. totalSpent is required and must be a valid number
    if (totalSpent === undefined || typeof totalSpent !== "number") {
        throw new ApiError(400, "Total spent is required and must be a valid number");
    }

    //5. Validate totalSaved if provided — must be a number
    if (totalSaved !== undefined && typeof totalSaved !== "number") {
        throw new ApiError(400, "Total saved must be a valid number");
    }

    //6. Validate emergencyOverride if provided — must be a number
    if (emergencyOverride !== undefined && typeof emergencyOverride !== "number") {
        throw new ApiError(400, "Emergency override must be a valid number");
    }

    //7. Prevent duplicate history entries for the same user and month
    const existingHistory = await History.findOne({
        user: req.user._id,
        month: month.trim(),
    });

    if (existingHistory) {
        throw new ApiError(409, "A history record for this month already exists");
    }

    //8. Create the history document and tie it to the current user
    const history = await History.create({
        user: req.user._id,
        month: month.trim(),
        totalBudgeted,
        totalSpent,
        totalSaved: totalSaved ?? 0,
        emergencyOverride: emergencyOverride ?? 0,
    });

    //9. Send back the newly created history record
    return res.status(201).json(
        new ApiResponse(201, history, "History record created successfully")
    );
});


// GET USER HISTORY
// Returns all monthly history records belonging to the authenticated user, sorted by most recent first.
export const getUserHistory = asyncHandler(async (req, res) => {

    //1. Find every history record owned by this user, newest first
    const historyRecords = await History.find({ user: req.user._id })
        .sort({ createdAt: -1 });

    //2. Return the list — an empty array is still a valid 200 response
    return res.status(200).json(
        new ApiResponse(200, historyRecords, "History records fetched successfully")
    );
});


// GET HISTORY BY ID
// Returns a single history record by its database ID, after verifying ownership.
export const getHistoryById = asyncHandler(async (req, res) => {

    //1. The history ID comes from the URL parameter
    const { historyId } = req.params;

    //2. Look up the history record in the database
    const history = await History.findById(historyId);

    //3. If no history record was found, return a 404
    if (!history) {
        throw new ApiError(404, "History record not found");
    }

    //4. Make sure this history record belongs to the requesting user
    if (history.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to view this history record");
    }

    //5. All good — return the history record
    return res.status(200).json(
        new ApiResponse(200, history, "History record fetched successfully")
    );
});


// UPDATE HISTORY
// Updates an existing history record's fields. Only provided fields are modified.
export const updateHistory = asyncHandler(async (req, res) => {

    //1. History ID from the URL, update payload from the body
    const { historyId } = req.params;
    const { month, totalBudgeted, totalSpent, totalSaved, emergencyOverride } = req.body;

    //2. At least one updatable field must be provided
    if (
        month === undefined &&
        totalBudgeted === undefined &&
        totalSpent === undefined &&
        totalSaved === undefined &&
        emergencyOverride === undefined
    ) {
        throw new ApiError(400, "Please provide at least one field to update");
    }

    //3. Validate month if provided — must be a non-empty string in YYYY-MM format
    if (month !== undefined && (typeof month !== "string" || !month.trim())) {
        throw new ApiError(400, "Month must be a non-empty string");
    }

    if (month !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month.trim())) {
        throw new ApiError(400, "Month must be in YYYY-MM format");
    }

    //4. Validate totalBudgeted if provided — must be a number
    if (totalBudgeted !== undefined && typeof totalBudgeted !== "number") {
        throw new ApiError(400, "Total budgeted must be a valid number");
    }

    //5. Validate totalSpent if provided — must be a number
    if (totalSpent !== undefined && typeof totalSpent !== "number") {
        throw new ApiError(400, "Total spent must be a valid number");
    }

    //6. Validate totalSaved if provided — must be a number
    if (totalSaved !== undefined && typeof totalSaved !== "number") {
        throw new ApiError(400, "Total saved must be a valid number");
    }

    //7. Validate emergencyOverride if provided — must be a number
    if (emergencyOverride !== undefined && typeof emergencyOverride !== "number") {
        throw new ApiError(400, "Emergency override must be a valid number");
    }

    //8. Find the history record and confirm ownership before touching it
    const history = await History.findById(historyId);

    if (!history) {
        throw new ApiError(404, "History record not found");
    }

    if (history.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to update this history record");
    }

    //9. If month is being changed, check for duplicates
    if (month !== undefined && month.trim() !== history.month) {
        const duplicate = await History.findOne({
            user: req.user._id,
            month: month.trim(),
            _id: { $ne: historyId },
        });

        if (duplicate) {
            throw new ApiError(409, "A history record for this month already exists");
        }
    }

    //10. Build the update object with only the provided fields
    const updateFields = {};
    if (month !== undefined) updateFields.month = month.trim();
    if (totalBudgeted !== undefined) updateFields.totalBudgeted = totalBudgeted;
    if (totalSpent !== undefined) updateFields.totalSpent = totalSpent;
    if (totalSaved !== undefined) updateFields.totalSaved = totalSaved;
    if (emergencyOverride !== undefined) updateFields.emergencyOverride = emergencyOverride;

    //11. Apply the update and return the new document
    const updatedHistory = await History.findByIdAndUpdate(
        historyId,
        { $set: updateFields },
        { new: true }
    );

    return res.status(200).json(
        new ApiResponse(200, updatedHistory, "History record updated successfully")
    );
});


// DELETE HISTORY
// Permanently removes a history record. Only the owner can delete their own record.
export const deleteHistory = asyncHandler(async (req, res) => {

    //1. History ID comes from the URL parameter
    const { historyId } = req.params;

    //2. Find the history record and verify it exists
    const history = await History.findById(historyId);

    if (!history) {
        throw new ApiError(404, "History record not found");
    }

    //3. Only the owner is allowed to delete their own history record
    if (history.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this history record");
    }

    //4. Delete the document from the database
    await History.findByIdAndDelete(historyId);

    //5. Confirm deletion — no body needed, just a 200 with a clear message
    return res.status(200).json(
        new ApiResponse(200, {}, "History record deleted successfully")
    );
});
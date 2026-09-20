import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Budget } from "../models/budget.model.js";


// CREATE BUDGET
// Creates a new monthly budget for the authenticated user.
// Each budget tracks total income, allocated funds, and savings for a given month/year.
// Only one budget is allowed per user per month (enforced by the `month` field in YYYY-MM format).
export const createBudget = asyncHandler(async (req, res) => {

    //1. Pull the required fields from the request body
    const { month, year, totalIncome, totalAllocated, totalSaved } = req.body;

    //2. month and year are required
    if (!month || year === undefined) {
        throw new ApiError(400, "Month and year are required");
    }

    //3. Validate month format (YYYY-MM)
    if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        throw new ApiError(400, "Month must be in YYYY-MM format");
    }

    //4. Validate year is a valid number
    if (typeof year !== "number" || year < 1900 || year > 2100) {
        throw new ApiError(400, "Year must be a valid number between 1900 and 2100");
    }

    if (Number(month.slice(0, 4)) !== year) {
        throw new ApiError(400, "Month and year must refer to the same year");
    }


    //5. Validate totalIncome if provided — must be a non-negative number
    if (totalIncome !== undefined && (typeof totalIncome !== "number" || totalIncome < 0)) {
        throw new ApiError(400, "Total income must be a valid non-negative number");
    }

    ///6. Validate totalAllocated and totalSaved if provided — must be non-negative numbers
    if (totalAllocated !== undefined && (typeof totalAllocated !== "number" || totalAllocated < 0)) {
        throw new ApiError(400, "Total allocated must be a valid non-negative number");
    }

    if (totalSaved !== undefined && (typeof totalSaved !== "number" || totalSaved < 0)) {
        throw new ApiError(400, "Total saved must be a valid non-negative number");
    }

    //7. Prevent duplicate budgets for the same user and month
    const existingBudget = await Budget.findOne({
        user: req.user._id,
        month,
    });

    if (existingBudget) {
        throw new ApiError(409, "A budget for this month already exists");
    }

    //8. Create the budget document and tie it to the current user
    const budget = await Budget.create({
        user: req.user._id,
        month,
        year,
        totalIncome: totalIncome ?? 0,
        totalAllocated: totalAllocated ?? 0,
        totalSaved: totalSaved ?? 0,
    });

    //9. Send back the newly created budget
    return res.status(201).json(
        new ApiResponse(201, budget, "Budget created successfully")
    );
});


// GET USER BUDGETS
// Returns all budgets belonging to the authenticated user, sorted by most recent first.
export const getUserBudgets = asyncHandler(async (req, res) => {

    //1. Find every budget owned by this user, newest first
    const budgets = await Budget.find({ user: req.user._id })
        .sort({ year: -1, month: -1 });

    //2. Return the list — an empty array is still a valid 200 response
    return res.status(200).json(
        new ApiResponse(200, budgets, "Budgets fetched successfully")
    );
});


// GET BUDGET BY ID
// Returns a single budget by its database ID, after verifying ownership.
export const getBudgetById = asyncHandler(async (req, res) => {

    //1. The budget ID comes from the URL parameter
    const { budgetId } = req.params;

    //2. Look up the budget in the database
    const budget = await Budget.findById(budgetId);

    //3. If no budget was found, return a 404
    if (!budget) {
        throw new ApiError(404, "Budget not found");
    }

    //4. Make sure this budget belongs to the requesting user
    if (budget.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to view this budget");
    }

    //5. All good — return the budget
    return res.status(200).json(
        new ApiResponse(200, budget, "Budget fetched successfully")
    );
});


// UPDATE BUDGET
// Updates an existing budget's fields. Only provided fields are modified.
// If the month is being changed, we check for duplicates to prevent collisions.
export const updateBudget = asyncHandler(async (req, res) => {

    //1. Budget ID from the URL, update payload from the body
    const { budgetId } = req.params;
    const { month, year, totalIncome, totalAllocated, totalSaved } = req.body;

    //2. At least one updatable field must be provided
    if (
        month === undefined &&
        year === undefined &&
        totalIncome === undefined &&
        totalAllocated === undefined &&
        totalSaved === undefined
    ) {
        throw new ApiError(400, "Please provide at least one field to update");
    }

    //3. Validate month format if provided
    if (month !== undefined && (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))) {
        throw new ApiError(400, "Month must be in YYYY-MM format");
    }

    //4. Validate year if provided
    if (year !== undefined && (typeof year !== "number" || year < 1900 || year > 2100)) {
        throw new ApiError(400, "Year must be a valid number between 1900 and 2100");
    }

    //5. Validate totalIncome if provided
    if (totalIncome !== undefined && (typeof totalIncome !== "number" || totalIncome < 0)) {
        throw new ApiError(400, "Total income must be a valid non-negative number");
    }

    //6. Validate totalAllocated if provided
    if (totalAllocated !== undefined && (typeof totalAllocated !== "number" || totalAllocated < 0)) {
        throw new ApiError(400, "Total allocated must be a valid non-negative number");
    }

    //7. Validate totalSaved if provided
    if (totalSaved !== undefined && (typeof totalSaved !== "number" || totalSaved < 0)) {
        throw new ApiError(400, "Total saved must be a valid non-negative number");
    }

    //8. Find the budget and confirm ownership before touching it
    const budget = await Budget.findById(budgetId);

    if (!budget) {
        throw new ApiError(404, "Budget not found");
    }

    if (budget.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to update this budget");
    }
    if (month !== undefined && year !== undefined) {
        if (Number(month.slice(0, 4)) !== year) {
            throw new ApiError(400, "Month and year must refer to the same year");
        }
    }

    if (month !== undefined && year === undefined) {
        if (Number(month.slice(0, 4)) !== budget.year) {
            throw new ApiError(400, "Month and year must refer to the same year");
        }
    }

    if (year !== undefined && month === undefined) {
        if (Number(budget.month.slice(0, 4)) !== year) {
            throw new ApiError(400, "Month and year must refer to the same year");
        }
    }

    //9. If month is being changed, ensure no duplicate exists for the new month
    if (month && month !== budget.month) {
        const duplicate = await Budget.findOne({
            user: req.user._id,
            month,
            _id: { $ne: budgetId },
        });

        if (duplicate) {
            throw new ApiError(409, "A budget for this month already exists");
        }
    }

    //10. Build the update object with only the provided fields
    const updateFields = {};
    if (month !== undefined) updateFields.month = month;
    if (year !== undefined) updateFields.year = year;
    if (totalIncome !== undefined) updateFields.totalIncome = totalIncome;
    if (totalAllocated !== undefined) updateFields.totalAllocated = totalAllocated;
    if (totalSaved !== undefined) updateFields.totalSaved = totalSaved;

    //11. Apply the update and return the new document
    const updatedBudget = await Budget.findByIdAndUpdate(
        budgetId,
        { $set: updateFields },
        { new: true }
    );

    return res.status(200).json(
        new ApiResponse(200, updatedBudget, "Budget updated successfully")
    );
});


// DELETE BUDGET
// Permanently removes a budget. Only the owner can delete their own budget.
export const deleteBudget = asyncHandler(async (req, res) => {

    //1. Budget ID comes from the URL parameter
    const { budgetId } = req.params;

    //2. Find the budget and verify it exists
    const budget = await Budget.findById(budgetId);

    if (!budget) {
        throw new ApiError(404, "Budget not found");
    }

    //3. Only the owner is allowed to delete their own budget
    if (budget.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this budget");
    }

    //4. Delete the document from the database
    await Budget.findByIdAndDelete(budgetId);

    //5. Confirm deletion — no body needed, just a 200 with a clear message
    return res.status(200).json(
        new ApiResponse(200, {}, "Budget deleted successfully")
    );
});

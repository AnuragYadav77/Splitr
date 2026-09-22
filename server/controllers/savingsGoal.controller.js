import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { SavingsGoal } from "../models/savingsGoal.model.js";


// CREATE SAVINGS GOAL
// Creates a new savings goal for the authenticated user.
// Each goal tracks a target amount, current savings, optional deadline, and completion status.
export const createSavingsGoal = asyncHandler(async (req, res) => {

    //1. Pull the required fields from the request body
    const { name, targetAmount, currentAmount, deadline } = req.body;

    //2. targetAmount is required
    if (targetAmount === undefined) {
        throw new ApiError(400, "Target amount is required");
    }

    //3. Validate targetAmount — must be a positive number (model enforces min 0.1)
    if (typeof targetAmount !== "number" || targetAmount < 0.1) {
        throw new ApiError(400, "Target amount must be a number greater than or equal to 0.1");
    }

    //4. Validate currentAmount if provided — must be a non-negative number
    if (currentAmount !== undefined && (typeof currentAmount !== "number" || currentAmount < 0)) {
        throw new ApiError(400, "Current amount must be a valid non-negative number");
    }

    ///5. Validate deadline if provided — must be a valid future date
    if (deadline !== undefined && deadline !== null) {
        const deadlineDate = new Date(deadline);

        if (isNaN(deadlineDate.getTime())) {
            throw new ApiError(400, "Deadline must be a valid date");
        }

        if (deadlineDate <= new Date()) {
            throw new ApiError(400, "Deadline must be a future date");
        }
    }

    //6. Determine if the goal is already completed on creation
    const initialAmount = currentAmount ?? 0;
    const isCompleted = initialAmount >= targetAmount;

    //7. Create the savings goal document and tie it to the current user
    const savingsGoal = await SavingsGoal.create({
        user: req.user._id,
        name: name?.trim() || "",
        targetAmount,
        currentAmount: initialAmount,
        deadline: deadline || null,
        isCompleted,
    });

    //8. Send back the newly created savings goal
    return res.status(201).json(
        new ApiResponse(201, savingsGoal, "Savings goal created successfully")
    );
});


// GET USER SAVINGS GOALS
// Returns all savings goals belonging to the authenticated user, sorted by most recent first.
export const getUserSavingsGoals = asyncHandler(async (req, res) => {

    //1. Find every savings goal owned by this user, newest first
    const savingsGoals = await SavingsGoal.find({ user: req.user._id })
        .sort({ createdAt: -1 });

    //2. Return the list — an empty array is still a valid 200 response
    return res.status(200).json(
        new ApiResponse(200, savingsGoals, "Savings goals fetched successfully")
    );
});


// GET SAVINGS GOAL BY ID
// Returns a single savings goal by its database ID, after verifying ownership.
export const getSavingsGoalById = asyncHandler(async (req, res) => {

    //1. The savings goal ID comes from the URL parameter
    const { goalId } = req.params;

    //2. Look up the savings goal in the database
    const savingsGoal = await SavingsGoal.findById(goalId);

    //3. If no savings goal was found, return a 404
    if (!savingsGoal) {
        throw new ApiError(404, "Savings goal not found");
    }

    //4. Make sure this savings goal belongs to the requesting user
    if (savingsGoal.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to view this savings goal");
    }

    //5. All good — return the savings goal
    return res.status(200).json(
        new ApiResponse(200, savingsGoal, "Savings goal fetched successfully")
    );
});


// UPDATE SAVINGS GOAL
// Updates an existing savings goal's fields. Only provided fields are modified.
// Automatically recalculates isCompleted when amounts change.
export const updateSavingsGoal = asyncHandler(async (req, res) => {

    //1. Savings goal ID from the URL, update payload from the body
    const { goalId } = req.params;
    const { name, targetAmount, currentAmount, deadline, isCompleted } = req.body;

    //2. At least one updatable field must be provided
    if (
        name === undefined &&
        targetAmount === undefined &&
        currentAmount === undefined &&
        deadline === undefined &&
        isCompleted === undefined
    ) {
        throw new ApiError(400, "Please provide at least one field to update");
    }

    //3. Validate targetAmount if provided — must be >= 0.1
    if (targetAmount !== undefined && (typeof targetAmount !== "number" || targetAmount < 0.1)) {
        throw new ApiError(400, "Target amount must be a number greater than or equal to 0.1");
    }

    //4. Validate currentAmount if provided — must be non-negative
    if (currentAmount !== undefined && (typeof currentAmount !== "number" || currentAmount < 0)) {
        throw new ApiError(400, "Current amount must be a valid non-negative number");
    }

    //5. Validate deadline if provided
    if (deadline !== undefined && deadline !== null) {
        const deadlineDate = new Date(deadline);
        if (isNaN(deadlineDate.getTime())) {
            throw new ApiError(400, "Deadline must be a valid date");
        }
    }

    //6. Validate isCompleted if provided — must be a boolean
    if (isCompleted !== undefined && typeof isCompleted !== "boolean") {
        throw new ApiError(400, "isCompleted must be a boolean value");
    }

    //7. Find the savings goal and confirm ownership before touching it
    const savingsGoal = await SavingsGoal.findById(goalId);

    if (!savingsGoal) {
        throw new ApiError(404, "Savings goal not found");
    }

    if (savingsGoal.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to update this savings goal");
    }

    //8. Build the update object with only the provided fields
    const updateFields = {};
    if (name !== undefined) updateFields.name = name.trim();
    if (targetAmount !== undefined) updateFields.targetAmount = targetAmount;
    if (currentAmount !== undefined) updateFields.currentAmount = currentAmount;
    if (deadline !== undefined) updateFields.deadline = deadline;
    if (isCompleted !== undefined) updateFields.isCompleted = isCompleted;

    //9. Auto-calculate isCompleted if amounts change but isCompleted wasn't explicitly set
    if (isCompleted === undefined) {
        const finalCurrent = currentAmount ?? savingsGoal.currentAmount;
        const finalTarget = targetAmount ?? savingsGoal.targetAmount;
        updateFields.isCompleted = finalCurrent >= finalTarget;
    }

    //10. Apply the update and return the new document
    const updatedSavingsGoal = await SavingsGoal.findByIdAndUpdate(
        goalId,
        { $set: updateFields },
        { new: true }
    );

    return res.status(200).json(
        new ApiResponse(200, updatedSavingsGoal, "Savings goal updated successfully")
    );
});


// DELETE SAVINGS GOAL
// Permanently removes a savings goal. Only the owner can delete their own goal.
export const deleteSavingsGoal = asyncHandler(async (req, res) => {

    //1. Savings goal ID comes from the URL parameter
    const { goalId } = req.params;

    //2. Find the savings goal and verify it exists
    const savingsGoal = await SavingsGoal.findById(goalId);

    if (!savingsGoal) {
        throw new ApiError(404, "Savings goal not found");
    }

    //3. Only the owner is allowed to delete their own savings goal
    if (savingsGoal.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this savings goal");
    }

    //4. Delete the document from the database
    await SavingsGoal.findByIdAndDelete(goalId);

    //5. Confirm deletion — no body needed, just a 200 with a clear message
    return res.status(200).json(
        new ApiResponse(200, {}, "Savings goal deleted successfully")
    );
});


// DEPOSIT TO SAVINGS GOAL
// Adds money to the currentAmount of a savings goal.
// Automatically marks the goal as completed if currentAmount reaches or exceeds targetAmount.
export const depositToSavingsGoal = asyncHandler(async (req, res) => {

    //1. Savings goal ID from the URL, amount from the body
    const { goalId } = req.params;
    const { amount } = req.body;

    //2. Amount is required and must be a positive number
    if (typeof amount !== "number" || amount <= 0) {
        throw new ApiError(400, "Amount must be a valid number greater than zero");
    }

    //3. Find the savings goal and confirm ownership
    const savingsGoal = await SavingsGoal.findById(goalId);

    if (!savingsGoal) {
        throw new ApiError(404, "Savings goal not found");
    }

    if (savingsGoal.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to modify this savings goal");
    }

    //4. Check if the goal is already completed
    if (savingsGoal.isCompleted) {
        throw new ApiError(400, "This savings goal is already completed");
    }

    //5. Calculate the new current amount
    const newCurrentAmount = savingsGoal.currentAmount + amount;
    const isNowCompleted = newCurrentAmount >= savingsGoal.targetAmount;

    //6. Update the savings goal atomically
    const updatedSavingsGoal = await SavingsGoal.findByIdAndUpdate(
        goalId,
        {
            $inc: { currentAmount: amount },
            $set: { isCompleted: isNowCompleted },
        },
        { new: true }
    );

    const message = isNowCompleted
        ? "Deposit successful — congratulations, you've reached your savings goal!"
        : "Deposit added to savings goal successfully";

    return res.status(200).json(
        new ApiResponse(200, updatedSavingsGoal, message)
    );
});


// WITHDRAW FROM SAVINGS GOAL
// Removes money from the currentAmount of a savings goal.
// Automatically resets isCompleted to false if the balance drops below the target.
export const withdrawFromSavingsGoal = asyncHandler(async (req, res) => {

    //1. Savings goal ID from the URL, amount from the body
    const { goalId } = req.params;
    const { amount } = req.body;

    //2. Amount is required and must be a positive number
    if (typeof amount !== "number" || amount <= 0) {
        throw new ApiError(400, "Amount must be a valid number greater than zero");
    }

    //3. Find the savings goal and confirm ownership
    const savingsGoal = await SavingsGoal.findById(goalId);

    if (!savingsGoal) {
        throw new ApiError(404, "Savings goal not found");
    }

    if (savingsGoal.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to modify this savings goal");
    }

    //4. Cannot withdraw more than the current balance
    if (amount > savingsGoal.currentAmount) {
        throw new ApiError(
            400,
            `Insufficient balance. Current savings: ${savingsGoal.currentAmount}`
        );
    }

    //5. Calculate the new current amount and update completion status
    const newCurrentAmount = savingsGoal.currentAmount - amount;
    const isStillCompleted = newCurrentAmount >= savingsGoal.targetAmount;

    //6. Update the savings goal
    const updatedSavingsGoal = await SavingsGoal.findByIdAndUpdate(
        goalId,
        {
            $set: {
                currentAmount: newCurrentAmount,
                isCompleted: isStillCompleted,
            },
        },
        { new: true }
    );

    return res.status(200).json(
        new ApiResponse(200, updatedSavingsGoal, "Withdrawal from savings goal successful")
    );
});


// GET SAVINGS GOAL PROGRESS
// Returns a summary of savings progress for a specific goal, including percentage
// completed and the remaining amount needed.
export const getSavingsGoalProgress = asyncHandler(async (req, res) => {

    //1. Savings goal ID from the URL parameter
    const { goalId } = req.params;

    //2. Look up the savings goal in the database
    const savingsGoal = await SavingsGoal.findById(goalId);

    //3. If no savings goal was found, return a 404
    if (!savingsGoal) {
        throw new ApiError(404, "Savings goal not found");
    }

    //4. Make sure this savings goal belongs to the requesting user
    if (savingsGoal.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to view this savings goal");
    }

    //5. Calculate progress metrics
    const percentComplete = Math.min(
        (savingsGoal.currentAmount / savingsGoal.targetAmount) * 100,
        100
    );
    const remaining = Math.max(savingsGoal.targetAmount - savingsGoal.currentAmount, 0);

    //6. Calculate estimated days remaining if deadline is set
    let daysUntilDeadline = null;
    let onTrack = null;
    if (savingsGoal.deadline) {
        const now = new Date();
        const deadline = new Date(savingsGoal.deadline);
        daysUntilDeadline = Math.max(
            Math.ceil((deadline - now) / (1000 * 60 * 60 * 24)),
            0
        );

        // Calculate daily savings rate needed to meet the deadline
        if (daysUntilDeadline > 0 && remaining > 0) {
            const dailySavingsNeeded = remaining / daysUntilDeadline;
            // Check if current pace could meet the goal (using time elapsed vs progress made)
            const totalDays = Math.ceil(
                (deadline - new Date(savingsGoal.createdAt)) / (1000 * 60 * 60 * 24)
            );
            const daysElapsed = totalDays - daysUntilDeadline;
            const expectedProgress = daysElapsed > 0
                ? (daysElapsed / totalDays) * savingsGoal.targetAmount
                : 0;
            onTrack = savingsGoal.currentAmount >= expectedProgress;

            onTrack = { dailySavingsNeeded: Math.round(dailySavingsNeeded * 100) / 100, isOnTrack: onTrack };
        } else if (remaining === 0) {
            onTrack = { dailySavingsNeeded: 0, isOnTrack: true };
        }
    }

    const progress = {
        goalId: savingsGoal._id,
        name: savingsGoal.name,
        targetAmount: savingsGoal.targetAmount,
        currentAmount: savingsGoal.currentAmount,
        remaining,
        percentComplete: Math.round(percentComplete * 100) / 100,
        isCompleted: savingsGoal.isCompleted,
        deadline: savingsGoal.deadline,
        daysUntilDeadline,
        onTrack,
    };

    return res.status(200).json(
        new ApiResponse(200, progress, "Savings goal progress fetched successfully")
    );
});

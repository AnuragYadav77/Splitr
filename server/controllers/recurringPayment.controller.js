import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { RecurringPayment } from "../models/recurringPayment.model.js";
import { Section } from "../models/section.model.js";
import { Category } from "../models/category.model.js";


const VALID_FREQUENCIES = ["weekly", "monthly", "quarterly", "yearly"];


// ── Helper ──────────────────────────────────────────────────────────────────
// Calculates the next due date based on the current due date and frequency.
function computeNextDueDate(currentDueDate, frequency) {
    const date = new Date(currentDueDate);

    switch (frequency) {
        case "weekly":
            date.setDate(date.getDate() + 7);
            break;
        case "monthly":
            date.setMonth(date.getMonth() + 1);
            break;
        case "quarterly":
            date.setMonth(date.getMonth() + 3);
            break;
        case "yearly":
            date.setFullYear(date.getFullYear() + 1);
            break;
    }

    return date;
}


// CREATE RECURRING PAYMENT
// Sets up a new recurring payment (e.g., "Netflix", "Gym Membership") for the
// authenticated user. Optionally links it to a section (spending envelope) and
// a category for classification.
export const createRecurringPayment = asyncHandler(async (req, res) => {

    //1. Pull the required fields from the request body
    const { name, amount, frequency, nextDueDate, section, category } = req.body;

    //2. Validate required fields
    if (!name || typeof name !== "string" || name.trim() === "") {
        throw new ApiError(400, "Payment name is required");
    }

    if (amount === undefined || typeof amount !== "number" || amount <= 0) {
        throw new ApiError(400, "Amount must be a valid number greater than zero");
    }

    if (!frequency || !VALID_FREQUENCIES.includes(frequency)) {
        throw new ApiError(
            400,
            `Frequency must be one of: ${VALID_FREQUENCIES.join(", ")}`
        );
    }

    if (!nextDueDate || isNaN(Date.parse(nextDueDate))) {
        throw new ApiError(400, "A valid next due date is required");
    }

    //3. If a section is provided, verify it exists and belongs to this user
    if (section) {
        const sectionDoc = await Section.findById(section);

        if (!sectionDoc) {
            throw new ApiError(404, "Section not found");
        }

        if (sectionDoc.user.toString() !== req.user._id.toString()) {
            throw new ApiError(403, "You are not authorized to link to this section");
        }
    }

    //4. If a category is provided, verify it exists and belongs to this user
    if (category) {
        const categoryDoc = await Category.findById(category);

        if (!categoryDoc) {
            throw new ApiError(404, "Category not found");
        }

        if (categoryDoc.user.toString() !== req.user._id.toString()) {
            throw new ApiError(403, "You are not authorized to use this category");
        }
    }

    //5. Create the recurring payment document
    const recurringPayment = await RecurringPayment.create({
        user: req.user._id,
        name: name.trim(),
        amount,
        frequency,
        nextDueDate: new Date(nextDueDate),
        section: section || null,
        category: category || undefined,
        isActive: true,
    });

    //6. Populate references for the response
    const populated = await RecurringPayment.findById(recurringPayment._id)
        .populate("section", "name emoji monthlyBudget")
        .populate("category", "name emoji");

    //7. Send back the newly created recurring payment
    return res.status(201).json(
        new ApiResponse(201, populated, "Recurring payment created successfully")
    );
});


// GET USER RECURRING PAYMENTS
// Returns all recurring payments belonging to the authenticated user.
// Supports optional query filters: isActive, frequency, section.
export const getUserRecurringPayments = asyncHandler(async (req, res) => {

    //1. Build the base filter — always scoped to the current user
    const filter = { user: req.user._id };

    //2. Apply optional query-string filters
    const { isActive, frequency, section } = req.query;

    if (isActive !== undefined) {
        filter.isActive = isActive === "true";
    }

    if (frequency && VALID_FREQUENCIES.includes(frequency)) {
        filter.frequency = frequency;
    }

    if (section) {
        filter.section = section;
    }

    //3. Fetch matching recurring payments with references populated
    const payments = await RecurringPayment.find(filter)
        .populate("section", "name emoji monthlyBudget")
        .populate("category", "name emoji")
        .sort({ nextDueDate: 1 });

    //4. Return the list — an empty array is still a valid 200 response
    return res.status(200).json(
        new ApiResponse(200, payments, "Recurring payments fetched successfully")
    );
});


// GET RECURRING PAYMENT BY ID
// Returns a single recurring payment by its database ID, after verifying ownership.
export const getRecurringPaymentById = asyncHandler(async (req, res) => {

    //1. The payment ID comes from the URL parameter
    const { paymentId } = req.params;

    //2. Look up the recurring payment with references populated
    const payment = await RecurringPayment.findById(paymentId)
        .populate("section", "name emoji monthlyBudget")
        .populate("category", "name emoji");

    //3. If no payment was found, return a 404
    if (!payment) {
        throw new ApiError(404, "Recurring payment not found");
    }

    //4. Make sure this payment belongs to the requesting user
    if (payment.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to view this recurring payment");
    }

    //5. All good — return the payment
    return res.status(200).json(
        new ApiResponse(200, payment, "Recurring payment fetched successfully")
    );
});


// UPDATE RECURRING PAYMENT
// Updates an existing recurring payment's fields. Only provided fields are modified.
export const updateRecurringPayment = asyncHandler(async (req, res) => {

    //1. Payment ID from the URL, update payload from the body
    const { paymentId } = req.params;
    const { name, amount, frequency, nextDueDate, section, category, isActive } = req.body;

    //2. At least one updatable field must be provided
    if (
        name === undefined &&
        amount === undefined &&
        frequency === undefined &&
        nextDueDate === undefined &&
        section === undefined &&
        category === undefined &&
        isActive === undefined
    ) {
        throw new ApiError(400, "Please provide at least one field to update");
    }

    //3. Validate individual fields if provided
    if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
        throw new ApiError(400, "Payment name cannot be empty");
    }

    if (amount !== undefined && (typeof amount !== "number" || amount <= 0)) {
        throw new ApiError(400, "Amount must be a valid number greater than zero");
    }

    if (frequency !== undefined && !VALID_FREQUENCIES.includes(frequency)) {
        throw new ApiError(
            400,
            `Frequency must be one of: ${VALID_FREQUENCIES.join(", ")}`
        );
    }

    if (nextDueDate !== undefined && isNaN(Date.parse(nextDueDate))) {
        throw new ApiError(400, "A valid next due date is required");
    }

    //4. Find the existing payment and confirm ownership
    const payment = await RecurringPayment.findById(paymentId);

    if (!payment) {
        throw new ApiError(404, "Recurring payment not found");
    }

    if (payment.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to update this recurring payment");
    }

    //5. If a new section is provided, verify it exists and belongs to this user
    if (section !== undefined && section !== null) {
        const sectionDoc = await Section.findById(section);

        if (!sectionDoc) {
            throw new ApiError(404, "Section not found");
        }

        if (sectionDoc.user.toString() !== req.user._id.toString()) {
            throw new ApiError(403, "You are not authorized to link to this section");
        }
    }

    //6. If a new category is provided, verify it exists and belongs to this user
    if (category !== undefined && category !== null) {
        const categoryDoc = await Category.findById(category);

        if (!categoryDoc) {
            throw new ApiError(404, "Category not found");
        }

        if (categoryDoc.user.toString() !== req.user._id.toString()) {
            throw new ApiError(403, "You are not authorized to use this category");
        }
    }

    //7. Build the update object with only the provided fields
    const updateFields = {};
    if (name !== undefined) updateFields.name = name.trim();
    if (amount !== undefined) updateFields.amount = amount;
    if (frequency !== undefined) updateFields.frequency = frequency;
    if (nextDueDate !== undefined) updateFields.nextDueDate = new Date(nextDueDate);
    if (section !== undefined) updateFields.section = section;
    if (category !== undefined) updateFields.category = category;
    if (isActive !== undefined) updateFields.isActive = isActive;

    //8. Apply the update and return the new document
    const updatedPayment = await RecurringPayment.findByIdAndUpdate(
        paymentId,
        { $set: updateFields },
        { new: true }
    )
        .populate("section", "name emoji monthlyBudget")
        .populate("category", "name emoji");

    return res.status(200).json(
        new ApiResponse(200, updatedPayment, "Recurring payment updated successfully")
    );
});


// DELETE RECURRING PAYMENT
// Permanently removes a recurring payment. Only the owner can delete it.
export const deleteRecurringPayment = asyncHandler(async (req, res) => {

    //1. Payment ID comes from the URL parameter
    const { paymentId } = req.params;

    //2. Find the payment and verify it exists
    const payment = await RecurringPayment.findById(paymentId);

    if (!payment) {
        throw new ApiError(404, "Recurring payment not found");
    }

    //3. Only the owner is allowed to delete their own recurring payment
    if (payment.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this recurring payment");
    }

    //4. Delete the document from the database
    await RecurringPayment.findByIdAndDelete(paymentId);

    //5. Confirm deletion
    return res.status(200).json(
        new ApiResponse(200, {}, "Recurring payment deleted successfully")
    );
});


// TOGGLE ACTIVE STATUS
// Flips the `isActive` flag on a recurring payment.
// Allows the user to pause/resume a subscription without deleting it.
export const toggleRecurringPayment = asyncHandler(async (req, res) => {

    //1. Payment ID from the URL parameter
    const { paymentId } = req.params;

    //2. Find the payment and verify ownership
    const payment = await RecurringPayment.findById(paymentId);

    if (!payment) {
        throw new ApiError(404, "Recurring payment not found");
    }

    if (payment.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to modify this recurring payment");
    }

    //3. Flip the isActive flag
    const updatedPayment = await RecurringPayment.findByIdAndUpdate(
        paymentId,
        { $set: { isActive: !payment.isActive } },
        { new: true }
    )
        .populate("section", "name emoji monthlyBudget")
        .populate("category", "name emoji");

    const statusMsg = updatedPayment.isActive ? "activated" : "paused";

    return res.status(200).json(
        new ApiResponse(200, updatedPayment, `Recurring payment ${statusMsg}`)
    );
});


// ADVANCE DUE DATE
// Moves the `nextDueDate` forward by one cycle based on the payment's frequency.
// Typically called after a recurring payment has been processed/paid for the current cycle.
export const advanceDueDate = asyncHandler(async (req, res) => {

    //1. Payment ID from the URL parameter
    const { paymentId } = req.params;

    //2. Find the payment and verify ownership
    const payment = await RecurringPayment.findById(paymentId);

    if (!payment) {
        throw new ApiError(404, "Recurring payment not found");
    }

    if (payment.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to modify this recurring payment");
    }

    //3. Compute the next due date based on the frequency
    const newDueDate = computeNextDueDate(payment.nextDueDate, payment.frequency);

    //4. Update the document
    const updatedPayment = await RecurringPayment.findByIdAndUpdate(
        paymentId,
        { $set: { nextDueDate: newDueDate } },
        { new: true }
    )
        .populate("section", "name emoji monthlyBudget")
        .populate("category", "name emoji");

    return res.status(200).json(
        new ApiResponse(200, updatedPayment, "Due date advanced to next cycle")
    );
});


// GET UPCOMING PAYMENTS
// Returns all active recurring payments for the user whose nextDueDate falls
// within the specified number of days (default: 7).
// Useful for dashboard widgets and notification triggers.
export const getUpcomingPayments = asyncHandler(async (req, res) => {

    //1. How many days ahead to look (default 7, capped at 90)
    let days = parseInt(req.query.days, 10);
    if (isNaN(days) || days < 1) days = 7;
    if (days > 90) days = 90;

    //2. Calculate the date window
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    //3. Find active payments due within the window
    const upcoming = await RecurringPayment.find({
        user: req.user._id,
        isActive: true,
        nextDueDate: { $gte: now, $lte: cutoff },
    })
        .populate("section", "name emoji monthlyBudget")
        .populate("category", "name emoji")
        .sort({ nextDueDate: 1 });

    return res.status(200).json(
        new ApiResponse(200, upcoming, `Upcoming payments within ${days} days`)
    );
});

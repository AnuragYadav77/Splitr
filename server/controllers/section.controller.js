import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Section } from "../models/section.model.js";


// CREATE SECTION
// Creates a new budget section for the authenticated user.
// Each section represents a spending envelope (e.g., "Groceries", "Rent")
// with its own monthly budget and optional emoji label.
export const createSection = asyncHandler(async (req, res) => {

    //1. Pull the required fields from the request body
    const { name, monthlyBudget, emoji, isFixed } = req.body;

    //2. Both name and monthlyBudget are required — reject early if missing
    if (!name || monthlyBudget === undefined) {
        throw new ApiError(400, "Name and monthly budget are required");
    }

    //3. Monthly budget must be a valid non-negative number
    if (typeof monthlyBudget !== "number" || monthlyBudget < 0) {
        throw new ApiError(400, "Monthly budget must be a valid non-negative number");
    }

    //4. Create the section document and tie it to the current user
    const section = await Section.create({
        user: req.user._id,
        name: name.trim(),
        monthlyBudget,
        emoji: emoji || "",
        isFixed: isFixed ?? false,
    });

    //5. Send back the newly created section
    return res.status(201).json(
        new ApiResponse(201, section, "Section created successfully")
    );
});


// GET USER SECTIONS
export const getUserSections = asyncHandler(async (req, res) => {

    //1. Find every section owned by this user
    const sections = await Section.find({ user: req.user._id })
        .sort({ createdAt: -1 });

    //2. Return the list — an empty array is still a valid 200 response
    return res.status(200).json(
        new ApiResponse(200, sections, "Sections fetched successfully")
    );
});


// GET SECTION BY ID
export const getSectionById = asyncHandler(async (req, res) => {

    //1. The section ID comes from the URL parameter
    const { sectionId } = req.params;

    //2. Look up the section in the database
    const section = await Section.findById(sectionId);

    //3. If no section was found, return a 404
    if (!section) {
        throw new ApiError(404, "Section not found");
    }

    //4. Make sure this section belongs to the requesting user
    if (section.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to view this section");
    }

    //5. All good — return the section
    return res.status(200).json(
        new ApiResponse(200, section, "Section fetched successfully")
    );
});


// UPDATE SECTION
export const updateSection = asyncHandler(async (req, res) => {

    //1. Section ID from the URL, update payload from the body
    const { sectionId } = req.params;
    const { name, monthlyBudget, emoji, isFixed } = req.body;

    //2. At least one updatable field must be provided
    if (
        !name &&
        monthlyBudget === undefined &&
        emoji === undefined &&
        isFixed === undefined
    ) {
        throw new ApiError(400, "Please provide at least one field to update");
    }

    //3. Validate the new monthly budget value if one was supplied
    if (
        monthlyBudget !== undefined &&
        (typeof monthlyBudget !== "number" || monthlyBudget < 0)
    ) {
        throw new ApiError(400, "Monthly budget must be a valid non-negative number");
    }

    //4. Find the section and confirm ownership before touching it
    const section = await Section.findById(sectionId);

    if (!section) {
        throw new ApiError(404, "Section not found");
    }

    if (section.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to update this section");
    }

    //5. Build the update object with only the provided fields
    const updateFields = {};
    if (name) updateFields.name = name.trim();
    if (monthlyBudget !== undefined) updateFields.monthlyBudget = monthlyBudget;
    if (emoji !== undefined) updateFields.emoji = emoji;
    if (isFixed !== undefined) updateFields.isFixed = isFixed;

    //6. Apply the update and return the new document
    const updatedSection = await Section.findByIdAndUpdate(
        sectionId,
        { $set: updateFields },
        { new: true }
    );

    return res.status(200).json(
        new ApiResponse(200, updatedSection, "Section updated successfully")
    );
});


// DELETE SECTION
export const deleteSection = asyncHandler(async (req, res) => {

    //1. Section ID comes from the URL parameter
    const { sectionId } = req.params;

    //2. Find the section and verify it exists
    const section = await Section.findById(sectionId);

    if (!section) {
        throw new ApiError(404, "Section not found");
    }

    //3. Only the owner is allowed to delete their own section
    if (section.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this section");
    }

    //4. Delete the document from the database
    await Section.findByIdAndDelete(sectionId);

    //5. Confirm deletion — no body needed, just a 200 with a clear message
    return res.status(200).json(
        new ApiResponse(200, {}, "Section deleted successfully")
    );
});


// ADD MONEY TO SECTION
// Increments the `spent` field of a section by the given amount.
// This represents money being allocated or spent against the section's budget.
export const addMoneyToSection = asyncHandler(async (req, res) => {

    //1. Section ID from the URL, amount from the body
    const { sectionId } = req.params;
    const { amount } = req.body;

    //2. Amount is required and must be a positive number
    if (typeof amount !== "number" || amount <= 0) {
        throw new ApiError(400, "Amount must be a valid number greater than zero");
    }

    //3. Find the section and confirm it belongs to the requesting user
    const section = await Section.findById(sectionId);

    if (!section) {
        throw new ApiError(404, "Section not found");
    }

    if (section.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to modify this section");
    }

    //4. Atomically increment the spent counter using $inc
    // This is safer than read-modify-write in a concurrent environment
    const updatedSection = await Section.findByIdAndUpdate(
        sectionId,
        { $inc: { spent: amount } },
        { new: true }
    );

    return res.status(200).json(
        new ApiResponse(
            200,
            updatedSection,
            "Money added to section successfully"
        )
    );
});
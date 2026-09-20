import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Category } from "../models/category.model.js";


// CREATE CATEGORY
// Creates a new custom category for the authenticated user.
// Each category can have a name, an optional emoji, and an optional description.
export const createCategory = asyncHandler(async (req, res) => {

    //1. Pull the required fields from the request body
    const { name, emoji, description } = req.body;


    //2. name is required and must be a non-empty string
    if (typeof name !== "string" || name.trim() === "") {
        throw new ApiError(400, "Category name is required");
    }
    //3. Prevent duplicate category names for the same user
    const existingCategory = await Category.findOne({
        user: req.user._id,
        name: name.trim(),
    });

    if (existingCategory) {
        throw new ApiError(409, "A category with this name already exists");
    }

    //4. Create the category document and tie it to the current user
    const category = await Category.create({
        user: req.user._id,
        name: name.trim(),
        emoji: emoji || "",
        description: description || "",
        isDefault: false,
    });

    //5. Send back the newly created category
    return res.status(201).json(
        new ApiResponse(201, category, "Category created successfully")
    );
});


// GET USER CATEGORIES
// Returns all categories belonging to the authenticated user. 
export const getUserCategories = asyncHandler(async (req, res) => {

    //1. Find every category owned by this user, newest first
    const categories = await Category.find({ user: req.user._id })
        .sort({ createdAt: -1 });

    //2. Return the list — an empty array is still a valid 200 response
    return res.status(200).json(
        new ApiResponse(200, categories, "Categories fetched successfully")
    );
});


// GET CATEGORY BY ID
export const getCategoryById = asyncHandler(async (req, res) => {

    //1. The category ID comes from the URL parameter
    const { categoryId } = req.params;

    //2. Look up the category in the database
    const category = await Category.findById(categoryId);

    //3. If no category was found, return a 404
    if (!category) {
        throw new ApiError(404, "Category not found");
    }

    //4. Make sure this category belongs to the requesting user
    if (category.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to view this category");
    }

    //5. All good — return the category
    return res.status(200).json(
        new ApiResponse(200, category, "Category fetched successfully")
    );
});


// UPDATE CATEGORY
export const updateCategory = asyncHandler(async (req, res) => {

    //1. Category ID from the URL, update payload from the body
    const { categoryId } = req.params;
    const { name, emoji, description } = req.body;


    //2. At least one updatable field must be provided
    if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
        throw new ApiError(400, "Category name cannot be empty");
    }

    if (name === undefined && emoji === undefined && description === undefined) {
        throw new ApiError(400, "Please provide at least one field to update");
    }

    //3. Find the category and confirm ownership before touching it
    const category = await Category.findById(categoryId);

    if (!category) {
        throw new ApiError(404, "Category not found");
    }

    if (category.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to update this category");
    }

    //4. Default categories cannot be modified
    if (category.isDefault) {
        throw new ApiError(403, "Default categories cannot be modified");
    }

    //5. If renaming, ensure the new name doesn't clash with another existing category
    if (name && name.trim() !== category.name) {
        const duplicate = await Category.findOne({
            user: req.user._id,
            name: name.trim(),
            _id: { $ne: categoryId },
        });

        if (duplicate) {
            throw new ApiError(409, "A category with this name already exists");
        }
    }

    //6. Build the update object with only the provided fields
    const updateFields = {};
    if (name) updateFields.name = name.trim();
    if (emoji !== undefined) updateFields.emoji = emoji;
    if (description !== undefined) updateFields.description = description;

    //7. Apply the update and return the new document
    const updatedCategory = await Category.findByIdAndUpdate(
        categoryId,
        { $set: updateFields },
        { new: true }
    );

    return res.status(200).json(
        new ApiResponse(200, updatedCategory, "Category updated successfully")
    );
});


// DELETE CATEGORY
export const deleteCategory = asyncHandler(async (req, res) => {

    //1. Category ID comes from the URL parameter
    const { categoryId } = req.params;

    //2. Find the category and verify it exists
    const category = await Category.findById(categoryId);

    if (!category) {
        throw new ApiError(404, "Category not found");
    }

    //3. Only the owner is allowed to delete their own category
    if (category.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this category");
    }

    //4. Default categories cannot be deleted
    if (category.isDefault) {
        throw new ApiError(403, "Default categories cannot be deleted");
    }

    //5. Delete the document from the database
    await Category.findByIdAndDelete(categoryId);

    //6. Confirm deletion — no body needed, just a 200 with a clear message
    return res.status(200).json(
        new ApiResponse(200, {}, "Category deleted successfully")
    );
});

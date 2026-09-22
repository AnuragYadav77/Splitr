import { Router } from "express";
import {
    createCategory,
    getUserCategories,
    getCategoryById,
    updateCategory,
    deleteCategory
} from "../controllers/category.controller.js";
import { verifyJWT } from "../middleware/verifyJWT.middleware.js";

const router = Router();

// All category routes require authentication — user must be logged in
router.use(verifyJWT);

// Base routes — create a new category or fetch all categories for the current user
router.route("/")
    .post(createCategory)
    .get(getUserCategories);

// Quick aliases for frontend convenience
router.route("/create").post(createCategory);
router.route("/user-categories").get(getUserCategories);

// Individual category routes — view details, update fields, or delete by ID
router.route("/:categoryId")
    .get(getCategoryById)
    .patch(updateCategory)
    .put(updateCategory)
    .delete(deleteCategory);

export default router;

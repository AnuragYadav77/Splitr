import { Router } from "express";
import {
    createSection,
    getUserSections,
    getSectionById,
    updateSection,
    deleteSection,
    addMoneyToSection
} from "../controllers/section.controller.js";
import { verifyJWT } from "../middleware/verifyJWT.middleware.js";

const router = Router();

// All section routes require user authentication via verifyJWT
router.use(verifyJWT);

// Base collection routes
// POST /api/v1/sections      -> Creates a new budget section for the user
// GET  /api/v1/sections      -> Fetches all sections owned by the user
router.route("/")
    .post(createSection)
    .get(getUserSections);

// Explicit aliases for convenience
router.route("/create").post(createSection);
router.route("/user-sections").get(getUserSections);

// Operations on an individual section by ID
// GET    /api/v1/sections/:sectionId -> Get details of a single section
// PATCH  /api/v1/sections/:sectionId -> Update section fields (name, budget, emoji, isFixed)
// PUT    /api/v1/sections/:sectionId -> Alias for updating section fields
// DELETE /api/v1/sections/:sectionId -> Remove the section
router.route("/:sectionId")
    .get(getSectionById)
    .patch(updateSection)
    .put(updateSection)
    .delete(deleteSection);

// Add money / top-up spending against a section
// POST  /api/v1/sections/:sectionId/add-money -> Increments the spent amount
// PATCH /api/v1/sections/:sectionId/add-money -> Supported as PATCH as well
// Also aliased to /topup for API flexibility
router.route("/:sectionId/add-money")
    .post(addMoneyToSection)
    .patch(addMoneyToSection);

router.route("/:sectionId/topup")
    .post(addMoneyToSection)
    .patch(addMoneyToSection);

export default router;
export { router };

import { Router } from "express";
import {
    createBudget,
    getUserBudgets,
    getBudgetById,
    updateBudget,
    deleteBudget
} from "../controllers/budget.controller.js";
import { verifyJWT } from "../middleware/verifyJWT.middleware.js";

const router = Router();

// All budget routes require authentication — user must be logged in
router.use(verifyJWT);

// Base routes — create a new monthly budget or fetch all budgets for the current user
router.route("/")
    .post(createBudget)
    .get(getUserBudgets);

// Quick aliases for frontend convenience
router.route("/create").post(createBudget);
router.route("/user-budgets").get(getUserBudgets);

// Individual budget routes — view details, update figures, or delete by ID
router.route("/:budgetId")
    .get(getBudgetById)
    .patch(updateBudget)
    .put(updateBudget)
    .delete(deleteBudget);

export default router;

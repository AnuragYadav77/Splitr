import { Router } from "express";
import {
    createSavingsGoal,
    getUserSavingsGoals,
    getSavingsGoalById,
    updateSavingsGoal,
    deleteSavingsGoal,
    depositToSavingsGoal,
    withdrawFromSavingsGoal,
    getSavingsGoalProgress
} from "../controllers/savingsGoal.controller.js";
import { verifyJWT } from "../middleware/verifyJWT.middleware.js";

const router = Router();

// All savings goal routes require authentication — user must be logged in
router.use(verifyJWT);

// Base routes — create a new savings goal or fetch all savings goals for the current user
router.route("/")
    .post(createSavingsGoal)
    .get(getUserSavingsGoals);

// Quick aliases for frontend convenience
router.route("/create").post(createSavingsGoal);
router.route("/user-savings-goals").get(getUserSavingsGoals);

// Individual savings goal routes — view details, update fields, or delete by ID
router.route("/:goalId")
    .get(getSavingsGoalById)
    .patch(updateSavingsGoal)
    .put(updateSavingsGoal)
    .delete(deleteSavingsGoal);

// Deposit and withdrawal routes — modify savings balance
router.route("/:goalId/deposit")
    .post(depositToSavingsGoal)
    .patch(depositToSavingsGoal);

router.route("/:goalId/withdraw")
    .post(withdrawFromSavingsGoal)
    .patch(withdrawFromSavingsGoal);

// Progress route — fetch metrics, completion percentage, and estimated timeline
router.route("/:goalId/progress")
    .get(getSavingsGoalProgress);

export default router;

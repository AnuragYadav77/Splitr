import { Router } from "express";
import {
    createHistory,
    getUserHistory,
    getHistoryById,
    updateHistory,
    deleteHistory
} from "../controllers/history.controller.js";
import { verifyJWT } from "../middleware/verifyJWT.middleware.js";

const router = Router();

// All history routes require authentication — user must be logged in
router.use(verifyJWT);

// Base routes — create a new monthly history record or fetch all history records for the current user
router.route("/")
    .post(createHistory)
    .get(getUserHistory);

// Quick aliases for frontend convenience
router.route("/create").post(createHistory);
router.route("/user-history").get(getUserHistory);

// Individual history routes — view details, update fields, or delete by ID
router.route("/:historyId")
    .get(getHistoryById)
    .patch(updateHistory)
    .put(updateHistory)
    .delete(deleteHistory);

export default router;

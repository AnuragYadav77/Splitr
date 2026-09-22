import { Router } from "express";
import {
    createTransfer,
    getUserTransfers,
    getTransferById,
    updateTransfer,
    deleteTransfer
} from "../controllers/transfer.controller.js";
import { verifyJWT } from "../middleware/verifyJWT.middleware.js";

const router = Router();

// All transfer routes require authentication — user must be logged in
router.use(verifyJWT);

// Base routes — create a new transfer between sections or fetch all transfers for the current user
router.route("/")
    .post(createTransfer)
    .get(getUserTransfers);

// Quick aliases for frontend convenience
router.route("/create").post(createTransfer);
router.route("/user-transfers").get(getUserTransfers);

// Individual transfer routes — view details, update fields, or delete by ID
router.route("/:transferId")
    .get(getTransferById)
    .patch(updateTransfer)
    .put(updateTransfer)
    .delete(deleteTransfer);

export default router;

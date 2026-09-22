import { Router } from "express";
import {
    createTransaction,
    getUserTransactions,
    getTransactionById,
    updateTransaction,
    deleteTransaction
} from "../controllers/transaction.controller.js";
import { verifyJWT } from "../middleware/verifyJWT.middleware.js";

const router = Router();

// All transaction routes require authentication — user must be logged in
router.use(verifyJWT);

// Base routes — create a new transaction or fetch all transactions for the current user
router.route("/")
    .post(createTransaction)
    .get(getUserTransactions);

// Quick aliases for frontend convenience
router.route("/create").post(createTransaction);
router.route("/user-transactions").get(getUserTransactions);

// Individual transaction routes — view details, update fields, or delete by ID
router.route("/:transactionId")
    .get(getTransactionById)
    .patch(updateTransaction)
    .put(updateTransaction)
    .delete(deleteTransaction);

export default router;

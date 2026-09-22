import { Router } from "express";
import {
    createBill,
    getUserBills,
    getBillById,
    updateBill,
    deleteBill,
    markBillAsPaid,
    markBillAsUnpaid,
    resetAllBills
} from "../controllers/bill.controller.js";
import { verifyJWT } from "../middleware/verifyJWT.middleware.js";

const router = Router();

// All bill routes require authentication — user must be logged in
router.use(verifyJWT);

// Base routes — create a new bill or fetch all bills for the current user
router.route("/")
    .post(createBill)
    .get(getUserBills);

// Quick aliases for frontend convenience
router.route("/create").post(createBill);
router.route("/user-bills").get(getUserBills);

// Bulk reset — mark all bills as unpaid (useful for month-end reset)
// Defined before /:billId so "reset" doesn't get caught as a billId parameter
router.route("/reset")
    .post(resetAllBills)
    .patch(resetAllBills);

// Individual bill routes — view details, update fields, or delete by ID
router.route("/:billId")
    .get(getBillById)
    .patch(updateBill)
    .put(updateBill)
    .delete(deleteBill);

// Payment status routes — toggle paid/unpaid status for a single bill
router.route("/:billId/pay")
    .patch(markBillAsPaid)
    .post(markBillAsPaid);

router.route("/:billId/unpay")
    .patch(markBillAsUnpaid)
    .post(markBillAsUnpaid);

export default router;

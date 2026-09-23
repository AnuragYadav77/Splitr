import { Router } from "express";
import {
    createRecurringPayment,
    getUserRecurringPayments,
    getRecurringPaymentById,
    updateRecurringPayment,
    deleteRecurringPayment,
    toggleRecurringPayment,
    advanceDueDate,
    getUpcomingPayments
} from "../controllers/recurringPayment.controller.js";
import { verifyJWT } from "../middleware/verifyJWT.middleware.js";

const router = Router();

// All recurring payment routes require authentication — user must be logged in
router.use(verifyJWT);

// Base routes — create a new recurring payment or fetch all recurring payments for the current user
router.route("/")
    .post(createRecurringPayment)
    .get(getUserRecurringPayments);

// Quick aliases for frontend convenience
router.route("/create").post(createRecurringPayment);
router.route("/user-recurring-payments").get(getUserRecurringPayments);

// Upcoming payments — fetch active payments due within upcoming days (default 7 days)
// Defined before /:paymentId so "upcoming" is not treated as a paymentId parameter
router.route("/upcoming").get(getUpcomingPayments);

// Individual recurring payment routes — view details, update fields, or delete by ID
router.route("/:paymentId")
    .get(getRecurringPaymentById)
    .patch(updateRecurringPayment)
    .put(updateRecurringPayment)
    .delete(deleteRecurringPayment);

// Status and cycle management routes
router.route("/:paymentId/toggle")
    .patch(toggleRecurringPayment)
    .post(toggleRecurringPayment);

router.route("/:paymentId/advance")
    .patch(advanceDueDate)
    .post(advanceDueDate);

export default router;

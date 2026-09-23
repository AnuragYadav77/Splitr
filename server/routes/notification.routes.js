import { Router } from "express";
import {
    createNotification,
    getUserNotifications,
    getNotificationById,
    markNotificationAsRead,
    markNotificationAsUnread,
    deleteNotification,
    markAllNotificationsAsRead
} from "../controllers/notification.controller.js";
import { verifyJWT } from "../middleware/verifyJWT.middleware.js";

const router = Router();

// All notification routes require authentication — user must be logged in
router.use(verifyJWT);

// Base routes — create a new notification or fetch all notifications for the current user
router.route("/")
    .get(getUserNotifications);

// Quick aliases for frontend convenience

router.route("/user-notifications").get(getUserNotifications);

// Bulk update — mark all notifications as read for current user
// Defined before /:notificationId so it is not treated as a notificationId parameter
router.route("/read-all")
    .patch(markAllNotificationsAsRead)
    .post(markAllNotificationsAsRead);

router.route("/mark-all-read")
    .patch(markAllNotificationsAsRead)
    .post(markAllNotificationsAsRead);

// Individual notification routes — view details or delete by ID
router.route("/:notificationId")
    .get(getNotificationById)
    .delete(deleteNotification);

// Status routes — mark individual notification as read or unread
router.route("/:notificationId/read")
    .patch(markNotificationAsRead)
    .post(markNotificationAsRead);

router.route("/:notificationId/unread")
    .patch(markNotificationAsUnread)
    .post(markNotificationAsUnread);

export default router;

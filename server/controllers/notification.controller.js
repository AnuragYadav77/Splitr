import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Notification } from "../models/notification.model.js";
import { Section } from "../models/section.model.js";


// CREATE NOTIFICATION
// Creates a new notification for a specific user.
// Typically called internally (e.g., by other controllers or services) to alert a user about an event.
export const createNotification = asyncHandler(async (req, res) => {

    //1. Pull the required fields from the request body
    const { user, type, title, message, section } = req.body;

    //2. Validate required fields
    if (!user) {
        throw new ApiError(400, "User ID is required");
    }

    if (typeof type !== "string" || !type.trim()) {
        throw new ApiError(400, "Notification type is required and must be a non-empty string");
    }

    if (typeof title !== "string" || !title.trim()) {
        throw new ApiError(400, "Notification title is required and must be a non-empty string");
    }

    if (typeof message !== "string" || !message.trim()) {
        throw new ApiError(400, "Notification message is required and must be a non-empty string");
    }

    //3. Validate section if provided — it must belong to the specified user
    if (section) {
        const sectionExists = await Section.findOne({
            _id: section,
            user,
        });

        if (!sectionExists) {
            throw new ApiError(404, "Section not found");
        }
    }

    //4. Create the notification document
    const notification = await Notification.create({
        user,
        type: type.trim(),
        title: title.trim(),
        message: message.trim(),
        section: section || null,
        isRead: false,
    });

    //5. Send back the newly created notification
    return res.status(201).json(
        new ApiResponse(201, notification, "Notification created successfully")
    );
});


// GET USER NOTIFICATIONS
// Returns all notifications belonging to the authenticated user, sorted by newest first.
export const getUserNotifications = asyncHandler(async (req, res) => {

    //1. Find every notification for this user, ordered by most recent
    const notifications = await Notification.find({ user: req.user._id })
        .sort({ createdAt: -1 });

    //2. Return the list — an empty array is still a valid 200 response
    return res.status(200).json(
        new ApiResponse(200, notifications, "Notifications fetched successfully")
    );
});


// GET NOTIFICATION BY ID
// Returns a single notification by its database ID, after verifying ownership.
export const getNotificationById = asyncHandler(async (req, res) => {

    //1. The notification ID comes from the URL parameter
    const { notificationId } = req.params;

    //2. Look up the notification in the database
    const notification = await Notification.findById(notificationId);

    //3. If no notification was found, return a 404
    if (!notification) {
        throw new ApiError(404, "Notification not found");
    }

    //4. Make sure this notification belongs to the requesting user
    if (notification.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to view this notification");
    }

    //5. All good — return the notification
    return res.status(200).json(
        new ApiResponse(200, notification, "Notification fetched successfully")
    );
});


// MARK NOTIFICATION AS READ
// Sets the `isRead` flag to true for the given notification.
export const markNotificationAsRead = asyncHandler(async (req, res) => {

    //1. Notification ID from the URL parameter
    const { notificationId } = req.params;

    //2. Find the notification and verify ownership
    const notification = await Notification.findById(notificationId);

    if (!notification) {
        throw new ApiError(404, "Notification not found");
    }

    if (notification.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to modify this notification");
    }

    //3. If already read, let the caller know
    if (notification.isRead) {
        throw new ApiError(400, "Notification is already marked as read");
    }

    //4. Update the isRead flag
    const updatedNotification = await Notification.findByIdAndUpdate(
        notificationId,
        { $set: { isRead: true } },
        { new: true }
    );

    return res.status(200).json(
        new ApiResponse(200, updatedNotification, "Notification marked as read")
    );
});


// MARK NOTIFICATION AS UNREAD
// Resets the `isRead` flag to false for the given notification.
export const markNotificationAsUnread = asyncHandler(async (req, res) => {

    //1. Notification ID from the URL parameter
    const { notificationId } = req.params;

    //2. Find the notification and verify ownership
    const notification = await Notification.findById(notificationId);

    if (!notification) {
        throw new ApiError(404, "Notification not found");
    }

    if (notification.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to modify this notification");
    }

    //3. If already unread, no action needed
    if (!notification.isRead) {
        throw new ApiError(400, "Notification is already marked as unread");
    }

    //4. Reset the isRead flag
    const updatedNotification = await Notification.findByIdAndUpdate(
        notificationId,
        { $set: { isRead: false } },
        { new: true }
    );

    return res.status(200).json(
        new ApiResponse(200, updatedNotification, "Notification marked as unread")
    );
});


// DELETE NOTIFICATION
// Permanently removes a notification. Only the owner can delete their own notification.
export const deleteNotification = asyncHandler(async (req, res) => {

    //1. Notification ID comes from the URL parameter
    const { notificationId } = req.params;

    //2. Find the notification and verify it exists
    const notification = await Notification.findById(notificationId);

    if (!notification) {
        throw new ApiError(404, "Notification not found");
    }

    //3. Only the owner is allowed to delete their own notification
    if (notification.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this notification");
    }

    //4. Delete the document from the database
    await Notification.findByIdAndDelete(notificationId);

    //5. Confirm deletion
    return res.status(200).json(
        new ApiResponse(200, {}, "Notification deleted successfully")
    );
});


// MARK ALL NOTIFICATIONS AS READ
// Sets isRead to true for all of the authenticated user's unread notifications.
export const markAllNotificationsAsRead = asyncHandler(async (req, res) => {

    //1. Bulk-update all unread notifications for this user
    const result = await Notification.updateMany(
        { user: req.user._id, isRead: false },
        { $set: { isRead: true } }
    );

    return res.status(200).json(
        new ApiResponse(
            200,
            { modifiedCount: result.modifiedCount },
            "All notifications marked as read"
        )
    );
});
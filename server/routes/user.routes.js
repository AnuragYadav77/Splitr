import { Router } from "express";
import {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    getCurrentUser,
    updateProfile
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middleware/verifyJWT.middleware.js";

const router = Router();

// Public routes — no auth needed for these
router.route("/register").post(registerUser);
router.route("/login").post(loginUser);

// Refresh token route doesn't need verifyJWT because it uses the refresh token
// to issue new tokens when the access token has already expired
router.route("/refresh-token").post(refreshAccessToken);


// Protected routes — require a valid access token via verifyJWT
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/current-user").get(verifyJWT, getCurrentUser);
router.route("/me").get(verifyJWT, getCurrentUser); // quick alias for frontend convenience

// Updating profile details like name, phone, or monthly income
router.route("/update-profile").patch(verifyJWT, updateProfile);
router.route("/profile").patch(verifyJWT, updateProfile);

export default router;

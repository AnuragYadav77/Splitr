import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendPasswordResetEmail } from "../services/email.service.js";


// A small helper to generate both tokens for a user and save the refresh token
// in the database. We reuse this in login and refresh so we don't repeat ourselves
const generateAccessAndRefreshTokens = async (userId) => {

    // Find the user we want to generate tokens for
    const user = await User.findById(userId);

    // If the user does not exist, we cannot generate tokens
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Generate a new access token using the User model method
    const accessToken = user.generateAccessToken();

    // Generate a new refresh token using the User model method
    const refreshToken = user.generateRefreshToken();

    // Store the refresh token in the DB so we can validate it later
    // when the user wants to refresh their session
    user.refreshToken = refreshToken;

    // Skip validation on save — we're only touching the refreshToken field,
    // not the whole document
    await user.save({ validateBeforeSave: false });

    // Return both tokens to the controller that called this helper
    return { accessToken, refreshToken };
};


// REGISTER
export const registerUser = asyncHandler(async (req, res) => {

    //1. Get user details from frontend
    // Extract the required fields from the request body
    const { fullName, email, password, monthlyIncome, phoneNumber } = req.body;


    //2. Validation - not empty
    // Check whether any of the required fields is empty
    if ([fullName, email, password].some((field) => field?.trim() === "")) {

        // Throw a 400 Bad Request error if any field is empty
        throw new ApiError(400, "All fields are required");
    }


    //3. Check if the user already exists: email
    // Search the database for an existing user with this email
    const existedUser = await User.findOne({
        email: email.toLowerCase().trim()
    });

    // If a user with this email already exists, we stop right here
    if (existedUser) {

        // Throw a 409 Conflict error
        throw new ApiError(
            409,
            "User with this email already exists"
        );
    }


    //4. Create user object - create entry in DB
    // Create a new user in the database with their monthlyIncome if provided
    const user = await User.create({
        fullName: fullName.trim(),
        email: email.toLowerCase().trim(),
        password,
        phoneNumber: phoneNumber?.trim() || undefined,
        monthlyIncome: monthlyIncome !== undefined ? Number(monthlyIncome) : 0
    });


    //5. Check if the user has been successfully created or not
    // Also strip out sensitive fields — no need to send the password
    // or refresh token back to the client
    const createdUser = await User.findById(user._id)
        .select("-password -refreshToken");

    // If the user could not be retrieved after creation, something
    // went wrong on our end
    if (!createdUser) {

        // Throw a 500 Internal Server Error
        throw new ApiError(
            500,
            "Something went wrong while registering the user"
        );
    }


    //6. Return response
    // Send the newly created user back to the frontend
    return res
        .status(201)
        .json(
            new ApiResponse(
                201,
                createdUser,
                "User registered successfully"
            )
        );
});


// FORGOT PASSWORD — GENERATES TOKEN & SENDS EMAIL
export const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        throw new ApiError(400, "Registered email is required");
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
        throw new ApiError(404, "No account found with this email address");
    }

    // Generate random 32-byte hex token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    // Save hashed token and expiry (30 mins)
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    // Build reset URL
    const protocol = req.protocol || "http";
    const host = req.get("host") || "localhost:3000";
    const resetUrl = `${protocol}://${host}/pages/reset-password.html?token=${rawToken}`;

    // Send email
    const emailResult = await sendPasswordResetEmail({
        to: user.email,
        resetUrl,
        userName: user.fullName || "there"
    });

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {},
                "A password reset link has been sent to your email address."
            )
        );
});


// RESET PASSWORD — VERIFIES TOKEN & SETS NEW PASSWORD
export const resetPassword = asyncHandler(async (req, res) => {
    const { token, email, newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
        throw new ApiError(400, "Password must be at least 8 characters long");
    }

    if (!token) {
        throw new ApiError(400, "Invalid reset request. Password reset token is required.");
    }

    const hashedToken = crypto.createHash("sha256").update(token.trim()).digest("hex");
    const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
        throw new ApiError(400, "Password reset link is invalid or has expired. Please request a new one from the login page.");
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {},
                "Password has been reset successfully. You can now log in with your new password."
            )
        );
});


// LOGIN
export const loginUser = asyncHandler(async (req, res) => {

    //1. Get credentials from the request body
    const { email, password } = req.body;


    //2. Make sure the email and password fields aren't empty
    if (!email || !password) {
        throw new ApiError(400, "Email and password are required");
    }


    //3. Look up the user by email
    const user = await User.findOne({ email });

    // If no user was found with that email, they probably haven't registered yet
    if (!user) {
        throw new ApiError(404, "User does not exist");
    }


    //4. Check if the password is correct
    // isPasswordCorrect() is a method on the user model that uses bcrypt under the hood
    const isPasswordValid = await user.isPasswordCorrect(password);

    // Wrong password — keep the error message vague on purpose
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid credentials");
    }


    //5. Generate access and refresh tokens now that we know who the user is
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
        user._id
    );


    //6. Fetch the logged-in user again so we can send it without sensitive fields
    const loggedInUser = await User.findById(user._id)
        .select("-password -refreshToken");


    //7. Cookie options — httpOnly and secure so the client JS can't touch them
    // secure is false during local HTTP development and should be true in production HTTPS
    const cookieOptions = {
        httpOnly: true,
        secure: false
    };


    //8. Send both tokens as cookies along with the user data
    // The refresh token stays in the httpOnly cookie instead of being exposed in the response body
    return res
        .status(200)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken
                },
                "User logged in successfully"
            )
        );
});


// LOGOUT
export const logoutUser = asyncHandler(async (req, res) => {

    // The verifyJWT middleware already attached the user to req.user,
    // so we know exactly who is logging out. Just wipe the refresh token from the DB
    await User.findByIdAndUpdate(
        req.user._id,
        {
            // $unset removes the field from the document entirely instead of setting it to null
            $unset: { refreshToken: 1 }
        },
        {
            // Return the updated document, not the old one
            new: true
        }
    );

    // Same options as login — keep the cookies httpOnly and secure
    const cookieOptions = {
        httpOnly: true,
        secure: false
    };

    // Clear both cookies and send the response
    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        .json(
            new ApiResponse(
                200,
                {},
                "User logged out successfully"
            )
        );
});


// REFRESH ACCESS TOKEN
// When the access token expires, the client sends their refresh token
// and we hand them a brand new pair of tokens without forcing a re-login
export const refreshAccessToken = asyncHandler(async (req, res) => {

    //1. Grab the refresh token from cookies or the request body
    // Mobile clients might send it in the body instead of cookies
    const incomingRefreshToken =
        req.cookies?.refreshToken || req.body.refreshToken;

    // If there's no refresh token at all, the user isn't authenticated
    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request");
    }


    //2. Verify the incoming token is legit and decode the payload
    const decodedToken = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET
    );


    //3. Find the user that owns this refresh token
    // We use the user ID stored inside the refresh token because
    // verifyJWT is not required for this endpoint
    const user = await User.findById(decodedToken?._id);

    if (!user) {
        throw new ApiError(401, "Invalid refresh token");
    }


    //4. Make sure the token they sent matches what we have stored in the DB.
    // If they don't match, the token has already been used or was invalidated
    if (incomingRefreshToken !== user?.refreshToken) {
        throw new ApiError(401, "Refresh token is expired or has already been used");
    }


    //5. Everything checks out — generate a fresh pair of tokens
    const { accessToken, refreshToken: newRefreshToken } =
        await generateAccessAndRefreshTokens(user._id);

    // Use the same cookie settings as login during local development
    const cookieOptions = {
        httpOnly: true,
        secure: false
    };

    // Send the new tokens back as cookies and the access token in the response body
    return res
        .status(200)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", newRefreshToken, cookieOptions)
        .json(
            new ApiResponse(
                200,
                { accessToken },
                "Access token refreshed successfully"
            )
        );
});


// GET CURRENT USER
// Simple — the verifyJWT middleware already fetched the user and
// attached it to req.user, so we use that user's ID to fetch a clean version
export const getCurrentUser = asyncHandler(async (req, res) => {

    // Fetch the current user while excluding sensitive fields
    const user = await User.findById(req.user._id)
        .select("-password -refreshToken");

    // If the user no longer exists in the database
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Return the current user's safe information
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user,
                "Current user fetched successfully"
            )
        );
});


// UPDATE PROFILE
// Lets the user update their basic info. For sensitive changes like
// password we'd have a separate dedicated endpoint
export const updateProfile = asyncHandler(async (req, res) => {

    //1. Pull out only the fields we allow the user to update
    const { fullName, phoneNumber, monthlyIncome } = req.body;

    // At least one field should be provided — no point hitting the DB
    // with an empty update
    if (!fullName && !phoneNumber && monthlyIncome === undefined) {
        throw new ApiError(400, "Please provide at least one field to update");
    }


    //2. Build the update object with only the fields that were actually sent
    const updateFields = {};
    if (fullName) updateFields.fullName = fullName;
    if (phoneNumber) updateFields.phoneNumber = phoneNumber;
    if (monthlyIncome !== undefined) updateFields.monthlyIncome = monthlyIncome;


    //3. Find the user and apply the update
    // $set only touches the fields we specify — everything else stays the same
    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: updateFields
        },
        {
            // Return the updated document so we can send it back right away
            new: true
        }
    ).select("-password -refreshToken");

    // If the user was not found
    if (!updatedUser) {
        throw new ApiError(404, "User not found");
    }


    //4. Send the updated user back so the frontend can sync its state
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                updatedUser,
                "Profile updated successfully"
            )
        );
});
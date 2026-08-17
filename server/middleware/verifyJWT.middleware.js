import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

// Middleware to verify whether the user has a valid access token
export const verifyJWT = asyncHandler(async (req, res, next) => {

    // Get the access token either from:
    // 1. Cookies, or
    // 2. Authorization header (Bearer token)
    const token =
        req.cookies?.accessToken ||
        req.header("Authorization")?.replace("Bearer ", "");

    // If no token was provided, the user is not authenticated
    if (!token) {
        throw new ApiError(401, "Unauthorized request");
    }

    // Verify the token using our secret key.
    // If the token is invalid or expired, jwt.verify() throws an error.
    const decodedToken = jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET
    );

    // Find the user whose ID was stored inside the JWT
    const user = await User.findById(decodedToken?._id);

    // If the user doesn't exist anymore, the token is no longer valid
    if (!user) {
        throw new ApiError(401, "Invalid access token");
    }

    // Attach the authenticated user to the request object.
    // Controllers can now access the logged-in user using req.user
    req.user = user;

    // Move to the next middleware/controller
    next();
});
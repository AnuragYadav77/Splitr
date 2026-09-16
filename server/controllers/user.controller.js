import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// Registering user
export const registerUser = asyncHandler(async (req, res) => {

    //1. Get user details from frontend
    // Extract the required fields from the request body
    const { fullName, email, password } = req.body;


    //2. Validation - not empty
    // Check whether any of the required fields is empty
    if ([fullName, email, password].some((field) => field?.trim() === "")) {

        // Throw a 400 Bad Request error if any field is empty
        throw new ApiError(400, "All fields are required");
    }


    //3. Check if the user already exists: email
    // Search the database for an existing user with this email
    const existedUser = await User.findOne({
        email
    });

    // If a user with this email already exists
    if (existedUser) {

        // Throw a 409 Conflict error
        throw new ApiError(
            409,
            "User with this email already exists"
        );
    }


    //4. Create user object - create entry in DB
    // Create a new user in the database
    // Password hashing is handled automatically by the User model's
    // pre-save middleware
    const user = await User.create({
        fullName,
        email,
        password
    });


    //5. Check if the user has been successfully created or not.
    // Remove password and refreshToken fields from the response
    const createdUser = await User.findById(user._id)
        .select("-password -refreshToken");

    // If the user could not be retrieved after creation
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
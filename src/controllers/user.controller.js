// Import required modules and utilities
import { asyncHandler } from "../utils/asyncHandler.js"; // For handling async errors
import {ApiError} from "../utils/ApiError.js" // Custom error handler
import { User} from "../models/user.model.js" // User model
import {uploadOnCloudinary} from "../utils/cloundinary.js" // Cloudinary upload utility
import { ApiResponse } from "../utils/ApiResponse.js"; // Standardized API response format
import jwt from "jsonwebtoken" // For JWT token handling
import mongoose from "mongoose"; // MongoDB ODM

// Helper function to generate both access and refresh tokens
const generateAccessAndRefereshTokens = async(userId) =>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken() // Generate access token
        const refreshToken = user.generateRefreshToken() // Generate refresh token

        // Save refresh token to database
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}

// User registration controller
const registerUser = asyncHandler( async (req, res) => {
    // Steps for user registration:
    // 1. Get user details from frontend
    // 2. Validate fields
    // 3. Check if user already exists
    // 4. Handle avatar and cover image upload
    // 5. Create user in database
    // 6. Return response

    const {fullName, email, username, password } = req.body

    // Check if any required field is empty
    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    // Check if user already exists with same username or email
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }

    // Handle file uploads
    const avatarLocalPath = req.files?.avatar[0]?.path;
    let coverImageLocalPath;
    
    // Check if cover image exists in request
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }
    
    // Avatar is required
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    // Upload files to Cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }
   
    // Create user in database
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "", // Use empty string if no cover image
        email, 
        password,
        username: username.toLowerCase()
    })

    // Get created user without sensitive fields
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    // Return success response
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )
})

// User login controller
const loginUser = asyncHandler(async (req, res) =>{
    // Steps for user login:
    // 1. Get credentials from request body
    // 2. Check username or email exists
    // 3. Find user in database
    // 4. Validate password
    // 5. Generate tokens
    // 6. Set cookies and return response

    const {email, username, password} = req.body

    // Either username or email is required
    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }
    
    // Find user by username or email
    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

    // Check if password is correct
    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials")
    }

    // Generate tokens
    const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)

    // Get logged in user without sensitive fields
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    // Cookie options
    const options = {
        httpOnly: true, // Cookie not accessible via JavaScript
        secure: true // Only sent over HTTPS
    }

    // Set cookies and return response
    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )
})

// User logout controller
const logoutUser = asyncHandler(async(req, res) => {
    // Steps for logout:
    // 1. Remove refresh token from database
    // 2. Clear cookies
    // 3. Return success response

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // Remove refreshToken field
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    // Clear cookies and return response
    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})

// Refresh access token controller
const refreshAccessToken = asyncHandler(async (req, res) => {
    // Steps for refreshing token:
    // 1. Get refresh token from cookies or body
    // 2. Verify token
    // 3. Check if user exists
    // 4. Validate token against stored token
    // 5. Generate new tokens
    // 6. Set cookies and return response

    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }

    try {
        // Verify refresh token
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
    
        // Check if token matches stored token
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        // Generate new tokens
        const {accessToken, newRefreshToken} = await generateAccessAndRefereshTokens(user._id)
    
        // Set new cookies and return response
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200, 
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
})

// Change password controller
const changeCurrentPassword = asyncHandler(async(req, res) => {
    // Steps to change password:
    // 1. Get old and new passwords from request
    // 2. Verify old password
    // 3. Update to new password
    // 4. Return success response

    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password")
    }

    // Update password
    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))
})

// Get current user controller
const getCurrentUser = asyncHandler(async(req, res) => {
    // Simply return the user from request (added by auth middleware)
    return res
    .status(200)
    .json(new ApiResponse(
        200,
        req.user,
        "User fetched successfully"
    ))
})

// Update account details controller
const updateAccountDetails = asyncHandler(async(req, res) => {
    // Steps to update account:
    // 1. Get new details from request
    // 2. Validate fields
    // 3. Update user in database
    // 4. Return updated user

    const {fullName, email} = req.body

    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email: email
            }
        },
        {new: true} // Return updated document
        
    ).select("-password") // Exclude password

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
});

// Update user avatar controller
const updateUserAvatar = asyncHandler(async(req, res) => {
    // Steps to update avatar:
    // 1. Get file path from request
    // 2. Upload to Cloudinary
    // 3. Update user in database
    // 4. Return success response

    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar")
    }

    const oldAvatarUrl = req.user?.avatar;

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")

    // TODO: Delete old avatar from Cloudinary (implementation needed)
    await deletefromCloudinary(oldAvatarUrl)

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Avatar image updated successfully")
    )
})

// Update user cover image controller
const updateUserCoverImage = asyncHandler(async(req, res) => {
    // Similar to avatar update but for cover image
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Cover image updated successfully")
    )
})

// Get user channel profile controller
const getUserChannelProfile = asyncHandler(async(req, res) => {
    // Steps to get channel profile:
    // 1. Get username from params
    // 2. Use aggregation pipeline to:
    //    - Match user
    //    - Lookup subscribers
    //    - Lookup channels subscribed to
    //    - Add computed fields
    //    - Project needed fields
    // 3. Return channel data

    const {username} = req.params

    if (!username?.trim()) {
        throw new ApiError(400, "username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(404, "channel does not exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
})

// Get watch history controller
const getWatchHistory = asyncHandler(async(req, res) => {
    // Steps to get watch history:
    // 1. Use aggregation pipeline to:
    //    - Match current user
    //    - Lookup videos from watchHistory
    //    - For each video, lookup owner details
    //    - Structure the response
    // 2. Return watch history

    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )
})

// Export all controller methods
export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}
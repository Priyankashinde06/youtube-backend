import mongoose, { isValidObjectId } from "mongoose"
import { Tweet } from "../models/tweet.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

// Controller function to create a new tweet
const createTweet = asyncHandler(async (req, res) => {
  // Get the tweet content from request body
  const { content } = req.body

  // Check if content is empty
  if (content === "") {
    throw new ApiError(400, "Tweet content required..")
  }

  // Create new tweet in database with content and owner ID (from authenticated user)
  const createdTweet = await Tweet.create({
    content,
    tweetOwner: req.user?._id,
  })

  // Check if tweet creation failed
  if (!createTweet) {
    throw new ApiError(500, "Something went wrong while creating tweet..")
  }

  // Return success response with the created tweet
  return res
    .status(200)
    .json(new ApiResponse(200, createdTweet, "Tweet Posted Succesfully.."))
})

// Controller function to get all tweets of the authenticated user
const getUserTweets = asyncHandler(async (req, res) => {
  // Using aggregation pipeline to fetch and format user tweets
  const tweets = await Tweet.aggregate([
    // Stage 1: Match tweets belonging to the current user
    {
      $match: {
        tweetOwner: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    // Stage 2: Join with users collection to get owner details
    {
      $lookup: {
        from: "users",
        localField: "tweetOwner",
        foreignField: "_id",
        as: "tweetOwner",
        pipeline: [
          {
            $project: {
              fullName: 1,
              username: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    // Stage 3: Join with likes collection to get like details
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "tweet",
        as: "likeDetails",
        pipeline: [
          {
            $project: {
              likedBy: 1,
            },
          },
        ],
      },
    },
    // Stage 4: Add computed fields
    {
      $addFields: {
        tweetOwner: { $first: "$tweetOwner" }, // Unwind the owner array
        likeCount: { $size: "$likeDetails" }, // Count of likes
        isLiked: { // Check if current user has liked the tweet
          $cond: {
            if: { $in: [req.user?._id, "$likeDetails.likedBy"] },
            then: true,
            else: false,
          },
        },
      },
    },
    // Stage 5: Add more fields for easier access
    {
      $addFields: {
        fullName: "$tweetOwner.fullName",
        username: "$tweetOwner.username",
        avatar: "$tweetOwner.avatar",
      },
    },
    // Stage 6: Project only the needed fields in the final output
    {
      $project: {
        _id: 1,
        fullName: 1,
        username: 1,
        avatar: 1,
        content: 1,
        likeCount: 1,
        isLiked: 1,
        createdAt: 1,
      },
    },
  ])

  // Check if tweets fetching failed
  if (!tweets) {
    throw new ApiError(500, "Something went wrong while fetching ")
  }

  // Return success response with user's tweets
  return res.status(200).json(new ApiResponce(200, tweets, "User Tweets"))
})

// Controller function to update a tweet
const updateTweet = asyncHandler(async (req, res) => {
  // Get tweet ID from params and new content from body
  const { tweetId } = req.params
  const { content } = req.body

  // Check if tweet ID is valid
  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet id..")
  }

  // Check if tweet exists
  const tweet = await Tweet.findById(tweetId)

  if (!tweet) {
    throw new ApiError(404, " Tweet not foun..")
  }

  // Check if the tweet belongs to the current user (authorization)
  if (tweet.tweetOwner.toString() !== req.user._id.toString()) {
    throw new ApiError(404, "You are not authorized to update this tweet..")
  }

  // Check if content is provided
  if (!content) {
    throw new ApiError(404, "Tweet content required..")
  }

  // Update tweet content (use trimmed content if provided, otherwise keep existing)
  const updatedContent = content.trim() ? content : tweet?.content
  const updatedTweet = await Tweet.findByIdAndUpdate(
    tweetId,
    {
      $set: {
        content: updatedContent,
      },
    },
    { new: true } // Return the updated document
  )

  // Check if update failed
  if (!updatedTweet) {
    throw new ApiError(500, "Something went wrong while updating tweet..")
  }

  // Return success response with updated tweet
  return res
    .status(200)
    .json(new ApiResponse(200, updateTweet, "Tweet Updated Successfully..."))
})

// Controller function to delete a tweet
const deleteTweet = asyncHandler(async (req, res) => {
  // Get tweet ID from params
  const { tweetId } = req.params

  // Check if tweet ID is valid
  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet id..")
  }

  // Check if tweet exists
  const tweet = await Tweet.findById(tweetId)

  if (!tweet) {
    throw new ApiError(404, "Tweet not found..")
  }

  // Check if the tweet belongs to the current user (authorization)
  if (tweet.tweetOwner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to delete this tweet..")
  }

  // Delete the tweet
  const deletedTweet = await Tweet.findByIdAndDelete(tweetId)

  // Check if deletion failed
  if (!deletedTweet) {
    throw new ApiError(500, "Something went wrong while deleting tweet..")
  }

  // Return success response
  return res
    .status(200)
    .json(new ApiResponse(200, deletedTweet, "Tweet deleted successfully.."))
})

export { createTweet, getUserTweets, updateTweet, deleteTweet }
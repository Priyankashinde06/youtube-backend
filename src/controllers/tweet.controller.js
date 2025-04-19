import mongoose, { isValidObjectId } from "mongoose"
import { Tweet } from "../models/tweet.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
  //TODO: create tweet

  const { content } = req.body

  // check content is empty
  if (content === "") {
    throw new ApiError(400, "Tweet content required..")
  }

  // creating new tweet in database with content and owner id
  const createdTweet = await Tweet.create({
    content,
    tweetOwner: req.user?._id,
  })

  // Check if tweet creation failed
  if (!createTweet) {
    throw new ApiError(500, "Something went wrong while creating tweet..")
  }

  return res
    .status(200)
    .json(new ApiResponse(200, createdTweet, "Tweet Posted Succesfully.."))
})

const getUserTweets = asyncHandler(async (req, res) => {
  // TODO: get user tweets

  const tweets = await Tweet.aggregate([
    {
      $match: {
        tweetOwner: new mongoose.Types.ObjectId(req.user._id),
      },
    },
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
    {
      $addFields: {
        tweetOwner: { $first: "$tweetOwner" },
        likeCount: { $size: "$likeDetails" },
        isLiked: {
          $cond: {
            if: { $in: [req.user?._id, "$likeDetails.likedBy"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $addFields: {
        fullName: "$tweetOwner.fullName",
        username: "$tweetOwner.username",
        avatar: "$tweetOwner.avatar",
      },
    },
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

  if (!tweets) {
    throw new ApiError(500, "Something went wrong while fetching ")
  }

  return res.status(200).json(new ApiResponce(200, tweets, "User Tweets"))
})

const updateTweet = asyncHandler(async (req, res) => {
  //TODO: update tweet

  const { tweetId } = req.params
  const { content } = req.body

  // check if tweetId is valid
  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet id..")
  }

  // check if tweet exists
  const tweet = await Tweet.findById(tweetId)

  if (!tweet) {
    throw new ApiError(404, " Tweet not foun..")
  }

  // check if tweet belongs to user

  if (tweet.tweetOwner.toString() !== req.user._id.toString()) {
    throw new ApiError(404, "You are not authorized to update this tweet..")
  }

  // check content is empty
  if (!content) {
    throw new ApiError(404, "Tweet content required..")
  }
  // update tweet
  const updatedContent = content.trim() ? content : tweet?.content
  const updatedTweet = await Tweet.findByIdAndUpdate(
    tweetId,
    {
      $set: {
        content: updatedContent,
      },
    },
    { new: true }
  )

  if (!updatedTweet) {
    throw new ApiError(500, "Something went wrong while updating tweet..")
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updateTweet, "Tweet Updated Successfully..."))
})

const deleteTweet = asyncHandler(async (req, res) => {
  //TODO: delete tweet
  const { tweetId } = req.params

  // check if tweetId is valid
  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet id..")
  }

  // check if tweet exists
  const tweet = await Tweet.findById(tweetId)

  if (!tweet) {
    throw new ApiError(404, "Tweet not found..")
  }

  // check if tweet belongs to user
  if (tweet.tweetOwner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to delete this tweet..")
  }

  // delete tweet
  const deletedTweet = await Tweet.findByIdAndDelete(tweetId)

  if (!deletedTweet) {
    throw new ApiError(500, "Something went wrong while deleting tweet..")
  }
  return res
    .status(200)
    .json(new ApiResponse(200, deletedTweet, "Tweet deleted successfully.."))
})

export { createTweet, getUserTweets, updateTweet, deleteTweet }

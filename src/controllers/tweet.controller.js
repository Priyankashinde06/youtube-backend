import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";


const createTweet = asyncHandler(async (req, res) => {
    //to create new tweet

    const { content } = req.body;

    if (content === '') {
        throw new ApiError(400, 'Tweet Content Required!!!')
    }

    const createdTweet = await Tweet.create({
        content,
        owner: req.user?._id
    });

    if (!createdTweet) {
        throw new ApiError(500, 'Something wend wrong while posting tweet!!!')
    }

    return res
        .status(200)
        .json(new ApiResponse(200, createdTweet, 'Tweet Posted...'));

});

const getUserTweets = asyncHandler(async (req, res) => {
    const tweets = await Tweet.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup: {
                from: 'users',
                localField: 'owner',
                foreignField: '_id',
                as: 'tweetOwner',
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
            $lookup:{
                from:'likes',
                localField:'_id',
                foreignField:'tweet',
                as:'likeDetails',
                pipeline:[
                    {
                        $project:{
                            likeBy:1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                tweetOwner: { $first: "$tweetOwner" },
                likeCount:{
                    $size:'$likeDetails',
                },
                isLiked:{
                    $cond:{
                        if:{
                            $in:[req.user?._id,"$likeDetails.likeBy"]
                        },
                        then:true,
                        else:false
                    }
                }
            }

        },
        {
            $addFields: {
                fullName: "$tweetOwner.fullName",
                username: "$tweetOwner.username",
                avatar: "$tweetOwner.avatar"
            }
        },
        {
            $project: {
                _id: 1,
                fullName: 1,
                username: 1,
                content: 1,
                avatar: 1,
                likeCount:1,
                isLiked:1,
                createdAt: 1

            }
        }
    ]);
    if (!tweets) {
        throw new ApiError(500, 'Something went wrong while fetching ')
    }

    return res
        .status(200)
        .json(new ApiResponse(200, tweets, 'User Tweets'))
});

const deleteTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;
    if (!tweetId?.trim()) {
        throw new ApiError(400, 'Tweet Id Missing')
    }

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, 'Invalid Tweet Selected!!!')
    }

    const tweet = await Tweet.findById(tweetId);
    // console.log(tweet)
    if (!tweet) {
        throw new ApiError(404, 'Tweet Not Found');
    }

    if (tweet?.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError('401', 'Unauthorized Access!!!')
    }


    const deletedTweet = await Tweet.findByIdAndDelete(tweetId)
    if (!deletedTweet) {
        throw new ApiError(500, 'Somthing went wrong while deleting Tweet!!!')
    }
    return res
        .status(200)
        .json(new ApiResponse(200, deletedTweet, 'Tweet Deleted Successfully...'));
});

const updateTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;
    // console.log(tweetId)
    const { content } = req.body;
    if (!tweetId.trim()) {
        throw new ApiError(400, 'Tweet Id Missing!!!');
    }
    if (!isValidObjectId(tweetId)) {
        throw new ApiError(401, 'Invalid Tweet ID');
    }

    const tweet = await Tweet.findById(tweetId);
    // console.log(tweet)
    if (!tweet) {
        throw new ApiError(404, 'Tweet not Found');
    }

    if (tweet?.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(401, 'Unauthorized Access!!!');
    }
    const updatedContent = content.trim() ? content : tweet?.content;
    const updatedTweet = await Tweet.findByIdAndUpdate(tweetId, {
        $set: {
            content: updatedContent,
        },
    },
        {
            new: true,
        },
    )

    if (!updateTweet) {
        throw new ApiError(500, 'Something went wrong while updating Tweet')
    }
    return res
        .status(201)
        .json(new ApiResponse(200, updatedTweet, 'Tweet Updated Successfully...'))
});



export {
    createTweet,
    getUserTweets,
    deleteTweet,
    updateTweet
}

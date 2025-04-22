import mongoose, {isValidObjectId} from "mongoose"
import { Subscription } from "../models/subscription.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    // TODO: toggle subscription
    if (!isValidObjectId) {
        throw new ApiError(400, "Invalid Channel id..")
    }
    
    const alreadySubscribed = await Subscription.findOne({
        subscriber: req.user?._id,
        channel: channelId
    })

    if (alreadySubscribed) {
        await  Subscription.findByIdAndDelete(alreadySubscribed._id)

        return res
        .status(200)
        .json(new ApiResponse(200, "Unscribed from channerl"))
    }

    const newSubscriber = await Subscription.create({
        subscriber: req.user._id,
        channel: channelId
    })

    if (!newSubscriber) {
        throw new ApiError(500, "Unable to subscribe to channel")
    }

    return res
    .status(200)
    .json(new ApiResponse(200, newSubscriber, "Successfully subscribed to channel"))

})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const {channelId} = req.params

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid Channel id..")
    } 

    const subscribers = await Subscription.aggregate([
        {
            $match: {
                channel: new mongoose.Types.ObjectId(channelId) // Match channel, not subscriber
            }
        },
        {
            $lookup: {
                from: "users", // Collection name is case sensitive
                localField: "subscriber",
                foreignField: "_id",
                as: "subscriberInfo",
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
            $addFields: {
                subscriberInfo: { $first: "$subscriberInfo" }
            }
        }
    ]);
    if (!subscribers) {
        throw new ApiError(500, 'Something went wrong while fetching.')
    }

    return res
    .status(200)
    .json(new ApiResponse(200, subscribers, "Successfully fatched subscriber"))
})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const channelId = req.user?._id

    const channelList = await Subscription.aggregate([
        {
            $match: {
                subscriber : new mongoose.Types.ObjectId(channelId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "subscriber",
                foreignField: "_id",
                as: "subscriberInfo",
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
            $addFields: {
                subscriberInfo : {$first: "$subscriberInfo"}
            }
        }
    ])

    if (!channelList) {
        throw new ApiError(500, 'Something went wrong while fetching.')
    }

    return res
    .status(200)
    .json(new ApiResponse(200, channelList, "Successfully fatched channel list"))

})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}
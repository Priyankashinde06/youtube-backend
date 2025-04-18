const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
         // Ensures the requestHandler resolves, and catches any errors, passing them to next()
        Promise.resolve(requestHandler(req,res,next)).catch((err) => next(err))
    }
}


export { asyncHandler } 










// const asyncHandler = () => {}
// const asyncHandler = (fnnc) => () => {}
// const asyncHandler = (fnnc) => async () => {}

// const asyncHandler = (fn) => async (res, req, next) => {
//     try {
//         await fn(req, res, next)
//     } catch (error) {
//         res.status(error.code || 500).json({
//             success: false,
//             message: error.message
//         })
//     }
// }
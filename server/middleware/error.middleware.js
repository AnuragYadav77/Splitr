import { ApiError } from "../utils/ApiError";
export const errorHandler = (err,req,res,next)=>{
    //if error is an instance of our custom ApiError
    if(err instanceof ApiError){
        return res
        .status(err.statusCode).json({
            success:false,
            message:err.message,
            errors:err.errors,
            data:null
        });
    }

    //If error is an unexpected server error
    console.error(err);

    return res.status(500)
    .json({
        success:false,
        message:"Internal server error",
        errors:[],
        data:null
    });
}
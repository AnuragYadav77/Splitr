import mongoose,{Schema} from "mongoose";

const transferSchema = new Schema({
    user:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true,
    },
    fromSection:{
        type:Schema.Types.ObjectId,
        ref:"Section",
        required:true,
    },
    toSection:{
        type:Schema.Types.ObjectId,
        ref:"Section",
        required:true,
    },
    amount:{
        type:Number,
        required:true,
        min:[0.1,"Transfer amount must be greater than zero"]
    },
    reason:{
        type:String,
        default:"",
    }
},{timestamps:true})

export const Transfer = mongoose.model("Transfer",transferSchema) 
import mongoose,{Schema} from "mongoose";

const billSchema = new Schema({
    user:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true,
    },
    name:{
        type:String,
        required:true,
        trim:true
    },
    amount:{
        type:Number,
        required:true,
    },
    dueDay:{
        type:String,
        required:true
    },
    isPaid:{
        type:Boolean,
        default:false
    }
},{timestamps:true})

export const Bill = mongoose.model("Bill",billSchema);
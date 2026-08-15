import mongoose,{Schema} from "mongoose";

const budgetSchema = new Schema({
    user:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true,
    },
    month: {
    type: String,
    required: true,
    match: [/^\d{4}-(0[1-9]|1[0-2])$/, "Month must be in YYYY-MM format"]
    },
    year:{
        type:Number,
        required:true,
    },
    totalIncome:{
        type:Number,
        required:true,
        default:0,
    },
    totalAllocated:{
        type:Number,
        required:true,
        default:0,
    },
    totalSaved:{
        type:Number,
        default:0,
    }
},{timestamps:true})


export const Budget = mongoose.model("Budget",budgetSchema);
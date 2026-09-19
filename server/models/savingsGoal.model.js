import mongoose,{Schema} from "mongoose";

const savingsGoalSchema = new Schema({
    user:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true,
    },
    name:{//New Laptop, Vacation, Emergency Fund
        type:String,
        trim:true,
        default:""
    },
    targetAmount:{
        type:Number,
        required:true,
        min:[0.1,"Amount should be greater than 0"]
    },
    currentAmount:{
        type:Number,
        default:0,
        min:0,
    },
    deadline:{
        //optional target date for achieving the goal.
        type:Date,
        default:null
    },
    isCompleted:{
        type:Boolean,
        default:false,
    }
},{timestamps:true})

export const SavingsGoal = mongoose.model("SavingsGoal",savingsGoalSchema); 
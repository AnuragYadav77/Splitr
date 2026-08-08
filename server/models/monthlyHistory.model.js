import mongoose,{Schema} from "mongoose";

const historySchema = new Schema({

   user:{
    type:Schema.Types.ObjectId,
    ref:"User",
    required:true,
   },
   month:{
    type:String,
    required:true,
   },
   totalBudgeted:{
    type:Number,
    required:true,
   },
   totalSpent:{
    type:Number,
    required:true,
   },
   totalSaved:{
    type:Number,
    default:0
   },
   emergencyOverrides:{
    type:Number,
    default:0
   }



},{timestamps:true})

export const History = mongoose.model("History",historySchema);
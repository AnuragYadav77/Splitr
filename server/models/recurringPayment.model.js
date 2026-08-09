import mongoose,{Schema} from "mongoose";

const recurringPaymentSchema = new Schema({
    user:{//reference to the user who receives it 
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true,
    },
    name:{//Netflix, gym,rent.
        type:String,
        required:true,
        trim:true,
    },
    amount:{ 
        type:Number,
        required:true,
        min: [0.01, "Amount must be greater than 0"],
    },
    frequency:{
        type:String,
        enum:["weekly", "monthly", "quarterly", "yearly"],
        required:true,
    },
    nextDueDate:{
        type:Date,
        required:true,
    },
    section:{
        //reference to the relevant section,
        type:Schema.Types.ObjectId,
        ref:"Section",
        default:null,
    },
    category:{ //reference to the Category describing what the payment is for
        type:Schema.Types.ObjectId,
        ref:"Category",
    },
    isActive:{ //allows the user to pause/cancel a recurring payment without deleting its history
        type:Boolean,
        default:true,
    }

},{timestamps:true})

export const RecurringPayment = mongoose.model("RecurringPayment",recurringPaymentSchema);
import mongoose,{Schema} from "mongoose";

const transactionSchema = new Schema({
    user:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true
    },

    amount:{
        type:Number,
        required:true,
    },
    //which section did this transacrion come from??
    section:{
        type:Schema.Types.ObjectId,
        ref:"Section",
        required:true,
    },

    //where was the money spent
    merchant:{
        type:String,
        required:true,
        trim:true
    },
    //type of transaction? -> payment, refund?
    direction: {
    type: String,
    required: true,
    enum: ["debit", "credit"]
    },

    // to exceed a Section budget through an emergency override
    isOverride:{
        type:Boolean,
        default:false,
    }

},{timestamps:true})

export const Transaction = mongoose.model("Transaction",transactionSchema);
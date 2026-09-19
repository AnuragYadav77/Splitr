import mongoose,{Schema} from "mongoose";

const notificationSchema = new Schema({
    user:{//reference to the user who receives it 
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true,
    },
    type:{//identifies what triggered it
        type:String,
        required:true,
    },
    title:{ //short heading
        type:String,
        required:true,
        trim:true
    },
    message:{ //detailed text
        type:String,
        required:true,
        trim:true,
    },
    section:{
        //reference to the relevant section,
        type:Schema.Types.ObjectId,
        ref:"Section",
        default:null,
    },
    isRead:{
        type:Boolean,
        default:false,
    }

},{timestamps:true})

export const Notification = mongoose.model("Notification",notificationSchema);
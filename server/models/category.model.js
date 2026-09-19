import mongoose,{Schema} from "mongoose";

const categorySchema = new Schema({
    user:{ //each user's custom catgeory belongs to them 
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true,
    },
    name:{
        type:String,
        required:true,
        trim:true
    },
    emoji:{
        type:String,
        default:""
    },
    description:{
        type:String,
        
    },
    isDefault:{
        type:Boolean,

        default:false,
    }
},{timestamps:true})

export const Category = mongoose.model("Category",categorySchema)
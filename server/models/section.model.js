import mongoose,{Schema} from "mongoose";
 

const sectionSchema = new Schema({
    user:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true,
    },
    name:{
        type:String,
        required:true,

    },
    monthlyBudget:{
        type:Number,
        required:true,
    },
    emoji:{
        type:String,
        default:""
    },
    spent:{
        type:Number,
        default:0,
    },
    isFixed:{
        type:Boolean,
        default:false
    }
    
},{timestamps:true})

export const Section = mongoose.model("Section",sectionSchema);

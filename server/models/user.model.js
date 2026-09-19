import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"

const userSchema = new Schema({
    fullName:{
        type:String,
        required:true,
        trim:true,
        index:true
    },
    email:{
        type:String,
        required:true,
        lowercase:true,
        unique:true,
        trim:true
    },
    phoneNumber:{
        type:String,
    },
    password:{
        type:String,
        required:[true,'Password is required'],
        minlength:8
    },
    monthlyIncome:{
        type:Number,
        required:true,
        default:0
    },
    refreshToken:{
        type:String
    },
    savings:{
        balance:{
            type:Number,
            default:0,
        },
        goal:{
            name:{
                type:String,
                default:""
            },
            targetAmount:{
                type:Number,
                default:0
            }
        }
    }

},{timestamps:true})

//middleware

userSchema.pre("save",async function() {
    //only hash password if it is modified
    if(!this.isModified("password")) return;

    this.password = await bcrypt.hash(this.password,10);
    
})

userSchema.methods.isPasswordCorrect = 
async function (password) {
    return await bcrypt.compare(password,this.password);

}

userSchema.methods.generateAccessToken = function(){
    return jwt.sign({
        _id:this._id,
        email:this.email,
        username:this.username,
        fullName:this.fullName
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
        expiresIn:process.env.ACCESS_TOKEN_EXPIRY
    }
)}

userSchema.methods.generateRefreshToken=function(){
    return jwt.sign({
        _id:this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
        expiresIn:process.env.
        REFRESH_TOKEN_EXPIRY
    }
)

}

export const User = mongoose.model("User",userSchema);
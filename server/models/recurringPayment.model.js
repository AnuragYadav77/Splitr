import mongoose, { Schema } from "mongoose";

const recurringPaymentSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    name: {
        type: String,
        required: true,
        trim: true
    },

    amount: {
        type: Number,
        required: true
    },

    frequency: {
        type: String,
        enum: ["weekly", "monthly", "quarterly", "yearly"],
        required: true
    },

    nextDueDate: {
        type: Date,
        required: true
    },

    section: {
        type: Schema.Types.ObjectId,
        ref: "Section",
        default: null
    },

    category: {
        type: Schema.Types.ObjectId,
        ref: "Category",
        default: null
    },

    isActive: {
        type: Boolean,
        default: true
    }

}, { timestamps: true });

export const RecurringPayment = mongoose.model(
    "RecurringPayment",
    recurringPaymentSchema
);
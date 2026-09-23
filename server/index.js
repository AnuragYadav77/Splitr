import dotenv from "dotenv/config";
import mongoose from "mongoose";
import { app } from "./app.js";



const PORT = process.env.PORT || 3000;

// Connect to MongoDB and start listening for requests
mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("✅ MongoDB connected successfully");
        app.listen(PORT, () => {
            console.log(`✅ Splitr server running at http://localhost:${PORT}`);
            console.log(`   Open http://localhost:${PORT} in your browser`);
        });
    })
    .catch((err) => {
        console.error("❌ MongoDB connection error:", err.message);
        process.exit(1);
    });
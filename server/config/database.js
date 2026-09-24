import mongoose from "mongoose";

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ MongoDB connected successfully");

        // Drop stale legacy indexes that may exist from old schemas
        // This prevents duplicate-key errors on fields that are no longer in the model
        try {
            const db = mongoose.connection.db;
            const usersCollection = db.collection("users");
            const indexes = await usersCollection.indexes();
            const staleIndexNames = ["username_1"];
            for (const indexName of staleIndexNames) {
                const exists = indexes.some(idx => idx.name === indexName);
                if (exists) {
                    await usersCollection.dropIndex(indexName);
                    console.log(`🧹 Dropped stale index: ${indexName}`);
                }
            }
        } catch {
            // Non-critical — index cleanup failure should not crash the server
        }
    } catch (error) {
        console.error("❌ MongoDB connection error:", error.message);
        process.exit(1);
    }
};

export { connectDB };
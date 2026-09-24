import "dotenv/config";
import { app } from "./app.js";
import { connectDB } from "./config/database.js";

const PORT = process.env.PORT || 3000;

connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`✅ Splitr server running at http://localhost:${PORT}`);
            console.log(`   Open http://localhost:${PORT} in your browser`);
        });
    })
    .catch((error) => {
        console.error("❌ Server startup error:", error.message);
        process.exit(1);
    });
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

// Route imports
import userRouter from "./routes/user.routes.js";
import sectionRouter from "./routes/section.routes.js";
import categoryRouter from "./routes/category.routes.js";
import budgetRouter from "./routes/budget.routes.js";
import transactionRouter from "./routes/transaction.routes.js";
import transferRouter from "./routes/transfer.routes.js";
import billRouter from "./routes/bill.routes.js";
import recurringPaymentRouter from "./routes/recurringPayment.routes.js";
import savingsGoalRouter from "./routes/savingsGoal.routes.js";
import historyRouter from "./routes/history.routes.js";
import notificationRouter from "./routes/notification.routes.js";

// Middleware imports
import { errorHandler } from "./middleware/error.middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Core middleware
app.use(
    cors({
        origin: process.env.CORS_ORIGIN || "*",
        credentials: true
    })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());

// Serve static frontend files
app.use(express.static(path.join(__dirname, "..", "public")));

// Root route
app.get("/", (req, res) => {
    res.redirect("/pages/onboarding.html");
});

// API Routes
app.use("/api/v1/users", userRouter);
app.use("/api/v1/sections", sectionRouter);
app.use("/api/v1/categories", categoryRouter);
app.use("/api/v1/budgets", budgetRouter);
app.use("/api/v1/transactions", transactionRouter);
app.use("/api/v1/transfers", transferRouter);
app.use("/api/v1/bills", billRouter);
app.use("/api/v1/recurring-payments", recurringPaymentRouter);
app.use("/api/v1/savings-goals", savingsGoalRouter);
app.use("/api/v1/history", historyRouter);
app.use("/api/v1/notifications", notificationRouter);

// Global error handler — must be last
app.use(errorHandler);

export { app };
export default app;
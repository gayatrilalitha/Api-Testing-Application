
import express from "express";
import cors from "cors";

import apiRoutes from "./routes/apiRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import historyRoutes from "./routes/historyRoutes.js";
import performanceRoutes from "./routes/performanceRoutes.js";
import variablesRoutes from "./routes/variablesRoutes.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use("/api", apiRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/performance", performanceRoutes);
app.use("/api/variables", variablesRoutes);

// Health-check route
app.get("/", (req, res) => {
    res.status(200).json({
        message: "API Testing Application backend is running"
    });
});

// Handle unknown routes
app.use((req, res) => {
    res.status(404).json({
        message: "Route not found"
    });
});

// Global error-handling middleware
app.use((err, req, res, next) => {
    console.error("Server error:", err);

    res.status(err.status || 500).json({
        message: err.status && err.status < 500
            ? err.message
            : "Internal server error"
    });
});

export default app;

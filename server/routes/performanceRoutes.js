
import express from "express";

import {
    getPerformance,
    savePerformance,
    clearPerformance
} from "../controllers/performanceController.js";

import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Get the logged-in user's performance statistics
router.get("/", authMiddleware, getPerformance);

// Save performance data for the logged-in user
router.post("/", authMiddleware, savePerformance);

// Clear the logged-in user's performance records
router.delete("/", authMiddleware, clearPerformance);

export default router;

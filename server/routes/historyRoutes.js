import express from "express";
import {
    getHistory,
    saveHistory,
    clearHistory
} from "../controllers/historyController.js";

import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, getHistory);
router.post("/", authMiddleware, saveHistory);
router.delete("/", authMiddleware, clearHistory);

export default router;

import express from "express";
import { testApi } from "../controllers/apiController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/test", authMiddleware, testApi);

export default router;

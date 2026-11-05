
import express from "express";

import {
    signup,
    login,
    changeUsername,
    changePassword
} from "../controllers/authController.js";

import { validateRequest } from "../middlewares/validateRequest.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post(
    "/signup",
    validateRequest(["username", "email", "password"]),
    signup
);

router.post(
    "/login",
    validateRequest(["email", "password"]),
    login
);

// Protected routes
router.put("/username", authMiddleware, changeUsername);
router.put("/password", authMiddleware, changePassword);

export default router;

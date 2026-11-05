
import express from "express";

import {
    getVariables,
    saveVariable,
    deleteVariable
} from "../controllers/variablesController.js";

import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Get all variables belonging to the logged-in user
router.get("/", authMiddleware, getVariables);

// Save a variable for the logged-in user
router.post("/", authMiddleware, saveVariable);

// Delete a variable belonging to the logged-in user
router.delete("/:id", authMiddleware, deleteVariable);

export default router;

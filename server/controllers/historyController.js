
import { pool } from "../config/db.js";

// Get the user's request history
export const getHistory = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const [history] = await pool.execute(
            `SELECT id, method, url, status, response_time AS responsetime, created_at
             FROM history
             WHERE user_id = ?
             ORDER BY created_at DESC`,
            [userId]
        );

        return res.status(200).json(history);
    } catch (error) {
        next(error);
    }
};

// Save an API request to history
export const saveHistory = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { method, url, status, responseTime } = req.body;

        if (!method || !url) {
            return res.status(400).json({
                message: "Method and URL are required"
            });
        }

        const [result] = await pool.execute(
            `INSERT INTO history
             (user_id, method, url, status, response_time)
             VALUES (?, ?, ?, ?, ?)`,
            [
                userId,
                method,
                url,
                status ?? null,
                responseTime ?? null
            ]
        );

        return res.status(201).json({
            message: "History saved successfully",
            historyId: result.insertId
        });
    } catch (error) {
        next(error);
    }
};

// Clear the user's request history
export const clearHistory = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const [result] = await pool.execute(
            "DELETE FROM history WHERE user_id = ?",
            [userId]
        );

        return res.status(200).json({
            message: "Request history cleared successfully",
            deletedCount: result.affectedRows
        });
    } catch (error) {
        next(error);
    }
};

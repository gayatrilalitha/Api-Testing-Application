
import { pool } from "../config/db.js";

// Get performance statistics
export const getPerformance = async (req, res, next) => {
    try {
        const userId = req.user.id; 

        // Retrieve performance records
        const [records] = await pool.execute(
            `SELECT id, method, url, status, latency, is_success, created_at
             FROM performance_logs
             WHERE user_id = ?
             ORDER BY created_at DESC`,
            [userId]
        );

        // Calculate summary statistics
        const [summaryRows] = await pool.execute(
            `SELECT
                COUNT(*) AS totalRequests,
                COALESCE(SUM(is_success = 1), 0) AS passedRequests,
                COALESCE(SUM(is_success = 0), 0) AS failedRequests,
                COALESCE(ROUND(AVG(latency)), 0) AS averageResponseTime
             FROM performance_logs
             WHERE user_id = ?`,
            [userId]
        );

        return res.status(200).json({
            summary: summaryRows[0],
            records
        });
    } catch (error) {
        next(error);
    }
};

// Save performance data
export const savePerformance = async (req, res, next) => {
    try {

        const userId = req.user.id; 

        const {
            method,
            url,
            status,
            latency
        } = req.body;

         if (
            typeof method !== "string" ||
            !method.trim() ||
            typeof url !== "string" ||
            !url.trim() ||
            status === undefined ||
            status === null ||
            status === "" ||
            !Number.isInteger(Number(status)) ||
            Number(status) < 100 ||
            Number(status) > 599 ||
            latency === undefined ||
            latency === null ||
            latency === "" ||
            !Number.isFinite(Number(latency)) ||
            Number(latency) < 0
        ) {
            return res.status(400).json({
                message: "Valid user ID, method, URL, status, and latency are required"
            });
        }

        // A 2xx status indicates a successful HTTP response
        const isSuccess =
            Number(status) >= 200 && Number(status) < 300;

        const [result] = await pool.execute(
            `INSERT INTO performance_logs
             (user_id, method, url, status, latency, is_success)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                userId,
                method.toUpperCase(),
                url,
                Number(status),
                Number(latency),
                isSuccess ? 1 : 0
            ]
        );

        return res.status(201).json({
            message: "Performance data saved successfully",
            id: result.insertId,
            isSuccess
        });
    } catch (error) {
        next(error);
    }
};

// Clear performance records
export const clearPerformance = async (req, res, next) => {
    try {
       
        const userId = req.user.id; 

        const [result] = await pool.execute(
            "DELETE FROM performance_logs WHERE user_id = ?",
            [userId]
        );

        return res.status(200).json({
            message: "Performance records cleared successfully",
            deletedCount: result.affectedRows
        });
    } catch (error) {
        next(error);
    }
};


import { pool } from "../config/db.js";

// Get all saved variables
export const getVariables = async (req, res, next) => {
    try {
        const  userId = req.user.id;

        const [variables] = await pool.execute(
            `SELECT id, var_key, var_value, created_at
             FROM variables
             WHERE user_id = ?
             ORDER BY created_at DESC`,
            [userId]
        );

        return res.status(200).json(variables);
    } catch (error) {
        next(error);
    }
};

// Create or update a variable
export const saveVariable = async (req, res, next) => {
    try {

        const  userId = req.user.id;
        const { key, value } = req.body;

        if (
            typeof key !== "string" ||
            !key.trim() ||
            value === undefined ||
            value === null
        ) {
            return res.status(400).json({
                message: "User ID, variable key, and value are required"
            });
        }

        const variableKey = key.trim();
        const variableValue = String(value);

        // Insert a new variable or update an existing key for this user
        const [result] = await pool.execute(
            `INSERT INTO variables (user_id, var_key, var_value)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE var_value = VALUES(var_value)`,
            [userId, variableKey, variableValue]
        );

        return res.status(200).json({
            message: "Variable saved successfully",
            id: result.insertId || null,
            key: variableKey,
            value: variableValue
        });
    } catch (error) {
        next(error);
    }
};

// Delete a variable by ID
export const deleteVariable = async (req, res, next) => {
    try {
        const { id } = req.params;
        const  userId  = req.user.id;


        if (!/^\d+$/.test(id) || Number(id) < 1) {
            return res.status(400).json({
                message: "A valid variable ID is required"
            });
        }

        const [result] = await pool.execute(
            "DELETE FROM variables WHERE id = ? AND user_id = ?",
            [Number(id), userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Variable not found"
            });
        }

        return res.status(200).json({
            message: "Variable deleted successfully"
        });
    } catch (error) {
        next(error);
    }
};

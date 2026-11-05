
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";

// User signup
export const signup = async (req, res, next) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({
                message: "Username, email, and password are required"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters"
            });
        }

        const [existingUsers] = await pool.execute(
            "SELECT id FROM users WHERE email = ? OR username = ?",
            [email.trim().toLowerCase(), username.trim()]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                message: "Email or username already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.execute(
            "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
            [
                username.trim(),
                email.trim().toLowerCase(),
                hashedPassword
            ]
        );

        return res.status(201).json({
            message: "Account created successfully"
        });
    } catch (error) {
        next(error);
    }
};

// User login

export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const [users] = await pool.execute(
            "SELECT id, username, email, password FROM users WHERE email = ?",
            [email.trim().toLowerCase()]
        );

        if (users.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const user = users[0];

        const isPasswordValid = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordValid) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        // Generate a JWT token after successful login
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1d"
            }
        );

        return res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });

    } catch (error) {
        next(error);
    }
};


// Change username
export const changeUsername = async (req, res, next) => {
    try {
        const { userId, newUsername } = req.body;

        if (!userId || !newUsername?.trim()) {
            return res.status(400).json({
                message: "User ID and new username are required"
            });
        }

        const username = newUsername.trim();

        const [existingUsers] = await pool.execute(
            "SELECT id FROM users WHERE username = ? AND id <> ?",
            [username, userId]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                message: "Username is already taken"
            });
        }

        const [result] = await pool.execute(
            "UPDATE users SET username = ? WHERE id = ?",
            [username, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        return res.status(200).json({
            message: "Username updated successfully",
            username
        });
    } catch (error) {
        next(error);
    }
};

// Change password
export const changePassword = async (req, res, next) => {
    try {
        const { userId, currentPassword, newPassword } = req.body;

        if (!userId || !currentPassword || !newPassword) {
            return res.status(400).json({
                message: "User ID, current password, and new password are required"
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                message: "New password must be at least 8 characters"
            });
        }

        const [users] = await pool.execute(
            "SELECT password FROM users WHERE id = ?",
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        const isPasswordValid = await bcrypt.compare(
            currentPassword,
            users[0].password
        );

        if (!isPasswordValid) {
            return res.status(401).json({
                message: "Current password is incorrect"
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await pool.execute(
            "UPDATE users SET password = ? WHERE id = ?",
            [hashedPassword, userId]
        );

        return res.status(200).json({
            message: "Password changed successfully"
        });
    } catch (error) {
        next(error);
    }
};

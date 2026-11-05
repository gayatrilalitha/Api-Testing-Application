
import "dotenv/config";
import mysql from "mysql2/promise";

export const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "api_tester",

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test the database connection
export const testConnection = async () => {
    try {
        const connection = await pool.getConnection();

        console.log("MySQL database connected successfully");

        connection.release();
    } catch (error) {
        console.error("MySQL connection failed:", error.message);
        throw error;
    }
};

// Close the connection pool when needed
export const closePool = async () => {
    await pool.end();
};

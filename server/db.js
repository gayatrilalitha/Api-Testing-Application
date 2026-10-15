import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'api_test_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export async function initDb() {
  try {
    const connection = await db.getConnection();

    // Create users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create history table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        method VARCHAR(10) NOT NULL,
        url TEXT NOT NULL,
        status VARCHAR(50) NOT NULL,
        response_time INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Create performance_logs table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS performance_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        method VARCHAR(10) NOT NULL,
        url TEXT NOT NULL,
        status VARCHAR(50) NOT NULL,
        latency INT NOT NULL,
        is_success TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Create variables table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS variables (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        var_key VARCHAR(255) NOT NULL,
        var_value TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY user_var_unique (user_id, var_key),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    connection.release();
    console.log('MySQL database tables initialized successfully.');
  } catch (error) {
    console.error('Error initializing MySQL tables:', error.message);
  }
}

export default db;
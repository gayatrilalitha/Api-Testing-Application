// server/server.js
// Express backend server for API Testing Application with MySQL integration

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { initDb } from './db.js';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Initialize database tables on server startup
initDb();

// ------------------------------------
// API TEST PROXY
// POST /api/test
// ------------------------------------
app.post('/api/test', async (req, res) => {
  try {
    const { method, url, headers, body } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Please provide a valid URL to test.' });
    }

    const options = {
      method: method || 'GET',
      headers: headers || {}
    };

    if (method !== 'GET' && method !== 'HEAD' && body !== undefined && body !== null) {
      options.body = typeof body === 'string' ? body : JSON.stringify(body);
      if (!options.headers['Content-Type'] && !options.headers['content-type']) {
        options.headers['Content-Type'] = 'application/json';
      }
    }

    const startTime = Date.now();
    const apiResponse = await fetch(url, options);
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    const responseHeaders = {};
    apiResponse.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const responseText = await apiResponse.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    res.json({
      status: apiResponse.status,
      statusText: apiResponse.statusText || 'OK',
      responseTime: responseTime,
      headers: responseHeaders,
      data: responseData,
      raw: responseText
    });
  } catch (error) {
    console.error('API test error:', error);
    res.status(500).json({ error: error.message || 'Failed to send request.' });
  }
});

// ------------------------------------
// AUTH: SIGNUP
// POST /api/auth/signup
// ------------------------------------
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const [existingUsers] = await db.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ message: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.execute(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );

    res.status(201).json({
      message: 'Signup successful',
      userId: result.insertId,
      user: {
        id: result.insertId,
        username,
        email
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ------------------------------------
// AUTH: LOGIN
// POST /api/auth/login
// ------------------------------------
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const [users] = await db.execute(
      'SELECT id, username, email, password FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// ------------------------------------
// AUTH: CHANGE USERNAME
// PUT /api/auth/change-username
// ------------------------------------
app.put('/api/auth/change-username', async (req, res) => {
  try {
    const { userId, newUsername } = req.body;
    if (!userId || !newUsername) {
      return res.status(400).json({ message: 'User ID and new username are required' });
    }

    const [existing] = await db.execute(
      'SELECT id FROM users WHERE username = ? AND id != ?',
      [newUsername, userId]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: 'Username is already taken' });
    }

    await db.execute(
      'UPDATE users SET username = ? WHERE id = ?',
      [newUsername, userId]
    );

    res.json({ message: 'Username updated successfully', username: newUsername });
  } catch (error) {
    console.error('Change username error:', error);
    res.status(500).json({ message: 'Server error updating username' });
  }
});

// ------------------------------------
// AUTH: CHANGE PASSWORD
// PUT /api/auth/change-password
// ------------------------------------
app.put('/api/auth/change-password', async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;
    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ message: 'All password fields are required' });
    }

    const [users] = await db.execute('SELECT password FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, users[0].password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const newHashedPassword = await bcrypt.hash(newPassword, 10);
    await db.execute('UPDATE users SET password = ? WHERE id = ?', [newHashedPassword, userId]);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error updating password' });
  }
});

// ------------------------------------
// HISTORY ENDPOINTS
// ------------------------------------

// GET /api/history?userId=...
app.get('/api/history', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ message: 'userId query parameter is required' });
    }

    const [rows] = await db.execute(
      `SELECT id, method, url, status, response_time AS responseTime,
              DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS date
       FROM history
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 50`,
      [userId]
    );

    res.json(rows);
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ message: 'Error retrieving history' });
  }
});

// POST /api/history
app.post('/api/history', async (req, res) => {
  try {
    const { userId, method, url, status, responseTime } = req.body;
    if (!userId || !method || !url) {
      return res.status(400).json({ message: 'Missing required history parameters' });
    }

    const [result] = await db.execute(
      `INSERT INTO history (user_id, method, url, status, response_time)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, method, url, status || '200 OK', responseTime || 0]
    );

    res.status(201).json({ message: 'History recorded', id: result.insertId });
  } catch (error) {
    console.error('Post history error:', error);
    res.status(500).json({ message: 'Error saving history' });
  }
});

// DELETE /api/history?userId=...
app.delete('/api/history', async (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    await db.execute('DELETE FROM history WHERE user_id = ?', [userId]);
    res.json({ message: 'History cleared successfully' });
  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({ message: 'Error clearing history' });
  }
});

// ------------------------------------
// PERFORMANCE ENDPOINTS
// ------------------------------------

// GET /api/performance?userId=...
app.get('/api/performance', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ message: 'userId query parameter is required' });
    }

    const [rows] = await db.execute(
      `SELECT id, method, url, status, latency, is_success,
              DATE_FORMAT(created_at, '%H:%i:%s') AS timestamp
       FROM performance_logs
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 50`,
      [userId]
    );

    let total = rows.length;
    let success = 0;
    let fail = 0;
    let times = [];

    rows.forEach(r => {
      if (r.is_success) success++;
      else fail++;
      times.push(r.latency);
    });

    res.json({
      total,
      success,
      fail,
      times,
      logs: rows
    });
  } catch (error) {
    console.error('Get performance error:', error);
    res.status(500).json({ message: 'Error retrieving performance data' });
  }
});

// POST /api/performance
app.post('/api/performance', async (req, res) => {
  try {
    const { userId, isSuccess, duration, reqMethod, reqUrl, reqStatus } = req.body;
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const isSuccessVal = isSuccess ? 1 : 0;
    const [result] = await db.execute(
      `INSERT INTO performance_logs (user_id, method, url, status, latency, is_success)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, reqMethod || 'GET', reqUrl || '', reqStatus || '200 OK', duration || 0, isSuccessVal]
    );

    res.status(201).json({ message: 'Performance recorded', id: result.insertId });
  } catch (error) {
    console.error('Post performance error:', error);
    res.status(500).json({ message: 'Error saving performance record' });
  }
});

// DELETE /api/performance?userId=...
app.delete('/api/performance', async (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    await db.execute('DELETE FROM performance_logs WHERE user_id = ?', [userId]);
    res.json({ message: 'Performance records cleared' });
  } catch (error) {
    console.error('Clear performance error:', error);
    res.status(500).json({ message: 'Error clearing performance records' });
  }
});

// ------------------------------------
// VARIABLES ENDPOINTS
// ------------------------------------

// GET /api/variables?userId=...
app.get('/api/variables', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ message: 'userId query parameter is required' });
    }

    const [rows] = await db.execute(
      'SELECT var_key, var_value FROM variables WHERE user_id = ?',
      [userId]
    );

    const variablesMap = {};
    if (rows.length === 0) {
      variablesMap['baseUrl'] = 'https://jsonplaceholder.typicode.com';
    } else {
      rows.forEach(r => {
        variablesMap[r.var_key] = r.var_value;
      });
    }

    res.json(variablesMap);
  } catch (error) {
    console.error('Get variables error:', error);
    res.status(500).json({ message: 'Error retrieving variables' });
  }
});

// POST /api/variables
app.post('/api/variables', async (req, res) => {
  try {
    const { userId, key, value } = req.body;
    if (!userId || !key) {
      return res.status(400).json({ message: 'userId and key are required' });
    }

    await db.execute(
      `INSERT INTO variables (user_id, var_key, var_value)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE var_value = VALUES(var_value)`,
      [userId, key, value || '']
    );

    res.json({ message: 'Variable saved successfully' });
  } catch (error) {
    console.error('Save variable error:', error);
    res.status(500).json({ message: 'Error saving variable' });
  }
});

// DELETE /api/variables
app.delete('/api/variables', async (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;
    const key = req.query.key || req.body.key;

    if (!userId || !key) {
      return res.status(400).json({ message: 'userId and key are required' });
    }

    await db.execute(
      'DELETE FROM variables WHERE user_id = ? AND var_key = ?',
      [userId, key]
    );

    res.json({ message: 'Variable deleted successfully' });
  } catch (error) {
    console.error('Delete variable error:', error);
    res.status(500).json({ message: 'Error deleting variable' });
  }
});

export default app;

if (process.argv[1] === __filename) {
  db.getConnection()
    .then((connection) => {
      console.log('MySQL connected successfully');
      connection.release();
      app.listen(PORT, () => {
        console.log(`Server is running at http://localhost:${PORT}`);
      });
    })
    .catch((error) => {
      console.log('MySQL connection failed:', error.message);
    });
}
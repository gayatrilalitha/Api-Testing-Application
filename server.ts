// server.ts
// Entry point that starts Express and integrates Vite in development mode.

import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import app from './server/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

async function startServer() {
  // In development, Vite middleware serves the frontend assets and handles requests
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  // Serve static files from the public folder
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`API Tester Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();

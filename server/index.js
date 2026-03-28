import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { mkdirSync } from 'fs';
import { initDatabase } from './db.js';

import authRoutes from './routes/auth.js';
import serverRoutes from './routes/servers.js';
import messageRoutes from './routes/messages.js';
import userRoutes from './routes/users.js';
import { setupSocket } from './socket.js';

const require = createRequire(import.meta.url);
const multer = require('multer');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function start() {
  // Initialize database first
  await initDatabase();
  console.log('Database ready');

  const app = express();
  const httpServer = createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
  });

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Create uploads dir
  try {
    mkdirSync(path.join(__dirname, '..', 'uploads'), { recursive: true });
  } catch (e) {}

  // Serve uploaded files statically
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

  // Multer setup for file uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, '..', 'uploads'));
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  });

  const upload = multer({ storage });

  // Attach to app.locals
  app.locals.upload = upload;
  app.locals.io = io;

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api', serverRoutes);
  app.use('/api', messageRoutes);
  app.use('/api', userRoutes);

  // Upload endpoint
  app.post('/api/upload', (req, res) => {
    upload.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      res.json({ url: `/uploads/${req.file.filename}` });
    });
  });

  // Setup Socket.io handlers
  setupSocket(io);

  const PORT = process.env.PORT || 3001;
  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

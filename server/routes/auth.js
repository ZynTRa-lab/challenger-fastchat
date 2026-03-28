import express from 'express';
import { createRequire } from 'module';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { getDb } from '../db.js';

const require = createRequire(import.meta.url);
const bcrypt = require('bcryptjs');

const router = express.Router();

const JWT_SECRET = 'discord-clone-secret-key-2024';

// Auth middleware
export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const db = getDb();
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password are required' });
    }

    // Check if username or email already exists
    const existing = db.prepare(
      'SELECT id FROM users WHERE username = ? OR email = ?'
    ).get(username, email);

    if (existing) {
      return res.status(409).json({ error: 'Username or email already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuidv4();

    db.prepare(`
      INSERT INTO users (id, username, email, password)
      VALUES (?, ?, ?, ?)
    `).run(id, username, email, hashedPassword);

    const user = db.prepare(
      'SELECT id, username, email, avatar, status, about, created_at FROM users WHERE id = ?'
    ).get(id);

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    // Auto-join the default "Genel" server
    const defaultServer = db.prepare("SELECT id FROM servers WHERE name = 'Genel'").get();
    if (defaultServer) {
      const already = db.prepare('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?').get(defaultServer.id, id);
      if (!already) {
        db.prepare("INSERT INTO server_members (server_id, user_id, role) VALUES (?, ?, 'member')").run(defaultServer.id, id);
      }
    }

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const db = getDb();
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update status to online
    db.prepare("UPDATE users SET status = 'online' WHERE id = ?").run(user.id);

    const { password: _pw, ...safeUser } = user;
    safeUser.status = 'online';

    const token = jwt.sign({ id: safeUser.id, username: safeUser.username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare(
      'SELECT id, username, email, avatar, status, about, created_at FROM users WHERE id = ?'
    ).get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

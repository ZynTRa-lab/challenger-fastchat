import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { authMiddleware } from './auth.js';

const router = express.Router();

// GET /api/users/search - search user by username
router.get('/users/search', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ error: 'Username query parameter required' });
    }
    const user = db.prepare(
      'SELECT id, username, avatar, status, about FROM users WHERE username = ? AND id != ?'
    ).get(username, req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (err) {
    console.error('Search user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:id - get user profile
router.get('/users/:id', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare(
      'SELECT id, username, email, avatar, status, about, created_at FROM users WHERE id = ?'
    ).get(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/me - update own profile
router.put('/users/me', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const { username, avatar, about, status } = req.body;

    const current = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!current) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if new username is taken by someone else
    if (username && username !== current.username) {
      const taken = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, req.user.id);
      if (taken) {
        return res.status(409).json({ error: 'Username already taken' });
      }
    }

    db.prepare(`
      UPDATE users SET
        username = COALESCE(?, username),
        avatar = COALESCE(?, avatar),
        about = COALESCE(?, about),
        status = COALESCE(?, status)
      WHERE id = ?
    `).run(username || null, avatar || null, about || null, status || null, req.user.id);

    const updated = db.prepare(
      'SELECT id, username, email, avatar, status, about, created_at FROM users WHERE id = ?'
    ).get(req.user.id);

    res.json({ user: updated });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/me/friends - get friends list
router.get('/users/me/friends', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const friends = db.prepare(`
      SELECT u.id, u.username, u.avatar, u.status, u.about, f.status as friend_status, f.created_at
      FROM friends f
      INNER JOIN users u ON (
        CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END = u.id
      )
      WHERE f.user_id = ? OR f.friend_id = ?
    `).all(req.user.id, req.user.id, req.user.id);

    // Annotate direction for pending requests
    const enriched = friends.map((f) => {
      const raw = db.prepare(
        'SELECT user_id FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)'
      ).get(req.user.id, f.id, f.id, req.user.id);

      return {
        ...f,
        incoming: raw?.user_id === f.id && f.friend_status === 'pending',
      };
    });

    res.json({ friends: enriched });
  } catch (err) {
    console.error('Get friends error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/friends/:userId - send friend request
router.post('/users/friends/:userId', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const targetId = req.params.userId;

    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }

    const target = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if a relationship already exists in either direction
    const existing = db.prepare(`
      SELECT * FROM friends
      WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
    `).get(req.user.id, targetId, targetId, req.user.id);

    if (existing) {
      return res.status(409).json({ error: 'Friend request already exists or already friends' });
    }

    db.prepare(`
      INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, 'pending')
    `).run(req.user.id, targetId);

    res.status(201).json({ message: 'Friend request sent' });
  } catch (err) {
    console.error('Send friend request error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/friends/:userId/accept - accept friend request
router.put('/users/friends/:userId/accept', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const requesterId = req.params.userId;

    // The incoming request was sent FROM requesterId TO req.user.id
    const request = db.prepare(
      "SELECT * FROM friends WHERE user_id = ? AND friend_id = ? AND status = 'pending'"
    ).get(requesterId, req.user.id);

    if (!request) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    db.prepare(
      "UPDATE friends SET status = 'accepted' WHERE user_id = ? AND friend_id = ?"
    ).run(requesterId, req.user.id);

    res.json({ message: 'Friend request accepted' });
  } catch (err) {
    console.error('Accept friend request error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/users/friends/:userId - remove friend or decline request
router.delete('/users/friends/:userId', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const otherId = req.params.userId;

    db.prepare(`
      DELETE FROM friends
      WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
    `).run(req.user.id, otherId, otherId, req.user.id);

    res.json({ message: 'Friend removed' });
  } catch (err) {
    console.error('Remove friend error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/me/dms - get DM channel list
router.get('/users/me/dms', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    // Get all DM channels that this user is part of, with the other participant info
    const dmChannels = db.prepare(`
      SELECT dc.id as dm_channel_id, dc.created_at,
             u.id as user_id, u.username, u.avatar, u.status, u.about
      FROM dm_channels dc
      INNER JOIN dm_members dm1 ON dc.id = dm1.dm_channel_id AND dm1.user_id = ?
      INNER JOIN dm_members dm2 ON dc.id = dm2.dm_channel_id AND dm2.user_id != ?
      INNER JOIN users u ON dm2.user_id = u.id
    `).all(req.user.id, req.user.id);

    // Attach last message to each DM
    const enriched = dmChannels.map((dm) => {
      const lastMessage = db.prepare(`
        SELECT m.*, u.username as author_username, u.avatar as author_avatar
        FROM messages m
        INNER JOIN users u ON m.author_id = u.id
        WHERE m.dm_channel_id = ?
        ORDER BY m.created_at DESC LIMIT 1
      `).get(dm.dm_channel_id);

      return { ...dm, lastMessage: lastMessage || null };
    });

    res.json({ dms: enriched });
  } catch (err) {
    console.error('Get DMs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

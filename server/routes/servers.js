import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { authMiddleware } from './auth.js';

const router = express.Router();

// GET /api/servers - list user's servers
router.get('/servers', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const servers = db.prepare(`
      SELECT s.* FROM servers s
      INNER JOIN server_members sm ON s.id = sm.server_id
      WHERE sm.user_id = ?
      ORDER BY s.created_at ASC
    `).all(req.user.id);

    res.json({ servers });
  } catch (err) {
    console.error('Get servers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/servers - create server
router.post('/servers', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const { name, icon } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Server name is required' });
    }

    const serverId = uuidv4();

    db.prepare(`
      INSERT INTO servers (id, name, icon, owner_id) VALUES (?, ?, ?, ?)
    `).run(serverId, name, icon || null, req.user.id);

    // Create a default "genel" channel
    const channelId = uuidv4();
    db.prepare(`
      INSERT INTO channels (id, server_id, name, type, position) VALUES (?, ?, 'genel', 'text', 0)
    `).run(channelId, serverId);

    // Add creator as owner member
    db.prepare(`
      INSERT INTO server_members (server_id, user_id, role) VALUES (?, ?, 'owner')
    `).run(serverId, req.user.id);

    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
    const channels = db.prepare('SELECT * FROM channels WHERE server_id = ? ORDER BY position ASC').all(serverId);

    res.status(201).json({ server, channels });
  } catch (err) {
    console.error('Create server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/servers/:id - get server details with channels and members
router.get('/servers/:id', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    // Check membership
    const membership = db.prepare(
      'SELECT * FROM server_members WHERE server_id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this server' });
    }

    const channels = db.prepare(
      'SELECT * FROM channels WHERE server_id = ? ORDER BY position ASC'
    ).all(req.params.id);

    const members = db.prepare(`
      SELECT u.id, u.username, u.avatar, u.status, u.about, sm.role, sm.nickname, sm.joined_at
      FROM server_members sm
      INNER JOIN users u ON sm.user_id = u.id
      WHERE sm.server_id = ?
    `).all(req.params.id);

    res.json({ server, channels, members });
  } catch (err) {
    console.error('Get server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/servers/:id/join - join server
router.post('/servers/:id/join', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const existing = db.prepare(
      'SELECT * FROM server_members WHERE server_id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (existing) {
      return res.status(409).json({ error: 'Already a member of this server' });
    }

    db.prepare(`
      INSERT INTO server_members (server_id, user_id, role) VALUES (?, ?, 'member')
    `).run(req.params.id, req.user.id);

    const channels = db.prepare(
      'SELECT * FROM channels WHERE server_id = ? ORDER BY position ASC'
    ).all(req.params.id);

    res.json({ server, channels });
  } catch (err) {
    console.error('Join server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/servers/:id/leave - leave server
router.delete('/servers/:id/leave', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    if (server.owner_id === req.user.id) {
      return res.status(400).json({ error: 'Owner cannot leave the server. Transfer ownership or delete the server first.' });
    }

    db.prepare(
      'DELETE FROM server_members WHERE server_id = ? AND user_id = ?'
    ).run(req.params.id, req.user.id);

    res.json({ message: 'Left server successfully' });
  } catch (err) {
    console.error('Leave server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/servers/:id - update server (owner only)
router.put('/servers/:id', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    if (server.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the server owner can update it' });
    }

    const { name, icon } = req.body;
    const newName = name || server.name;
    const newIcon = icon !== undefined ? icon : server.icon;

    db.prepare('UPDATE servers SET name = ?, icon = ? WHERE id = ?').run(newName, newIcon, req.params.id);

    const updated = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
    res.json({ server: updated });
  } catch (err) {
    console.error('Update server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/servers/:id/channels - create channel
router.post('/servers/:id/channels', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const membership = db.prepare(
      "SELECT * FROM server_members WHERE server_id = ? AND user_id = ? AND role IN ('owner', 'admin')"
    ).get(req.params.id, req.user.id);

    if (!membership && server.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { name, type, topic } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Channel name is required' });
    }

    const maxPosition = db.prepare(
      'SELECT MAX(position) as maxPos FROM channels WHERE server_id = ?'
    ).get(req.params.id);

    const position = (maxPosition?.maxPos ?? -1) + 1;
    const channelId = uuidv4();

    db.prepare(`
      INSERT INTO channels (id, server_id, name, type, topic, position)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(channelId, req.params.id, name, type || 'text', topic || null, position);

    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
    res.status(201).json({ channel });
  } catch (err) {
    console.error('Create channel error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/servers/:id/channels/:channelId - update channel
router.put('/servers/:id/channels/:channelId', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    if (server.owner_id !== req.user.id) {
      const membership = db.prepare(
        "SELECT * FROM server_members WHERE server_id = ? AND user_id = ? AND role IN ('owner', 'admin')"
      ).get(req.params.id, req.user.id);
      if (!membership) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    const channel = db.prepare(
      'SELECT * FROM channels WHERE id = ? AND server_id = ?'
    ).get(req.params.channelId, req.params.id);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const { name, topic, position } = req.body;
    db.prepare(`
      UPDATE channels SET
        name = COALESCE(?, name),
        topic = COALESCE(?, topic),
        position = COALESCE(?, position)
      WHERE id = ?
    `).run(name || null, topic || null, position ?? null, req.params.channelId);

    const updated = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.channelId);
    res.json({ channel: updated });
  } catch (err) {
    console.error('Update channel error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/servers/:id/channels/:channelId - delete channel
router.delete('/servers/:id/channels/:channelId', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    if (server.owner_id !== req.user.id) {
      const membership = db.prepare(
        "SELECT * FROM server_members WHERE server_id = ? AND user_id = ? AND role IN ('owner', 'admin')"
      ).get(req.params.id, req.user.id);
      if (!membership) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    const channel = db.prepare(
      'SELECT * FROM channels WHERE id = ? AND server_id = ?'
    ).get(req.params.channelId, req.params.id);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    db.prepare('DELETE FROM channels WHERE id = ?').run(req.params.channelId);
    res.json({ message: 'Channel deleted successfully' });
  } catch (err) {
    console.error('Delete channel error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

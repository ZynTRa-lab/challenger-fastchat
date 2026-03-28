import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { authMiddleware } from './auth.js';

const router = express.Router();

// Helper to get or create DM channel between two users
function getOrCreateDMChannel(userIdA, userIdB) {
  const db = getDb();
  // Find existing DM channel with both users
  const existing = db.prepare(`
    SELECT dm_channel_id FROM dm_members WHERE user_id = ?
    INTERSECT
    SELECT dm_channel_id FROM dm_members WHERE user_id = ?
  `).get(userIdA, userIdB);

  if (existing) {
    return existing.dm_channel_id;
  }

  const dmId = uuidv4();
  db.prepare('INSERT INTO dm_channels (id) VALUES (?)').run(dmId);
  db.prepare('INSERT INTO dm_members (dm_channel_id, user_id) VALUES (?, ?)').run(dmId, userIdA);
  db.prepare('INSERT INTO dm_members (dm_channel_id, user_id) VALUES (?, ?)').run(dmId, userIdB);

  return dmId;
}

// Helper to enrich messages with author info and reactions
function enrichMessages(messages) {
  const db = getDb();
  return messages.map((msg) => {
    const author = db.prepare(
      'SELECT id, username, avatar, status FROM users WHERE id = ?'
    ).get(msg.author_id);

    const reactions = db.prepare(`
      SELECT emoji, COUNT(*) as count, GROUP_CONCAT(user_id) as user_ids
      FROM reactions WHERE message_id = ?
      GROUP BY emoji
    `).all(msg.id);

    const enrichedReactions = reactions.map((r) => ({
      emoji: r.emoji,
      count: r.count,
      userIds: r.user_ids ? r.user_ids.split(',') : [],
    }));

    let attachments = [];
    try {
      attachments = msg.attachments ? JSON.parse(msg.attachments) : [];
    } catch {
      attachments = [];
    }

    return { ...msg, author, reactions: enrichedReactions, attachments };
  });
}

// GET /api/channels/:channelId/messages - get messages with pagination (limit 50)
router.get('/channels/:channelId/messages', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Verify membership
    const membership = db.prepare(
      'SELECT * FROM server_members WHERE server_id = ? AND user_id = ?'
    ).get(channel.server_id, req.user.id);

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this server' });
    }

    const { before, limit = 50 } = req.query;
    const pageLimit = Math.min(parseInt(limit, 10), 50);

    let messages;
    if (before) {
      messages = db.prepare(`
        SELECT * FROM messages
        WHERE channel_id = ? AND created_at < (SELECT created_at FROM messages WHERE id = ?)
        ORDER BY created_at DESC LIMIT ?
      `).all(req.params.channelId, before, pageLimit);
    } else {
      messages = db.prepare(`
        SELECT * FROM messages WHERE channel_id = ?
        ORDER BY created_at DESC LIMIT ?
      `).all(req.params.channelId, pageLimit);
    }

    messages.reverse();
    res.json({ messages: enrichMessages(messages) });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/channels/:channelId/messages - send message
router.post('/channels/:channelId/messages', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Verify membership
    const membership = db.prepare(
      'SELECT * FROM server_members WHERE server_id = ? AND user_id = ?'
    ).get(channel.server_id, req.user.id);

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this server' });
    }

    const { content, attachments } = req.body;

    if (!content && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ error: 'Message content or attachment required' });
    }

    const msgId = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO messages (id, content, author_id, channel_id, attachments, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      msgId,
      content || null,
      req.user.id,
      req.params.channelId,
      attachments ? JSON.stringify(attachments) : null,
      now
    );

    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(msgId);
    const [enriched] = enrichMessages([message]);

    // Emit via socket.io
    const io = req.app.locals.io;
    if (io) {
      io.to(`channel:${req.params.channelId}`).emit('message', enriched);
    }

    res.status(201).json({ message: enriched });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/messages/:id - edit message (author only)
router.put('/messages/:id', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.author_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own messages' });
    }

    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE messages SET content = ?, updated_at = ? WHERE id = ?').run(content, now, req.params.id);

    const updated = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
    const [enriched] = enrichMessages([updated]);

    const io = req.app.locals.io;
    if (io) {
      const room = updated.channel_id
        ? `channel:${updated.channel_id}`
        : `dm:${updated.dm_channel_id}`;
      io.to(room).emit('message-update', enriched);
    }

    res.json({ message: enriched });
  } catch (err) {
    console.error('Edit message error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/messages/:id - delete message (author only)
router.delete('/messages/:id', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.author_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id);

    const io = req.app.locals.io;
    if (io) {
      const room = message.channel_id
        ? `channel:${message.channel_id}`
        : `dm:${message.dm_channel_id}`;
      io.to(room).emit('message-delete', { id: req.params.id });
    }

    res.json({ message: 'Message deleted' });
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/messages/:id/reactions - add reaction
router.post('/messages/:id/reactions', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const { emoji } = req.body;
    if (!emoji) {
      return res.status(400).json({ error: 'Emoji is required' });
    }

    const existing = db.prepare(
      'SELECT * FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?'
    ).get(req.params.id, req.user.id, emoji);

    if (existing) {
      return res.status(409).json({ error: 'Reaction already exists' });
    }

    db.prepare(`
      INSERT INTO reactions (id, message_id, user_id, emoji) VALUES (?, ?, ?, ?)
    `).run(uuidv4(), req.params.id, req.user.id, emoji);

    const updated = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
    const [enriched] = enrichMessages([updated]);

    const io = req.app.locals.io;
    if (io) {
      const room = updated.channel_id
        ? `channel:${updated.channel_id}`
        : `dm:${updated.dm_channel_id}`;
      io.to(room).emit('reaction-add', { messageId: req.params.id, reactions: enriched.reactions });
    }

    res.status(201).json({ reactions: enriched.reactions });
  } catch (err) {
    console.error('Add reaction error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/messages/:id/reactions/:emoji - remove reaction
router.delete('/messages/:id/reactions/:emoji', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const emoji = decodeURIComponent(req.params.emoji);

    db.prepare(
      'DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?'
    ).run(req.params.id, req.user.id, emoji);

    const updated = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
    if (!updated) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const [enriched] = enrichMessages([updated]);

    const io = req.app.locals.io;
    if (io) {
      const room = updated.channel_id
        ? `channel:${updated.channel_id}`
        : `dm:${updated.dm_channel_id}`;
      io.to(room).emit('reaction-remove', { messageId: req.params.id, reactions: enriched.reactions });
    }

    res.json({ reactions: enriched.reactions });
  } catch (err) {
    console.error('Remove reaction error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dm/:userId/messages - get DM messages
router.get('/dm/:userId/messages', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const otherUser = db.prepare('SELECT id, username, avatar, status FROM users WHERE id = ?').get(req.params.userId);
    if (!otherUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const dmChannelId = getOrCreateDMChannel(req.user.id, req.params.userId);

    const { before, limit = 50 } = req.query;
    const pageLimit = Math.min(parseInt(limit, 10), 50);

    let messages;
    if (before) {
      messages = db.prepare(`
        SELECT * FROM messages
        WHERE dm_channel_id = ? AND created_at < (SELECT created_at FROM messages WHERE id = ?)
        ORDER BY created_at DESC LIMIT ?
      `).all(dmChannelId, before, pageLimit);
    } else {
      messages = db.prepare(`
        SELECT * FROM messages WHERE dm_channel_id = ?
        ORDER BY created_at DESC LIMIT ?
      `).all(dmChannelId, pageLimit);
    }

    messages.reverse();
    res.json({ messages: enrichMessages(messages), dmChannelId });
  } catch (err) {
    console.error('Get DM messages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/dm/:userId/messages - send DM
router.post('/dm/:userId/messages', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const otherUser = db.prepare('SELECT id, username, avatar, status FROM users WHERE id = ?').get(req.params.userId);
    if (!otherUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const dmChannelId = getOrCreateDMChannel(req.user.id, req.params.userId);

    const { content, attachments } = req.body;
    if (!content && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ error: 'Message content or attachment required' });
    }

    const msgId = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO messages (id, content, author_id, dm_channel_id, attachments, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      msgId,
      content || null,
      req.user.id,
      dmChannelId,
      attachments ? JSON.stringify(attachments) : null,
      now
    );

    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(msgId);
    const [enriched] = enrichMessages([message]);

    const io = req.app.locals.io;
    if (io) {
      io.to(`dm:${dmChannelId}`).emit('dm-message', enriched);
      // Also notify the recipient directly
      io.to(`user:${req.params.userId}`).emit('dm-notification', {
        from: { id: req.user.id },
        dmChannelId,
        message: enriched,
      });
    }

    res.status(201).json({ message: enriched, dmChannelId });
  } catch (err) {
    console.error('Send DM error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

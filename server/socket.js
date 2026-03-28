import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db.js';

const JWT_SECRET = 'discord-clone-secret-key-2024';

// Map of userId -> Set of socketIds
const onlineUsers = new Map();

// Map of voiceChannelId -> Set of userIds
const voiceChannels = new Map();

export function setupSocket(io) {
  // JWT authentication middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    console.log(`Socket connected: ${socket.id} (user: ${userId})`);

    // Track online user
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Join personal room for DM notifications
    socket.join(`user:${userId}`);

    // Update user status to online in DB
    const db = getDb();
    db.prepare("UPDATE users SET status = 'online' WHERE id = ?").run(userId);

    // Broadcast online presence to all
    io.emit('presence', { userId, status: 'online' });

    // ----------------------------------------------------------------
    // join-server: join all channel rooms for a server
    // ----------------------------------------------------------------
    socket.on('join-server', (serverId) => {
      try {
        const db = getDb();
        // Verify membership
        const membership = db.prepare(
          'SELECT * FROM server_members WHERE server_id = ? AND user_id = ?'
        ).get(serverId, userId);

        if (!membership) return;

        const channels = db.prepare(
          'SELECT id FROM channels WHERE server_id = ?'
        ).all(serverId);

        channels.forEach((ch) => {
          socket.join(`channel:${ch.id}`);
        });

        socket.join(`server:${serverId}`);
      } catch (err) {
        console.error('join-server error:', err);
      }
    });

    // ----------------------------------------------------------------
    // join-channel: join a specific channel room
    // ----------------------------------------------------------------
    socket.on('join-channel', (channelId) => {
      try {
        const db = getDb();
        const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
        if (!channel) return;

        const membership = db.prepare(
          'SELECT * FROM server_members WHERE server_id = ? AND user_id = ?'
        ).get(channel.server_id, userId);

        if (!membership) return;

        socket.join(`channel:${channelId}`);
      } catch (err) {
        console.error('join-channel error:', err);
      }
    });

    // ----------------------------------------------------------------
    // leave-channel: leave a specific channel room
    // ----------------------------------------------------------------
    socket.on('leave-channel', (channelId) => {
      socket.leave(`channel:${channelId}`);
    });

    // ----------------------------------------------------------------
    // join-dm: join a DM channel room
    // ----------------------------------------------------------------
    socket.on('join-dm', (dmChannelId) => {
      try {
        const db = getDb();
        const member = db.prepare(
          'SELECT * FROM dm_members WHERE dm_channel_id = ? AND user_id = ?'
        ).get(dmChannelId, userId);

        if (!member) return;
        socket.join(`dm:${dmChannelId}`);
      } catch (err) {
        console.error('join-dm error:', err);
      }
    });

    // ----------------------------------------------------------------
    // typing: broadcast typing indicator to channel
    // ----------------------------------------------------------------
    socket.on('typing', ({ channelId, dmChannelId, isTyping }) => {
      const db = getDb();
      const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId);
      if (!user) return;

      if (channelId) {
        socket.to(`channel:${channelId}`).emit('typing', { userId, username: user.username, channelId, isTyping });
      }
      if (dmChannelId) {
        socket.to(`dm:${dmChannelId}`).emit('typing', { userId, username: user.username, dmChannelId, isTyping });
      }
    });

    // ----------------------------------------------------------------
    // message: save to DB and broadcast to channel
    // ----------------------------------------------------------------
    socket.on('message', ({ channelId, content, attachments }) => {
      try {
        const db = getDb();
        const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
        if (!channel) return;

        const membership = db.prepare(
          'SELECT * FROM server_members WHERE server_id = ? AND user_id = ?'
        ).get(channel.server_id, userId);
        if (!membership) return;

        if (!content && (!attachments || attachments.length === 0)) return;

        const msgId = uuidv4();
        const now = new Date().toISOString();

        db.prepare(`
          INSERT INTO messages (id, content, author_id, channel_id, attachments, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          msgId,
          content || null,
          userId,
          channelId,
          attachments ? JSON.stringify(attachments) : null,
          now
        );

        const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(msgId);
        const author = db.prepare('SELECT id, username, avatar, status FROM users WHERE id = ?').get(userId);
        const enriched = { ...message, author, reactions: [], attachments: attachments || [] };

        io.to(`channel:${channelId}`).emit('message', enriched);
      } catch (err) {
        console.error('message event error:', err);
      }
    });

    // ----------------------------------------------------------------
    // dm-message: save to DB and send to DM participants
    // ----------------------------------------------------------------
    socket.on('dm-message', ({ toUserId, dmChannelId, content, attachments }) => {
      try {
        const db = getDb();
        if (!content && (!attachments || attachments.length === 0)) return;

        let resolvedDmChannelId = dmChannelId;

        if (!resolvedDmChannelId && toUserId) {
          // Get or create DM channel
          const existing = db.prepare(`
            SELECT dm_channel_id FROM dm_members WHERE user_id = ?
            INTERSECT
            SELECT dm_channel_id FROM dm_members WHERE user_id = ?
          `).get(userId, toUserId);

          if (existing) {
            resolvedDmChannelId = existing.dm_channel_id;
          } else {
            resolvedDmChannelId = uuidv4();
            db.prepare('INSERT INTO dm_channels (id) VALUES (?)').run(resolvedDmChannelId);
            db.prepare('INSERT INTO dm_members (dm_channel_id, user_id) VALUES (?, ?)').run(resolvedDmChannelId, userId);
            db.prepare('INSERT INTO dm_members (dm_channel_id, user_id) VALUES (?, ?)').run(resolvedDmChannelId, toUserId);
          }
        }

        if (!resolvedDmChannelId) return;

        // Verify sender is a member
        const member = db.prepare(
          'SELECT * FROM dm_members WHERE dm_channel_id = ? AND user_id = ?'
        ).get(resolvedDmChannelId, userId);
        if (!member) return;

        const msgId = uuidv4();
        const now = new Date().toISOString();

        db.prepare(`
          INSERT INTO messages (id, content, author_id, dm_channel_id, attachments, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          msgId,
          content || null,
          userId,
          resolvedDmChannelId,
          attachments ? JSON.stringify(attachments) : null,
          now
        );

        const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(msgId);
        const author = db.prepare('SELECT id, username, avatar, status FROM users WHERE id = ?').get(userId);
        const enriched = { ...message, author, reactions: [], attachments: attachments || [] };

        io.to(`dm:${resolvedDmChannelId}`).emit('dm-message', enriched);

        // Notify the other participant if not in the room
        if (toUserId) {
          io.to(`user:${toUserId}`).emit('dm-notification', {
            from: author,
            dmChannelId: resolvedDmChannelId,
            message: enriched,
          });
        }
      } catch (err) {
        console.error('dm-message event error:', err);
      }
    });

    // ----------------------------------------------------------------
    // presence: broadcast user status manually
    // ----------------------------------------------------------------
    socket.on('presence', ({ status }) => {
      const allowedStatuses = ['online', 'idle', 'dnd', 'invisible'];
      if (!allowedStatuses.includes(status)) return;

      const displayStatus = status === 'invisible' ? 'offline' : status;
      const db = getDb();
      db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, userId);
      io.emit('presence', { userId, status: displayStatus });
    });

    // ----------------------------------------------------------------
    // voice-join: track user joining a voice channel (visual only)
    // ----------------------------------------------------------------
    socket.on('voice-join', ({ channelId }) => {
      try {
        const db = getDb();
        const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
        if (!channel || channel.type !== 'voice') {
          // Allow joining even for text channels as voice-only is visual
        }

        if (!voiceChannels.has(channelId)) {
          voiceChannels.set(channelId, new Set());
        }
        voiceChannels.get(channelId).add(userId);

        // Broadcast to server members
        io.to(`server:${channel?.server_id}`).emit('voice-state', {
          channelId,
          userId,
          action: 'join',
          participants: Array.from(voiceChannels.get(channelId)),
        });
      } catch (err) {
        console.error('voice-join error:', err);
      }
    });

    // ----------------------------------------------------------------
    // voice-leave: remove user from voice channel
    // ----------------------------------------------------------------
    socket.on('voice-leave', ({ channelId }) => {
      try {
        const db = getDb();
        if (voiceChannels.has(channelId)) {
          voiceChannels.get(channelId).delete(userId);
          if (voiceChannels.get(channelId).size === 0) {
            voiceChannels.delete(channelId);
          }
        }

        const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
        io.to(`server:${channel?.server_id}`).emit('voice-state', {
          channelId,
          userId,
          action: 'leave',
          participants: Array.from(voiceChannels.get(channelId) || []),
        });
      } catch (err) {
        console.error('voice-leave error:', err);
      }
    });

    // ----------------------------------------------------------------
    // disconnect: cleanup and broadcast offline
    // ----------------------------------------------------------------
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id} (user: ${userId})`);

      if (onlineUsers.has(userId)) {
        onlineUsers.get(userId).delete(socket.id);

        // Only mark offline if no other sockets for this user
        if (onlineUsers.get(userId).size === 0) {
          onlineUsers.delete(userId);

          const db = getDb();
          db.prepare("UPDATE users SET status = 'offline' WHERE id = ?").run(userId);
          io.emit('presence', { userId, status: 'offline' });

          // Remove from all voice channels
          voiceChannels.forEach((participants, channelId) => {
            if (participants.has(userId)) {
              participants.delete(userId);
              const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
              io.to(`server:${channel?.server_id}`).emit('voice-state', {
                channelId,
                userId,
                action: 'leave',
                participants: Array.from(participants),
              });
              if (participants.size === 0) {
                voiceChannels.delete(channelId);
              }
            }
          });
        }
      }
    });
  });
}

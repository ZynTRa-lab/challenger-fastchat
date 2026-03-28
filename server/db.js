import initSqlJs from 'sql.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'discord.db');

let db = null;

// Wrapper to mimic better-sqlite3 API
function wrapDb(rawDb) {
  const save = () => {
    const data = rawDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  };

  // Auto-save periodically
  setInterval(save, 5000);

  return {
    exec(sql) {
      rawDb.run(sql);
      save();
    },
    prepare(sql) {
      return {
        run(...params) {
          rawDb.run(sql, params);
          save();
          return { changes: rawDb.getRowsModified() };
        },
        get(...params) {
          const stmt = rawDb.prepare(sql);
          stmt.bind(params);
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        },
        all(...params) {
          const results = [];
          const stmt = rawDb.prepare(sql);
          stmt.bind(params);
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();
          return results;
        },
      };
    },
    pragma() {},
    close() {
      save();
      rawDb.close();
    },
    save,
  };
}

export async function initDatabase() {
  const SQL = await initSqlJs();

  let rawDb;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    rawDb = new SQL.Database(fileBuffer);
  } else {
    rawDb = new SQL.Database();
  }

  db = wrapDb(rawDb);

  // Enable foreign keys
  rawDb.run('PRAGMA foreign_keys = ON');

  // Create tables
  rawDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      avatar TEXT,
      status TEXT DEFAULT 'online',
      about TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  rawDb.run(`
    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT,
      owner_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id)
    )
  `);

  rawDb.run(`
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'text',
      topic TEXT,
      position INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    )
  `);

  rawDb.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      content TEXT,
      author_id TEXT NOT NULL,
      channel_id TEXT,
      dm_channel_id TEXT,
      attachments TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT,
      FOREIGN KEY (author_id) REFERENCES users(id),
      FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
    )
  `);

  rawDb.run(`
    CREATE TABLE IF NOT EXISTS server_members (
      server_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      nickname TEXT,
      joined_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (server_id, user_id),
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  rawDb.run(`
    CREATE TABLE IF NOT EXISTS dm_channels (
      id TEXT PRIMARY KEY,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  rawDb.run(`
    CREATE TABLE IF NOT EXISTS dm_members (
      dm_channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (dm_channel_id, user_id),
      FOREIGN KEY (dm_channel_id) REFERENCES dm_channels(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  rawDb.run(`
    CREATE TABLE IF NOT EXISTS reactions (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      emoji TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  rawDb.run(`
    CREATE TABLE IF NOT EXISTS friends (
      user_id TEXT NOT NULL,
      friend_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, friend_id)
    )
  `);

  // Seed default "Genel" server if it doesn't exist
  const stmt = rawDb.prepare("SELECT id FROM servers WHERE name = 'Genel'");
  const hasServer = stmt.step();
  stmt.free();

  if (!hasServer) {
    // Create system user
    const sysStmt = rawDb.prepare("SELECT id FROM users WHERE id = 'system'");
    const hasSys = sysStmt.step();
    sysStmt.free();

    if (!hasSys) {
      rawDb.run(
        "INSERT INTO users (id, username, email, password, status) VALUES ('system', 'System', 'system@discord.local', 'no-login', 'offline')"
      );
    }

    const serverId = uuidv4();
    rawDb.run(`INSERT INTO servers (id, name, owner_id) VALUES ('${serverId}', 'Genel', 'system')`);

    const channelNames = ['genel', 'oyun-sohbet', 'muzik', 'valorant'];
    channelNames.forEach((name, index) => {
      const chId = uuidv4();
      rawDb.run(`INSERT INTO channels (id, server_id, name, type, position) VALUES ('${chId}', '${serverId}', '${name}', 'text', ${index})`);
    });

    console.log(`Default "Genel" server created with id: ${serverId}`);
  }

  db.save();
  console.log('Database initialized successfully');
  return db;
}

export function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

export default { initDatabase, getDb };

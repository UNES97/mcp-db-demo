import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../chat-history.sqlite');

let db: SqlJsDatabase;

async function getDb(): Promise<SqlJsDatabase> {
  if (db) return db;

  const SQL = await initSqlJs();

  // Load existing file or create new
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New Chat',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
  `);

  return db;
}

function save(): void {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

export async function createConversation(): Promise<string> {
  const d = await getDb();
  const id = crypto.randomUUID();
  d.run('INSERT INTO conversations (id) VALUES (?)', [id]);
  save();
  return id;
}

export async function addMessage(conversationId: string, role: string, content: string): Promise<void> {
  const d = await getDb();
  d.run('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)', [conversationId, role, content]);
  d.run("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?", [conversationId]);
  save();
}

export async function updateTitle(conversationId: string, title: string): Promise<void> {
  const d = await getDb();
  d.run('UPDATE conversations SET title = ? WHERE id = ?', [title.slice(0, 80), conversationId]);
  save();
}

export async function getConversations(): Promise<any[]> {
  const d = await getDb();
  const stmt = d.prepare(`
    SELECT c.id, c.title, c.created_at, c.updated_at,
      (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) AS message_count
    FROM conversations c
    ORDER BY c.updated_at DESC
    LIMIT 50
  `);
  const results: any[] = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

export async function getMessages(conversationId: string): Promise<any[]> {
  const d = await getDb();
  const stmt = d.prepare('SELECT role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY id ASC');
  stmt.bind([conversationId]);
  const results: any[] = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const d = await getDb();
  d.run('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);
  d.run('DELETE FROM conversations WHERE id = ?', [conversationId]);
  save();
}

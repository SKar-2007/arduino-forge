import Database from "better-sqlite3";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "../forge.db");

const db = new Database(dbPath, { verbose: null });

db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");

const initSql = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    prompt TEXT,
    board TEXT,
    code TEXT NOT NULL,
    wiring TEXT,
    libraries TEXT,
    notes TEXT,
    tags TEXT,
    is_public INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL,
    method TEXT,
    user_id INTEGER,
    duration_ms INTEGER,
    status_code INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS prompt_cache (
    key TEXT PRIMARY KEY,
    response TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

db.exec(initSql);

const migrations = [
  "CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_metrics_endpoint ON metrics(endpoint)",
  "CREATE INDEX IF NOT EXISTS idx_metrics_created ON metrics(created_at)",
  "CREATE INDEX IF NOT EXISTS idx_projects_public ON projects(is_public)",
];

for (const sql of migrations) {
  try { db.exec(sql); } catch { }
}

export default db;

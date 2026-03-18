import Database from "better-sqlite3";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "../forge.db");

const db = new Database(dbPath, { verbose: null });

// Ensure performance pragmas
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");

// ── Initialize Schema ──────────────────────────────────────────

const initSql = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY, /* uuid or nano-id equivalent */
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    prompt TEXT,
    board TEXT,
    code TEXT NOT NULL,
    wiring TEXT,
    libraries TEXT, /* JSON array */
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL,
    duration_ms INTEGER,
    status_code INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

db.exec(initSql);

export default db;

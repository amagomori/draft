import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { dataDir } from "./config.ts";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS paragraphs (
  id INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  position REAL NOT NULL,
  text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'ai',
  ai_score REAL,
  question TEXT,
  answer TEXT,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  fraction_human REAL NOT NULL,
  fraction_ai REAL NOT NULL,
  fraction_ai_assisted REAL NOT NULL,
  demo INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS mcp_sessions (
  post_id INTEGER PRIMARY KEY,
  last_seen INTEGER NOT NULL
);
`;

export const dbPath = process.env.DRAFT_DB ?? join(dataDir, "draft.db");

let db: DatabaseSync | undefined;

export function getDb(): DatabaseSync {
  if (db) return db;
  mkdirSync(dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  return db;
}

export function dataVersion(): number {
  return Number((getDb().prepare("PRAGMA data_version").get() as { data_version: number }).data_version);
}

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "..", "data.db");

const db = new Database(dbPath);

db.prepare(`
CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  prompt TEXT,
  status TEXT,
  createdAt INTEGER
)
`).run();

db.prepare(`
CREATE INDEX IF NOT EXISTS idx_logs_time ON logs(createdAt)
`).run();

export function pruneLogs(maxRows = 10000) {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM logs`).get();
  const count = Number(row?.count || 0);
  if (count <= maxRows) {
    return 0;
  }

  const excess = count - maxRows;
  db.prepare(`
DELETE FROM logs
WHERE id IN (
  SELECT id FROM logs
  ORDER BY createdAt ASC, id ASC
  LIMIT ?
)
`).run(excess);

  return excess;
}

export default db;

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

export default db;

/**
 * Database Service Layer
 * Encapsulates all SQLite interactions
 */

import { log } from "../logger.js";

export class DBService {
  constructor(db) {
    this.db = db;
  }

  logRequest(requestId, promptHash, statusCode, timestamp = Date.now()) {
    try {
      this.db.prepare(`
INSERT INTO logs (id, prompt, status, createdAt)
VALUES (?, ?, ?, ?)
`).run(requestId, promptHash, String(statusCode), timestamp);
      
      // Prune old logs after each write
      this.pruneLogs();
      return true;
    } catch (err) {
      log("warn", "DB log write failed", { requestId, error: err.message });
      return false;
    }
  }

  pruneLogs(maxRows = 10000) {
    try {
      const row = this.db.prepare(`SELECT COUNT(*) AS count FROM logs`).get();
      const count = Number(row?.count || 0);

      if (count <= maxRows) {
        return 0;
      }

      const excess = count - maxRows;
      this.db.prepare(`
DELETE FROM logs
WHERE id IN (
  SELECT id FROM logs
  ORDER BY createdAt ASC, id ASC
  LIMIT ?
)
`).run(excess);

      log("info", "Pruned old logs", { removed: excess, remaining: maxRows });
      return excess;
    } catch (err) {
      log("warn", "DB prune failed", { error: err.message });
      return 0;
    }
  }

  getLogStats() {
    try {
      const row = this.db.prepare(`SELECT COUNT(*) AS count FROM logs`).get();
      return { count: Number(row?.count || 0) };
    } catch (err) {
      log("warn", "DB stats failed", { error: err.message });
      return { count: 0 };
    }
  }
}

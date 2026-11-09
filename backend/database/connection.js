const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');

let dbInstance = null;

/**
 * Initializes and returns the SQLite database connection using better-sqlite3.
 * Configures WAL mode and enforces foreign key constraints.
 */
function getDatabase() {
  if (dbInstance) {
    return dbInstance;
  }

  const dbDir = path.dirname(config.db.path);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = new Database(config.db.path, {
    verbose: config.env === 'development' && process.env.DEBUG_SQL === 'true'
      ? console.log
      : null,
  });

  // Enable foreign key constraints (disabled by default in SQLite)
  dbInstance.pragma('foreign_keys = ON');

  // Enable WAL (Write-Ahead Logging) for better read/write concurrency
  dbInstance.pragma('journal_mode = WAL');

  // Set busy timeout to prevent locking issues under concurrency
  dbInstance.pragma('busy_timeout = 5000');

  // Synchronous NORMAL is optimal for WAL mode
  dbInstance.pragma('synchronous = NORMAL');

  return dbInstance;
}

/**
 * Closes the active database connection if open.
 */
function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

module.exports = {
  getDatabase,
  closeDatabase,
};


const Database = require("better-sqlite3");

const path = require("path");

// Resolve beside this file so the app uses the same database from any cwd.
const db = new Database(process.env.FREELANCER_DB_PATH || path.join(__dirname, "..", "freelancer.db"));
db.pragma("foreign_keys = ON");

console.log("SQLite database is connected successfully!");

module.exports = db;

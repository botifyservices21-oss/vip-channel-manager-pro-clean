// utils.js
const fs = require("fs");
const path = require("path");
const { DB_PATH } = require("./config");

const DEFAULT_DB = {
  vipChannels: [],
  plans: [],
  subscriptions: [],
  scheduledPosts: [],
  settings: {}
};

function ensureDataFolder() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readDB() {
  ensureDataFolder();
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
    return { ...DEFAULT_DB };
  }

  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const data = JSON.parse(raw);
    return { ...DEFAULT_DB, ...data };
  } catch (e) {
    console.error("Error leyendo DB, usando estructura por defecto:", e);
    return { ...DEFAULT_DB };
  }
}

function writeDB(data) {
  ensureDataFolder();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function addDaysToNow(days) {
  const now = Date.now();
  const ms = days * 24 * 60 * 60 * 1000;
  return now + ms;
}

module.exports = {
  readDB,
  writeDB,
  addDaysToNow
};

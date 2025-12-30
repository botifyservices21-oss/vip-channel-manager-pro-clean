// db.js — conexión MongoDB y colección global
const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("❌ ERROR: No existe MONGODB_URI en los Secrets.");
}

let client;
let db;

const collections = {
  settings: null,
  paymentSettings: null,
  vipChannels: null,
  plans: null,
  subscriptions: null,
};

async function connectDB() {
  if (db) return db;

  try {
    client = new MongoClient(uri);
    await client.connect();

    db = client.db("vipmanager");

    // Crear referencias a las colecciones
    collections.settings = db.collection("settings");
    collections.paymentSettings = db.collection("payment_settings");
    collections.vipChannels = db.collection("vip_channels");
    collections.plans = db.collection("plans");
    collections.subscriptions = db.collection("subscriptions");
    collections.scheduledPosts = db.collection("scheduled_posts");


    console.log("✅ Conectado a MongoDB correctamente.");
    return db;

  } catch (err) {
    console.error("❌ Error conectando a MongoDB:", err);
    throw err;
  }
}

module.exports = { connectDB, collections };

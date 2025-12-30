// index.js — Dashboard SaaS Premium
const { ObjectId } = require("mongodb");
const express = require("express");
const { Telegraf, session } = require("telegraf");

// Servicios Mongo
const {
  listVipChannels,
  addVipChannel,
  getVipChannelById,
  updateVipChannel,
  deleteVipChannel,

  listPlans,
  createPlan,
  getPlanById,
  updatePlan,
  deletePlan,

  listAllSubscriptions,
  getUserSubscriptions,

  getPaymentSettings,
  savePaymentSettings,

  setPlanChannelId,
  setPlanStripePrice,

  getSettings,
  saveSettings,
  saveNotificationSettings,
} = require("./services/mongo.js");

// DB
const { connectDB, collections } = require("./db");

// 🔥 BOT — IMPORTANTE: crear bot primero
const { BOT_TOKEN } = require("./config");
const { verifyDashboardToken } = require("./modules/web/auth-links");
const registerCommands = require("./commands");
const createStripeWebhook = require("./modules/payments/stripe-webhook");
const Stripe = require("stripe");
const createVipAccess = require("./modules/vip/access.js");
// Crear bot ANTES de usarlo
const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

const createAdminNotifier = require("./modules/notifications/admin-notify");
const notifier = createAdminNotifier(bot, getSettings);

bot.on("message", () => {
  console.log("📩 Telegram update recibido");
});


// 🔥 VIP ACCESS — Ahora sí, ya existe bot

const vipAccess = createVipAccess(bot);
// Cron automático
const createSubscriptionCleaner = require("./cron/subs-cleaner.js");

const subscriptionCleaner = createSubscriptionCleaner(bot, {
  getUserSubscriptions,
  listAllSubscriptions
});

// Ejecutar cada 5 minutos
setInterval(subscriptionCleaner, 5 * 60 * 1000);

console.log("⏱ Cron de expiración activado cada 5 min.");
const createPostScheduler = require("./cron/post-scheduler.js");
const postScheduler = createPostScheduler(bot);

// Ejecutar cada 60 segundos
setInterval(postScheduler, 60 * 1000);


// =============================
// VALIDAR TOKEN
// =============================
if (!BOT_TOKEN || BOT_TOKEN === "PON_AQUI_TU_TOKEN") {
  console.error("❌ BOT_TOKEN no configurado. Añádelo en Secrets.");
  process.exit(1);
}

// =============================
// CONFIG
// =============================
const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await connectDB();
    console.log("✅ MongoDB connected");

    await registerCommands(bot);
    console.log("✅ Bot commands registered");

    await bot.launch({
      dropPendingUpdates: true
    });
    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));

    console.log("🤖 Bot running in LONG POLLING mode");

    app.listen(PORT, () => {
      console.log(`🌍 Express server running on port ${PORT}`);
    });

  } catch (err) {
    console.error("❌ Fatal startup error:", err);
    process.exit(1);
  }
})();

// ===============================
// TON PAYMENT HANDLERS
// ===============================
bot.action(/^BUY_TON_PLAN_(.+)$/, async (ctx) => {
  try {
    const planId = ctx.match[1];
    await startTonPaymentForPlan(ctx, planId);
  } catch (e) {
    console.error("Error en BUY_TON_PLAN:", e);
  }
});

bot.action(/^TON_CONFIRM_(.+)$/, async (ctx) => {
  try {
    const txId = ctx.match[1];
    await confirmTonPayment(ctx, bot, txId);
  } catch (e) {
    console.error("Error en TON_CONFIRM:", e);
  }
});


// =============================
// EXPRESS APP
// =============================
const app = express();

// TON Payments
const {
  startTonPaymentForPlan,
  confirmTonPayment
} = require("./modules/payments/ton-advanced.js");


// Stripe webhook (raw body)
app.post(
  "/stripe/webhook",
  express.raw({ type: "application/json" }),
  createStripeWebhook(bot, vipAccess)
);
// Health check
app.get("/", (req, res) => res.status(200).send("OK"));

// 🔽 SOLO DESPUÉS JSON PARA EL DASHBOARD
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Health check
app.get("/", (req, res) => res.status(200).send("OK"));

/* ================================================================
   ADMIN DASHBOARD (Diseño SaaS Premium)
================================================================ */

function renderAdminLayout(content, token, active = "") {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Admin Panel – VIP Manager</title>
<script src="https://cdn.tailwindcss.com"></script>
</head>

<body class="bg-slate-900 text-slate-100 flex">

<!-- SIDEBAR -->
<aside class="w-64 bg-slate-950 border-r border-slate-800 h-screen fixed top-0 left-0 p-6 flex flex-col">
  <h1 class="text-xl font-bold mb-8 flex items-center gap-2">
    <span class="w-8 h-8 rounded-xl bg-emerald-500 text-slate-900 flex items-center justify-center font-bold">V</span>
    Admin
  </h1>

  <nav class="flex flex-col gap-3">
    <a href="/dashboard/admin?t=${token}" class="px-4 py-2 rounded-lg hover:bg-slate-800 transition ${active==="dashboard"?"bg-slate-800":""}">📊 Dashboard</a>
    <a href="/dashboard/admin/vip?t=${token}" class="px-4 py-2 rounded-lg hover:bg-slate-800 transition ${active==="vip"?"bg-slate-800":""}">💠 VIP Channels</a>
    <a href="/dashboard/admin/plans?t=${token}" class="px-4 py-2 rounded-lg hover:bg-slate-800 transition ${active==="plans"?"bg-slate-800":""}">💳 Plans</a>
    <a href="/dashboard/admin/subs?t=${token}" class="px-4 py-2 rounded-lg hover:bg-slate-800 transition ${active==="subs"?"bg-slate-800":""}">👥 Subscribers</a>
    <a href="/dashboard/admin/posts?t=${token}" 
       class="px-4 py-2 rounded-lg hover:bg-slate-800 transition ${active==="posts"?"bg-slate-800":""}">
       📆 Scheduled posts
    </a>

    <a href="/dashboard/admin/payments?t=${token}" class="px-4 py-2 rounded-lg hover:bg-slate-800 transition ${active==="payments"?"bg-slate-800":""}">💰 Payments (Stripe)</a>
    <a href="/dashboard/admin/settings?t=${token}" class="px-4 py-2 rounded-lg hover:bg-slate-800 transition ${active==="settings"?"bg-slate-800":""}">⚙️ Settings</a>
    <a href="/dashboard/admin/settings/notifications?t=${token}"
       class="px-4 py-2 rounded-lg hover:bg-slate-800 transition ${active==="settings_notifications"?"bg-slate-800":""}">
       🔔 Notifications
    </a>
  </nav>

  <div class="mt-auto text-xs text-slate-600">
    VIP Manager © ${new Date().getFullYear()}
  </div>
</aside>

<!-- CONTENT -->
<main class="ml-64 w-full p-10">
${content}
</main>

</body>
</html>
`;
}

/* ================================================================
   DASHBOARD PRINCIPAL
================================================================ */
app.get("/dashboard/admin", async (req, res) => {

  const token = req.query.t;
  const payload = verifyDashboardToken(token, "admin");
  if (!payload) return res.status(401).send("Invalid token");

  const channels = await listVipChannels();
  const plans = await listPlans();
  const subs = await listAllSubscriptions();
  const payment = await getPaymentSettings();

  const now = Date.now();
  const today = new Date(); today.setHours(0,0,0,0);
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;

  const active = subs.filter(s => s.active).length;
  const expired = subs.filter(s => !s.active).length;
  const newToday = subs.filter(s => s.startAt >= today.getTime()).length;
  const new7days = subs.filter(s => s.startAt >= weekAgo).length;

  // Ingresos estimados (solo Stripe)
  const monthlyIncome = subs
    .filter(s => s.active)
    .map(s => {
      const plan = plans.find(p => p.id === s.planId);
      return plan ? Number(plan.price) : 0;
    })
    .reduce((a,b) => a + b, 0);

  // Logs recientes (últimos 7)
  const logs = subs
    .sort((a,b)=>b.startAt - a.startAt)
    .slice(0,7)
    .map(s => {
      return {
        userId: s.userId,
        planName: s.planName,
        date: new Date(s.startAt).toLocaleString(),
        status: s.active ? "New / Renewal" : "Expired",
        method: s.stripeCustomerId ? "Stripe" : "Manual / TON"
      };
    });

  // Gráfica: nº subs por plan
  const chartLabels = plans.map(p => p.name);
  const chartValues = plans.map(
    p => subs.filter(s => s.planId === p.id && s.active).length
  );

  const html = `
  <!-- SYSTEM STATUS WIDGET -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">

    <!-- MONGO -->
    <div class="bg-slate-800/60 border border-slate-700 p-4 rounded-xl">
      <p class="text-sm text-slate-400">MongoDB database</p>
      <p class="text-lg font-semibold">
        ${collections ? "🟢 Conected" : "🔴 Disconected"}
      </p>
    </div>

    <!-- STRIPE -->
    <div class="bg-slate-800/60 border border-slate-700 p-4 rounded-xl">
      <p class="text-sm text-slate-400">Stripe</p>
      <p class="text-lg font-semibold">
        ${payment?.stripe_secret_key ? "🟢 Configured" : "🟠 Incomplete"}
      </p>
    </div>

    <!-- CRON -->
    <div class="bg-slate-800/60 border border-slate-700 p-4 rounded-xl">
      <p class="text-sm text-slate-400">Expiration timer</p>
      <p class="text-lg font-semibold">
        🟢 Active (every 5 min)
      </p>
      <p class="text-[11px] text-slate-500">
        Last execution: ${new Date().toLocaleString()}
      </p>
    </div>

  </div>

    <h2 class="text-2xl font-bold mb-6">📊 General Dashboard </h2>

    <!-- MÉTRICAS -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">

      <div class="bg-slate-800/60 border border-slate-700 p-6 rounded-2xl shadow-lg">
        <p class="text-sm text-slate-400">Active subscriptors</p>
        <p class="text-3xl font-bold">${active}</p>
      </div>

      <div class="bg-slate-800/60 border border-slate-700 p-6 rounded-2xl shadow-lg">
        <p class="text-sm text-slate-400">Expired</p>
        <p class="text-3xl font-bold">${expired}</p>
      </div>

      <div class="bg-slate-800/60 border border-slate-700 p-6 rounded-2xl shadow-lg">
        <p class="text-sm text-slate-400">New today</p>
        <p class="text-3xl font-bold">${newToday}</p>
      </div>

      <div class="bg-slate-800/60 border border-slate-700 p-6 rounded-2xl shadow-lg">
        <p class="text-sm text-slate-400">New in the last 7 days</p>
        <p class="text-3xl font-bold">${new7days}</p>
      </div>

    </div>

    <!-- INGRESOS -->
    <div class="mb-10 bg-emerald-900/20 border border-emerald-700 p-6 rounded-2xl">
      <p class="text-sm text-emerald-300">Estimated income this month</p>
      <p class="text-4xl font-bold text-emerald-400">€${monthlyIncome}</p>
    </div>

    <!-- GRÁFICA -->
    <div class="bg-slate-900/40 border border-slate-700 rounded-2xl p-6 mb-10">
      <h3 class="text-xl font-semibold mb-4">Subscriber distribution by plan</h3>
      <canvas id="subsChart" height="120"></canvas>
    </div>

    <!-- LOGS RECIENTES -->
    <h3 class="text-xl font-semibold mb-4">🕒 Recent activity</h3>

    <div class="bg-slate-800/40 border border-slate-700 rounded-2xl p-4">
      ${logs
        .map(
          l => `
        <div class="border-b border-slate-700 py-3">
          <p class="font-medium text-slate-200">
            👤 User: <b>${l.userId}</b> — Plan: <b>${l.planName}</b>
          </p>
          <p class="text-xs text-slate-400">
            ${l.method} — ${l.status} — ${l.date}
          </p>
        </div>`
        )
        .join("")}
    </div>

    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
      const ctx = document.getElementById('subsChart');

      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ${JSON.stringify(chartLabels)},
          datasets: [{
            label: 'Suscriptores activos',
            data: ${JSON.stringify(chartValues)},
            borderWidth: 1
          }]
        },
        options: {
          scales: {
            y: { beginAtZero: true }
          }
        }
      });
    </script>
  `;

  return res.send(renderAdminLayout(html, token, "dashboard"));
});

/* ======================================================================
   CANALES VIP — PANEL ADMIN
====================================================================== */

app.get("/dashboard/admin/vip", async (req, res) => {
  const token = req.query.t;
  const payload = verifyDashboardToken(token, "admin");
  if (!payload) return res.status(401).send("Token inválido");

  const channels = await listVipChannels();

  const html = `
    <h2 class="text-2xl font-bold mb-6">💠 VIP Channels</h2>

    <div class="bg-slate-800/40 border border-slate-700 rounded-2xl p-6 mb-8">
      <h3 class="text-lg font-semibold mb-4">Register a new VIP channel</h3>
      <form method="POST" action="/dashboard/admin/vip/create" class="space-y-4">

        <input type="hidden" name="t" value="${token}">

        <div>
          <label class="text-sm text-slate-300">Channel ID</label>
          <input name="id" class="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg text-sm" placeholder="-1001234567890">
        </div>

        <div>
          <label class="text-sm text-slate-300">Channel name</label>
          <input name="title" class="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg text-sm" placeholder="Canal Premium">
        </div>

        <button class="px-4 py-2 bg-emerald-500 text-slate-900 font-semibold rounded-lg hover:bg-emerald-400 transition">
          Register channel
        </button>

      </form>
    </div>

    <h3 class="text-xl font-semibold mb-4">List of VIP channels</h3>

    ${
      channels.length === 0
        ? `<p class="text-slate-400 text-sm">There are no registered VIP channels.</p>`
        : `
      <div class="space-y-3">
        ${channels
          .map(
            (c) => `
        <div class="flex items-center justify-between bg-slate-800/40 border border-slate-700 rounded-xl px-4 py-3">
          <div>
            <p class="text-slate-200 font-medium">${c.title}</p>
            <p class="text-xs text-slate-500">ID: ${c.id}</p>
          </div>

          <div class="flex gap-2">

            <a href="/dashboard/admin/vip/edit?id=${c.id}&t=${token}"
              class="px-3 py-1 rounded-md border border-slate-600 text-xs hover:border-emerald-400 hover:text-emerald-400">
              Edit
            </a>

            <form method="POST" action="/dashboard/admin/vip/delete" onsubmit="return confirm('¿Delete VIP Channel?');">
              <input type="hidden" name="id" value="${c.id}">
              <input type="hidden" name="t" value="${token}">
              <button class="px-3 py-1 rounded-md bg-rose-700/40 border border-rose-600 text-rose-300 hover:bg-rose-700/70">
                Delete
              </button>
            </form>

          </div>
        </div>
        `
          )
          .join("")}

      </div>`
    }
  `;

  res.send(renderAdminLayout(html, token, "vip"));
});


/* Registrar canal VIP */
app.post("/dashboard/admin/vip/create", async (req, res) => {
  const token = req.body.t;
  const payload = verifyDashboardToken(token, "admin");
  if (!payload) return res.status(401).send("Token inválido");

  const { id, title } = req.body;
  await addVipChannel({ id, title, createdAt: new Date() });

  return res.redirect(`/dashboard/admin/vip?t=${token}`);
});


/* ======================================================================
   EDITAR CANAL VIP — PANEL ADMIN
====================================================================== */
app.get("/dashboard/admin/vip/edit", async (req, res) => {
  const token = req.query.t;
  const id = req.query.id;

  const payload = verifyDashboardToken(token, "admin");
  if (!payload) return res.status(401).send("Token inválido");

  const channel = await getVipChannelById(id);
  if (!channel) return res.status(404).send("Channel not found");

  const html = `
    <h2 class="text-2xl font-bold mb-6">Edit VIP Channel</h2>

    <form method="POST" action="/dashboard/admin/vip/edit">
      <input type="hidden" name="t" value="${token}">
      <input type="hidden" name="id" value="${channel.id}">

      <label class="block mb-4 text-sm">
        <span class="block text-slate-300 mb-1">Channel name</span>
        <input name="title" value="${channel.title}" class="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600">
      </label>

      <div class="mt-4 flex gap-3">
        <button class="px-4 py-2 bg-emerald-500 text-slate-900 rounded-lg font-semibold hover:bg-emerald-400">
          Save changes
        </button>

        <a href="/dashboard/admin?t=${token}" class="px-4 py-2 bg-slate-700 rounded-lg">Cancel</a>
      </div>
    </form>
  `;

  res.send(renderAdminLayout(html, token, "vip"));
});


/* ======================================================================
   EDITAR CANAL VIP — POST
====================================================================== */
app.post("/dashboard/admin/vip/edit", async (req, res) => {
  const { t, id, title } = req.body;

  const payload = verifyDashboardToken(t, "admin");
  if (!payload) return res.status(401).send("Token inválido");

  await updateVipChannel(id, { title });

  // Volvemos a la lista de canales VIP
  return res.redirect(`/dashboard/admin/vip?t=${t}`);
});


/* ======================================================================
   PLANES — PANEL ADMIN
====================================================================== */

app.get("/dashboard/admin/plans", async (req, res) => {
  const token = req.query.t;
  const payload = verifyDashboardToken(token, "admin");
  if (!payload) return res.status(401).send("Token inválido");

  const plans = await listPlans();

  const html = `
    <h2 class="text-2xl font-bold mb-6">💳 VIP Plans</h2>

    <div class="flex justify-end mb-4">
      <a href="/dashboard/admin/plan/new?t=${token}" class="px-4 py-2 bg-emerald-500 text-slate-900 rounded-lg font-semibold hover:bg-emerald-400 transition">
        + Create Plan
      </a>
    </div>

    ${
      plans.length === 0
        ? `<p class="text-slate-400 text-sm">No plans have been created.</p>`
        : `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      ${plans
        .map(
          (p) => `
        <div class="bg-slate-800/40 border border-slate-700 rounded-xl p-6">
          <h3 class="text-lg font-semibold mb-1">${p.name}</h3>
          <p class="text-sm text-slate-400 mb-3">${p.price} ${p.currency} — ${p.durationDays} days</p>

          <p class="text-xs text-slate-500 mb-1">Price ID (Stripe): <span class="font-mono">${p.stripe_price_id || "Not assigned"}</span></p>
          <p class="text-xs text-slate-500 mb-3">VIP Channel: <span class="font-mono">${p.channelId || "Not assigned"}</span></p>

          <div class="flex gap-2 mt-4">
            <a href="/dashboard/admin/plan/edit?id=${encodeURIComponent(p.id)}&t=${encodeURIComponent(token)}" class="px-3 py-1 text-xs rounded-md border border-slate-600 hover:border-emerald-400 hover:text-emerald-400 transition">
              Edit
            </a>

            <form method="POST" action="/dashboard/admin/plan/delete" onsubmit="return confirm('¿Delete plan?');">
              <input type="hidden" name="t" value="${token}">
              <input type="hidden" name="id" value="${p.id}">
              <button class="px-3 py-1 text-xs rounded-md bg-rose-700/40 border border-rose-600 text-rose-300 hover:bg-rose-700/70 transition">
                Delete
              </button>
            </form>
          </div>
        </div>`
        )
        .join("")}
      </div>`
    }
  `;

  res.send(renderAdminLayout(html, token, "plans"));
});

/* ======================================================================
   CREAR PLAN – GET
====================================================================== */

app.get("/dashboard/admin/plan/new", async (req, res) => {
  const token = req.query.t;
  const payload = verifyDashboardToken(token, "admin");
  if (!payload) return res.status(401).send("Token inválido");

  const html = `
    <h2 class="text-2xl font-bold mb-6">➕ Create new plan</h2>

    <form method="POST" action="/dashboard/admin/plan/new">
      <input type="hidden" name="t" value="${token}">

      <label class="block mb-4">
        <span class="text-sm text-slate-300 mb-1 block">Plan name</span>
        <input name="name" required class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm" placeholder="Premium plan" />
      </label>

      <label class="block mb-4">
        <span class="text-sm text-slate-300 mb-1 block">Price</span>
        <input name="price" required type="number" step="0.01" class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm" placeholder="9.99" />
      </label>

      <label class="block mb-4">
        <span class="text-sm text-slate-300 mb-1 block">Currency</span>
        <input name="currency" required class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm" value="EUR" />
      </label>

      <label class="block mb-6">
        <span class="text-sm text-slate-300 mb-1 block">Duration (days)</span>
        <input name="durationDays" required type="number" value="30" class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm" />
      </label>

      <div class="flex justify-between items-center">
        <a href="/dashboard/admin/plans?t=${token}" class="text-slate-400 hover:text-slate-200 text-sm">← Back</a>
        <button type="submit" class="px-4 py-2 bg-emerald-500 text-slate-900 font-semibold rounded-lg hover:bg-emerald-400 transition">Create plan</button>
      </div>
    </form>
  `;

  res.send(renderAdminLayout(html, token, "plans"));
});
/* ======================================================================
   CREAR PLAN – POST
====================================================================== */

app.post("/dashboard/admin/plan/new", async (req, res) => {
  const token = req.body.t;
  const payload = verifyDashboardToken(token, "admin");
  if (!payload) return res.status(401).send("Token inválido");

  const { name, price, currency, durationDays } = req.body;

  await createPlan({
    id: String(Date.now()),
    name,
    price,
    currency,
    durationDays: parseInt(durationDays, 10),
    channelId: null,
    stripe_price_id: null,
  });

  return res.redirect(`/dashboard/admin/plans?t=${token}`);
});
/* ======================================================================
   EDITAR PLAN – GET
====================================================================== */

app.get("/dashboard/admin/plan/edit", async (req, res) => {
  const token = req.query.t;
  const id = req.query.id;

  const payload = verifyDashboardToken(token, "admin");
  if (!payload) return res.status(401).send("Token inválido");

  const plan = await getPlanById(id);
  const channels = await listVipChannels();

  if (!plan) return res.status(404).send("Plan not found");

  const html = `
    <h2 class="text-2xl font-bold mb-6">✏️ Edit Plan</h2>

    <form method="POST" action="/dashboard/admin/plan/edit">
      <input type="hidden" name="t" value="${token}">
      <input type="hidden" name="id" value="${plan.id}">

      <label class="block mb-4">
        <span class="text-sm text-slate-300">Name</span>
        <input name="name" value="${plan.name}" class="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg" required />
      </label>

      <label class="block mb-4">
        <span class="text-sm text-slate-300">Price</span>
        <input type="number" step="0.01" name="price" value="${plan.price}" class="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg" required />
      </label>

      <label class="block mb-4">
        <span class="text-sm text-slate-300">Currency</span>
        <input name="currency" value="${plan.currency}" class="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg" required />
      </label>

      <label class="block mb-4">
        <span class="text-sm text-slate-300">Duration (days)</span>
        <input type="number" name="durationDays" value="${plan.durationDays}" class="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg" required />
      </label>

      <label class="block mb-4">
        <span class="text-sm text-slate-300">Assign VIP channel</span>
        <select name="channelId" class="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg">
          <option value="">— Unassigned —</option>

          ${channels
            .map(
              (c) =>
                `<option value="${c.id}" ${
                  c.id === plan.channelId ? "selected" : ""
                }>${c.title}</option>`
            )
            .join("")}
        </select>
      </label>

      <label class="block mb-4">
        <span class="text-sm text-slate-300">Stripe Price ID</span>
        <input name="stripe_price_id" value="${
          plan.stripe_price_id || ""
        }" class="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg" />
      </label>

      <div class="flex justify-between items-center mt-6">
        <a href="/dashboard/admin/plans?t=${token}" class="text-slate-400 hover:text-slate-200 text-sm">← Back</a>
        <button class="px-4 py-2 bg-emerald-500 text-slate-900 font-semibold rounded-lg">Save</button>
      </div>
    </form>
  `;

  res.send(renderAdminLayout(html, token, "plans"));
});
/* ======================================================================
   EDITAR PLAN – POST
====================================================================== */

app.post("/dashboard/admin/plan/edit", async (req, res) => {
  const token = req.body.t;
  const payload = verifyDashboardToken(token, "admin");
  if (!payload) return res.status(401).send("Token inválido");

  const { id, name, price, currency, durationDays, channelId, stripe_price_id } = req.body;

  await updatePlan(id, {
    name,
    price,
    currency,
    durationDays: Number(durationDays),
    channelId: channelId || null,
    stripe_price_id: stripe_price_id || null,
  });

  return res.redirect(`/dashboard/admin/plans?t=${token}`);
});

/* ======================================================================
   DELETE PLAN – POST
====================================================================== */

app.post("/dashboard/admin/plan/delete", async (req, res) => {
  const token = req.body.t;
  const payload = verifyDashboardToken(token, "admin");
  if (!payload) return res.status(401).send("Invalid token");

  const { id } = req.body;

  await deletePlan(id);

  return res.redirect(`/dashboard/admin/plans?t=${token}`);
});


/* ======================================================================
   POSTS PROGRAMADOS – LISTA
====================================================================== */
app.get("/dashboard/admin/posts", async (req, res) => {
  const token = req.query.t;
  const payload = verifyDashboardToken(token, "admin");
  if (!payload) return res.status(401).send("Token inválido");

  const posts = await collections.scheduledPosts.find().sort({ date: 1 }).toArray();
  const channels = await listVipChannels();

  const html = `
    <h2 class="text-2xl font-bold mb-6">📆 Scheduled posts</h2>

    <a href="/dashboard/admin/posts/new?t=${token}"
       class="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold rounded-lg transition">
       ➕ Create scheduled post
    </a>

    <div class="mt-6 bg-slate-800/40 border border-slate-700 rounded-xl p-6">
      <table class="min-w-full text-sm">
        <thead class="border-b border-slate-700 text-slate-400">
          <tr>
            <th class="py-2 px-3 text-center">Date</th>
            <th class="py-2 px-3 text-center">Channel</th>
            <th class="py-2 px-3 text-center">Content</th>
            <th class="py-2 px-3 text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${
            posts.length === 0
              ? `<tr><td colspan="4" class="text-center py-4 text-slate-500">There are no scheduled posts.</td></tr>`
              : posts
                  .map(p => {
                    const channel = channels.find(c => c.id == p.channelId);
                    return `
                      <tr class="border-b border-slate-800/60">
                        <td class="py-2 px-3 text-center">${new Date(p.date).toLocaleString()}</td>
                        <td class="py-2 px-3 text-center">${channel ? channel.title : p.channelId}</td>
                        <td class="py-2 px-3 text-center">${p.text.slice(0, 60)}...</td>
                        <td class="py-2 px-3 text-center">
                          <a href="/dashboard/admin/posts/edit/${p._id}?t=${token}" class="text-emerald-400 hover:underline">Edit</a> |
                          <a href="/dashboard/admin/posts/delete/${p._id}?t=${token}" class="text-rose-400 hover:underline"
                             onclick="return confirm('¿Delete this scheduled post?');">
                             Delete
                          </a>
                        </td>
                      </tr>
                    `;
                  })
                  .join("")
          }
        </tbody>
      </table>
    </div>
  `;

  res.send(renderAdminLayout(html, token, "posts"));
});
/* ======================================================================
   CREAR POST PROGRAMADO – FORMULARIO
====================================================================== */
app.get("/dashboard/admin/posts/new", async (req, res) => {
  const token = req.query.t;
  const payload = verifyDashboardToken(token, "admin");
  if (!payload) return res.status(401).send("Token inválido");

  const channels = await listVipChannels();

  const html = `
    <h2 class="text-2xl font-bold mb-6">➕ Create scheduled post</h2>

    <form method="POST" action="/dashboard/admin/posts/new" class="space-y-6 max-w-xl bg-slate-800/40 border border-slate-700 p-6 rounded-xl">

      <input type="hidden" name="t" value="${token}">

      <div>
        <label class="text-sm text-slate-300">VIP Channel</label>
        <select name="channelId" class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm">
          ${channels.map(c => `<option value="${c.id}">${c.title}</option>`).join("")}
        </select>
      </div>

      <div>
        <label class="text-sm text-slate-300">Date and time (ISO)</label>
        <input type="datetime-local" name="date"
               class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm">
      </div>

      <div>
        <label class="text-sm text-slate-300">Post content</label>
        <textarea name="text" rows="6"
               class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm"></textarea>
      </div>

      <button class="px-4 py-2 bg-emerald-500 text-slate-900 font-semibold rounded-lg hover:bg-emerald-400">
        Save
      </button>
    </form>
  `;

  res.send(renderAdminLayout(html, token, "posts"));
});

/* ======================================================================
   CREAR POST PROGRAMADO — GUARDAR (POST)
====================================================================== */
app.post("/dashboard/admin/posts/new", async (req, res) => {
  const { t, channelId, date, text } = req.body;

  const payload = verifyDashboardToken(t, "admin");
  if (!payload) return res.status(401).send("Token inválido");

  // Convertir fecha del input (datetime-local) a UTC real
  const userDate = new Date(date);
  const timestamp = userDate.getTime() - (userDate.getTimezoneOffset() * 60000);

  if (isNaN(timestamp)) {
    return res.status(400).send("Invalid date.");
  }

  await collections.scheduledPosts.insertOne({
    channelId: Number(channelId),
    date: timestamp,     // ✔ GUARDADO CORRECTO
    text,
    sent: false,
    createdAt: Date.now(),
  });

  return res.redirect(`/dashboard/admin/posts?t=${t}`);
});

/* ======================================================================
   EDITAR POST PROGRAMADO – FORMULARIO
====================================================================== */
app.get("/dashboard/admin/posts/edit/:id", async (req, res) => {
  const token = req.query.t;
  const payload = verifyDashboardToken(token, "admin");
  if (!payload) return res.status(401).send("Token inválido");

  const { id } = req.params;

  let post;
  try {
    post = await collections.scheduledPosts.findOne({
      $or: [{ _id: new ObjectId(id) }, { _id: id }]
    });
  } catch {
    post = await collections.scheduledPosts.findOne({ _id: id });
  }

  if (!post) return res.status(404).send("Post not found");

  const channels = await listVipChannels();

  const html = `
    <h2 class="text-2xl font-bold mb-6">✏️ Edit scheduled post</h2>

    <form method="POST" action="/dashboard/admin/posts/edit/${id}">
      <input type="hidden" name="t" value="${token}">

      <label class="text-sm text-slate-300">VIP Channel</label>
      <select name="channelId" class="block w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 mb-4">
        ${channels.map(c => `<option value="${c.id}" ${c.id == post.channelId ? "selected" : ""}>${c.title}</option>`).join("")}
      </select>

      <label class="text-sm text-slate-300">Date and time</label>
      <input type="datetime-local" name="date"
             value="${new Date(post.date).toISOString().slice(0,16)}"
             class="block w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 mb-4">

      <label class="text-sm text-slate-300">Content</label>
      <textarea name="text" rows="6" class="block w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 mb-4">${post.text}</textarea>

      <button class="px-4 py-2 bg-emerald-500 rounded-lg text-slate-900">Save</button>
    </form>
  `;

  res.send(renderAdminLayout(html, token, "posts"));
});

app.post("/dashboard/admin/posts/edit/:id", async (req, res) => {
  const { id } = req.params;
  const { t, channelId, date, text } = req.body;

  const payload = verifyDashboardToken(t, "admin");
  if (!payload) return res.status(401).send("Token inválido");

  const userDate = new Date(date);
  const timestamp = userDate.getTime() - (userDate.getTimezoneOffset() * 60000);

  if (isNaN(timestamp)) {
    return res.status(400).send("Invalid date.");
  }

  await collections.scheduledPosts.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        channelId: Number(channelId),
        date: timestamp,   // 👍 Fecha corregida a UTC real
        text,
        sent: false        // se marca como pendiente otra vez
      }
    }
  );

  return res.redirect(`/dashboard/admin/posts?t=${t}`);
});

app.get("/dashboard/admin/posts/delete/:id", async (req, res) => {
  const { id } = req.params;
  const token = req.query.t;

  const payload = verifyDashboardToken(token, "admin");
  if (!payload) return res.status(401).send("Token inválido");

  await collections.scheduledPosts.deleteOne({ _id: new ObjectId(id) });

  return res.redirect(`/dashboard/admin/posts?t=${token}`);
});



/* ======================================================================
   CONFIGURACIÓN STRIPE — PANEL ADMIN
====================================================================== */

app.get("/dashboard/admin/payments", async (req, res) => {
  const token = req.query.t;
  const payload = verifyDashboardToken(token, "admin");
  if (!payload) return res.status(401).send("Token inválido");

  const payment = (await getPaymentSettings()) || {};

  const html = `
    <h2 class="text-2xl font-bold mb-6">💰 Payment Settings (Stripe)</h2>

    <form method="POST" action="/dashboard/admin/payments" class="space-y-6 max-w-xl">

      <input type="hidden" name="t" value="${token}">

      <div>
        <label class="text-sm text-slate-300">Stripe Secret Key</label>
        <input name="stripe_secret_key"
               value="${payment.stripe_secret_key || ""}"
               class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm font-mono">
      </div>

      <div>
        <label class="text-sm text-slate-300">Stripe Webhook Secret</label>
        <input name="stripe_webhook_secret"
               value="${payment.stripe_webhook_secret || ""}"
               class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm font-mono">
      </div>

      <button class="px-4 py-2 bg-emerald-500 rounded-lg text-slate-900 font-semibold text-sm hover:bg-emerald-400 transition">
        Save settings
      </button>

    </form>
  `;

  res.send(renderAdminLayout(html, token, "payments"));
});

/* Guardar configuración Stripe */
app.post("/dashboard/admin/payments", async (req, res) => {
  const token = req.body.t;
  const payload = verifyDashboardToken(token, "admin");

  if (!payload) return res.status(401).send("Token inválido");

  await savePaymentSettings({
    stripe_secret_key: req.body.stripe_secret_key,
    stripe_webhook_secret: req.body.stripe_webhook_secret,
  });

  return res.redirect(`/dashboard/admin/payments?t=${token}`);
});


/* ======================================================================
   SUSCRIPTORES — PANEL ADMIN
====================================================================== */
app.get("/dashboard/admin/subs", async (req, res) => {

  const token = req.query.t;
  const payload = verifyDashboardToken(token, "admin");
  if (!payload) return res.status(401).send("Token inválido");

  const subs = await listAllSubscriptions();
  const plans = await listPlans();
  const channels = await listVipChannels();

  const html = `
<h2 class="text-2xl font-bold mb-6">👥 Subscriptors</h2>

<!-- FILTROS -->
<div class="bg-slate-800/40 border border-slate-700 p-4 rounded-xl mb-6">
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4">

    <select id="filterPlan" class="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm">
      <option value="">Filter by plan</option>
      ${plans.map(p => `<option value="${p.name}">${p.name}</option>`).join("")}
    </select>

    <select id="filterState" class="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm">
      <option value="">Filter by state</option>
      <option value="activo">Active</option>
      <option value="inactivo">Inactive</option>
      <option value="expulsado">Expelled</option>
    </select>

    <select id="filterMethod" class="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm">
      <option value="">Payment method</option>
      <option value="stripe">Stripe</option>
      <option value="ton">TON</option>
      <option value="manual">Manual</option>
    </select>

    <select id="filterChannel" class="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm">
      <option value="">Filter by channel</option>
      ${channels.map(c => `<option value="${c.id}">${c.title}</option>`).join("")}
    </select>

  </div>

  <input id="searchInput" placeholder="Search for user, plan, or channel..."
    class="mt-4 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm" />

  <button id="applyFiltersBtn"
    class="mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold rounded-lg transition">
    Apply filters
  </button>

</div>

<!-- TABLA -->
<div class="overflow-x-auto bg-slate-800/40 border border-slate-700 rounded-xl p-6">
  <table id="subsTable" class="min-w-full text-xs">
    <thead class="text-slate-400 border-b border-slate-700">
      <tr>
        <th class="py-2 px-3 text-center">User</th>
        <th class="py-2 px-3 text-center">Plan</th>
        <th class="py-2 px-3 text-center">Channel</th>
        <th class="py-2 px-3 text-center">Start</th>
        <th class="py-2 px-3 text-center">End</th>
        <th class="py-2 px-3 text-center">Status</th>
        <th class="py-2 px-3 text-center">Actions</th>
      </tr>
    </thead>

    <tbody id="subsBody">
      ${subs
        .map((s) => {

          let estado = "Inactive";
          let estadoClass = "text-rose-400";

          if (s.active) {
            estado = "Active";
            estadoClass = "text-emerald-400";
          } else if (s.kick === true) {
            estado = "Expelled";
            estadoClass = "text-amber-400";
          }

          const method = s.stripeCustomerId
            ? "stripe"
            : s.tonTx
            ? "ton"
            : "manual";

          return `
          <tr class="border-b border-slate-800/60">
            <td class="py-2 px-3 text-center font-mono">${s.userId}</td>
            <td class="py-2 px-3 text-center">${s.planName}</td>
            <td class="py-2 px-3 text-center">${s.channelId || "—"}</td>
            <td class="py-2 px-3 text-center">${new Date(s.startAt).toLocaleString()}</td>
            <td class="py-2 px-3 text-center">${new Date(s.endAt).toLocaleString()}</td>
            <td class="py-2 px-3 text-center ${estadoClass}">${estado}</td>
            <td class="py-2 px-3 text-center">

              ${
                s.active && s.channelId
                  ? `
                    <form method="POST" action="/dashboard/admin/subs/kick"
                          onsubmit="return confirm('Should this user be removed from the VIP channel?');">
                      <input type="hidden" name="t" value="${token}">
                      <input type="hidden" name="userId" value="${s.userId}">
                      <input type="hidden" name="channelId" value="${s.channelId}">
                      <button class="px-3 py-1 bg-rose-600/60 text-rose-200 rounded-lg text-[11px] hover:bg-rose-600 transition">
                        Expel
                      </button>
                    </form>
                  `
                  : `<span class="text-slate-600 text-[11px]">—</span>`
              }

            </td>
          </tr>`;
        })
        .join("")}
    </tbody>
  </table>
</div>

<script>
document.addEventListener("DOMContentLoaded", () => {

  const rows = Array.from(document.querySelectorAll("#subsBody tr"));

  function filterTable() {
    const plan = document.getElementById("filterPlan").value.toLowerCase();
    const state = document.getElementById("filterState").value.toLowerCase();
    const method = document.getElementById("filterMethod").value.toLowerCase();
    const channel = document.getElementById("filterChannel").value.toLowerCase();
    const search = document.getElementById("searchInput").value.toLowerCase();

    rows.forEach(row => {

      const cells = row.children;

      const rUser = cells[0].innerText.toLowerCase();
      const rPlan = cells[1].innerText.toLowerCase();
      const rChannel = cells[2].innerText.toLowerCase();
      const rEstado = cells[5].innerText.trim().toLowerCase();

      // Método real → lo extraemos del texto total de la fila
      const full = row.innerText.toLowerCase();
      const rMethod = full.includes("stripe")
        ? "stripe"
        : full.includes("ton")
        ? "ton"
        : full.includes("manual")
        ? "manual"
        : "";

      let visible = true;

      if (plan && rPlan !== plan) visible = false;
      if (channel && rChannel !== channel) visible = false;
      if (state && rEstado !== state) visible = false;
      if (method && rMethod !== method) visible = false;
      if (search && !full.includes(search)) visible = false;

      row.style.display = visible ? "" : "none";
    });
  }

  // Activar el botón correctamente
  document.getElementById("applyFiltersBtn")
    .addEventListener("click", filterTable);

});
</script>

`;

  res.send(renderAdminLayout(html, token, "subs"));
});


/* ======================================================================
   EXPULSAR USUARIO DEL CANAL VIP
====================================================================== */
app.post("/dashboard/admin/subs/kick", async (req, res) => {
  const token = req.body.t;
  const payload = verifyDashboardToken(token, "admin");
  if (!payload) return res.status(401).send("Token inválido");

  const { userId, channelId } = req.body;

  try {
    console.log(`Expelling user ${userId} of the channel ${channelId}...`);

    // 1. Expulsar del canal
    await bot.telegram.banChatMember(Number(channelId), Number(userId));
    await bot.telegram.unbanChatMember(Number(channelId), Number(userId));

    // 2. Actualizar suscripciones (FUNCIONA SIEMPRE)
    await collections.subscriptions.updateMany(
      {
        userId: String(userId),
        $or: [
          { channelId: String(channelId) },
          { channelId: Number(channelId) }
        ]
      },
      {
        $set: {
          active: false,
          kicked: true,
          endAt: Date.now()
        }
      }
    );

    // 3. Notificación admin
    const settings = await getSettings();
    const n = settings.notifications || {};

    if (n.enabled && n.onKick && n.adminId) {
      await bot.telegram.sendMessage(
        n.adminId,
        `❗ Expelled user\n👤 ID: <code>${userId}</code>\n📢 Channel: <code>${channelId}</code>`,
        { parse_mode: "HTML" }
      );
    }

    return res.redirect(`/dashboard/admin/subs?t=${encodeURIComponent(token)}`);

  } catch (err) {
    console.error("Error ejecting user:", err);
    return res.status(500).send("Error expelling the user.");
  }
});

/* ======================================================================
   AJUSTES GENERALES — PANEL ADMIN
====================================================================== */

app.get("/dashboard/admin/settings", async (req, res) => {
  const token = req.query.t;
  const payload = verifyDashboardToken(token, "admin");

  if (!payload) return res.status(401).send("Token inválido");

  const settings = await getSettings();

  const html = `
    <h2 class="text-2xl font-bold mb-6">⚙️ General Settings</h2>

    <form method="POST" action="/dashboard/admin/settings" class="space-y-6 max-w-xl">

      <input type="hidden" name="t" value="${token}">

      <div>
        <label class="text-sm text-slate-300">Time zone</label>
        <input name="timezone"
               value="${settings.timezone}"
               class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm">
      </div>

      <div>
        <label class="text-sm text-slate-300">Grace days</label>
        <input name="graceDays"
               value="${settings.graceDays}"
               type="number"
               class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm">
      </div>

      <div>
        <label class="text-sm text-slate-300">Support Contact</label>
        <input name="supportContact"
               value="${settings.supportContact}"
               class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm">
      </div>

      <button class="px-4 py-2 bg-emerald-500 rounded-lg text-slate-900 font-semibold text-sm hover:bg-emerald-400 transition">
        Save settings
      </button>

    </form>
  `;

  res.send(renderAdminLayout(html, token, "settings"));
});

app.post("/dashboard/admin/settings", async (req, res) => {
  const token = req.body.t;
  const payload = verifyDashboardToken(token, "admin");
  if (!payload) return res.status(401).send("Token inválido");

  await saveSettings({
    timezone: req.body.timezone,
    graceDays: Number(req.body.graceDays),
    supportContact: req.body.supportContact,
  });

  return res.redirect(`/dashboard/admin/settings?t=${token}`);
});

/* ============================================================
   ADMIN — CONFIGURACIÓN DE NOTIFICACIONES
============================================================ */
app.get("/dashboard/admin/settings/notifications", async (req, res) => {
  const token = req.query.t;
  const payload = verifyDashboardToken(token, "admin");
  if (!payload) return res.status(401).send("Token inválido");

  const settings = await getSettings();
  const n = settings.notifications || {};

  const html = `
    <h2 class="text-2xl font-bold mb-6">🔔 Notification Settings</h2>

    <form method="POST" action="/dashboard/admin/settings/notifications/save"
          class="space-y-6 bg-slate-800/40 border border-slate-700 p-6 rounded-2xl">

      <input type="hidden" name="t" value="${token}">

      <div>
        <label class="text-sm">ID of the administrator who will receive notifications</label>
        <input name="adminId" value="${n.adminId || ""}"
               class="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg text-sm">
      </div>

      <div class="space-y-3">
        <label class="flex items-center gap-2">
          <input type="checkbox" name="enabled" ${n.enabled ? "checked" : ""}>
          Activate notifications
        </label>

        <label class="flex items-center gap-2">
          <input type="checkbox" name="onPurchase" ${n.onPurchase ? "checked" : ""}>
          Notify new purchases
        </label>

        <label class="flex items-center gap-2">
          <input type="checkbox" name="onRenew" ${n.onRenew ? "checked" : ""}>
          Notify of automatic renewals
        </label>

        <label class="flex items-center gap-2">
          <input type="checkbox" name="onExpire" ${n.onExpire ? "checked" : ""}>
          Notify of subscription expirations
        </label>

        <label class="flex items-center gap-2">
          <input type="checkbox" name="onKick" ${n.onKick ? "checked" : ""}>
          Notify user expulsions
        </label>

        <label class="flex items-center gap-2">
          <input type="checkbox" name="onPost" ${n.onPost ? "checked" : ""}>
          Notify published scheduled posts
        </label>

      </div>

      <button class="px-4 py-2 bg-emerald-500 text-slate-900 font-semibold rounded-lg hover:bg-emerald-400">
        Save changes
      </button>
    </form>
  `;

  res.send(renderAdminLayout(html, token, "settings_notifications"));
});
app.post("/dashboard/admin/settings/notifications/save", async (req, res) => {
  const token = req.body.t;
  const payload = verifyDashboardToken(token, "admin");
  if (!payload) return res.status(401).send("Token inválido");

  const data = {
    adminId: req.body.adminId || null,
    enabled: req.body.enabled === "on",
    onPurchase: req.body.onPurchase === "on",
    onRenew: req.body.onRenew === "on",
    onExpire: req.body.onExpire === "on",
    onKick: req.body.onKick === "on",
    onPost: req.body.onPost === "on",

  };

  await saveNotificationSettings(data);

  return res.redirect(`/dashboard/admin/settings/notifications?t=${token}`);
});

/* ======================================================================
   LAYOUT USER (PORTAL VIP)
====================================================================== */

function renderUserLayout(innerHtml, { userId } = {}) {
  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>My VIP Panel – VIP Channel Manager</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script src="https://cdn.tailwindcss.com"></script>
  </head>

  <body class="bg-slate-950 text-slate-100 min-h-screen">
    <!-- Fondo degradado suave -->
    <div class="fixed inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 opacity-90 pointer-events-none"></div>

    <!-- NAVBAR -->
    <nav class="relative z-10 bg-slate-950/90 backdrop-blur border-b border-slate-800 px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-2xl bg-emerald-500 flex items-center justify-center text-slate-900 font-bold text-lg">
          V
        </div>
        <div>
          <h1 class="text-lg font-semibold">My VIP Channel</h1>
          <p class="text-xs text-slate-400">Manage your access to private channels</p>
        </div>
      </div>
      <div class="text-right">
        <p class="text-[11px] text-slate-500">Telegram user</p>
        <p class="text-xs font-mono">${userId || "-"}</p>
      </div>
    </nav>

    <!-- CONTENIDO -->
    <main class="relative z-10 max-w-5xl mx-auto px-4 py-8">
      ${innerHtml}
    </main>
  </body>
  </html>
  `;
}
/* ======================================================================
   ADMIN — CRUD CANALES VIP
====================================================================== */

// Eliminar canal VIP
app.post("/dashboard/admin/vip/delete", async (req, res) => {
  const token = req.body.t;
  const payload = verifyDashboardToken(token, "admin");

  if (!payload) {
    return res.status(401).send("Link inválido o caducado.");
  }

  const channelId = req.body.id;

  try {
    await collections.vipChannels.deleteOne({ id: Number(channelId) });
    return res.redirect(`/dashboard/admin?t=${encodeURIComponent(token)}`);
  } catch (e) {
    console.error("Error eliminando canal VIP:", e);
    return res.status(500).send("Error interno eliminando el canal VIP.");
  }
});


/* ======================================================================
   DASHBOARD USER — /dashboard/user?t=TOKEN
====================================================================== */

app.get("/dashboard/user", async (req, res) => {
  const token = req.query.t;
  const payload = verifyDashboardToken(token, "user");
  if (!payload) return res.status(401).send("Link inválido o caducado.");

  const userId = payload.telegramId;
  const subs = (await getUserSubscriptions(userId)) || [];

  const now = Date.now();
  const activeSubs = subs.filter((s) => s.active && s.endAt > now);
  const hasActiveStripe = activeSubs.some((s) => !!s.stripeSubscriptionId);
  const nextExpiry = activeSubs.length
    ? Math.min(...activeSubs.map((s) => s.endAt))
    : null;

  const botUsername = process.env.BOT_USERNAME || "Bot";
  const supportUsername = process.env.SUPPORT_USERNAME || "Support";

  // Texto “estado general”
  let generalStatus = "You don't have any active subscriptions yet.";
  if (activeSubs.length > 0 && nextExpiry) {
    generalStatus = `Your have ${activeSubs.length} subscription(s) active(s). The next one expires on ${new Date(
      nextExpiry
    ).toLocaleString()}.`;
  }

  const paymentStatusText = hasActiveStripe
    ? "Subscription managed by Stripe"
    : subs.length > 0
    ? "You can renew with Stripe or TON"
    : "No current subscription";

  const innerHtml = `
    <!-- RESUMEN PRINCIPAL -->
    <section class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
        <p class="text-xs uppercase tracking-wide text-slate-400 mb-1">Active subscriptions</p>
        <p class="text-3xl font-bold">${activeSubs.length}</p>
        <p class="text-[11px] text-slate-500 mt-1">
          ${
            subs.length === 0
              ? "You haven't subscribed to any plan yet."
              : `${subs.length} in total (active + expired).`
          }
        </p>
      </div>

      <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
        <p class="text-xs uppercase tracking-wide text-slate-400 mb-1">Next expiration</p>
        <p class="text-xl font-semibold">
          ${
            nextExpiry
              ? new Date(nextExpiry).toLocaleDateString()
              : "—"
          }
        </p>
        <p class="text-[11px] text-slate-500 mt-1">
          ${
            nextExpiry
              ? new Date(nextExpiry).toLocaleTimeString()
              : "No active subscriptions"
          }
        </p>
      </div>

      <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
        <p class="text-xs uppercase tracking-wide text-slate-400 mb-1">Payment method</p>
        <p class="text-sm font-medium">${paymentStatusText}</p>
        <p class="text-[11px] text-slate-500 mt-1">
          ${
            hasActiveStripe
              ? "If you want to change payment details or cancel, do so from the Stripe portal."
              : "In future renewals you will be able to use Stripe or TON."
          }
        </p>
      </div>
    </section>

    <!-- BLOQUE PRINCIPAL: MIS SUSCRIPCIONES -->
    <section class="mb-10">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-base font-semibold">My subscriptions</h2>
          <p class="text-xs text-slate-500">${generalStatus}</p>
        </div>
        <a
          href="https://t.me/${botUsername}"
          class="text-xs px-3 py-1 rounded-lg border border-slate-700 hover:border-emerald-400 hover:text-emerald-300 transition"
        >
          Open a bot on Telegram
        </a>
      </div>

      ${
        subs.length === 0
          ? `
        <div class="bg-slate-900/80 border border-dashed border-slate-700 rounded-2xl p-6 text-center shadow-lg">
          <p class="text-slate-200 mb-2 text-sm">You do not have any active subscriptions.</p>
          <p class="text-slate-500 text-xs mb-4">
            Subscribe to a plan through the bot to gain access to VIP channels.
          </p>
          <a href="https://t.me/${botUsername}"
             class="inline-block px-4 py-2 rounded-lg bg-emerald-500 text-slate-900 font-semibold text-sm hover:bg-emerald-400 transition">
            View plans in the bot
          </a>
        </div>`
          : `
        <div class="space-y-4">
          ${subs
            .slice()
            .sort((a, b) => b.startAt - a.startAt)
            .map((sub) => {
              const total = sub.endAt - sub.startAt;
              const remaining = sub.endAt - now;
              const progress =
                total > 0
                  ? Math.max(
                      0,
                      Math.min(100, Math.round((remaining / total) * 100))
                    )
                  : 0;

              const isActive = sub.active && sub.endAt > now;
              const statusLabel = isActive ? "Active" : "Inactive / Expired";
              const statusClass = isActive
                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/40"
                : "bg-rose-500/10 text-rose-300 border-rose-500/40";

              const hasChannel = !!sub.channelId;

              const openVipLink = hasChannel
                ? "https://t.me/${botUsername}?start=" + encodeURIComponent("vip_" + sub.channelId)
                : null;

              return `
          <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div class="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 class="text-base font-semibold">${sub.planName}</h3>
                <p class="text-[11px] text-slate-500 mt-1">
                  ID subscription: <span class="font-mono">${sub.id}</span>
                </p>
              </div>
              <span class="text-[11px] px-2 py-1 rounded-full border ${statusClass}">
                ${statusLabel}
              </span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300 mb-3">
              <div>
                <p class="text-slate-400 text-[11px] mb-0.5">Canal</p>
                <p class="font-mono text-[11px]">${sub.channelId || "—"}</p>
              </div>
              <div>
                <p class="text-slate-400 text-[11px] mb-0.5">Start</p>
                <p>${new Date(sub.startAt).toLocaleString()}</p>
              </div>
              <div>
                <p class="text-slate-400 text-[11px] mb-0.5">End</p>
                <p>${new Date(sub.endAt).toLocaleString()}</p>
              </div>
            </div>

            <!-- Barra de progreso -->
            <div class="mt-2">
              <div class="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  class="h-2.5 bg-emerald-500"
                  style="width: ${isActive ? progress : 0}%"
                ></div>
              </div>
              <p class="text-[11px] text-slate-500 mt-1">
                ${
                  isActive
                    ? `~${progress}% of remaining time`
                    : "This subscription has already expired."
                }
              </p>
            </div>

            <div class="mt-4 flex flex-wrap items-center justify-between gap-2">
              ${
                hasChannel && isActive
                  ? `<a
                      href="${openVipLink}"
                      class="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-900 text-xs font-semibold hover:bg-emerald-400 transition"
                    >
                      Enter the VIP channel
                    </a>`
                  : `<span class="text-[11px] text-slate-500">
                      ${
                        hasChannel
                          ? "Access to the channel is available when the subscription is active."
                          : "This plan does not have a linked VIP channel."
                      }
                    </span>`
              }

              ${
                sub.stripeSubscriptionId
                  ? `<span class="text-[11px] text-slate-500">
                      Powered by Stripe (ID: <span class="font-mono">${sub.stripeSubscriptionId}</span>)
                    </span>`
                  : ""
              }
            </div>
          </div>`;
            })
            .join("")}
        </div>`
      }
    </section>

    <!-- BLOQUE: RENOVACIÓN + PAGOS -->
    <section class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
      <!-- RENOVACIÓN -->
      <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg">
        <h2 class="text-base font-semibold mb-2">Renew subscription</h2>
        <p class="text-xs text-slate-400 mb-4">
          You can only renew when your subscription has expired (or you don't have an active subscription)..
        </p>

        ${
          subs.length === 0
            ? `
          <p class="text-sm text-slate-300 mb-3">
            You don't have a subscription yet. Get started with the bot:
          </p>
          <a href="https://t.me/${botUsername}"
             class="inline-block px-4 py-2 rounded-lg bg-emerald-500 text-slate-900 text-sm font-semibold hover:bg-emerald-400 transition">
            See plans and hire
          </a>`
            : activeSubs.length > 0
            ? `
          <p class="text-sm text-slate-300 mb-2">
            You have an active subscription. You will be able to renew it when the current period ends.
          </p>
          <p class="text-[11px] text-slate-500">
            Next due date: ${
              nextExpiry ? new Date(nextExpiry).toLocaleString() : "—"
            }
          </p>`
            : `
          <p class="text-sm text-slate-300 mb-3">
            Your current subscriptions have expired. Choose how you want to pay for your next renewal:
          </p>
          <div class="flex flex-wrap gap-3">
            <a
              href="https://t.me/${botUsername}?start=renew_stripe"
              class="px-4 py-2 rounded-lg bg-emerald-500 text-slate-900 text-xs font-semibold hover:bg-emerald-400 transition"
            >
              💳 Renew with Stripe
            </a>
            <a
              href="https://t.me/${botUsername}?start=renew_ton"
              class="px-4 py-2 rounded-lg bg-sky-500/90 text-slate-900 text-xs font-semibold hover:bg-sky-400 transition"
            >
              ⚡ Renew with TON
            </a>
          </div>
          <p class="text-[11px] text-slate-500 mt-3">
            The bot will guide you step by step through the method you choose.
          </p>`
        }
      </div>

      <!-- PAGOS / BILLING -->
      <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg">
        <h2 class="text-base font-semibold mb-3">Payments and billing</h2>

        <p class="text-sm text-slate-300 mb-3">
          If your subscription is managed by Stripe, you can update your payment method, view invoices, or cancel here.
        </p>

        <form method="GET" action="/dashboard/user/billing" class="mb-2">
          <input type="hidden" name="t" value="${encodeURIComponent(token)}" />
          <button
            type="submit"
            class="px-4 py-2 rounded-lg bg-emerald-500 text-slate-900 font-semibold text-sm hover:bg-emerald-400 transition disabled:opacity-60"
            ${hasActiveStripe ? "" : "disabled"}
          >
            Open Stripe payment portal
          </button>
        </form>

        <p class="text-[11px] text-slate-500 mb-1">
          ${
            hasActiveStripe
              ? "This button will open Stripe's secure billing portal."
              : "You will only see information if you have an active subscription managed by Stripe."
          }
        </p>
      </div>
    </section>

    <!-- SOPORTE -->
    <section class="mb-4">
      <h2 class="text-base font-semibold mb-3">Support</h2>
      <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p class="text-sm text-slate-200 mb-1">
            Having trouble with your VIP access, payments, or subscriptions?
          </p>
          <p class="text-xs text-slate-500">
            Write to us on Telegram and we'll help you personally.
          </p>
        </div>
        <a href="https://t.me/${supportUsername}"
           class="px-4 py-2 inline-block rounded-lg border border-slate-700 hover:border-emerald-400 hover:text-emerald-300 text-sm transition">
          Contact support on Telegram
        </a>
      </div>
    </section>
  `;

  res.send(renderUserLayout(innerHtml, { userId }));
});


/* ======================================================================
   BILLING PORTAL (Stripe) — USER
   /dashboard/user/billing?t=TOKEN
====================================================================== */

app.get("/dashboard/user/billing", async (req, res) => {
  const token = req.query.t;
  const payload = verifyDashboardToken(token, "user");
  if (!payload) return res.status(401).send("Link inválido o caducado.");

  const userId = payload.telegramId;
  const subs = (await getUserSubscriptions(userId)) || [];
  const activeWithStripe = subs.find(
    (s) => s.active && s.stripeCustomerId
  );

  if (!activeWithStripe) {
    return res
      .status(400)
      .send("We have not found an active subscription managed by Stripe for this user.");
  }

  const payment = await getPaymentSettings();
  if (!payment || !payment.stripe_secret_key) {
    return res
      .status(500)
      .send("Stripe is not configured on this bot.");
  }

  try {
    const stripe = Stripe(payment.stripe_secret_key);

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: activeWithStripe.stripeCustomerId,
      return_url: `${BASE_URL}/dashboard/user?t=${encodeURIComponent(token)}`,
    });

    return res.redirect(portalSession.url);
  } catch (e) {
    console.error("Error creando Billing Portal:", e.message);
    return res
      .status(500)
      .send("The billing portal could not be opened.");
  }
});


/* ======================================================================
   INICIAR SERVIDOR EXPRESS
====================================================================== */
app.listen(PORT, () => {
  console.log(`🌍 Servidor Express activo en puerto ${PORT}`);
});


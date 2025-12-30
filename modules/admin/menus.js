// modules/admin/menus.js
const {
  getSettings,
  listVipChannels,
  listPlans,
  getUserSubscriptions,
  listAllSubscriptions,
} = require("../../services/mongo.js");

const { safeEdit, getPremiumHeader, isAdmin } = require("../ui/helpers");

const {
  createAdminDashboardUrl,
  createUserDashboardUrl,
} = require("../web/auth-links");

/* ============================================================
   ADMIN MENUS
============================================================ */

async function sendAdminPanel(ctx, options = {}) {
  const useReply = options.useReply || false;

  const text =
    getPremiumHeader("Control Panel") +
    "Manage all your VIP infrastructure from a single site:\n\n" +
    "• VIP Channels\n" +
    "• Plans & prices\n" +
    "• Subscriptions\n" +
    "• Scheduled posts\n" +
    "• Payments & monetization\n\n" +
    "Use the web panel for advanced settings.";

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🎟 Manage VIP", callback_data: "ADMIN_VIP_MENU" },
        { text: "💳 Plans & prices", callback_data: "ADMIN_PLANS_MENU" },
      ],
      [
        { text: "👥 Subscriptions", callback_data: "ADMIN_SUBS_MENU" },
        { text: "📆 Scheduled posts", callback_data: "ADMIN_POSTS_MENU" },
      ],
      [
        { text: "💰 Payments & monetization", callback_data: "PAYMENTS_MENU" },
      ],
      [
        { text: "⬅️ Return to home", callback_data: "BACK_TO_START" },
      ],
    ],
  };

  if (useReply || !ctx.editMessageText) {
    return ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
  } else {
    return safeEdit(ctx, text, { parse_mode: "HTML", reply_markup: keyboard });
  }
}


async function sendAdminHomeMenu(ctx) {
  const adminUrl = createAdminDashboardUrl(ctx.from.id);

  const text =
    getPremiumHeader("VIP Channel Manager Pro") +
    "Premium system to manage access to your VIP channel.\n\n" +
    "👑 You are an administrator.\n\n" +
    "<b>Choose an option:</b>";

  return ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "💠 Control Panel", callback_data: "ADMIN_PANEL_MAIN" }],
        [
          {
            text: "🌐 Web Panel (Admin)",
            url: adminUrl,
          },
        ],
        [{ text: "📘 Admin Panel – Commands & Configuration", callback_data: "ADMIN_HELP" }],
        [{ text: "📗 Bot Quick Guide", callback_data: "GUIDE" }],
        [{ text: "💬 Technical support", callback_data: "SUPPORT" }],
      ],
    },
  });
}

async function sendVipMenu(ctx) {
  const channels = await listVipChannels();
  let text = getPremiumHeader("Canales VIP") + "Registered channels:\n\n";

  if (!channels.length) {
    text += "❌ There are no VIP channels.\nUse /addvip within the channel to mark as VIP.";
  } else {
    channels.forEach((c, i) => {
      text += `${i + 1}. <b>${c.title}</b> (ID: <code>${c.id}</code>)\n`;
    });
  }

  return safeEdit(ctx, text, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[{ text: "⬅️ Back", callback_data: "ADMIN_PANEL_MAIN" }]],
    },
  });
}

async function sendPlansMenu(ctx) {
  const plans = await listPlans();
  let text = getPremiumHeader("Plans & prices") + "Plans configured:\n\n";

  if (!plans.length) {
    text += "❌ There are no plans.\nCreate one with /addplan.";
  } else {
    plans.forEach((p, i) => {
      text += `${i + 1}. <b>${p.name}</b> — ${p.price} ${p.currency} · ${p.durationDays} days\n`;

      if (p.channelId) {
        text += `   🔗 Assigned channel: <code>${p.channelId}</code>\n`;
      } else {
        text += `   ⚠️ <i>No channel assigned</i>\n`;
      }

      text += "\n";
    });
  }

  return safeEdit(ctx, text, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "➕ Create plan", callback_data: "ADMIN_ADD_PLAN" }],
        [{ text: "🔗 Assign a channel to a plan", callback_data: "ADMIN_ASSIGN_PLAN_CHANNEL" }],
        [{ text: "⬅️ Back", callback_data: "ADMIN_PANEL_MAIN" }],
      ],
    },
  });
}

async function sendSubsMenu(ctx) {
  const subs = await listAllSubscriptions();

  const total = subs.length;
  const activos = subs.filter((s) => s.active).length;
  const expulsados = subs.filter((s) => s.kicked === true || s.kick === true).length;
  const expirados = total - activos - expulsados;

  let text =
    getPremiumHeader("Subscriptors") +
    "<b>General summary:</b>\n\n" +
    `• Actives: <b>${activos}</b>\n` +
    `• Expired: <b>${expirados}</b>\n` +
    `• Expelled: <b>${expulsados}</b>\n` +
    `• Total: <b>${total}</b>\n\n` +
    "<b>Last 10 moves:</b>\n\n";

  if (!subs.length) {
    text += "There are no registered subscriptions yet.";
  } else {
    const last = subs
      .slice()
      .sort((a, b) => b.startAt - a.startAt)
      .slice(0, 10);

    last.forEach((s, i) => {
      const estado = s.kicked || s.kick
        ? "🚫 Expelled"
        : s.active
        ? "✅ Active"
        : "⏱ Expired";

      text +=
        `${i + 1}. <b>${s.planName}</b> — ${estado}\n` +
        `👤 <code>${s.userId}</code>\n` +
        (s.channelId ? `📢 Channel: <code>${s.channelId}</code>\n` : "") +
        `🗓 End: ${new Date(s.endAt).toLocaleString()}\n\n`;
    });
  }

  // 🔥 GENERAMOS EL LINK SEGURO AQUÍ
  const adminUrl = createAdminDashboardUrl(ctx.from.id);

  return safeEdit(ctx, text, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🌐 Web Admin Panel",
            url: adminUrl,
          },
        ],
        [{ text: "⬅️ Back", callback_data: "ADMIN_PANEL_MAIN" }],
      ],
    },
  });
}




async function sendPostsMenu(ctx) {
  // Intentamos obtener el token desde la sesión
  const token = ctx.session?.dashboardToken
    ? ctx.session.dashboardToken
    : null;

  // Si no hay token, creamos un enlace seguro igual
  const url = token
    ? `${process.env.WEB_URL}/dashboard/admin/posts?t=${token}`
    : createAdminDashboardUrl(ctx.from.id);

  const text =
    getPremiumHeader("Scheduled posts") +
    "<b>Automatic publication management</b>\n\n" +
    "Scheduled posts are now managed exclusively from the Web Admin Panel.\n\n" +
    "From there you can:\n" +
    "• Create scheduled posts\n" +
    "• Edit them\n" +
    "• Delete them\n" +
    "• View history and upcoming posts\n\n" +
    "👉 Open the panel here:";

  return safeEdit(ctx, text, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🌐 Open scheduled posts",
            url
          }
        ],
        [{ text: "⬅️ Back", callback_data: "ADMIN_PANEL_MAIN" }],
      ],
    },
  });
}



async function sendSettingsMenu(ctx) {
  return safeEdit(
    ctx,
    "⚙️ <b>Bot settings</b>\n\nManage all system options.",
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "💳 Payments & billing", callback_data: "ADMIN_CFG_PAYMENTS" }],
          [{ text: "📣 VIP Channels", callback_data: "ADMIN_CFG_CHANNELS" }],
          [{ text: "📦 Plans & prices", callback_data: "ADMIN_CFG_PLANS" }],
          [{ text: "🎨 Branding & messaging", callback_data: "ADMIN_CFG_BRANDING" }],
          [{ text: "🔐 Security & access", callback_data: "ADMIN_CFG_SECURITY" }],
          [{ text: "🆘 Support and contact", callback_data: "ADMIN_CFG_SUPPORT" }],
          [{ text: "⬅️ Back", callback_data: "ADMIN_BACK_HOME" }],
        ],
      },
    }
  );
}

async function sendAdminHelp(ctx) {
  const s = await getSettings();

  const text =
    getPremiumHeader("Admin Panel – Commands & Configuration") +
    `<b>Core Commands:</b>\n` +
    `• /start — Open the main menu.\n` +
    `• /panel — Open the control panel.\n` +
    `• /addvip — Register a VIP channel.\n` +
    `• /addplan — Create a subscription plan.\n\n` +
    `<b>Current Settings:</b>\n` +
    `• Timezone: <code>${s.timezone || "N/A"}</code>\n` +
    `• Grace period (days): <code>${s.graceDays || 0}</code>\n` +
    `• Support contact: <code>${s.supportContact || "Not configured"}</code>\n`;

  return safeEdit(ctx, text, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[{ text: "⬅️ Back", callback_data: "ADMIN_PANEL_MAIN" }]],
    },
  });
}

/* ============================================================
   USER MENUS
============================================================ */

async function sendUserMainMenu(ctx, options = {}) {
  const useReply = options.useReply || false;
  const userUrl = createUserDashboardUrl(ctx.from.id);

  const text =
    getPremiumHeader("💎 Premium VIP Access") +
    `<b>Welcome to your personal dashboard.</b>\n\n` +
    `Your VIP access is managed automatically.\n\n` +
    `Choose an option below:\n\n`;

  const keyboard = {
    inline_keyboard: [
      [{ text: "✨ View VIP Plans", callback_data: "USER_PLANS" }],
      [{ text: "📊 My Subscription", callback_data: "USER_STATUS" }],
      [{ text: "🌐 VIP Web Dashboard", url: userUrl }],
      [{ text: "📘 How It Works", callback_data: "GUIDE" }],
      [{ text: "💬 Support", callback_data: "SUPPORT" }],
    ],
  };

  if (useReply || !ctx.editMessageText) {
    return ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
  } else {
    return safeEdit(ctx, text, { parse_mode: "HTML", reply_markup: keyboard });
  }
}

async function sendUserPlans(ctx) {
  const plans = await listPlans();

  let text =
    getPremiumHeader("VIP Plans") +
    "<b>Select the plan that best fits your needs:</b>\n\n";

  if (!plans.length) {
    text += "❌ No plans are currently available.";
    return safeEdit(ctx, text, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "⬅️ Back", callback_data: "USER_BACK_TO_START" }],
        ],
      },
    });
  }

  const createStripeCheckout = require("../../modules/payments/create-stripe-checkout.js");
  const keyboard = [];

  for (const plan of plans) {
    const planId = plan.id || plan._id?.toString();

    let stripeUrl = null;
    try {
      if (plan.stripe_price_id) {
        stripeUrl = await createStripeCheckout(plan, ctx.from.id);
      }
    } catch (e) {
      console.error("❌ Stripe Error:", e);
    }

    text +=
      `⭐ <b>${plan.name}</b>\n` +
      `💶 <b>${plan.price} ${plan.currency}</b> — ${plan.durationDays} days\n` +
      `🔒 VIP access included\n\n`;

    const row = [];

    if (stripeUrl) {
      row.push({ text: "💳 Pay with Stripe", url: stripeUrl });
    } else {
      row.push({ text: "Stripe unavailable", callback_data: "DISABLED" });
    }

    row.push({
      text: "⚡ Pay with TON",
      callback_data: `BUY_TON_PLAN_${planId}`,
    });

    keyboard.push(row);
    text += "──────────────────────────────\n\n";
  }

  keyboard.push([{ text: "⬅️ Back", callback_data: "USER_BACK_TO_START" }]);

  return safeEdit(ctx, text, {
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: keyboard },
  });
}

async function sendUserStatus(ctx) {
  const subs = await getUserSubscriptions(ctx.from.id);

  if (!subs.length) {
    return ctx.editMessageText("❌ You do not have any active subscriptions.", {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📦 View Plans", callback_data: "USER_PLANS" }],
          [{ text: "⬅️ Back", callback_data: "USER_BACK_TO_START" }],
        ],
      },
    });
  }

  const sub = subs[0];

  const text =
    `📊 <b>Your VIP Subscription</b>\n\n` +
    `📦 Plan: <b>${sub.planName}</b>\n` +
    `⏳ Expires on: ${new Date(sub.endAt).toLocaleString()}\n\n` +
    `⚙️ Manage your subscription via Stripe:`;

  return ctx.editMessageText(text, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "⚙️ Manage Subscription", callback_data: "USER_MANAGE_SUB" }],
        [{ text: "⬅️ Back", callback_data: "USER_BACK_TO_START" }],
      ],
    },
  });
}

async function sendGuide(ctx) {
  const admin = await isAdmin(ctx);
  const back = admin ? "ADMIN_PANEL_MAIN" : "USER_BACK_TO_START";

  const text =
    getPremiumHeader("Quick Guide") +
    "1️⃣ Choose a plan\n2️⃣ Complete payment\n3️⃣ Get VIP access\n4️⃣ Automatic renewals\n5️⃣ Automatic access removal\n";

  return safeEdit(ctx, text, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[{ text: "⬅️ Back", callback_data: back }]],
    },
  });
}

async function sendSupport(ctx) {
  const s = await getSettings();
  const admin = await isAdmin(ctx);
  const back = admin ? "ADMIN_PANEL_MAIN" : "USER_BACK_TO_START";

  const text =
    getPremiumHeader("Technical Support") +
    `If you need assistance:\n\n<b>${s.supportContact || "Not configured"}</b>`;

  return safeEdit(ctx, text, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[{ text: "⬅️ Back", callback_data: back }]],
    },
  });
}


module.exports = {
  sendAdminPanel,
  sendAdminHomeMenu,
  sendVipMenu,
  sendPlansMenu,
  sendSubsMenu,
  sendPostsMenu,
  sendSettingsMenu,
  sendAdminHelp,
  sendUserMainMenu,
  sendUserPlans,
  sendUserStatus,
  sendGuide,
  sendSupport,
};

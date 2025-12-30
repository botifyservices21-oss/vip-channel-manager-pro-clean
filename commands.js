// commands.js

const {
  addVipChannel,
  createPlan,
  listPlans,
  getUserSubscriptions,
  addSubscription,
  giveVipAccess,
  listVipChannels,
  setPlanChannelId,
} = require("./services/mongo.js");

const {
  createAdminDashboardUrl,
  createUserDashboardUrl,
} = require("./modules/web/auth-links");

const {
  startStripeCheckoutForPlan,
} = require("./modules/payments/stripe-checkout");

const {
  openStripeCustomerPortal,
} = require("./modules/payments/stripe-portal");

// TON avanzado
const {
  startTonPaymentForPlan,
  confirmTonPayment,
} = require("./modules/payments/ton-advanced");

const { isAdmin, safeEdit } = require("./modules/ui/helpers");
const { ensureSession } = require("./modules/sessions/session-manager");

// Import menus
const {
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
} = require("./modules/admin/menus");

const { collections } = require("./db");
const { BASE_URL } = process.env;
const { generateDashboardToken } = require("./modules/web/auth-links");

/* ============================================================
   MAIN EXPORT
============================================================ */
module.exports = function registerCommands(bot) {

  /* ============================================================
     ✅ ÚNICO bot.start — ahora sí funciona como debe
  ============================================================= */
  bot.start(async (ctx) => {
    const chatType = ctx.chat?.type || "";
    const userId = String(ctx.from.id);

    // 📌 PRIVADO
    if (chatType === "private") {

      // ADMIN (verifica por lista ADMINS en Secrets)
      if (await isAdmin(ctx)) {
        return sendAdminHomeMenu(ctx);
      }

      // USUARIO NORMAL
      return sendUserMainMenu(ctx, { useReply: true });
    }

    // 📌 EN GRUPOS O CANALES → NO MOSTRAR PANEL ADMIN
    return ctx.reply(
      "👋 Use this bot in PRIVATE to view your dashboard.\n\n@" +
      (process.env.BOT_USERNAME || "tuBotUsername")
    );
  });

  /* ==================== ADMIN COMMANDS ==================== */

  bot.command("panel", async (ctx) => {
    if (!(await isAdmin(ctx))) return ctx.reply("Administrators only.");
    return sendAdminPanel(ctx, { useReply: true });
  });

  bot.command("addvip", async (ctx) => {
    if (!(await isAdmin(ctx))) return ctx.reply("Administrators only.");

    if (ctx.chat.type === "private") {
      return ctx.reply("Run this command within the VIP CHANNEL (not in private).");
    }

    const channelData = {
      id: ctx.chat.id,
      title: ctx.chat.title || ctx.chat.username || "Canal VIP",
      type: ctx.chat.type,
      username: ctx.chat.username || null,
      createdAt: new Date(),
    };

    const result = await addVipChannel(channelData);

    if (!result.ok && result.reason === "already_exists") {
      return ctx.reply("⚠️ This channel is already registered as VIP.");
    }

    if (!result.ok) {
      return ctx.reply("❌ The VIP channel could not be registered. Please try again.");
    }

    return ctx.reply("✔ VIP channel successfully registered.");
  });

  /* ============================================================
     CALLBACK QUERY HANDLER
  ============================================================= */
  bot.on("callback_query", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const admin = await isAdmin(ctx);

    /* UNIVERSAL BACK */
    if (data === "ADMIN_BACK_HOME") {
      return sendAdminHomeMenu(ctx, { useReply: true });
    }

    if (data === "BACK_TO_START") {
      if (admin) return sendAdminHomeMenu(ctx, { useReply: true });
      return sendUserMainMenu(ctx, { useReply: true });
    }

    /* ==================== COMPRAS USER ==================== */

    if (data.startsWith("BUY_PLAN_RECUR_")) {
      const planId = data.replace("BUY_PLAN_RECUR_", "");
      return startStripeCheckoutForPlan(ctx, planId);
    }

    if (data.startsWith("BUY_TON_PLAN_")) {
      const planId = data.replace("BUY_TON_PLAN_", "");
      return startTonPaymentForPlan(ctx, planId);
    }

    if (data.startsWith("TON_CONFIRM_")) {
      const planId = data.replace("TON_CONFIRM_", "");
      return confirmTonPayment(ctx, bot, planId);
    }

    /* ==================== ADMIN ==================== */
    if (admin) {
      if (data === "ADMIN_PANEL_MAIN") return sendAdminPanel(ctx);
      if (data === "ADMIN_VIP_MENU") return sendVipMenu(ctx);
      if (data === "ADMIN_PLANS_MENU") return sendPlansMenu(ctx);
      if (data === "ADMIN_SUBS_MENU") return sendSubsMenu(ctx);
      if (data === "ADMIN_POSTS_MENU") return sendPostsMenu(ctx);
      if (data === "ADMIN_SETTINGS_MENU") return sendSettingsMenu(ctx);
      if (data === "ADMIN_HELP") return sendAdminHelp(ctx);

      if (data === "ADMIN_WEB_PANEL") {
        const url = createAdminDashboardUrl(ctx.from.id);
        return ctx.reply("🌐 <b>Admin Web Panel</b>\n\n" + url, {
          parse_mode: "HTML",
        });
      }

      /* CREAR SUB MANUAL */
      if (data === "ADMIN_CREATE_SUB") {
        return adminCreateSub_step1_selectChannel(ctx);
      }
      if (data.startsWith("ADMIN_CREATE_SUB_CH_")) {
        const channelId = Number(data.replace("ADMIN_CREATE_SUB_CH_", ""));
        return adminCreateSub_step2_user(ctx, channelId);
      }
      if (data.startsWith("ADMIN_CREATE_SUB_PLAN_")) {
        const planId = data.replace("ADMIN_CREATE_SUB_PLAN_", "");
        return adminCreateSub_step4_confirm(ctx, planId);
      }
      if (data === "ADMIN_CREATE_SUB_CONFIRM") {
        return adminCreateSub_finish(ctx);
      }

      /* PLAN WIZARD */
      if (data === "ADMIN_ADD_PLAN") {
        const session = ensureSession(ctx);
        session.planWizard = { step: "name", draft: {} };

        return safeEdit(
          ctx,
          "🆕 <b>Create new plan</b>\nWrite the name of the plan:",
          { parse_mode: "HTML" }
        );
      }

      /* ASIGNAR CANAL A PLAN */
      if (data === "ADMIN_ASSIGN_PLAN_CHANNEL") {
        return adminAssignPlan_step1_selectPlan(ctx);
      }
      if (data.startsWith("ADMIN_ASSIGN_PLAN_CHOOSEPLAN_")) {
        const shortId = data.replace("ADMIN_ASSIGN_PLAN_CHOOSEPLAN_", "");
        return adminAssignPlan_step2_selectChannel(ctx, shortId);
      }
      if (data.startsWith("ADMIN_ASSIGN_PLAN_DO_")) {
        const rest = data.replace("ADMIN_ASSIGN_PLAN_DO_", "");
        const [shortId, channelId] = rest.split("_");
        return adminAssignPlan_finish(ctx, shortId, Number(channelId));
      }

      /* PAGOS */
      if (data === "PAYMENTS_MENU") {
        const adminUrl = createAdminDashboardUrl(ctx.from.id);

        return safeEdit(
          ctx,
          "💰 <b>Payments and monetization</b>\n\n" +
            "From here you manage Stripe and TON.\n\n" +
            "For advanced settings, open the web panel.",
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🌐 Admin Web Panel", url: adminUrl }],
                [{ text: "⬅️ Back", callback_data: "ADMIN_PANEL_MAIN" }],
              ],
            },
          }
        );
      }
    }

    /* ==================== USER ==================== */

    if (data === "USER_PLANS") return sendUserPlans(ctx);
    if (data === "USER_STATUS") return sendUserStatus(ctx);
    if (data === "USER_BACK_TO_START") return sendUserMainMenu(ctx);
    if (data === "GUIDE") return sendGuide(ctx);
    if (data === "SUPPORT") return sendSupport(ctx);

    if (data === "USER_WEB_PANEL") {
      const url = createUserDashboardUrl(ctx.from.id);
      return ctx.reply("🌐 <b>My VIP Panel</b>\n\n" + url, {
        parse_mode: "HTML",
      });
    }

    if (data === "USER_MANAGE_SUB") {
      return openStripeCustomerPortal(ctx);
    }

    return ctx.answerCbQuery();
  });

  /* ============================================================
     MENSAJES (flows)
  ============================================================= */

  bot.on("message", async (ctx) => {
    const session = ensureSession(ctx);

    /* WIZARD CREAR PLAN */
    if (session.planWizard) {
      const w = session.planWizard;
      const text = ctx.message.text?.trim();
      if (!text) return ctx.reply("Write a valid text.");

      if (w.step === "name") {
        w.draft.name = text;
        w.step = "price";
        return ctx.reply("💶 Enter the plan price:");
      }

      if (w.step === "price") {
        const price = Number(text.replace(",", "."));
        if (isNaN(price) || price <= 0) return ctx.reply("Precio inválido.");
        w.draft.price = price;
        w.step = "currency";
        return ctx.reply("💱 Enter the currency (EUR/USD/USDT/TON):");
      }

      if (w.step === "currency") {
        w.draft.currency = text.toUpperCase();
        w.step = "duration";
        return ctx.reply("🗓 Duration in days:");
      }

      if (w.step === "duration") {
        const days = parseInt(text);
        if (isNaN(days) || days <= 0) return ctx.reply("Duración inválida.");
        w.draft.durationDays = days;

        const plan = await createPlan(w.draft);
        session.planWizard = null;

        return ctx.reply(
          `✅ <b>Plan created</b>\n${plan.name}\n${plan.price} ${plan.currency}\n${plan.durationDays} days`,
          { parse_mode: "HTML" }
        );
      }

      return;
    }

    /* WIZARD CREAR SUB MANUAL */
    if (session.subFlow) {
      const flow = session.subFlow;
      let userId = null;

      if (ctx.message.forward_from) userId = ctx.message.forward_from.id;
      else if (/^\d+$/.test(ctx.message.text))
        userId = Number(ctx.message.text);

      if (!userId)
        return ctx.reply("Forward the user's message or enter their numeric ID.");

      flow.userId = userId;
      return adminCreateSub_step3_choosePlan(ctx);
    }
  });

  /* ============================================================
     ADMIN WIZARDS
  ============================================================= */

  async function adminCreateSub_step1_selectChannel(ctx) {
    const channels = await listVipChannels();
    if (!channels.length) return ctx.reply("There are no VIP channels.");

    return safeEdit(ctx, "📌 Select the VIP channel:", {
      reply_markup: {
        inline_keyboard: channels.map((c) => [
          { text: c.title, callback_data: `ADMIN_CREATE_SUB_CH_${c.id}` },
        ]),
      },
    });
  }

  async function adminCreateSub_step2_user(ctx, channelId) {
    const session = ensureSession(ctx);
    session.subFlow = { channelId };

    return safeEdit(
      ctx,
      "👤 Forward a message from the user or enter their ID:",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "❌ Cancel", callback_data: "ADMIN_BACK_HOME" }],
          ],
        },
      }
    );
  }

  async function adminCreateSub_step3_choosePlan(ctx) {
    const plans = await listPlans();
    if (!plans.length) return ctx.reply("There are no plans.");

    return ctx.reply("📅 Select plan:", {
      reply_markup: {
        inline_keyboard: plans.map((p) => [
          {
            text: `${p.name} (${p.durationDays} days)`,
            callback_data: `ADMIN_CREATE_SUB_PLAN_${p.id || p._id}`,
          },
        ]),
      },
    });
  }

  async function adminCreateSub_step4_confirm(ctx, planId) {
    const session = ensureSession(ctx);
    const flow = session.subFlow;

    const plans = await listPlans();
    const plan =
      plans.find((p) => (p.id || p._id.toString()) === planId) || null;

    if (!plan) return ctx.reply("Plan not found.");

    flow.plan = plan;

    return safeEdit(
      ctx,
      `✔ <b>confirm subscription</b>\n\n` +
        `User: <code>${flow.userId}</code>\n` +
        `Channel: <code>${flow.channelId}</code>\n` +
        `Plan: ${plan.name}\n\n¿Confirm?`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Confirm", callback_data: "ADMIN_CREATE_SUB_CONFIRM" }],
            [{ text: "❌ Cancel", callback_data: "ADMIN_BACK_HOME" }],
          ],
        },
      }
    );
  }

  async function adminCreateSub_finish(ctx) {
    const session = ensureSession(ctx);
    const flow = session.subFlow;

    const sub = await addSubscription(flow.userId, flow.channelId, flow.plan);
    await giveVipAccess(bot, flow.userId, flow.channelId);
    session.subFlow = null;

    return safeEdit(
      ctx,
      `🎉 Subscription created\nUser: <code>${flow.userId}</code>\nExpires: ${new Date(sub.endAt).toLocaleString()}`,
      { parse_mode: "HTML" }
    );
  }

  /* ============================================================
     ASIGNAR CANAL A PLAN
  ============================================================= */
  async function adminAssignPlan_step1_selectPlan(ctx) {
    const plans = await listPlans();
    if (!plans.length) return ctx.reply("There are no plans.");

    const keyboard = plans.map((p) => {
      const id = p.id || p._id.toString();
      return [
        {
          text: p.name,
          callback_data: `ADMIN_ASSIGN_PLAN_CHOOSEPLAN_${id.slice(0, 8)}`,
        },
      ];
    });

    return safeEdit(ctx, "📌 Select plan:", {
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  async function adminAssignPlan_step2_selectChannel(ctx, shortId) {
    const channels = await listVipChannels();
    if (!channels.length) return ctx.reply("There are no plans.");

    const keyboard = channels.map((c) => [
      {
        text: c.title,
        callback_data: `ADMIN_ASSIGN_PLAN_DO_${shortId}_${c.id}`,
      },
    ]);

    return safeEdit(ctx, "🎯 Select channel", {
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  async function adminAssignPlan_finish(ctx, shortId, channelId) {
    const plans = await listPlans();
    const plan =
      plans.find((p) =>
        (p.id || p._id.toString()).startsWith(shortId)
      ) || null;

    if (!plan) return ctx.reply("There are no plans.");

    const planId = plan.id || plan._id.toString();
    await setPlanChannelId(planId, channelId);

    return safeEdit(
      ctx,
      `✔ Channel assigned to <b>${plan.name}</b>\nID: <code>${channelId}</code>`,
      { parse_mode: "HTML" }
    );
  }
};

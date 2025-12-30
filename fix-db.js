// fix-db.js — Corrige suscripciones antiguas con userId numérico

const { connectDB, collections } = require("./db");

(async () => {
  try {
    console.log("🔧 Conectando a MongoDB...");
    await connectDB();

    console.log("🔍 Buscando suscripciones con userId numérico...");

    // Obtiene documentos donde userId es number
    const oldSubs = await collections.subscriptions
      .find({ userId: { $type: "number" } })
      .toArray();

    if (oldSubs.length === 0) {
      console.log("✅ No hay suscripciones antiguas que corregir.");
      process.exit(0);
    }

    console.log(`🔄 Encontradas ${oldSubs.length} suscripciones a corregir.`);

    for (const sub of oldSubs) {
      const newUserId = String(sub.userId);
      const newPlanId = sub.planId ? String(sub.planId) : null;

      await collections.subscriptions.updateOne(
        { _id: sub._id },
        {
          $set: {
            userId: newUserId,
            planId: newPlanId,
          },
        }
      );

      console.log(`✔ Convertida sub ID ${sub._id}: userId ${sub.userId} → "${newUserId}"`);
    }

    console.log("🎉 FIX COMPLETADO: todos los userId ahora son strings.");
    process.exit(0);

  } catch (err) {
    console.error("❌ Error ejecutando fix-db.js:", err);
    process.exit(1);
  }
})();

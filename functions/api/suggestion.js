export async function onRequestPost({ request, env }) {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return reply(503, { error: "خدمة استقبال الاقتراحات لم تُفعّل بعد." });
  }
  if (request.headers.get("Origin") && request.headers.get("Origin") !== new URL(request.url).origin) {
    return reply(403, { error: "طلب غير مسموح." });
  }
  let data;
  try { data = await request.json(); } catch { return reply(400, { error: "بيانات غير صالحة." }); }
  if (typeof data.website === "string" && data.website.trim()) return reply(200, { ok: true });
  const clean = (value, max) => String(value || "").replace(/[<>]/g, "").trim().slice(0, max);
  const type = clean(data.type, 80);
  const section = clean(data.section, 80);
  const message = clean(data.message, 1500);
  const contact = clean(data.contact, 100);
  if (!type || message.length < 8) return reply(400, { error: "اكتب اقتراحًا لا يقل عن 8 أحرف." });
  const text = [
    "اقتراح جديد لموقع MasrPrices",
    "النوع: " + type,
    "القسم: " + (section || "غير محدد"),
    "التفاصيل:",
    message,
    contact ? "وسيلة التواصل: " + contact : "لم يترك وسيلة تواصل"
  ].join("\n");
  try {
    const telegram = await fetch("https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text })
    });
    const result = await telegram.json();
    if (!telegram.ok || !result.ok) return reply(502, { error: "تعذر إرسال الاقتراح إلى تيليجرام. حاول لاحقًا." });
    return reply(200, { ok: true });
  } catch {
    return reply(502, { error: "حدث خطأ في الاتصال. حاول لاحقًا." });
  }
}

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8" }
});

function safeFeedUrl(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
        /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return null;
    return u;
  } catch { return null; }
}

function validItem(item) {
  if (!item || typeof item !== "object") return false;
  const price = Number(item.price_egp);
  return typeof item.product_id === "string" && item.product_id.trim().length > 0 &&
    typeof item.store_name === "string" && item.store_name.trim().length > 0 &&
    Number.isFinite(price) && price > 0 && price <= 100000000 &&
    typeof item.product_url === "string" && /^https:\/\//i.test(item.product_url) &&
    typeof item.source_name === "string" && item.source_name.trim().length > 0;
}

async function logRun(db, sourceName, received, accepted, status, message) {
  await db.prepare(
    "INSERT INTO price_update_log(source_name,items_received,items_accepted,status,message) VALUES(?,?,?,?,?)"
  ).bind(sourceName, received, accepted, status, String(message || "").slice(0, 500)).run();
}

async function updateSource(db, source) {
  const url = safeFeedUrl(source.feed_url);
  if (!url) {
    await logRun(db, source.name, 0, 0, "failed", "رابط التغذية غير آمن أو ليس HTTPS");
    return { source: source.name, status: "failed", accepted: 0 };
  }

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      redirect: "manual",
      headers: { "Accept": "application/json", "User-Agent": "MasrPrices-PriceUpdater/1.0" },
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok || response.status >= 300) throw new Error("HTTP " + response.status);
    const length = Number(response.headers.get("content-length") || 0);
    if (length > 1_000_000) throw new Error("حجم ملف الأسعار أكبر من 1 ميجابايت");
    const data = await response.json();
    if (!data || !Array.isArray(data.items) || data.items.length > 1000) {
      throw new Error("صيغة التغذية غير صحيحة؛ المطلوب كائن يحتوي على items");
    }

    const items = data.items.filter(validItem);
    if (data.items.length && !items.length) throw new Error("لم يتم قبول أي سجل؛ راجع صيغة الأسعار");
    let accepted = 0;
    const checkedAt = new Date().toISOString();

    // لا نعلّم الأسعار القديمة بأنها غير صالحة إلا بعد تنزيل ملف صالح والتحقق من سجلاته.
    if (items.length) {
      await db.prepare("UPDATE offers SET status='stale' WHERE source_id=?").bind(source.id).run();
      for (const item of items) {
        const productId = item.product_id.trim().slice(0, 120);
        const store = item.store_name.trim().slice(0, 120);
        const sourceName = item.source_name.trim().slice(0, 120);
        const productUrl = item.product_url.trim().slice(0, 500);
        const variant = String(item.variant || "").trim().slice(0, 160);
        const region = String(item.region || "").trim().slice(0, 100);
        const price = Number(item.price_egp);
        const product = await db.prepare("SELECT id FROM products WHERE id=?").bind(productId).first();
        if (!product) continue;

        const existing = await db.prepare(
          "SELECT id FROM offers WHERE source_id=? AND product_id=? AND store_name=? AND COALESCE(variant,'')=? LIMIT 1"
        ).bind(source.id, productId, store, variant).first();

        if (existing) {
          await db.prepare(
            "UPDATE offers SET price_egp=?,product_url=?,source_name=?,variant=?,region=?,checked_at=?,status='verified' WHERE id=?"
          ).bind(price, productUrl, sourceName, variant, region, checkedAt, existing.id).run();
        } else {
          await db.prepare(
            "INSERT INTO offers(product_id,store_name,price_egp,product_url,source_name,variant,region,checked_at,status,source_id) VALUES(?,?,?,?,?,?,?,?,?,?)"
          ).bind(productId, store, price, productUrl, sourceName, variant, region, checkedAt, "verified", source.id).run();
        }
        accepted++;
      }
    }

    await db.prepare("UPDATE price_sources SET last_success_at=?,last_status='success',last_message=? WHERE id=?")
      .bind(checkedAt, "تم قبول " + accepted + " عرض", source.id).run();
    await logRun(db, source.name, data.items.length, accepted, "completed", "تحديث آلي ناجح");
    return { source: source.name, status: "success", received: data.items.length, accepted };
  } catch (error) {
    const message = String(error?.message || "خطأ غير معروف").slice(0, 300);
    await db.prepare("UPDATE price_sources SET last_status='failed',last_message=? WHERE id=?")
      .bind(message, source.id).run();
    await logRun(db, source.name, 0, 0, "failed", message);
    return { source: source.name, status: "failed", accepted: 0, message };
  }
}

async function runUpdates(env) {
  if (!env.DB) throw new Error("D1 binding DB غير مربوط");
  const { results } = await env.DB.prepare(
    "SELECT id,name,feed_url FROM price_sources WHERE active=1 ORDER BY name"
  ).all();
  const outcomes = [];
  for (const source of results) outcomes.push(await updateSource(env.DB, source));
  return { sources: results.length, outcomes };
}

export default {
  async scheduled(controller, env, ctx) {
    await runUpdates(env);
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/health") return json({ error: "Not found" }, 404);
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
    return json({ service: "MasrPrices updater", schedule: "daily 03:00 UTC", database: Boolean(env.DB) });
  }
};

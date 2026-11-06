import { onRequest as adminHandler } from "./functions/api/admin.js";
import { onRequestGet as compareHandler } from "./functions/api/compare.js";
import { onRequestPost as suggestionHandler } from "./functions/api/suggestion.js";
import { onRequest as realEstateHandler } from "./functions/api/real-estate.js";
import { onRequest as realEstateAdminHandler } from "./functions/api/real-estate-admin.js";

function secure(response, request) {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Permitted-Cross-Domain-Policies", "none");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("X-DNS-Prefetch-Control", "off");
  headers.set("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' https: data:; connect-src 'self' https:; upgrade-insecure-requests");
  if (new URL(request.url).protocol === "https:") headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return new Response(response.body, {status:response.status,statusText:response.statusText,headers});
}

async function egidStocksHandler(request, env, ctx) {
  const reply = (status, body, cache = "no-store") => new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache }
  });
  const token = String(env.EGID_API_TOKEN || "").trim();
  if (!token) return reply(503, {
    provider: "EGID",
    status: "credentials_required",
    error: "لم يتم ربط بيانات الدخول المعتمدة من EGID بالخادم بعد."
  });
  const mode = String(env.EGID_FEED_MODE || "delayed").toLowerCase() === "live" ? "live" : "delayed";
  const path = mode === "live"
    ? "/api/Feed/GetAllMarketWatch"
    : "/api/DelayedFeed/getAllMarketWatch";
  const upstreamUrl = "https://ticker.egidegypt.com" + path;
  const cacheKey = new Request(new URL("/__cache/egid-market-watch-" + mode, request.url).toString(), { method: "GET" });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return new Response(cached.body, { status: cached.status, headers: cached.headers });
  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: { "Accept": "application/json", "Authorization": "Bearer " + token },
      signal: AbortSignal.timeout(12000)
    });
  } catch {
    return reply(502, { provider: "EGID", status: "upstream_unavailable", error: "تعذر الاتصال بواجهة بيانات EGID." });
  }
  if (!upstream.ok) {
    return reply(upstream.status === 401 || upstream.status === 403 ? 502 : 503, {
      provider: "EGID",
      status: upstream.status === 401 || upstream.status === 403 ? "authentication_or_permission_error" : "provider_error",
      error: "رفضت واجهة EGID الطلب أو تعذر الحصول على البيانات. تحقق من صلاحية الحساب ونوع البيانات المسموح بها."
    });
  }
  let data;
  try { data = await upstream.json(); }
  catch { return reply(502, { provider: "EGID", status: "invalid_response", error: "استجابة EGID ليست بصيغة JSON صالحة." }); }
  const body = {
    provider: "EGID",
    mode,
    receivedAt: new Date().toISOString(),
    data
  };
  const response = new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=5, stale-while-revalidate=10" }
  });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

async function rateLimit(binding, request, scope) {
  if (!binding || typeof binding.limit !== "function") {
    return json(503, { error: "حماية الطلبات غير مهيأة على الخادم." });
  }
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const result = await binding.limit({ key: scope + ":" + ip });
  if (!result.success) return json(429, { error: "طلبات كثيرة خلال وقت قصير. انتظر دقيقة ثم حاول مجددًا." });
  return null;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // Reject malformed API methods before dispatch; static assets remain read-only through GET/HEAD.
    if (url.pathname.startsWith("/api/") && !["GET","POST"].includes(request.method)) {
      return secure(json(405, { error: "طريقة الطلب غير مدعومة." }), request);
    }
    if (!url.pathname.startsWith("/api/") && !["GET","HEAD"].includes(request.method)) {
      return secure(json(405, { error: "طريقة الطلب غير مدعومة." }), request);
    }

    if (url.pathname === "/api/admin") {
      const blocked = await rateLimit(env.ADMIN_RATE_LIMITER, request, "admin");
      if (blocked) return secure(blocked, request);
      return secure(await adminHandler({ request, env, ctx, params: {} }), request);
    }

    if (url.pathname === "/api/stocks") {
      if (request.method !== "GET") return secure(json(405, { error: "طريقة الطلب غير مدعومة." }), request);
      const blocked = await rateLimit(env.PUBLIC_READ_RATE_LIMITER, request, "stocks");
      if (blocked) return secure(blocked, request);
      return secure(await egidStocksHandler(request, env, ctx), request);
    }

    if (url.pathname === "/api/compare") {
      if (request.method !== "GET") return secure(json(405, { error: "طريقة الطلب غير مدعومة." }), request);
      const blocked = await rateLimit(env.PUBLIC_READ_RATE_LIMITER, request, "compare");
      if (blocked) return secure(blocked, request);
      return secure(await compareHandler({ request, env, ctx, params: {} }), request);
    }

    if (url.pathname === "/api/real-estate") {
      const binding = request.method === "POST" ? env.PUBLIC_WRITE_RATE_LIMITER : env.PUBLIC_READ_RATE_LIMITER;
      const blocked = await rateLimit(binding, request, "real-estate-" + request.method.toLowerCase());
      if (blocked) return secure(blocked, request);
      return secure(await realEstateHandler({ request, env, ctx, params: {} }), request);
    }

    if (url.pathname === "/api/real-estate-admin") {
      const blocked = await rateLimit(env.ADMIN_RATE_LIMITER, request, "real-estate-admin");
      if (blocked) return secure(blocked, request);
      return secure(await realEstateAdminHandler({ request, env, ctx, params: {} }), request);
    }

    if (url.pathname === "/api/suggestion") {
      if (request.method !== "POST") return secure(json(405, { error: "طريقة الطلب غير مدعومة." }), request);
      const blocked = await rateLimit(env.SUGGESTION_RATE_LIMITER, request, "suggestion");
      if (blocked) return secure(blocked, request);
      return secure(await suggestionHandler({ request, env, ctx, params: {} }), request);
    }

    return secure(await env.ASSETS.fetch(request), request);
  }
};

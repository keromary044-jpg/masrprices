import { onRequest as adminHandler } from "./functions/api/admin.js";
import { onRequestGet as compareHandler } from "./functions/api/compare.js";
import { onRequestPost as suggestionHandler } from "./functions/api/suggestion.js";
import { onRequest as realEstateHandler } from "./functions/api/real-estate.js";
import { onRequest as realEstateAdminHandler } from "./functions/api/real-estate-admin.js";

function secure(response, request) {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' https: data:; connect-src 'self' https:; upgrade-insecure-requests");
  if (new URL(request.url).protocol === "https:") headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return new Response(response.body, {status:response.status,statusText:response.statusText,headers});
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

    if (url.pathname === "/api/admin") {
      const blocked = await rateLimit(env.ADMIN_RATE_LIMITER, request, "admin");
      if (blocked) return secure(blocked, request);
      return secure(await adminHandler({ request, env, ctx, params: {} }), request);
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

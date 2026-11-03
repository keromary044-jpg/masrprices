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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/admin") {
      return secure(await adminHandler({ request, env, ctx, params: {} }), request);
    }

    if (url.pathname === "/api/compare") {
      if (request.method !== "GET") return json(405, { error: "طريقة الطلب غير مدعومة." });
      return secure(await compareHandler({ request, env, ctx, params: {} }), request);
    }

    if (url.pathname === "/api/real-estate") {
      return secure(await realEstateHandler({ request, env, ctx, params: {} }), request);
    }

    if (url.pathname === "/api/real-estate-admin") {
      return secure(await realEstateAdminHandler({ request, env, ctx, params: {} }), request);
    }

    if (url.pathname === "/api/suggestion") {
      if (request.method !== "POST") return json(405, { error: "طريقة الطلب غير مدعومة." });
      return secure(await suggestionHandler({ request, env, ctx, params: {} }), request);
    }

    return secure(await env.ASSETS.fetch(request), request);
  }
};

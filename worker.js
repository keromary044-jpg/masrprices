import { onRequest as adminHandler } from "./functions/api/admin.js";
import { onRequestGet as compareHandler } from "./functions/api/compare.js";
import { onRequestPost as suggestionHandler } from "./functions/api/suggestion.js";

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
      return adminHandler({ request, env, ctx, params: {} });
    }

    if (url.pathname === "/api/compare") {
      if (request.method !== "GET") return json(405, { error: "طريقة الطلب غير مدعومة." });
      return compareHandler({ request, env, ctx, params: {} });
    }

    if (url.pathname === "/api/suggestion") {
      if (request.method !== "POST") return json(405, { error: "طريقة الطلب غير مدعومة." });
      return suggestionHandler({ request, env, ctx, params: {} });
    }

    return env.ASSETS.fetch(request);
  }
};

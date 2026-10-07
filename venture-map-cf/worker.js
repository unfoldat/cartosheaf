// Cloudflare Workers + KV 버전 (무료 플랜). server.js와 같은 API.
import template from "./seed/template.json";
import sticker from "./seed/sticker-workshop.json";

const SEEDS = { template, "sticker-workshop": sticker };
const idOk = (id) => /^[a-z0-9][a-z0-9-]{0,60}$/.test(id);
const json = (obj, code = 200) => new Response(JSON.stringify(obj), { status: code, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const key = (id) => "p:" + id;

async function ensureSeed(kv) {
  const { keys } = await kv.list({ prefix: "p:", limit: 1 });
  if (keys.length) return;
  for (const [id, d] of Object.entries(SEEDS)) await kv.put(key(id), JSON.stringify(d));
}
async function sha(s) { return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))); }
async function authed(req, pw) {
  const h = req.headers.get("Authorization") || "";
  if (!h.startsWith("Basic ")) return false;
  let t; try { t = new TextDecoder().decode(Uint8Array.from(atob(h.slice(6)), (c) => c.charCodeAt(0))); } catch { return false; }
  const a = await sha(t.slice(t.indexOf(":") + 1)), b = await sha(pw);
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
async function newId(kv, name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "project";
  let id = base, n = 2;
  while (await kv.get(key(id))) id = `${base}-${n++}`;
  return id;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), p = url.pathname, kv = env.DATA;
    if (p === "/healthz") return json({ ok: true });
    if (!env.APP_PASSWORD) return new Response("APP_PASSWORD 비밀번호를 먼저 설정하세요", { status: 503 });
    if (!(await authed(req, env.APP_PASSWORD)))
      return new Response("비밀번호가 필요합니다", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="venture-map", charset="UTF-8"' } });
    if (!p.startsWith("/api/")) return env.ASSETS.fetch(req);
    try {
      await ensureSeed(kv);
      if (req.method === "GET" && p === "/api/projects") {
        const { keys } = await kv.list({ prefix: "p:" });
        const list = (await Promise.all(keys.map(async (k) => { const d = await kv.get(k.name, "json"); return d && { id: k.name.slice(2), name: d.name, isTemplate: !!d.isTemplate, updatedAt: d.updatedAt }; }))).filter(Boolean);
        return json(list);
      }
      const m = p.match(/^\/api\/projects\/([a-z0-9-]+)$/);
      if (m && idOk(m[1])) {
        if (req.method === "GET") { const d = await kv.get(key(m[1]), "json"); return d ? json(d) : json({ error: "없음" }, 404); }
        if (req.method === "PUT") {
          const text = await req.text(); if (text.length > 5e6) return json({ error: "too large" }, 413);
          const d = JSON.parse(text || "{}"); d.updatedAt = new Date().toISOString();
          await kv.put(key(m[1]), JSON.stringify(d)); return json({ ok: true, updatedAt: d.updatedAt });
        }
      }
      if (req.method === "POST" && p === "/api/projects") {
        const { name, from, mode } = await req.json();
        const src = name && idOk(from || "") ? await kv.get(key(from), "json") : null;
        if (!src) return json({ error: "이름과 원본이 필요합니다" }, 400);
        const id = await newId(kv, name), d = structuredClone(src);
        d.name = name; d.isTemplate = false; d.createdAt = new Date().toISOString();
        if (mode !== "all") {
          d.hypotheses = []; d.evidence = []; d.decisions = []; d.currentStage = d.stages[0].id;
          d.stages.forEach((s) => s.exit.forEach((e) => (e.done = false)));
        }
        await kv.put(key(id), JSON.stringify(d)); return json({ id });
      }
      return json({ error: "not found" }, 404);
    } catch (e) { return json({ error: String(e.message || e) }, 500); }
  },
};

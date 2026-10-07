// 설치할 패키지 없음. 실행: node server.js  → http://localhost:3000
// 클라우드용 환경변수: PORT, HOST(기본 127.0.0.1, 클라우드는 0.0.0.0), DATA_DIR(저장 폴더), APP_PASSWORD(설정하면 비밀번호 필요)
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const PASSWORD = process.env.APP_PASSWORD || "";
const ROOT = __dirname, DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, "data", "projects");
fs.mkdirSync(DIR, { recursive: true });
// 처음 실행 시 저장 폴더가 비어 있으면 기본 프로젝트(템플릿·예시)를 복사
const SEED = path.join(ROOT, "data", "projects");
if (SEED !== DIR && fs.existsSync(SEED) && !fs.readdirSync(DIR).some((f) => f.endsWith(".json")))
  for (const f of fs.readdirSync(SEED)) if (f.endsWith(".json")) fs.copyFileSync(path.join(SEED, f), path.join(DIR, f));
const safeEq = (a, b) => { const x = crypto.createHash("sha256").update(a).digest(), y = crypto.createHash("sha256").update(b).digest(); return crypto.timingSafeEqual(x, y); };
const authed = (req) => { if (!PASSWORD) return true; const h = req.headers.authorization || ""; if (!h.startsWith("Basic ")) return false; const t = Buffer.from(h.slice(6), "base64").toString("utf8"); return safeEq(t.slice(t.indexOf(":") + 1), PASSWORD); };

const idOk = (id) => /^[a-z0-9][a-z0-9-]{0,60}$/.test(id);
const file = (id) => path.join(DIR, id + ".json");
const read = (id) => JSON.parse(fs.readFileSync(file(id), "utf8"));
const write = (id, obj) => { const tmp = file(id) + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(obj, null, 2)); fs.renameSync(tmp, file(id)); };
const send = (res, code, body, type = "application/json; charset=utf-8") => { res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" }); res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
const body = (req) => new Promise((ok, no) => { let s = ""; req.on("data", (c) => { s += c; if (s.length > 5e6) no(new Error("too large")); }); req.on("end", () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { no(e); } }); });
const slug = (name) => { const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project"; let id = base, n = 2; while (fs.existsSync(file(id))) id = `${base}-${n++}`; return id; };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const p = url.pathname;
    if (p === "/healthz") return send(res, 200, { ok: true });
    if (!authed(req)) { res.writeHead(401, { "WWW-Authenticate": 'Basic realm="venture-map", charset="UTF-8"' }); return res.end("비밀번호가 필요합니다"); }
    if (p === "/favicon.ico") { res.writeHead(204); return res.end(); }
    if (req.method === "GET" && (p === "/" || p === "/index.html")) return send(res, 200, fs.readFileSync(path.join(ROOT, "index.html")), "text/html; charset=utf-8");
    if (req.method === "GET" && p === "/api/projects") {
      const list = fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => { const d = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")); return { id: f.slice(0, -5), name: d.name, isTemplate: !!d.isTemplate, updatedAt: d.updatedAt }; });
      return send(res, 200, list);
    }
    let m = p.match(/^\/api\/projects\/([a-z0-9-]+)$/);
    if (m && idOk(m[1])) {
      if (req.method === "GET") return fs.existsSync(file(m[1])) ? send(res, 200, read(m[1])) : send(res, 404, { error: "없음" });
      if (req.method === "PUT") { const d = await body(req); d.updatedAt = new Date().toISOString(); write(m[1], d); return send(res, 200, { ok: true, updatedAt: d.updatedAt }); }
    }
    // 복제: { name, from, mode: "structure"(구조만) | "all"(전체) }
    if (req.method === "POST" && p === "/api/projects") {
      const { name, from, mode } = await body(req);
      if (!name || !idOk(from) || !fs.existsSync(file(from))) return send(res, 400, { error: "이름과 원본이 필요합니다" });
      const src = read(from), id = slug(name);
      const d = JSON.parse(JSON.stringify(src));
      d.name = name; d.isTemplate = false; d.createdAt = new Date().toISOString();
      if (mode !== "all") {
        d.hypotheses = []; d.evidence = []; d.decisions = []; d.currentStage = d.stages[0].id;
        d.stages.forEach((s) => s.exit.forEach((e) => (e.done = false)));
      }
      write(id, d); return send(res, 200, { id });
    }
    send(res, 404, { error: "not found" });
  } catch (e) { send(res, 500, { error: String(e.message || e) }); }
}).listen(PORT, HOST, () => console.log(`열기: http://localhost:${PORT}  (종료: Ctrl+C)${PASSWORD ? "" : HOST !== "127.0.0.1" ? "  ⚠ APP_PASSWORD 없이 외부에 열려 있음" : ""}`));

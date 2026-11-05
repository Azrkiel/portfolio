"use strict";
const http = require("node:http");
const { readFileSync, mkdirSync } = require("node:fs");
const { resolve, dirname, extname, sep } = require("node:path");
const { createHash } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const model = require("./glider-model.js");

function createPortfolioServer({ dbPath = resolve(__dirname, "data/flights.sqlite"), rateLimit = 20 } = {}) {
  if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS flights (
      fingerprint TEXT PRIMARY KEY, pilot TEXT NOT NULL, spec TEXT NOT NULL,
      distance_m REAL NOT NULL, model TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS flight_ranking ON flights(model, distance_m DESC, created_at);`);
  const insert = db.prepare(`INSERT INTO flights VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(fingerprint) DO NOTHING`);
  const top = db.prepare(`SELECT pilot, spec, distance_m, created_at FROM flights
    WHERE model = ? ORDER BY distance_m DESC, created_at, fingerprint LIMIT 10`);
  const trim = db.prepare(`DELETE FROM flights WHERE fingerprint NOT IN
    (SELECT fingerprint FROM flights ORDER BY distance_m DESC, created_at, fingerprint LIMIT 5000)`);
  const traffic = new Map();
  const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
    ".png": "image/png", ".jpg": "image/jpeg", ".pdf": "application/pdf", ".txt": "text/plain" };
  const publicFiles = new Set(["/index.html", "/styles.css", "/main.js", "/glider-model.js"]);
  const assetsRoot = resolve(__dirname, "assets") + sep;

  function json(res, status, body, extra = {}) {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra });
    res.end(JSON.stringify(body));
  }
  function checkRate(req, res) {
    const now = Date.now();
    // Use only Fly's proxy-set address on Fly; never trust arbitrary X-Forwarded-For headers.
    const address = process.env.FLY_APP_NAME ? req.headers["fly-client-ip"] || req.socket.remoteAddress : req.socket.remoteAddress;
    for (const [key, value] of traffic) if (now - value.since >= 60000) traffic.delete(key);
    let bucket = traffic.get(address);
    if (!bucket) {
      if (traffic.size >= 10000) { json(res, 503, { error: "Flight desk is busy. Try again shortly." }); return false; }
      bucket = { since: now, count: 0 }; traffic.set(address, bucket);
    }
    if (++bucket.count > rateLimit) {
      json(res, 429, { error: "Too many launches. Try again in a minute." }, { "Retry-After": "60" }); return false;
    }
    return true;
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    try {
      const url = new URL(req.url, "http://localhost");
      let path;
      try { path = decodeURIComponent(url.pathname); }
      catch { return json(res, 400, { error: "Invalid URL." }); }

      if (path === "/api/leaderboard") {
        if (req.method !== "GET") return json(res, 405, { error: "Use GET." }, { Allow: "GET" });
        const entries = top.all(model.version).map((row, i) => ({ ...row, rank: i + 1, spec: JSON.parse(row.spec) }));
        return json(res, 200, { model: model.version, entries });
      }
      if (path === "/api/flights") {
        if (req.method !== "POST") return json(res, 405, { error: "Use POST." }, { Allow: "POST" });
        if (req.headers.origin) {
          let origin;
          try { origin = new URL(req.headers.origin); } catch { return json(res, 403, { error: "Use this site's flight desk." }); }
          if (!["http:", "https:"].includes(origin.protocol) || origin.host !== req.headers.host) {
            return json(res, 403, { error: "Use this site's flight desk." });
          }
        }
        if (!checkRate(req, res)) return;
        if (req.headers["content-type"]?.split(";")[0].trim() !== "application/json") {
          return json(res, 415, { error: "Send JSON." });
        }
        if (Number(req.headers["content-length"]) > 2048) return json(res, 413, { error: "Flight request is too large." });
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 2048) { json(res, 413, { error: "Flight request is too large." }); return; }
          chunks.push(chunk);
        }
        let data, spec, result, pilot;
        try {
          data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          if (!data || typeof data !== "object" || Array.isArray(data) || Object.keys(data).length !== 2 ||
              !Object.hasOwn(data, "pilot") || !Object.hasOwn(data, "spec")) throw new Error("Send a pilot alias and wing specifications only.");
          if (typeof data.pilot !== "string") throw new Error("Enter a pilot alias.");
          pilot = data.pilot.trim().normalize("NFKC");
          if (!/^[\p{L}\p{N} _.'-]{1,24}$/u.test(pilot)) throw new Error("Use 1–24 letters, numbers, spaces, or . _ ' - for your alias.");
          spec = model.validate(data.spec);
          result = model.evaluate(spec);
        } catch (error) { return json(res, 400, { error: error instanceof SyntaxError ? "Invalid JSON." : error.message }); }
        const serialized = JSON.stringify(spec);
        const fingerprint = createHash("sha256").update(`${model.version}:${pilot.toLowerCase()}:${serialized}`).digest("hex");
        const created = new Date().toISOString();
        db.exec("BEGIN");
        try { insert.run(fingerprint, pilot, serialized, result.distance_m, model.version, created); trim.run(); db.exec("COMMIT"); }
        catch (error) { db.exec("ROLLBACK"); throw error; }
        return json(res, 201, { pilot, spec, result });
      }
      if (path.startsWith("/api/")) return json(res, 404, { error: "Unknown route." });
      if (!["GET", "HEAD"].includes(req.method)) return json(res, 405, { error: "Use GET." }, { Allow: "GET, HEAD" });
      if (path === "/") path = "/index.html";
      let file;
      if (publicFiles.has(path)) file = resolve(__dirname, path.slice(1));
      else if (path.startsWith("/assets/")) {
        file = resolve(__dirname, path.slice(1));
        if (!file.startsWith(assetsRoot) || !Object.hasOwn(mime, extname(file))) return json(res, 404, { error: "Not found." });
      } else return json(res, 404, { error: "Not found." });
      let content;
      try { content = readFileSync(file); } catch { return json(res, 404, { error: "Not found." }); }
      res.writeHead(200, { "Content-Type": `${mime[extname(file)] || "application/octet-stream"}${[".js", ".css", ".html", ".txt"].includes(extname(file)) ? "; charset=utf-8" : ""}`,
        "Content-Length": content.length, "Cache-Control": "no-cache" });
      res.end(req.method === "HEAD" ? undefined : content);
    } catch (error) {
      if (req.destroyed || res.destroyed) return;
      console.error("Flight desk error:", error.message);
      if (!res.headersSent) json(res, 503, { error: "Flight desk unavailable. Try again shortly." });
      else res.end();
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  return { server, close: async () => {
    await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
    db.close();
  } };
}

if (require.main === module) {
  const app = createPortfolioServer({ dbPath: process.env.GLIDER_DB_PATH || resolve(__dirname, "data/flights.sqlite") });
  const port = Number(process.env.PORT || 8000);
  const host = process.env.HOST || "127.0.0.1";
  app.server.listen(port, host, () => console.log(`Portfolio flight desk: http://${host}:${port}`));
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => app.close().then(() => process.exit(0)));
}
module.exports = { createPortfolioServer };

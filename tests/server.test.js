"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { createPortfolioServer } = require("../server.js");
const model = require("../glider-model.js");

async function start(dbPath, options = {}) {
  const app = createPortfolioServer({ dbPath, ...options });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${app.server.address().port}`;
  return { ...app, url };
}
const post = (app, data, headers = {}) => fetch(app.url + "/api/flights", {
  method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(data),
});

test("HTTP scoring is authoritative, deduplicated, ranked and durable across restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "portfolio-flight-"));
  const dbPath = join(dir, "flights.sqlite");
  let app = await start(dbPath);
  try {
    assert.deepEqual((await (await fetch(app.url + "/api/leaderboard")).json()).entries, []);
    const flight = { pilot: "Paper Pilot", spec: model.defaults };
    let response = await post(app, flight);
    assert.equal(response.status, 201);
    const saved = await response.json();
    assert.equal(saved.result.distance_m, model.evaluate(model.defaults).distance_m);
    assert.deepEqual(saved.spec, model.defaults);
    assert.equal((await post(app, flight)).status, 201);
    assert.equal((await post(app, { ...flight, pilot: "paper pilot" })).status, 201);
    assert.equal((await post(app, { pilot: "Second", spec: { ...model.defaults, span_m: 0.8 } })).status, 201);
    let entries = (await (await fetch(app.url + "/api/leaderboard")).json()).entries;
    assert.equal(entries.length, 2);
    assert.ok(entries[0].distance_m >= entries[1].distance_m);
    await app.close();
    app = await start(dbPath);
    entries = (await (await fetch(app.url + "/api/leaderboard")).json()).entries;
    assert.equal(entries.length, 2);
    assert.deepEqual(entries[0].spec, model.defaults);
  } finally { await app.close(); rmSync(dir, { recursive: true, force: true }); }
});

test("rejects malformed input, client scores, cross-origin writes and oversized requests", async () => {
  const app = await start(":memory:");
  try {
    for (const data of [null, {}, { pilot: "", spec: model.defaults },
      { pilot: "x".repeat(25), spec: model.defaults }, { pilot: "<script>", spec: model.defaults },
      { pilot: "Valid", spec: { ...model.defaults, span_m: 500 } },
      { pilot: "Valid", spec: model.defaults, distance_m: 99999 }]) {
      assert.equal((await post(app, data)).status, 400);
    }
    assert.equal((await post(app, { pilot: "Valid", spec: model.defaults }, { Origin: "https://other.example" })).status, 403);
    assert.equal((await post(app, { pilot: "Valid", spec: model.defaults }, { Origin: app.url })).status, 201);
    assert.equal((await post(app, { pilot: "Valid", spec: model.defaults }, { "Content-Type": "text/plain" })).status, 415);
    assert.equal((await post(app, { padding: "x".repeat(5000) })).status, 413);
    const bad = await fetch(app.url + "/api/flights", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    assert.equal(bad.status, 400);
    assert.equal((await fetch(app.url + "/api/flights", { method: "DELETE" })).status, 405);
  } finally { await app.close(); }
});

test("serves public assets without exposing source, database or encoded paths", async () => {
  const app = await start(":memory:");
  try {
    const page = await fetch(app.url);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /glider-model.js/);
    for (const path of ["/server.js", "/tests/server.test.js", "/data/flights.sqlite", "/.git/config", "/assets/%2e%2e/server.js", "/%ZZ"]) {
      const response = await fetch(app.url + path);
      assert.ok([400, 404].includes(response.status), `${path}: ${response.status}`);
    }
    assert.equal((await fetch(app.url + "/glider-model.js")).status, 200);
    const thumb = await fetch(app.url + "/assets/projects/signline.webp");
    assert.equal(thumb.status, 200);
    assert.equal(thumb.headers.get("content-type"), "image/webp");
  } finally { await app.close(); }
});

test("bounds flight submissions per remote address", async () => {
  const app = await start(":memory:", { rateLimit: 2 });
  try {
    const flight = { pilot: "Pilot", spec: model.defaults };
    assert.equal((await post(app, flight)).status, 201);
    assert.equal((await post(app, flight)).status, 201);
    const limited = await post(app, flight);
    assert.equal(limited.status, 429);
    assert.ok(limited.headers.get("retry-after"));
    assert.equal((await fetch(app.url + "/api/leaderboard")).status, 200);
  } finally { await app.close(); }
});

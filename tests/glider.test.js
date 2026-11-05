"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const model = require("../glider-model.js");

test("polyhedral geometry follows Mirum's flat center and effective tip angle", () => {
  const spec = { ...model.defaults };
  const root = model.wingStation(spec, 0);
  const kink = model.wingStation(spec, 0.55);
  const tip = model.wingStation(spec, 1);
  assert.equal(root.z, 0);
  assert.equal(kink.z, 0);
  assert.ok(Math.abs(tip.z - spec.span_m / 2 * Math.tan(spec.dihedral_deg * Math.PI / 180)) < 1e-12);
  assert.ok(Math.abs(tip.chord - spec.root_chord_m * spec.taper) < 1e-12);
});

test("flight uses SI wing area, fixed height and a deterministic drag estimate", () => {
  const result = model.evaluate(model.defaults);
  const area = model.defaults.span_m * model.defaults.root_chord_m * (1 + model.defaults.taper) / 2;
  assert.ok(Math.abs(result.area_m2 - area) < 1e-12);
  assert.equal(result.launch_height_m, 10);
  assert.equal(result.distance_m, Math.round(result.glide_ratio * 10 * 10) / 10);
  assert.ok(result.distance_m > 30 && result.distance_m < 200);
  assert.ok(result.speed_m_s > 0 && result.mass_g > 0);
  assert.deepEqual(result, model.evaluate({ ...model.defaults }));
  assert.notEqual(result.distance_m, model.evaluate({ ...model.defaults, span_m: 0.8 }).distance_m);
});

test("rejects forged scores, type coercion and invalid physical inputs", () => {
  for (const spec of [null, [], {}, { ...model.defaults, distance_m: 99999 },
    { ...model.defaults, span_m: "1.2" }, { ...model.defaults, span_m: Infinity },
    { ...model.defaults, taper: NaN }, { ...model.defaults, dihedral_deg: -3 },
    { ...model.defaults, root_chord_m: 0.5 }]) {
    assert.throws(() => model.evaluate(spec), /design|span|taper|dihedral|chord|spec/i);
  }
});

test("screens wings beyond Mirum's aspect-ratio limit", () => {
  assert.throws(() => model.evaluate({ ...model.defaults, span_m: 1.4, root_chord_m: 0.1, taper: 0.35 }), /aspect ratio/i);
});

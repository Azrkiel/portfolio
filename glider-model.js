/* Compact portfolio model. Geometry adapted from Azrkiel/Mirum (MIT).
   See assets/MIRUM-LICENSE.txt. This is not Mirum's aerodynamic solver. */
(function (root, factory) {
  const model = factory();
  if (typeof module === "object" && module.exports) module.exports = model;
  else root.GliderModel = model;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  const version = "compact-v1";
  const limits = Object.freeze({
    span_m: Object.freeze([0.60, 1.40]),
    root_chord_m: Object.freeze([0.10, 0.22]),
    taper: Object.freeze([0.35, 1.00]),
    dihedral_deg: Object.freeze([3, 12]),
  });
  const defaults = Object.freeze({ span_m: 1.10, root_chord_m: 0.16, taper: 0.60, dihedral_deg: 6 });
  const rad = (x) => x * Math.PI / 180;

  function validate(spec) {
    if (!spec || typeof spec !== "object" || Array.isArray(spec) ||
        Object.keys(spec).length !== 4 || Object.keys(spec).some((key) => !Object.hasOwn(limits, key))) {
      throw new Error("A design needs exactly four wing specifications.");
    }
    const clean = {};
    for (const [key, [min, max]] of Object.entries(limits)) {
      if (typeof spec[key] !== "number" || !Number.isFinite(spec[key]) || spec[key] < min || spec[key] > max) {
        throw new Error(`${key} must be a number between ${min} and ${max}.`);
      }
      clean[key] = spec[key];
    }
    return clean;
  }

  function wingStation(spec, fraction) {
    // Mirum's polyhedral center is flat; the outer 45% rises to the effective tip height.
    const chord = spec.root_chord_m * (1 - (1 - spec.taper) * fraction);
    const y = fraction * spec.span_m / 2;
    return {
      chord, y,
      x: 0.25 * (spec.root_chord_m - chord) + y * Math.tan(rad(4)),
      z: spec.span_m / 2 * Math.tan(rad(spec.dihedral_deg)) * Math.max(0, (fraction - 0.55) / 0.45),
      twist: rad(2 - 2 * fraction),
    };
  }

  function evaluate(input) {
    const spec = validate(input);
    const area = spec.span_m * spec.root_chord_m * (1 + spec.taper) / 2;
    const aspect = spec.span_m ** 2 / area;
    if (aspect > 14) throw new Error("Aspect ratio exceeds 14. Increase chord or taper, or shorten the span.");
    // Educational parabolic drag polar: CD = CD0 + CL^2 / (pi * e * AR).
    // CD0 and span efficiency are estimates; trim and structural feasibility are not solved.
    const efficiency = 0.82 * (1 - 0.2 * (spec.taper - 0.5) ** 2) * Math.cos(rad(spec.dihedral_deg)) ** 2;
    const induced = 1 / (Math.PI * efficiency * aspect);
    const cd0 = 0.035;
    const cl = Math.min(0.85, Math.sqrt(cd0 / induced));
    const glideRatio = cl / (cd0 + induced * cl ** 2);
    const mass = 0.110 + 0.30 * area;
    return {
      model: version,
      launch_height_m: 10,
      distance_m: Math.round(10 * glideRatio * 10) / 10,
      glide_ratio: glideRatio,
      area_m2: area,
      aspect_ratio: aspect,
      mass_g: Math.round(mass * 1000),
      speed_m_s: Math.round(Math.sqrt(2 * mass * 9.81 / (1.225 * area * cl)) * 100) / 100,
    };
  }
  return Object.freeze({ version, limits, defaults, validate, wingStation, evaluate });
});

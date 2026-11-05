/* Kevin Jiang — portfolio runtime. No framework, no build step. */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const glider = window.GliderModel;
  let wingSpec = { ...glider.defaults };

  /* ───────────────── theme (invert) ───────────────── */
  const setTheme = (paper) => {
    if (paper) root.dataset.theme = "paper";
    else delete root.dataset.theme;
    try { localStorage.setItem("kj-theme", paper ? "paper" : "blue"); } catch (e) { /* ignore */ }
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = paper ? "#f1efe8" : "#1212e6";
    sigil && sigil.repaint();
  };
  const toggleTheme = () => setTheme(root.dataset.theme !== "paper");
  $("#invert")?.addEventListener("click", toggleTheme);

  /* ───────────────── nav ───────────────── */
  const nav = $(".nav");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const menuBtn = $("#menuBtn");
  const menu = $("#mobileMenu");
  menuBtn?.addEventListener("click", () => {
    const open = menu.hidden;
    menu.hidden = !open;
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.textContent = open ? "Close" : "Menu";
  });
  $$("#mobileMenu a").forEach((a) =>
    a.addEventListener("click", () => {
      menu.hidden = true;
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.textContent = "Menu";
    })
  );

  // current-section underline
  const navLinks = $$(".nav-side a[href^='#']");
  const sectionObs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        navLinks.forEach((a) => a.classList.toggle("is-current", a.getAttribute("href") === "#" + e.target.id));
      });
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );
  $$("main section[id]").forEach((s) => sectionObs.observe(s));

  /* ───────────────── reveal + counters ───────────────── */
  const countUp = (el) => {
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || "";
    if (reduceMotion || !target) return;
    const start = performance.now();
    const dur = 1400;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const v = Math.round(target * (1 - Math.pow(1 - t, 3)));
      el.textContent = v.toLocaleString("en-US") + suffix;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const revealObs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        $$("[data-count]", e.target).forEach(countUp);
        setTimeout(() => (e.target.style.transitionDelay = ""), 1400);
        revealObs.unobserve(e.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
  );
  $$(".reveal").forEach((el, i) => {
    // light stagger for siblings revealed together
    el.style.transitionDelay = `${Math.min(i % 6, 5) * 60}ms`;
    revealObs.observe(el);
  });

  /* ───────────────── install box ───────────────── */
  const cmdEl = $("#installCmd");
  const copyBtn = $("#copyBtn");
  let copyValue = "fac3cq@virginia.edu";
  $$(".install-tabs button").forEach((b) =>
    b.addEventListener("click", () => {
      $$(".install-tabs button").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      cmdEl.innerHTML = `<span class="prompt">$</span> ${escapeHtml(b.dataset.cmd)}`;
      copyValue = b.dataset.copy;
    })
  );
  const copy = async (text, btn) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (err) { /* ignore */ }
      ta.remove();
    }
    if (btn) {
      btn.classList.add("is-done");
      setTimeout(() => btn.classList.remove("is-done"), 1200);
    }
  };
  copyBtn?.addEventListener("click", () => copy(copyValue, copyBtn));

  /* ───────────────── project filters ───────────────── */
  const filterBtns = $$(".filter");
  const cards = $$(".card:not([data-more])");
  const moreCard = $(".card-more");
  const cols = () => getComputedStyle($(".cards")).gridTemplateColumns.split(" ").length;
  // size the archive card to exactly fill whatever is left of the last row
  const fitMore = () => {
    if (!moreCard) return;
    const n = cols();
    const used = cards.reduce((acc, c) => (c.classList.contains("is-hidden") ? acc : acc + (c.classList.contains("card-wide") ? n : 1)), 0);
    const left = (n - (used % n)) % n;
    moreCard.style.gridColumn = `span ${left || n}`;
  };
  window.addEventListener("resize", fitMore);
  const applyFilter = (f) => {
    filterBtns.forEach((b) => {
      const on = b.dataset.filter === f;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    cards.forEach((c) => {
      const show = f === "all" || c.dataset.tags.split(" ").includes(f);
      c.classList.toggle("is-hidden", !show);
      // wide cards collapse to normal when filtering so the grid stays tidy
      c.classList.toggle("card-wide", show && f === "all" && c.dataset.wide === "1");
      if (show) c.classList.add("is-in");
    });
    fitMore();
  };
  cards.forEach((c) => { if (c.classList.contains("card-wide")) c.dataset.wide = "1"; });
  filterBtns.forEach((b) => b.addEventListener("click", () => applyFilter(b.dataset.filter)));
  fitMore();

  /* ───────────────── the sigil: wireframe polyhedral wing ───────────────── */
  const sigil = (() => {
    const canvas = $("#sigil");
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, DPR = 1;
    let ink = "#f2f2ff";
    let bgLayer = null;

    // Seeded PRNG so the engraving is stable between frames/resizes
    const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

    // ── geometry ──
    // NACA 2412-ish airfoil, cosine-spaced, closed loop (upper TE→LE→lower TE)
    const airfoil = (() => {
      const m = 0.02, p = 0.4, t = 0.12, n = 12;
      const up = [], lo = [];
      for (let i = 0; i <= n; i++) {
        const x = 0.5 * (1 - Math.cos((Math.PI * i) / n));
        const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1015 * x ** 4);
        const yc = x < p ? (m / (p * p)) * (2 * p * x - x * x) : (m / ((1 - p) ** 2)) * (1 - 2 * p + 2 * p * x - x * x);
        up.push([x, yc + yt]);
        lo.push([x, yc - yt]);
      }
      return up.reverse().concat(lo.slice(1));
    })();

    const BREAK = 0.55;         // Mirum's polyhedral break
    const STATIONS = 10;
    const geometryScale = 5.2 / glider.defaults.span_m;

    const wingStation = (s, side) => {
      const station = glider.wingStation(wingSpec, s);
      const chord = station.chord * geometryScale;
      const sweep = station.x * geometryScale;
      const z = station.z * geometryScale;
      const twist = -station.twist;
      return airfoil.map(([x, y]) => {
        const xr = x * chord;
        const yr = y * chord;
        const xt = xr * Math.cos(twist) - yr * Math.sin(twist);
        const zt = xr * Math.sin(twist) + yr * Math.cos(twist);
        return [xt + sweep - 0.25 * glider.defaults.root_chord_m * geometryScale - 0.1, side * station.y * geometryScale, z + zt];
      });
    };

    let ribs = [], breakRibs = [];
    const rebuildWing = () => {
      ribs = [];
      for (const side of [1, -1]) {
        for (let i = 0; i < STATIONS; i++) {
          const s = i / (STATIONS - 1);
          ribs.push({ side, s, pts: wingStation(s, side) });
        }
      }
      breakRibs = [1, -1].map((side) => ({ side, s: BREAK, pts: wingStation(BREAK, side), brk: true }));
    };
    rebuildWing();

    // fuselage pod: rings along X
    const fuselage = [];
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      const x = -1.15 + u * 3.6;
      const r = 0.16 * Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 0.7 + 0.015;
      const ring = [];
      for (let k = 0; k <= 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        ring.push([x, Math.cos(a) * r, Math.sin(a) * r - 0.06]);
      }
      fuselage.push(ring);
    }
    // tail: H-stab and fin
    const tailX = 2.25;
    const hstab = [[tailX, -0.62, 0.0], [tailX + 0.32, -0.62, 0.0], [tailX + 0.4, 0, 0.0], [tailX + 0.32, 0.62, 0.0], [tailX, 0.62, 0.0], [tailX - 0.12, 0, 0.0]];
    const fin = [[tailX - 0.05, 0, 0.02], [tailX + 0.22, 0, 0.5], [tailX + 0.4, 0, 0.5], [tailX + 0.42, 0, 0.0]];

    // ── view state ──
    let yaw = -0.7, pitch = 0.42, roll = 0;
    let vyaw = reduceMotion ? 0 : 0.0028;
    let dragging = false, lastX = 0, lastY = 0, pointerX = 0, pointerY = 0;
    let t0 = performance.now();
    let running = false, visible = true, raf = 0;
    let flightProgress = null;

    const project = (p, cx, cy, scale, bob) => {
      let [x, y, z] = p;
      z += bob;
      // yaw (around Z — vertical)
      let x1 = x * Math.cos(yaw) - y * Math.sin(yaw);
      let y1 = x * Math.sin(yaw) + y * Math.cos(yaw);
      // roll (around X)
      let y2 = y1 * Math.cos(roll) - z * Math.sin(roll);
      let z2 = y1 * Math.sin(roll) + z * Math.cos(roll);
      // pitch (around screen-horizontal axis): tilt so we look slightly from above
      let x3 = x1;
      let d = x3 * Math.cos(pitch) + z2 * Math.sin(pitch); // depth
      let zz = -x3 * Math.sin(pitch) + z2 * Math.cos(pitch);
      const f = 7.5;
      const k = f / (f + d);
      return [cx + y2 * scale * k, cy - zz * scale * k, d];
    };

    const readInk = () => {
      ink = getComputedStyle(root).getPropertyValue("--ink").trim() || "#f2f2ff";
    };

    const withAlpha = (a) => {
      // ink is hex (#rrggbb)
      const h = ink.replace("#", "");
      const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${a})`;
    };

    // static engraving: sunburst ring + concentric hatching
    const buildBackground = () => {
      bgLayer = document.createElement("canvas");
      bgLayer.width = W * DPR;
      bgLayer.height = H * DPR;
      const b = bgLayer.getContext("2d");
      b.scale(DPR, DPR);
      const cx = W / 2, cy = H / 2;
      const R = Math.min(W, H) * 0.47;
      const rand = rng(9157);

      // sunburst
      const N = 260;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2 + rand() * 0.004;
        const r0 = R * (0.6 + rand() * 0.04);
        const r1 = R * (0.8 + rand() * 0.22);
        b.strokeStyle = withAlpha(0.18 + rand() * 0.32);
        b.lineWidth = rand() < 0.15 ? 1.1 : 0.6;
        b.beginPath();
        b.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        b.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        b.stroke();
      }
      // engraved concentric hatch inside
      for (let r = R * 0.12; r < R * 0.58; r += 4.2) {
        b.strokeStyle = withAlpha(0.06 + 0.06 * Math.sin(r * 0.05) ** 2);
        b.lineWidth = 0.6;
        b.beginPath();
        b.arc(cx, cy, r, 0, Math.PI * 2);
        b.stroke();
      }
      // ring outlines + ticks
      b.strokeStyle = withAlpha(0.55);
      b.lineWidth = 0.8;
      b.beginPath(); b.arc(cx, cy, R * 0.6, 0, Math.PI * 2); b.stroke();
      b.strokeStyle = withAlpha(0.3);
      b.beginPath(); b.arc(cx, cy, R * 0.585, 0, Math.PI * 2); b.stroke();
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * Math.PI * 2;
        const l = i % 6 === 0 ? 10 : 4;
        b.strokeStyle = withAlpha(i % 6 === 0 ? 0.7 : 0.35);
        b.beginPath();
        b.moveTo(cx + Math.cos(a) * R * 0.6, cy + Math.sin(a) * R * 0.6);
        b.lineTo(cx + Math.cos(a) * (R * 0.6 - l), cy + Math.sin(a) * (R * 0.6 - l));
        b.stroke();
      }
      // corner registration marks
      b.strokeStyle = withAlpha(0.6);
      b.lineWidth = 1;
      const m = 10, L = 14;
      [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => {
        b.beginPath();
        b.moveTo(x, y + sy * L); b.lineTo(x, y); b.lineTo(x + sx * L, y);
        b.stroke();
      });
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      W = Math.max(1, rect.width);
      H = Math.max(1, rect.height);
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      readInk();
      buildBackground();
      draw(performance.now());
    };

    const poly = (pts, close) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      if (close) ctx.closePath();
      ctx.stroke();
    };

    const draw = (now) => {
      const t = (now - t0) / 1000;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (bgLayer) ctx.drawImage(bgLayer, 0, 0, W, H);

      const flying = flightProgress !== null;
      const progress = flightProgress || 0;
      const cx = flying ? W * (0.30 + 0.42 * progress) : W / 2;
      const cy = flying ? H * (0.5 - 0.16 * Math.sin(progress * Math.PI) + 0.12 * progress ** 2) : H / 2;
      const scale = Math.min(W, H) * 0.135 * (flying ? 0.76 - 0.15 * progress : 1);
      const bob = reduceMotion ? 0 : Math.sin(t * 0.9) * 0.06;
      roll = reduceMotion ? 0 : flying ? Math.sin(progress * Math.PI * 2) * 0.15 : Math.sin(t * 0.6) * 0.06 + pointerX * 0.08;
      const pitchNow = pitch + pointerY * 0.1;
      const savedPitch = pitch;
      pitch = pitchNow;

      // project everything
      const P = (p) => project(p, cx, cy, scale, bob);
      const pr = ribs.map((r) => ({ ...r, q: r.pts.map(P) }));
      const pb = breakRibs.map((r) => ({ ...r, q: r.pts.map(P) }));

      if (flying) {
        ctx.strokeStyle = withAlpha(0.35);
        ctx.lineWidth = 0.8;
        ctx.setLineDash([3, 7]);
        ctx.beginPath(); ctx.moveTo(W * 0.12, H * 0.78); ctx.lineTo(W * 0.88, H * 0.78); ctx.stroke();
        ctx.setLineDash([]);
        for (let i = 0; i < 9; i++) {
          const x = W * (((i / 9 - progress * 0.5) % 1 + 1) % 1);
          const y = H * (0.3 + (i % 4) * 0.1);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - W * 0.05, y); ctx.stroke();
        }
      }

      // light rays pulled from the wingtips (the "messenger" gesture)
      const R = Math.min(W, H) * 0.47;
      const rand = rng(424242);
      const tips = pr.filter((r) => r.s === 1).map((r) => r.q[Math.floor(r.q.length / 4)]);
      if (!flying) tips.forEach(([tx, ty], ti) => {
        const base = Math.atan2(ty - cy, tx - cx);
        for (let i = 0; i < 26; i++) {
          const spread = (rand() - 0.5) * 0.9;
          const shimmer = reduceMotion ? 0 : Math.sin(t * 1.3 + i * 0.7 + ti) * 0.015;
          const a = base + spread + shimmer;
          const len = R * (0.75 + rand() * 0.9);
          ctx.strokeStyle = withAlpha(0.12 + rand() * 0.38);
          ctx.lineWidth = rand() < 0.2 ? 1 : 0.55;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(tx + Math.cos(a) * len, ty + Math.sin(a) * len);
          ctx.stroke();
        }
      });

      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      // fuselage rings + stringers
      const fq = fuselage.map((ring) => ring.map(P));
      ctx.lineWidth = 0.7;
      fq.forEach((ring) => { ctx.strokeStyle = withAlpha(0.35); poly(ring, true); });
      for (let k = 0; k < 16; k += 2) {
        ctx.strokeStyle = withAlpha(0.28);
        poly(fq.map((ring) => ring[k]));
      }
      // tail
      ctx.strokeStyle = withAlpha(0.7);
      ctx.lineWidth = 0.9;
      poly(hstab.map(P), true);
      poly(fin.map(P), true);

      // spanwise stringers (connect same airfoil index across ribs)
      [1, -1].forEach((side) => {
        const sideRibs = pr.filter((r) => r.side === side).sort((a, b) => a.s - b.s);
        const n = sideRibs[0].q.length;
        for (let j = 0; j < n; j++) {
          const isEdge = j === 0 || j === Math.floor(n / 2);
          ctx.strokeStyle = withAlpha(isEdge ? 0.95 : 0.32);
          ctx.lineWidth = isEdge ? 1.2 : 0.6;
          poly(sideRibs.map((r) => r.q[j]));
        }
      });

      // ribs
      pr.forEach((r) => {
        const tip = r.s === 1 || r.s === 0;
        ctx.strokeStyle = withAlpha(tip ? 0.95 : 0.6);
        ctx.lineWidth = tip ? 1.2 : 0.8;
        poly(r.q, true);
      });
      // polyhedral break, dashed
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = withAlpha(0.9);
      ctx.lineWidth = 1;
      pb.forEach((r) => poly(r.q, true));
      ctx.setLineDash([]);

      // annotation: dihedral callout at the right break
      const brk = pb[0].q[0];
      ctx.fillStyle = withAlpha(0.85);
      ctx.strokeStyle = withAlpha(0.6);
      ctx.lineWidth = 0.7;
      const lx = brk[0] + 40, ly = brk[1] - 46;
      ctx.beginPath(); ctx.moveTo(brk[0], brk[1]); ctx.lineTo(lx, ly); ctx.lineTo(lx + 64, ly); ctx.stroke();
      ctx.beginPath(); ctx.arc(brk[0], brk[1], 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.font = `10px "IBM Plex Mono", monospace`;
      ctx.fillText(`Γ ${wingSpec.dihedral_deg}°`, lx + 2, ly - 5);

      pitch = savedPitch;
    };

    const loop = (now) => {
      if (!dragging) yaw += vyaw;
      draw(now);
      raf = running ? requestAnimationFrame(loop) : 0;
    };
    const start = () => {
      if (running || reduceMotion || !visible || flightProgress !== null || document.hidden) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    // interaction
    canvas.addEventListener("pointerdown", (e) => {
      if (flightProgress !== null) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      const rect = canvas.getBoundingClientRect();
      pointerX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      yaw += dx * 0.008;
      pitch = Math.max(-0.2, Math.min(1.2, pitch + dy * 0.005));
      vyaw = Math.sign(dx || 1) * Math.min(0.02, Math.abs(dx) * 0.0006 + 0.0022);
      lastX = e.clientX;
      lastY = e.clientY;
      if (!running) draw(performance.now());
    });
    const endDrag = () => { dragging = false; };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("pointerleave", () => { pointerX = 0; pointerY = 0; });

    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      visible ? start() : stop();
    }).observe(canvas);
    new ResizeObserver(resize).observe(canvas);
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));

    // fonts change label metrics; redraw once loaded
    document.fonts && document.fonts.ready.then(() => draw(performance.now()));

    resize();
    start();

    return {
      repaint() {
        readInk();
        buildBackground();
        draw(performance.now());
      },
      update() { rebuildWing(); draw(performance.now()); },
      async fly(onProgress) {
        if (reduceMotion) { onProgress(1); return; }
        stop();
        dragging = false;
        const savedYaw = yaw, savedPitch = pitch;
        yaw = -1.05; pitch = 0.35;
        flightProgress = 0;
        const began = performance.now();
        await new Promise((resolve) => {
          const tick = (now) => {
            flightProgress = Math.min(1, (now - began) / 4000);
            draw(now); onProgress(flightProgress);
            if (flightProgress < 1) requestAnimationFrame(tick);
            else resolve();
          };
          requestAnimationFrame(tick);
        });
        flightProgress = null;
        yaw = savedYaw; pitch = savedPitch;
        draw(performance.now()); start();
      },
    };
  })();

  /* ───────────────── broadcast: the project player ───────────────── */
  const player = (() => {
    const pw = $("#pw");
    if (!pw) return null;
    const screen = $("#pwScreen");
    const urlEl = $("#pwUrl");
    const openEl = $("#pwOpen");
    const idxEl = $("#pwIdx");
    const titleEl = $("#pwTitle");
    const bar = $("#pwProgress");
    const playBtn = $("#pwPlay");
    const list = $("#playlist");
    const ghost = $("#pwGhost");
    const slot = $("#playerSlot");

    // kind: live = embeddable site, video = YouTube demo, spec = poster only
    const items = [
      { key: "signline", name: "SignLine", kind: "live", src: "https://signline-api.fly.dev", allow: "camera; microphone; fullscreen",
        tag: "ASL-to-caption video calls", badge: "Winner · Best Live Demo", more: "https://devpost.com/software/signal-zku8j7",
        blurb: "Signs become editable captions; speech is live-captioned. Allow camera access to try it." },
      { key: "speakup", name: "Speak Up", kind: "live", src: "https://speak-up.fly.dev", allow: "microphone; fullscreen",
        tag: "Impromptu debate trainer", badge: "1st Place · HackNC", more: "https://devpost.com/software/speak-up-4ofanr",
        blurb: "Give a speech, get a rubric score. Allow the microphone to try it." },
      { key: "intent", name: "Intent", kind: "live", src: "https://show-intent.fly.dev", allow: "fullscreen",
        tag: "Idea → requirement-traced build plan", badge: "Results pending", more: "https://devpost.com/software/intent-3dug9q",
        blurb: "Describe a rough idea and get a cited brief a coding agent can build from." },
      { key: "venn", name: "Venn", kind: "video", yt: "befQma3HH5U", href: "https://devpost.com/software/venn-vkoaqp",
        tag: "Let's find a time, together.", badge: "Results pending", blurb: "Account-free group scheduling with private calendar overlays." },
      { key: "benchwarmers", name: "Benchwarmers", kind: "video", yt: "SeeheqsixKc", href: "https://devpost.com/software/benchwarmers",
        tag: "Draft your squad. Call the next play.", badge: "Results pending", blurb: "Game night driven by a simulated Alexa+ display over MCP." },
      { key: "xvant", name: "XVANT", kind: "spec", href: "https://github.com/Azrkiel/xvant-agent",
        tag: "Multi-agent orchestration harness", blurb: "Codex, Claude Code and OpenCode in parallel on isolated git worktrees." },
      { key: "mirum", name: "Mirum", kind: "spec", href: "https://github.com/Azrkiel/Mirum",
        tag: "Think it. Have it.", blurb: "Text → parametric B-Rep CAD assemblies. 78 of 82 prompts passed." },
      { key: "pixie", name: "Pixie", kind: "spec", href: "https://github.com/Azrkiel/pixie",
        tag: "AI cursor companion for Windows", blurb: "An agent with a body: it points and draws on your screen." },
      { key: "model-router", name: "model-router", kind: "spec", href: "https://github.com/Azrkiel/model-router",
        tag: "Cheapest model that fits, then escalate", blurb: "A Claude Code mod with junior-to-senior escalation hand-offs." },
    ];

    // borrow each project's glyph + chips from its card so there's one source of truth
    const cardFor = (name) => $$(".cards .card").find((c) => $("h3", c)?.textContent.trim() === name);
    items.forEach((it) => {
      const card = cardFor(it.name);
      it.glyph = card ? $(".plate svg", card)?.outerHTML : "";
      it.chips = card ? $(".chips", card)?.outerHTML : "";
      it.open = it.src || it.href;
    });

    const DWELL = 9000;
    let i = 0;
    let playing = !reduceMotion;
    let launched = false; // an iframe / video is running; slideshow halts
    let elapsed = 0, last = 0, raf = 0;
    let inView = false;

    const pad = (n) => String(n).padStart(2, "0");
    const host = (u) => u.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const kindLabel = { live: "Live site", video: "Demo video", spec: "Project" };

    list.innerHTML = items
      .map((it, n) => `<li><button type="button" data-i="${n}"><span class="pl-n"><span>${pad(n + 1)}</span></span><span class="pl-name">${escapeHtml(it.name)}</span><span class="pl-kind">${kindLabel[it.kind]}</span></button></li>`)
      .join("");

    const poster = (it) => {
      const cta =
        it.kind === "live"
          ? `<button type="button" class="btn btn-solid" data-launch><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16l13-8z" fill="currentColor"/></svg>Launch live site</button>`
          : it.kind === "video"
          ? `<button type="button" class="btn btn-solid" data-launch><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16l13-8z" fill="currentColor"/></svg>Play demo</button>`
          : `<a class="btn btn-solid" href="${it.href}" target="_blank" rel="noopener">View on GitHub ↗</a>`;
      const second = it.more ? `<a class="btn btn-ghost" href="${it.more}" target="_blank" rel="noopener">Devpost ↗</a>` : "";
      return `<div class="slide">
        <div class="slide-glyph">${it.glyph}</div>
        <div class="slide-copy">
          <p class="slide-kind">${kindLabel[it.kind]}${it.badge ? ` <b>${escapeHtml(it.badge)}</b>` : ""}</p>
          <h3>${escapeHtml(it.name)}</h3>
          <p><strong>${escapeHtml(it.tag)}</strong><br>${escapeHtml(it.blurb)}</p>
          ${it.chips || ""}
          <div class="cta-row">${cta}${second}</div>
        </div>
      </div>`;
    };

    const render = () => {
      const it = items[i];
      launched = false;
      screen.innerHTML = poster(it);
      urlEl.textContent = host(it.open);
      openEl.href = it.open;
      idxEl.textContent = `${pad(i + 1)} / ${pad(items.length)}`;
      titleEl.textContent = `${it.name} — ${it.tag}`;
      $$("button", list).forEach((b) => b.setAttribute("aria-current", String(Number(b.dataset.i) === i)));
      elapsed = 0;
      paintProgress();
    };

    const launch = () => {
      const it = items[i];
      if (it.kind === "spec") return;
      launched = true;
      setPlaying(false);
      const src = it.kind === "video" ? `https://www.youtube-nocookie.com/embed/${it.yt}?autoplay=1&rel=0` : it.src;
      const allow = it.kind === "video" ? "autoplay; encrypted-media; picture-in-picture; fullscreen" : it.allow;
      urlEl.textContent = it.kind === "video" ? `youtube.com/watch?v=${it.yt}` : host(it.src);
      openEl.href = it.kind === "video" ? `https://www.youtube.com/watch?v=${it.yt}` : it.src;
      screen.innerHTML = `<div class="pw-loading" id="pwLoading"><i></i><span>${it.kind === "live" ? "Waking the server…" : "Loading demo…"}</span><span style="text-transform:none;letter-spacing:0">Not loading? <a href="${openEl.href}" target="_blank" rel="noopener" style="border-bottom:1px solid var(--line-strong)">Open it in a new tab ↗</a></span></div>`;
      const f = document.createElement("iframe");
      f.src = src;
      f.title = `${it.name} — ${kindLabel[it.kind]}`;
      f.allow = allow;
      f.allowFullscreen = true;
      f.loading = "eager";
      f.referrerPolicy = "strict-origin-when-cross-origin";
      f.addEventListener("load", () => $("#pwLoading")?.classList.add("is-done"));
      screen.appendChild(f);
    };

    const go = (n) => {
      i = (n + items.length) % items.length;
      render();
    };

    const paintProgress = () => {
      bar.style.transform = `scaleX(${launched ? 0 : Math.min(1, elapsed / DWELL)})`;
    };

    const tick = (now) => {
      const dt = last ? now - last : 0;
      last = now;
      const docked = pw.classList.contains("is-docked");
      if (playing && !launched && !hovering && (inView || docked) && !document.hidden) {
        elapsed += dt;
        if (elapsed >= DWELL) go(i + 1);
      }
      paintProgress();
      raf = requestAnimationFrame(tick);
    };

    const setPlaying = (on) => {
      playing = on;
      playBtn.classList.toggle("is-paused", !on);
      playBtn.setAttribute("aria-label", on ? "Pause slideshow" : "Play slideshow");
    };

    // dock / undock (pop out to a floating mini-player)
    const dock = () => {
      if (pw.classList.contains("is-docked")) return;
      ghost.hidden = false;
      document.body.appendChild(pw);
      pw.classList.add("is-docked");
      pw.style.left = pw.style.top = pw.style.bottom = "";
      $("#pwPop").setAttribute("aria-label", "Return player to page");
    };
    const undock = () => {
      if (!pw.classList.contains("is-docked")) return;
      pw.classList.remove("is-docked");
      pw.style.left = pw.style.top = pw.style.bottom = "";
      slot.insertBefore(pw, ghost);
      ghost.hidden = true;
      $("#pwPop").setAttribute("aria-label", "Pop out mini-player");
    };
    const close = () => {
      undock();
      if (launched) render(); // stop the iframe/video
    };

    // drag the mini-player by its title bar
    (() => {
      const handle = $("#pwBar");
      let sx = 0, sy = 0, ox = 0, oy = 0, drag = false;
      handle.addEventListener("pointerdown", (e) => {
        if (!pw.classList.contains("is-docked") || e.target.closest("a,button")) return;
        drag = true;
        const r = pw.getBoundingClientRect();
        sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
        handle.setPointerCapture(e.pointerId);
      });
      handle.addEventListener("pointermove", (e) => {
        if (!drag) return;
        const r = pw.getBoundingClientRect();
        const x = Math.max(4, Math.min(window.innerWidth - r.width - 4, ox + e.clientX - sx));
        const y = Math.max(4, Math.min(window.innerHeight - r.height - 4, oy + e.clientY - sy));
        pw.style.left = x + "px";
        pw.style.top = y + "px";
        pw.style.bottom = "auto";
      });
      const end = () => (drag = false);
      handle.addEventListener("pointerup", end);
      handle.addEventListener("pointercancel", end);
    })();

    // wiring
    $("#pwPrev").addEventListener("click", () => go(i - 1));
    $("#pwNext").addEventListener("click", () => go(i + 1));
    playBtn.addEventListener("click", () => {
      if (launched) { render(); setPlaying(true); return; }
      setPlaying(!playing);
    });
    $("#pwPop").addEventListener("click", () => (pw.classList.contains("is-docked") ? undock() : dock()));
    $("#pwClose").addEventListener("click", close);
    $("#pwReturn").addEventListener("click", undock);
    list.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-i]");
      if (!b) return;
      go(Number(b.dataset.i));
      setPlaying(false);
    });
    screen.addEventListener("click", (e) => {
      if (e.target.closest("[data-launch]")) launch();
    });
    // pause the slideshow while someone is hovering/reading the screen
    let hovering = false;
    screen.addEventListener("pointerenter", () => (hovering = true));
    screen.addEventListener("pointerleave", () => (hovering = false));

    new IntersectionObserver((entries) => (inView = entries[0].isIntersecting), { threshold: 0.35 }).observe(slot);

    // "▶ Play" links on each project card
    items.forEach((it, n) => {
      const card = cardFor(it.name);
      const links = card && $(".card-links", card);
      if (!links) return;
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = it.kind === "spec" ? "▶ Preview" : it.kind === "video" ? "▶ Play demo" : "▶ Play here";
      b.addEventListener("click", () => api.play(it.key));
      links.prepend(b);
    });

    render();
    setPlaying(playing);
    raf = requestAnimationFrame(tick);

    const api = {
      keys: items.map((it) => it.key),
      play(key, opts = {}) {
        const n = items.findIndex((it) => it.key === key || it.key.startsWith(key));
        if (n < 0) return false;
        go(n);
        setPlaying(false);
        if (!pw.classList.contains("is-docked")) {
          $("#player").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
        }
        if (opts.launch) launch();
        return items[n];
      },
      dock,
      undock,
    };
    return api;
  })();

  /* ───────────────── console (the agent) ───────────────── */
  const con = $("#console");
  const out = $("#consoleOut");
  const input = $("#consoleInput");
  const form = $("#consoleForm");
  const history = [];
  let hIdx = 0;
  let booted = false;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  const link = (href, label) => `<a href="${href}" target="_blank" rel="noopener">${escapeHtml(label || href)}</a>`;

  const print = (html, cls = "l-out") => {
    const div = document.createElement("div");
    div.className = cls;
    div.innerHTML = html;
    out.appendChild(div);
    out.scrollTop = out.scrollHeight;
  };

  /* ───────────────── compact Mirum flight lab ───────────────── */
  const wingInputs = $$("[data-wing]");
  const launchButton = $("#launchGlider");
  const pilotInput = $("#pilotName");
  const flightStatus = $("#flightStatus");
  const telemetry = $("#flightTelemetry");
  const flightBoard = $("#flightBoard");
  let flightBusy = false, boardBusy = false;
  try { pilotInput.value = localStorage.getItem("kj-pilot") || ""; } catch (e) { /* optional storage */ }

  function updateWing() {
    const labels = {
      span_m: ["#spanValue", `${wingSpec.span_m.toFixed(2)} m`],
      root_chord_m: ["#chordValue", `${wingSpec.root_chord_m.toFixed(3).replace(/0$/, "")} m`],
      taper: ["#taperValue", wingSpec.taper.toFixed(2)],
      dihedral_deg: ["#dihedralValue", `${wingSpec.dihedral_deg}°`],
    };
    for (const field of wingInputs) {
      const [selector, value] = labels[field.dataset.wing];
      $(selector).textContent = value;
      field.setAttribute("aria-valuetext", value);
    }
    sigil?.update();
    try {
      const estimate = glider.evaluate(wingSpec);
      $("#flightEstimate").textContent = `~${estimate.distance_m.toFixed(1)} m range · L/D ${estimate.glide_ratio.toFixed(1)} · ${estimate.mass_g} g`;
      launchButton.disabled = flightBusy;
      flightStatus.textContent = "Ready for takeoff.";
    } catch (error) {
      $("#flightEstimate").textContent = "Adjust the wing to fly.";
      flightStatus.textContent = error.message;
      launchButton.disabled = true;
    }
  }
  wingInputs.forEach((field) => field.addEventListener("input", () => {
    if (flightBusy) return;
    wingSpec[field.dataset.wing] = Number(field.value);
    updateWing();
  }));
  $("#resetGlider").addEventListener("click", () => {
    if (flightBusy) return;
    wingSpec = { ...glider.defaults };
    wingInputs.forEach((field) => { field.value = wingSpec[field.dataset.wing]; });
    updateWing();
  });
  updateWing();

  async function deskRequest(path, data) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(path, { signal: controller.signal, cache: "no-store",
        ...(data ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) } : {}) });
      if (!response.ok) {
        const body = response.headers.get("content-type")?.includes("application/json") ? await response.json() : {};
        const error = new Error(body.error || "Flight log unavailable.");
        error.offline = [404, 405, 500, 501, 502, 503, 504].includes(response.status);
        error.confirmedOffline = [404, 405, 501].includes(response.status);
        throw error;
      }
      if (!response.headers.get("content-type")?.includes("application/json")) {
        const error = new Error("Flight log unavailable."); error.offline = true; error.confirmedOffline = true; throw error;
      }
      return await response.json();
    } catch (error) {
      if (error.name === "AbortError" || error instanceof TypeError) error.offline = true;
      throw error;
    } finally { clearTimeout(timeout); }
  }

  async function loadLeaderboard() {
    if (boardBusy) return;
    boardBusy = true;
    const refresh = $("#refreshBoard"), status = $("#boardStatus"), rows = $("#leaderboardRows");
    refresh.disabled = true;
    status.textContent = "Loading flight log…";
    try {
      const reply = await deskRequest("/api/leaderboard");
      if (reply.model !== glider.version || !Array.isArray(reply.entries)) throw new Error("Unsupported flight log.");
      const fragment = document.createDocumentFragment();
      for (const [i, entry] of reply.entries.entries()) {
        const spec = glider.validate(entry.spec);
        if (typeof entry.pilot !== "string" || !Number.isFinite(entry.distance_m)) throw new Error("Invalid flight log.");
        const row = document.createElement("tr");
        const rank = document.createElement("td"), pilot = document.createElement("td"), distance = document.createElement("td");
        rank.textContent = String(i + 1);
        const name = document.createElement("strong"), specs = document.createElement("small");
        name.textContent = entry.pilot;
        specs.textContent = `${spec.span_m.toFixed(2)} m span · ${Number(spec.root_chord_m.toFixed(3))} m chord · ${spec.taper.toFixed(2)} taper · ${spec.dihedral_deg}°`;
        pilot.append(name, specs);
        distance.textContent = `${entry.distance_m.toFixed(1)} m`;
        row.append(rank, pilot, distance); fragment.append(row);
      }
      rows.replaceChildren(fragment);
      $(".flight-table").hidden = !reply.entries.length;
      status.textContent = reply.entries.length ? "Furthest estimated flights · 10 m launch" : "No flights yet. Put your wing on the board.";
    } catch (error) {
      rows.replaceChildren();
      $(".flight-table").hidden = true;
      status.textContent = "Shared flight log offline. Practice flights are still available.";
    } finally { boardBusy = false; refresh.disabled = false; }
  }
  flightBoard.addEventListener("toggle", () => { if (flightBoard.open) loadLeaderboard(); });
  $("#refreshBoard").addEventListener("click", loadLeaderboard);
  $("#flyCommand").addEventListener("click", () => { openConsole(); input.value = "fly"; });

  async function launchFlight() {
    if (flightBusy) { print("A flight is already in progress."); return; }
    let result;
    const frozenSpec = { ...wingSpec };
    try { result = glider.evaluate(frozenSpec); }
    catch (error) { flightStatus.textContent = error.message; print(escapeHtml(error.message)); return; }
    const pilot = (pilotInput.value.trim() || "Anonymous").normalize("NFKC");
    if (!/^[\p{L}\p{N} _.'-]{1,24}$/u.test(pilot)) {
      flightStatus.textContent = "Use 1–24 letters, numbers, spaces, or . _ ' - for your alias.";
      print(escapeHtml(flightStatus.textContent));
      pilotInput.focus(); return;
    }
    flightBusy = true;
    $("#wingControls").disabled = true;
    launchButton.disabled = pilotInput.disabled = $("#resetGlider").disabled = true;
    launchButton.textContent = "Preparing…";
    flightStatus.textContent = "Checking in at the flight desk…";
    if (!con.hidden) closeConsole();
    $(".hero-fig").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    let saved = false, practiceNote = "";
    try {
      try {
        const reply = await deskRequest("/api/flights", { pilot, spec: frozenSpec });
        if (reply.result?.model !== glider.version || !Number.isFinite(reply.result.distance_m)) throw new Error("Unsupported flight result. Refresh and try again.");
        result = reply.result; saved = true;
        try { localStorage.setItem("kj-pilot", pilot); } catch (e) { /* optional storage */ }
      } catch (error) {
        if (!error.offline) throw error;
        practiceNote = error.confirmedOffline ? "Practice only — flight log offline; no score saved." : "Practice flight — connection unavailable; leaderboard save unconfirmed.";
      }
      launchButton.textContent = "In flight…";
      telemetry.hidden = false;
      flightStatus.textContent = saved ? "In flight. Design logged to the shared leaderboard." : practiceNote;
      await sigil.fly((progress) => {
        telemetry.textContent = `FLIGHT ${String(Math.round(progress * 100)).padStart(3, "0")}% / ${(result.distance_m * progress).toFixed(1)} m`;
      });
      const summary = `${result.distance_m.toFixed(1)} m · L/D ${result.glide_ratio.toFixed(1)} · ${result.mass_g} g · estimated`;
      flightStatus.textContent = saved ? `Touchdown. ${summary}. Logged as ${pilot}.` : `Touchdown. ${summary}. ${practiceNote}`;
      flightStatus.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
      print(`${escapeHtml(pilot)} → ${escapeHtml(summary)}\n${saved ? "Design saved. Type <i>leaderboard</i> to view the flight log." : escapeHtml(practiceNote)}`);
      if (saved && flightBoard.open) await loadLeaderboard();
    } catch (error) {
      flightStatus.textContent = error.message;
      print(escapeHtml(error.message));
    } finally {
      telemetry.hidden = true;
      flightBusy = false;
      $("#wingControls").disabled = false;
      launchButton.disabled = pilotInput.disabled = $("#resetGlider").disabled = false;
      launchButton.textContent = "Fly glider ↗";
    }
  }
  $("#flightForm").addEventListener("submit", (event) => { event.preventDefault(); launchFlight(); });

  const projects = {
    xvant: ["XVANT", "Multi-agent orchestration harness — Codex, Claude Code & OpenCode in parallel on isolated git worktrees. 1,000+ tests, ~38k lines.", "https://github.com/Azrkiel/xvant-agent"],
    mirum: ["Mirum", "Text → parametric B-Rep CAD assemblies with a multi-agent Gemini pipeline. 78/82 prompts. LoRA on Qwen2.5-Coder-7B: 48% → 78% valid.", "https://github.com/Azrkiel/Mirum"],
    signline: ["SignLine", "ASL-to-caption video calls. 🏆 Best Live Demo, Girls Hoo Hack.", "https://signline-api.fly.dev"],
    speakup: ["Speak Up", "Impromptu debate trainer. 🏆 1st Place Beginner, HackNC.", "https://speak-up.fly.dev"],
    intent: ["Intent", "Idea → requirement-traced build plan for coding agents. Nemotron on Nebius. 853 tests.", "https://show-intent.fly.dev"],
    venn: ["Venn", "Account-free group scheduling with private calendar overlays. 239 tests. ⏳ Results pending.", "https://devpost.com/software/venn-vkoaqp"],
    benchwarmers: ["Benchwarmers", "Multiplayer sports game night via a simulated Alexa+ display over MCP. 1,604 tests. ⏳ Results pending.", "https://devpost.com/software/benchwarmers"],
    pixie: ["Pixie", "AI cursor companion for Windows that points and draws.", "https://github.com/Azrkiel/pixie"],
    "model-router": ["model-router", "Claude Code mod: cheapest model that fits, with junior→senior escalation.", "https://github.com/Azrkiel/model-router"],
  };

  const goto = (id) => {
    closeConsole();
    $(id)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  };

  const commands = {
    help: () =>
      print(
        [
          "available commands:",
          "  whoami          who is kevin",
          "  ls              list dispatches (projects)",
          "  open &lt;name&gt;     open a project, e.g. <i>open mirum</i>",
          "  play &lt;name&gt;     show a project in the player (play signline)",
          "  popout          float the player in the corner",
          "  research        what i'm researching",
          "  skills          loaded skills",
          "  wins            hackathon results",
          "  resume          open resume pdf",
          "  contact         how to reach me",
          "  goto &lt;section&gt;  jump to a section (e.g. goto research)",
          "  invert          swap ink and paper",
          "  fly             launch your current glider design",
          "  leaderboard     view the shared flight log",
          "  clear           clear the screen",
        ].join("\n")
      ),
    whoami: () =>
      print(
        "Kevin Jiang (azrkiel)\nMechanical Engineering @ University of Virginia, class of 2030.\nI build multi-agent systems that design physical things — and the harnesses that keep agents honest.\nCharlottesville, VA."
      ),
    ls: () =>
      print(
        Object.entries(projects)
          .map(([k, [name, desc]]) => `${k.padEnd(14, " ")}${escapeHtml(desc.split(".")[0])}`)
          .join("\n") + "\n\ntry: open <name>"
      ),
    open: (arg) => {
      const key = (arg || "").toLowerCase().replace(/\s+/g, "");
      const p = projects[key] || projects[Object.keys(projects).find((k) => k.startsWith(key)) || ""];
      if (!key) return print("usage: open &lt;name&gt; — run <i>ls</i> to see names");
      if (!p) return print(`open: no dispatch named '${escapeHtml(arg)}'`);
      print(`<b>${p[0]}</b> — ${escapeHtml(p[1])}\n→ ${link(p[2])}`);
    },
    play: (arg) => {
      if (!player) return print("player unavailable");
      if (!arg) return print("usage: play &lt;name&gt; — one of: " + player.keys.join(", "));
      const it = player.play(arg.toLowerCase().replace(/\s+/g, ""));
      if (!it) return print(`play: nothing called '${escapeHtml(arg)}'. try: ${player.keys.join(", ")}`);
      print(`▶ now playing <b>${escapeHtml(it.name)}</b>`);
      setTimeout(closeConsole, 500);
    },
    popout: () => {
      if (!player) return print("player unavailable");
      player.dock();
      print("player popped out. drag it by the title bar.");
    },
    research: () =>
      print(
        [
          "01  BenchCAD 2.0 — assembly-level scoring for AI-generated CAD (Prof. Cheng Peng, UVA SDS). v1.0 used in Anthropic's system card.",
          "02  Verified AI Generative Design — 12 PicoGK glider wings; polyhedral L/D 11.9 vs 10.8 tapered.",
          "03  Mirum — text → B-Rep assemblies; LoRA lifted valid output 48% → 78%.",
          "04  RDE capstone — OpenFOAM H2/O2 detonations; 4 mm resonator neck cut peak pressure ~20%.",
        ].join("\n")
      ),
    skills: () =>
      print(
        "agents.md       Claude Code · Codex · Gemini · Nemotron · MCP\nml.md           PyTorch · PyG · Hugging Face · LoRA · MediaPipe\ncad-kernel.md   CadQuery · OpenCASCADE · PicoGK · Fusion 360 · Inventor\nsimulation.md   OpenFOAM\nship.md         TypeScript · Python · Java · SQL · Next.js · FastAPI · Docker"
      ),
    wins: () =>
      print("🏆 SignLine — Best Live Demo, Girls Hoo Hack (Oct 2026)\n🏆 Speak Up — 1st Place Beginner Track, HackNC (Oct 2026)\n⏳ Intent — Nebius × NVIDIA Global AI Hackathon (results pending)\n⏳ Venn — Devpost Build With AI: Basics (results pending)\n⏳ Benchwarmers — Build, Ship, Shape: Amazon Developer Hackathon (results pending)"),
    resume: () => {
      window.open("assets/Kevin-Jiang-Resume.pdf", "_blank", "noopener");
      print("opening resume…");
    },
    contact: () =>
      print(
        `email   ${link("mailto:fac3cq@virginia.edu", "fac3cq@virginia.edu")}\ngithub  ${link("https://github.com/Azrkiel", "github.com/Azrkiel")}\ndevpost ${link("https://devpost.com/Azrkiel", "devpost.com/Azrkiel")}`
      ),
    goto: (arg) => {
      const id = "#" + (arg || "").toLowerCase();
      if (!arg || !$(id)) return print("usage: goto memory | skills | dispatches | research | trail | summon");
      goto(id);
    },
    invert: () => { toggleTheme(); print("ink and paper swapped."); },
    fly: launchFlight,
    leaderboard: () => {
      closeConsole();
      flightBoard.open = true;
      loadLeaderboard();
      flightBoard.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    },
    clear: () => { out.innerHTML = ""; },
    hermes: () => print("☤  the messenger is listening. try <i>help</i>."),
    sudo: (arg) =>
      /hire/.test(arg || "")
        ? print(`permission granted. drafting message… ${link("mailto:fac3cq@virginia.edu?subject=Let%27s%20build%20something", "send it")}`)
        : print("sudo: nice try."),
    ls_la: () => commands.ls(),
    exit: () => closeConsole(),
  };
  commands.projects = commands.ls;
  commands.email = commands.contact;
  commands.cv = commands.resume;

  const run = (raw) => {
    const line = raw.trim();
    if (!line) return;
    print(escapeHtml(line), "l-cmd");
    history.push(line);
    hIdx = history.length;
    const [cmd, ...rest] = line.split(/\s+/);
    const fn = commands[cmd.toLowerCase()];
    if (fn) fn(rest.join(" "));
    else print(`command not found: ${escapeHtml(cmd)} — type <i>help</i>`);
  };

  const boot = () => {
    if (booted) return;
    booted = true;
    print(
      [
        "   ╷   ",
        " ╲ │ ╱   kevin-agent v2026.11",
        "──☤──   messenger between atoms & agents",
        " ╱ │ ╲   ",
        "   ╵   ",
      ].join("\n"),
      "l-art"
    );
    print("memory loaded · 5 skills · 9 dispatches\ntype <i>help</i> to see what i can do.");
  };

  let lastFocus = null;
  function openConsole() {
    lastFocus = document.activeElement;
    con.hidden = false;
    boot();
    setTimeout(() => input.focus(), 30);
  }
  function closeConsole() {
    input.blur();
    con.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  $$("[data-open-console]").forEach((b) => b.addEventListener("click", openConsole));
  $$("[data-close-console]").forEach((b) => b.addEventListener("click", closeConsole));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    run(input.value);
    input.value = "";
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") {
      hIdx = Math.max(0, hIdx - 1);
      input.value = history[hIdx] || "";
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      hIdx = Math.min(history.length, hIdx + 1);
      input.value = history[hIdx] || "";
      e.preventDefault();
    } else if (e.key === "Tab") {
      const v = input.value.trim();
      const pool = v.startsWith("open ")
        ? Object.keys(projects).map((k) => "open " + k)
        : v.startsWith("play ") && player
        ? player.keys.map((k) => "play " + k)
        : Object.keys(commands);
      const hit = pool.find((c) => c.startsWith(v) && c !== v);
      if (hit) { input.value = hit; e.preventDefault(); }
    }
  });

  document.addEventListener("keydown", (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "") || document.activeElement?.isContentEditable;
    if (e.key === "Escape" && !con.hidden) { closeConsole(); return; }
    if (typing) return;
    if (e.key === "`" || e.key === "~" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
      e.preventDefault();
      con.hidden ? openConsole() : closeConsole();
    } else if (e.key === "i" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      toggleTheme();
    }
  });
})();

(function () {
  const CORES = ["safe", "predict", "mobile"];
  const BEAT_MS = 3200;
  const HOLD_MS = 700;
  const COPY = {
    ko: {
      skip: "애니메이션 건너뛰기",
      replay: "다시 보기",
      cores: {
        safe: {
          beats: [
            { title: "문제", body: "목표만 추종하면, 비홀로노믹 이동체는 장애물 안으로 들어갈 수 있습니다." },
            { title: "방법", body: "좌·우 회전원이 선회 능력을 제약으로 넣고, CBF와 도달가능 집합이 안전한 쪽을 증명합니다." },
            { title: "효과", body: "안전 필터가 입력을 고칩니다. 목표는 따라가되, 상태는 안전 집합 안에 머뭅니다." }
          ],
          labels: { goal: "goal", unsafe: "unsafe", safeSet: "safe set", left: "L", right: "R", cbf: "turning-circle CBF" }
        },
        predict: {
          beats: [
            { title: "예측", body: "지금 입력으로 짧은 지평선 동안 어디로 갈지를 먼저 그립니다." },
            { title: "최적화", body: "MPC는 궤적을 풀고, MPPI는 샘플을 뿌린 뒤 안전한 후보를 고릅니다. 튜브는 불확실성을 묶습니다." },
            { title: "재계획", body: "첫 입력만 적용하고 다시 풉니다. Receding horizon — 매 순간 예측을 고칩니다." }
          ],
          labels: { horizon: "horizon", samples: "MPPI samples", best: "best", tube: "tube" }
        },
        mobile: {
          beats: [
            { title: "인지", body: "운하 벽, 다른 선박, 보행자 — 현장에서 가항 영역을 먼저 봅니다." },
            { title: "계획", body: "선회 반경과 장애물 제약을 넣은 궤적을 실시간으로 만듭니다." },
            { title: "폐루프", body: "같은 루프를 선박·USV·모바일 로봇에서 닫습니다. 알고리즘은 필드에서 끝납니다." }
          ],
          labels: { sense: "sense", plan: "plan", field: "field" }
        }
      }
    },
    en: {
      skip: "Skip animation",
      replay: "Replay",
      cores: {
        safe: {
          beats: [
            { title: "Problem", body: "If the vehicle only tracks the goal, a nonholonomic body can still drive into the obstacle." },
            { title: "Method", body: "Left and right turning circles put turning ability into the constraint. A CBF and a reachable set certify the safe side." },
            { title: "Effect", body: "A safety filter edits the input. The vehicle still seeks the goal — but it stays inside the safe set." }
          ],
          labels: { goal: "goal", unsafe: "unsafe", safeSet: "safe set", left: "L", right: "R", cbf: "turning-circle CBF" }
        },
        predict: {
          beats: [
            { title: "Predict", body: "First draw where the current input would take the vehicle over a short horizon." },
            { title: "Optimize", body: "MPC solves a trajectory; MPPI sprays samples and keeps the safe ones. A tube wraps the uncertainty." },
            { title: "Replan", body: "Apply only the first input, then solve again. Receding horizon — the prediction is rewritten every step." }
          ],
          labels: { horizon: "horizon", samples: "MPPI samples", best: "best", tube: "tube" }
        },
        mobile: {
          beats: [
            { title: "Sense", body: "Canal banks, other vessels, pedestrians — the field is read before a move is committed." },
            { title: "Plan", body: "A trajectory is made in real time, with turning radius and obstacle constraints inside it." },
            { title: "Close the loop", body: "The same loop closes on ships, USVs, and mobile robots. The algorithm ends in the field." }
          ],
          labels: { sense: "sense", plan: "plan", field: "field" }
        }
      }
    }
  };

  const root = document.getElementById("coreMethod");
  const canvas = document.getElementById("coreMethodCanvas");
  if (!root || !canvas) return;

  const ctx = canvas.getContext("2d");
  const skipBtn = document.getElementById("coreMethodSkip");
  const stepEl = document.getElementById("coreMethodStep");
  const titleEl = document.getElementById("coreMethodBeatTitle");
  const bodyEl = document.getElementById("coreMethodBeatBody");
  const progEl = document.getElementById("coreMethodProg");
  const dotsEl = document.getElementById("coreMethodDots");
  const prevBtn = document.getElementById("coreMethodPrev");
  const nextBtn = document.getElementById("coreMethodNext");
  const cards = Array.from(document.querySelectorAll(".research-card[data-core]"));
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const state = {
    core: "safe",
    beat: 0,
    t: 0,
    playing: false,
    done: false,
    visible: false,
    beatStart: 0,
    holding: false,
    holdUntil: 0,
    raf: 0
  };

  function lang() {
    return document.documentElement.getAttribute("data-lang") === "en" ? "en" : "ko";
  }

  function copy() {
    return COPY[lang()];
  }

  function theme() {
    const s = getComputedStyle(document.documentElement);
    return {
      primary: (s.getPropertyValue("--primary-color") || "#1d4e89").trim(),
      secondary: (s.getPropertyValue("--secondary-color") || "#0d2644").trim(),
      text: (s.getPropertyValue("--heading-color") || "#121a24").trim(),
      muted: (s.getPropertyValue("--muted-text") || "#5a6776").trim(),
      copy: (s.getPropertyValue("--copy-color") || "#2a3544").trim()
    };
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(t) {
    t = clamp(t, 0, 1);
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
  function ang(dx, dy) { return Math.atan2(dy, dx); }

  function bez(p0, p1, p2, t) {
    const u = 1 - t;
    return {
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y
    };
  }

  function bezTan(p0, p1, p2, t) {
    const u = 1 - t;
    return {
      x: 2 * u * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
      y: 2 * u * (p1.y - p0.y) + 2 * t * (p2.y - p1.y)
    };
  }

  function map(nx, ny, W, H) {
    const px = 36;
    const py = 28;
    return { x: px + nx * (W - px * 2), y: py + ny * (H - py * 2) };
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 960;
    const h = Math.max(220, w * (400 / 960));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function label(c, x, y, text, color, align) {
    c.save();
    c.font = "600 11px Outfit, Inter, sans-serif";
    c.fillStyle = color;
    c.textAlign = align || "left";
    c.textBaseline = "middle";
    c.fillText(text, x, y);
    c.restore();
  }

  function drawVehicle(c, x, y, h, s, fill, stroke) {
    c.save();
    c.translate(x, y);
    c.rotate(h);
    c.beginPath();
    c.moveTo(s * 1.35, 0);
    c.lineTo(-s * 0.95, s * 0.72);
    c.lineTo(-s * 0.55, 0);
    c.lineTo(-s * 0.95, -s * 0.72);
    c.closePath();
    c.fillStyle = fill;
    c.strokeStyle = stroke;
    c.lineWidth = 1.6;
    c.fill();
    c.stroke();
    c.restore();
  }

  function drawShip(c, x, y, h, s, fill, stroke) {
    c.save();
    c.translate(x, y);
    c.rotate(h);
    c.beginPath();
    c.moveTo(s * 1.6, 0);
    c.lineTo(s * 0.4, s * 0.55);
    c.lineTo(-s * 1.15, s * 0.48);
    c.lineTo(-s * 1.35, 0);
    c.lineTo(-s * 1.15, -s * 0.48);
    c.lineTo(s * 0.4, -s * 0.55);
    c.closePath();
    c.fillStyle = fill;
    c.strokeStyle = stroke;
    c.lineWidth = 1.5;
    c.fill();
    c.stroke();
    c.restore();
  }

  function drawDisc(c, x, y, r, fill, stroke, dash) {
    c.save();
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = 1.6;
      if (dash) c.setLineDash(dash);
      c.stroke();
    }
    c.restore();
  }

  function strokePath(c, pts, color, width, dash, alpha) {
    if (pts.length < 2) return;
    c.save();
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
    c.strokeStyle = color;
    c.globalAlpha = alpha == null ? 1 : alpha;
    c.lineWidth = width;
    c.lineCap = "round";
    c.lineJoin = "round";
    if (dash) c.setLineDash(dash);
    c.stroke();
    c.restore();
  }

  function sampleLine(fn, n) {
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(fn(i / n));
    return pts;
  }

  function drawSafe(c, W, H, beat, t, pal, labels) {
    const P = (x, y) => map(x, y, W, H);
    const start = { x: 0.10, y: 0.46 };
    const goal = { x: 0.90, y: 0.42 };
    const obs = { x: 0.58, y: 0.64 };
    const ctrl = { x: 0.50, y: 0.14 };
    const Rturn = 0.16;
    const crashT = 0.62;

    const o = P(obs.x, obs.y);
    const g = P(goal.x, goal.y);
    const s0 = P(start.x, start.y);
    const obsR = Math.min(W, H) * 0.075;

    drawDisc(c, g.x, g.y, 5, pal.primary, null);
    label(c, g.x + 10, g.y - 12, labels.goal, pal.muted);

    const unsafeA = ease(beat === 0 ? Math.min(1, t / 0.35) : 1);
    c.save();
    c.globalAlpha = 0.18 * unsafeA;
    c.fillStyle = "#c23b3b";
    c.beginPath();
    c.arc(o.x, o.y, obsR * 1.55, 0, Math.PI * 2);
    c.fill();
    c.restore();
    drawDisc(c, o.x, o.y, obsR, "rgba(194,59,59,0.22)", "#c23b3b");

    const straight = (u) => P(lerp(start.x, goal.x, u), lerp(start.y, goal.y, u));
    const safePt = (u) => {
      const p = bez(start, ctrl, goal, u);
      return P(p.x, p.y);
    };
    const safeHead = (u) => {
      const d = bezTan(start, ctrl, goal, u);
      return ang(d.x, d.y);
    };

    if (beat === 0) {
      const u = ease(t) * crashT;
      const trail = sampleLine((k) => straight(k * u), 24);
      strokePath(c, trail, "#c23b3b", 2.2, [5, 5], 0.85);
      const p = straight(u);
      const h = ang(goal.x - start.x, goal.y - start.y);
      drawVehicle(c, p.x, p.y, h, 11, pal.primary, pal.secondary);
      if (t > 0.72) {
        const flash = 0.45 + 0.55 * Math.sin(t * 22);
        c.save();
        c.globalAlpha = flash;
        c.strokeStyle = "#c23b3b";
        c.lineWidth = 2.4;
        c.beginPath();
        c.moveTo(o.x - 10, o.y - 10);
        c.lineTo(o.x + 10, o.y + 10);
        c.moveTo(o.x + 10, o.y - 10);
        c.lineTo(o.x - 10, o.y + 10);
        c.stroke();
        c.restore();
        label(c, o.x, o.y + obsR + 16, labels.unsafe, "#c23b3b", "center");
      }
      return;
    }

    const freezeU = 0.38;
    const pose = beat === 1 ? straight(freezeU) : safePt(ease(t));
    const head = beat === 1 ? ang(goal.x - start.x, goal.y - start.y) : safeHead(ease(t));

    if (beat >= 1) {
      const grow = beat === 1 ? ease(clamp(t / 0.45, 0, 1)) : 1;
      const px = beat === 1 ? pose.x : s0.x;
      const py = beat === 1 ? pose.y : s0.y;
      const hd = beat === 1 ? head : ang(goal.x - start.x, goal.y - start.y);
      const r = Rturn * (W - 72) * grow;
      // Canvas y grows down: left of heading +x is up the screen.
      const lx = px + Math.sin(hd) * r;
      const ly = py - Math.cos(hd) * r;
      const rx = px - Math.sin(hd) * r;
      const ry = py + Math.cos(hd) * r;
      drawDisc(c, lx, ly, r, "rgba(29,78,137,0.06)", pal.primary, [4, 4]);
      drawDisc(c, rx, ry, r, "rgba(194,59,59,0.05)", "rgba(194,59,59,0.55)", [4, 4]);
      if (grow > 0.55) {
        label(c, lx, ly, labels.left, pal.primary, "center");
        label(c, rx, ry, labels.right, "#c23b3b", "center");
      }

      const ring = beat === 1 ? ease(clamp((t - 0.4) / 0.35, 0, 1)) : 1;
      if (ring > 0) {
        c.save();
        c.globalAlpha = 0.22 * ring;
        c.strokeStyle = pal.primary;
        c.lineWidth = 10;
        c.beginPath();
        c.arc(o.x, o.y, obsR * 1.85, 0, Math.PI * 2);
        c.stroke();
        c.restore();
        if (ring > 0.7) label(c, o.x + obsR * 2.15, o.y - obsR - 6, labels.safeSet, pal.primary);
      }
      if (beat === 1 && t > 0.78) {
        label(c, px, py + 28, labels.cbf, pal.secondary, "center");
      }
    }

    if (beat === 2) {
      const u = ease(t);
      const trail = sampleLine((k) => safePt(k * u), 28);
      strokePath(c, trail, pal.primary, 2.6, null, 0.95);
      drawVehicle(c, pose.x, pose.y, head, 11, pal.primary, pal.secondary);
      if (t > 0.92) {
        c.save();
        c.strokeStyle = pal.primary;
        c.lineWidth = 2.2;
        c.beginPath();
        c.moveTo(g.x - 6, g.y + 1);
        c.lineTo(g.x - 1, g.y + 7);
        c.lineTo(g.x + 8, g.y - 6);
        c.stroke();
        c.restore();
      }
      return;
    }

    drawVehicle(c, pose.x, pose.y, head, 11, pal.primary, pal.secondary);
  }

  function predictPaths() {
    const start = { x: 0.12, y: 0.62 };
    const goal = { x: 0.90, y: 0.30 };
    const obs = { x: 0.58, y: 0.46 };
    const bestCtrl = { x: 0.48, y: 0.78 };
    const samples = [];
    for (let i = 0; i < 14; i++) {
      const k = (i - 6.5) / 6.5;
      samples.push({
        ctrl: { x: 0.50 + k * 0.04, y: 0.22 + k * 0.62 },
        hit: Math.abs(k) > 0.38 && Math.abs(k) < 0.92 && k < 0.15
      });
    }
    return { start, goal, obs, bestCtrl, samples };
  }

  function drawPredict(c, W, H, beat, t, pal, labels) {
    const P = (x, y) => map(x, y, W, H);
    const world = predictPaths();
    const o = P(world.obs.x, world.obs.y);
    const g = P(world.goal.x, world.goal.y);
    const s0 = P(world.start.x, world.start.y);
    const obsR = Math.min(W, H) * 0.07;
    const head0 = ang(0.22, -0.08);

    drawDisc(c, g.x, g.y, 5, pal.primary, null);
    drawDisc(c, o.x, o.y, obsR, "rgba(194,59,59,0.20)", "#c23b3b");

    const bestFn = (u) => {
      const p = bez(world.start, world.bestCtrl, world.goal, u);
      return P(p.x, p.y);
    };

    if (beat === 0) {
      const shown = Math.floor(ease(t) * 8);
      const pts = [];
      for (let i = 0; i <= shown; i++) pts.push(bestFn(i / 8 * 0.72));
      strokePath(c, pts, pal.primary, 2.2, [6, 5], 0.9);
      pts.forEach((p, i) => {
        if (i === 0) return;
        drawDisc(c, p.x, p.y, 3.2, pal.primary, null);
      });
      if (t > 0.2) label(c, pts.length ? pts[pts.length - 1].x + 8 : s0.x, s0.y - 22, labels.horizon, pal.muted);
      drawVehicle(c, s0.x, s0.y, head0, 11, pal.primary, pal.secondary);
      return;
    }

    if (beat >= 1) {
      const appear = beat === 1 ? ease(t) : 1;
      world.samples.forEach((sm, i) => {
        const delay = i / 18;
        const a = clamp((appear - delay) / 0.55, 0, 1);
        if (a <= 0) return;
        const pts = sampleLine((u) => {
          const p = bez(world.start, sm.ctrl, { x: 0.92, y: world.goal.y + (sm.ctrl.y - 0.5) * 0.2 }, u * 0.82);
          return P(p.x, p.y);
        }, 14);
        const col = sm.hit ? "#c23b3b" : pal.primary;
        strokePath(c, pts, col, 1.3, null, (sm.hit ? 0.28 : 0.38) * a);
      });
      if (beat === 1 && t > 0.35) label(c, W * 0.22, 28, labels.samples, pal.muted);

      const tubeA = beat === 1 ? ease(clamp((t - 0.55) / 0.4, 0, 1)) : 1;
      if (tubeA > 0) {
        const core = sampleLine(bestFn, 20);
        c.save();
        c.globalAlpha = 0.16 * tubeA;
        c.strokeStyle = pal.secondary;
        c.lineWidth = 22;
        c.lineCap = "round";
        c.lineJoin = "round";
        c.beginPath();
        c.moveTo(core[0].x, core[0].y);
        core.forEach((p) => c.lineTo(p.x, p.y));
        c.stroke();
        c.restore();
        strokePath(c, core, pal.secondary, 2.6, null, 0.95 * tubeA);
        if (tubeA > 0.65) {
          label(c, core[10].x + 10, core[10].y + 18, labels.best, pal.secondary);
          label(c, core[6].x - 8, core[6].y + 26, labels.tube, pal.muted, "right");
        }
      }
    }

    const u = beat === 2 ? ease(t) * 0.78 : 0;
    const pos = beat === 2 ? bestFn(u) : s0;
    const tan = beat === 2 ? bezTan(world.start, world.bestCtrl, world.goal, u) : { x: 1, y: -0.3 };
    drawVehicle(c, pos.x, pos.y, ang(tan.x, tan.y), 11, pal.primary, pal.secondary);

    if (beat === 2) {
      const remain = sampleLine((k) => bestFn(u + (1 - u) * k * 0.55), 10);
      strokePath(c, remain, pal.primary, 1.8, [5, 5], 0.7);
      const executed = sampleLine((k) => bestFn(k * u), 16);
      strokePath(c, executed, pal.secondary, 2.4, null, 0.95);
    }
  }

  function canalWalls() {
    const top = [];
    const bot = [];
    for (let i = 0; i <= 20; i++) {
      const x = i / 20;
      top.push({ x: x, y: 0.18 + Math.sin(x * 5.2) * 0.04 + (x > 0.55 ? 0.04 : 0) });
      bot.push({ x: x, y: 0.82 - Math.sin(x * 4.6) * 0.05 - (x > 0.4 && x < 0.7 ? 0.06 : 0) });
    }
    return { top, bot };
  }

  function canalPath(u) {
    return {
      x: lerp(0.10, 0.90, u),
      y: 0.52 + Math.sin(u * 4.8) * 0.06
    };
  }

  function drawMobile(c, W, H, beat, t, pal, labels) {
    const P = (x, y) => map(x, y, W, H);
    const walls = canalWalls();
    const top = walls.top.map((p) => P(p.x, p.y));
    const bot = walls.bot.map((p) => P(p.x, p.y));

    c.save();
    c.fillStyle = "rgba(29,78,137,0.08)";
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(W, 0);
    top.forEach((p) => c.lineTo(p.x, p.y));
    c.lineTo(W, 0);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(0, H);
    bot.forEach((p) => c.lineTo(p.x, p.y));
    c.lineTo(W, H);
    c.closePath();
    c.fill();
    c.restore();
    strokePath(c, top, pal.secondary, 1.6, null, 0.45);
    strokePath(c, bot, pal.secondary, 1.6, null, 0.45);

    const u0 = beat === 2 ? ease(t) : 0.08;
    const p = canalPath(u0);
    const pn = canalPath(Math.min(1, u0 + 0.02));
    const pos = P(p.x, p.y);
    const head = ang(pn.x - p.x, pn.y - p.y);

    if (beat === 0) {
      const sweep = ease(t) * Math.PI * 0.92;
      const rays = 18;
      for (let i = 0; i < rays; i++) {
        const a = head - 0.7 + (i / (rays - 1)) * 1.4;
        const on = clamp((sweep - (i / rays) * Math.PI * 0.92) * 3, 0, 1);
        if (on <= 0) continue;
        const len = 70 + (i % 4) * 10;
        c.save();
        c.strokeStyle = pal.primary;
        c.globalAlpha = 0.18 + 0.35 * on;
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(pos.x, pos.y);
        c.lineTo(pos.x + Math.cos(a) * len, pos.y + Math.sin(a) * len);
        c.stroke();
        c.restore();
      }
      if (t > 0.25) label(c, pos.x + 16, pos.y - 22, labels.sense, pal.primary);
    }

    if (beat >= 1) {
      const drawn = beat === 1 ? ease(t) : 1;
      const path = sampleLine((k) => P(canalPath(k * drawn).x, canalPath(k * drawn).y), 28);
      strokePath(c, path, pal.primary, 2.4, beat === 1 ? [7, 5] : null, 0.95);
      if (beat === 1 && t > 0.2) label(c, path[Math.floor(path.length * 0.55)].x, path[Math.floor(path.length * 0.55)].y - 16, labels.plan, pal.primary);
    }

    if (beat === 2) {
      const executed = sampleLine((k) => P(canalPath(k * u0).x, canalPath(k * u0).y), 24);
      strokePath(c, executed, pal.secondary, 2.6, null, 0.95);
      if (t > 0.55) {
        c.save();
        c.globalAlpha = ease(clamp((t - 0.55) / 0.3, 0, 1));
        c.fillStyle = pal.primary;
        c.font = "700 11px Outfit, Inter, sans-serif";
        c.fillText(labels.field.toUpperCase(), W - 78, 26);
        c.restore();
      }
    }

    drawShip(c, pos.x, pos.y, head, 12, pal.primary, pal.secondary);
  }

  function draw() {
    const W = canvas.clientWidth || 960;
    const H = canvas.clientHeight || Math.max(220, W * (400 / 960));
    ctx.clearRect(0, 0, W, H);
    const pal = theme();
    const labels = copy().cores[state.core].labels;
    ctx.save();
    ctx.font = "700 12px Outfit, Inter, sans-serif";
    ctx.fillStyle = pal.muted;
    ctx.globalAlpha = 0.45;
    const tag = { safe: "01  SAFE", predict: "02  PREDICT", mobile: "03  FIELD" }[state.core];
    ctx.fillText(tag, 16, 20);
    ctx.restore();

    if (state.core === "safe") drawSafe(ctx, W, H, state.beat, state.t, pal, labels);
    else if (state.core === "predict") drawPredict(ctx, W, H, state.beat, state.t, pal, labels);
    else drawMobile(ctx, W, H, state.beat, state.t, pal, labels);
  }

  function syncCaption() {
    const pack = copy().cores[state.core];
    const beat = pack.beats[state.beat];
    stepEl.textContent = (state.beat + 1) + " / 3";
    titleEl.textContent = beat.title;
    bodyEl.textContent = beat.body;
    if (progEl) progEl.style.width = (state.t * 100).toFixed(1) + "%";
    if (dotsEl) {
      Array.from(dotsEl.children).forEach((dot, i) => {
        dot.classList.toggle("is-on", i === state.beat);
      });
    }
    cards.forEach((card) => {
      const on = card.getAttribute("data-core") === state.core;
      card.classList.toggle("is-active", on);
      card.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if (skipBtn) {
      skipBtn.textContent = state.done ? copy().replay : copy().skip;
      skipBtn.classList.toggle("is-replay", state.done);
      skipBtn.classList.remove("is-hidden");
    }
  }

  function gotoBeat(core, beat, opts) {
    opts = opts || {};
    state.core = core;
    state.beat = clamp(beat, 0, 2);
    state.t = opts.finish ? 1 : 0;
    state.playing = !opts.finish && !reduce;
    state.done = !!opts.finish && state.beat === 2;
    state.holding = false;
    state.beatStart = performance.now();
    if (opts.finish || reduce) {
      state.t = 1;
      state.playing = false;
      state.done = state.beat === 2;
    }
    syncCaption();
    draw();
  }

  function playCore(core, scroll) {
    gotoBeat(core, 0, { finish: reduce });
    if (scroll) {
      const r = root.getBoundingClientRect();
      if (r.top > window.innerHeight * 0.58) {
        root.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      }
    }
  }

  function finishCore() {
    gotoBeat(state.core, 2, { finish: true });
  }

  function step(dir) {
    let beat = state.beat + dir;
    let core = state.core;
    if (beat > 2) {
      const i = (CORES.indexOf(core) + 1) % CORES.length;
      core = CORES[i];
      beat = 0;
    } else if (beat < 0) {
      const i = (CORES.indexOf(core) + CORES.length - 1) % CORES.length;
      core = CORES[i];
      beat = 2;
    }
    gotoBeat(core, beat, { finish: reduce });
  }

  function tick(now) {
    state.raf = requestAnimationFrame(tick);
    if (!state.visible) return;
    if (state.playing && !state.holding) {
      state.t = clamp((now - state.beatStart) / BEAT_MS, 0, 1);
      if (progEl) progEl.style.width = (state.t * 100).toFixed(1) + "%";
      draw();
      if (state.t >= 1) {
        if (state.beat >= 2) {
          state.playing = false;
          state.done = true;
          syncCaption();
        } else {
          state.holding = true;
          state.holdUntil = now + HOLD_MS;
        }
      }
    } else if (state.holding && now >= state.holdUntil) {
      gotoBeat(state.core, state.beat + 1);
    } else {
      draw();
    }
  }

  function bindCards() {
    cards.forEach((card) => {
      const activate = () => playCore(card.getAttribute("data-core"), true);
      card.addEventListener("click", activate);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      });
    });
  }

  function bindNav() {
    if (dotsEl) {
      for (let i = 0; i < 3; i++) {
        const b = document.createElement("button");
        b.type = "button";
        b.setAttribute("aria-label", "Beat " + (i + 1));
        b.addEventListener("click", () => gotoBeat(state.core, i, { finish: reduce }));
        dotsEl.appendChild(b);
      }
    }
    if (prevBtn) prevBtn.addEventListener("click", () => step(-1));
    if (nextBtn) nextBtn.addEventListener("click", () => step(1));
    if (skipBtn) {
      skipBtn.addEventListener("click", () => {
        if (state.done) playCore(state.core, false);
        else finishCore();
      });
    }
    root.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    });
    root.setAttribute("tabindex", "0");
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  window.addEventListener("resize", resize);

  new MutationObserver(() => syncCaption()).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-lang"]
  });

  bindCards();
  bindNav();
  resize();
  syncCaption();

  if (reduce) {
    gotoBeat("safe", 2, { finish: true });
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        state.visible = en.isIntersecting;
        if (en.isIntersecting && !state.playing && !state.done && state.beat === 0 && state.t === 0) {
          gotoBeat("safe", 0);
        }
      });
    }, { threshold: 0.35 });
    io.observe(root);
  }

  state.raf = requestAnimationFrame(tick);
})();

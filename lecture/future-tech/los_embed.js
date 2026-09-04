(function () {
'use strict';

function demoVisible() {
  var page = document.getElementById('lecture-future');
  var block = document.getElementById('sim-los');
  if (!page && !block) return true;
  if (page && page.classList.contains('hidden-page')) return false;
  if (block && block.classList.contains('is-hidden')) return false;
  return true;
}

var PI = Math.PI, D2R = PI / 180;
function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function hypot(x, y) { return Math.hypot(x, y); }

var WPS = [
  { x: 4, y: 6 },
  { x: 16, y: 18 },
  { x: 26, y: 6 },
  { x: 38, y: 17 }
];
var WORLD = { w: 42, h: 24 };
var P = { delta: 4, Racc: 1.8, v: 1.7, kPsi: 2.4, wmax: 95 * D2R, dt: 0.02, e0: 2.6, psi0: 40 * D2R };

var S = {
  k: 0, x: 0, y: 0, yaw: 0,
  t: 0, running: false, done: false, prevToB: 1e9,
  trail: [], g: null
};

var cv = document.getElementById('los-cv');
if (!cv) return;
var ctx = cv.getContext('2d');
var view = { W: 0, H: 0, scale: 1, ox: 0, oy: 0, dpr: 1 };

function w2sx(x) { return view.ox + x * view.scale; }
function w2sy(y) { return view.oy + (WORLD.h - y) * view.scale; }

function nSeg() { return WPS.length - 1; }
function seg(k) {
  var A = WPS[k], B = WPS[k + 1];
  var dx = B.x - A.x, dy = B.y - A.y;
  return { A: A, B: B, alpha: Math.atan2(dy, dx), L: hypot(dx, dy) };
}

function pointAhead(k, s0, dist) {
  var rem = Math.max(s0, 0) + dist;
  var i = k;
  var n;
  for (n = 0; n < 8; n++) {
    if (i >= nSeg()) {
      var last = WPS[WPS.length - 1];
      return { x: last.x, y: last.y };
    }
    var sg = seg(i);
    if (rem <= sg.L) {
      return {
        x: sg.A.x + rem * Math.cos(sg.alpha),
        y: sg.A.y + rem * Math.sin(sg.alpha)
      };
    }
    rem -= sg.L;
    i += 1;
  }
  var end = WPS[WPS.length - 1];
  return { x: end.x, y: end.y };
}

function guidance() {
  var g = seg(S.k);
  var ca = Math.cos(g.alpha), sa = Math.sin(g.alpha);
  var dx = S.x - g.A.x, dy = S.y - g.A.y;
  var s = dx * ca + dy * sa;
  var e = -dx * sa + dy * ca;
  var sFoot = clamp(s, 0, g.L);
  var foot = { x: g.A.x + sFoot * ca, y: g.A.y + sFoot * sa };
  var losPt = pointAhead(S.k, sFoot, P.delta);
  var losOff = Math.atan2(-e, P.delta);
  var chid = g.alpha + losOff;
  return { alpha: g.alpha, s: s, e: e, L: g.L, A: g.A, B: g.B, foot: foot, losPt: losPt, chid: chid, losOff: losOff };
}

function reset() {
  S.k = 0; S.t = 0; S.done = false; S.prevToB = 1e9; S.trail = []; S.g = null;
  var g = seg(0);
  S.x = g.A.x - P.e0 * Math.sin(g.alpha);
  S.y = g.A.y + P.e0 * Math.cos(g.alpha);
  S.yaw = wrap(g.alpha + P.psi0);
  S.trail.push({ x: S.x, y: S.y });
  S.g = guidance();
  syncReadout();
  draw();
}

function step(dt) {
  if (S.done) return;
  var g = guidance();
  S.g = g;
  var ePsi = wrap(g.alpha - S.yaw) + g.losOff;
  var w = clamp(P.kPsi * ePsi, -P.wmax, P.wmax);
  S.x += P.v * Math.cos(S.yaw) * dt;
  S.y += P.v * Math.sin(S.yaw) * dt;
  S.yaw = wrap(S.yaw + w * dt);
  S.t += dt;
  var last = S.trail[S.trail.length - 1];
  if (!last || hypot(S.x - last.x, S.y - last.y) > 0.08) S.trail.push({ x: S.x, y: S.y });
  if (S.trail.length > 1400) S.trail.shift();

  var toB = hypot(g.B.x - S.x, g.B.y - S.y);
  var hit = toB < P.Racc;
  var missed = g.s > g.L && toB > S.prevToB && toB > P.Racc;
  if (hit || missed) {
    if (S.k < nSeg() - 1) {
      S.k += 1;
      S.prevToB = 1e9;
    } else S.done = true;
  } else {
    S.prevToB = toB;
  }
}

function resize() {
  var box = cv.parentElement;
  var cssW = Math.max(box.clientWidth || 320, 160);
  var cssH = Math.max(box.clientHeight || 240, 180);
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  view.W = cssW; view.H = cssH; view.dpr = dpr;
  cv.width = Math.round(cssW * dpr);
  cv.height = Math.round(cssH * dpr);
  var pad = 18;
  var sx = (cssW - 2 * pad) / WORLD.w;
  var sy = (cssH - 2 * pad) / WORLD.h;
  view.scale = Math.min(sx, sy);
  view.ox = (cssW - WORLD.w * view.scale) / 2;
  view.oy = (cssH - WORLD.h * view.scale) / 2;
  draw();
}

function themePal() {
  var dark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (dark) {
    return {
      bg: '#1a2d44', grid: '#2a3848', track: '#5eb1ff', mark: '#e0a458',
      markSoft: 'rgba(224,164,88,0.18)', markMid: 'rgba(224,164,88,0.42)',
      wp: '#6ea3d8', wpMid: '#121a24', trail: '#5cc793',
      err: 'rgba(240,146,137,.55)', sight: '#8bc34a', hull: '#5cc793'
    };
  }
  return {
    bg: '#dce7ee', grid: '#c5d5de', track: '#0369a1', mark: '#b45309',
    markSoft: 'rgba(180,83,9,0.14)', markMid: 'rgba(180,83,9,0.38)',
    wp: '#1d4e89', wpMid: '#ffffff', trail: '#15803d',
    err: 'rgba(190,18,60,.45)', sight: '#4d7c0f', hull: '#15803d'
  };
}

function draw() {
  var w = view.W, h = view.H;
  if (!w || !h) return;
  var C = themePal();
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.beginPath();
  ctx.rect(view.ox, view.oy, WORLD.w * view.scale, WORLD.h * view.scale);
  ctx.clip();

  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  var gx;
  for (gx = 0; gx <= WORLD.w; gx += 2) {
    ctx.beginPath();
    ctx.moveTo(w2sx(gx), w2sy(0));
    ctx.lineTo(w2sx(gx), w2sy(WORLD.h));
    ctx.stroke();
  }
  for (gx = 0; gx <= WORLD.h; gx += 2) {
    ctx.beginPath();
    ctx.moveTo(w2sx(0), w2sy(gx));
    ctx.lineTo(w2sx(WORLD.w), w2sy(gx));
    ctx.stroke();
  }

  ctx.strokeStyle = C.track;
  ctx.lineWidth = 3.2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(w2sx(WPS[0].x), w2sy(WPS[0].y));
  var i;
  for (i = 1; i < WPS.length; i++) ctx.lineTo(w2sx(WPS[i].x), w2sy(WPS[i].y));
  ctx.stroke();

  var tgt = S.k + 1;
  for (i = 1; i < WPS.length; i++) {
    var rPx = Math.max(P.Racc * view.scale, 2);
    ctx.beginPath();
    ctx.arc(w2sx(WPS[i].x), w2sy(WPS[i].y), rPx, 0, 2 * PI);
    if (i === tgt) {
      ctx.fillStyle = C.markSoft;
      ctx.fill();
      ctx.strokeStyle = C.mark;
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = C.markMid;
      ctx.lineWidth = 1.2;
    }
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (i = 0; i < WPS.length; i++) {
    ctx.beginPath();
    ctx.fillStyle = i === 0 ? C.wp : (i === WPS.length - 1 ? C.mark : C.wpMid);
    ctx.strokeStyle = C.wp;
    ctx.lineWidth = 2;
    ctx.arc(w2sx(WPS[i].x), w2sy(WPS[i].y), 5, 0, 2 * PI);
    ctx.fill();
    ctx.stroke();
  }

  if (S.trail.length > 1) {
    ctx.strokeStyle = C.trail;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(w2sx(S.trail[0].x), w2sy(S.trail[0].y));
    for (i = 1; i < S.trail.length; i++) ctx.lineTo(w2sx(S.trail[i].x), w2sy(S.trail[i].y));
    ctx.stroke();
  }

  var g = S.g || guidance();
  ctx.strokeStyle = C.err;
  ctx.lineWidth = 1.4;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(w2sx(S.x), w2sy(S.y));
  ctx.lineTo(w2sx(g.foot.x), w2sy(g.foot.y));
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = C.sight;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(w2sx(S.x), w2sy(S.y));
  ctx.lineTo(w2sx(g.losPt.x), w2sy(g.losPt.y));
  ctx.stroke();
  ctx.fillStyle = C.sight;
  ctx.beginPath();
  ctx.arc(w2sx(g.losPt.x), w2sy(g.losPt.y), 4.5, 0, 2 * PI);
  ctx.fill();

  ctx.save();
  ctx.translate(w2sx(S.x), w2sy(S.y));
  ctx.rotate(-S.yaw);
  ctx.fillStyle = C.hull;
  ctx.beginPath();
  ctx.moveTo(11, 0);
  ctx.lineTo(-8, 7);
  ctx.lineTo(-5, 0);
  ctx.lineTo(-8, -7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function syncReadout() {
  var dv = document.getElementById('los-deltaV');
  var dr = document.getElementById('los-dRead');
  var rv = document.getElementById('los-raccV');
  var rr = document.getElementById('los-rRead');
  var ev = document.getElementById('los-e');
  var dTxt = P.delta.toFixed(1);
  var rTxt = P.Racc.toFixed(1);
  if (dv) dv.textContent = dTxt;
  if (dr) dr.textContent = dTxt + ' m';
  if (rv) rv.textContent = rTxt;
  if (rr) rr.textContent = rTxt + ' m';
  if (ev) ev.textContent = S.g ? ((S.g.e >= 0 ? '+' : '') + S.g.e.toFixed(2) + ' m') : '—';
  var play = document.getElementById('los-btnPlay');
  if (play) {
    play.textContent = S.running ? '정지' : '시작';
    play.classList.toggle('danger', S.running);
  }
}

function setDelta(v) {
  P.delta = clamp(Number(v), 0.8, 12);
  S.g = guidance();
  syncReadout();
  draw();
}

function setRacc(v) {
  P.Racc = clamp(Number(v), 0.4, 6);
  syncReadout();
  draw();
}

function togglePlay() {
  if (S.done) reset();
  S.running = !S.running;
  syncReadout();
}

window.addEventListener('sail-themechange', function () { draw(); });

window.refresh_los_demo = function () {
  if (!demoVisible()) return;
  if (S.done) reset();
  S.running = true;
  syncReadout();
  resize();
};

var acc = 0, last = performance.now();
function loop(now) {
  if (!demoVisible()) {
    S.running = false;
    last = now;
    acc = 0;
    syncReadout();
    requestAnimationFrame(loop);
    return;
  }
  var real = Math.min((now - last) / 1000, 0.08);
  last = now;
  if (S.running && !S.done) {
    acc += real;
    while (acc >= P.dt) {
      step(P.dt);
      acc -= P.dt;
    }
    if (S.done) {
      reset();
      S.running = true;
    }
    syncReadout();
    draw();
  } else {
    acc = 0;
  }
  requestAnimationFrame(loop);
}

(function bind() {
  var sl = document.getElementById('los-delta');
  if (sl) {
    sl.value = String(P.delta);
    sl.oninput = function () { setDelta(sl.value); };
  }
  var sr = document.getElementById('los-racc');
  if (sr) {
    sr.value = String(P.Racc);
    sr.oninput = function () { setRacc(sr.value); };
  }
  var play = document.getElementById('los-btnPlay');
  var rst = document.getElementById('los-btnReset');
  if (play) play.onclick = togglePlay;
  if (rst) rst.onclick = function () { reset(); S.running = true; syncReadout(); };
  window.addEventListener('resize', function () {
    if (demoVisible()) resize();
  });
  if (window.ResizeObserver && cv.parentElement) {
    new ResizeObserver(function () { if (demoVisible()) resize(); }).observe(cv.parentElement);
  }
  reset();
  S.running = true;
  syncReadout();
  resize();
  requestAnimationFrame(function (t) { last = t; loop(t); });
})();

})();

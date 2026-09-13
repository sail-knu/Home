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
var P = {
  delta: 4, Racc: 1.8, v: 1.7,
  kp: 2.4, ki: 0, kd: 0, iLim: 2.5,
  wmax: 38 * D2R, tauR: 1.0, dt: 0.02, dfc: 0.06,
  e0: 2.6, psi0: 40 * D2R
};

var S = {
  k: 0, x: 0, y: 0, yaw: 0, r: 0,
  t: 0, running: false, done: false, first: true,
  iPsi: 0, ePsi: 0, ePsiPrev: 0, ePsiDot: 0, prevToB: 1e9,
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

function guidance() {
  var g = seg(S.k);
  var ca = Math.cos(g.alpha), sa = Math.sin(g.alpha);
  var dx = S.x - g.A.x, dy = S.y - g.A.y;
  var s = dx * ca + dy * sa;
  var e = -dx * sa + dy * ca;
  var sFoot = clamp(s, 0, g.L);
  var foot = { x: g.A.x + sFoot * ca, y: g.A.y + sFoot * sa };
  var sLos = Math.max(s, 0) + P.delta;
  var losPt = { x: g.A.x + sLos * ca, y: g.A.y + sLos * sa };
  var losOff = Math.atan2(-e, P.delta);
  var chid = g.alpha + losOff;
  return {
    alpha: g.alpha, s: s, e: e, L: g.L, A: g.A, B: g.B,
    ca: ca, sa: sa, sLos: sLos,
    foot: foot, losPt: losPt, chid: chid, losOff: losOff
  };
}

function resetPid() {
  S.first = true;
  S.iPsi = 0;
  S.ePsi = 0;
  S.ePsiPrev = 0;
  S.ePsiDot = 0;
}

function reset() {
  S.k = 0; S.t = 0; S.r = 0; S.done = false; S.prevToB = 1e9; S.trail = []; S.g = null;
  resetPid();
  var g = seg(0);
  S.x = g.A.x - P.e0 * Math.sin(g.alpha);
  S.y = g.A.y + P.e0 * Math.cos(g.alpha);
  S.yaw = wrap(g.alpha + P.psi0);
  S.trail.push({ x: S.x, y: S.y });
  S.g = guidance();
  S.ePsi = wrap(S.g.chid - S.yaw);
  syncReadout();
  draw();
}

function step(dt) {
  if (S.done) return;
  var g = guidance();
  S.g = g;
  var ePsi = wrap(g.chid - S.yaw);
  if (S.first) {
    S.ePsiPrev = ePsi;
    S.ePsiDot = 0;
    S.first = false;
  } else {
    var dE = wrap(ePsi - S.ePsiPrev) / dt;
    var kf = dt / (dt + P.dfc);
    S.ePsiDot += (dE - S.ePsiDot) * kf;
  }
  S.ePsiPrev = ePsi;
  S.ePsi = ePsi;
  if (P.ki <= 0) S.iPsi = 0;
  else S.iPsi = clamp(S.iPsi + ePsi * dt, -P.iLim, P.iLim);
  var wCmd = clamp(P.kp * ePsi + P.ki * S.iPsi + P.kd * S.ePsiDot, -P.wmax, P.wmax);
  S.r += (wCmd - S.r) * (dt / P.tauR);
  S.x += P.v * Math.cos(S.yaw) * dt;
  S.y += P.v * Math.sin(S.yaw) * dt;
  S.yaw = wrap(S.yaw + S.r * dt);
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
      resetPid();
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

  var g = S.g || guidance();
  if (g.sLos > g.L + 1e-6) {
    var extS = g.sLos + 1.2;
    ctx.strokeStyle = C.track;
    ctx.lineWidth = 2.4;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.moveTo(w2sx(g.B.x), w2sy(g.B.y));
    ctx.lineTo(w2sx(g.A.x + extS * g.ca), w2sy(g.A.y + extS * g.sa));
    ctx.stroke();
    ctx.setLineDash([]);
  }

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

function fmtSigned(v, digits, unit) {
  return (v >= 0 ? '+' : '') + v.toFixed(digits) + unit;
}

function syncReadout() {
  var dv = document.getElementById('los-deltaV');
  var dr = document.getElementById('los-dRead');
  var rv = document.getElementById('los-raccV');
  var rr = document.getElementById('los-rRead');
  var ev = document.getElementById('los-e');
  var ep = document.getElementById('los-epsi');
  var kp = document.getElementById('los-kpV');
  var ki = document.getElementById('los-kiV');
  var kd = document.getElementById('los-kdV');
  var dTxt = P.delta.toFixed(1);
  var rTxt = P.Racc.toFixed(1);
  if (dv) dv.textContent = dTxt;
  if (dr) dr.textContent = dTxt + ' m';
  if (rv) rv.textContent = rTxt;
  if (rr) rr.textContent = rTxt + ' m';
  if (kp) kp.textContent = P.kp.toFixed(2);
  if (ki) ki.textContent = P.ki.toFixed(2);
  if (kd) kd.textContent = P.kd.toFixed(2);
  if (ev) ev.textContent = S.g ? fmtSigned(S.g.e, 2, ' m') : '—';
  if (ep) {
    var ePsi = S.g ? wrap(S.g.chid - S.yaw) : S.ePsi;
    ep.textContent = S.g ? fmtSigned(ePsi / D2R, 1, '°') : '—';
  }
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

function setGain(key, v, lo, hi) {
  P[key] = clamp(Number(v), lo, hi);
  if (key === 'ki' && P.ki <= 0) S.iPsi = 0;
  syncReadout();
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
  var kp = document.getElementById('los-kp');
  var ki = document.getElementById('los-ki');
  var kd = document.getElementById('los-kd');
  if (kp) {
    kp.value = String(P.kp);
    kp.oninput = function () { setGain('kp', kp.value, 0, 6); };
  }
  if (ki) {
    ki.value = String(P.ki);
    ki.oninput = function () { setGain('ki', ki.value, 0, 2); };
  }
  if (kd) {
    kd.value = String(P.kd);
    kd.oninput = function () { setGain('kd', kd.value, 0, 3); };
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

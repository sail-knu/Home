(function () {
'use strict';

function demoVisible() {
  var page = document.getElementById('lecture-future');
  var block = document.getElementById('sim-pid');
  if (!page && !block) return true;
  if (page && page.classList.contains('hidden-page')) return false;
  if (block && block.classList.contains('is-hidden')) return false;
  return true;
}

var G = 9.81, PHYS_DT = 0.001, CTRL_HZ = 100, FALL_WAIT = 1.2, TH0 = 0.35;
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function fx(v, d) {
  var s = v.toFixed(d);
  return /^-0\.?0*$/.test(s) ? s.slice(1) : s;
}

function derivative(s, F, p) {
  var v = s[1], th = s[2], om = s[3];
  var st = Math.sin(th), ct = Math.cos(th);
  var Fnet = F - p.b * v;
  var num = Fnet + p.mb * G * st * ct - p.mb * p.L * om * om * st;
  var den = p.mc + p.mb - p.mb * ct * ct;
  var xdd = num / den;
  return [v, xdd, om, (xdd * ct + G * st) / p.L];
}

function rk4(s, F, p, dt) {
  var h = dt / 2;
  var k1 = derivative(s, F, p);
  var k2 = derivative([s[0]+k1[0]*h, s[1]+k1[1]*h, s[2]+k1[2]*h, s[3]+k1[3]*h], F, p);
  var k3 = derivative([s[0]+k2[0]*h, s[1]+k2[1]*h, s[2]+k2[2]*h, s[3]+k2[3]*h], F, p);
  var k4 = derivative([s[0]+k3[0]*dt, s[1]+k3[1]*dt, s[2]+k3[2]*dt, s[3]+k3[3]*dt], F, p);
  return [
    s[0] + (k1[0] + 2*k2[0] + 2*k3[0] + k4[0]) / 6 * dt,
    s[1] + (k1[1] + 2*k2[1] + 2*k3[1] + k4[1]) / 6 * dt,
    s[2] + (k1[2] + 2*k2[2] + 2*k3[2] + k4[2]) / 6 * dt,
    s[3] + (k1[3] + 2*k2[3] + 2*k3[3] + k4[3]) / 6 * dt
  ];
}

var P = { mc: 1, mb: 1, L: 2, b: 0, kP: 0, kD: 0 };
var S = {
  x: 0, v: 0, th: TH0, om: 0, F: 0, t: 0,
  running: false, fell: false, fellT: 0
};

var cv = document.getElementById('pid-cv');
if (!cv) return;
var ctx = cv.getContext('2d');
var view = { W: 0, H: 0, dpr: 1, camX: 0 };

function vec() { return [S.x, S.v, S.th, S.om]; }
function apply(s) { S.x = s[0]; S.v = s[1]; S.th = s[2]; S.om = s[3]; }

function resetCtrl() {
  S.F = 0;
}

function updateCtrl() {
  S.F = -P.kP * S.th - P.kD * S.om;
}

function reset() {
  S.x = 0; S.v = 0; S.th = TH0; S.om = 0;
  S.t = 0; S.fell = false; S.fellT = 0;
  ctrlAcc = 0;
  resetCtrl();
  view.camX = 0;
  syncReadout();
  draw();
}

var ctrlAcc = 0;
function step(dt) {
  if (S.fell) {
    S.fellT += dt;
    if (S.fellT > FALL_WAIT) { reset(); S.running = true; }
    return;
  }
  ctrlAcc += dt;
  var cdt = 1 / CTRL_HZ;
  if (ctrlAcc >= cdt - 1e-12) {
    ctrlAcc -= cdt;
    updateCtrl();
  }
  apply(rk4(vec(), S.F, P, dt));
  S.t += dt;
  if (Math.abs(S.th) > Math.PI / 2) {
    S.fell = true;
    S.fellT = 0;
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
  draw();
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function draw() {
  var w = view.W, h = view.H;
  if (!w || !h) return;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  var sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#f7f8fa');
  sky.addColorStop(1, '#eef4f3');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  var railY = h - 48;
  var Lm = Math.max(P.L, 0.6);
  var ppmMax = (railY - 36) / Lm;
  var i;
  for (i = 0; i < 4; i++) {
    var chG = Math.max(22, ppmMax * 0.30);
    var brG = Math.max(11, ppmMax * 0.115);
    ppmMax = (railY + 6 - 4 - chG - brG) / Lm;
  }
  var ppm = Math.max(1, Math.min(Math.max(22, Math.min(w / 7, 120)), ppmMax));
  var half = (w / ppm) * 0.22;
  if (S.x > view.camX + half) view.camX = S.x - half;
  if (S.x < view.camX - half) view.camX = S.x + half;
  function sx(wx) { return (wx - view.camX) * ppm + w / 2; }

  var left = view.camX - (w / 2) / ppm, right = view.camX + (w / 2) / ppm;
  var tick = ppm < 45 ? 2 : 1;
  ctx.font = '11px Consolas, monospace';
  ctx.textAlign = 'center';
  for (var m = Math.ceil(left / tick) * tick; m <= right; m += tick) {
    var px = sx(m);
    ctx.strokeStyle = '#c8d2e0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, railY + 12);
    ctx.lineTo(px, railY + 18);
    ctx.stroke();
    ctx.fillStyle = '#95a2b4';
    ctx.fillText(m + ' m', px, railY + 31);
  }

  var zx = sx(0);
  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(zx, 22);
  ctx.lineTo(zx, railY + 10);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  ctx.fillText('x = 0', zx, 16);

  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(0, railY + 8, w, 4);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, railY + 12, w, 3);

  var cx = sx(S.x);
  var cw = Math.max(44, ppm * 0.62), ch = Math.max(22, ppm * 0.30);
  var cyTop = railY - ch + 6;
  ctx.fillStyle = '#0f172a22';
  ctx.beginPath();
  ctx.ellipse(cx, railY + 10, cw * 0.6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  roundRect(ctx, cx - cw / 2, cyTop, cw, ch, 5);
  ctx.fillStyle = '#334155';
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '600 11px sans-serif';
  ctx.fillText(P.mc + ' kg', cx, cyTop + ch / 2 + 4);
  var wr = Math.max(6, ch * 0.30);
  for (i = 0; i < 2; i++) {
    var off = i ? cw * 0.28 : -cw * 0.28;
    ctx.beginPath();
    ctx.arc(cx + off, railY + 8 - wr * 0.2, wr, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + off, railY + 8 - wr * 0.2, wr * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#94a3b8';
    ctx.fill();
  }

  var py = cyTop, th = S.th;
  var tipX = cx - Math.sin(th) * P.L * ppm;
  var tipY = py - Math.cos(th) * P.L * ppm;
  ctx.save();
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = '#b6c2d2';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, py);
  ctx.lineTo(cx, py - P.L * ppm * 0.55);
  ctx.stroke();
  ctx.restore();
  var thW = Math.atan2(Math.sin(th), Math.cos(th));
  if (Math.abs(thW) > 0.02 && Math.abs(thW) < 2.4) {
    var r = Math.min(40, P.L * ppm * 0.42);
    ctx.strokeStyle = '#1d4e89';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, py, r, -Math.PI / 2, -Math.PI / 2 - thW, thW > 0);
    ctx.stroke();
    ctx.fillStyle = '#1d4e89';
    ctx.font = '600 12px sans-serif';
    ctx.fillText('θ', cx - Math.sin(thW / 2) * (r + 13), py - Math.cos(thW / 2) * (r + 13) + 4);
  }
  ctx.strokeStyle = S.fell ? '#c8433a' : '#475569';
  ctx.lineWidth = Math.max(4, ppm * 0.045);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, py);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, py, Math.max(4, ppm * 0.04), 0, Math.PI * 2);
  ctx.fillStyle = '#94a3b8';
  ctx.fill();
  var br = Math.max(11, ppm * 0.115);
  ctx.beginPath();
  ctx.arc(tipX, tipY, br, 0, Math.PI * 2);
  ctx.fillStyle = S.fell ? '#c8433a' : '#1d4e89';
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '600 10px sans-serif';
  ctx.fillText(P.mb + 'kg', tipX, tipY + 3.5);

  if (Math.abs(S.F) > 0.05) {
    var len = Math.min(90, Math.abs(S.F) * 1.8) * Math.sign(S.F);
    var ay = cyTop + ch / 2;
    var from = cx + Math.sign(S.F) * (cw / 2 + 3);
    ctx.strokeStyle = '#c8433a';
    ctx.fillStyle = '#c8433a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(from, ay);
    ctx.lineTo(from + len, ay);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(from + len + Math.sign(S.F) * 9, ay);
    ctx.lineTo(from + len, ay - 6);
    ctx.lineTo(from + len, ay + 6);
    ctx.closePath();
    ctx.fill();
    ctx.font = '600 11px Consolas, monospace';
    ctx.fillText(S.F.toFixed(1) + ' N', from + len / 2, ay - 11);
  }

  ctx.textAlign = 'left';
  ctx.font = '600 12px sans-serif';
  if (S.fell) {
    ctx.fillStyle = '#c8433a';
    ctx.fillText('넘어짐 (|θ| > 90°)', 12, 22);
  } else if (S.running) {
    ctx.fillStyle = '#177a4c';
    ctx.fillText('● 실행 중', 12, 22);
  } else {
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('■ 정지', 12, 22);
  }
}

function syncReadout() {
  var pv = document.getElementById('pid-kPV');
  var dv = document.getElementById('pid-kDV');
  var th = document.getElementById('pid-th');
  var xv = document.getElementById('pid-x');
  var fv = document.getElementById('pid-F');
  if (pv) pv.textContent = P.kP.toFixed(0);
  if (dv) dv.textContent = P.kD.toFixed(1);
  if (th) th.textContent = fx(S.th * 180 / Math.PI, 1) + '°';
  if (xv) xv.textContent = fx(S.x, 2) + ' m';
  if (fv) fv.textContent = fx(S.F, 1) + ' N';
  var play = document.getElementById('pid-btnPlay');
  if (play) {
    play.textContent = S.running ? '정지' : '시작';
    play.classList.toggle('danger', S.running);
  }
}

function setGain(key, v, lo, hi) {
  P[key] = clamp(Number(v), lo, hi);
  syncReadout();
}

function togglePlay() {
  S.running = !S.running;
  syncReadout();
}

window.refresh_pid_demo = function () {
  if (!demoVisible()) return;
  if (S.fell) reset();
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
  if (S.running) {
    acc += real;
    var guard = 0;
    while (acc >= PHYS_DT && guard++ < 5000) {
      step(PHYS_DT);
      acc -= PHYS_DT;
    }
    syncReadout();
    draw();
  } else {
    acc = 0;
  }
  requestAnimationFrame(loop);
}

(function bind() {
  var slP = document.getElementById('pid-kP');
  var slD = document.getElementById('pid-kD');
  if (slP) {
    slP.value = String(P.kP);
    slP.oninput = function () { setGain('kP', slP.value, 0, 300); };
  }
  if (slD) {
    slD.value = String(P.kD);
    slD.oninput = function () { setGain('kD', slD.value, 0, 100); };
  }
  var play = document.getElementById('pid-btnPlay');
  var rst = document.getElementById('pid-btnReset');
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

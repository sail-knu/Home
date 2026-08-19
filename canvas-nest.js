(function () {
  var tag = document.currentScript || document.getElementsByTagName("script")[document.getElementsByTagName("script").length - 1];
  var color = (tag && tag.getAttribute("color")) || "15,138,130";
  var colorB = "29,78,137";
  var opacity = parseFloat((tag && tag.getAttribute("opacity")) || "0.32");
  var zIndex = (tag && tag.getAttribute("zIndex")) || "0";
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var SCALE = 0.6;
  var canvas = document.createElement("canvas");
  canvas.id = "nestCanvas";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "display:block;position:fixed;inset:0;width:100%;height:100%;overflow:hidden;pointer-events:none;z-index:" + zIndex + ";contain:strict;transform:translateZ(0)";
  document.body.appendChild(canvas);

  var ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  var mouse = { x: null, y: null, r: 22 };
  var robotR = 20;
  var lidarRange = 150;
  var beamCount = 24;
  var pad = 32;
  var viewW = 0;
  var viewH = 0;
  var robots = [
    { x: 180, y: 160, th: 0.35, v: 4, trail: [], ti: 0, sweep: 0, cool: 0, passMouse: 0, passBot: 0, wFilt: 0, cruise: 4.1, rgb: color, nose: colorB, hits: new Array(beamCount) },
    { x: 520, y: 420, th: 3.5, v: 4, trail: [], ti: 0, sweep: 1.8, cool: 0, passMouse: 0, passBot: 0, wFilt: 0, cruise: 4.6, rgb: colorB, nose: color, hits: new Array(beamCount) }
  ];
  var i;
  for (i = 0; i < robots.length; i++) {
    for (var h = 0; h < beamCount; h++) robots[i].hits[h] = { ang: 0, dist: 0, kind: 0, x: 0, y: 0 };
  }
  var raf = 0;

  function size() {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    canvas.width = Math.max(1, (viewW * SCALE) | 0);
    canvas.height = Math.max(1, (viewH * SCALE) | 0);
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    lidarRange = Math.min(160, Math.max(120, Math.min(viewW, viewH) * 0.15));
    if (robots[0].x > viewW || robots[0].y > viewH) {
      robots[0].x = viewW * 0.22;
      robots[0].y = viewH * 0.28;
    }
    if (robots[1].x > viewW || robots[1].y > viewH) {
      robots[1].x = viewW * 0.78;
      robots[1].y = viewH * 0.72;
    }
  }

  function wrap(a) {
    if (a > Math.PI) a -= Math.PI * 2;
    if (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function rayCircle(ox, oy, dx, dy, cx, cy, r, maxDist) {
    var fx = ox - cx;
    var fy = oy - cy;
    var b = 2 * (fx * dx + fy * dy);
    var c = fx * fx + fy * fy - r * r;
    var disc = b * b - 4 * c;
    if (disc < 0) return maxDist;
    var t = (-b - Math.sqrt(disc)) * 0.5;
    if (t > 0.8 && t < maxDist) return t;
    return maxDist;
  }

  function bounceWalls(bot) {
    var vx = Math.cos(bot.th);
    var vy = Math.sin(bot.th);
    var hit = false;
    if (bot.cool > 0) bot.cool--;
    if (bot.cool <= 0) {
      if (bot.x <= pad && vx < 0) { vx = -vx; hit = true; }
      if (bot.x >= viewW - pad && vx > 0) { vx = -vx; hit = true; }
      if (bot.y <= pad && vy < 0) { vy = -vy; hit = true; }
      if (bot.y >= viewH - pad && vy > 0) { vy = -vy; hit = true; }
      if (hit) {
        bot.th = Math.atan2(vy, vx);
        bot.cool = 12;
      }
    }
    if (bot.x < pad) bot.x = pad;
    else if (bot.x > viewW - pad) bot.x = viewW - pad;
    if (bot.y < pad) bot.y = pad;
    else if (bot.y > viewH - pad) bot.y = viewH - pad;
  }

  function scanLidar(bot) {
    var hits = bot.hits;
    var ox = bot.x;
    var oy = bot.y;
    var other = bot === robots[0] ? robots[1] : robots[0];
    var step = Math.PI * 2 / beamCount;
    for (var i = 0; i < beamCount; i++) {
      var ang = bot.th + i * step - Math.PI;
      var dx = Math.cos(ang);
      var dy = Math.sin(ang);
      var dist = lidarRange;
      var kind = 0;
      if (mouse.x !== null) {
        var md = rayCircle(ox, oy, dx, dy, mouse.x, mouse.y, mouse.r, dist);
        if (md < dist) { dist = md; kind = 1; }
      }
      var bd = rayCircle(ox, oy, dx, dy, other.x, other.y, robotR, dist);
      if (bd < dist) { dist = bd; kind = 2; }
      var hit = hits[i];
      hit.ang = ang;
      hit.dist = dist;
      hit.kind = kind;
      hit.x = ox + dx * dist;
      hit.y = oy + dy * dist;
    }
    return hits;
  }

  function steer(bot, hits) {
    var front = lidarRange;
    var left = 0;
    var right = 0;
    var leftN = 0;
    var rightN = 0;
    var i;

    for (i = 0; i < beamCount; i++) {
      if (!hits[i].kind) continue;
      var rel = wrap(hits[i].ang - bot.th);
      if (rel < 0.75 && rel > -0.75) front = Math.min(front, hits[i].dist);
      if (rel > 0.12 && rel < 1.7) { left += hits[i].dist; leftN++; }
      if (rel < -0.12 && rel > -1.7) { right += hits[i].dist; rightN++; }
    }
    left = leftN ? left / leftN : lidarRange;
    right = rightN ? right / rightN : lidarRange;

    var vx = Math.cos(bot.th);
    var vy = Math.sin(bot.th);
    var range = lidarRange * 0.95;
    var locked = false;
    var headOn = 0;

    function avoidPoint(ox, oy, rad, lockKey, preferRight) {
      var dx = bot.x - ox;
      var dy = bot.y - oy;
      var dist = Math.hypot(dx, dy) || 1;
      var gap = dist - rad;
      if (gap >= range * 1.12) {
        bot[lockKey] = 0;
        return;
      }
      if (gap >= range) return;
      locked = true;
      var nx = dx / dist;
      var ny = dy / dist;
      var tx = ny;
      var ty = -nx;
      if (!bot[lockKey]) {
        var align = vx * tx + vy * ty;
        bot[lockKey] = preferRight ? 1 : (align >= 0 ? 1 : -1);
      }
      tx *= bot[lockKey];
      ty *= bot[lockKey];
      var approach = vx * (-nx) + vy * (-ny);
      if (approach > headOn) headOn = approach;
      var push = 1 - Math.max(0, gap) / range;
      push *= push;
      var radial = approach > 0.62 ? 0.55 : 1.7;
      var tang = approach > 0.62 ? 2.35 : 1.4;
      vx += nx * push * radial + tx * push * tang;
      vy += ny * push * radial + ty * push * tang;
    }

    if (mouse.x !== null) avoidPoint(mouse.x, mouse.y, mouse.r, "passMouse", false);
    else bot.passMouse = 0;
    var other = bot === robots[0] ? robots[1] : robots[0];
    avoidPoint(other.x, other.y, robotR, "passBot", true);

    var desired = Math.atan2(vy, vx);
    if (!locked && front < lidarRange * 0.72) {
      var side = (right - left) * 0.012;
      desired = wrap(desired + side);
    }

    var err = wrap(desired - bot.th);
    if (err < 0.04 && err > -0.04) err = 0;
    var nearBot = Math.hypot(bot.x - other.x, bot.y - other.y) - robotR * 2;
    var wMax = bot.cool > 0 ? 0.04 : (nearBot < 70 || headOn > 0.6 ? 0.12 : 0.09);
    var wCmd = err * 0.14;
    if (wCmd > wMax) wCmd = wMax;
    if (wCmd < -wMax) wCmd = -wMax;
    bot.wFilt += (wCmd - bot.wFilt) * 0.28;
    var slow = (front - 24) / 100;
    if (slow > 1) slow = 1;
    if (slow < 0.22) slow = 0.22;
    var sBot = (nearBot + 20) / 90;
    if (sBot < slow) slow = sBot < 0.22 ? 0.22 : sBot;
    if (mouse.x !== null) {
      var dMouse = Math.hypot(bot.x - mouse.x, bot.y - mouse.y);
      if (dMouse < mouse.r + 46 && slow > 0.32) slow = 0.32;
    }
    if (headOn > 0.62) slow = Math.min(slow, 0.2);

    bot.v += (bot.cruise * slow - bot.v) * 0.12;
    bot.th = wrap(bot.th + bot.wFilt);
    bot.x += Math.cos(bot.th) * bot.v;
    bot.y += Math.sin(bot.th) * bot.v;
    bounceWalls(bot);
  }

  function drawLidar(bot, hits) {
    bot.sweep += 0.07;
    if (bot.sweep > Math.PI * 2) bot.sweep -= Math.PI * 2;
    var sweepAng = bot.th + bot.sweep - Math.PI;
    var rgb = bot.rgb;
    var ox = bot.x;
    var oy = bot.y;

    ctx.strokeStyle = "rgba(" + rgb + ",0.18)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(ox, oy, lidarRange, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(" + rgb + ",0.08)";
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.arc(ox, oy, lidarRange, sweepAng - 0.4, sweepAng);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(" + rgb + ",0.4)";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + Math.cos(sweepAng) * lidarRange, oy + Math.sin(sweepAng) * lidarRange);
    ctx.stroke();

    ctx.strokeStyle = "rgba(" + rgb + ",0.22)";
    ctx.fillStyle = "rgba(" + rgb + ",0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    var drawn = false;
    for (var i = 0; i < beamCount; i++) {
      var hit = hits[i];
      if (!hit.kind) continue;
      ctx.moveTo(ox, oy);
      ctx.lineTo(hit.x, hit.y);
      drawn = true;
    }
    if (drawn) ctx.stroke();

    ctx.beginPath();
    drawn = false;
    for (i = 0; i < beamCount; i++) {
      if (!hits[i].kind) continue;
      ctx.moveTo(hits[i].x + 2, hits[i].y);
      ctx.arc(hits[i].x, hits[i].y, 2, 0, Math.PI * 2);
      drawn = true;
    }
    if (drawn) ctx.fill();
  }

  function drawTrail(bot) {
    var t = bot.trail;
    if (t.length < 40) {
      t.push(bot.x, bot.y);
    } else {
      t[bot.ti] = bot.x;
      t[bot.ti + 1] = bot.y;
      bot.ti = (bot.ti + 2) % 40;
    }
    if (t.length < 4) return;
    ctx.beginPath();
    var start = t.length < 40 ? 0 : bot.ti;
    ctx.moveTo(t[start], t[start + 1]);
    for (var n = 2; n < t.length; n += 2) {
      var k = (start + n) % t.length;
      ctx.lineTo(t[k], t[k + 1]);
    }
    ctx.strokeStyle = "rgba(" + bot.rgb + ",0.14)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawRobot(bot) {
    ctx.save();
    ctx.translate(bot.x, bot.y);
    ctx.rotate(bot.th);
    ctx.globalAlpha = opacity;
    ctx.fillStyle = "#1a2330";
    ctx.fillRect(-10, -16, 18, 6);
    ctx.fillRect(-10, 10, 18, 6);
    ctx.fillStyle = "rgb(" + bot.rgb + ")";
    ctx.fillRect(-12, -11, 28, 22);
    ctx.beginPath();
    ctx.arc(6, 0, 5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(6, 0, 2, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.fillStyle = "rgb(" + bot.nose + ")";
    ctx.beginPath();
    ctx.moveTo(16, -6);
    ctx.lineTo(25, 0);
    ctx.lineTo(16, 6);
    ctx.fill();
    ctx.restore();
  }

  function tick() {
    raf = 0;
    if (document.hidden) return;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.clearRect(0, 0, viewW, viewH);
    var a = scanLidar(robots[0]);
    var b = scanLidar(robots[1]);
    steer(robots[0], a);
    steer(robots[1], b);
    drawTrail(robots[0]);
    drawTrail(robots[1]);
    drawLidar(robots[0], a);
    drawLidar(robots[1], b);
    drawRobot(robots[0]);
    drawRobot(robots[1]);
    raf = window.requestAnimationFrame(tick);
  }

  window.CanvasNestSetColor = function (rgb) {
    color = rgb;
    robots[0].rgb = rgb;
    robots[1].nose = rgb;
  };

  window.addEventListener("mousemove", function (e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }, { passive: true });
  document.addEventListener("mouseleave", function () {
    mouse.x = null;
    mouse.y = null;
  });
  window.addEventListener("resize", size);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && !raf) raf = window.requestAnimationFrame(tick);
  });

  size();
  robots[1].x = viewW * 0.78;
  robots[1].y = viewH * 0.72;
  raf = window.requestAnimationFrame(tick);
})();

(function () {
  var tag = document.currentScript || document.getElementsByTagName("script")[document.getElementsByTagName("script").length - 1];
  var color = (tag && tag.getAttribute("color")) || "15,138,130";
  var colorB = "29,78,137";
  var opacity = parseFloat((tag && tag.getAttribute("opacity")) || "0.55");
  var zIndex = (tag && tag.getAttribute("zIndex")) || "0";
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var canvas = document.createElement("canvas");
  canvas.id = "nestCanvas";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "display:block;position:fixed;inset:0;width:100%;height:100%;overflow:hidden;pointer-events:none;z-index:" + zIndex;
  document.body.appendChild(canvas);

  var ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!ctx) return;

  var mouse = { x: null, y: null, r: 22 };
  var robotR = 20;
  var lidarRange = 168;
  var beamCount = 48;
  var robots = [
    { x: 180, y: 160, th: 0.35, v: 0, trail: [], sweep: 0, cruise: 2.05, rgb: color, nose: colorB },
    { x: 520, y: 420, th: 3.5, v: 0, trail: [], sweep: 1.8, cruise: 2.3, rgb: colorB, nose: color }
  ];
  var raf = 0;

  function size() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    lidarRange = Math.min(190, Math.max(130, Math.min(canvas.width, canvas.height) * 0.17));
    if (robots[0].x > canvas.width || robots[0].y > canvas.height) {
      robots[0].x = canvas.width * 0.22;
      robots[0].y = canvas.height * 0.28;
    }
    if (robots[1].x > canvas.width || robots[1].y > canvas.height) {
      robots[1].x = canvas.width * 0.78;
      robots[1].y = canvas.height * 0.72;
    }
  }

  function wrap(a) {
    if (a > Math.PI) a -= Math.PI * 2;
    if (a < -Math.PI) a += Math.PI * 2;
    if (a > Math.PI) a -= Math.PI * 2;
    if (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function rayWall(ox, oy, dx, dy, maxDist, w, h) {
    var t = maxDist;
    if (dx > 1e-6) t = Math.min(t, (w - ox) / dx);
    else if (dx < -1e-6) t = Math.min(t, -ox / dx);
    if (dy > 1e-6) t = Math.min(t, (h - oy) / dy);
    else if (dy < -1e-6) t = Math.min(t, -oy / dy);
    return t > 0 ? t : maxDist;
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

  function bounceWalls(bot, w, h) {
    var pad = 28;
    var vx = Math.cos(bot.th);
    var vy = Math.sin(bot.th);
    var hit = false;
    if (bot.x <= pad && vx < 0) { vx = -vx; hit = true; }
    if (bot.x >= w - pad && vx > 0) { vx = -vx; hit = true; }
    if (bot.y <= pad && vy < 0) { vy = -vy; hit = true; }
    if (bot.y >= h - pad && vy > 0) { vy = -vy; hit = true; }
    if (hit) bot.th = Math.atan2(vy, vx);
    if (bot.x < pad) bot.x = pad;
    else if (bot.x > w - pad) bot.x = w - pad;
    if (bot.y < pad) bot.y = pad;
    else if (bot.y > h - pad) bot.y = h - pad;
  }

  function scanLidar(bot, w, h) {
    var hits = bot.hits || (bot.hits = new Array(beamCount));
    var ox = bot.x;
    var oy = bot.y;
    var other = bot === robots[0] ? robots[1] : robots[0];
    for (var i = 0; i < beamCount; i++) {
      var ang = bot.th + (i / beamCount) * Math.PI * 2 - Math.PI;
      var dx = Math.cos(ang);
      var dy = Math.sin(ang);
      var dist = rayWall(ox, oy, dx, dy, lidarRange, w, h);
      var kind = dist < lidarRange - 0.5 ? 3 : 0;
      if (mouse.x !== null) {
        var md = rayCircle(ox, oy, dx, dy, mouse.x, mouse.y, mouse.r, dist);
        if (md < dist) { dist = md; kind = 1; }
      }
      var bd = rayCircle(ox, oy, dx, dy, other.x, other.y, robotR, dist);
      if (bd < dist) { dist = bd; kind = 2; }
      var hit = hits[i] || (hits[i] = {});
      hit.ang = ang;
      hit.dist = dist;
      hit.kind = kind;
      hit.x = ox + dx * dist;
      hit.y = oy + dy * dist;
    }
    return hits;
  }

  function steer(bot, hits, w, h) {
    var front = lidarRange;
    var left = 0;
    var right = 0;
    var leftN = 0;
    var rightN = 0;
    var i;

    for (i = 0; i < beamCount; i++) {
      if (hits[i].kind === 3) continue;
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

    function avoidPoint(ox, oy, rad, passRight) {
      var dx = bot.x - ox;
      var dy = bot.y - oy;
      var dist = Math.hypot(dx, dy) || 1;
      var gap = dist - rad;
      if (gap >= range) return;
      var nx = dx / dist;
      var ny = dy / dist;
      var tx = ny;
      var ty = -nx;
      if (!passRight && vx * tx + vy * ty < 0) {
        tx = -tx;
        ty = -ty;
      }
      var push = (1 - Math.max(0, gap) / range);
      push *= push;
      vx += nx * push * 1.85 + tx * push * 1.35;
      vy += ny * push * 1.85 + ty * push * 1.35;
    }

    if (mouse.x !== null) avoidPoint(mouse.x, mouse.y, mouse.r, false);
    var other = bot === robots[0] ? robots[1] : robots[0];
    avoidPoint(other.x, other.y, robotR, true);

    var desired = Math.atan2(vy, vx);
    if (front < lidarRange * 0.72) {
      var side = (right - left) * 0.018;
      if (right - left < 10 && left - right < 10) side = right >= left ? -0.7 : 0.7;
      desired = wrap(desired + side);
    }

    var err = wrap(desired - bot.th);
    var nearBot = Math.hypot(bot.x - other.x, bot.y - other.y) - robotR * 2;
    var wMax = nearBot < 70 ? 0.15 : 0.1;
    var wCmd = err * 0.18;
    if (wCmd > wMax) wCmd = wMax;
    if (wCmd < -wMax) wCmd = -wMax;
    var slow = (front - 24) / 100;
    if (slow > 1) slow = 1;
    if (slow < 0.22) slow = 0.22;
    var sBot = (nearBot + 20) / 90;
    if (sBot < slow) slow = sBot < 0.22 ? 0.22 : sBot;
    if (mouse.x !== null) {
      var dMouse = Math.hypot(bot.x - mouse.x, bot.y - mouse.y);
      if (dMouse < mouse.r + 46 && slow > 0.35) slow = 0.35;
    }

    bot.v += (bot.cruise * slow - bot.v) * 0.12;
    bot.th = wrap(bot.th + wCmd);
    bot.x += Math.cos(bot.th) * bot.v;
    bot.y += Math.sin(bot.th) * bot.v;
    bounceWalls(bot, w, h);
  }

  function drawLidar(bot, hits) {
    bot.sweep += 0.07;
    if (bot.sweep > Math.PI * 2) bot.sweep -= Math.PI * 2;
    var sweepAng = bot.th + bot.sweep - Math.PI;
    var rgb = bot.rgb;
    var ox = bot.x;
    var oy = bot.y;

    ctx.strokeStyle = "rgba(" + rgb + ",0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ox, oy, lidarRange, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(" + rgb + ",0.09)";
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.arc(ox, oy, lidarRange, sweepAng - 0.4, sweepAng);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(" + rgb + ",0.45)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + Math.cos(sweepAng) * lidarRange, oy + Math.sin(sweepAng) * lidarRange);
    ctx.stroke();

    ctx.strokeStyle = "rgba(" + rgb + ",0.16)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.fillStyle = "rgba(" + rgb + ",0.5)";
    var i;
    for (i = 0; i < beamCount; i++) {
      var hit = hits[i];
      if (!hit.kind) continue;
      ctx.moveTo(ox, oy);
      ctx.lineTo(hit.x, hit.y);
    }
    ctx.stroke();

    ctx.beginPath();
    for (i = 0; i < beamCount; i++) {
      if (!hits[i].kind) continue;
      ctx.moveTo(hits[i].x + 2.2, hits[i].y);
      ctx.arc(hits[i].x, hits[i].y, 2.2, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  function drawTrail(bot) {
    var t = bot.trail;
    t.push(bot.x, bot.y);
    if (t.length > 48) { t.shift(); t.shift(); }
    if (t.length < 4) return;
    ctx.beginPath();
    ctx.moveTo(t[0], t[1]);
    for (var i = 2; i < t.length; i += 2) ctx.lineTo(t[i], t[i + 1]);
    ctx.strokeStyle = "rgba(" + bot.rgb + ",0.15)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawRobot(bot) {
    ctx.save();
    ctx.translate(bot.x, bot.y);
    ctx.rotate(bot.th);
    ctx.globalAlpha = opacity > 0.45 ? opacity : 0.45;

    ctx.fillStyle = "#1a2330";
    ctx.fillRect(-10, -16, 18, 6);
    ctx.fillRect(-10, 10, 18, 6);

    ctx.fillStyle = "rgb(" + bot.rgb + ")";
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-12, -11, 28, 22, 5) : ctx.rect(-12, -11, 28, 22);
    ctx.fill();

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

  function draw() {
    if (!document.hidden) {
      var w = canvas.width;
      var h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      var a = scanLidar(robots[0], w, h);
      var b = scanLidar(robots[1], w, h);
      steer(robots[0], a, w, h);
      steer(robots[1], b, w, h);
      drawTrail(robots[0]);
      drawTrail(robots[1]);
      drawLidar(robots[0], a);
      drawLidar(robots[1], b);
      drawRobot(robots[0]);
      drawRobot(robots[1]);
    }
    raf = window.requestAnimationFrame(draw);
  }

  window.CanvasNestSetColor = function (rgb) {
    color = rgb;
    robots[0].rgb = rgb;
    robots[1].nose = rgb;
  };

  window.addEventListener("mousemove", function (e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  document.addEventListener("mouseleave", function () {
    mouse.x = null;
    mouse.y = null;
  });
  window.addEventListener("resize", function () {
    size();
  });

  size();
  robots[1].x = canvas.width * 0.78;
  robots[1].y = canvas.height * 0.72;
  raf = window.requestAnimationFrame(draw);
})();

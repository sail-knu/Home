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

  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var mouse = { x: null, y: null, r: 22 };
  var robotR = 20;
  var lidarRange = 168;
  var beamCount = 88;
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
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function othersOf(bot) {
    var list = [];
    for (var i = 0; i < robots.length; i++) {
      if (robots[i] !== bot) list.push(robots[i]);
    }
    return list;
  }

  function rayWall(ox, oy, dx, dy, maxDist, w, h) {
    var t = maxDist;
    if (dx > 1e-6) t = Math.min(t, (w - ox) / dx);
    else if (dx < -1e-6) t = Math.min(t, -ox / dx);
    if (dy > 1e-6) t = Math.min(t, (h - oy) / dy);
    else if (dy < -1e-6) t = Math.min(t, -oy / dy);
    return Math.max(0, t);
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

  function scanLidar(bot, w, h) {
    var hits = [];
    var ox = bot.x;
    var oy = bot.y;
    var mates = othersOf(bot);
    for (var i = 0; i < beamCount; i++) {
      var ang = bot.th + (i / beamCount) * Math.PI * 2 - Math.PI;
      var dx = Math.cos(ang);
      var dy = Math.sin(ang);
      var dist = rayWall(ox, oy, dx, dy, lidarRange, w, h);
      var kind = dist < lidarRange - 0.5 ? "wall" : "free";
      if (mouse.x !== null) {
        var md = rayCircle(ox, oy, dx, dy, mouse.x, mouse.y, mouse.r, dist);
        if (md < dist) {
          dist = md;
          kind = "obs";
        }
      }
      for (var j = 0; j < mates.length; j++) {
        var bd = rayCircle(ox, oy, dx, dy, mates[j].x, mates[j].y, robotR, dist);
        if (bd < dist) {
          dist = bd;
          kind = "bot";
        }
      }
      hits.push({
        ang: ang,
        dist: dist,
        kind: kind,
        x: ox + dx * dist,
        y: oy + dy * dist
      });
    }
    return hits;
  }

  function steer(bot, hits, w, h) {
    var front = lidarRange;
    var left = 0;
    var right = 0;
    var leftN = 0;
    var rightN = 0;

    for (var i = 0; i < hits.length; i++) {
      var rel = wrap(hits[i].ang - bot.th);
      if (Math.abs(rel) < 0.75) front = Math.min(front, hits[i].dist);
      if (rel > 0.12 && rel < 1.7) {
        left += hits[i].dist;
        leftN++;
      }
      if (rel < -0.12 && rel > -1.7) {
        right += hits[i].dist;
        rightN++;
      }
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
      if (!passRight) {
        if (vx * tx + vy * ty < 0) {
          tx = -tx;
          ty = -ty;
        }
      }
      var push = Math.pow(1 - Math.max(0, gap) / range, 2);
      vx += nx * push * 1.85 + tx * push * 1.35;
      vy += ny * push * 1.85 + ty * push * 1.35;
    }

    if (mouse.x !== null) avoidPoint(mouse.x, mouse.y, mouse.r, false);
    avoidPoint(0, bot.y, 0, false);
    avoidPoint(w, bot.y, 0, false);
    avoidPoint(bot.x, 0, 0, false);
    avoidPoint(bot.x, h, 0, false);

    var mates = othersOf(bot);
    for (var k = 0; k < mates.length; k++) {
      avoidPoint(mates[k].x, mates[k].y, robotR, true);
    }

    var desired = Math.atan2(vy, vx);
    if (front < lidarRange * 0.72) {
      var side = (right - left) * 0.018;
      if (Math.abs(right - left) < 10) side = right >= left ? -0.7 : 0.7;
      desired = wrap(desired + side);
    }

    var err = wrap(desired - bot.th);
    var wallDist = Math.min(bot.x, w - bot.x, bot.y, h - bot.y);
    var nearBot = lidarRange;
    for (var n = 0; n < mates.length; n++) {
      nearBot = Math.min(nearBot, Math.hypot(bot.x - mates[n].x, bot.y - mates[n].y) - robotR * 2);
    }
    var wMax = wallDist < 90 || nearBot < 70 ? 0.15 : 0.1;
    var wCmd = Math.max(-wMax, Math.min(wMax, err * 0.18));
    var slow = Math.max(0.22, Math.min(1, (front - 24) / 100, wallDist / 88, (nearBot + 20) / 90));
    if (mouse.x !== null) {
      var dMouse = Math.hypot(bot.x - mouse.x, bot.y - mouse.y);
      if (dMouse < mouse.r + 46) slow = Math.min(slow, 0.35);
    }

    bot.v += ((bot.cruise * slow) - bot.v) * 0.12;
    bot.th = wrap(bot.th + wCmd);
    bot.x += Math.cos(bot.th) * bot.v;
    bot.y += Math.sin(bot.th) * bot.v;

    var pad = 28;
    bot.x = Math.max(pad, Math.min(w - pad, bot.x));
    bot.y = Math.max(pad, Math.min(h - pad, bot.y));
  }

  function drawLidar(bot, hits) {
    bot.sweep += 0.07;
    if (bot.sweep > Math.PI * 2) bot.sweep -= Math.PI * 2;
    var sweepAng = bot.th + bot.sweep - Math.PI;
    var rgb = bot.rgb;

    ctx.beginPath();
    ctx.arc(bot.x, bot.y, lidarRange, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(" + rgb + ",0.2)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 7]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.moveTo(bot.x, bot.y);
    ctx.arc(bot.x, bot.y, lidarRange, sweepAng - 0.4, sweepAng);
    ctx.closePath();
    ctx.fillStyle = "rgba(" + rgb + ",0.09)";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(bot.x, bot.y);
    ctx.lineTo(bot.x + Math.cos(sweepAng) * lidarRange, bot.y + Math.sin(sweepAng) * lidarRange);
    ctx.strokeStyle = "rgba(" + rgb + ",0.45)";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    for (var i = 0; i < hits.length; i++) {
      var hit = hits[i];
      var dSweep = Math.abs(wrap(hit.ang - sweepAng));
      var hot = dSweep < 0.36;
      var seen = hit.kind !== "free";
      var alpha = seen ? (hot ? 0.42 : 0.12) : (hot ? 0.07 : 0.025);
      ctx.beginPath();
      ctx.moveTo(bot.x, bot.y);
      ctx.lineTo(hit.x, hit.y);
      ctx.strokeStyle = "rgba(" + rgb + "," + alpha + ")";
      ctx.lineWidth = hot && seen ? 1.2 : 0.55;
      ctx.stroke();
      if (seen) {
        ctx.beginPath();
        ctx.arc(hit.x, hit.y, hot ? 3 : 1.8, 0, Math.PI * 2);
        ctx.fillStyle = hit.kind === "wall"
          ? "rgba(" + rgb + "," + (hot ? 0.4 : 0.2) + ")"
          : "rgba(" + rgb + "," + (hot ? 0.75 : 0.4) + ")";
        ctx.fill();
      }
    }
  }

  function drawTrail(bot) {
    bot.trail.push({ x: bot.x, y: bot.y });
    if (bot.trail.length > 42) bot.trail.shift();
    if (bot.trail.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(bot.trail[0].x, bot.trail[0].y);
    for (var i = 1; i < bot.trail.length; i++) ctx.lineTo(bot.trail[i].x, bot.trail[i].y);
    ctx.strokeStyle = "rgba(" + bot.rgb + ",0.15)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawRobot(bot) {
    ctx.save();
    ctx.translate(bot.x, bot.y);
    ctx.rotate(bot.th);
    ctx.globalAlpha = Math.max(0.45, opacity);

    ctx.fillStyle = "#1a2330";
    roundRect(ctx, -10, -16, 18, 6, 2);
    ctx.fill();
    roundRect(ctx, -10, 10, 18, 6, 2);
    ctx.fill();

    ctx.fillStyle = "rgb(" + bot.rgb + ")";
    roundRect(ctx, -12, -11, 28, 22, 5);
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
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, r);
    else c.rect(x, y, w, h);
  }

  function draw() {
    if (!document.hidden) {
      var w = canvas.width;
      var h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      var i;
      for (i = 0; i < robots.length; i++) steer(robots[i], scanLidar(robots[i], w, h), w, h);
      for (i = 0; i < robots.length; i++) {
        drawTrail(robots[i]);
        drawLidar(robots[i], scanLidar(robots[i], w, h));
        drawRobot(robots[i]);
      }
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

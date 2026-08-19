(function () {
  var tag = document.currentScript || document.getElementsByTagName("script")[document.getElementsByTagName("script").length - 1];
  var color = (tag && tag.getAttribute("color")) || "15,138,130";
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
  var robot = { x: 180, y: 160, th: 0.4, v: 0, trail: [] };
  var lidarRange = 168;
  var beamCount = 88;
  var cruise = 2.15;
  var sweep = 0;
  var raf = 0;

  function size() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    lidarRange = Math.min(190, Math.max(130, Math.min(canvas.width, canvas.height) * 0.17));
    if (robot.x > canvas.width || robot.y > canvas.height) {
      robot.x = canvas.width * 0.25;
      robot.y = canvas.height * 0.3;
    }
  }

  function wrap(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
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

  function scanLidar(w, h) {
    var hits = [];
    var ox = robot.x;
    var oy = robot.y;
    for (var i = 0; i < beamCount; i++) {
      var ang = robot.th + (i / beamCount) * Math.PI * 2 - Math.PI;
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

  function steer(hits, w, h) {
    var front = lidarRange;
    var left = 0;
    var right = 0;
    var leftN = 0;
    var rightN = 0;

    for (var i = 0; i < hits.length; i++) {
      var rel = wrap(hits[i].ang - robot.th);
      if (Math.abs(rel) < 0.7) front = Math.min(front, hits[i].dist);
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

    var desired = robot.th;
    var turn = 0;
    var margin = 70;

    if (robot.x < margin) turn += (margin - robot.x) / margin * 0.9;
    if (robot.x > w - margin) turn -= (robot.x - (w - margin)) / margin * 0.9;
    if (robot.y < margin) turn += (margin - robot.y) / margin * (Math.cos(robot.th) >= 0 ? 0.9 : -0.9);
    if (robot.y > h - margin) turn += (robot.y - (h - margin)) / margin * (Math.cos(robot.th) >= 0 ? -0.9 : 0.9);

    if (mouse.x !== null) {
      var mx = robot.x - mouse.x;
      var my = robot.y - mouse.y;
      var dist = Math.sqrt(mx * mx + my * my) || 1;
      var avoidR = lidarRange * 0.92;
      if (dist < avoidR + mouse.r) {
        var nx = mx / dist;
        var ny = my / dist;
        var tx = -ny;
        var ty = nx;
        if (Math.cos(robot.th) * tx + Math.sin(robot.th) * ty < 0) {
          tx = -tx;
          ty = -ty;
        }
        var push = Math.pow(1 - Math.min(1, (dist - mouse.r) / avoidR), 2);
        desired = Math.atan2(
          Math.sin(robot.th) * (1 - push * 0.7) + ny * push + ty * push * 1.15,
          Math.cos(robot.th) * (1 - push * 0.7) + nx * push + tx * push * 1.15
        );
      }
    }

    if (front < 88) {
      turn += (right - left) * 0.012;
      if (Math.abs(right - left) < 8) turn += 0.55;
    }

    desired = wrap(desired + turn);
    var err = wrap(desired - robot.th);
    var wCmd = Math.max(-0.085, Math.min(0.085, err * 0.12));
    var slow = Math.max(0.28, Math.min(1, (front - 28) / 90));
    if (mouse.x !== null) {
      var dMouse = Math.hypot(robot.x - mouse.x, robot.y - mouse.y);
      if (dMouse < mouse.r + 46) slow = Math.min(slow, 0.35);
    }
    robot.v += ((cruise * slow) - robot.v) * 0.12;
    robot.th = wrap(robot.th + wCmd);
    robot.x += Math.cos(robot.th) * robot.v;
    robot.y += Math.sin(robot.th) * robot.v;
    robot.x = Math.max(18, Math.min(w - 18, robot.x));
    robot.y = Math.max(18, Math.min(h - 18, robot.y));
  }

  function drawLidar(hits) {
    sweep += 0.07;
    if (sweep > Math.PI * 2) sweep -= Math.PI * 2;
    var sweepAng = robot.th + sweep - Math.PI;

    ctx.beginPath();
    ctx.arc(robot.x, robot.y, lidarRange, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(" + color + ",0.22)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 7]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.moveTo(robot.x, robot.y);
    ctx.arc(robot.x, robot.y, lidarRange, sweepAng - 0.4, sweepAng);
    ctx.closePath();
    ctx.fillStyle = "rgba(" + color + ",0.1)";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(robot.x, robot.y);
    ctx.lineTo(robot.x + Math.cos(sweepAng) * lidarRange, robot.y + Math.sin(sweepAng) * lidarRange);
    ctx.strokeStyle = "rgba(" + color + ",0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    for (var i = 0; i < hits.length; i++) {
      var hit = hits[i];
      var dSweep = Math.abs(wrap(hit.ang - sweepAng));
      var hot = dSweep < 0.36;
      var seen = hit.kind !== "free";
      var alpha = seen ? (hot ? 0.48 : 0.14) : (hot ? 0.08 : 0.03);
      ctx.beginPath();
      ctx.moveTo(robot.x, robot.y);
      ctx.lineTo(hit.x, hit.y);
      ctx.strokeStyle = "rgba(" + color + "," + alpha + ")";
      ctx.lineWidth = hot && seen ? 1.3 : 0.6;
      ctx.stroke();
      if (seen) {
        ctx.beginPath();
        ctx.arc(hit.x, hit.y, hot ? 3.2 : 2, 0, Math.PI * 2);
        ctx.fillStyle = hit.kind === "obs"
          ? "rgba(" + color + "," + (hot ? 0.8 : 0.45) + ")"
          : "rgba(" + color + "," + (hot ? 0.45 : 0.22) + ")";
        ctx.fill();
      }
    }
  }

  function drawTrail() {
    robot.trail.push({ x: robot.x, y: robot.y });
    if (robot.trail.length > 42) robot.trail.shift();
    if (robot.trail.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(robot.trail[0].x, robot.trail[0].y);
    for (var i = 1; i < robot.trail.length; i++) ctx.lineTo(robot.trail[i].x, robot.trail[i].y);
    ctx.strokeStyle = "rgba(" + color + ",0.16)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawRobot() {
    ctx.save();
    ctx.translate(robot.x, robot.y);
    ctx.rotate(robot.th);
    ctx.globalAlpha = Math.max(0.45, opacity);

    ctx.fillStyle = "#1a2330";
    roundRect(ctx, -10, -16, 18, 6, 2);
    ctx.fill();
    roundRect(ctx, -10, 10, 18, 6, 2);
    ctx.fill();

    ctx.fillStyle = "rgb(" + color + ")";
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

    ctx.fillStyle = "#1d4e89";
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
      steer(scanLidar(w, h), w, h);
      drawTrail();
      drawLidar(scanLidar(w, h));
      drawRobot();
    }
    raf = window.requestAnimationFrame(draw);
  }

  window.CanvasNestSetColor = function (rgb) {
    color = rgb;
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
  raf = window.requestAnimationFrame(draw);
})();

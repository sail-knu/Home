(function () {
  var tag = document.currentScript || document.getElementsByTagName("script")[document.getElementsByTagName("script").length - 1];
  var color = (tag && tag.getAttribute("color")) || "15,138,130";
  var pointColor = (tag && tag.getAttribute("pointColor")) || color;
  var opacity = parseFloat((tag && tag.getAttribute("opacity")) || "0.18");
  var zIndex = (tag && tag.getAttribute("zIndex")) || "0";
  var count = parseInt((tag && tag.getAttribute("count")) || "200", 10);
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (window.innerWidth < 720) count = Math.min(count, 120);

  var canvas = document.createElement("canvas");
  canvas.id = "nestCanvas";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "display:block;position:fixed;inset:0;width:100%;height:100%;overflow:hidden;pointer-events:none;z-index:" + zIndex;
  document.body.appendChild(canvas);

  var overlay = document.createElement("canvas");
  overlay.id = "lidarCanvas";
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.cssText = "display:block;position:fixed;inset:0;width:100%;height:100%;overflow:hidden;pointer-events:none;z-index:3500";
  document.body.appendChild(overlay);

  var ctx = canvas.getContext("2d");
  var octx = overlay.getContext("2d");
  if (!ctx || !octx) return;

  var points = [];
  var mouse = { x: null, y: null };
  var raf = 0;
  var avoidRadius = 160;
  var avoidRadius2 = avoidRadius * avoidRadius;
  var avoidStrength = 0.85;
  var maxSpeed = 3.4;
  var idleSpeed = 0.85;
  var sweep = 0;
  var beamCount = 96;

  function size() {
    canvas.width = overlay.width = window.innerWidth;
    canvas.height = overlay.height = window.innerHeight;
    avoidRadius = Math.min(180, Math.max(110, Math.min(canvas.width, canvas.height) * 0.16));
    avoidRadius2 = avoidRadius * avoidRadius;
  }

  function seed() {
    points = [];
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 0.35 + Math.random() * 0.7;
      points.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        xa: Math.cos(angle) * speed,
        ya: Math.sin(angle) * speed,
        r: 5 + Math.random() * 4
      });
    }
  }

  function clampSpeed(p, limit) {
    var sp2 = p.xa * p.xa + p.ya * p.ya;
    if (sp2 > limit * limit) {
      var s = limit / Math.sqrt(sp2);
      p.xa *= s;
      p.ya *= s;
    }
  }

  function bounce(p, w, h) {
    if (p.x < p.r) { p.x = p.r; p.xa = Math.abs(p.xa); }
    else if (p.x > w - p.r) { p.x = w - p.r; p.xa = -Math.abs(p.xa); }
    if (p.y < p.r) { p.y = p.r; p.ya = Math.abs(p.ya); }
    else if (p.y > h - p.r) { p.y = h - p.r; p.ya = -Math.abs(p.ya); }
  }

  function flee(p) {
    if (mouse.x === null || mouse.y === null) return;
    var dx = p.x - mouse.x;
    var dy = p.y - mouse.y;
    var d2 = dx * dx + dy * dy;
    if (d2 >= avoidRadius2 || d2 < 0.01) return;

    var dist = Math.sqrt(d2);
    var nx = dx / dist;
    var ny = dy / dist;
    var t = 1 - dist / avoidRadius;
    var push = t * t * avoidStrength;

    p.xa += nx * push;
    p.ya += ny * push;

    var tx = -ny;
    var ty = nx;
    if (p.xa * tx + p.ya * ty < 0) {
      tx = -tx;
      ty = -ty;
    }
    p.xa += tx * push * 0.45;
    p.ya += ty * push * 0.45;
  }

  function rayHit(ox, oy, dx, dy, maxDist) {
    var best = maxDist;
    var hx = ox + dx * maxDist;
    var hy = oy + dy * maxDist;
    var hit = false;
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      var fx = ox - p.x;
      var fy = oy - p.y;
      var b = 2 * (fx * dx + fy * dy);
      var c = fx * fx + fy * fy - p.r * p.r;
      var disc = b * b - 4 * c;
      if (disc < 0) continue;
      var t = (-b - Math.sqrt(disc)) * 0.5;
      if (t > 0.8 && t < best) {
        best = t;
        hx = ox + dx * t;
        hy = oy + dy * t;
        hit = true;
      }
    }
    return { x: hx, y: hy, hit: hit };
  }

  function drawParticle(p) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(" + pointColor + "," + opacity + ")";
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = "rgba(" + color + "," + (opacity + 0.06) + ")";
    ctx.stroke();
  }

  function drawLidar() {
    octx.clearRect(0, 0, overlay.width, overlay.height);
    if (mouse.x === null || mouse.y === null) return;

    var mx = mouse.x;
    var my = mouse.y;
    var R = avoidRadius;
    sweep += 0.075;
    if (sweep > Math.PI * 2) sweep -= Math.PI * 2;

    octx.beginPath();
    octx.arc(mx, my, R, 0, Math.PI * 2);
    octx.strokeStyle = "rgba(" + color + ",0.28)";
    octx.lineWidth = 1;
    octx.setLineDash([3, 7]);
    octx.stroke();
    octx.setLineDash([]);

    octx.beginPath();
    octx.moveTo(mx, my);
    octx.arc(mx, my, R, sweep - 0.42, sweep);
    octx.closePath();
    octx.fillStyle = "rgba(" + color + ",0.12)";
    octx.fill();

    octx.beginPath();
    octx.moveTo(mx, my);
    octx.lineTo(mx + Math.cos(sweep) * R, my + Math.sin(sweep) * R);
    octx.strokeStyle = "rgba(" + color + ",0.55)";
    octx.lineWidth = 1.6;
    octx.stroke();

    for (var i = 0; i < beamCount; i++) {
      var ang = (i / beamCount) * Math.PI * 2;
      var dx = Math.cos(ang);
      var dy = Math.sin(ang);
      var res = rayHit(mx, my, dx, dy, R);
      var dSweep = Math.abs(Math.atan2(Math.sin(ang - sweep), Math.cos(ang - sweep)));
      var hot = dSweep < 0.38;
      var alpha = res.hit ? (hot ? 0.5 : 0.16) : (hot ? 0.1 : 0.035);
      octx.beginPath();
      octx.moveTo(mx, my);
      octx.lineTo(res.x, res.y);
      octx.strokeStyle = "rgba(" + color + "," + alpha + ")";
      octx.lineWidth = hot && res.hit ? 1.35 : 0.65;
      octx.stroke();
      if (res.hit) {
        octx.beginPath();
        octx.arc(res.x, res.y, hot ? 3.4 : 2.2, 0, Math.PI * 2);
        octx.fillStyle = "rgba(" + color + "," + (hot ? 0.72 : 0.38) + ")";
        octx.fill();
      }
    }
  }

  function draw() {
    if (!document.hidden) {
      var w = canvas.width;
      var h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        flee(p);
        clampSpeed(p, maxSpeed);

        var sp = Math.sqrt(p.xa * p.xa + p.ya * p.ya) || 1;
        p.xa += (p.xa / sp) * idleSpeed * 0.012;
        p.ya += (p.ya / sp) * idleSpeed * 0.012;
        p.xa *= 0.985;
        p.ya *= 0.985;

        p.x += p.xa;
        p.y += p.ya;
        bounce(p, w, h);
        drawParticle(p);
      }
      drawLidar();
    }
    raf = window.requestAnimationFrame(draw);
  }

  window.CanvasNestSetColor = function (rgb) {
    color = rgb;
    pointColor = rgb;
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
    seed();
  });

  size();
  seed();
  raf = window.requestAnimationFrame(draw);
})();

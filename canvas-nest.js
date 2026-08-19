(function () {
  var tag = document.currentScript || document.getElementsByTagName("script")[document.getElementsByTagName("script").length - 1];
  var color = (tag && tag.getAttribute("color")) || "15,138,130";
  var pointColor = (tag && tag.getAttribute("pointColor")) || color;
  var opacity = parseFloat((tag && tag.getAttribute("opacity")) || "0.7");
  var zIndex = (tag && tag.getAttribute("zIndex")) || "0";
  var count = parseInt((tag && tag.getAttribute("count")) || "600", 10);
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (window.innerWidth < 720) count = Math.min(count, 350);

  var canvas = document.createElement("canvas");
  canvas.id = "nestCanvas";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "display:block;position:fixed;inset:0;width:100%;height:100%;overflow:hidden;pointer-events:none;z-index:" + zIndex;
  document.body.appendChild(canvas);

  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var points = [];
  var mouse = { x: null, y: null };
  var raf = 0;
  var linkMax = 6000;
  var avoidRadius = 160;
  var avoidRadius2 = avoidRadius * avoidRadius;
  var avoidStrength = 0.85;
  var maxSpeed = 3.4;
  var idleSpeed = 0.85;

  function size() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
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
        ya: Math.sin(angle) * speed
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
    if (p.x < 0) { p.x = 0; p.xa = Math.abs(p.xa); }
    else if (p.x > w) { p.x = w; p.xa = -Math.abs(p.xa); }
    if (p.y < 0) { p.y = 0; p.ya = Math.abs(p.ya); }
    else if (p.y > h) { p.y = h; p.ya = -Math.abs(p.ya); }
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

        ctx.fillStyle = "rgba(" + pointColor + "," + opacity + ")";
        ctx.fillRect(p.x - 0.5, p.y - 0.5, 1.2, 1.2);

        for (var j = i + 1; j < points.length; j++) {
          var q = points[j];
          var ldx = p.x - q.x;
          var ldy = p.y - q.y;
          var dist = ldx * ldx + ldy * ldy;
          if (dist < linkMax) {
            var c = (linkMax - dist) / linkMax;
            ctx.beginPath();
            ctx.lineWidth = c / 2;
            ctx.strokeStyle = "rgba(" + color + "," + (c * opacity) + ")";
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
      }
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
  window.addEventListener("mouseout", function () {
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

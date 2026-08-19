(function () {
  var tag = document.currentScript || document.getElementsByTagName("script")[document.getElementsByTagName("script").length - 1];
  var color = (tag && tag.getAttribute("color")) || "15,138,130";
  var pointColor = (tag && tag.getAttribute("pointColor")) || color;
  var opacity = parseFloat((tag && tag.getAttribute("opacity")) || "0.7");
  var zIndex = (tag && tag.getAttribute("zIndex")) || "0";
  var count = parseInt((tag && tag.getAttribute("count")) || "120", 10);
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (window.innerWidth < 720) count = Math.min(count, 70);

  var canvas = document.createElement("canvas");
  canvas.id = "nestCanvas";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "display:block;position:fixed;inset:0;width:100%;height:100%;overflow:hidden;pointer-events:none;z-index:" + zIndex;
  document.body.appendChild(canvas);

  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var points = [];
  var mouse = { x: null, y: null, max: 20000 };
  var raf = 0;

  function size() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function seed() {
    points = [];
    for (var i = 0; i < count; i++) {
      points.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        xa: Math.random() * 2 - 1,
        ya: Math.random() * 2 - 1,
        max: 6000
      });
    }
  }

  function draw() {
    if (!document.hidden) {
      var w = canvas.width;
      var h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      var all = points.concat([mouse]);
      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        p.x += p.xa;
        p.y += p.ya;
        p.xa *= (p.x > w || p.x < 0) ? -1 : 1;
        p.ya *= (p.y > h || p.y < 0) ? -1 : 1;
        ctx.fillStyle = "rgba(" + pointColor + "," + opacity + ")";
        ctx.fillRect(p.x - 0.5, p.y - 0.5, 1.2, 1.2);
        for (var j = i + 1; j < all.length; j++) {
          var q = all[j];
          if (q.x === null || q.y === null) continue;
          var dx = p.x - q.x;
          var dy = p.y - q.y;
          var dist = dx * dx + dy * dy;
          if (dist < q.max) {
            if (q === mouse && dist >= q.max / 2) {
              p.x -= dx * 0.03;
              p.y -= dy * 0.03;
            }
            var c = (q.max - dist) / q.max;
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

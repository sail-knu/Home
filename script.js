(function () {
  const navbar = document.getElementById("navbar");
  const hamburger = document.querySelector(".hamburger");
  const navLinks = document.querySelector(".nav-links");
  const navItems = document.querySelectorAll(".nav-links li a");
  const pageSections = document.querySelectorAll(".page-section");

  function applyTheme(theme) {
    if (theme !== "dark" && theme !== "soft" && theme !== "light") theme = "soft";
    document.documentElement.setAttribute("data-theme", theme);
    document.querySelectorAll(".chip-btn[data-theme]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-theme") === theme);
    });
    try { localStorage.setItem("sail-appearance", theme); } catch (e) {}
    if (typeof window.refreshParticles === "function") window.refreshParticles();
  }

  document.querySelectorAll(".chip-btn[data-theme]").forEach((btn) => {
    btn.addEventListener("click", () => applyTheme(btn.getAttribute("data-theme")));
  });
  applyTheme(document.documentElement.getAttribute("data-theme") || "soft");

  window.addEventListener("scroll", () => {
    if (!navbar) return;
    navbar.classList.toggle("scrolled", window.scrollY > 50);
  });

  if (hamburger && navLinks) {
    hamburger.addEventListener("click", () => {
      const open = navLinks.classList.toggle("active");
      hamburger.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  function navigateToSection(targetId, fromHistory) {
    if (targetId === "#contact") {
      const contact = document.getElementById("contact");
      if (contact) contact.scrollIntoView({ behavior: "smooth" });
      if (navLinks) navLinks.classList.remove("active");
      if (hamburger) hamburger.setAttribute("aria-expanded", "false");
      return;
    }

    const targetSection = document.querySelector(targetId);
    if (!targetSection || !targetSection.classList.contains("page-section")) return;

    navItems.forEach((nav) => {
      nav.classList.toggle("active", nav.getAttribute("href") === targetId);
    });

    pageSections.forEach((section) => section.classList.add("hidden-page"));
    targetSection.classList.remove("hidden-page");

    const globalBanner = document.getElementById("global-recruitment-banner");
    if (globalBanner) {
      globalBanner.style.display = targetId === "#home" ? "none" : "block";
    }

    if (targetId === "#home") {
      window.scrollTo({ top: 0, behavior: "instant" });
    } else {
      const container = targetSection.querySelector(".section-container");
      if (container) {
        const y = container.getBoundingClientRect().top + window.scrollY - 100;
        window.scrollTo({ top: y, behavior: "instant" });
      } else {
        window.scrollTo({ top: 0, behavior: "instant" });
      }
    }

    if (navLinks) navLinks.classList.remove("active");
    if (hamburger) hamburger.setAttribute("aria-expanded", "false");

    if (!fromHistory && window.location.hash !== targetId) {
      window.history.pushState(null, "", targetId);
    }
  }

  window.addEventListener("popstate", () => {
    navigateToSection(window.location.hash || "#home", true);
  });

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      const targetId = this.getAttribute("href");
      if (targetId !== "#contact" && document.querySelector(targetId)?.classList.contains("page-section")) {
        e.preventDefault();
        navigateToSection(targetId);
      }
    });
  });

  function openTab(evt, tabName) {
    const tabcontent = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabcontent.length; i++) tabcontent[i].style.display = "none";
    const tablinks = document.getElementsByClassName("tab-btn");
    for (let i = 0; i < tablinks.length; i++) {
      tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    const panel = document.getElementById(tabName);
    if (panel) panel.style.display = "block";
    if (evt && evt.currentTarget) evt.currentTarget.className += " active";
  }

  function toggleDetails(wrapperId) {
    const wrapper = document.getElementById(wrapperId);
    if (!wrapper) return;
    const details = wrapper.querySelector(".bento-details");
    const item = wrapper.querySelector(".bento-item");
    const actionText = wrapper.querySelector(".action-text");
    const isExpanded = wrapper.classList.contains("expanded");

    document.querySelectorAll(".bento-wrapper.expanded").forEach((w) => {
      if (w.id !== wrapperId) {
        w.classList.remove("expanded");
        w.querySelector(".bento-item")?.classList.remove("expanded");
        const d = w.querySelector(".bento-details");
        if (d) d.style.maxHeight = null;
        const t = w.querySelector(".action-text");
        if (t) t.textContent = "View Details";
      }
    });

    if (isExpanded) {
      wrapper.classList.remove("expanded");
      item?.classList.remove("expanded");
      if (details) details.style.maxHeight = null;
      if (actionText) actionText.textContent = "View Details";
    } else {
      wrapper.classList.add("expanded");
      item?.classList.add("expanded");
      if (details) details.style.maxHeight = details.scrollHeight + "px";
      if (actionText) actionText.textContent = "Close Details";
      setTimeout(() => {
        const y = wrapper.getBoundingClientRect().top + window.scrollY - 100;
        window.scrollTo({ top: y, behavior: "smooth" });
        if (details) details.style.maxHeight = details.scrollHeight + "px";
      }, 50);
    }
  }

  window.addEventListener("resize", () => {
    document.querySelectorAll(".bento-wrapper.expanded .bento-details").forEach((details) => {
      details.style.maxHeight = "none";
      details.style.maxHeight = details.scrollHeight + "px";
    });
  });

  document.addEventListener("DOMContentLoaded", () => {
    if (window.location.hash) navigateToSection(window.location.hash);
  });

  window.navigateToSection = navigateToSection;
  window.openTab = openTab;
  window.toggleDetails = toggleDetails;

  const canvas = document.getElementById("sceneCanvas");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  function getThemeColor(varName, fallback) {
    const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return val || fallback;
  }

  function rgba(kind, alpha) {
    const prefix = kind === "s" ? "--theme-secondary" : "--theme-primary";
    return "rgba(" +
      getThemeColor(prefix + "-r", kind === "s" ? "94" : "46") + ", " +
      getThemeColor(prefix + "-g", kind === "s" ? "177" : "196") + ", " +
      getThemeColor(prefix + "-b", kind === "s" ? "255" : "182") + ", " +
      alpha + ")";
  }

  function ink(base) {
    const theme = document.documentElement.getAttribute("data-theme");
    if (theme === "light") return base * 0.48;
    if (theme === "soft") return base * 0.62;
    return base;
  }

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function catmull(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return {
      x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    };
  }

  function loopPoint(pts, t) {
    const n = pts.length;
    const u = ((t % 1) + 1) % 1;
    const f = u * n;
    const i = Math.floor(f);
    const local = f - i;
    return catmull(pts[(i - 1 + n) % n], pts[i % n], pts[(i + 1) % n], pts[(i + 2) % n], local);
  }

  function toWorld(path) {
    return path.map((p) => ({ x: p.x * canvas.width, y: p.y * canvas.height }));
  }

  const PATHS = {
    ship: [
      { x: 0.10, y: 0.70 }, { x: 0.28, y: 0.62 }, { x: 0.50, y: 0.68 },
      { x: 0.72, y: 0.60 }, { x: 0.88, y: 0.70 }, { x: 0.70, y: 0.82 },
      { x: 0.46, y: 0.86 }, { x: 0.22, y: 0.80 },
    ],
    car: [
      { x: 0.08, y: 0.30 }, { x: 0.22, y: 0.18 }, { x: 0.40, y: 0.22 },
      { x: 0.46, y: 0.36 }, { x: 0.30, y: 0.44 }, { x: 0.12, y: 0.40 },
    ],
    robot: [
      { x: 0.70, y: 0.22 }, { x: 0.84, y: 0.16 }, { x: 0.92, y: 0.28 },
      { x: 0.86, y: 0.40 }, { x: 0.72, y: 0.36 },
    ],
  };

  let agents = [];
  let rings = [];
  let lastStamp = 0;
  let lastPing = 0;

  function makeAgents() {
    const compact = canvas.width < 720;
    const kept = {};
    agents.forEach((a) => { kept[a.kind] = a.t; });
    agents = [
      { kind: "ship", path: toWorld(PATHS.ship), t: kept.ship || 0.12, speed: 0.000052, scale: compact ? 1.05 : 1.35, color: "p", radius: 36 },
      { kind: "car", path: toWorld(PATHS.car), t: kept.car || 0.42, speed: 0.000078, scale: compact ? 1.0 : 1.2, color: "s", radius: 28 },
    ];
    if (!compact) {
      agents.push({ kind: "robot", path: toWorld(PATHS.robot), t: kept.robot || 0.68, speed: 0.00007, scale: 1.05, color: "p", radius: 24 });
    }
  }

  function drawIcon(kind) {
    ctx.lineWidth = 1.7;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (kind === "car") {
      ctx.beginPath();
      ctx.moveTo(-16, 3);
      ctx.lineTo(-9, 3);
      ctx.lineTo(-4, -8);
      ctx.lineTo(7, -8);
      ctx.lineTo(13, 3);
      ctx.lineTo(16, 3);
      ctx.lineTo(16, 7);
      ctx.lineTo(-16, 7);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-7, 9, 3.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(9, 9, 3.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeRect(-2, -13, 5, 4);
    } else if (kind === "ship") {
      ctx.beginPath();
      ctx.moveTo(-22, 1);
      ctx.lineTo(22, 1);
      ctx.lineTo(15, 11);
      ctx.lineTo(-15, 11);
      ctx.closePath();
      ctx.stroke();
      ctx.strokeRect(-3, -10, 11, 11);
      ctx.beginPath();
      ctx.moveTo(2, -10);
      ctx.lineTo(2, -17);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(2, -19, 2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeRect(-8, -7, 16, 13);
      ctx.beginPath();
      ctx.arc(-12, 1, 5.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(12, 1, 5.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -2, 2.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeRect(-3, -15, 6, 5);
    }
  }

  function drawLoop(pts, alpha) {
    ctx.beginPath();
    const first = loopPoint(pts, 0);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i <= 90; i++) {
      const p = loopPoint(pts, i / 90);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.strokeStyle = rgba("p", alpha);
    ctx.lineWidth = 1.15;
    ctx.stroke();
    pts.forEach((p) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = rgba("s", alpha * 1.5);
      ctx.lineWidth = 1;
      ctx.strokeRect(-2.8, -2.8, 5.6, 5.6);
      ctx.restore();
    });
  }

  function drawSegment(pts, t0, t1, dashed, alpha) {
    ctx.beginPath();
    const start = loopPoint(pts, t0);
    ctx.moveTo(start.x, start.y);
    for (let i = 1; i <= 28; i++) {
      const p = loopPoint(pts, t0 + (t1 - t0) * (i / 28));
      ctx.lineTo(p.x, p.y);
    }
    ctx.setLineDash(dashed ? [5, 6] : []);
    ctx.strokeStyle = rgba("p", alpha);
    ctx.lineWidth = dashed ? 1.35 : 2;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawArm(now) {
    const base = { x: canvas.width * 0.9, y: canvas.height * 0.78 };
    const j1 = -0.85 + Math.sin(now * 0.0007) * 0.32;
    const j2 = 1.05 + Math.cos(now * 0.0009) * 0.38;
    ctx.save();
    ctx.strokeStyle = rgba("s", ink(0.28));
    ctx.fillStyle = rgba("s", ink(0.04));
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(base.x, base.y - 8, 56, 0, Math.PI * 2);
    ctx.strokeStyle = rgba("s", ink(0.08));
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = rgba("s", ink(0.28));
    ctx.lineWidth = 1.8;
    ctx.translate(base.x, base.y);
    ctx.beginPath();
    ctx.rect(-14, 6, 28, 7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 4, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(j1);
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(0, -34);
    ctx.stroke();
    ctx.translate(0, -34);
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(j2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -28);
    ctx.stroke();
    ctx.translate(0, -28);
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(-6, -9);
    ctx.moveTo(5, 0);
    ctx.lineTo(6, -9);
    ctx.stroke();
    ctx.restore();
  }

  function drawField() {
    const originX = canvas.width * 0.07;
    const originY = canvas.height * 0.93;
    ctx.strokeStyle = rgba("p", ink(0.075));
    ctx.lineWidth = 1;
    const maxR = Math.max(canvas.width, canvas.height) * 0.72;
    for (let r = 88; r < maxR; r += 76) {
      ctx.beginPath();
      ctx.arc(originX, originY, r, Math.PI * 1.04, Math.PI * 1.94);
      ctx.stroke();
    }
  }

  function drawFrame(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawField();
    agents.forEach((agent) => drawLoop(agent.path, ink(0.1)));
    agents.forEach((agent) => {
      const pos = loopPoint(agent.path, agent.t);
      const ahead = loopPoint(agent.path, agent.t + 0.012);
      const heading = Math.atan2(ahead.y - pos.y, ahead.x - pos.x);

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, agent.radius, 0, Math.PI * 2);
      ctx.fillStyle = rgba(agent.color, ink(0.045));
      ctx.fill();
      ctx.strokeStyle = rgba(agent.color, ink(0.16));
      ctx.lineWidth = 1.2;
      ctx.stroke();

      drawSegment(agent.path, agent.t, agent.t + 0.2, true, ink(0.28));
      drawSegment(agent.path, agent.t - 0.055, agent.t, false, ink(0.22));

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(heading);
      ctx.scale(agent.scale, agent.scale);
      ctx.strokeStyle = rgba(agent.color, ink(0.44));
      drawIcon(agent.kind);
      ctx.restore();
    });

    if (canvas.width >= 720) drawArm(now);

    rings.forEach((ring) => {
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      ctx.strokeStyle = rgba("p", ink(0.18) * ring.life);
      ctx.lineWidth = 1.15;
      ctx.stroke();
    });
  }

  function tick(now) {
    if (!document.hidden) {
      const dt = lastStamp ? Math.min(34, now - lastStamp) : 16;
      lastStamp = now;
      agents.forEach((agent) => { agent.t += agent.speed * dt; });
      rings.forEach((ring) => {
        ring.r += dt * 0.034;
        ring.life -= dt * 0.00042;
      });
      rings = rings.filter((ring) => ring.life > 0);
      if (!lastPing || now - lastPing > 2500) {
        const host = agents[0];
        if (host) {
          const p = loopPoint(host.path, host.t);
          rings.push({ x: p.x, y: p.y, r: 16, life: 1 });
        }
        lastPing = now;
      }
      drawFrame(now);
    }
    requestAnimationFrame(tick);
  }

  function boot() {
    resizeCanvas();
    makeAgents();
    if (reduceMotion) {
      drawFrame(0);
      return;
    }
    requestAnimationFrame(tick);
  }

  window.refreshParticles = function () {
    makeAgents();
  };
  window.addEventListener("resize", () => {
    resizeCanvas();
    makeAgents();
  });
  boot();
})();

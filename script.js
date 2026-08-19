(function () {
  const navbar = document.getElementById("navbar");
  const hamburger = document.querySelector(".hamburger");
  const navLinks = document.querySelector(".nav-links");
  const navItems = document.querySelectorAll(".nav-links li a");
  const pageSections = document.querySelectorAll(".page-section");

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

  const canvas = document.getElementById("particleCanvas");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!canvas || reduceMotion || document.hidden) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rootStyles = getComputedStyle(document.documentElement);
  function getThemeColor(varName, fallback) {
    const val = rootStyles.getPropertyValue(varName).trim();
    return val || fallback;
  }

  let particlesArray = [];
  let animationFrameId;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  class Particle {
    constructor(x, y, directionX, directionY, size, color) {
      this.x = x;
      this.y = y;
      this.directionX = directionX;
      this.directionY = directionY;
      this.size = size;
      this.color = color;
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
      ctx.fillStyle = this.color;
      ctx.fill();
    }
    update() {
      if (this.x + this.size > canvas.width || this.x - this.size < 0) this.directionX = -this.directionX;
      if (this.y + this.size > canvas.height || this.y - this.size < 0) this.directionY = -this.directionY;
      this.x += this.directionX;
      this.y += this.directionY;
      this.draw();
    }
  }

  function init() {
    particlesArray = [];
    let numberOfParticles = (canvas.height * canvas.width) / 14000;
    if (numberOfParticles > 70) numberOfParticles = 70;
    const pr = getThemeColor("--theme-primary-r", "46");
    const pg = getThemeColor("--theme-primary-g", "196");
    const pb = getThemeColor("--theme-primary-b", "182");
    const sr = getThemeColor("--theme-secondary-r", "94");
    const sg = getThemeColor("--theme-secondary-g", "177");
    const sb = getThemeColor("--theme-secondary-b", "255");
    for (let i = 0; i < numberOfParticles; i++) {
      const size = Math.random() * 2 + 1;
      const x = Math.random() * (canvas.width - size * 4) + size * 2;
      const y = Math.random() * (canvas.height - size * 4) + size * 2;
      const color =
        Math.random() > 0.5
          ? "rgba(" + pr + ", " + pg + ", " + pb + ", 0.4)"
          : "rgba(" + sr + ", " + sg + ", " + sb + ", 0.3)";
      particlesArray.push(new Particle(x, y, Math.random() * 1.2 - 0.6, Math.random() * 1.2 - 0.6, size, color));
    }
  }

  function connect() {
    const maxDistance = (canvas.width / 11) * (canvas.height / 11);
    const divisor = 20000;
    const pr = getThemeColor("--theme-primary-r", "46");
    const pg = getThemeColor("--theme-primary-g", "196");
    const pb = getThemeColor("--theme-primary-b", "182");
    ctx.lineWidth = 1.1;
    for (let a = 0; a < particlesArray.length; a++) {
      for (let b = a + 1; b < particlesArray.length; b++) {
        const dx = particlesArray[a].x - particlesArray[b].x;
        const dy = particlesArray[a].y - particlesArray[b].y;
        const distance = dx * dx + dy * dy;
        if (distance < maxDistance) {
          const opacityValue = 1 - distance / divisor;
          ctx.strokeStyle = "rgba(" + pr + ", " + pg + ", " + pb + ", " + opacityValue * 0.5 + ")";
          ctx.beginPath();
          ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
          ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    if (document.hidden) {
      animationFrameId = requestAnimationFrame(animate);
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particlesArray.forEach((p) => p.update());
    connect();
    animationFrameId = requestAnimationFrame(animate);
  }

  resizeCanvas();
  init();
  animate();
  window.addEventListener("resize", () => {
    resizeCanvas();
    init();
  });
})();

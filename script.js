(function () {
  const navbar = document.getElementById("navbar");
  const hamburger = document.querySelector(".hamburger");
  const navPanel = document.querySelector(".nav-panel");
  const navLinks = document.querySelector(".nav-links");
  const navItems = document.querySelectorAll(".nav-links li a");

  function setMenuOpen(open) {
    if (navPanel) navPanel.classList.toggle("active", open);
    if (navLinks) navLinks.classList.toggle("active", open);
    if (hamburger) {
      hamburger.setAttribute("aria-expanded", open ? "true" : "false");
      hamburger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }
  }
  const pageSections = document.querySelectorAll(".page-section");

  window.addEventListener("scroll", () => {
    if (!navbar) return;
    navbar.classList.toggle("scrolled", window.scrollY > 50);
  });

  if (hamburger && navPanel) {
    hamburger.addEventListener("click", () => {
      setMenuOpen(!navPanel.classList.contains("active"));
    });
  }

  function navigateToSection(targetId, fromHistory) {
    const targetSection = document.querySelector(targetId);
    if (!targetSection || !targetSection.classList.contains("page-section")) return;

    const navAlias = {
      "#member-im": "#members",
      "#member-yu": "#members",
      "#lecture-future": "#lecture"
    };
    navItems.forEach((nav) => {
      const href = nav.getAttribute("href");
      nav.classList.toggle("active", href === targetId || href === navAlias[targetId]);
    });

    pageSections.forEach((section) => section.classList.add("hidden-page"));
    targetSection.classList.remove("hidden-page");

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

    setMenuOpen(false);

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
      if (document.querySelector(targetId)?.classList.contains("page-section")) {
        e.preventDefault();
        navigateToSection(targetId);
      }
    });
  });

  function collapseResearchCards() {
    document.querySelectorAll(".bento-wrapper.expanded").forEach((w) => {
      w.classList.remove("expanded");
      w.querySelector(".bento-item")?.classList.remove("expanded");
      const d = w.querySelector(".bento-details");
      if (d) d.style.maxHeight = null;
      const t = w.querySelector(".action-text");
      if (t) t.textContent = "View Details";
    });
  }

  function openTab(evt, tabName) {
    const btn = evt && evt.currentTarget;
    const scope = btn && btn.closest(".tabs") && btn.closest(".tabs").parentElement;
    if (!scope) return;
    scope.querySelectorAll(":scope > .tab-content").forEach((el) => {
      el.style.display = "none";
    });
    scope.querySelectorAll(":scope > .tabs .tab-btn").forEach((link) => {
      link.classList.remove("active");
    });
    const panel = document.getElementById(tabName);
    if (panel) panel.style.display = "block";
    btn.classList.add("active");
    collapseResearchCards();
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
    if (window.innerWidth > 1100) setMenuOpen(false);
    document.querySelectorAll(".bento-wrapper.expanded .bento-details").forEach((details) => {
      details.style.maxHeight = "none";
      details.style.maxHeight = details.scrollHeight + "px";
    });
  });

  function showSim(id) {
    const panel = document.getElementById(id);
    if (!panel) return;
    document.querySelectorAll(".sim-block").forEach((el) => {
      el.classList.toggle("is-hidden", el.id !== id);
    });
    document.querySelectorAll(".sim-nav-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-sim") === id);
    });
    const frame = panel.querySelector("iframe");
    if (frame && frame.dataset.src && !frame.getAttribute("src")) {
      frame.src = frame.dataset.src;
    }
  }

  document.querySelectorAll(".sim-nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => showSim(btn.getAttribute("data-sim")));
  });

  document.addEventListener("DOMContentLoaded", () => {
    if (window.location.hash) navigateToSection(window.location.hash);
  });

  window.navigateToSection = navigateToSection;
  window.openTab = openTab;
  window.toggleDetails = toggleDetails;

  window.refreshParticles = function () {
    if (typeof window.CanvasNestSetColor !== "function") return;
    var styles = getComputedStyle(document.documentElement);
    var rgb = [
      styles.getPropertyValue("--theme-primary-r").trim() || "12",
      styles.getPropertyValue("--theme-primary-g").trim() || "122",
      styles.getPropertyValue("--theme-primary-b").trim() || "115"
    ].join(",");
    window.CanvasNestSetColor(rgb);
  };

  window.refreshParticles();

  (function initSailCursor() {
    if (window.matchMedia("(hover: none), (pointer: coarse), (prefers-reduced-motion: reduce)").matches) return;

    const root = document.createElement("div");
    root.className = "sail-cursor";
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = '<div class="sail-cursor-ring"></div><div class="sail-cursor-dot"></div>';
    document.body.appendChild(root);
    document.documentElement.classList.add("has-sail-cursor");

    const ring = root.querySelector(".sail-cursor-ring");
    const dot = root.querySelector(".sail-cursor-dot");
    const hoverSel = "a, button, .chip-btn, .tab-btn, .sim-nav-btn, .bento-item, .cursor-pointer, .member-card, .lecture-card-link, .hamburger, .research-card";
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let rx = x;
    let ry = y;

    window.addEventListener("mousemove", (e) => {
      x = e.clientX;
      y = e.clientY;
      const overFrame = e.target.closest("iframe, video");
      root.classList.toggle("is-on", !overFrame);
      document.documentElement.classList.toggle("has-sail-cursor", !overFrame);
      root.classList.toggle("is-hover", !overFrame && !!e.target.closest(hoverSel));
    });
    window.addEventListener("mousedown", () => root.classList.add("is-down"));
    window.addEventListener("mouseup", () => root.classList.remove("is-down"));
    document.addEventListener("mouseleave", () => root.classList.remove("is-on"));
    document.addEventListener("mouseenter", () => root.classList.add("is-on"));

    function tick() {
      rx += (x - rx) * 0.16;
      ry += (y - ry) * 0.16;
      dot.style.transform = "translate3d(" + x + "px," + y + "px,0)";
      ring.style.transform = "translate3d(" + rx + "px," + ry + "px,0)";
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })();
})();

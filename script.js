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
      hamburger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
  }

  function navigateToSection(targetId, fromHistory) {
    const targetSection = document.querySelector(targetId);
    if (!targetSection || !targetSection.classList.contains("page-section")) return;

    navItems.forEach((nav) => {
      nav.classList.toggle("active", nav.getAttribute("href") === targetId);
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

    if (navLinks) navLinks.classList.remove("active");
    if (hamburger) {
      hamburger.setAttribute("aria-expanded", "false");
      hamburger.setAttribute("aria-label", "Open menu");
    }

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

  window.refreshParticles = function () {
    if (typeof window.CanvasNestSetColor !== "function") return;
    var styles = getComputedStyle(document.documentElement);
    var rgb = [
      styles.getPropertyValue("--theme-primary-r").trim() || "15",
      styles.getPropertyValue("--theme-primary-g").trim() || "138",
      styles.getPropertyValue("--theme-primary-b").trim() || "130"
    ].join(",");
    window.CanvasNestSetColor(rgb);
  };

  window.refreshParticles();
})();

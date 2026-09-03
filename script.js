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
  const courseControllers = {};
  const coursePageKeys = {
    "#lecture-mechatronics": "mech",
    "#lecture-vibrations": "vib",
    "#lecture-mpc": "mpc",
    "#lecture-av": "av"
  };

  function syncCourseDemos(targetId) {
    Object.entries(coursePageKeys).forEach(([hash, key]) => {
      const ctl = courseControllers[key];
      if (!ctl) return;
      if (targetId === hash) ctl.openFirst();
      else ctl.unload();
    });
  }

  window.addEventListener("scroll", () => {
    if (!navbar) return;
    navbar.classList.toggle("scrolled", window.scrollY > 50);
  });

  document.getElementById("explore-next")?.addEventListener("click", () => {
    document.getElementById("home-news")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  (function fillHomeNews() {
    const dest = document.getElementById("home-news-list");
    const items = document.querySelectorAll("#news .news-list > .news-item");
    if (!dest || !items.length) return;
    [...items].slice(0, 3).forEach((item) => {
      dest.appendChild(item.cloneNode(true));
    });
  })();

  if (hamburger && navPanel) {
    hamburger.addEventListener("click", () => {
      setMenuOpen(!navPanel.classList.contains("active"));
    });
  }

  function navigateToSection(targetId, fromHistory) {
    const targetSection = document.querySelector(targetId);
    if (!targetSection || !targetSection.classList.contains("page-section")) return;

    const navAlias = {
      "#professor": "#members",
      "#member-im": "#members",
      "#member-yu": "#members",
      "#member-woo": "#members",
      "#lecture-future": "#lecture",
      "#lecture-mechatronics": "#lecture",
      "#lecture-vibrations": "#lecture",
      "#lecture-mpc": "#lecture",
      "#lecture-av": "#lecture"
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
    syncCourseDemos(targetId);
    if (targetId === "#lecture-future") {
      const active = document.querySelector("#lecture-future .sim-nav-btn.active");
      if (active) showSim(active.getAttribute("data-sim"));
    }
    if (typeof window.setSailVehiclePage === "function") window.setSailVehiclePage(targetId);
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

  function setResearchCardOpen(wrapper, open) {
    const item = wrapper.querySelector(".bento-item");
    const details = wrapper.querySelector(".bento-details");
    const actionText = wrapper.querySelector(".action-text");
    wrapper.classList.toggle("expanded", open);
    item?.classList.toggle("expanded", open);
    item?.setAttribute("aria-expanded", open ? "true" : "false");
    if (details) details.style.maxHeight = open ? details.scrollHeight + "px" : null;
    if (actionText) actionText.textContent = open ? "Close Details" : "View Details";
  }

  function collapseResearchCards() {
    document.querySelectorAll(".bento-wrapper.expanded").forEach((w) => {
      setResearchCardOpen(w, false);
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

  function syncOverviewVideos() {
    const core = document.querySelector(".research-grid .research-card.selected")?.dataset.core;
    document.querySelectorAll(".overview-videos").forEach((el) => {
      el.hidden = el.dataset.core !== core;
    });
  }

  document.querySelectorAll("#lecture .lecture-card, .research-grid .research-card").forEach((card) => {
    card.addEventListener("click", () => {
      const on = card.classList.contains("selected");
      const scope = card.closest(".research-grid") || document.getElementById("lecture");
      scope.querySelectorAll(".lecture-card.selected, .research-card.selected").forEach((c) => {
        c.classList.remove("selected");
      });
      if (!on) card.classList.add("selected");
      syncOverviewVideos();
    });
  });

  document.querySelectorAll(".news-list").forEach((list) => {
    list.querySelectorAll(".news-item").forEach((card) => {
      card.addEventListener("click", () => {
        const on = card.classList.contains("selected");
        list.querySelectorAll(".news-item.selected").forEach((c) => c.classList.remove("selected"));
        if (!on) card.classList.add("selected");
      });
    });
  });

  document.querySelectorAll(".project-grid").forEach((grid) => {
    grid.querySelectorAll(".project-card").forEach((card) => {
      card.addEventListener("click", () => {
        const on = card.classList.contains("selected");
        grid.querySelectorAll(".project-card.selected").forEach((c) => c.classList.remove("selected"));
        if (!on) card.classList.add("selected");
      });
    });
  });

  document.querySelectorAll("#lab-overview .details-grid").forEach((grid) => {
    grid.querySelectorAll(".details-list").forEach((card) => {
      card.addEventListener("click", () => {
        const on = card.classList.contains("selected");
        grid.querySelectorAll(".details-list.selected").forEach((c) => c.classList.remove("selected"));
        if (!on) card.classList.add("selected");
      });
    });
  });

  document.querySelectorAll("#members .member-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      const on = card.classList.contains("selected");
      document.querySelectorAll("#members .member-card.selected").forEach((c) => {
        c.classList.remove("selected");
      });
      if (!on) {
        e.preventDefault();
        e.stopImmediatePropagation();
        card.classList.add("selected");
      }
    }, true);
  });

  function toggleDetails(wrapperId) {
    const wrapper = document.getElementById(wrapperId);
    if (!wrapper) return;
    const details = wrapper.querySelector(".bento-details");
    const isExpanded = wrapper.classList.contains("expanded");

    document.querySelectorAll(".bento-wrapper.expanded").forEach((w) => {
      if (w.id !== wrapperId) setResearchCardOpen(w, false);
    });

    if (isExpanded) {
      setResearchCardOpen(wrapper, false);
    } else {
      setResearchCardOpen(wrapper, true);
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

  const futureEmbeds = {
    "sim-path": { host: "path-host", html: "lecture/future-tech/path_embed.html?v=20260902g", js: "lecture/future-tech/path_embed.js?v=20260902g", refresh: "refresh_path_demo" },
    "sim-los": { host: "los-host", html: "lecture/future-tech/los_embed.html?v=20260902g", js: "lecture/future-tech/los_embed.js?v=20260902g", refresh: "refresh_los_demo" },
    "sim-pid": { host: "pid-host", html: "lecture/future-tech/pid_embed.html?v=20260902f", js: "lecture/future-tech/pid_embed.js?v=20260902f", refresh: "refresh_pid_demo" },
    "sim-pidpos": { host: "pidpos-host", html: "lecture/future-tech/pidpos_embed.html?v=20260902f", js: "lecture/future-tech/pidpos_embed.js?v=20260902f", refresh: "refresh_pidpos_demo" }
  };
  const futureLoaded = {};

  function loadFutureEmbed(id) {
    const spec = futureEmbeds[id];
    if (!spec) return;
    const host = document.getElementById(spec.host);
    if (!host) return;
    if (futureLoaded[id]) {
      if (typeof window[spec.refresh] === "function") window[spec.refresh]();
      return;
    }
    futureLoaded[id] = true;
    fetch(spec.html).then((res) => res.text()).then((html) => {
      host.innerHTML = html;
      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = spec.js;
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });
    }).then(() => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (typeof window[spec.refresh] === "function") window[spec.refresh]();
      }));
    }).catch(() => {
      futureLoaded[id] = false;
    });
  }

  function showSim(id) {
    const panel = document.getElementById(id);
    if (!panel) return;
    const scope = panel.closest(".page-section") || document;
    scope.querySelectorAll(".sim-block").forEach((el) => {
      el.classList.toggle("is-hidden", el.id !== id);
    });
    scope.querySelectorAll(".sim-nav-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-sim") === id);
    });
    const frame = panel.querySelector("iframe");
    if (frame && frame.dataset.src && !frame.getAttribute("src")) {
      frame.src = frame.dataset.src;
    }
    if (futureEmbeds[id]) loadFutureEmbed(id);
  }

  document.querySelectorAll(".sim-nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => showSim(btn.getAttribute("data-sim")));
  });

  const COURSE_DEMOS = {
    mech: {
      lecNav: "mech-lec-nav",
      simNav: "mech-sim-nav",
      title: "mech-title",
      desc: "mech-desc",
      host: "mech-host",
      lectures: [
        { id: "1", name: "1강 · 파이프라인" },
        { id: "2", name: "2강 · 센서·샘플링" },
        { id: "3", name: "3강 · 평균" },
        { id: "4", name: "4강 · 필터" },
        { id: "5", name: "5강 · 칼만 필터" },
        { id: "6", name: "6강 · 모델링" },
        { id: "7", name: "7강 · 1·2차 응답" },
        { id: "9", name: "9강 · 라플라스" },
        { id: "10", name: "10강 · 전달함수" },
        { id: "11", name: "11강 · 피드백·PID" },
        { id: "12", name: "12강 · PID 튜닝" },
        { id: "13", name: "13강 · 경로 추종" },
        { id: "14", name: "14강 · 표현·검증" }
      ],
      demos: [
        { lec: "1", title: "계측·모델링·제어 파이프라인", src: "lecture/mechatronics/demo/01강_큰그림파이프라인_demo.html" },
        { lec: "1", title: "개루프 vs 폐루프", src: "lecture/mechatronics/demo/01강_피드백제어개념_demo.html" },
        { lec: "2", title: "샘플링과 에일리어싱", src: "lecture/mechatronics/demo/02강_샘플링에일리어싱_demo.html" },
        { lec: "2", title: "정확도 vs 정밀도", src: "lecture/mechatronics/demo/02강_정확도정밀도_demo.html" },
        { lec: "2", title: "측정 노이즈와 평균 필터", src: "lecture/mechatronics/demo/02강_평균필터_demo.html" },
        { lec: "3", title: "누적 평균 vs 이동평균", src: "lecture/mechatronics/demo/03강_세평균비교_demo.html" },
        { lec: "3", title: "재귀식 평균 = 배치식 평균", src: "lecture/mechatronics/demo/03강_재귀식평균_demo.html" },
        { lec: "3", title: "이동평균", src: "lecture/mechatronics/demo/03강_이동평균_demo.html" },
        { lec: "4", title: "3필터 비교", src: "lecture/mechatronics/demo/04강_3필터비교_demo.html" },
        { lec: "4", title: "LPF의 α", src: "lecture/mechatronics/demo/04강_LPF알파_demo.html" },
        { lec: "4", title: "지수 가중치", src: "lecture/mechatronics/demo/04강_지수가중치_demo.html" },
        { lec: "4", title: "주파수 응답", src: "lecture/mechatronics/demo/04강_주파수응답_demo.html" },
        { lec: "5", title: "칼만 게인 K", src: "lecture/mechatronics/demo/05강_칼만게인_demo.html" },
        { lec: "5", title: "Predict–Update", src: "lecture/mechatronics/demo/05강_예측업데이트_demo.html" },
        { lec: "5", title: "Q와 R 튜닝", src: "lecture/mechatronics/demo/05강_QR튜닝_demo.html" },
        { lec: "5", title: "분포 융합", src: "lecture/mechatronics/demo/05강_분포융합_demo.html" },
        { lec: "6", title: "RLC 상사성", src: "lecture/mechatronics/demo/06강_RLC상사성_demo.html" },
        { lec: "6", title: "FBD에서 운동방정식 조립", src: "lecture/mechatronics/demo/06강_FBD조립_demo.html" },
        { lec: "6", title: "질량–스프링–댐퍼", src: "lecture/mechatronics/demo/06강_MSD시뮬레이터_demo.html" },
        { lec: "6", title: "진자 선형화", src: "lecture/mechatronics/demo/06강_진자선형화_demo.html" },
        { lec: "7", title: "1차 시스템 — τ와 63.2%", src: "lecture/mechatronics/demo/07강_1차시스템_demo.html" },
        { lec: "7", title: "감쇠 3분류", src: "lecture/mechatronics/demo/07강_감쇠3분류_demo.html" },
        { lec: "7", title: "극점과 응답", src: "lecture/mechatronics/demo/07강_극점과응답_demo.html" },
        { lec: "7", title: "성능 지표", src: "lecture/mechatronics/demo/07강_성능지표_demo.html" },
        { lec: "9", title: "변환쌍 매칭", src: "lecture/mechatronics/demo/09강_변환쌍매칭_demo.html" },
        { lec: "9", title: "미분↔s", src: "lecture/mechatronics/demo/09강_미분성질검증_demo.html" },
        { lec: "9", title: "부분분수", src: "lecture/mechatronics/demo/09강_부분분수_demo.html" },
        { lec: "9", title: "해석해 vs 수치해", src: "lecture/mechatronics/demo/09강_해석해vs수치해_demo.html" },
        { lec: "10", title: "전달함수 읽기", src: "lecture/mechatronics/demo/10강_전달함수읽기_demo.html" },
        { lec: "10", title: "극점 안정성", src: "lecture/mechatronics/demo/10강_극점안정성_demo.html" },
        { lec: "10", title: "최종값 정리", src: "lecture/mechatronics/demo/10강_최종값정리_demo.html" },
        { lec: "10", title: "피드백 연결", src: "lecture/mechatronics/demo/10강_피드백결합_demo.html" },
        { lec: "11", title: "개루프 vs 폐루프", src: "lecture/mechatronics/demo/11강_개루프폐루프_demo.html" },
        { lec: "11", title: "P·I·D 성분", src: "lecture/mechatronics/demo/11강_PID성분_demo.html" },
        { lec: "11", title: "정상상태 오차", src: "lecture/mechatronics/demo/11강_정상상태오차_demo.html" },
        { lec: "11", title: "2차+PD", src: "lecture/mechatronics/demo/11강_PD자유도2_demo.html" },
        { lec: "12", title: "P/PI/PD/PID 비교", src: "lecture/mechatronics/demo/12강_구조비교_demo.html" },
        { lec: "12", title: "속도 PID 튜닝", src: "lecture/mechatronics/demo/12강_PID튜닝_demo.html" },
        { lec: "12", title: "Ziegler–Nichols", src: "lecture/mechatronics/demo/12강_지글러니콜스_demo.html" },
        { lec: "12", title: "액추에이터 포화", src: "lecture/mechatronics/demo/12강_액추에이터포화_demo.html" },
        { lec: "13", title: "CTE", src: "lecture/mechatronics/demo/13강_CTE_demo.html" },
        { lec: "13", title: "자전거 경로 추종", src: "lecture/mechatronics/demo/13강_경로추종_demo.html" },
        { lec: "13", title: "게인과 추종", src: "lecture/mechatronics/demo/13강_게인과추종_demo.html" },
        { lec: "13", title: "GPS+칼만", src: "lecture/mechatronics/demo/13강_칼만융합_demo.html" },
        { lec: "14", title: "4가지 표현", src: "lecture/mechatronics/demo/14강_4가지표현_demo.html" },
        { lec: "14", title: "손계산 검증", src: "lecture/mechatronics/demo/14강_검증습관_demo.html" }
      ]
    },
    vib: {
      lecNav: "vib-lec-nav",
      simNav: "vib-sim-nav",
      title: "vib-title",
      desc: "vib-desc",
      host: "vib-host",
      lectures: [
        { id: "1", name: "1강 · 개요" },
        { id: "2", name: "2강 · 자유진동" },
        { id: "3", name: "3강 · 감쇠" },
        { id: "4", name: "4강 · 강성 설계" },
        { id: "5", name: "5강 · 조화가진" },
        { id: "6", name: "6강 · 전달함수" },
        { id: "7", name: "7강 · 바닥가진" },
        { id: "9", name: "9강 · 임펄스" },
        { id: "10", name: "10강 · 주기입력" },
        { id: "11", name: "11강 · 라플라스" },
        { id: "12", name: "12강 · 2자유도" },
        { id: "13", name: "13강 · 모드해석" },
        { id: "14", name: "14강 · 흡진기" }
      ],
      demos: [
        { lec: "1", title: "1자유도 3가지 예제", src: "lecture/vibrations/demos/lec01/lec01_d1_dof.html" },
        { lec: "1", title: "고유진동수", src: "lecture/vibrations/demos/lec01/lec01_d2_natfreq.html" },
        { lec: "1", title: "자동차 서스펜션", src: "lecture/vibrations/demos/lec01/lec01_d3_suspension.html" },
        { lec: "2", title: "초기조건 → 진폭·위상", src: "lecture/vibrations/demos/lec02/lec02_d1_initcond.html" },
        { lec: "2", title: "변위·속도·가속도 위상", src: "lecture/vibrations/demos/lec02/lec02_d2_phase.html" },
        { lec: "2", title: "평균·평균제곱·RMS", src: "lecture/vibrations/demos/lec02/lec02_d3_rms.html" },
        { lec: "3", title: "감쇠비 ζ 탐험기", src: "lecture/vibrations/demos/lec03/lec03_d1_damping.html" },
        { lec: "3", title: "정착시간 Ts = 4/(ζωₙ)", src: "lecture/vibrations/demos/lec03/lec03_d2_settling.html" },
        { lec: "3", title: "에너지 방법 Tmax = Umax", src: "lecture/vibrations/demos/lec03/lec03_d3_energy.html" },
        { lec: "4", title: "실제 부품 강성 계산기", src: "lecture/vibrations/demos/lec04/lec04_d1_stiffness.html" },
        { lec: "4", title: "직렬 vs 병렬 등가강성", src: "lecture/vibrations/demos/lec04/lec04_d2_springs.html" },
        { lec: "4", title: "허용 변위 설계 미션", src: "lecture/vibrations/demos/lec04/lec04_d3_design.html" },
        { lec: "5", title: "맥놀이(Beat) 관찰기", src: "lecture/vibrations/demos/lec05/lec05_d1_beat.html" },
        { lec: "5", title: "공진 — 발산과 감쇠", src: "lecture/vibrations/demos/lec05/lec05_d2_resonance.html" },
        { lec: "5", title: "과도응답 vs 정상상태", src: "lecture/vibrations/demos/lec05/lec05_d3_transient.html" },
        { lec: "6", title: "무차원 진폭·위상 FRF", src: "lecture/vibrations/demos/lec06/lec06_d1_frf.html" },
        { lec: "6", title: "복소평면 페이저", src: "lecture/vibrations/demos/lec06/lec06_d2_phasor.html" },
        { lec: "6", title: "전달함수 H(s)", src: "lecture/vibrations/demos/lec06/lec06_d3_transfer.html" },
        { lec: "7", title: "전달률 탐험기", src: "lecture/vibrations/demos/lec07/lec07_d1_transmissibility.html" },
        { lec: "7", title: "노면 주행 자동차", src: "lecture/vibrations/demos/lec07/lec07_d2_car.html" },
        { lec: "7", title: "회전불균형", src: "lecture/vibrations/demos/lec07/lec07_d3_unbalance.html" },
        { lec: "9", title: "임펄스 응답함수 h(t)", src: "lecture/vibrations/demos/lec09_d1_impulse.html" },
        { lec: "9", title: "컨벌루션 적분", src: "lecture/vibrations/demos/lec09_d2_convolution.html" },
        { lec: "9", title: "계단·펄스 응답", src: "lecture/vibrations/demos/lec09_d3_step.html" },
        { lec: "10", title: "푸리에 급수 합성기", src: "lecture/vibrations/demos/lec10_d1_fourier.html" },
        { lec: "10", title: "파형 ↔ 스펙트럼", src: "lecture/vibrations/demos/lec10_d2_spectrum.html" },
        { lec: "10", title: "고조파 공진", src: "lecture/vibrations/demos/lec10_d3_harmonic.html" },
        { lec: "11", title: "s-평면 극점 ↔ 시간응답", src: "lecture/vibrations/demos/lec11_d1_splane.html" },
        { lec: "11", title: "변환표 8번 vs 9번", src: "lecture/vibrations/demos/lec11_d2_responses.html" },
        { lec: "11", title: "시간이동 정리", src: "lecture/vibrations/demos/lec11_d3_timeshift.html" },
        { lec: "12", title: "모드형상 — 동상과 역상", src: "lecture/vibrations/demos/lec12_d1_modeshape.html" },
        { lec: "12", title: "특성방정식 계산기", src: "lecture/vibrations/demos/lec12_d2_eigen.html" },
        { lec: "12", title: "모드 중첩", src: "lecture/vibrations/demos/lec12_d3_superposition.html" },
        { lec: "13", title: "모드좌표 vs 물리좌표", src: "lecture/vibrations/demos/lec13_d1_modalcoord.html" },
        { lec: "13", title: "직교성과 정규화", src: "lecture/vibrations/demos/lec13_d2_orthogonality.html" },
        { lec: "13", title: "모드해석 5단계", src: "lecture/vibrations/demos/lec13_d3_workflow.html" },
        { lec: "14", title: "흡진기 조정: X=0", src: "lecture/vibrations/demos/lec14_d1_tuning.html" },
        { lec: "14", title: "무차원 설계 지도", src: "lecture/vibrations/demos/lec14_d2_safeband.html" }
      ]
    }
  };

  const courseGens = {};
  const courseLoads = {};
  const COURSE_TRANSPORT_IDS = {
    startBtn: 1, stopBtn: 1, resetBtn: 1, play: 1, reset: 1,
    btnPlay: 1, btnReset: 1, btnStart: 1, btnStop: 1, btnRun: 1
  };

  function nextCourseGen(hostId) {
    courseGens[hostId] = (courseGens[hostId] || 0) + 1;
    return courseGens[hostId];
  }

  function courseDemoUrl(src) {
    return new URL(encodeURI(src), document.baseURI).href;
  }

  function matchBrace(css, openIdx) {
    let depth = 0;
    for (let i = openIdx; i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    return css.length - 1;
  }

  function stripDarkMedia(css) {
    let out = "";
    let i = 0;
    while (i < css.length) {
      if (css[i] === "@" && css.slice(i, i + 6).toLowerCase() === "@media") {
        const brace = css.indexOf("{", i);
        if (brace === -1) break;
        const header = css.slice(i, brace);
        const end = matchBrace(css, brace);
        if (/prefers-color-scheme\s*:\s*dark/i.test(header)) {
          i = end + 1;
          continue;
        }
      }
      out += css[i];
      i += 1;
    }
    return out;
  }

  function prefixCourseSelector(sel, scope) {
    const text = sel.trim();
    if (!text) return text;
    if (/^(@|from\b|to\b|\d)/.test(text)) return text;
    if (/^(:root|html|body)(\b|$|\[|#|\.|:)/.test(text)) {
      return text.replace(/^:root/, scope).replace(/^html\b/, scope).replace(/^body\b/, scope);
    }
    if (text === "*") return scope + ", " + scope + " *";
    if (text.startsWith("*")) return scope + " " + text;
    return scope + " " + text;
  }

  function prefixCourseCss(css, scope) {
    let out = "";
    let i = 0;
    while (i < css.length) {
      if (css[i] === "@") {
        const brace = css.indexOf("{", i);
        if (brace === -1) {
          out += css.slice(i);
          break;
        }
        const header = css.slice(i, brace).trim();
        const end = matchBrace(css, brace);
        const inner = css.slice(brace + 1, end);
        if (/^@(media|supports|layer)\b/i.test(header)) {
          out += header + "{" + prefixCourseCss(inner, scope) + "}";
        } else {
          out += css.slice(i, end + 1);
        }
        i = end + 1;
        continue;
      }
      if (/\s/.test(css[i])) {
        out += css[i];
        i += 1;
        continue;
      }
      const brace = css.indexOf("{", i);
      if (brace === -1) {
        out += css.slice(i);
        break;
      }
      const selectors = css.slice(i, brace);
      const end = matchBrace(css, brace);
      out += selectors.split(",").map((sel) => prefixCourseSelector(sel, scope)).join(",") + css.slice(brace, end + 1);
      i = end + 1;
    }
    return out;
  }

  function scopeCourseCss(css, scope) {
    return prefixCourseCss(stripDarkMedia(css.replace(/\/\*[\s\S]*?\*\//g, "")), scope);
  }

  function collectTransportButtons(host) {
    const found = [];
    host.querySelectorAll("button[id]").forEach((btn) => {
      if (COURSE_TRANSPORT_IDS[btn.id]) found.push(btn);
    });
    if (found.length) return found;
    host.querySelectorAll(".btn-row button, .button-row button, button.btn-acc").forEach((btn) => {
      const text = (btn.textContent || "").replace(/\s+/g, "");
      if (/시작|정지|초기화|재생|일시정지|계속/.test(text) && text.length < 18) found.push(btn);
    });
    return found;
  }

  function dressCourseDemo(host) {
    const canvas = host.querySelector("canvas#cv, canvas.sim, canvas");
    if (!canvas) return;
    let stage = canvas.closest(".demo-stage-canvas");
    if (!stage) {
      stage = document.createElement("div");
      stage.className = "demo-stage-canvas";
      canvas.parentNode.insertBefore(stage, canvas);
      stage.appendChild(canvas);
    }
    const buttons = collectTransportButtons(host);
    if (!buttons.length) return;
    let bar = stage.querySelector(":scope > .demo-toolbar");
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "demo-toolbar";
      stage.appendChild(bar);
    }
    buttons.forEach((btn) => bar.appendChild(btn));
    if (buttons.length >= 3) bar.classList.add("has-3");
    host.querySelectorAll(".btn-row, .button-row").forEach((row) => {
      if (!row.querySelector("button")) row.remove();
    });
  }

  function runCourseScript(code, host, hostId, gen) {
    const patched = code
      .replace(/document\.documentElement/g, "COURSE_ROOT")
      .replace(/window\.addEventListener/g, "courseWinOn");
    const courseWinOn = function (type, fn, opt) {
      const wrapped = function () {
        if (courseGens[hostId] !== gen) return;
        return fn.apply(this, arguments);
      };
      window.addEventListener(type, wrapped, opt);
    };
    const requestAnimationFrame = function (cb) {
      return window.requestAnimationFrame(function (t) {
        if (courseGens[hostId] !== gen) return;
        cb(t);
      });
    };
    const setInterval = function (cb, ms) {
      const id = window.setInterval(function () {
        if (courseGens[hostId] !== gen) {
          window.clearInterval(id);
          return;
        }
        cb();
      }, ms);
      return id;
    };
    const fn = new Function("COURSE_ROOT", "requestAnimationFrame", "setInterval", "courseWinOn", patched);
    fn(host, requestAnimationFrame, setInterval, courseWinOn);
  }

  function mountCourseDemo(host, html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const rawCss = [...doc.querySelectorAll("style")].map((el) => el.textContent).join("\n");
    const scripts = [...doc.querySelectorAll("script")].map((el) => el.textContent).filter(Boolean);
    const lede = doc.querySelector(".lede") || doc.querySelector(".subtitle");
    const ledeHtml = lede ? lede.innerHTML : "";
    doc.querySelectorAll("header, footer, script, style, .hero").forEach((el) => el.remove());
    const scope = "#" + host.id;
    const chrome = scope + ".course-embed{--bg:transparent;--accent:var(--primary-color);--accent-ink:var(--on-primary);background:transparent!important;min-height:0!important;padding:0!important;color:var(--copy-color);font-family:inherit}";
    host.innerHTML =
      "<style>" + scopeCourseCss(rawCss, scope) + chrome + "</style>" +
      (ledeHtml ? '<p class="course-hint">' + ledeHtml + "</p>" : "") +
      '<div class="course-embed-body">' + doc.body.innerHTML + "</div>";
    return scripts;
  }

  function showCourseIframe(host, src, title) {
    host.innerHTML = "";
    const iframe = document.createElement("iframe");
    iframe.className = "course-frame";
    iframe.title = title || "실습 데모";
    iframe.allow = "accelerometer";
    iframe.src = courseDemoUrl(src);
    host.appendChild(iframe);
  }

  function loadCourseEmbed(host, src, title) {
    if (!host) return;
    const hostId = host.id;
    const gen = nextCourseGen(hostId);
    const seq = (courseLoads[hostId] = (courseLoads[hostId] || 0) + 1);
    host.innerHTML = '<p class="course-hint">데모를 불러오는 중…</p>';
    fetch(courseDemoUrl(src)).then((res) => {
      if (!res.ok) throw new Error("demo fetch failed");
      return res.text();
    }).then((html) => {
      if (courseLoads[hostId] !== seq) return;
      const scripts = mountCourseDemo(host, html);
      scripts.forEach((code) => {
        try {
          runCourseScript(code, host, hostId, gen);
        } catch (err) {
          console.error(src, err);
        }
      });
      dressCourseDemo(host);
      if (!host.querySelector("canvas, svg, input, table")) {
        showCourseIframe(host, src, title);
        return;
      }
      requestAnimationFrame(() => requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
      }));
    }).catch(() => {
      if (courseLoads[hostId] !== seq) return;
      showCourseIframe(host, src, title);
    });
  }

  function initCourseDemos(key, data) {
    const lecNav = document.getElementById(data.lecNav);
    const simNav = document.getElementById(data.simNav);
    const titleEl = document.getElementById(data.title);
    const descEl = document.getElementById(data.desc);
    const host = document.getElementById(data.host);
    if (!lecNav || !simNav || !titleEl || !descEl || !host) return;

    const state = { lec: data.lectures[0].id, src: "" };

    function lectureName(id) {
      return data.lectures.find((lec) => lec.id === id)?.name || id + "강";
    }

    function demosFor(lec) {
      return data.demos.filter((demo) => demo.lec === lec);
    }

    function renderLectures() {
      lecNav.innerHTML = "";
      data.lectures.forEach((lec) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sim-lec-btn" + (lec.id === state.lec ? " active" : "");
        btn.textContent = lec.name;
        btn.addEventListener("click", () => {
          state.lec = lec.id;
          renderLectures();
          renderDemos();
          showDemo(demosFor(lec.id)[0]);
        });
        lecNav.appendChild(btn);
      });
    }

    function renderDemos() {
      simNav.innerHTML = "";
      demosFor(state.lec).forEach((demo) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sim-pick-btn" + (demo.src === state.src ? " active" : "");
        btn.textContent = demo.title;
        btn.addEventListener("click", () => showDemo(demo));
        simNav.appendChild(btn);
      });
    }

    function showDemo(demo) {
      if (!demo) return;
      state.lec = demo.lec;
      state.src = demo.src;
      titleEl.textContent = demo.title;
      descEl.textContent = lectureName(demo.lec);
      loadCourseEmbed(host, demo.src, demo.title);
      renderLectures();
      renderDemos();
    }

    function openFirst() {
      if (!state.src) showDemo(demosFor(state.lec)[0]);
    }

    function unload() {
      state.src = "";
      nextCourseGen(host.id);
      host.innerHTML = "";
    }

    renderLectures();
    renderDemos();
    courseControllers[key] = { openFirst, unload };
  }

  Object.entries(COURSE_DEMOS).forEach(([key, data]) => initCourseDemos(key, data));

  let katexReady = null;
  function ensureKatex() {
    if (typeof window.renderMathInElement === "function") return Promise.resolve();
    if (katexReady) return katexReady;
    const ver = "0.16.22";
    const base = "https://cdn.jsdelivr.net/npm/katex@" + ver + "/dist/";
    katexReady = new Promise((resolve, reject) => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = base + "katex.min.css";
      document.head.appendChild(css);
      const core = document.createElement("script");
      core.src = base + "katex.min.js";
      core.onload = () => {
        const auto = document.createElement("script");
        auto.src = base + "contrib/auto-render.min.js";
        auto.onload = resolve;
        auto.onerror = reject;
        document.head.appendChild(auto);
      };
      core.onerror = reject;
      document.head.appendChild(core);
    });
    return katexReady;
  }

  function renderNoteMath(host) {
    if (typeof window.renderMathInElement !== "function") return;
    window.renderMathInElement(host, {
      delimiters: [
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false }
      ],
      ignoredClasses: ["note-code"],
      throwOnError: false
    });
  }

  (function initMpcNotes() {
    const lecNav = document.getElementById("mpc-lec-nav");
    const simNav = document.getElementById("mpc-sim-nav");
    const titleEl = document.getElementById("mpc-title");
    const descEl = document.getElementById("mpc-desc");
    const host = document.getElementById("mpc-host");
    if (!lecNav || !simNav || !titleEl || !descEl || !host) return;

    const lectures = [
      { id: "1", name: "1강 · 개요" },
      { id: "2", name: "2강 · 표준 문제" },
      { id: "3", name: "3강 · 안정성" },
      { id: "4", name: "4강 · 구현" },
      { id: "5", name: "5강 · Tube MPC" },
      { id: "6", name: "6강 · MPPI" }
    ];
    const notes = [
      { lec: "1", title: "개요", src: "lecture/mpc/01-overview.html" },
      { lec: "2", title: "표준 문제", src: "lecture/mpc/02-problem.html" },
      { lec: "3", title: "Linear MPC 안정성", src: "lecture/mpc/03-stability.html" },
      { lec: "4", title: "소프트웨어", src: "lecture/mpc/04-software.html" },
      { lec: "4", title: "Linear (CVXGEN)", src: "lecture/mpc/04-linear.html" },
      { lec: "4", title: "Nonlinear (CasADi)", src: "lecture/mpc/04-nonlinear.html" },
      { lec: "5", title: "Tube-based MPC", src: "lecture/mpc/05-tube.html" },
      { lec: "6", title: "MPPI", src: "lecture/mpc/06-mppi.html" },
      { lec: "6", title: "선박 충돌 회피", embed: "mppi" }
    ];
    const bust = "?v=20260902";
    const state = { lec: "1", src: "", seq: 0 };
    const mppiEmbed = {
      html: "lecture/mpc/mppi_embed.html",
      js: "lecture/mpc/mppi_embed.js",
      refresh: "refresh_mppi_demo"
    };
    let mppiLoaded = false;

    function lectureName(id) {
      return lectures.find((lec) => lec.id === id)?.name || id + "강";
    }
    function notesFor(lec) {
      return notes.filter((note) => note.lec === lec);
    }

    function renderLectures() {
      lecNav.replaceChildren();
      lectures.forEach((lec) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sim-lec-btn" + (lec.id === state.lec ? " active" : "");
        btn.textContent = lec.name;
        btn.addEventListener("click", () => {
          state.lec = lec.id;
          renderLectures();
          renderNotes();
          showNote(notesFor(lec.id)[0]);
        });
        lecNav.appendChild(btn);
      });
    }

    function noteKey(note) {
      return note.src || ("embed:" + note.embed);
    }

    function setMppiVisible(on) {
      const sim = document.getElementById("sim-mppi");
      if (sim) sim.classList.toggle("is-hidden", !on);
      host.hidden = on;
    }

    function loadMppiEmbed() {
      const dest = document.getElementById("mppi-host");
      if (!dest) return;
      if (mppiLoaded) {
        if (typeof window[mppiEmbed.refresh] === "function") window[mppiEmbed.refresh]();
        return;
      }
      mppiLoaded = true;
      fetch(mppiEmbed.html + bust).then((res) => {
        if (!res.ok) throw new Error(res.status);
        return res.text();
      }).then((html) => {
        dest.innerHTML = html;
        return new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = mppiEmbed.js + bust;
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }).then(() => {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (typeof window[mppiEmbed.refresh] === "function") window[mppiEmbed.refresh]();
        }));
      }).catch(() => {
        mppiLoaded = false;
        dest.innerHTML = '<p class="course-hint">시뮬레이터를 불러오지 못했습니다. 로컬 서버에서 다시 열어 주세요.</p>';
      });
    }

    function renderNotes() {
      const list = notesFor(state.lec);
      simNav.replaceChildren();
      simNav.classList.toggle("is-empty", list.length <= 1);
      list.forEach((note) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sim-pick-btn" + (noteKey(note) === state.src ? " active" : "");
        btn.textContent = note.title;
        btn.addEventListener("click", () => showNote(note));
        simNav.appendChild(btn);
      });
    }

    function showNote(note) {
      if (!note) return;
      const seq = ++state.seq;
      state.lec = note.lec;
      state.src = noteKey(note);
      titleEl.textContent = note.title;
      descEl.textContent = lectureName(note.lec);
      renderLectures();
      renderNotes();
      if (note.embed === "mppi") {
        host.innerHTML = "";
        setMppiVisible(true);
        loadMppiEmbed();
        return;
      }
      setMppiVisible(false);
      host.innerHTML = '<p class="course-hint">노트를 불러오는 중…</p>';
      fetch(note.src + bust).then((res) => {
        if (!res.ok) throw new Error(res.status);
        return res.text();
      }).then((html) => {
        if (state.seq !== seq) return;
        host.innerHTML = html;
        return ensureKatex().then(() => {
          if (state.seq !== seq) return;
          renderNoteMath(host);
        });
      }).catch(() => {
        if (state.seq !== seq) return;
        host.innerHTML = '<p class="course-hint">노트를 불러오지 못했습니다. 로컬 서버에서 다시 열어 주세요.</p>';
      });
    }

    function openFirst() {
      if (!state.src) showNote(notesFor(state.lec)[0]);
    }

    function unload() {
      state.src = "";
      state.seq += 1;
      host.innerHTML = "";
      setMppiVisible(false);
    }

    renderLectures();
    renderNotes();
    courseControllers.mpc = { openFirst, unload };
  })();

  (function initAvNotes() {
    const lecNav = document.getElementById("av-lec-nav");
    const simNav = document.getElementById("av-sim-nav");
    const titleEl = document.getElementById("av-title");
    const descEl = document.getElementById("av-desc");
    const host = document.getElementById("av-host");
    if (!lecNav || !simNav || !titleEl || !descEl || !host) return;

    const lectures = [
      { id: "0", name: "개요" },
      { id: "1", name: "1강 · A*" },
      { id: "2", name: "2강 · RRT" },
      { id: "3", name: "3강 · Vehicle" },
      { id: "4", name: "4강 · PID" },
      { id: "5", name: "5강 · Planning" },
      { id: "6", name: "6강 · CBF" },
      { id: "7", name: "7강 · MPPI" }
    ];
    const notes = [
      { lec: "0", title: "온보딩 개요", src: "lecture/av/00-overview.html" },
      { lec: "1", title: "A*", src: "lecture/av/01-astar.html" },
      { lec: "2", title: "RRT", src: "lecture/av/02-rrt.html" },
      { lec: "3", title: "Unicycle 모델", src: "lecture/av/03-vehicle.html" },
      { lec: "4", title: "Heading PID", src: "lecture/av/04-pid.html" },
      { lec: "5", title: "Planning → tracking", src: "lecture/av/05-planning.html" },
      { lec: "6", title: "HOCBF", src: "lecture/av/06-cbf.html" },
      { lec: "7", title: "MPPI", src: "lecture/av/07-mppi.html" }
    ];
    const bust = "?v=20260904";
    const state = { lec: "0", src: "", seq: 0 };

    function lectureName(id) {
      return lectures.find((lec) => lec.id === id)?.name || id + "강";
    }
    function notesFor(lec) {
      return notes.filter((note) => note.lec === lec);
    }

    function renderLectures() {
      lecNav.replaceChildren();
      lectures.forEach((lec) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sim-lec-btn" + (lec.id === state.lec ? " active" : "");
        btn.textContent = lec.name;
        btn.addEventListener("click", () => {
          state.lec = lec.id;
          showNote(notesFor(lec.id)[0]);
        });
        lecNav.appendChild(btn);
      });
    }

    function renderNotes() {
      const list = notesFor(state.lec);
      simNav.replaceChildren();
      simNav.classList.toggle("is-empty", list.length <= 1);
      list.forEach((note) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sim-pick-btn" + (note.src === state.src ? " active" : "");
        btn.textContent = note.title;
        btn.addEventListener("click", () => showNote(note));
        simNav.appendChild(btn);
      });
    }

    function showNote(note) {
      if (!note) return;
      const seq = ++state.seq;
      state.lec = note.lec;
      state.src = note.src;
      titleEl.textContent = note.title;
      descEl.textContent = lectureName(note.lec);
      host.innerHTML = '<p class="course-hint">노트를 불러오는 중…</p>';
      renderLectures();
      renderNotes();
      fetch(note.src + bust).then((res) => {
        if (!res.ok) throw new Error(res.status);
        return res.text();
      }).then((html) => {
        if (state.seq !== seq) return;
        host.innerHTML = html;
        return ensureKatex().then(() => {
          if (state.seq !== seq) return;
          renderNoteMath(host);
        });
      }).catch(() => {
        if (state.seq !== seq) return;
        host.innerHTML = '<p class="course-hint">노트를 불러오지 못했습니다. 로컬 서버에서 다시 열어 주세요.</p>';
      });
    }

    function openFirst() {
      if (!state.src) showNote(notesFor(state.lec)[0]);
    }

    function unload() {
      state.src = "";
      state.seq += 1;
      host.innerHTML = "";
    }

    renderLectures();
    renderNotes();
    courseControllers.av = { openFirst, unload };
  })();

  function youtubeIdFromSrc(src) {
    const m = String(src || "").match(/(?:embed\/|youtu\.be\/|watch\?v=)([\w-]{11})/);
    return m ? m[1] : "";
  }

  function playYoutubeLite(box) {
    const id = box.getAttribute("data-youtube");
    const title = box.getAttribute("data-youtube-title") || "YouTube video";
    if (!id) return;
    const iframe = document.createElement("iframe");
    iframe.src = "https://www.youtube-nocookie.com/embed/" + id +
      "?autoplay=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3";
    iframe.title = title;
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    box.classList.remove("is-lite");
    box.replaceChildren(iframe);
    const details = box.closest(".bento-wrapper.expanded")?.querySelector(".bento-details");
    if (details) details.style.maxHeight = details.scrollHeight + "px";
  }

  function setYoutubeThumb(img, id) {
    const files = ["hq720.jpg", "sddefault.jpg", "hqdefault.jpg", "mqdefault.jpg", "0.jpg"];
    let i = 0;
    function apply() {
      img.src = "https://i.ytimg.com/vi/" + id + "/" + files[i];
    }
    function next() {
      if (i < files.length - 1) {
        i += 1;
        apply();
      }
    }
    img.addEventListener("error", next);
    img.addEventListener("load", function () {
      // Missing high-res thumbs often return a 120x90 placeholder with HTTP 200.
      if (img.naturalWidth <= 120) next();
    });
    apply();
  }

  function initYoutubeLite() {
    document.querySelectorAll(".video-embed iframe[src*='youtube']").forEach((iframe) => {
      const id = youtubeIdFromSrc(iframe.src);
      const box = iframe.closest(".video-embed");
      if (!id || !box) return;
      const title = iframe.title || "YouTube video";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "yt-lite";
      btn.setAttribute("aria-label", "Play " + title);
      const thumb = document.createElement("img");
      thumb.alt = "";
      setYoutubeThumb(thumb, id);
      const play = document.createElement("span");
      play.className = "yt-lite-play";
      play.setAttribute("aria-hidden", "true");
      btn.append(thumb, play);
      box.classList.add("is-lite");
      box.setAttribute("data-youtube", id);
      box.setAttribute("data-youtube-title", title);
      box.replaceChildren(btn);
      btn.addEventListener("click", () => playYoutubeLite(box));
    });
  }

  initYoutubeLite();

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
      styles.getPropertyValue("--theme-primary-r").trim() || "29",
      styles.getPropertyValue("--theme-primary-g").trim() || "78",
      styles.getPropertyValue("--theme-primary-b").trim() || "137"
    ].join(",");
    window.CanvasNestSetColor(rgb);
  };

  window.refreshParticles();
})();

// Minimal launch overlay + chime for quiz links and buttons.
(function () {
  function playChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = 880;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2,  ctx.currentTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      o.start(); o.stop(ctx.currentTime + 0.4);
    } catch (e) {}
  }

  function showOverlayThen(href) {
    const ov = document.getElementById("launchOverlay");
    if (ov) ov.classList.remove("hidden");
    playChime();
    setTimeout(() => { window.location.href = href; }, 450);
  }

  // Remember grade if dropdown exists (used for Daily Deck)
  const gradeSel = document.getElementById("gradeSel");
  if (gradeSel) {
    gradeSel.addEventListener("change", () => {
      try { localStorage.setItem("beyondscool_lastGrade", gradeSel.value || ""); } catch {}
    });
  }

  function isLaunchHref(href){
    if (!href) return false;
    return href.indexOf("play.html") !== -1 || href.indexOf("host.html") !== -1;
  }

  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("a,button");
    if (!el) return;

    let href = el.getAttribute("href") || "";

    // Buttons (no href): map known buttons to targets
    if (!href || href === "#") {
      if (el.id === "dailyStart" || el.dataset.dailyStart === "1") {
        href = "./play.html?daily=1";
      }
    }

    if (!isLaunchHref(href)) return; // not our launch target

    // Guard: Daily Deck requires saved grade
    if (href.indexOf("daily=1") !== -1) {
      const g = (localStorage.getItem("beyondscool_lastGrade") || "").trim();
      if (!g) {
        ev.preventDefault();
        alert("Choose your grade first.");
        return;
      }
    }

    ev.preventDefault();
    showOverlayThen(href);
  });
})();


/* =========================================================
   Spin the Wheel — behaviour
   ========================================================= */
(function () {
  "use strict";

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------------- Theme ---------------- */
  const THEME_KEY = "stw_theme";
  const root = document.documentElement;
  const themeButtons = document.querySelectorAll("[data-theme-btn]");

  function applyTheme(name) {
    root.setAttribute("data-theme", name);
    themeButtons.forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.themeBtn === name));
    });
    localStorage.setItem(THEME_KEY, name);
  }

  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme) applyTheme(savedTheme);

  themeButtons.forEach((btn) => {
    btn.addEventListener("click", () => applyTheme(btn.dataset.themeBtn));
  });

  /* ---------------- Toast ---------------- */
  const toastEl = document.getElementById("toast");
  let toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  /* ================================================================
     Everything below only runs on the page that has the wheel
     ================================================================ */
  const canvas = document.getElementById("wheelCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const wheelFrame = document.querySelector(".wheel-frame");
  const spinBtn = document.getElementById("spinBtn");
  const choicesInput = document.getElementById("choicesInput");
  const chipList = document.getElementById("chipList");
  const winnerTicket = document.getElementById("winnerTicket");
  const winnerText = document.getElementById("winnerText");
  const resultAnnounce = document.getElementById("resultAnnounce");
  const soundToggle = document.getElementById("soundToggle");
  const shareBtn = document.getElementById("shareBtn");
  const saveImgBtn = document.getElementById("saveImgBtn");
  const presetsRow = document.getElementById("presetsRow");
  const historyRow = document.getElementById("historyRow");

  const CHOICES_KEY = "stw_choices_raw";
  const SOUND_KEY = "stw_sound";
  const HISTORY_KEY = "stw_history";
  const WHEEL_COLORS = ["#FF5A5F", "#FFB627", "#06A77D", "#5B7FDE", "#C86BFA", "#F2A65A", "#4FB0C6", "#E85D75"];

  const PRESETS = [
    { label: "🍔 Dinner", value: "Pizza, Tacos, Sushi, Burgers, Salad, Ramen" },
    { label: "🎬 Movie night", value: "Comedy, Action, Horror, Documentary, Rewatch a favorite" },
    { label: "✅ Yes or no", value: "Yes, No" },
    { label: "🧹 Chores", value: "Dishes, Laundry, Vacuum, Trash, Bathroom" },
    { label: "🎲 Who goes first", value: "Player 1, Player 2, Player 3, Player 4" },
  ];

  let soundOn = localStorage.getItem(SOUND_KEY) !== "off";
  let rotation = 0;
  let spinning = false;
  let entries = []; // [{label, weight}]
  let expanded = []; // labels repeated per weight, in wedge order

  /* ---------------- Casino sound engine (Web Audio, no external files) ---------------- */
  let audioCtx = null;
  let noiseBuffer = null;
  let masterBus = null;

  function getAudioCtx() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  // Shared output bus: a gentle limiter plus a warmth-preserving lowpass so nothing
  // spikes or turns harsh when several sounds overlap.
  function getMasterBus(actx) {
    if (masterBus) return masterBus;
    const compressor = actx.createDynamicsCompressor();
    compressor.threshold.value = -22;
    compressor.knee.value = 28;
    compressor.ratio.value = 3.5;
    compressor.attack.value = 0.006;
    compressor.release.value = 0.3;
    const warmth = actx.createBiquadFilter();
    warmth.type = "lowpass";
    warmth.frequency.value = 5200;
    const outGain = actx.createGain();
    outGain.gain.value = 0.85;
    compressor.connect(warmth).connect(outGain).connect(actx.destination);
    masterBus = compressor;
    return masterBus;
  }

  // A shared 1-second white noise buffer, reused and sliced for every noise-based hit
  function getNoiseBuffer(actx) {
    if (noiseBuffer) return noiseBuffer;
    const len = actx.sampleRate * 1;
    noiseBuffer = actx.createBuffer(1, len, actx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuffer;
  }

  // Soft mechanical "tock" — the wheel's pin brushing past a peg. Filtered noise,
  // tuned low and gentle rather than sharp and bright, so repeated ticks stay easy on the ear.
  function playTick(progress) {
    if (!soundOn) return;
    const actx = getAudioCtx();
    if (!actx) return;
    const bus = getMasterBus(actx);
    const t0 = actx.currentTime;

    const noise = actx.createBufferSource();
    noise.buffer = getNoiseBuffer(actx);

    const bandpass = actx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 550 + progress * 650;
    bandpass.Q.value = 5.5;

    const lowpass = actx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 1500;

    const gain = actx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(0.16, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0006, t0 + 0.045);

    noise.connect(bandpass).connect(lowpass).connect(gain).connect(bus);
    noise.start(t0);
    noise.stop(t0 + 0.05);

    // a soft low knock underneath, giving the click its body — this now carries
    // more of the sound than the noise layer, which is what takes the rasp out
    const knock = actx.createOscillator();
    const knockGain = actx.createGain();
    knock.type = "sine";
    knock.frequency.setValueAtTime(160, t0);
    knock.frequency.exponentialRampToValueAtTime(85, t0 + 0.05);
    knockGain.gain.setValueAtTime(0.0001, t0);
    knockGain.gain.linearRampToValueAtTime(0.15, t0 + 0.007);
    knockGain.gain.exponentialRampToValueAtTime(0.0006, t0 + 0.065);
    knock.connect(knockGain).connect(bus);
    knock.start(t0);
    knock.stop(t0 + 0.07);
  }

  // One pure, bell-like note — a fundamental plus soft, harmonically-related
  // overtones (not inharmonic like a real struck bell), which is what makes it read
  // as warm and musical rather than metallic. Closer to a celesta or glockenspiel.
  function playChimeNote(actx, time, freq, peakGain, decay) {
    const bus = getMasterBus(actx);
    const partials = [
      { ratio: 1, amp: 1 },
      { ratio: 2, amp: 0.22 },
      { ratio: 4, amp: 0.06 },
    ];
    partials.forEach((p) => {
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      const lp = actx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 3800;
      osc.type = "sine";
      osc.frequency.value = freq * p.ratio;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(peakGain * p.amp, time + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0004, time + decay);
      osc.connect(lp).connect(gain).connect(bus);
      osc.start(time);
      osc.stop(time + decay + 0.05);
    });
  }

  // Jackpot payoff: a soft low thump, then a short ascending 4-note phrase in a
  // warm, pure timbre — a little melodic "reward" cue rather than a bell ring —
  // with a quiet high sparkle layered under the final note.
  function playWinFanfare() {
    if (!soundOn) return;
    const actx = getAudioCtx();
    if (!actx) return;
    const bus = getMasterBus(actx);
    const t0 = actx.currentTime;

    // gentle impact thump on landing
    const thump = actx.createOscillator();
    const thumpGain = actx.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(140, t0);
    thump.frequency.exponentialRampToValueAtTime(48, t0 + 0.22);
    thumpGain.gain.setValueAtTime(0.0001, t0);
    thumpGain.gain.linearRampToValueAtTime(0.2, t0 + 0.015);
    thumpGain.gain.exponentialRampToValueAtTime(0.0006, t0 + 0.28);
    thump.connect(thumpGain).connect(bus);
    thump.start(t0);
    thump.stop(t0 + 0.29);

    // a short, pleasant ascending phrase — C5, E5, G5, C6 — each note a touch
    // brighter than the last, resolving on the octave for a satisfied, "done" feel
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const noteTimes = [t0 + 0.1, t0 + 0.24, t0 + 0.38, t0 + 0.54];
    notes.forEach((freq, i) => {
      const isLast = i === notes.length - 1;
      playChimeNote(actx, noteTimes[i], freq, isLast ? 0.3 : 0.22, isLast ? 1.1 : 0.4);
    });

    // a quiet high sparkle under the final note for a little extra shimmer
    const sparkleTime = noteTimes[noteTimes.length - 1] + 0.05;
    [2093, 2637, 3136].forEach((freq, i) => {
      const t = sparkleTime + i * 0.045;
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.05, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0003, t + 0.5);
      osc.connect(gain).connect(bus);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  }

  /* ---------------- Parsing ---------------- */
  function parseChoices(raw) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((item) => {
        const m = item.match(/^(.*?)\s*[x×]\s*(\d{1,2})$/i);
        if (m && Number(m[2]) > 1) {
          return { label: m[1].trim(), weight: Math.min(Number(m[2]), 9) };
        }
        return { label: item, weight: 1 };
      })
      .filter((e) => e.label.length > 0);
  }

  function rebuildFromInput(save) {
    entries = parseChoices(choicesInput.value);
    expanded = [];
    entries.forEach((e) => {
      for (let i = 0; i < e.weight; i++) expanded.push(e.label);
    });
    renderChips();
    resizeAndDraw();
    if (save) localStorage.setItem(CHOICES_KEY, choicesInput.value);
  }

  function renderChips() {
    chipList.innerHTML = "";
    entries.forEach((e, idx) => {
      const li = document.createElement("li");
      li.className = "chip";
      const text = e.weight > 1 ? `${e.label} ×${e.weight}` : e.label;
      li.innerHTML = `<span>${escapeHtml(text)}</span>`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("aria-label", `Remove ${e.label}`);
      btn.textContent = "✕";
      btn.addEventListener("click", () => {
        entries.splice(idx, 1);
        choicesInput.value = entries
          .map((e2) => (e2.weight > 1 ? `${e2.label} x${e2.weight}` : e2.label))
          .join(", ");
        rebuildFromInput(true);
      });
      li.appendChild(btn);
      chipList.appendChild(li);
    });
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  let debounceTimer;
  choicesInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => rebuildFromInput(true), 350);
  });
  choicesInput.addEventListener("blur", () => rebuildFromInput(true));

  /* ---------------- Canvas drawing ---------------- */
  function resizeAndDraw() {
    const cssSize = canvas.clientWidth || wheelFrame.clientWidth;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssSize * dpr;
    canvas.height = cssSize * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWheel(rotation, cssSize);
  }

  function contrastColor(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.6 ? "#1F2233" : "#FFFFFF";
  }

  function drawWheel(rot, size) {
    const n = expanded.length;
    const s = size || canvas.clientWidth;
    const cx = s / 2;
    const cy = s / 2;
    const radius = s / 2 - 4;
    const stroke = getComputedStyle(root).getPropertyValue("--wedge-stroke").trim() || "#fff";

    ctx.clearRect(0, 0, s, s);

    if (n === 0) {
      ctx.fillStyle = getComputedStyle(root).getPropertyValue("--surface").trim();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = getComputedStyle(root).getPropertyValue("--ink-soft").trim();
      ctx.font = "16px 'Space Grotesk', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Add options to begin", cx, cy);
      return;
    }

    const segAngle = (Math.PI * 2) / n;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);

    for (let i = 0; i < n; i++) {
      const start = -Math.PI / 2 + i * segAngle;
      const end = start + segAngle;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = stroke;
      ctx.stroke();

      // label
      ctx.save();
      ctx.rotate(start + segAngle / 2);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = contrastColor(WHEEL_COLORS[i % WHEEL_COLORS.length]);
      const fontSize = n > 12 ? 12 : n > 8 ? 14 : 16;
      ctx.font = `600 ${fontSize}px 'Space Grotesk', sans-serif`;
      let label = expanded[i];
      const maxChars = Math.max(6, Math.floor(radius / (fontSize * 0.55)));
      if (label.length > maxChars) label = label.slice(0, maxChars - 1) + "…";
      ctx.fillText(label, radius - 14, 0);
      ctx.restore();
    }

    ctx.restore();
  }

  window.addEventListener("resize", () => resizeAndDraw());

  /* ---------------- Spin ---------------- */
  function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  function spin() {
    if (spinning) return;
    if (expanded.length < 2) {
      toast("Add at least two options first");
      return;
    }
    spinning = true;
    spinBtn.disabled = true;
    winnerTicket.classList.remove("show");

    const n = expanded.length;
    const segAngle = (Math.PI * 2) / n;
    const winningIndex = Math.floor(Math.random() * n);

    const requiredMod =
      (((-(winningIndex * segAngle + segAngle / 2)) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const extraTurns = 6 + Math.floor(Math.random() * 3);
    const currentMod = ((rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const delta = ((requiredMod - currentMod) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const target = rotation + extraTurns * Math.PI * 2 + delta;

    const start = rotation;
    const duration = 4200;
    const t0 = performance.now();
    let lastWedge = Math.floor((((start % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / segAngle);

    function frame(now) {
      const elapsed = now - t0;
      const t = Math.min(elapsed / duration, 1);
      const eased = easeOutQuart(t);
      rotation = start + (target - start) * eased;

      const wedgeNow = Math.floor((((rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / segAngle);
      if (wedgeNow !== lastWedge) {
        lastWedge = wedgeNow;
        playTick(t);
      }

      drawWheel(rotation);

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        rotation = rotation % (Math.PI * 2);
        spinning = false;
        spinBtn.disabled = false;
        onLanded(winningIndex);
      }
    }
    requestAnimationFrame(frame);
  }

  function onLanded(index) {
    const label = expanded[index];
    winnerText.textContent = label;
    winnerTicket.classList.add("show");
    winnerTicket.setAttribute("aria-hidden", "false");
    resultAnnounce.textContent = `The wheel landed on ${label}`;
    playWinFanfare();
    burstConfetti();
    pushHistory(label);
  }

  spinBtn.addEventListener("click", spin);

  /* ---------------- Confetti ---------------- */
  function burstConfetti() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const stage = document.querySelector(".wheel-stage");
    for (let i = 0; i < 26; i++) {
      const piece = document.createElement("span");
      const color = WHEEL_COLORS[Math.floor(Math.random() * WHEEL_COLORS.length)];
      piece.style.cssText = `position:absolute;left:50%;top:30%;width:8px;height:12px;background:${color};
        border-radius:2px;pointer-events:none;z-index:20;`;
      stage.appendChild(piece);
      const xEnd = (Math.random() - 0.5) * 320;
      const yEnd = 200 + Math.random() * 160;
      const rot = Math.random() * 720 - 360;
      piece.animate(
        [
          { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
          { transform: `translate(${xEnd}px, ${yEnd}px) rotate(${rot}deg)`, opacity: 0 },
        ],
        { duration: 1100 + Math.random() * 500, easing: "cubic-bezier(.2,.6,.4,1)" }
      ).onfinish = () => piece.remove();
    }
  }

  /* ---------------- History ---------------- */
  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function pushHistory(label) {
    const hist = loadHistory();
    hist.unshift({ label, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
    const trimmed = hist.slice(0, 8);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    renderHistory(trimmed);
  }

  function renderHistory(hist) {
    hist = hist || loadHistory();
    if (!hist.length) {
      historyRow.innerHTML = '<span class="history-empty">Nothing yet — give it a spin.</span>';
      return;
    }
    historyRow.innerHTML = hist
      .map((h) => `<span class="history-stub">${h.time} · <b>${escapeHtml(h.label)}</b></span>`)
      .join("");
  }

  /* ---------------- Presets ---------------- */
  PRESETS.forEach((p) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "preset-chip";
    btn.textContent = p.label;
    btn.addEventListener("click", () => {
      choicesInput.value = p.value;
      rebuildFromInput(true);
      toast(`Loaded "${p.label.replace(/^\S+\s/, "")}"`);
    });
    presetsRow.appendChild(btn);
  });

  /* ---------------- Sound toggle ---------------- */
  soundToggle.setAttribute("aria-pressed", String(soundOn));
  soundToggle.addEventListener("click", () => {
    soundOn = !soundOn;
    soundToggle.setAttribute("aria-pressed", String(soundOn));
    localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off");
  });

  /* ---------------- Share link ---------------- */
  shareBtn.addEventListener("click", async () => {
    const url = `${location.origin}${location.pathname}?choices=${encodeURIComponent(choicesInput.value)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("Share link copied!");
    } catch (e) {
      toast("Couldn't copy — copy it from the address bar");
    }
  });

  /* ---------------- Save image ---------------- */
  saveImgBtn.addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = "spin-the-wheel.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });

  /* ---------------- Init ---------------- */
  function init() {
    const params = new URLSearchParams(location.search);
    const fromUrl = params.get("choices");
    const saved = localStorage.getItem(CHOICES_KEY);
    const initialValue = fromUrl || saved || "Pizza, Tacos, Sushi, Ramen, Burgers, Salad";
    choicesInput.value = initialValue;
    rebuildFromInput(Boolean(fromUrl));
    renderHistory();
  }

  init();
})();

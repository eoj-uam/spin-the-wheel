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

  function getAudioCtx() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
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

  // Physical mechanical "clack" — the wheel's pin flicking past a wooden peg.
  // Filtered noise, not a tone, so it sounds like an object, not a synth blip.
  function playTick(progress) {
    if (!soundOn) return;
    const actx = getAudioCtx();
    if (!actx) return;
    const t0 = actx.currentTime;

    const noise = actx.createBufferSource();
    noise.buffer = getNoiseBuffer(actx);

    const bandpass = actx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 1400 + progress * 2600;
    bandpass.Q.value = 8;

    const highpass = actx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 900;

    const gain = actx.createGain();
    gain.gain.setValueAtTime(0.9, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.035);

    noise.connect(bandpass).connect(highpass).connect(gain).connect(actx.destination);
    noise.start(t0);
    noise.stop(t0 + 0.04);

    // a soft low knock underneath, giving the click some body
    const knock = actx.createOscillator();
    const knockGain = actx.createGain();
    knock.type = "sine";
    knock.frequency.setValueAtTime(180, t0);
    knock.frequency.exponentialRampToValueAtTime(90, t0 + 0.03);
    knockGain.gain.setValueAtTime(0.12, t0);
    knockGain.gain.exponentialRampToValueAtTime(0.0006, t0 + 0.04);
    knock.connect(knockGain).connect(actx.destination);
    knock.start(t0);
    knock.stop(t0 + 0.045);
  }

  // One strike of a real bell/coin: a fundamental plus inharmonic partials (not integer
  // multiples), each ringing out at a different rate — this is what makes it sound
  // metallic rather than musical.
  function strikeBell(actx, time, freq, peakGain) {
    const partials = [
      { ratio: 1, amp: 1, decay: 0.85 },
      { ratio: 2.4, amp: 0.55, decay: 0.6 },
      { ratio: 3.9, amp: 0.32, decay: 0.42 },
      { ratio: 5.6, amp: 0.2, decay: 0.3 },
      { ratio: 7.8, amp: 0.12, decay: 0.2 },
    ];
    partials.forEach((p) => {
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq * p.ratio;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(peakGain * p.amp, time + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0004, time + p.decay);
      osc.connect(gain).connect(actx.destination);
      osc.start(time);
      osc.stop(time + p.decay + 0.05);
    });
  }

  // Jackpot payoff: a low impact thump, a real bell rung three times (classic slot-machine
  // bell), then a scatter of noise-based coin clinks settling into a tray.
  function playWinFanfare() {
    if (!soundOn) return;
    const actx = getAudioCtx();
    if (!actx) return;
    const t0 = actx.currentTime;

    // impact thump on landing
    const thump = actx.createOscillator();
    const thumpGain = actx.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(150, t0);
    thump.frequency.exponentialRampToValueAtTime(45, t0 + 0.2);
    thumpGain.gain.setValueAtTime(0.28, t0);
    thumpGain.gain.exponentialRampToValueAtTime(0.0006, t0 + 0.25);
    thump.connect(thumpGain).connect(actx.destination);
    thump.start(t0);
    thump.stop(t0 + 0.26);

    // three bell strikes, classic "ding-ding-ding" jackpot bell, each slightly brighter
    const ringTimes = [t0 + 0.08, t0 + 0.3, t0 + 0.52];
    ringTimes.forEach((t, i) => strikeBell(actx, t, 1046.5 * (1 + i * 0.015), 0.5 - i * 0.06));

    // coin clinks — short filtered noise bursts, not tones, scattering after the bell
    const coinStart = ringTimes[ringTimes.length - 1] + 0.4;
    const coinCount = 10;
    for (let i = 0; i < coinCount; i++) {
      const t2 = coinStart + i * (0.07 + Math.random() * 0.05);
      const noise = actx.createBufferSource();
      noise.buffer = getNoiseBuffer(actx);
      const bandpass = actx.createBiquadFilter();
      bandpass.type = "bandpass";
      bandpass.frequency.value = 2200 + Math.random() * 2400;
      bandpass.Q.value = 8;
      const gain = actx.createGain();
      gain.gain.setValueAtTime(0.5, t2);
      gain.gain.exponentialRampToValueAtTime(0.001, t2 + 0.09);
      noise.connect(bandpass).connect(gain).connect(actx.destination);
      noise.start(t2);
      noise.stop(t2 + 0.1);
    }
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

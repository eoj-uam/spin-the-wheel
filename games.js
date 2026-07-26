(function () {
  "use strict";

  /* ---------------- Tabs ---------------- */
  const tabs = document.querySelectorAll(".games-tab");
  const panels = {
    snake: document.getElementById("panel-snake"),
    dodge: document.getElementById("panel-dodge"),
    whack: document.getElementById("panel-whack"),
  };
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.setAttribute("aria-selected", "false"));
      tab.setAttribute("aria-selected", "true");
      Object.values(panels).forEach((p) => p.classList.remove("active"));
      panels[tab.dataset.game].classList.add("active");
    });
  });

  const WHEEL_COLORS = ["#FF5A5F", "#FFB627", "#06A77D", "#5B7FDE", "#C86BFA", "#F2A65A"];

  /* =========================================================
     GAME 1 — Ticket Grab (snake)
     ========================================================= */
  (function snakeGame() {
    const canvas = document.getElementById("snakeCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const overlay = document.getElementById("snakeOverlay");
    const startBtn = document.getElementById("snakeStart");
    const scoreEl = document.getElementById("snakeScore");
    const speedEl = document.getElementById("snakeSpeed");
    const highEl = document.getElementById("snakeHigh");
    const HIGH_KEY = "stw_hs_snake";

    const cols = 22;
    const cell = canvas.width / cols;
    let snake, dir, nextDir, food, score, interval, acc, lastTime, running;

    highEl.textContent = localStorage.getItem(HIGH_KEY) || "0";

    function reset() {
      snake = [{ x: 10, y: 11 }, { x: 9, y: 11 }, { x: 8, y: 11 }];
      dir = { x: 1, y: 0 };
      nextDir = { x: 1, y: 0 };
      score = 0;
      interval = 140;
      acc = 0;
      placeFood();
      scoreEl.textContent = "0";
      speedEl.textContent = "1×";
    }

    function placeFood() {
      let pos;
      do {
        pos = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * cols) };
      } while (snake.some((s) => s.x === pos.x && s.y === pos.y));
      food = pos;
    }

    function draw() {
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#06A77D";
      const fp = 3;
      ctx.beginPath();
      ctx.arc(food.x * cell + cell / 2, food.y * cell + cell / 2, cell / 2 - fp, 0, Math.PI * 2);
      ctx.fill();

      snake.forEach((seg, i) => {
        ctx.fillStyle = i === 0 ? "#FFB627" : "#FF5A5F";
        const pad = 2;
        const r = 4;
        roundRect(ctx, seg.x * cell + pad, seg.y * cell + pad, cell - pad * 2, cell - pad * 2, r);
        ctx.fill();
      });
    }

    function roundRect(c, x, y, w, h, r) {
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    }

    function step() {
      dir = nextDir;
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

      if (head.x < 0 || head.y < 0 || head.x >= cols || head.y >= cols || snake.some((s) => s.x === head.x && s.y === head.y)) {
        gameOver();
        return;
      }

      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score += 1;
        scoreEl.textContent = String(score);
        interval = Math.max(60, 140 - score * 3);
        speedEl.textContent = (140 / interval).toFixed(1) + "×";
        placeFood();
      } else {
        snake.pop();
      }
      draw();
    }

    function loop(now) {
      if (!running) return;
      const dt = now - lastTime;
      lastTime = now;
      acc += dt;
      if (acc >= interval) {
        acc = 0;
        step();
      }
      if (running) requestAnimationFrame(loop);
    }

    function gameOver() {
      running = false;
      const best = Number(localStorage.getItem(HIGH_KEY) || "0");
      if (score > best) localStorage.setItem(HIGH_KEY, String(score));
      highEl.textContent = localStorage.getItem(HIGH_KEY);
      overlay.classList.remove("hidden");
      overlay.innerHTML = `<h3>Game over</h3><p>Score: ${score}</p><button type="button" class="spin-btn" id="snakeStart" style="margin-top:6px;">PLAY AGAIN</button>`;
      document.getElementById("snakeStart").addEventListener("click", start);
    }

    function start() {
      reset();
      draw();
      overlay.classList.add("hidden");
      running = true;
      lastTime = performance.now();
      requestAnimationFrame(loop);
    }

    startBtn.addEventListener("click", start);

    window.addEventListener("keydown", (e) => {
      if (!running) return;
      const key = e.key.toLowerCase();
      let nd = null;
      if (key === "arrowup" || key === "w") nd = { x: 0, y: -1 };
      else if (key === "arrowdown" || key === "s") nd = { x: 0, y: 1 };
      else if (key === "arrowleft" || key === "a") nd = { x: -1, y: 0 };
      else if (key === "arrowright" || key === "d") nd = { x: 1, y: 0 };
      if (nd) {
        if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) e.preventDefault();
        if (nd.x === -dir.x && nd.y === -dir.y) return;
        nextDir = nd;
      }
    });

    // Touch: swipe on the board to steer
    let touchStartX = 0;
    let touchStartY = 0;
    canvas.addEventListener(
      "touchstart",
      (e) => {
        const t = e.touches[0];
        touchStartX = t.clientX;
        touchStartY = t.clientY;
      },
      { passive: true }
    );
    canvas.addEventListener(
      "touchend",
      (e) => {
        if (!running) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
        let nd;
        if (Math.abs(dx) > Math.abs(dy)) nd = dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
        else nd = dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
        if (nd.x === -dir.x && nd.y === -dir.y) return;
        nextDir = nd;
      },
      { passive: true }
    );

    // Touch: on-screen D-pad
    const dpad = document.getElementById("snakeDpad");
    if (dpad) {
      const dirMap = {
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 },
      };
      dpad.querySelectorAll("button").forEach((btn) => {
        const nd = dirMap[btn.dataset.dir];
        const handler = (e) => {
          e.preventDefault();
          if (!running) return;
          if (nd.x === -dir.x && nd.y === -dir.y) return;
          nextDir = nd;
        };
        btn.addEventListener("touchstart", handler, { passive: false });
        btn.addEventListener("click", handler);
      });
    }

    reset();
    draw();
  })();

  /* =========================================================
     GAME 2 — Wedge Dodge
     ========================================================= */
  (function dodgeGame() {
    const canvas = document.getElementById("dodgeCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const overlay = document.getElementById("dodgeOverlay");
    const startBtn = document.getElementById("dodgeStart");
    const scoreEl = document.getElementById("dodgeScore");
    const speedEl = document.getElementById("dodgeSpeed");
    const highEl = document.getElementById("dodgeHigh");
    const HIGH_KEY = "stw_hs_dodge";

    const W = canvas.width;
    const H = canvas.height;
    const playerW = 54;
    const playerH = 16;

    let playerX, wedges, running, startTime, lastSpawn, keys, raf;

    highEl.textContent = localStorage.getItem(HIGH_KEY) || "0";

    function reset() {
      playerX = W / 2 - playerW / 2;
      wedges = [];
      startTime = performance.now();
      lastSpawn = 0;
      keys = { left: false, right: false };
      scoreEl.textContent = "0";
      speedEl.textContent = "1×";
    }

    function spawnWedge(speedMult) {
      const w = 28 + Math.random() * 30;
      wedges.push({
        x: Math.random() * (W - w),
        y: -20,
        w,
        h: 18,
        speed: (2.2 + Math.random() * 1.2) * speedMult,
        color: WHEEL_COLORS[Math.floor(Math.random() * WHEEL_COLORS.length)],
      });
    }

    function draw(elapsedSec, speedMult) {
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
      ctx.fillRect(0, 0, W, H);

      wedges.forEach((wg) => {
        ctx.fillStyle = wg.color;
        ctx.fillRect(wg.x, wg.y, wg.w, wg.h);
      });

      ctx.fillStyle = "#1F2233";
      const py = H - 30;
      ctx.beginPath();
      const r = 6;
      const x = playerX, y = py, w = playerW, h = playerH;
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      ctx.fill();
    }

    function loop(now) {
      if (!running) return;
      const elapsed = (now - startTime) / 1000;
      const speedMult = 1 + elapsed * 0.09;
      const spawnEvery = Math.max(280, 900 - elapsed * 40);

      if (now - lastSpawn > spawnEvery) {
        lastSpawn = now;
        spawnWedge(speedMult);
      }

      if (keys.left) playerX -= 6.2;
      if (keys.right) playerX += 6.2;
      playerX = Math.max(0, Math.min(W - playerW, playerX));

      const py = H - 30;
      for (let i = wedges.length - 1; i >= 0; i--) {
        const wg = wedges[i];
        wg.y += wg.speed;
        if (wg.y > H) {
          wedges.splice(i, 1);
          continue;
        }
        const hit =
          wg.y + wg.h > py &&
          wg.y < py + playerH &&
          wg.x + wg.w > playerX &&
          wg.x < playerX + playerW;
        if (hit) {
          gameOver(elapsed);
          return;
        }
      }

      draw(elapsed, speedMult);
      scoreEl.textContent = String(Math.floor(elapsed));
      speedEl.textContent = speedMult.toFixed(1) + "×";

      raf = requestAnimationFrame(loop);
    }

    function gameOver(elapsed) {
      running = false;
      const score = Math.floor(elapsed);
      const best = Number(localStorage.getItem(HIGH_KEY) || "0");
      if (score > best) localStorage.setItem(HIGH_KEY, String(score));
      highEl.textContent = localStorage.getItem(HIGH_KEY);
      overlay.classList.remove("hidden");
      overlay.innerHTML = `<h3>Game over</h3><p>Survived: ${score}s</p><button type="button" class="spin-btn" id="dodgeStart" style="margin-top:6px;">PLAY AGAIN</button>`;
      document.getElementById("dodgeStart").addEventListener("click", start);
    }

    function start() {
      reset();
      draw(0, 1);
      overlay.classList.add("hidden");
      running = true;
      lastSpawn = performance.now() - 600;
      startTime = performance.now();
      raf = requestAnimationFrame(loop);
    }

    startBtn.addEventListener("click", start);

    window.addEventListener("keydown", (e) => {
      const key = e.key.toLowerCase();
      if (["arrowleft", "arrowright"].includes(key)) e.preventDefault();
      if (key === "arrowleft" || key === "a") keys.left = true;
      if (key === "arrowright" || key === "d") keys.right = true;
    });
    window.addEventListener("keyup", (e) => {
      const key = e.key.toLowerCase();
      if (key === "arrowleft" || key === "a") keys.left = false;
      if (key === "arrowright" || key === "d") keys.right = false;
    });

    // Touch: drag directly on the board to move the cart
    function moveToTouch(clientX) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width;
      const x = (clientX - rect.left) * scaleX;
      playerX = Math.max(0, Math.min(W - playerW, x - playerW / 2));
    }
    canvas.addEventListener(
      "touchstart",
      (e) => {
        moveToTouch(e.touches[0].clientX);
      },
      { passive: true }
    );
    canvas.addEventListener(
      "touchmove",
      (e) => {
        e.preventDefault();
        moveToTouch(e.touches[0].clientX);
      },
      { passive: false }
    );

    // Touch: on-screen left/right buttons
    const lr = document.getElementById("dodgeLR");
    if (lr) {
      lr.querySelectorAll("button").forEach((btn) => {
        const side = btn.dataset.dir;
        const setState = (val) => (e) => {
          e.preventDefault();
          keys[side] = val;
        };
        btn.addEventListener("touchstart", setState(true), { passive: false });
        btn.addEventListener("touchend", setState(false), { passive: false });
        btn.addEventListener("touchcancel", setState(false), { passive: false });
        btn.addEventListener("mousedown", setState(true));
        btn.addEventListener("mouseup", setState(false));
        btn.addEventListener("mouseleave", setState(false));
      });
    }

    reset();
    draw(0, 1);
  })();

  /* =========================================================
     GAME 3 — Whack the Prize
     ========================================================= */
  (function whackGame() {
    const canvas = document.getElementById("whackCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const overlay = document.getElementById("whackOverlay");
    const startBtn = document.getElementById("whackStart");
    const scoreEl = document.getElementById("whackScore");
    const timeEl = document.getElementById("whackTime");
    const highEl = document.getElementById("whackHigh");
    const HIGH_KEY = "stw_hs_whack";

    const W = canvas.width;
    const H = canvas.height;
    let score, timeLeft, target, running, spawnTimer, countdownTimer, life;

    highEl.textContent = localStorage.getItem(HIGH_KEY) || "0";

    function reset() {
      score = 0;
      timeLeft = 30;
      scoreEl.textContent = "0";
      timeEl.textContent = "30";
      target = null;
    }

    function draw() {
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
      ctx.fillRect(0, 0, W, H);
      if (target) {
        ctx.fillStyle = "#FFB627";
        ctx.beginPath();
        ctx.arc(target.x, target.y, target.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#7A1E22";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = "#7A1E22";
        ctx.font = "bold 18px 'Space Grotesk', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("★", target.x, target.y + 1);
      }
    }

    function spawnTarget() {
      const r = Math.max(20, 40 - score * 0.8);
      target = {
        x: r + Math.random() * (W - r * 2),
        y: r + Math.random() * (H - r * 2),
        r,
      };
      draw();
      clearTimeout(life);
      const lifespan = Math.max(500, 1000 - score * 15);
      life = setTimeout(() => {
        target = null;
        draw();
        if (running) scheduleSpawn();
      }, lifespan);
    }

    function scheduleSpawn() {
      clearTimeout(spawnTimer);
      const delay = 200 + Math.random() * 400;
      spawnTimer = setTimeout(spawnTarget, delay);
    }

    function tryHit(clientX, clientY) {
      if (!running || !target) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      const x = (clientX - rect.left) * scaleX;
      const y = (clientY - rect.top) * scaleY;
      const dist = Math.hypot(x - target.x, y - target.y);
      if (dist <= target.r) {
        score += 1;
        scoreEl.textContent = String(score);
        clearTimeout(life);
        target = null;
        draw();
        scheduleSpawn();
      }
    }

    canvas.addEventListener("click", (e) => tryHit(e.clientX, e.clientY));
    canvas.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        tryHit(t.clientX, t.clientY);
      },
      { passive: false }
    );

    function tick() {
      timeLeft -= 1;
      timeEl.textContent = String(Math.max(0, timeLeft));
      if (timeLeft <= 0) {
        endGame();
      }
    }

    function endGame() {
      running = false;
      clearTimeout(spawnTimer);
      clearTimeout(life);
      clearInterval(countdownTimer);
      target = null;
      draw();
      const best = Number(localStorage.getItem(HIGH_KEY) || "0");
      if (score > best) localStorage.setItem(HIGH_KEY, String(score));
      highEl.textContent = localStorage.getItem(HIGH_KEY);
      overlay.classList.remove("hidden");
      overlay.innerHTML = `<h3>Time's up</h3><p>Score: ${score}</p><button type="button" class="spin-btn" id="whackStart" style="margin-top:6px;">PLAY AGAIN</button>`;
      document.getElementById("whackStart").addEventListener("click", start);
    }

    function start() {
      reset();
      draw();
      overlay.classList.add("hidden");
      running = true;
      scheduleSpawn();
      countdownTimer = setInterval(tick, 1000);
    }

    startBtn.addEventListener("click", start);

    reset();
    draw();
  })();
})();

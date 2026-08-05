(function () {
  "use strict";

  /* ---------------- Tabs ---------------- */
  const tabs = document.querySelectorAll(".games-tab");
  const panels = {
    snake: document.getElementById("panel-snake"),
    dodge: document.getElementById("panel-dodge"),
    whack: document.getElementById("panel-whack"),
    pacman: document.getElementById("panel-pacman"),
    flyer: document.getElementById("panel-flyer"),
  };
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".game-stage.immersive").forEach((stage) => {
        stage.classList.remove("immersive");
        const wrap = stage.querySelector(".game-canvas-wrap");
        if (wrap) {
          wrap.style.width = "";
          wrap.style.height = "";
        }
        const btn = stage.querySelector(".fullscreen-btn");
        if (btn) {
          btn.textContent = "⛶";
          btn.setAttribute("aria-label", "Fullscreen");
        }
        if (stage._immersiveRefit) {
          window.removeEventListener("resize", stage._immersiveRefit);
          window.removeEventListener("orientationchange", stage._immersiveRefit);
          stage._immersiveRefit = null;
        }
      });
      document.body.classList.remove("game-immersive-active");
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});

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
    const levelEl = document.getElementById("snakeLevel");
    const speedEl = document.getElementById("snakeSpeed");
    const highEl = document.getElementById("snakeHigh");
    const HIGH_KEY = "stw_hs_snake";

    const cols = 22;
    const cell = canvas.width / cols;
    const BASE_INTERVAL = 210; // slower start
    const MIN_INTERVAL = 75;
    const LEVEL_STEP = 15;
    const PELLETS_PER_LEVEL = 5;
    let snake, dir, nextDir, food, score, level, interval, acc, lastTime, running;

    highEl.textContent = localStorage.getItem(HIGH_KEY) || "0";

    function applyLevel() {
      level = 1 + Math.floor(score / PELLETS_PER_LEVEL);
      interval = Math.max(MIN_INTERVAL, BASE_INTERVAL - (level - 1) * LEVEL_STEP);
      levelEl.textContent = String(level);
      speedEl.textContent = (BASE_INTERVAL / interval).toFixed(1) + "×";
    }

    function reset() {
      snake = [{ x: 10, y: 11 }, { x: 9, y: 11 }, { x: 8, y: 11 }];
      dir = { x: 1, y: 0 };
      nextDir = { x: 1, y: 0 };
      score = 0;
      acc = 0;
      applyLevel();
      placeFood();
      scoreEl.textContent = "0";
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
        applyLevel();
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

    // Touch: swipe anywhere in the game area (not just on the snake itself) so a
    // player's thumb never has to cover the board to steer. Taps on buttons are
    // ignored here so the D-pad, fullscreen toggle, and start button still work.
    const stage = canvas.closest(".game-stage");
    let touchStartX = 0;
    let touchStartY = 0;
    let swipeTouchActive = false;
    (stage || canvas).addEventListener(
      "touchstart",
      (e) => {
        if (e.target.closest("button")) return;
        swipeTouchActive = true;
        const t = e.touches[0];
        touchStartX = t.clientX;
        touchStartY = t.clientY;
        e.preventDefault();
      },
      { passive: false }
    );
    (stage || canvas).addEventListener(
      "touchend",
      (e) => {
        if (!swipeTouchActive) return;
        swipeTouchActive = false;
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
      { passive: false }
    );

    // Touch: on-screen D-pad — the primary, unobstructed way to steer
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
          e.stopPropagation();
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
    const levelEl = document.getElementById("dodgeLevel");
    const speedEl = document.getElementById("dodgeSpeed");
    const highEl = document.getElementById("dodgeHigh");
    const HIGH_KEY = "stw_hs_dodge";

    const W = canvas.width;
    const H = canvas.height;
    const playerW = 54;
    const playerH = 16;
    const SECONDS_PER_LEVEL = 8;
    const SPAWN_BASE = 1050; // slower start
    const SPAWN_MIN = 320;
    const SPAWN_STEP = 75;

    let playerX, wedges, running, startTime, lastSpawn, keys, raf, level;

    highEl.textContent = localStorage.getItem(HIGH_KEY) || "0";

    function reset() {
      playerX = W / 2 - playerW / 2;
      wedges = [];
      startTime = performance.now();
      lastSpawn = 0;
      keys = { left: false, right: false };
      level = 1;
      scoreEl.textContent = "0";
      levelEl.textContent = "1";
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
      level = 1 + Math.floor(elapsed / SECONDS_PER_LEVEL);
      const speedMult = 1 + (level - 1) * 0.28;
      const spawnEvery = Math.max(SPAWN_MIN, SPAWN_BASE - (level - 1) * SPAWN_STEP);
      levelEl.textContent = String(level);

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

    // Touch: drag anywhere in the game area to move the cart — mapped against the
    // canvas's horizontal bounds, but the touch itself doesn't need to be on the
    // canvas, so a thumb can stay clear of the falling wedges while still steering.
    const stage = canvas.closest(".game-stage");
    function moveToTouch(clientX) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width;
      const x = (clientX - rect.left) * scaleX;
      playerX = Math.max(0, Math.min(W - playerW, x - playerW / 2));
    }
    (stage || canvas).addEventListener(
      "touchstart",
      (e) => {
        if (e.target.closest("button")) return;
        moveToTouch(e.touches[0].clientX);
        e.preventDefault();
      },
      { passive: false }
    );
    (stage || canvas).addEventListener(
      "touchmove",
      (e) => {
        if (e.target.closest("button")) return;
        moveToTouch(e.touches[0].clientX);
        e.preventDefault();
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
          e.stopPropagation();
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
    const levelEl = document.getElementById("whackLevel");
    const timeEl = document.getElementById("whackTime");
    const highEl = document.getElementById("whackHigh");
    const HIGH_KEY = "stw_hs_whack";

    const W = canvas.width;
    const H = canvas.height;
    const POINTS_PER_LEVEL = 4;
    const RADIUS_BASE = 46; // slower start — bigger, easier target
    const RADIUS_MIN = 20;
    const RADIUS_STEP = 2.5;
    const LIFESPAN_BASE = 1150;
    const LIFESPAN_MIN = 520;
    const LIFESPAN_STEP = 55;
    const SPAWN_DELAY_BASE = 260;
    const SPAWN_DELAY_STEP = 12;

    let score, level, timeLeft, target, running, spawnTimer, countdownTimer, life;

    highEl.textContent = localStorage.getItem(HIGH_KEY) || "0";

    function reset() {
      score = 0;
      level = 1;
      timeLeft = 30;
      scoreEl.textContent = "0";
      levelEl.textContent = "1";
      timeEl.textContent = "30";
      target = null;
    }

    function applyLevel() {
      level = 1 + Math.floor(score / POINTS_PER_LEVEL);
      levelEl.textContent = String(level);
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
      const r = Math.max(RADIUS_MIN, RADIUS_BASE - (level - 1) * RADIUS_STEP);
      target = {
        x: r + Math.random() * (W - r * 2),
        y: r + Math.random() * (H - r * 2),
        r,
      };
      draw();
      clearTimeout(life);
      const lifespan = Math.max(LIFESPAN_MIN, LIFESPAN_BASE - (level - 1) * LIFESPAN_STEP);
      life = setTimeout(() => {
        target = null;
        draw();
        if (running) scheduleSpawn();
      }, lifespan);
    }

    function scheduleSpawn() {
      clearTimeout(spawnTimer);
      const delayMin = Math.max(120, SPAWN_DELAY_BASE - (level - 1) * SPAWN_DELAY_STEP);
      const delay = delayMin + Math.random() * 350;
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
        applyLevel();
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

  /* =========================================================
     GAME 4 — Ticket Muncher (Pac-Man style maze chase)
     ========================================================= */
  (function pacmanGame() {
    const canvas = document.getElementById("pacmanCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const overlay = document.getElementById("pacmanOverlay");
    const startBtn = document.getElementById("pacmanStart");
    const scoreEl = document.getElementById("pacmanScore");
    const levelEl = document.getElementById("pacmanLevel");
    const livesEl = document.getElementById("pacmanLives");
    const highEl = document.getElementById("pacmanHigh");
    const HIGH_KEY = "stw_hs_pacman";

    // Classic-style maze: symmetric T/L block walls (not isolated pillars), a center
    // ghost house with a gate, side tunnels, and four corner power pellets — modeled on
    // the original arcade layout. Validated offline: 266 walkable cells, all reachable
    // (tunnel wraparound included), only 2 dead-end cells and those are the intentional
    // power-pellet corner nooks, same as the original.
    const MAZE_TEMPLATE = [
      "###################",
      "#O...............O#",
      "#.###.........###.#",
      "#.###.........###.#",
      "#........#........#",
      "##..##.......##..##",
      "##..##.......##..##",
      "#.......#.#.......#",
      "#..###.......###..#",
      "#...#.........#...#",
      " .......# #....... ",
      "#.......# #.......#",
      "#.......###.......#",
      "#........#........#",
      "#..###.......###..#",
      "#...#.........#...#",
      "#.......#.#.......#",
      "##..##.......##..##",
      "##..##.......##..##",
      "#O...............O#",
      "###################",
    ];
    const rows = MAZE_TEMPLATE.length;
    const cols = MAZE_TEMPLATE[0].length;
    const cell = canvas.width / cols;
    const HOUSE_ROW = 11;
    const HOUSE_COL = 9;
    const TUNNEL_ROW = 10;

    const DIRS = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };
    const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };

    let maze, player, ghosts, score, level, lives, pelletsLeft;
    let playerAcc, ghostAcc, playerInterval, ghostInterval, lastTime, running, queuedDir;

    const PLAYER_INTERVAL = 150; // constant — player speed stays predictable
    const GHOST_BASE_INTERVAL = 440; // level 1: ghosts move much slower than the player
    const GHOST_MIN_INTERVAL = 130;
    const GHOST_STEP = 14;
    const PELLETS_PER_LEVEL = 30;
    const FRIGHT_BASE_MS = 6000; // level 1: plenty of time to hunt
    const FRIGHT_MIN_MS = 2500;
    const FRIGHT_STEP_MS = 250;
    const FRIGHT_BLINK_MS = 1500; // warn near the end by blinking
    const GHOST_BONUS = [20, 40, 80, 160]; // escalates per ghost eaten in one power window

    let frightenedUntil = 0;
    let ghostsEatenCount = 0;

    highEl.textContent = localStorage.getItem(HIGH_KEY) || "0";

    function isFrightened() {
      return performance.now() < frightenedUntil;
    }

    function buildMaze() {
      return MAZE_TEMPLATE.map((row) => row.split(""));
    }

    function wrapTunnel(r, c) {
      if (r === TUNNEL_ROW) {
        if (c < 0) return { r, c: cols - 1 };
        if (c >= cols) return { r, c: 0 };
      }
      return { r, c };
    }

    function cellAt(r, c) {
      const w = wrapTunnel(r, c);
      if (w.r < 0 || w.r >= rows || w.c < 0 || w.c >= cols) return "#";
      return maze[w.r][w.c];
    }

    function canMove(r, c, dirName) {
      const d = DIRS[dirName];
      return cellAt(r + d.y, c + d.x) !== "#";
    }

    function applyLevel() {
      level = 1 + Math.floor(score / PELLETS_PER_LEVEL);
      ghostInterval = Math.max(GHOST_MIN_INTERVAL, GHOST_BASE_INTERVAL - (level - 1) * GHOST_STEP);
      levelEl.textContent = String(level);
    }

    function reset() {
      maze = buildMaze();
      pelletsLeft = 0;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) if (maze[r][c] === "." || maze[r][c] === "O") pelletsLeft++;
      player = { row: rows - 2, col: HOUSE_COL, dir: "left" };
      queuedDir = "left";
      ghosts = [
        { row: HOUSE_ROW, col: HOUSE_COL, dir: "up", color: "#FF0000" },
        { row: HOUSE_ROW, col: HOUSE_COL, dir: "up", color: "#FFB8FF" },
      ];
      score = 0;
      lives = 3;
      playerInterval = PLAYER_INTERVAL;
      playerAcc = 0;
      ghostAcc = 0;
      frightenedUntil = 0;
      ghostsEatenCount = 0;
      applyLevel();
      scoreEl.textContent = "0";
      livesEl.textContent = "3";
    }

    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function draw() {
      // Fixed classic arcade palette — deliberately ignores the site's paper/midnight/neon
      // theme so this always reads as a Pac-Man-style board.
      const ARCADE_BG = "#0A0A18";
      const WALL_BLUE = "#2626FF";
      const WALL_GLOW = "#5B5BFF";
      const PELLET = "#FCE8C6";

      ctx.fillStyle = ARCADE_BG;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const isWall = (r, c) => cellAt(r, c) === "#";
      const R = Math.max(3, cell * 0.22);

      ctx.save();
      ctx.shadowColor = WALL_GLOW;
      ctx.shadowBlur = 3;
      ctx.fillStyle = WALL_BLUE;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!isWall(r, c)) continue;
          const x = c * cell;
          const y = r * cell;
          const nUp = isWall(r - 1, c);
          const nDown = isWall(r + 1, c);
          const nLeft = isWall(r, c - 1);
          const nRight = isWall(r, c + 1);
          const rTL = !nUp && !nLeft ? R : 0;
          const rTR = !nUp && !nRight ? R : 0;
          const rBR = !nDown && !nRight ? R : 0;
          const rBL = !nDown && !nLeft ? R : 0;
          ctx.beginPath();
          ctx.moveTo(x + rTL, y);
          ctx.lineTo(x + cell - rTR, y);
          if (rTR) ctx.arcTo(x + cell, y, x + cell, y + rTR, rTR);
          ctx.lineTo(x + cell, y + cell - rBR);
          if (rBR) ctx.arcTo(x + cell, y + cell, x + cell - rBR, y + cell, rBR);
          ctx.lineTo(x + rBL, y + cell);
          if (rBL) ctx.arcTo(x, y + cell, x, y + cell - rBL, rBL);
          ctx.lineTo(x, y + rTL);
          if (rTL) ctx.arcTo(x, y, x + rTL, y, rTL);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const ch = maze[r][c];
          const x = c * cell;
          const y = r * cell;
          if (ch === ".") {
            ctx.fillStyle = PELLET;
            ctx.beginPath();
            ctx.arc(x + cell / 2, y + cell / 2, cell * 0.09, 0, Math.PI * 2);
            ctx.fill();
          } else if (ch === "O") {
            const pulse = 0.85 + 0.15 * Math.sin(performance.now() / 180);
            ctx.fillStyle = PELLET;
            ctx.beginPath();
            ctx.arc(x + cell / 2, y + cell / 2, cell * 0.24 * pulse, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // player — classic yellow pac-style circle with a mouth wedge cut toward its direction
      const px = player.col * cell + cell / 2;
      const py = player.row * cell + cell / 2;
      const mouthAngle = { right: 0, down: 90, left: 180, up: 270 }[player.dir] || 0;
      const openness = 0.24 + 0.1 * Math.sin(performance.now() / 90);
      ctx.fillStyle = "#FFE600";
      ctx.beginPath();
      ctx.arc(
        px,
        py,
        cell * 0.42,
        ((mouthAngle + openness * 180) * Math.PI) / 180,
        ((mouthAngle - openness * 180 + 360) * Math.PI) / 180
      );
      ctx.lineTo(px, py);
      ctx.closePath();
      ctx.fill();

      // ghosts — classic dome + wavy-skirt silhouette, with eyes glancing toward travel direction
      const frightRemaining = frightenedUntil - performance.now();
      const frightActive = frightRemaining > 0;
      const frightBlinkOn = frightActive && frightRemaining < FRIGHT_BLINK_MS && Math.floor(performance.now() / 160) % 2 === 0;

      ghosts.forEach((g) => {
        const gx = g.col * cell + cell / 2;
        const gy = g.row * cell + cell / 2;
        const scared = frightActive;
        ctx.fillStyle = scared ? (frightBlinkOn ? "#FCE8C6" : "#1B3BDE") : g.color;
        ctx.beginPath();
        ctx.arc(gx, gy, cell * 0.4, Math.PI, 0);
        ctx.lineTo(gx + cell * 0.4, gy + cell * 0.36);
        for (let i = 0; i < 3; i++) {
          const wx = gx + cell * 0.4 - (i + 0.5) * ((cell * 0.8) / 3);
          ctx.lineTo(wx, gy + (i % 2 === 0 ? cell * 0.2 : cell * 0.36));
        }
        ctx.lineTo(gx - cell * 0.4, gy + cell * 0.36);
        ctx.closePath();
        ctx.fill();

        if (scared) {
          // scared face: small worried eyes, no pupils, plus a wavy frightened mouth
          ctx.strokeStyle = frightBlinkOn ? "#1B3BDE" : "#FCE8C6";
          ctx.lineWidth = Math.max(1.5, cell * 0.05);
          ctx.beginPath();
          ctx.arc(gx - cell * 0.14, gy - cell * 0.04, cell * 0.06, 0, Math.PI * 2);
          ctx.arc(gx + cell * 0.14, gy - cell * 0.04, cell * 0.06, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(gx - cell * 0.2, gy + cell * 0.14);
          for (let i = 0; i < 4; i++) {
            ctx.lineTo(gx - cell * 0.2 + (i + 0.5) * (cell * 0.4 / 4), gy + (i % 2 === 0 ? cell * 0.2 : cell * 0.1));
          }
          ctx.stroke();
        } else {
          const eyeShift = { right: [2, 0], left: [-2, 0], up: [0, -2], down: [0, 2] }[g.dir] || [0, 0];
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(gx - cell * 0.13, gy - cell * 0.05, cell * 0.1, 0, Math.PI * 2);
          ctx.arc(gx + cell * 0.13, gy - cell * 0.05, cell * 0.1, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#233";
          ctx.beginPath();
          ctx.arc(gx - cell * 0.13 + eyeShift[0], gy - cell * 0.05 + eyeShift[1], cell * 0.05, 0, Math.PI * 2);
          ctx.arc(gx + cell * 0.13 + eyeShift[0], gy - cell * 0.05 + eyeShift[1], cell * 0.05, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    function manhattan(r1, c1, r2, c2) {
      return Math.abs(r1 - r2) + Math.abs(c1 - c2);
    }

    function moveGhost(g) {
      const options = Object.keys(DIRS).filter((d) => canMove(g.row, g.col, d));
      let candidates = options.filter((d) => d !== OPPOSITE[g.dir]);
      if (candidates.length === 0) candidates = options;

      const frightened = isFrightened();
      let choice;
      if (frightened) {
        // flee: prefer the direction that maximizes distance from the player
        if (Math.random() < 0.75) {
          choice = candidates.reduce((best, d) => {
            const dd = DIRS[d];
            const dist = manhattan(g.row + dd.y, g.col + dd.x, player.row, player.col);
            if (!best || dist > best.dist) return { d, dist };
            return best;
          }, null).d;
        } else {
          choice = candidates[Math.floor(Math.random() * candidates.length)];
        }
      } else {
        const chaseChance = Math.min(0.85, 0.3 + (level - 1) * 0.04);
        if (Math.random() < chaseChance) {
          choice = candidates.reduce((best, d) => {
            const dd = DIRS[d];
            const dist = manhattan(g.row + dd.y, g.col + dd.x, player.row, player.col);
            if (!best || dist < best.dist) return { d, dist };
            return best;
          }, null).d;
        } else {
          choice = candidates[Math.floor(Math.random() * candidates.length)];
        }
      }
      const d = DIRS[choice];
      g.row += d.y;
      g.col += d.x;
      const w = wrapTunnel(g.row, g.col);
      g.row = w.r;
      g.col = w.c;
      g.dir = choice;
    }

    function eatGhost(g) {
      const bonus = GHOST_BONUS[Math.min(ghostsEatenCount, GHOST_BONUS.length - 1)];
      ghostsEatenCount += 1;
      score += bonus;
      scoreEl.textContent = String(score);
      g.row = HOUSE_ROW;
      g.col = HOUSE_COL;
      g.dir = "up";
    }

    function handleCollisions() {
      for (const g of ghosts) {
        if (g.row === player.row && g.col === player.col) {
          if (isFrightened()) {
            eatGhost(g);
          } else {
            loseLife();
            return;
          }
        }
      }
    }

    function loseLife() {
      lives -= 1;
      livesEl.textContent = String(Math.max(0, lives));
      if (lives <= 0) {
        endGame(false);
        return;
      }
      player.row = rows - 2;
      player.col = HOUSE_COL;
      player.dir = "left";
      queuedDir = "left";
      ghosts.forEach((g) => {
        g.row = HOUSE_ROW;
        g.col = HOUSE_COL;
        g.dir = "up";
      });
    }

    function stepPlayer() {
      if (canMove(player.row, player.col, queuedDir)) player.dir = queuedDir;
      if (canMove(player.row, player.col, player.dir)) {
        const d = DIRS[player.dir];
        player.row += d.y;
        player.col += d.x;
        const w = wrapTunnel(player.row, player.col);
        player.row = w.r;
        player.col = w.c;
      }
      const here = maze[player.row][player.col];
      if (here === "." || here === "O") {
        maze[player.row][player.col] = " ";
        score += here === "O" ? 5 : 1;
        pelletsLeft -= 1;
        scoreEl.textContent = String(score);
        applyLevel();
        if (here === "O") {
          const duration = Math.max(FRIGHT_MIN_MS, FRIGHT_BASE_MS - (level - 1) * FRIGHT_STEP_MS);
          frightenedUntil = performance.now() + duration;
          ghostsEatenCount = 0;
          ghosts.forEach((g) => {
            g.dir = OPPOSITE[g.dir] || g.dir;
          });
        }
        if (pelletsLeft <= 0) {
          endGame(true);
          return true;
        }
      }
      handleCollisions();
      return false;
    }

    function stepGhosts() {
      ghosts.forEach(moveGhost);
      handleCollisions();
    }

    function loop(now) {
      if (!running) return;
      const dt = now - lastTime;
      lastTime = now;
      playerAcc += dt;
      ghostAcc += dt;

      const effectiveGhostInterval = isFrightened() ? ghostInterval * 1.6 : ghostInterval;

      let ended = false;
      if (playerAcc >= playerInterval) {
        playerAcc = 0;
        ended = stepPlayer();
      }
      if (!ended && ghostAcc >= effectiveGhostInterval) {
        ghostAcc = 0;
        stepGhosts();
      }
      if (running) {
        draw();
        requestAnimationFrame(loop);
      }
    }

    function endGame(won) {
      running = false;
      const best = Number(localStorage.getItem(HIGH_KEY) || "0");
      if (score > best) localStorage.setItem(HIGH_KEY, String(score));
      highEl.textContent = localStorage.getItem(HIGH_KEY);
      draw();
      overlay.classList.remove("hidden");
      overlay.innerHTML = won
        ? `<h3>Maze cleared!</h3><p>Score: ${score}</p><button type="button" class="spin-btn" id="pacmanStart" style="margin-top:6px;">PLAY AGAIN</button>`
        : `<h3>Caught!</h3><p>Score: ${score}</p><button type="button" class="spin-btn" id="pacmanStart" style="margin-top:6px;">PLAY AGAIN</button>`;
      document.getElementById("pacmanStart").addEventListener("click", start);
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
      if (key === "arrowup" || key === "w") nd = "up";
      else if (key === "arrowdown" || key === "s") nd = "down";
      else if (key === "arrowleft" || key === "a") nd = "left";
      else if (key === "arrowright" || key === "d") nd = "right";
      if (nd) {
        if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) e.preventDefault();
        queuedDir = nd;
      }
    });

    // Touch: swipe anywhere in the game area (not just on the maze itself) so a
    // player's thumb never has to cover the board to steer. Taps on buttons are
    // ignored here so the D-pad, fullscreen toggle, and start button still work.
    const stage = canvas.closest(".game-stage");
    let touchStartX = 0;
    let touchStartY = 0;
    let swipeTouchActive = false;
    (stage || canvas).addEventListener(
      "touchstart",
      (e) => {
        if (e.target.closest("button")) return;
        swipeTouchActive = true;
        const t = e.touches[0];
        touchStartX = t.clientX;
        touchStartY = t.clientY;
        e.preventDefault();
      },
      { passive: false }
    );
    (stage || canvas).addEventListener(
      "touchend",
      (e) => {
        if (!swipeTouchActive) return;
        swipeTouchActive = false;
        if (!running) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
        queuedDir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
      },
      { passive: false }
    );

    // Touch: on-screen D-pad — the primary, unobstructed way to steer
    const dpad = document.getElementById("pacmanDpad");
    if (dpad) {
      dpad.querySelectorAll("button").forEach((btn) => {
        const nd = btn.dataset.dir;
        const handler = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!running) return;
          queuedDir = nd;
        };
        btn.addEventListener("touchstart", handler, { passive: false });
        btn.addEventListener("click", handler);
      });
    }

    reset();
    draw();
  })();

  /* =========================================================
     GAME 5 — Balloon Rise (tap-to-rise, endless)
     ========================================================= */
  (function flyerGame() {
    const canvas = document.getElementById("flyerCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const overlay = document.getElementById("flyerOverlay");
    const startBtn = document.getElementById("flyerStart");
    const scoreEl = document.getElementById("flyerScore");
    const levelEl = document.getElementById("flyerLevel");
    const speedEl = document.getElementById("flyerSpeed");
    const highEl = document.getElementById("flyerHigh");
    const HIGH_KEY = "stw_hs_flyer";

    const W = canvas.width;
    const H = canvas.height;
    const gapHeight = 150;
    const poleWidth = 46;
    const balloonR = 15;
    const PASSES_PER_LEVEL = 4;
    const LEVEL_SPEED_STEP = 0.22;
    const MAX_SPEED_MULT = 2.2;

    let balloonY, velocity, poles, score, level, running, startTime, raf;

    highEl.textContent = localStorage.getItem(HIGH_KEY) || "0";

    function reset() {
      balloonY = H / 2;
      velocity = 0;
      poles = [{ x: W + 60, gapY: 120 + Math.random() * (H - 240), passed: false }];
      score = 0;
      level = 1;
      startTime = performance.now();
      scoreEl.textContent = "0";
      levelEl.textContent = "1";
      speedEl.textContent = "1×";
    }

    function flap() {
      if (!running) return;
      velocity = -6.4;
    }

    function draw(speedMult) {
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
      ctx.fillRect(0, 0, W, H);

      poles.forEach((p) => {
        ctx.fillStyle = "#FF5A5F";
        ctx.fillRect(p.x, 0, poleWidth, p.gapY - gapHeight / 2);
        ctx.fillRect(p.x, p.gapY + gapHeight / 2, poleWidth, H - (p.gapY + gapHeight / 2));
        ctx.fillStyle = "#FFB627";
        for (let s = 0; s < (p.gapY - gapHeight / 2); s += 24) {
          ctx.fillRect(p.x, s, poleWidth, 10);
        }
        for (let s = p.gapY + gapHeight / 2; s < H; s += 24) {
          ctx.fillRect(p.x, s, poleWidth, 10);
        }
      });

      // balloon
      const bx = 70;
      ctx.fillStyle = "#06A77D";
      ctx.beginPath();
      ctx.ellipse(bx, balloonY, balloonR, balloonR * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#1F2233";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx, balloonY + balloonR * 1.2);
      ctx.lineTo(bx, balloonY + balloonR * 1.2 + 12);
      ctx.stroke();
      ctx.fillStyle = "#1F2233";
      ctx.fillRect(bx - 5, balloonY + balloonR * 1.2 + 12, 10, 8);
    }

    function loop(now) {
      if (!running) return;
      const speedMult = Math.min(MAX_SPEED_MULT, 1 + (level - 1) * LEVEL_SPEED_STEP);

      velocity += 0.34;
      balloonY += velocity;

      if (poles.length === 0 || poles[poles.length - 1].x < W - 190) {
        poles.push({ x: W + 20, gapY: 110 + Math.random() * (H - 220), passed: false });
      }

      for (let i = poles.length - 1; i >= 0; i--) {
        const p = poles[i];
        p.x -= 2.6 * speedMult;
        if (!p.passed && p.x + poleWidth < 70) {
          p.passed = true;
          score += 1;
          scoreEl.textContent = String(score);
          level = 1 + Math.floor(score / PASSES_PER_LEVEL);
          levelEl.textContent = String(level);
        }
        if (p.x < -poleWidth) poles.splice(i, 1);
      }

      const bx = 70;
      const hitTop = balloonY - balloonR < 0;
      const hitBottom = balloonY + balloonR > H;
      const hitPole = poles.some((p) => {
        const withinX = bx + balloonR > p.x && bx - balloonR < p.x + poleWidth;
        if (!withinX) return false;
        const withinGap = balloonY - balloonR > p.gapY - gapHeight / 2 && balloonY + balloonR < p.gapY + gapHeight / 2;
        return !withinGap;
      });

      if (hitTop || hitBottom || hitPole) {
        gameOver();
        return;
      }

      draw(speedMult);
      speedEl.textContent = speedMult.toFixed(1) + "×";
      raf = requestAnimationFrame(loop);
    }

    function gameOver() {
      running = false;
      const best = Number(localStorage.getItem(HIGH_KEY) || "0");
      if (score > best) localStorage.setItem(HIGH_KEY, String(score));
      highEl.textContent = localStorage.getItem(HIGH_KEY);
      overlay.classList.remove("hidden");
      overlay.innerHTML = `<h3>Popped!</h3><p>Score: ${score}</p><button type="button" class="spin-btn" id="flyerStart" style="margin-top:6px;">PLAY AGAIN</button>`;
      document.getElementById("flyerStart").addEventListener("click", start);
    }

    function start() {
      reset();
      draw(1);
      overlay.classList.add("hidden");
      running = true;
      startTime = performance.now();
      raf = requestAnimationFrame(loop);
    }

    startBtn.addEventListener("click", start);

    canvas.addEventListener("click", flap);
    canvas.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        flap();
      },
      { passive: false }
    );
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" && running) {
        e.preventDefault();
        flap();
      }
    });

    reset();
    draw(1);
  })();

  /* =========================================================
     Immersive fullscreen mode — shared across all games.
     On touch devices, starting a game automatically expands it to
     cover the viewport (nav/hero hidden, canvas and controls scaled
     up) so it feels like a mobile game rather than a shrunk desktop
     widget. A manual toggle button works the same way on any device.
     ========================================================= */
  (function immersiveMode() {
    const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

    function fitCanvas(stage, aspect) {
      const wrap = stage.querySelector(".game-canvas-wrap");
      if (!wrap) return;
      const hud = stage.querySelector(".game-hud");
      const controls = stage.querySelector(".touch-dpad, .touch-lr");
      const reserved =
        (hud ? hud.getBoundingClientRect().height : 0) +
        (controls ? controls.getBoundingClientRect().height : 0) +
        140; // spin/start button + gaps + safe-area padding allowance
      const availH = window.innerHeight - reserved;
      const availW = window.innerWidth * 0.95;
      let w = availW;
      let h = w / aspect;
      if (h > availH) {
        h = Math.max(220, availH);
        w = h * aspect;
      }
      wrap.style.width = Math.round(w) + "px";
      wrap.style.height = Math.round(h) + "px";
    }

    function clearFit(stage) {
      const wrap = stage.querySelector(".game-canvas-wrap");
      if (wrap) {
        wrap.style.width = "";
        wrap.style.height = "";
      }
    }

    function enter(stage, aspect, btn) {
      stage.classList.add("immersive");
      document.body.classList.add("game-immersive-active");
      btn.textContent = "✕";
      btn.setAttribute("aria-label", "Exit fullscreen");
      fitCanvas(stage, aspect);
      const refit = () => fitCanvas(stage, aspect);
      stage._immersiveRefit = refit;
      window.addEventListener("resize", refit);
      window.addEventListener("orientationchange", refit);
      if (stage.requestFullscreen) {
        stage.requestFullscreen().catch(() => {});
      }
    }

    function exit(stage, btn) {
      stage.classList.remove("immersive");
      document.body.classList.remove("game-immersive-active");
      btn.textContent = "⛶";
      btn.setAttribute("aria-label", "Fullscreen");
      clearFit(stage);
      if (stage._immersiveRefit) {
        window.removeEventListener("resize", stage._immersiveRefit);
        window.removeEventListener("orientationchange", stage._immersiveRefit);
        stage._immersiveRefit = null;
      }
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }

    document.querySelectorAll(".game-stage").forEach((stage) => {
      const aspect = parseFloat(stage.dataset.aspect || "1");
      const btn = stage.querySelector(".fullscreen-btn");
      if (!btn) return;

      btn.addEventListener("click", () => {
        if (stage.classList.contains("immersive")) exit(stage, btn);
        else enter(stage, aspect, btn);
      });

      // Auto-enter immersive mode the first time a touch user hits Start
      if (isTouch) {
        const startBtn = stage.querySelector(".game-overlay .spin-btn");
        if (startBtn) {
          startBtn.addEventListener("click", () => {
            if (!stage.classList.contains("immersive")) enter(stage, aspect, btn);
          });
        }
      }
    });

    // If the user exits native fullscreen via the OS/back gesture, unwind our state too
    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement) {
        document.querySelectorAll(".game-stage.immersive").forEach((stage) => {
          const btn = stage.querySelector(".fullscreen-btn");
          if (btn) exit(stage, btn);
        });
      }
    });

    // Escape key exits immersive mode too (keyboard users testing on desktop)
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".game-stage.immersive").forEach((stage) => {
          const btn = stage.querySelector(".fullscreen-btn");
          if (btn) exit(stage, btn);
        });
      }
    });
  })();
})();

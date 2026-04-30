/**
 * GARDEN OF GRACE: FIRST HARVEST
 * Premium Stable Edition
 * Replace your entire game.js with this file.
 */

window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const bgCanvas = document.createElement("canvas");
  const bgCtx = bgCanvas.getContext("2d");

  bgCanvas.width = canvas.width;
  bgCanvas.height = canvas.height;

  const TILE = 96;
  const COLS = 10;
  const ROWS = 8;
  const MAP_WIDTH = COLS * TILE;
  const MAP_HEIGHT = ROWS * TILE;
  const MAP_X = Math.round((canvas.width - MAP_WIDTH) / 2);
  const MAP_Y = 560;

  const STORAGE_KEY = "gardenOfGracePremiumV3";

  const ASSET_PATHS = {
    grass: "assets/grass.png",
    soil: "assets/soil.png",
    weed: "assets/weed.png",
    faithCrop: "assets/faith-crop.png",
    player: "assets/player.png"
  };

  const seedInfo = {
    faith: {
      name: "Faith",
      stat: "faith",
      cropName: "Mustard Bloom",
      color: "#e9c35f",
      glow: "rgba(233,195,95,0.55)",
      message: "You planted a seed of faith. Small beginnings still matter."
    },
    peace: {
      name: "Peace",
      stat: "peace",
      cropName: "Stillwater Lily",
      color: "#79c7ef",
      glow: "rgba(121,199,239,0.55)",
      message: "You planted peace. Let quiet places grow."
    },
    kindness: {
      name: "Kindness",
      stat: "kindness",
      cropName: "Mercy Vine",
      color: "#86d685",
      glow: "rgba(134,214,133,0.55)",
      message: "You planted kindness. Grace becomes visible through action."
    }
  };

  const ui = {
    loadingScreen: document.getElementById("loadingScreen"),
    loadingFill: document.getElementById("loadingFill"),
    loadingText: document.getElementById("loadingText"),
    titleScreen: document.getElementById("titleScreen"),
    helpModal: document.getElementById("helpModal"),
    continueBtn: document.getElementById("continueBtn"),
    questText: document.getElementById("questText"),
    faithStat: document.getElementById("faithStat"),
    peaceStat: document.getElementById("peaceStat"),
    kindnessStat: document.getElementById("kindnessStat"),
    harvestStat: document.getElementById("harvestStat"),
    messageBox: document.getElementById("messageBox")
  };

  const images = {};

  let selectedSeed = "faith";
  let timeTick = 0;
  let state = null;
  let lastTime = 0;
  let assetsFinished = false;

  const playerMotion = {
    currentX: 1,
    currentY: 6,
    targetX: 1,
    targetY: 6,
    lerpSpeed: 0.18,
    bob: 0
  };

  function haptic(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) {}
  }

  function key(x, y) {
    return `${x},${y}`;
  }

  function inBounds(x, y) {
    return x >= 0 && x < COLS && y >= 0 && y < ROWS;
  }

  function defaultState() {
    return {
      player: {
        x: 1,
        y: 6,
        facing: "right",
        stepPulse: 0
      },
      day: 1,
      faith: 1,
      peace: 1,
      kindness: 1,
      harvest: 0,
      prayedToday: false,
      tiles: [],
      crops: {},
      weeds: {},
      particles: [],
      sparkles: [],
      ripples: [],
      screenFlash: 0,
      message: "Welcome to the Heartfield. Restore what’s broken and grow in grace."
    };
  }

  function repairState(saved) {
    const fresh = defaultState();

    if (!saved || typeof saved !== "object") return fresh;

    const repaired = {
      ...fresh,
      ...saved,
      player: {
        ...fresh.player,
        ...(saved.player || {})
      },
      crops: saved.crops && typeof saved.crops === "object" ? saved.crops : {},
      weeds: saved.weeds && typeof saved.weeds === "object" ? saved.weeds : {},
      particles: Array.isArray(saved.particles) ? saved.particles : [],
      sparkles: Array.isArray(saved.sparkles) ? saved.sparkles : [],
      ripples: Array.isArray(saved.ripples) ? saved.ripples : [],
      tiles: Array.isArray(saved.tiles) ? saved.tiles : []
    };

    if (!Array.isArray(repaired.tiles) || repaired.tiles.length !== ROWS) {
      repaired.tiles = [];
    }

    return repaired;
  }

  function tileAt(x, y) {
    if (!state || !state.tiles || !state.tiles[y]) return "void";
    return inBounds(x, y) ? state.tiles[y][x] : "void";
  }

  function isBlocked(x, y) {
    return ["void", "water", "fence"].includes(tileAt(x, y));
  }

  function centerOfTile(x, y) {
    return {
      x: MAP_X + x * TILE + TILE / 2,
      y: MAP_Y + y * TILE + TILE / 2
    };
  }

  function imageReady(img) {
    return img && img.complete && img.naturalWidth > 0;
  }

  function updateLoading(loaded, total, label) {
    const percent = Math.round((loaded / total) * 100);

    if (ui.loadingFill) {
      ui.loadingFill.style.width = `${percent}%`;
    }

    if (ui.loadingText) {
      ui.loadingText.textContent = label || `Forging assets... ${percent}%`;
    }
  }

  function loadAssets() {
    const entries = Object.entries(ASSET_PATHS);
    let loaded = 0;

    return new Promise((resolve) => {
      if (!entries.length) {
        assetsFinished = true;
        resolve();
        return;
      }

      const done = (name, img, failed = false) => {
        loaded += 1;
        images[name] = img;

        updateLoading(
          loaded,
          entries.length,
          failed ? `Using fallback art... ${Math.round((loaded / entries.length) * 100)}%` : `Forging assets... ${Math.round((loaded / entries.length) * 100)}%`
        );

        if (loaded >= entries.length && !assetsFinished) {
          assetsFinished = true;
          setTimeout(resolve, 350);
        }
      };

      entries.forEach(([name, src]) => {
        const img = new Image();

        img.onload = () => done(name, img, false);

        img.onerror = () => {
          console.warn(`Asset failed to load: ${src}`);
          done(name, img, true);
        };

        img.src = `${src}?v=${Date.now()}`;
      });

      setTimeout(() => {
        if (!assetsFinished) {
          console.warn("Asset loading timed out. Starting with fallback art.");
          assetsFinished = true;
          updateLoading(entries.length, entries.length, "Starting with fallback art...");
          resolve();
        }
      }, 5000);
    });
  }

  function setupWorld() {
    state.tiles = [];

    for (let y = 0; y < ROWS; y++) {
      const row = [];

      for (let x = 0; x < COLS; x++) {
        let type = "grass";

        if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) {
          type = "fence";
        } else if (x >= 3 && x <= 6 && y >= 2 && y <= 5) {
          type = "soil";
        } else if (x >= 7 && x <= 8 && y >= 1 && y <= 3) {
          type = "water";
        } else if (y === 6 && x >= 1 && x <= 8) {
          type = "path";
        }

        row.push(type);
      }

      state.tiles.push(row);
    }

    state.weeds = {};

    [
      [1, 2],
      [3, 2],
      [4, 2],
      [6, 2],
      [6, 3],
      [3, 5],
      [4, 5],
      [6, 5],
      [8, 5],
      [5, 1]
    ].forEach(([x, y]) => {
      state.weeds[key(x, y)] = true;
    });

    state.crops = {};
    state.particles = [];
    state.sparkles = [];
    state.ripples = [];
    state.screenFlash = 0;

    createAmbientParticles();
  }

  function createAmbientParticles() {
    state.particles = [];

    for (let i = 0; i < 52; i++) {
      state.particles.push({
        x: Math.random() * canvas.width,
        y: 180 + Math.random() * (canvas.height - 260),
        vx: -0.12 + Math.random() * 0.24,
        vy: -0.08 - Math.random() * 0.18,
        r: 0.8 + Math.random() * 2.4,
        a: 0.15 + Math.random() * 0.42
      });
    }
  }

  function renderStaticBackground() {
    const sky = bgCtx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, "#a9d0ef");
    sky.addColorStop(0.38, "#e7dfbf");
    sky.addColorStop(0.68, "#708b5d");
    sky.addColorStop(1, "#3f5437");

    bgCtx.fillStyle = sky;
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

    const sun = bgCtx.createRadialGradient(862, 220, 18, 862, 220, 260);
    sun.addColorStop(0, "rgba(255,244,200,0.8)");
    sun.addColorStop(1, "rgba(255,224,145,0)");

    bgCtx.fillStyle = sun;
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

    bgCtx.fillStyle = "rgba(255,255,255,0.14)";

    for (let i = 0; i < 6; i++) {
      const x = 80 + i * 185;
      const y = 180 + (i % 3) * 28;

      bgCtx.beginPath();
      bgCtx.ellipse(x, y, 68, 22, 0, 0, Math.PI * 2);
      bgCtx.ellipse(x + 48, y + 8, 58, 18, 0, 0, Math.PI * 2);
      bgCtx.ellipse(x - 44, y + 12, 46, 16, 0, 0, Math.PI * 2);
      bgCtx.fill();
    }

    bgCtx.fillStyle = "#40583e";
    bgCtx.beginPath();
    bgCtx.moveTo(0, 520);
    bgCtx.lineTo(190, 360);
    bgCtx.lineTo(385, 500);
    bgCtx.lineTo(585, 350);
    bgCtx.lineTo(825, 510);
    bgCtx.lineTo(1080, 382);
    bgCtx.lineTo(1080, 820);
    bgCtx.lineTo(0, 820);
    bgCtx.fill();

    bgCtx.fillStyle = "#2f432f";
    bgCtx.beginPath();
    bgCtx.moveTo(0, 660);
    bgCtx.lineTo(155, 500);
    bgCtx.lineTo(350, 650);
    bgCtx.lineTo(575, 500);
    bgCtx.lineTo(820, 680);
    bgCtx.lineTo(1080, 510);
    bgCtx.lineTo(1080, 930);
    bgCtx.lineTo(0, 930);
    bgCtx.fill();

    const meadow = bgCtx.createLinearGradient(0, 920, 0, canvas.height);
    meadow.addColorStop(0, "#899d68");
    meadow.addColorStop(1, "#425c3a");

    bgCtx.fillStyle = meadow;
    bgCtx.fillRect(0, 900, bgCanvas.width, bgCanvas.height - 900);
  }

  function drawCoverImage(img, x, y, w, h) {
    if (!imageReady(img)) return false;

    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.max(w / iw, h / ih);
    const sw = w / scale;
    const sh = h / scale;
    const sx = (iw - sw) / 2;
    const sy = (ih - sh) / 2;

    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    return true;
  }

  function drawTile(x, y, type) {
    const px = MAP_X + x * TILE;
    const py = MAP_Y + y * TILE;

    if (type === "grass") {
      if (!drawCoverImage(images.grass, px, py, TILE, TILE)) {
        drawFallbackGrass(px, py);
      }

      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(px, py + TILE - 10, TILE, 10);
    }

    if (type === "soil") {
      if (!drawCoverImage(images.soil, px, py, TILE, TILE)) {
        drawFallbackSoil(px, py);
      }

      ctx.fillStyle = "rgba(0,0,0,0.14)";
      ctx.fillRect(px, py + TILE - 10, TILE, 10);
    }

    if (type === "water") {
      drawWaterTile(px, py, x, y);
    }

    if (type === "path") {
      drawPathTile(px, py, x, y);
    }

    if (type === "fence") {
      if (!drawCoverImage(images.grass, px, py, TILE, TILE)) {
        drawFallbackGrass(px, py);
      }

      ctx.fillStyle = "rgba(20,45,28,0.50)";
      ctx.fillRect(px, py, TILE, TILE);

      ctx.fillStyle = "#8e5e33";
      ctx.fillRect(px + 18, py + 9, 12, TILE - 18);
      ctx.fillRect(px + 9, py + 28, TILE - 18, 11);

      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(px + 20, py + 10, 3, TILE - 22);
      ctx.fillRect(px + 10, py + 29, TILE - 20, 3);
    }
  }

  function drawFallbackGrass(px, py) {
    const g = ctx.createLinearGradient(px, py, px, py + TILE);
    g.addColorStop(0, "#4d9a52");
    g.addColorStop(1, "#2f7037");

    ctx.fillStyle = g;
    ctx.fillRect(px, py, TILE, TILE);

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    for (let i = 0; i < 8; i++) {
      const gx = px + 8 + i * 12;
      const gy = py + 18 + ((i * 17) % 48);
      ctx.fillRect(gx, gy, 3, 14);
    }
  }

  function drawFallbackSoil(px, py) {
    const g = ctx.createLinearGradient(px, py, px, py + TILE);
    g.addColorStop(0, "#9a6336");
    g.addColorStop(1, "#6e3d22");

    ctx.fillStyle = g;
    ctx.fillRect(px, py, TILE, TILE);

    ctx.strokeStyle = "rgba(48,24,12,0.45)";
    ctx.lineWidth = 4;

    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(px + 8, py + 20 + i * 17);
      ctx.quadraticCurveTo(px + 45, py + 10 + i * 17, px + 88, py + 22 + i * 17);
      ctx.stroke();
    }
  }

  function drawWaterTile(px, py, x, y) {
    const gradient = ctx.createLinearGradient(px, py, px, py + TILE);
    gradient.addColorStop(0, "#6cc9ee");
    gradient.addColorStop(1, "#2f8dbb");

    ctx.fillStyle = gradient;
    ctx.fillRect(px, py, TILE, TILE);

    ctx.strokeStyle = "rgba(255,255,255,0.26)";
    ctx.lineWidth = 3;

    const waveOffset = Math.sin(timeTick / 28 + x + y) * 4;

    ctx.beginPath();
    ctx.moveTo(px + 12, py + 28 + waveOffset);
    ctx.quadraticCurveTo(px + 30, py + 16 + waveOffset, px + 48, py + 28 + waveOffset);
    ctx.quadraticCurveTo(px + 66, py + 40 + waveOffset, px + 84, py + 28 + waveOffset);
    ctx.stroke();
  }

  function drawPathTile(px, py, x, y) {
    const g = ctx.createLinearGradient(px, py, px, py + TILE);
    g.addColorStop(0, "#d4b57b");
    g.addColorStop(1, "#aa7c47");

    ctx.fillStyle = g;
    ctx.fillRect(px, py, TILE, TILE);

    ctx.fillStyle = "rgba(80,47,20,0.16)";

    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(px + 12 + i * 18, py + 28 + ((i + x + y) % 3) * 12, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawFallbackCrop(cx, cy, crop, info) {
    ctx.save();
    ctx.translate(cx, cy);

    ctx.strokeStyle = "#2e7a38";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";

    if (crop.growth === 0) {
      ctx.fillStyle = info.color;
      ctx.beginPath();
      ctx.arc(0, 15, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    if (crop.growth >= 1) {
      ctx.beginPath();
      ctx.moveTo(0, 20);
      ctx.lineTo(0, crop.growth === 1 ? -2 : -16);
      ctx.stroke();

      ctx.fillStyle = "#74c97a";
      ctx.beginPath();
      ctx.ellipse(-12, 4, 12, 5, -0.7, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(12, -2, 12, 5, 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    if (crop.growth >= 2) {
      ctx.fillStyle = info.color;
      ctx.beginPath();
      ctx.arc(0, -15, 11, 0, Math.PI * 2);
      ctx.fill();
    }

    if (crop.growth >= 3) {
      ctx.shadowColor = info.glow;
      ctx.shadowBlur = 18;
      ctx.fillStyle = info.color;

      for (let i = 0; i < 7; i++) {
        const angle = (Math.PI * 2 / 7) * i;
        ctx.beginPath();
        ctx.ellipse(
          Math.cos(angle) * 12,
          -22 + Math.sin(angle) * 12,
          8,
          5,
          angle,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      ctx.fillStyle = "#fff7d5";
      ctx.beginPath();
      ctx.arc(0, -22, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (crop.watered) {
      drawWaterDrops(0, 0);
    }

    ctx.restore();
  }

  function drawWaterDrops(cx, cy) {
    ctx.fillStyle = "rgba(121,199,239,0.84)";

    ctx.beginPath();
    ctx.arc(cx + 25, cy + 17, 5, 0, Math.PI * 2);
    ctx.arc(cx + 34, cy + 5, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawWeed(cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);

    ctx.strokeStyle = "#17301f";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";

    for (let i = 0; i < 5; i++) {
      const angle = -0.9 + i * 0.45;
      ctx.beginPath();
      ctx.moveTo(0, 26);
      ctx.quadraticCurveTo(Math.sin(angle) * 20, 0, Math.sin(angle) * 32, -28);
      ctx.stroke();

      ctx.fillStyle = i % 2 === 0 ? "#234d2d" : "#182a21";
      ctx.beginPath();
      ctx.ellipse(Math.sin(angle) * 30, -18, 14, 6, angle, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawPlayer() {
    const px = MAP_X + playerMotion.currentX * TILE + TILE / 2;
    const py = MAP_Y + playerMotion.currentY * TILE + TILE / 2;

    ctx.save();

    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.beginPath();
    ctx.ellipse(px, py + 38, 28, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    const h = TILE * 1.32;
    const w = TILE * 0.92;

    if (imageReady(images.player)) {
      ctx.drawImage(images.player, px - w / 2, py - h / 2 + playerMotion.bob, w, h);
    } else {
      drawFallbackPlayer(px, py + playerMotion.bob);
    }

    ctx.restore();
  }

  function drawFallbackPlayer(px, py) {
    ctx.save();
    ctx.translate(px, py);

    ctx.fillStyle = "#2d4563";
    ctx.beginPath();
    ctx.roundRect(-22, -8, 44, 48, 14);
    ctx.fill();

    ctx.fillStyle = "#f2c38f";
    ctx.beginPath();
    ctx.arc(0, -30, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#6c3f22";
    ctx.beginPath();
    ctx.arc(0, -38, 18, Math.PI, 0);
    ctx.fill();

    ctx.strokeStyle = "#2b1a10";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(-6, -28, 2, 0, Math.PI * 2);
    ctx.arc(8, -28, 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#b7864f";
    ctx.fillRect(-18, 38, 12, 18);
    ctx.fillRect(6, 38, 12, 18);

    ctx.restore();
  }

  function drawSparkles() {
    state.sparkles.forEach((s) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, s.life / 30);
      ctx.fillStyle = s.color || "rgba(255,244,220,0.9)";
      ctx.shadowColor = s.color || "rgba(255,244,220,0.9)";
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.arc(s.x, s.y, 3.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
  }

  function drawAmbientParticles() {
    state.particles.forEach((p) => {
      ctx.fillStyle = `rgba(255,232,162,${p.a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function movePlayer(dx, dy) {
    const nx = state.player.x + dx;
    const ny = state.player.y + dy;

    if (dx > 0) state.player.facing = "right";
    if (dx < 0) state.player.facing = "left";
    if (dy > 0) state.player.facing = "down";
    if (dy < 0) state.player.facing = "up";

    if (isBlocked(nx, ny)) {
      haptic([10, 30, 10]);
      setMessage("That path is blocked for now.");
      bumpEffect(state.player.x, state.player.y);
      return;
    }

    haptic(10);

    state.player.x = nx;
    state.player.y = ny;

    playerMotion.targetX = nx;
    playerMotion.targetY = ny;

    state.player.stepPulse = 10;

    addDust(nx, ny);
  }

  function handleCanvasTap(event) {
    if (!state) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const mx = (event.clientX - rect.left) * scaleX;
    const my = (event.clientY - rect.top) * scaleY;

    const tx = Math.floor((mx - MAP_X) / TILE);
    const ty = Math.floor((my - MAP_Y) / TILE);

    if (!inBounds(tx, ty)) return;

    const dx = tx - state.player.x;
    const dy = ty - state.player.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx !== 0) movePlayer(Math.sign(dx), 0);
    } else {
      if (dy !== 0) movePlayer(0, Math.sign(dy));
    }
  }

  function plantSeed() {
    const x = state.player.x;
    const y = state.player.y;
    const k = key(x, y);

    if (tileAt(x, y) !== "soil") {
      haptic([10, 30, 10]);
      setMessage("Stand on soil to plant.");
      bumpEffect(x, y);
      return;
    }

    if (state.weeds[k]) {
      haptic([10, 30, 10]);
      setMessage("Clear the weeds first.");
      bumpEffect(x, y);
      return;
    }

    if (state.crops[k]) {
      haptic([10, 30, 10]);
      setMessage("Something is already growing here.");
      bumpEffect(x, y);
      return;
    }

    haptic(20);

    state.crops[k] = {
      type: selectedSeed,
      growth: 0,
      watered: false,
      plantedAt: state.day
    };

    const info = seedInfo[selectedSeed];

    addSparkles(x, y, 18, info.glow);
    pulseFlash(5);
    setMessage(info.message);
    updateUI();
  }

  function waterCrop() {
    const k = key(state.player.x, state.player.y);
    const crop = state.crops[k];

    if (!crop) {
      haptic([10, 30, 10]);
      setMessage("Nothing here to water.");
      bumpEffect(state.player.x, state.player.y);
      return;
    }

    if (crop.watered) {
      haptic([10, 30, 10]);
      setMessage("Already watered today.");
      return;
    }

    haptic(15);

    crop.watered = true;
    crop.growth = Math.min(3, crop.growth + 1);

    addSparkles(state.player.x, state.player.y, 14, "rgba(121,199,239,0.86)");
    addWaterBurst(state.player.x, state.player.y);

    setMessage("You watered the crop. Faithful care brings growth.");
    updateUI();
  }

  function harvestCrop() {
    const k = key(state.player.x, state.player.y);
    const crop = state.crops[k];

    if (!crop) {
      haptic([10, 30, 10]);
      setMessage("Nothing ready for harvest.");
      bumpEffect(state.player.x, state.player.y);
      return;
    }

    if (crop.growth < 3) {
      haptic([10, 30, 10]);
      setMessage("Patience is part of the harvest.");
      bumpEffect(state.player.x, state.player.y);
      return;
    }

    haptic([20, 40, 20]);

    const info = seedInfo[crop.type];

    state[info.stat] += 1;
    state.harvest += 1;

    delete state.crops[k];

    addSparkles(state.player.x, state.player.y, 28, info.glow);
    pulseFlash(10);

    setMessage(`Harvested ${info.cropName}. ${info.name} increased.`);
    updateUI();
  }

  function clearWeeds() {
    const k = key(state.player.x, state.player.y);

    if (!state.weeds[k]) {
      haptic([10, 30, 10]);
      setMessage("No weeds here.");
      bumpEffect(state.player.x, state.player.y);
      return;
    }

    haptic(25);

    delete state.weeds[k];

    state.kindness += 1;

    addSparkles(state.player.x, state.player.y, 24, "rgba(134,214,133,0.86)");
    pulseFlash(7);

    setMessage("You cleared the weeds. The field feels lighter.");
    updateUI();
  }

  function pray() {
    if (state.prayedToday) {
      haptic([10, 30, 10]);
      setMessage("You already prayed today.");
      return;
    }

    haptic([30, 50, 30, 50, 40]);

    state.prayedToday = true;
    state.peace += 1;

    Object.values(state.crops).forEach((crop) => {
      if (crop.watered && crop.growth < 3) {
        crop.growth += 1;
      }
    });

    addSparkles(state.player.x, state.player.y, 46, "rgba(255,244,220,0.96)");
    pulseFlash(14);

    setMessage("You paused to pray. Peace settles over the field.");
    updateUI();
  }

  function newDay() {
    state.day += 1;
    state.prayedToday = false;

    Object.values(state.crops).forEach((crop) => {
      if (crop.watered && crop.growth < 3) {
        crop.growth += 1;
      }

      crop.watered = false;
    });

    maybeSpawnWeed();

    setMessage(`Day ${state.day} begins. Mercy is new.`);
    updateUI();
  }

  function maybeSpawnWeed() {
    if (Math.random() > 0.62) return;

    const possible = [];

    for (let y = 1; y < ROWS - 1; y++) {
      for (let x = 1; x < COLS - 1; x++) {
        const k = key(x, y);

        if (
          tileAt(x, y) !== "water" &&
          tileAt(x, y) !== "fence" &&
          !state.weeds[k] &&
          !state.crops[k]
        ) {
          possible.push([x, y]);
        }
      }
    }

    if (possible.length) {
      const [x, y] = possible[Math.floor(Math.random() * possible.length)];
      state.weeds[key(x, y)] = true;
    }
  }

  function update(dt) {
    timeTick += dt;

    playerMotion.currentX += (playerMotion.targetX - playerMotion.currentX) * playerMotion.lerpSpeed * dt;
    playerMotion.currentY += (playerMotion.targetY - playerMotion.currentY) * playerMotion.lerpSpeed * dt;
    playerMotion.bob = Math.sin(timeTick / 10) * 2;

    if (!Array.isArray(state.particles)) state.particles = [];
    if (!Array.isArray(state.sparkles)) state.sparkles = [];

    state.particles.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.y < 180) {
        p.y = canvas.height - 100;
        p.x = Math.random() * canvas.width;
      }
    });

    state.sparkles = state.sparkles.filter((s) => {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;

      return s.life > 0;
    });

    if (state.screenFlash > 0) {
      state.screenFlash -= dt;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(bgCanvas, 0, 0);

    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(MAP_X + 12, MAP_Y + 18, MAP_WIDTH, MAP_HEIGHT);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        drawTile(x, y, tileAt(x, y));
      }
    }

    Object.entries(state.crops).forEach(([pos, crop]) => {
      const [x, y] = pos.split(",").map(Number);
      const center = centerOfTile(x, y);
      const info = seedInfo[crop.type] || seedInfo.faith;

      if (crop.growth >= 3 && crop.type === "faith" && imageReady(images.faithCrop)) {
        ctx.save();
        ctx.shadowColor = seedInfo.faith.glow;
        ctx.shadowBlur = 28;

        const size = TILE * 1.04;

        ctx.drawImage(
          images.faithCrop,
          center.x - size / 2,
          center.y - size / 2,
          size,
          size
        );

        if (crop.watered) {
          drawWaterDrops(center.x, center.y);
        }

        ctx.restore();
      } else {
        drawFallbackCrop(center.x, center.y, crop, info);
      }
    });

    Object.keys(state.weeds).forEach((pos) => {
      const [x, y] = pos.split(",").map(Number);
      const center = centerOfTile(x, y);
      const size = TILE * 0.96;

      if (imageReady(images.weed)) {
        ctx.drawImage(
          images.weed,
          center.x - size / 2,
          center.y - size / 2,
          size,
          size
        );
      } else {
        drawWeed(center.x, center.y);
      }
    });

    drawPlayer();
    drawSparkles();
    drawAmbientParticles();

    if (state.screenFlash > 0) {
      ctx.fillStyle = `rgba(255,244,220,${state.screenFlash * 0.018})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function mainLoop(ts) {
    const dt = lastTime ? Math.min(3, (ts - lastTime) / 16.67) : 1;

    lastTime = ts;

    update(dt);
    draw();

    requestAnimationFrame(mainLoop);
  }

  function setMessage(text) {
    state.message = text;

    if (ui.messageBox) {
      ui.messageBox.textContent = text;
    }
  }

  function updateUI() {
    if (!state) return;

    if (ui.faithStat) ui.faithStat.textContent = state.faith;
    if (ui.peaceStat) ui.peaceStat.textContent = state.peace;
    if (ui.kindnessStat) ui.kindnessStat.textContent = state.kindness;
    if (ui.harvestStat) ui.harvestStat.textContent = state.harvest;

    const weedCount = Object.keys(state.weeds || {}).length;
    const cropCount = Object.keys(state.crops || {}).length;

    if (ui.questText) {
      if (weedCount > 0) {
        ui.questText.textContent = `Clear the weeds choking the field. ${weedCount} remain.`;
      } else if (cropCount === 0) {
        ui.questText.textContent = "Plant your first seeds of faith, peace, and kindness.";
      } else {
        ui.questText.textContent = "Water, pray, and harvest what grace is growing.";
      }
    }
  }

  function saveGame(silent = false) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

      if (!silent) {
        setMessage("Journey saved.");
      }
    } catch (e) {
      console.warn("Save failed:", e);
      setMessage("Save failed on this device.");
    }
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) return null;

      return JSON.parse(raw);
    } catch (e) {
      console.warn("Save file was corrupted. Starting fresh.", e);
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  function resetGame() {
    localStorage.removeItem(STORAGE_KEY);

    state = defaultState();
    setupWorld();

    playerMotion.currentX = state.player.x;
    playerMotion.currentY = state.player.y;
    playerMotion.targetX = state.player.x;
    playerMotion.targetY = state.player.y;

    setMessage(state.message);
    updateUI();
  }

  function addSparkles(tx, ty, amount, color) {
    const c = centerOfTile(tx, ty);

    for (let i = 0; i < amount; i++) {
      state.sparkles.push({
        x: c.x + (Math.random() - 0.5) * 54,
        y: c.y + (Math.random() - 0.5) * 54,
        vx: (Math.random() - 0.5) * 1.35,
        vy: -0.4 - Math.random() * 1.2,
        life: 30,
        color
      });
    }
  }

  function addDust(tx, ty) {
    addSparkles(tx, ty, 6, "rgba(238,210,160,0.5)");
  }

  function addWaterBurst(tx, ty) {
    addSparkles(tx, ty, 10, "rgba(121,199,239,0.85)");
  }

  function bumpEffect(tx, ty) {
    addSparkles(tx, ty, 6, "rgba(255,120,100,0.45)");
  }

  function pulseFlash(amount) {
    state.screenFlash = Math.max(state.screenFlash, amount);
  }

  function bindEvents() {
    const startBtn = document.getElementById("startBtn");
    const continueBtn = document.getElementById("continueBtn");
    const howBtn = document.getElementById("howBtn");
    const closeHelpBtn = document.getElementById("closeHelpBtn");
    const helpBackBtn = document.getElementById("helpBackBtn");
    const saveBtn = document.getElementById("saveBtn");

    if (startBtn) {
      startBtn.onclick = () => {
        haptic(30);
        resetGame();
        ui.titleScreen.classList.add("hidden");
      };
    }

    if (continueBtn) {
      continueBtn.onclick = () => {
        haptic(30);
        ui.titleScreen.classList.add("hidden");
      };
    }

    if (howBtn) {
      howBtn.onclick = () => {
        haptic(10);
        ui.helpModal.classList.remove("hidden");
      };
    }

    if (closeHelpBtn) {
      closeHelpBtn.onclick = () => {
        haptic(10);
        ui.helpModal.classList.add("hidden");
      };
    }

    if (helpBackBtn) {
      helpBackBtn.onclick = () => {
        haptic(10);
        ui.helpModal.classList.add("hidden");
      };
    }

    document.getElementById("plantBtn").onclick = plantSeed;
    document.getElementById("waterBtn").onclick = waterCrop;
    document.getElementById("harvestBtn").onclick = harvestCrop;
    document.getElementById("clearBtn").onclick = clearWeeds;
    document.getElementById("prayBtn").onclick = pray;

    document.querySelectorAll(".seed-option").forEach((button) => {
      button.addEventListener("click", () => {
        haptic(10);

        selectedSeed = button.dataset.seed;

        document.querySelectorAll(".seed-option").forEach((b) => {
          b.classList.remove("active");
        });

        button.classList.add("active");

        setMessage(`${seedInfo[selectedSeed].name} seed selected.`);
        updateUI();
      });
    });

    if (saveBtn) {
      saveBtn.onclick = () => {
        haptic(20);
        saveGame(false);
      };
    }

    canvas.addEventListener("click", handleCanvasTap);

    canvas.addEventListener("touchstart", (event) => {
      const touch = event.touches[0];

      if (!touch) return;

      handleCanvasTap(touch);
    }, { passive: true });

    document.addEventListener("keydown", (event) => {
      const k = event.key.toLowerCase();

      if (["w", "arrowup"].includes(k)) movePlayer(0, -1);
      if (["s", "arrowdown"].includes(k)) movePlayer(0, 1);
      if (["a", "arrowleft"].includes(k)) movePlayer(-1, 0);
      if (["d", "arrowright"].includes(k)) movePlayer(1, 0);

      if (k === "p") plantSeed();
      if (k === "e") waterCrop();
      if (k === "h") harvestCrop();
      if (k === "c") clearWeeds();
      if (k === "r") pray();
      if (k === "n") newDay();
    });
  }

  function enableRoundRectFallback() {
    if (CanvasRenderingContext2D.prototype.roundRect) return;

    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      this.beginPath();
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r);
      this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + w, y, r);
      this.closePath();
      return this;
    };
  }

  async function init() {
    try {
      enableRoundRectFallback();

      state = repairState(loadGame());

      if (!state.tiles || state.tiles.length === 0) {
        setupWorld();
      }

      if (!state.particles || state.particles.length === 0) {
        createAmbientParticles();
      }

      playerMotion.currentX = state.player.x;
      playerMotion.currentY = state.player.y;
      playerMotion.targetX = state.player.x;
      playerMotion.targetY = state.player.y;

      renderStaticBackground();
      bindEvents();
      updateUI();
      setMessage(state.message);

      await loadAssets();

      if (ui.loadingScreen) {
        ui.loadingScreen.classList.add("hidden");
      }

      requestAnimationFrame(mainLoop);
    } catch (error) {
      console.error("Game failed to start:", error);

      if (ui.loadingText) {
        ui.loadingText.textContent = "Game start error. Check game.js file.";
      }

      setTimeout(() => {
        if (ui.loadingScreen) {
          ui.loadingScreen.classList.add("hidden");
        }
      }, 1200);
    }
  }

  init();
});

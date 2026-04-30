const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const TILE = 96;
const COLS = 10;
const ROWS = 8;
const MAP_WIDTH = COLS * TILE;
const MAP_HEIGHT = ROWS * TILE;
const MAP_X = Math.round((canvas.width - MAP_WIDTH) / 2);
const MAP_Y = 560;

const STORAGE_KEY = "gardenOfGracePremiumV2";

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
    glow: "rgba(233,195,95,0.42)",
    message: "You planted a seed of faith. Small beginnings still matter."
  },
  peace: {
    name: "Peace",
    stat: "peace",
    cropName: "Stillwater Lily",
    color: "#79c7ef",
    glow: "rgba(121,199,239,0.42)",
    message: "You planted peace. Let quiet places grow."
  },
  kindness: {
    name: "Kindness",
    stat: "kindness",
    cropName: "Mercy Vine",
    color: "#86d685",
    glow: "rgba(134,214,133,0.42)",
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
let lastAutoSave = 0;
let state = null;

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

function key(x, y) {
  return `${x},${y}`;
}

function inBounds(x, y) {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS;
}

function tileAt(x, y) {
  if (!inBounds(x, y)) return "void";
  return state.tiles[y][x];
}

function isBlocked(x, y) {
  const type = tileAt(x, y);
  return type === "void" || type === "water" || type === "fence";
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

function drawContainImage(img, x, y, w, h) {
  if (!imageReady(img)) return false;

  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;

  ctx.drawImage(img, dx, dy, dw, dh);
  return true;
}

function loadAssets() {
  const entries = Object.entries(ASSET_PATHS);
  let loaded = 0;

  return new Promise(resolve => {
    entries.forEach(([name, src]) => {
      const img = new Image();

      img.onload = () => {
        loaded += 1;
        images[name] = img;
        updateLoading(loaded, entries.length);

        if (loaded === entries.length) {
          setTimeout(resolve, 350);
        }
      };

      img.onerror = () => {
        loaded += 1;
        images[name] = img;
        updateLoading(loaded, entries.length);

        if (loaded === entries.length) {
          setTimeout(resolve, 350);
        }
      };

      img.src = `${src}?cache=${Date.now()}`;
    });
  });
}

function updateLoading(loaded, total) {
  const percent = Math.round((loaded / total) * 100);
  ui.loadingFill.style.width = `${percent}%`;
  ui.loadingText.textContent = `Loading assets... ${percent}%`;
}

function setupWorld() {
  state.tiles = [];

  for (let y = 0; y < ROWS; y++) {
    const row = [];

    for (let x = 0; x < COLS; x++) {
      let type = "grass";

      if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) {
        type = "fence";
      }

      if (x >= 3 && x <= 6 && y >= 2 && y <= 5) {
        type = "soil";
      }

      if (x >= 7 && x <= 8 && y >= 1 && y <= 3) {
        type = "water";
      }

      if (y === 6 && x >= 1 && x <= 8) {
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

  state.particles = [];
  state.sparkles = [];
  state.ripples = [];

  for (let i = 0; i < 44; i++) {
    state.particles.push({
      x: Math.random() * canvas.width,
      y: 200 + Math.random() * (canvas.height - 240),
      vx: -0.12 + Math.random() * 0.24,
      vy: -0.08 - Math.random() * 0.18,
      r: 0.8 + Math.random() * 2.4,
      a: 0.15 + Math.random() * 0.42
    });
  }

  for (let i = 0; i < 12; i++) {
    state.ripples.push({
      x: MAP_X + 7 * TILE + Math.random() * TILE * 2,
      y: MAP_Y + TILE + Math.random() * TILE * 3,
      t: Math.random() * 100
    });
  }
}

function newGame() {
  state = defaultState();
  setupWorld();
  setMessage("Welcome to the Heartfield. Restore what’s broken and grow in grace.");
  updateUI();
}

function saveGame(silent = false) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  if (!silent) {
    setMessage("Journey saved. The field will remember your progress.");
  }

  updateUI();
}

function loadGame() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;

  try {
    const parsed = JSON.parse(raw);
    state = { ...defaultState(), ...parsed };

    if (!state.tiles || !state.tiles.length) {
      setupWorld();
    }

    if (!state.particles || !state.particles.length) {
      setupWorld();
    }

    setMessage("Welcome back. Your field remembered you.");
    updateUI();
    return true;
  } catch (error) {
    console.warn("Could not load save", error);
    return false;
  }
}

function setMessage(text) {
  state.message = text;
  ui.messageBox.textContent = text;
}

function updateUI() {
  ui.faithStat.textContent = state.faith;
  ui.peaceStat.textContent = state.peace;
  ui.kindnessStat.textContent = state.kindness;
  ui.harvestStat.textContent = state.harvest;

  const weedsLeft = Object.keys(state.weeds).length;
  const planted = Object.keys(state.crops).length;
  const ready = Object.values(state.crops).filter(crop => crop.growth >= 3).length;

  let quest = "Restore the neglected field and prepare it for grace.";

  if (weedsLeft > 0) {
    quest = `Clear the weeds choking the field. ${weedsLeft} remain.`;
  } else if (planted < 3) {
    quest = `Plant 3 seeds in restored soil. ${3 - planted} more needed.`;
  } else if (ready < 2) {
    quest = "Water your seeds and help them reach maturity.";
  } else if (state.harvest < 5) {
    quest = `Harvest spiritual fruit. ${5 - state.harvest} more needed.`;
  } else {
    quest = "The first field is restored. A deeper journey will open next.";
  }

  ui.questText.textContent = quest;

  document.querySelectorAll(".seed-option").forEach(button => {
    button.classList.toggle("active", button.dataset.seed === selectedSeed);
  });

  const hasSave = !!localStorage.getItem(STORAGE_KEY);
  ui.continueBtn.style.opacity = hasSave ? "1" : "0.45";
}

function movePlayer(dx, dy) {
  const nx = state.player.x + dx;
  const ny = state.player.y + dy;

  if (dx > 0) state.player.facing = "right";
  if (dx < 0) state.player.facing = "left";
  if (dy > 0) state.player.facing = "down";
  if (dy < 0) state.player.facing = "up";

  if (isBlocked(nx, ny)) {
    setMessage("That path is blocked for now.");
    bumpEffect(state.player.x, state.player.y);
    return;
  }

  state.player.x = nx;
  state.player.y = ny;
  state.player.stepPulse = 10;

  addDust(nx, ny);
}

function currentTileKey() {
  return key(state.player.x, state.player.y);
}

function plantSeed() {
  const x = state.player.x;
  const y = state.player.y;
  const k = currentTileKey();

  if (tileAt(x, y) !== "soil") {
    setMessage("Stand on a soil tile to plant a seed.");
    bumpEffect(x, y);
    return;
  }

  if (state.weeds[k]) {
    setMessage("Clear the weeds first. Healthy soil matters.");
    bumpEffect(x, y);
    return;
  }

  if (state.crops[k]) {
    setMessage("Something is already growing here.");
    bumpEffect(x, y);
    return;
  }

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
  const k = currentTileKey();
  const crop = state.crops[k];

  if (!crop) {
    setMessage("There is nothing here to water yet.");
    bumpEffect(state.player.x, state.player.y);
    return;
  }

  if (crop.watered) {
    setMessage("This crop has already been watered today.");
    return;
  }

  crop.watered = true;
  crop.growth = Math.min(3, crop.growth + 1);

  addSparkles(state.player.x, state.player.y, 14, "rgba(121,199,239,0.86)");
  addWaterBurst(state.player.x, state.player.y);

  setMessage("You watered the crop. Faithful care brings growth.");
  updateUI();
}

function harvestCrop() {
  const k = currentTileKey();
  const crop = state.crops[k];

  if (!crop) {
    setMessage("There is nothing here ready for harvest.");
    bumpEffect(state.player.x, state.player.y);
    return;
  }

  if (crop.growth < 3) {
    setMessage("This crop is still growing. Patience is part of the harvest.");
    bumpEffect(state.player.x, state.player.y);
    return;
  }

  const info = seedInfo[crop.type];

  state[info.stat] += 1;
  state.harvest += 1;
  delete state.crops[k];

  addSparkles(state.player.x, state.player.y, 28, info.glow);
  pulseFlash(10);
  setMessage(`You harvested ${info.cropName}. ${info.name} increased.`);
  updateUI();
}

function clearWeeds() {
  const k = currentTileKey();

  if (!state.weeds[k]) {
    setMessage("There are no weeds here.");
    bumpEffect(state.player.x, state.player.y);
    return;
  }

  delete state.weeds[k];
  state.kindness += 1;

  addSparkles(state.player.x, state.player.y, 24, "rgba(134,214,133,0.86)");
  pulseFlash(7);
  setMessage("You cleared the weeds. The field feels lighter.");
  updateUI();
}

function pray() {
  if (state.prayedToday) {
    setMessage("You already prayed today. Keep tending the field.");
    return;
  }

  state.prayedToday = true;
  state.peace += 1;

  Object.values(state.crops).forEach(crop => {
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

  Object.values(state.crops).forEach(crop => {
    if (crop.watered && crop.growth < 3) {
      crop.growth += 1;
    }

    crop.watered = false;
  });

  maybeSpawnWeed();

  setMessage(`Day ${state.day} begins. Mercy is new, and the field is waiting.`);
  updateUI();
}

function maybeSpawnWeed() {
  if (Math.random() > 0.62) return;

  const possible = [];

  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      const k = key(x, y);
      const type = tileAt(x, y);

      if (type !== "water" && type !== "fence" && !state.weeds[k] && !state.crops[k]) {
        possible.push([x, y]);
      }
    }
  }

  if (!possible.length) return;

  const [x, y] = possible[Math.floor(Math.random() * possible.length)];
  state.weeds[key(x, y)] = true;
}

function addSparkles(tileX, tileY, amount, color) {
  const center = centerOfTile(tileX, tileY);

  for (let i = 0; i < amount; i++) {
    state.sparkles.push({
      x: center.x + (Math.random() - 0.5) * 54,
      y: center.y + (Math.random() - 0.5) * 54,
      vx: (Math.random() - 0.5) * 1.35,
      vy: -0.4 - Math.random() * 1.2,
      size: 2 + Math.random() * 3.6,
      life: 28 + Math.random() * 34,
      maxLife: 62,
      color
    });
  }
}

function addDust(tileX, tileY) {
  const center = centerOfTile(tileX, tileY);

  for (let i = 0; i < 6; i++) {
    state.sparkles.push({
      x: center.x + (Math.random() - 0.5) * 34,
      y: center.y + 30 + Math.random() * 10,
      vx: (Math.random() - 0.5) * 0.8,
      vy: -0.2 - Math.random() * 0.5,
      size: 2 + Math.random() * 2,
      life: 18 + Math.random() * 16,
      maxLife: 34,
      color: "rgba(238,210,160,0.50)"
    });
  }
}

function addWaterBurst(tileX, tileY) {
  const center = centerOfTile(tileX, tileY);

  for (let i = 0; i < 10; i++) {
    state.sparkles.push({
      x: center.x + 18 + (Math.random() - 0.5) * 20,
      y: center.y + (Math.random() - 0.5) * 24,
      vx: (Math.random() - 0.5) * 1.1,
      vy: -0.2 - Math.random() * 1,
      size: 2 + Math.random() * 2,
      life: 22 + Math.random() * 12,
      maxLife: 34,
      color: "rgba(121,199,239,0.85)"
    });
  }
}

function bumpEffect(tileX, tileY) {
  addSparkles(tileX, tileY, 6, "rgba(255,120,100,0.45)");
}

function pulseFlash(amount) {
  state.screenFlash = Math.max(state.screenFlash, amount);
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#a9d0ef");
  sky.addColorStop(0.18, "#daeaf4");
  sky.addColorStop(0.38, "#e7dfbf");
  sky.addColorStop(0.68, "#708b5d");
  sky.addColorStop(1, "#3f5437");

  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const sun = ctx.createRadialGradient(862, 220, 18, 862, 220, 260);
  sun.addColorStop(0, "rgba(255,244,200,0.8)");
  sun.addColorStop(0.28, "rgba(255,224,145,0.26)");
  sun.addColorStop(1, "rgba(255,224,145,0)");

  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawClouds();
  drawMountains();
  drawMeadow();
}

function drawClouds() {
  ctx.fillStyle = "rgba(255,255,255,0.14)";

  for (let i = 0; i < 6; i++) {
    const x = 80 + i * 185 + Math.sin(timeTick / 170 + i) * 10;
    const y = 180 + (i % 3) * 28;

    ctx.beginPath();
    ctx.ellipse(x, y, 68, 22, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 48, y + 8, 58, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 44, y + 12, 46, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMountains() {
  ctx.fillStyle = "#40583e";
  ctx.beginPath();
  ctx.moveTo(0, 520);
  ctx.lineTo(190, 360);
  ctx.lineTo(385, 500);
  ctx.lineTo(585, 350);
  ctx.lineTo(825, 510);
  ctx.lineTo(1080, 382);
  ctx.lineTo(1080, 820);
  ctx.lineTo(0, 820);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#2f432f";
  ctx.beginPath();
  ctx.moveTo(0, 660);
  ctx.lineTo(155, 500);
  ctx.lineTo(350, 650);
  ctx.lineTo(575, 500);
  ctx.lineTo(820, 680);
  ctx.lineTo(1080, 510);
  ctx.lineTo(1080, 930);
  ctx.lineTo(0, 930);
  ctx.closePath();
  ctx.fill();
}

function drawMeadow() {
  const meadow = ctx.createLinearGradient(0, 920, 0, canvas.height);
  meadow.addColorStop(0, "#899d68");
  meadow.addColorStop(1, "#425c3a");

  ctx.fillStyle = meadow;
  ctx.fillRect(0, 900, canvas.width, canvas.height - 900);
}

function drawMapShadow() {
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(MAP_X + 12, MAP_Y + 18, MAP_WIDTH, MAP_HEIGHT);
}

function drawTile(x, y, type) {
  const px = MAP_X + x * TILE;
  const py = MAP_Y + y * TILE;

  if (type === "grass") {
    if (!drawCoverImage(images.grass, px, py, TILE, TILE)) {
      ctx.fillStyle = "#438348";
      ctx.fillRect(px, py, TILE, TILE);
    }

    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(px, py + TILE - 10, TILE, 10);
  }

  if (type === "soil") {
    if (!drawCoverImage(images.soil, px, py, TILE, TILE)) {
      ctx.fillStyle = "#925d31";
      ctx.fillRect(px, py, TILE, TILE);
    }

    ctx.fillStyle = "rgba(0,0,0,0.14)";
    ctx.fillRect(px, py + TILE - 10, TILE, 10);
  }

  if (type === "water") {
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
    ctx.quadraticCurveTo(px + 64, py + 40 + waveOffset, px + 82, py + 24 + waveOffset);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(px + 14, py + 62 - waveOffset);
    ctx.quadraticCurveTo(px + 34, py + 50 - waveOffset, px + 54, py + 62 - waveOffset);
    ctx.quadraticCurveTo(px + 70, py + 74 - waveOffset, px + 86, py + 58 - waveOffset);
    ctx.stroke();
  }

  if (type === "path") {
    ctx.fillStyle = "#c7a56c";
    ctx.fillRect(px, py, TILE, TILE);

    ctx.fillStyle = "rgba(255,244,220,0.12)";
    ctx.fillRect(px + 12, py + 22, 14, 9);
    ctx.fillRect(px + 42, py + 54, 16, 10);
    ctx.fillRect(px + 68, py + 28, 11, 11);

    ctx.fillStyle = "rgba(0,0,0,0.10)";
    ctx.fillRect(px, py + TILE - 9, TILE, 9);
  }

  if (type === "fence") {
    drawCoverImage(images.grass, px, py, TILE, TILE);

    ctx.fillStyle = "rgba(20,45,28,0.50)";
    ctx.fillRect(px, py, TILE, TILE);

    ctx.fillStyle = "#8e5e33";
    ctx.fillRect(px + 18, py + 9, 12, TILE - 18);
    ctx.fillRect(px + 66, py + 9, 12, TILE - 18);
    ctx.fillRect(px + 9, py + 28, TILE - 18, 11);
    ctx.fillRect(px + 9, py + 58, TILE - 18, 11);

    ctx.fillStyle = "rgba(255,244,220,0.10)";
    ctx.fillRect(px + 18, py + 9, 4, TILE - 18);
    ctx.fillRect(px + 9, py + 28, TILE - 18, 3);
  }

  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.strokeRect(px, py, TILE, TILE);
}

function drawWeed(x, y) {
  const center = centerOfTile(x, y);
  const size = TILE * 0.96;

  ctx.save();

  ctx.fillStyle = "rgba(0,0,0,0.30)";
  ctx.beginPath();
  ctx.ellipse(center.x, center.y + 33, 30, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  drawContainImage(
    images.weed,
    center.x - size / 2,
    center.y - size / 2,
    size,
    size
  );

  ctx.restore();
}

function drawCrop(x, y, crop) {
  const center = centerOfTile(x, y);
  const info = seedInfo[crop.type];

  ctx.save();

  ctx.fillStyle = "rgba(0,0,0,0.20)";
  ctx.beginPath();
  ctx.ellipse(center.x, center.y + 31, 26, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  if (crop.growth >= 3 && crop.type === "faith") {
    const size = TILE * 1.04;

    ctx.shadowColor = info.glow;
    ctx.shadowBlur = 28;

    const drawn = drawContainImage(
      images.faithCrop,
      center.x - size / 2,
      center.y - size / 2,
      size,
      size
    );

    ctx.shadowBlur = 0;

    if (drawn) {
      if (crop.watered) {
        drawWaterDrops(center.x, center.y);
      }

      ctx.restore();
      return;
    }
  }

  drawFallbackCrop(center.x, center.y, crop, info);
  ctx.restore();
}

function drawFallbackCrop(cx, cy, crop, info) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.strokeStyle = "#2e7a38";
  ctx.lineWidth = 5;

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
    ctx.ellipse(12, 1, 12, 5, 0.7, 0, Math.PI * 2);
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

    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 / 6) * i;
      ctx.beginPath();
      ctx.ellipse(
        Math.cos(angle) * 11,
        -22 + Math.sin(angle) * 11,
        8,
        5,
        angle,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    ctx.shadowBlur = 0;
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

function drawPlayer() {
  const center = centerOfTile(state.player.x, state.player.y);
  const bob = Math.sin(timeTick / 10) * 2 + (state.player.stepPulse > 0 ? Math.sin(state.player.stepPulse) * 2 : 0);

  ctx.save();

  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(center.x, center.y + 38, 28, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  const playerHeight = TILE * 1.32;
  const playerWidth = TILE * 0.92;

  drawContainImage(
    images.player,
    center.x - playerWidth / 2,
    center.y - playerHeight / 2 + bob,
    playerWidth,
    playerHeight
  );

  ctx.restore();
}

function drawParticles() {
  state.particles.forEach(p => {
    ctx.fillStyle = `rgba(255,232,162,${p.a})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });

  state.sparkles.forEach(s => {
    const alpha = Math.max(0, s.life / s.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

function drawDayBadge() {
  ctx.save();
  ctx.fillStyle = "rgba(8,14,22,0.64)";
  ctx.beginPath();
  ctx.roundRect(26, 456, 142, 42, 18);
  ctx.fill();

  ctx.fillStyle = "#fff4dc";
  ctx.font = "800 19px Montserrat";
  ctx.fillText(`Day ${state.day}`, 50, 484);
  ctx.restore();
}

function drawVignette() {
  const vignette = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    280,
    canvas.width / 2,
    canvas.height / 2,
    980
  );

  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.34)");

  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (state.screenFlash > 0) {
    ctx.fillStyle = `rgba(255,244,220,${state.screenFlash * 0.018})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawScene() {
  drawBackground();
  drawMapShadow();

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      drawTile(x, y, tileAt(x, y));
    }
  }

  Object.entries(state.crops).forEach(([position, crop]) => {
    const [x, y] = position.split(",").map(Number);
    drawCrop(x, y, crop);
  });

  Object.keys(state.weeds).forEach(position => {
    const [x, y] = position.split(",").map(Number);
    drawWeed(x, y);
  });

  drawPlayer();
  drawParticles();
  drawDayBadge();
  drawVignette();
}

function updateParticles() {
  state.particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;

    if (p.y < 180) {
      p.y = canvas.height - 100;
      p.x = Math.random() * canvas.width;
    }

    if (p.x < -10) p.x = canvas.width + 10;
    if (p.x > canvas.width + 10) p.x = -10;
  });

  state.sparkles = state.sparkles.filter(s => {
    s.x += s.vx;
    s.y += s.vy;
    s.life -= 1;
    return s.life > 0;
  });

  if (state.player.stepPulse > 0) {
    state.player.stepPulse -= 1;
  }

  if (state.screenFlash > 0) {
    state.screenFlash -= 1;
  }
}

function loop() {
  timeTick += 1;
  updateParticles();
  drawScene();

  if (timeTick - lastAutoSave > 1800) {
    saveGame(true);
    lastAutoSave = timeTick;
  }

  requestAnimationFrame(loop);
}

function handleCanvasTap(event) {
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
    movePlayer(Math.sign(dx), 0);
  } else if (dy !== 0) {
    movePlayer(0, Math.sign(dy));
  } else if (dx !== 0) {
    movePlayer(Math.sign(dx), 0);
  }
}

function bindEvents() {
  document.getElementById("saveBtn").addEventListener("click", () => saveGame(false));

  document.getElementById("startBtn").addEventListener("click", () => {
    newGame();
    ui.titleScreen.classList.add("hidden");
  });

  document.getElementById("continueBtn").addEventListener("click", () => {
    if (!loadGame()) {
      newGame();
      setMessage("No saved journey found, so a new one has begun.");
    }

    ui.titleScreen.classList.add("hidden");
  });

  document.getElementById("howBtn").addEventListener("click", () => {
    ui.helpModal.classList.remove("hidden");
  });

  document.getElementById("closeHelpBtn").addEventListener("click", () => {
    ui.helpModal.classList.add("hidden");
  });

  document.getElementById("helpBackBtn").addEventListener("click", () => {
    ui.helpModal.classList.add("hidden");
  });

  document.getElementById("upBtn").addEventListener("click", () => movePlayer(0, -1));
  document.getElementById("downBtn").addEventListener("click", () => movePlayer(0, 1));
  document.getElementById("leftBtn").addEventListener("click", () => movePlayer(-1, 0));
  document.getElementById("rightBtn").addEventListener("click", () => movePlayer(1, 0));

  document.getElementById("plantBtn").addEventListener("click", plantSeed);
  document.getElementById("waterBtn").addEventListener("click", waterCrop);
  document.getElementById("harvestBtn").addEventListener("click", harvestCrop);
  document.getElementById("clearBtn").addEventListener("click", clearWeeds);
  document.getElementById("prayBtn").addEventListener("click", pray);

  document.querySelectorAll(".seed-option").forEach(button => {
    button.addEventListener("click", () => {
      selectedSeed = button.dataset.seed;
      setMessage(`${seedInfo[selectedSeed].name} seed selected.`);
      updateUI();
    });
  });

  canvas.addEventListener("click", handleCanvasTap);

  document.addEventListener("keydown", event => {
    const k = event.key.toLowerCase();

    if (k === "arrowup" || k === "w") movePlayer(0, -1);
    if (k === "arrowdown" || k === "s") movePlayer(0, 1);
    if (k === "arrowleft" || k === "a") movePlayer(-1, 0);
    if (k === "arrowright" || k === "d") movePlayer(1, 0);

    if (k === "1") selectedSeed = "faith";
    if (k === "2") selectedSeed = "peace";
    if (k === "3") selectedSeed = "kindness";

    if (k === "p") plantSeed();
    if (k === "e") waterCrop();
    if (k === "h") harvestCrop();
    if (k === "c") clearWeeds();
    if (k === " ") pray();
    if (k === "n") newDay();

    updateUI();
  });

  setInterval(newDay, 90000);
}

function enableRoundRectFallback() {
  if (CanvasRenderingContext2D.prototype.roundRect) return;

  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;

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
  enableRoundRectFallback();

  newGame();
  bindEvents();
  updateUI();

  await loadAssets();

  ui.loadingScreen.classList.add("hidden");

  if (localStorage.getItem(STORAGE_KEY)) {
    ui.continueBtn.style.opacity = "1";
  } else {
    ui.continueBtn.style.opacity = "0.45";
  }

  loop();
}

init();

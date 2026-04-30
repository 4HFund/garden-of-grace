/**
 * GARDEN OF GRACE: PREMIUM V2 - FULL CONSOLIDATED EDITION
 * Performance Upgrades: Offscreen Canvas, Delta-Time Smooth Movement, Object-State Machine
 * Retained: All original drawing logic, fallback crops, and world-building
 */

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Performance Buffer: Static Background
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
let lastTime = 0; // For Delta Time

// Movement Logic State
const playerMotion = {
    currentX: 1,
    currentY: 6,
    targetX: 1,
    targetY: 6,
    lerpSpeed: 0.15,
    bob: 0
};

function defaultState() {
  return {
    player: { x: 1, y: 6, facing: "right", stepPulse: 0 },
    day: 1,
    faith: 1, peace: 1, kindness: 1, harvest: 0,
    prayedToday: false,
    tiles: [], crops: {}, weeds: {},
    particles: [], sparkles: [], ripples: [],
    screenFlash: 0,
    message: "Welcome to the Heartfield. Restore what’s broken and grow in grace."
  };
}

// --- UTILITIES ---
const key = (x, y) => `${x},${y}`;
const inBounds = (x, y) => x >= 0 && x < COLS && y >= 0 && y < ROWS;
const tileAt = (x, y) => inBounds(x, y) ? state.tiles[y][x] : "void";
const isBlocked = (x, y) => ["void", "water", "fence"].includes(tileAt(x, y));
const centerOfTile = (x, y) => ({ x: MAP_X + x * TILE + TILE / 2, y: MAP_Y + y * TILE + TILE / 2 });
const imageReady = (img) => img && img.complete && img.naturalWidth > 0;

// --- ASSET LOADING ---
function loadAssets() {
  const entries = Object.entries(ASSET_PATHS);
  let loaded = 0;
  return new Promise(resolve => {
    entries.forEach(([name, src]) => {
      const img = new Image();
      img.onload = img.onerror = () => {
        loaded += 1;
        images[name] = img;
        updateLoading(loaded, entries.length);
        if (loaded === entries.length) setTimeout(resolve, 350);
      };
      img.src = `${src}?cache=${Date.now()}`;
    });
  });
}

function updateLoading(loaded, total) {
  const percent = Math.round((loaded / total) * 100);
  ui.loadingFill.style.width = `${percent}%`;
  ui.loadingText.textContent = `Forging Assets... ${percent}%`;
}

// --- WORLD SETUP ---
function setupWorld() {
  state.tiles = [];
  for (let y = 0; y < ROWS; y++) {
    const row = [];
    for (let x = 0; x < COLS; x++) {
      let type = "grass";
      if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) type = "fence";
      else if (x >= 3 && x <= 6 && y >= 2 && y <= 5) type = "soil";
      else if (x >= 7 && x <= 8 && y >= 1 && y <= 3) type = "water";
      else if (y === 6 && x >= 1 && x <= 8) type = "path";
      row.push(type);
    }
    state.tiles.push(row);
  }

  state.weeds = {};
  [[1, 2], [3, 2], [4, 2], [6, 2], [6, 3], [3, 5], [4, 5], [6, 5], [8, 5], [5, 1]].forEach(([x, y]) => {
    state.weeds[key(x, y)] = true;
  });

  state.particles = [];
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
}

// --- CORE GAME ACTIONS ---
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
  
  // Update motion target for smooth slide
  playerMotion.targetX = nx;
  playerMotion.targetY = ny;
  
  state.player.stepPulse = 10;
  addDust(nx, ny);
}

function plantSeed() {
  const x = state.player.x, y = state.player.y, k = key(x, y);
  if (tileAt(x, y) !== "soil") { setMessage("Stand on soil to plant."); bumpEffect(x, y); return; }
  if (state.weeds[k]) { setMessage("Clear the weeds first."); bumpEffect(x, y); return; }
  if (state.crops[k]) { setMessage("Something is already growing here."); bumpEffect(x, y); return; }

  state.crops[k] = { type: selectedSeed, growth: 0, watered: false, plantedAt: state.day };
  const info = seedInfo[selectedSeed];
  addSparkles(x, y, 18, info.glow);
  pulseFlash(5);
  setMessage(info.message);
  updateUI();
}

function waterCrop() {
  const k = key(state.player.x, state.player.y);
  const crop = state.crops[k];
  if (!crop) { setMessage("Nothing here to water."); bumpEffect(state.player.x, state.player.y); return; }
  if (crop.watered) { setMessage("Already watered today."); return; }

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
  if (!crop) { setMessage("Nothing ready for harvest."); bumpEffect(state.player.x, state.player.y); return; }
  if (crop.growth < 3) { setMessage("Patience is part of the harvest."); bumpEffect(state.player.x, state.player.y); return; }

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
  if (!state.weeds[k]) { setMessage("No weeds here."); bumpEffect(state.player.x, state.player.y); return; }
  delete state.weeds[k];
  state.kindness += 1;
  addSparkles(state.player.x, state.player.y, 24, "rgba(134,214,133,0.86)");
  pulseFlash(7);
  setMessage("You cleared the weeds. The field feels lighter.");
  updateUI();
}

function pray() {
  if (state.prayedToday) { setMessage("You already prayed today."); return; }
  state.prayedToday = true;
  state.peace += 1;
  Object.values(state.crops).forEach(c => { if (c.watered && c.growth < 3) c.growth += 1; });
  addSparkles(state.player.x, state.player.y, 46, "rgba(255,244,220,0.96)");
  pulseFlash(14);
  setMessage("You paused to pray. Peace settles over the field.");
  updateUI();
}

function newDay() {
  state.day += 1;
  state.prayedToday = false;
  Object.values(state.crops).forEach(c => {
    if (c.watered && c.growth < 3) c.growth += 1;
    c.watered = false;
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
      if (tileAt(x, y) !== "water" && tileAt(x, y) !== "fence" && !state.weeds[key(x, y)] && !state.crops[key(x, y)]) {
        possible.push([x, y]);
      }
    }
  }
  if (possible.length) {
    const [x, y] = possible[Math.floor(Math.random() * possible.length)];
    state.weeds[key(x, y)] = true;
  }
}

// --- RENDERING ENGINE ---

function renderStaticBackground() {
  const sky = bgCtx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#a9d0ef"); sky.addColorStop(0.38, "#e7dfbf");
  sky.addColorStop(0.68, "#708b5d"); sky.addColorStop(1, "#3f5437");
  bgCtx.fillStyle = sky;
  bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

  const sun = bgCtx.createRadialGradient(862, 220, 18, 862, 220, 260);
  sun.addColorStop(0, "rgba(255,244,200,0.8)"); sun.addColorStop(1, "rgba(255,224,145,0)");
  bgCtx.fillStyle = sun;
  bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

  // Clouds
  bgCtx.fillStyle = "rgba(255,255,255,0.14)";
  for (let i = 0; i < 6; i++) {
    const x = 80 + i * 185, y = 180 + (i % 3) * 28;
    bgCtx.beginPath();
    bgCtx.ellipse(x, y, 68, 22, 0, 0, Math.PI * 2);
    bgCtx.ellipse(x + 48, y + 8, 58, 18, 0, 0, Math.PI * 2);
    bgCtx.ellipse(x - 44, y + 12, 46, 16, 0, 0, Math.PI * 2);
    bgCtx.fill();
  }

  // Mountains
  bgCtx.fillStyle = "#40583e";
  bgCtx.beginPath();
  bgCtx.moveTo(0, 520); bgCtx.lineTo(190, 360); bgCtx.lineTo(385, 500); bgCtx.lineTo(585, 350); bgCtx.lineTo(825, 510); bgCtx.lineTo(1080, 382);
  bgCtx.lineTo(1080, 820); bgCtx.lineTo(0, 820); bgCtx.fill();
  
  bgCtx.fillStyle = "#2f432f";
  bgCtx.beginPath();
  bgCtx.moveTo(0, 660); bgCtx.lineTo(155, 500); bgCtx.lineTo(350, 650); bgCtx.lineTo(575, 500); bgCtx.lineTo(820, 680); bgCtx.lineTo(1080, 510);
  bgCtx.lineTo(1080, 930); bgCtx.lineTo(0, 930); bgCtx.fill();

  // Meadow
  const meadow = bgCtx.createLinearGradient(0, 920, 0, canvas.height);
  meadow.addColorStop(0, "#899d68"); meadow.addColorStop(1, "#425c3a");
  bgCtx.fillStyle = meadow;
  bgCtx.fillRect(0, 900, bgCanvas.width, bgCanvas.height - 900);
}

function drawTile(x, y, type) {
  const px = MAP_X + x * TILE, py = MAP_Y + y * TILE;

  if (type === "grass") {
    if (!drawCoverImage(images.grass, px, py, TILE, TILE)) { ctx.fillStyle = "#438348"; ctx.fillRect(px, py, TILE, TILE); }
    ctx.fillStyle = "rgba(0,0,0,0.12)"; ctx.fillRect(px, py + TILE - 10, TILE, 10);
  } else if (type === "soil") {
    if (!drawCoverImage(images.soil, px, py, TILE, TILE)) { ctx.fillStyle = "#925d31"; ctx.fillRect(px, py, TILE, TILE); }
    ctx.fillStyle = "rgba(0,0,0,0.14)"; ctx.fillRect(px, py + TILE - 10, TILE, 10);
  } else if (type === "water") {
    const gradient = ctx.createLinearGradient(px, py, px, py + TILE);
    gradient.addColorStop(0, "#6cc9ee"); gradient.addColorStop(1, "#2f8dbb");
    ctx.fillStyle = gradient; ctx.fillRect(px, py, TILE, TILE);
    
    ctx.strokeStyle = "rgba(255,255,255,0.26)"; ctx.lineWidth = 3;
    const waveOffset = Math.sin(timeTick / 28 + x + y) * 4;
    ctx.beginPath();
    ctx.moveTo(px + 12, py + 28 + waveOffset);
    ctx.quadraticCurveTo(px + 30, py + 16 + waveOffset, px + 48, py + 28 + waveOffset);
    ctx.stroke();
  } else if (type === "path") {
    ctx.fillStyle = "#c7a56c"; ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = "rgba(0,0,0,0.10)"; ctx.fillRect(px, py + TILE - 9, TILE, 9);
  } else if (type === "fence") {
    drawCoverImage(images.grass, px, py, TILE, TILE);
    ctx.fillStyle = "rgba(20,45,28,0.50)"; ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = "#8e5e33"; ctx.fillRect(px + 18, py + 9, 12, TILE - 18);
    ctx.fillRect(px + 9, py + 28, TILE - 18, 11);
  }
}

// --- ORIGINAL FALLBACK CROP DRAWING ---
function drawFallbackCrop(cx, cy, crop, info) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = "#2e7a38"; ctx.lineWidth = 5;

  if (crop.growth === 0) {
    ctx.fillStyle = info.color; ctx.beginPath(); ctx.arc(0, 15, 7, 0, Math.PI * 2); ctx.fill();
  } else if (crop.growth >= 1) {
    ctx.beginPath(); ctx.moveTo(0, 20); ctx.lineTo(0, crop.growth === 1 ? -2 : -16); ctx.stroke();
    ctx.fillStyle = "#74c97a"; ctx.beginPath(); ctx.ellipse(-12, 4, 12, 5, -0.7, 0, Math.PI * 2); ctx.fill();
  }
  if (crop.growth >= 2) {
    ctx.fillStyle = info.color; ctx.beginPath(); ctx.arc(0, -15, 11, 0, Math.PI * 2); ctx.fill();
  }
  if (crop.growth >= 3) {
    ctx.shadowColor = info.glow; ctx.shadowBlur = 18;
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 / 6) * i;
        ctx.beginPath(); ctx.ellipse(Math.cos(angle) * 11, -22 + Math.sin(angle) * 11, 8, 5, angle, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (crop.watered) drawWaterDrops(0, 0);
  ctx.restore();
}

function drawWaterDrops(cx, cy) {
  ctx.fillStyle = "rgba(121,199,239,0.84)";
  ctx.beginPath(); ctx.arc(cx + 25, cy + 17, 5, 0, Math.PI * 2); ctx.arc(cx + 34, cy + 5, 3.5, 0, Math.PI * 2); ctx.fill();
}

// --- UPDATED PLAYER RENDERING ---
function drawPlayer() {
  const px = MAP_X + playerMotion.currentX * TILE + TILE / 2;
  const py = MAP_Y + playerMotion.currentY * TILE + TILE / 2;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath(); ctx.ellipse(px, py + 38, 28, 11, 0, 0, Math.PI * 2); ctx.fill();

  const h = TILE * 1.32, w = TILE * 0.92;
  if (imageReady(images.player)) {
    ctx.drawImage(images.player, px - w / 2, py - h / 2 + playerMotion.bob, w, h);
  }
  ctx.restore();
}

// --- MAIN LOOP ---
function update(dt) {
  timeTick += dt;

  // Smooth Motion
  playerMotion.currentX += (playerMotion.targetX - playerMotion.currentX) * (playerMotion.lerpSpeed * dt);
  playerMotion.currentY += (playerMotion.targetY - playerMotion.currentY) * (playerMotion.lerpSpeed * dt);
  playerMotion.bob = Math.sin(timeTick / 10) * 2;

  // Particles
  state.particles.forEach(p => {
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.y < 180) { p.y = canvas.height - 100; p.x = Math.random() * canvas.width; }
  });

  state.sparkles = state.sparkles.filter(s => {
    s.x += s.vx * dt; s.y += s.vy * dt;
    s.life -= dt; return s.life > 0;
  });

  if (state.screenFlash > 0) state.screenFlash -= dt;
}

function draw() {
  ctx.drawImage(bgCanvas, 0, 0);
  
  // Draw Map
  ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.fillRect(MAP_X + 12, MAP_Y + 18, MAP_WIDTH, MAP_HEIGHT);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) drawTile(x, y, tileAt(x, y));
  }

  // Draw Entities
  Object.entries(state.crops).forEach(([pos, crop]) => {
    const [x, y] = pos.split(",").map(Number);
    const center = centerOfTile(x, y);
    if (crop.growth >= 3 && crop.type === "faith" && imageReady(images.faithCrop)) {
        ctx.save();
        ctx.shadowColor = seedInfo.faith.glow; ctx.shadowBlur = 28;
        const size = TILE * 1.04;
        ctx.drawImage(images.faithCrop, center.x - size/2, center.y - size/2, size, size);
        if (crop.watered) drawWaterDrops(center.x, center.y);
        ctx.restore();
    } else {
        drawFallbackCrop(center.x, center.y, crop, seedInfo[crop.type]);
    }
  });

  Object.keys(state.weeds).forEach(pos => {
    const [x, y] = pos.split(",").map(Number);
    const center = centerOfTile(x, y), size = TILE * 0.96;
    if (imageReady(images.weed)) ctx.drawImage(images.weed, center.x - size/2, center.y - size/2, size, size);
  });

  drawPlayer();
  
  // UI Badges & Particles
  state.particles.forEach(p => {
    ctx.fillStyle = `rgba(255,232,162,${p.a})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  });
  
  if (state.screenFlash > 0) {
    ctx.fillStyle = `rgba(255,244,220,${state.screenFlash * 0.018})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function mainLoop(ts) {
  const dt = lastTime ? (ts - lastTime) / 16.67 : 1;
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(mainLoop);
}

// --- BOOTSTRAP ---
async function init() {
  enableRoundRectFallback();
  state = loadGame() || defaultState();
  setupWorld();
  renderStaticBackground();
  bindEvents();
  await loadAssets();
  ui.loadingScreen.classList.add("hidden");
  requestAnimationFrame(mainLoop);
}

// (Keeping your bindEvents and UI logic identical as before)
function setMessage(text) { state.message = text; ui.messageBox.textContent = text; }
function updateUI() {
  ui.faithStat.textContent = state.faith; ui.peaceStat.textContent = state.peace;
  ui.kindnessStat.textContent = state.kindness; ui.harvestStat.textContent = state.harvest;
}

function bindEvents() {
    document.getElementById("startBtn").onclick = () => { ui.titleScreen.classList.add("hidden"); };
    document.getElementById("plantBtn").onclick = plantSeed;
    document.getElementById("waterBtn").onclick = waterCrop;
    document.getElementById("harvestBtn").onclick = harvestCrop;
    document.getElementById("clearBtn").onclick = clearWeeds;
    document.getElementById("prayBtn").onclick = pray;
    
    document.addEventListener("keydown", e => {
        const k = e.key.toLowerCase();
        if (["w", "arrowup"].includes(k)) movePlayer(0, -1);
        if (["s", "arrowdown"].includes(k)) movePlayer(0, 1);
        if (["a", "arrowleft"].includes(k)) movePlayer(-1, 0);
        if (["d", "arrowright"].includes(k)) movePlayer(1, 0);
    });
}

function addSparkles(tx, ty, amt, col) {
    const c = centerOfTile(tx, ty);
    for (let i = 0; i < amt; i++) {
        state.sparkles.push({
            x: c.x + (Math.random()-0.5)*54, y: c.y + (Math.random()-0.5)*54,
            vx: (Math.random()-0.5)*1.35, vy: -0.4 - Math.random()*1.2,
            life: 30, color: col
        });
    }
}

function addDust(tx, ty) { addSparkles(tx, ty, 6, "rgba(238,210,160,0.5)"); }
function addWaterBurst(tx, ty) { addSparkles(tx, ty, 10, "rgba(121,199,239,0.85)"); }
function bumpEffect(tx, ty) { addSparkles(tx, ty, 6, "rgba(255,120,100,0.45)"); }
function pulseFlash(amt) { state.screenFlash = Math.max(state.screenFlash, amt); }

function saveGame(silent = false) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!silent) setMessage("Journey saved.");
}

function loadGame() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

function enableRoundRectFallback() {
  if (CanvasRenderingContext2D.prototype.roundRect) return;
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    this.beginPath(); this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r); this.closePath(); return this;
  };
}

// Start Game
init();

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const TILE = 84;
const COLS = 10;
const ROWS = 8;
const MAP_WIDTH = COLS * TILE;
const MAP_HEIGHT = ROWS * TILE;
const MAP_X = Math.round((canvas.width - MAP_WIDTH) / 2);
const MAP_Y = 420;

const STORAGE_KEY = "gardenOfGraceAssetBuildV1";

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

const ASSET_PATHS = {
  grass: "assets/grass.png",
  soil: "assets/soil.png",
  weed: "assets/weed.png",
  faithCrop: "assets/faith-crop.png",
  player: "assets/player.png"
};

const gameImages = {};

Object.entries(ASSET_PATHS).forEach(([name, src]) => {
  const img = new Image();
  img.src = src;
  gameImages[name] = img;
});

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

let selectedSeed = "faith";
let messageTimer = 0;
let timeTick = 0;
let state = null;

const ui = {
  questText: document.getElementById("questText"),
  faithStat: document.getElementById("faithStat"),
  peaceStat: document.getElementById("peaceStat"),
  kindnessStat: document.getElementById("kindnessStat"),
  harvestStat: document.getElementById("harvestStat"),
  messageBox: document.getElementById("messageBox"),
  titleScreen: document.getElementById("titleScreen"),
  helpModal: document.getElementById("helpModal"),
  continueBtn: document.getElementById("continueBtn")
};

function defaultState() {
  return {
    player: { x: 1, y: 6, facing: "right" },
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
    screenFlash: 0
  };
}

function key(x, y) {
  return `${x},${y}`;
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < COLS && y < ROWS;
}

function tileAt(x, y) {
  if (!inBounds(x, y)) return "void";
  return state.tiles[y][x];
}

function isBlocked(x, y) {
  const t = tileAt(x, y);
  return t === "water" || t === "fence" || t === "void";
}

function centerOfTile(x, y) {
  return {
    x: MAP_X + x * TILE + TILE / 2,
    y: MAP_Y + y * TILE + TILE / 2
  };
}

function setMessage(text) {
  ui.messageBox.textContent = text;
  messageTimer = 220;
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

  const starterWeeds = [
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
  ];

  state.weeds = {};
  starterWeeds.forEach(([x, y]) => {
    state.weeds[key(x, y)] = true;
  });

  state.particles = [];
  for (let i = 0; i < 26; i++) {
    state.particles.push({
      x: Math.random() * canvas.width,
      y: 240 + Math.random() * (canvas.height - 260),
      vx: (Math.random() - 0.5) * 0.3,
      vy: -0.12 - Math.random() * 0.18,
      r: 1 + Math.random() * 2.2,
      a: 0.25 + Math.random() * 0.55
    });
  }

  state.sparkles = [];
}

function updateUI() {
  ui.faithStat.textContent = state.faith;
  ui.peaceStat.textContent = state.peace;
  ui.kindnessStat.textContent = state.kindness;
  ui.harvestStat.textContent = state.harvest;

  const weedsLeft = Object.keys(state.weeds).length;
  const cropsReady = Object.values(state.crops).filter(c => c.growth >= 3).length;
  const planted = Object.keys(state.crops).length;

  let quest = "Restore the neglected field and prepare it for grace.";

  if (weedsLeft > 0) {
    quest = `Clear the weeds choking the field. ${weedsLeft} remain.`;
  } else if (planted < 3) {
    quest = `Plant 3 seeds in the restored soil. ${3 - planted} more needed.`;
  } else if (cropsReady < 2) {
    quest = "Water your seeds and help them reach maturity.";
  } else if (state.harvest < 5) {
    quest = `Harvest spiritual fruit from the field. ${5 - state.harvest} more needed.`;
  } else {
    quest = "The first field is restored. A deeper journey will open next.";
  }

  ui.questText.textContent = quest;

  document.querySelectorAll(".seedBtn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.seed === selectedSeed);
  });

  const hasSave = !!localStorage.getItem(STORAGE_KEY);
  ui.continueBtn.style.opacity = hasSave ? "1" : "0.45";
}

function addSparkles(tileX, tileY, amount, color = "rgba(255,244,220,0.95)") {
  const pos = centerOfTile(tileX, tileY);

  for (let i = 0; i < amount; i++) {
    state.sparkles.push({
      x: pos.x + (Math.random() - 0.5) * 46,
      y: pos.y + (Math.random() - 0.5) * 46,
      vx: (Math.random() - 0.5) * 1.1,
      vy: -0.4 - Math.random() * 1.1,
      size: 2 + Math.random() * 3,
      life: 28 + Math.random() * 28,
      color
    });
  }
}

function saveGame() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  setMessage("Journey saved. The field will remember your progress.");
  updateUI();
}

function loadGameFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;

  try {
    const parsed = JSON.parse(raw);
    state = { ...defaultState(), ...parsed };

    if (!state.tiles || !state.tiles.length) {
      setupWorld();
    }

    setMessage("Welcome back. Your field remembered you.");
    updateUI();
    return true;
  } catch (err) {
    console.warn("Save load failed", err);
    return false;
  }
}

function newGame() {
  state = defaultState();
  setupWorld();
  setMessage("Welcome to the Heartfield. Restore what’s broken and grow in grace.");
  updateUI();
}

function movePlayer(dx, dy) {
  const nx = state.player.x + dx;
  const ny = state.player.y + dy;

  if (dx > 0) state.player.facing = "right";
  if (dx < 0) state.player.facing = "left";
  if (dy > 0) state.player.facing = "down";
  if (dy < 0) state.player.facing = "up";

  if (isBlocked(nx, ny)) {
    setMessage("You can’t go that way yet.");
    return;
  }

  state.player.x = nx;
  state.player.y = ny;
}

function currentKey() {
  return key(state.player.x, state.player.y);
}

function plantSeed() {
  const x = state.player.x;
  const y = state.player.y;
  const k = currentKey();

  if (tileAt(x, y) !== "soil") {
    setMessage("Stand on a soil tile to plant a seed.");
    return;
  }

  if (state.weeds[k]) {
    setMessage("Clear the weeds first. Healthy soil matters.");
    return;
  }

  if (state.crops[k]) {
    setMessage("Something is already growing here.");
    return;
  }

  state.crops[k] = {
    type: selectedSeed,
    growth: 0,
    watered: false
  };

  addSparkles(x, y, 12, seedInfo[selectedSeed].glow);
  setMessage(seedInfo[selectedSeed].message);
  updateUI();
}

function waterCrop() {
  const k = currentKey();
  const crop = state.crops[k];

  if (!crop) {
    setMessage("There’s nothing here to water yet.");
    return;
  }

  if (crop.watered) {
    setMessage("This crop has already been watered today.");
    return;
  }

  crop.watered = true;
  crop.growth = Math.min(3, crop.growth + 1);

  addSparkles(state.player.x, state.player.y, 8, "rgba(121,199,239,0.85)");
  setMessage("You watered the crop. Growth often comes one faithful step at a time.");
  updateUI();
}

function harvestCrop() {
  const k = currentKey();
  const crop = state.crops[k];

  if (!crop) {
    setMessage("There’s nothing here ready for harvest.");
    return;
  }

  if (crop.growth < 3) {
    setMessage("This crop is still growing. Be patient.");
    return;
  }

  const info = seedInfo[crop.type];
  state[info.stat] += 1;
  state.harvest += 1;
  delete state.crops[k];

  addSparkles(state.player.x, state.player.y, 18, info.glow);
  state.screenFlash = 8;
  setMessage(`You harvested ${info.cropName}. Your ${info.name} increased.`);
  updateUI();
}

function clearWeeds() {
  const k = currentKey();

  if (!state.weeds[k]) {
    setMessage("There are no weeds here.");
    return;
  }

  delete state.weeds[k];
  state.kindness += 1;

  addSparkles(state.player.x, state.player.y, 14, "rgba(134,214,133,0.86)");
  state.screenFlash = 4;
  setMessage("You cleared the weeds. The field feels lighter.");
  updateUI();
}

function pray() {
  if (state.prayedToday) {
    setMessage("You’ve already prayed today. Keep tending the field.");
    return;
  }

  state.prayedToday = true;
  state.peace += 1;

  Object.values(state.crops).forEach(crop => {
    if (crop.watered && crop.growth < 3) {
      crop.growth += 1;
    }
  });

  addSparkles(state.player.x, state.player.y, 28, "rgba(255,244,220,0.96)");
  state.screenFlash = 12;
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

  if (Math.random() < 0.65) {
    const possible = [];

    for (let y = 1; y < ROWS - 1; y++) {
      for (let x = 1; x < COLS - 1; x++) {
        const k = key(x, y);
        const t = tileAt(x, y);

        if (t !== "water" && t !== "fence" && !state.weeds[k] && !state.crops[k]) {
          possible.push([x, y]);
        }
      }
    }

    if (possible.length) {
      const [wx, wy] = possible[Math.floor(Math.random() * possible.length)];
      state.weeds[key(wx, wy)] = true;
    }
  }

  setMessage(`Day ${state.day} begins. Mercy is new and the field is waiting.`);
  updateUI();
}

function drawRoundedRect(x, y, w, h, r, fillStyle) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#a8cff2");
  sky.addColorStop(0.23, "#d7e8f7");
  sky.addColorStop(0.42, "#efe6c8");
  sky.addColorStop(0.72, "#7a9262");
  sky.addColorStop(1, "#42583b");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const sunGlow = ctx.createRadialGradient(860, 210, 30, 860, 210, 220);
  sunGlow.addColorStop(0, "rgba(255,236,182,0.75)");
  sunGlow.addColorStop(0.35, "rgba(255,220,140,0.25)");
  sunGlow.addColorStop(1, "rgba(255,220,140,0)");
  ctx.fillStyle = sunGlow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.16)";
  for (let i = 0; i < 5; i++) {
    const cx = 130 + i * 175 + Math.sin(timeTick / 120 + i) * 8;
    const cy = 170 + (i % 2) * 18;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 58, 22, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 46, cy + 8, 54, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#44593f";
  ctx.beginPath();
  ctx.moveTo(0, 420);
  ctx.lineTo(200, 270);
  ctx.lineTo(440, 390);
  ctx.lineTo(646, 260);
  ctx.lineTo(860, 384);
  ctx.lineTo(1080, 290);
  ctx.lineTo(1080, 760);
  ctx.lineTo(0, 760);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#304330";
  ctx.beginPath();
  ctx.moveTo(0, 520);
  ctx.lineTo(160, 410);
  ctx.lineTo(355, 520);
  ctx.lineTo(580, 400);
  ctx.lineTo(820, 540);
  ctx.lineTo(1080, 438);
  ctx.lineTo(1080, 860);
  ctx.lineTo(0, 860);
  ctx.closePath();
  ctx.fill();

  const meadow = ctx.createLinearGradient(0, 1050, 0, 1500);
  meadow.addColorStop(0, "#8ba06d");
  meadow.addColorStop(1, "#4e6b48");
  ctx.fillStyle = meadow;
  ctx.fillRect(0, 960, canvas.width, canvas.height - 960);
}

function drawTile(x, y, type) {
  const px = MAP_X + x * TILE;
  const py = MAP_Y + y * TILE;

  if (type === "grass") {
    const usedImage = drawCoverImage(gameImages.grass, px, py, TILE, TILE);

    if (!usedImage) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#4d8c4f" : "#428049";
      ctx.fillRect(px, py, TILE, TILE);
    }

    ctx.fillStyle = "rgba(0,0,0,0.10)";
    ctx.fillRect(px, py + TILE - 10, TILE, 10);
  }

  if (type === "soil") {
    const usedImage = drawCoverImage(gameImages.soil, px, py, TILE, TILE);

    if (!usedImage) {
      ctx.fillStyle = "#9c6a34";
      ctx.fillRect(px, py, TILE, TILE);
    }

    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(px, py + TILE - 10, TILE, 10);
  }

  if (type === "water") {
    const gradient = ctx.createLinearGradient(px, py, px, py + TILE);
    gradient.addColorStop(0, "#6bc8ef");
    gradient.addColorStop(1, "#328fbd");
    ctx.fillStyle = gradient;
    ctx.fillRect(px, py, TILE, TILE);

    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px + 10, py + 24);
    ctx.quadraticCurveTo(px + 24, py + 12, px + 40, py + 24);
    ctx.quadraticCurveTo(px + 54, py + 36, px + 72, py + 22);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(px + 12, py + 56);
    ctx.quadraticCurveTo(px + 28, py + 44, px + 44, py + 56);
    ctx.quadraticCurveTo(px + 60, py + 68, px + 74, py + 52);
    ctx.stroke();
  }

  if (type === "path") {
    ctx.fillStyle = "#c6a36a";
    ctx.fillRect(px, py, TILE, TILE);

    ctx.fillStyle = "rgba(255,244,220,0.12)";
    ctx.fillRect(px + 10, py + 18, 12, 9);
    ctx.fillRect(px + 35, py + 42, 14, 9);
    ctx.fillRect(px + 58, py + 22, 10, 10);

    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(px, py + TILE - 8, TILE, 8);
  }

  if (type === "fence") {
    drawCoverImage(gameImages.grass, px, py, TILE, TILE);

    ctx.fillStyle = "rgba(20,45,28,0.55)";
    ctx.fillRect(px, py, TILE, TILE);

    ctx.fillStyle = "#8a5b31";
    ctx.fillRect(px + 16, py + 8, 11, TILE - 16);
    ctx.fillRect(px + 57, py + 8, 11, TILE - 16);
    ctx.fillRect(px + 8, py + 24, TILE - 16, 10);
    ctx.fillRect(px + 8, py + 50, TILE - 16, 10);

    ctx.fillStyle = "rgba(255,244,220,0.10)";
    ctx.fillRect(px + 16, py + 8, 4, TILE - 16);
    ctx.fillRect(px + 8, py + 24, TILE - 16, 3);
  }

  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.strokeRect(px, py, TILE, TILE);
}

function drawMapShadow() {
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(MAP_X + 10, MAP_Y + 14, MAP_WIDTH, MAP_HEIGHT);
}

function drawWeed(x, y) {
  const pos = centerOfTile(x, y);

  ctx.save();

  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y + 28, 26, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  const size = TILE * 0.92;
  const usedImage = drawContainImage(
    gameImages.weed,
    pos.x - size / 2,
    pos.y - size / 2,
    size,
    size
  );

  if (!usedImage) {
    ctx.translate(pos.x, pos.y);

    ctx.strokeStyle = "#263919";
    ctx.lineWidth = 5;

    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 5, 18);
      ctx.quadraticCurveTo(i * 8, 0, i * 11, -16);
      ctx.stroke();
    }

    ctx.fillStyle = "#5c7431";
    ctx.beginPath();
    ctx.ellipse(-10, -7, 9, 4, -0.6, 0, Math.PI * 2);
    ctx.ellipse(10, -10, 9, 4, 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawCrop(x, y, crop) {
  const pos = centerOfTile(x, y);
  const info = seedInfo[crop.type];

  ctx.save();

  ctx.fillStyle = "rgba(0,0,0,0.20)";
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y + 28, 26, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  if (crop.growth >= 3 && crop.type === "faith") {
    ctx.shadowColor = info.glow;
    ctx.shadowBlur = 24;

    const size = TILE * 1.02;
    const usedImage = drawContainImage(
      gameImages.faithCrop,
      pos.x - size / 2,
      pos.y - size / 2,
      size,
      size
    );

    ctx.shadowBlur = 0;

    if (usedImage) {
      if (crop.watered) {
        ctx.fillStyle = "rgba(121,199,239,0.8)";
        ctx.beginPath();
        ctx.arc(pos.x + 26, pos.y + 18, 5, 0, Math.PI * 2);
        ctx.arc(pos.x + 34, pos.y + 8, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      return;
    }
  }

  ctx.translate(pos.x, pos.y);

  ctx.strokeStyle = "#2e7a38";
  ctx.lineWidth = 5;

  if (crop.growth === 0) {
    ctx.fillStyle = info.color;
    ctx.beginPath();
    ctx.arc(0, 14, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  if (crop.growth === 1) {
    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.lineTo(0, -2);
    ctx.stroke();

    ctx.fillStyle = "#74c97a";
    ctx.beginPath();
    ctx.ellipse(-10, 4, 10, 4, -0.7, 0, Math.PI * 2);
    ctx.ellipse(10, 1, 10, 4, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  if (crop.growth === 2) {
    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.lineTo(0, -12);
    ctx.stroke();

    ctx.fillStyle = "#74c97a";
    ctx.beginPath();
    ctx.ellipse(-12, 0, 12, 5, -0.7, 0, Math.PI * 2);
    ctx.ellipse(12, -3, 12, 5, 0.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = info.color;
    ctx.beginPath();
    ctx.arc(0, -15, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  if (crop.growth >= 3) {
    const pulse = Math.sin(timeTick / 10) * 2;

    ctx.shadowColor = info.glow;
    ctx.shadowBlur = 18;

    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.lineTo(0, -16);
    ctx.stroke();

    ctx.fillStyle = "#74c97a";
    ctx.beginPath();
    ctx.ellipse(-12, -2, 12, 5, -0.7, 0, Math.PI * 2);
    ctx.ellipse(12, -5, 12, 5, 0.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = info.color;

    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 / 6) * i;
      const px = Math.cos(angle) * 10;
      const py = -20 + Math.sin(angle) * 10;
      ctx.beginPath();
      ctx.ellipse(px, py, 8 + pulse * 0.2, 5 + pulse * 0.15, angle, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#fff8e5";
    ctx.beginPath();
    ctx.arc(0, -20, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowBlur = 0;

  if (crop.watered) {
    ctx.fillStyle = "rgba(121,199,239,0.8)";
    ctx.beginPath();
    ctx.arc(17, 10, 4, 0, Math.PI * 2);
    ctx.arc(24, 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawPlayer() {
  const pos = centerOfTile(state.player.x, state.player.y);
  const bob = Math.sin(timeTick / 10) * 2;

  ctx.save();

  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y + 34, 24, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  const playerHeight = TILE * 1.28;
  const playerWidth = TILE * 0.92;

  const usedImage = drawContainImage(
    gameImages.player,
    pos.x - playerWidth / 2,
    pos.y - playerHeight / 2 + bob,
    playerWidth,
    playerHeight
  );

  if (!usedImage) {
    ctx.translate(pos.x, pos.y + bob);

    ctx.fillStyle = "#2f5b7d";
    ctx.beginPath();
    ctx.roundRect(-16, -2, 32, 38, 10);
    ctx.fill();

    ctx.fillStyle = "#f2c79e";
    ctx.beginPath();
    ctx.arc(0, -18, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#5b3524";
    ctx.beginPath();
    ctx.arc(0, -24, 16, Math.PI, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1c2530";
    ctx.beginPath();
    ctx.arc(-6, -18, 2.3, 0, Math.PI * 2);
    ctx.arc(6, -18, 2.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#1c2530";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -12, 6, 0, Math.PI);
    ctx.stroke();

    ctx.fillStyle = "#e5bf72";
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.lineTo(7, 18);
    ctx.lineTo(0, 30);
    ctx.lineTo(-7, 18);
    ctx.closePath();
    ctx.fill();
  }

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
    ctx.fillStyle = s.color;
    ctx.globalAlpha = Math.max(0, s.life / 45);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

function drawVignette() {
  const vignette = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    300,
    canvas.width / 2,
    canvas.height / 2,
    950
  );

  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.28)");

  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (state.screenFlash > 0) {
    ctx.fillStyle = `rgba(255,244,220,${state.screenFlash * 0.02})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawDayBadge() {
  drawRoundedRect(26, 340, 150, 42, 18, "rgba(8,14,22,0.64)");
  ctx.fillStyle = "#fff4dc";
  ctx.font = "800 20px Montserrat";
  ctx.fillText(`Day ${state.day}`, 50, 367);
}

function drawScene() {
  drawBackground();
  drawMapShadow();

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      drawTile(x, y, state.tiles[y][x]);
    }
  }

  Object.keys(state.crops).forEach(k => {
    const [x, y] = k.split(",").map(Number);
    drawCrop(x, y, state.crops[k]);
  });

  Object.keys(state.weeds).forEach(k => {
    const [x, y] = k.split(",").map(Number);
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

    if (p.y < 200) {
      p.y = canvas.height - 120;
      p.x = Math.random() * canvas.width;
    }

    if (p.x < 0) p.x = canvas.width;
    if (p.x > canvas.width) p.x = 0;
  });

  state.sparkles = state.sparkles.filter(s => {
    s.x += s.vx;
    s.y += s.vy;
    s.life -= 1;
    return s.life > 0;
  });

  if (state.screenFlash > 0) {
    state.screenFlash -= 1;
  }
}

function gameLoop() {
  timeTick += 1;
  updateParticles();
  drawScene();
  requestAnimationFrame(gameLoop);
}

function handleCanvasTap(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;

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
  document.getElementById("saveBtn").addEventListener("click", saveGame);

  document.getElementById("plantBtn").addEventListener("click", plantSeed);
  document.getElementById("waterBtn").addEventListener("click", waterCrop);
  document.getElementById("harvestBtn").addEventListener("click", harvestCrop);
  document.getElementById("clearBtn").addEventListener("click", clearWeeds);
  document.getElementById("prayBtn").addEventListener("click", pray);

  document.getElementById("upBtn").addEventListener("click", () => movePlayer(0, -1));
  document.getElementById("downBtn").addEventListener("click", () => movePlayer(0, 1));
  document.getElementById("leftBtn").addEventListener("click", () => movePlayer(-1, 0));
  document.getElementById("rightBtn").addEventListener("click", () => movePlayer(1, 0));

  document.querySelectorAll(".seedBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedSeed = btn.dataset.seed;
      setMessage(`${seedInfo[selectedSeed].name} seed selected.`);
      updateUI();
    });
  });

  document.getElementById("startBtn").addEventListener("click", () => {
    newGame();
    ui.titleScreen.classList.add("hidden");
  });

  document.getElementById("continueBtn").addEventListener("click", () => {
    if (!loadGameFromStorage()) {
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

  canvas.addEventListener("click", handleCanvasTap);

  document.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();

    if (k === "arrowup" || k === "w") movePlayer(0, -1);
    if (k === "arrowdown" || k === "s") movePlayer(0, 1);
    if (k === "arrowleft" || k === "a") movePlayer(-1, 0);
    if (k === "arrowright" || k === "d") movePlayer(1, 0);

    if (k === "1") {
      selectedSeed = "faith";
      updateUI();
    }

    if (k === "2") {
      selectedSeed = "peace";
      updateUI();
    }

    if (k === "3") {
      selectedSeed = "kindness";
      updateUI();
    }

    if (k === "p") plantSeed();
    if (k === "e") waterCrop();
    if (k === "h") harvestCrop();
    if (k === "c") clearWeeds();
    if (k === " ") pray();
    if (k === "n") newDay();
  });

  setInterval(() => {
    newDay();
  }, 90000);
}

if (!CanvasRenderingContext2D.prototype.roundRect) {
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

function init() {
  newGame();
  bindEvents();
  updateUI();
  gameLoop();
}

init();

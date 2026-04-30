const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const TILE = 48;
const COLS = 14;
const ROWS = 9;
const MAP_X = 36;
const MAP_Y = 56;

const COLORS = {
  grass1: "#3e8f4f",
  grass2: "#347943",
  soil: "#8b5a2b",
  soilDark: "#65411f",
  water: "#4ab7d8",
  path: "#b48b55",
  fence: "#7b4f28",
  gold: "#f3c76a",
  cream: "#fff4dc",
  shadow: "rgba(0,0,0,.25)",
  whiteGlow: "rgba(255,244,220,.75)"
};

const seedInfo = {
  faith: {
    name: "Faith",
    color: "#f3c76a",
    full: "Mustard Bloom",
    stat: "faith",
    message: "A seed of faith has been planted. Small beginnings still matter."
  },
  peace: {
    name: "Peace",
    color: "#77c9f2",
    full: "Stillwater Lily",
    stat: "peace",
    message: "Peace has been planted. Let the quiet places grow."
  },
  kindness: {
    name: "Kindness",
    color: "#78c779",
    full: "Kindness Vine",
    stat: "kindness",
    message: "Kindness has been planted. Love becomes visible through action."
  }
};

let selectedSeed = "faith";
let messageTimer = 0;

let state = {
  player: { x: 2, y: 4, facing: "down" },
  day: 1,
  faith: 1,
  peace: 1,
  kindness: 1,
  harvest: 0,
  prayedToday: false,
  tiles: [],
  crops: {},
  weeds: {},
  sparkles: []
};

function setupTiles() {
  state.tiles = [];
  for (let y = 0; y < ROWS; y++) {
    const row = [];
    for (let x = 0; x < COLS; x++) {
      let type = "grass";

      if (y === 4 && x >= 0 && x <= 13) type = "path";
      if (x >= 4 && x <= 9 && y >= 2 && y <= 6) type = "soil";
      if (x >= 11 && y >= 1 && y <= 3) type = "water";
      if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) type = "fence";

      row.push(type);
    }
    state.tiles.push(row);
  }

  const startingWeeds = [
    [4, 2], [5, 2], [8, 2], [9, 3], [4, 6], [6, 6], [9, 6],
    [2, 2], [12, 6], [7, 1]
  ];

  startingWeeds.forEach(([x, y]) => {
    state.weeds[key(x, y)] = true;
  });
}

function key(x, y) {
  return `${x},${y}`;
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < COLS && y < ROWS;
}

function isBlocked(x, y) {
  if (!inBounds(x, y)) return true;
  const tile = state.tiles[y][x];
  return tile === "water" || tile === "fence";
}

function tileCenter(x, y) {
  return {
    x: MAP_X + x * TILE + TILE / 2,
    y: MAP_Y + y * TILE + TILE / 2
  };
}

function setMessage(text) {
  document.getElementById("messageBox").textContent = text;
  messageTimer = 240;
}

function updateUI() {
  document.getElementById("faithStat").textContent = state.faith;
  document.getElementById("peaceStat").textContent = state.peace;
  document.getElementById("kindnessStat").textContent = state.kindness;
  document.getElementById("harvestStat").textContent = state.harvest;

  const weedsLeft = Object.keys(state.weeds).length;
  const cropsReady = Object.values(state.crops).filter(c => c.growth >= 3).length;

  let quest = "Restore the Heartfield: plant seeds, water them, clear weeds, and harvest spiritual fruit.";

  if (weedsLeft > 4) {
    quest = `Clear the thorns and worry weeds. ${weedsLeft} patches remain.`;
  } else if (Object.keys(state.crops).length < 3) {
    quest = "Plant at least 3 seeds of faith, peace, or kindness in the garden soil.";
  } else if (cropsReady < 2) {
    quest = "Water your seeds and help them grow. Harvest 2 mature crops.";
  } else if (state.harvest < 5) {
    quest = `Harvest fruit from the garden. ${5 - state.harvest} more harvest needed to restore the old well.`;
  } else {
    quest = "The old well is restored. The Prayer Grove will open in the next version.";
  }

  document.getElementById("questText").textContent = quest;
}

function drawRoundedRect(x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#9ed6ff");
  gradient.addColorStop(0.42, "#f8d99a");
  gradient.addColorStop(1, "#365f3b");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,244,220,.5)";
  ctx.beginPath();
  ctx.arc(820, 80, 44, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,.22)";
  for (let i = 0; i < 6; i++) {
    const x = 80 + i * 145;
    const y = 65 + Math.sin(Date.now() / 1500 + i) * 6;
    ctx.beginPath();
    ctx.ellipse(x, y, 40, 13, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 35, y + 5, 34, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(20,50,31,.8)";
  ctx.beginPath();
  ctx.moveTo(0, 210);
  ctx.lineTo(140, 140);
  ctx.lineTo(280, 215);
  ctx.lineTo(420, 130);
  ctx.lineTo(610, 225);
  ctx.lineTo(760, 145);
  ctx.lineTo(960, 210);
  ctx.lineTo(960, 540);
  ctx.lineTo(0, 540);
  ctx.closePath();
  ctx.fill();
}

function drawTile(x, y, type) {
  const px = MAP_X + x * TILE;
  const py = MAP_Y + y * TILE;

  if (type === "grass") {
    ctx.fillStyle = (x + y) % 2 === 0 ? COLORS.grass1 : COLORS.grass2;
    ctx.fillRect(px, py, TILE, TILE);

    ctx.strokeStyle = "rgba(255,255,255,.035)";
    ctx.strokeRect(px, py, TILE, TILE);

    if ((x * 7 + y * 3) % 5 === 0) {
      ctx.fillStyle = "rgba(255,244,220,.18)";
      ctx.fillRect(px + 11, py + 14, 3, 10);
      ctx.fillRect(px + 28, py + 27, 3, 8);
    }
  }

  if (type === "soil") {
    ctx.fillStyle = COLORS.soil;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = "rgba(0,0,0,.12)";
    ctx.fillRect(px, py + TILE - 8, TILE, 8);
    ctx.strokeStyle = "rgba(255,244,220,.09)";
    ctx.strokeRect(px, py, TILE, TILE);

    ctx.strokeStyle = "rgba(70,40,18,.42)";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(px + 7, py + 12 + i * 12);
      ctx.lineTo(px + TILE - 8, py + 10 + i * 12);
      ctx.stroke();
    }
  }

  if (type === "path") {
    ctx.fillStyle = COLORS.path;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = "rgba(255,244,220,.12)";
    ctx.fillRect(px + 7, py + 11, 11, 6);
    ctx.fillRect(px + 28, py + 28, 13, 7);
  }

  if (type === "water") {
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.strokeStyle = "rgba(255,255,255,.28)";
    ctx.beginPath();
    ctx.moveTo(px + 6, py + 18);
    ctx.quadraticCurveTo(px + 18, py + 10, px + 30, py + 18);
    ctx.quadraticCurveTo(px + 39, py + 25, px + 46, py + 19);
    ctx.stroke();
  }

  if (type === "fence") {
    ctx.fillStyle = "#315b38";
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = COLORS.fence;
    ctx.fillRect(px + 8, py + 12, 8, 30);
    ctx.fillRect(px + 31, py + 12, 8, 30);
    ctx.fillRect(px + 4, py + 20, 40, 7);
    ctx.fillRect(px + 4, py + 33, 40, 7);
  }
}

function drawCrop(x, y, crop) {
  const px = MAP_X + x * TILE;
  const py = MAP_Y + y * TILE;
  const info = seedInfo[crop.type];

  ctx.save();
  ctx.translate(px + TILE / 2, py + TILE / 2);

  ctx.fillStyle = "rgba(0,0,0,.18)";
  ctx.beginPath();
  ctx.ellipse(0, 14, 16, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#2d6b35";
  ctx.lineWidth = 4;

  if (crop.growth === 0) {
    ctx.fillStyle = info.color;
    ctx.beginPath();
    ctx.arc(0, 8, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (crop.growth === 1) {
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.lineTo(0, -2);
    ctx.stroke();

    ctx.fillStyle = "#78c779";
    ctx.beginPath();
    ctx.ellipse(-7, 2, 8, 4, -0.6, 0, Math.PI * 2);
    ctx.ellipse(7, 0, 8, 4, 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  if (crop.growth === 2) {
    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.lineTo(0, -12);
    ctx.stroke();

    ctx.fillStyle = "#78c779";
    ctx.beginPath();
    ctx.ellipse(-9, -2, 10, 5, -0.6, 0, Math.PI * 2);
    ctx.ellipse(9, -5, 10, 5, 0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = info.color;
    ctx.beginPath();
    ctx.arc(0, -13, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  if (crop.growth >= 3) {
    const pulse = Math.sin(Date.now() / 220) * 2;

    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.lineTo(0, -15);
    ctx.stroke();

    ctx.fillStyle = "#78c779";
    ctx.beginPath();
    ctx.ellipse(-11, -4, 12, 6, -0.7, 0, Math.PI * 2);
    ctx.ellipse(11, -7, 12, 6, 0.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = info.color;
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 / 6) * i;
      ctx.beginPath();
      ctx.ellipse(Math.cos(angle) * 8, -18 + Math.sin(angle) * 8, 7 + pulse, 4 + pulse * 0.3, angle, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = COLORS.cream;
    ctx.beginPath();
    ctx.arc(0, -18, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (crop.watered) {
    ctx.fillStyle = "rgba(119,201,242,.6)";
    ctx.beginPath();
    ctx.arc(15, 12, 3, 0, Math.PI * 2);
    ctx.arc(21, 6, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawWeed(x, y) {
  const px = MAP_X + x * TILE;
  const py = MAP_Y + y * TILE;

  ctx.save();
  ctx.translate(px + TILE / 2, py + TILE / 2);

  ctx.strokeStyle = "#263518";
  ctx.lineWidth = 4;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 4, 14);
    ctx.quadraticCurveTo(i * 7, -3, i * 10, -12);
    ctx.stroke();
  }

  ctx.fillStyle = "#5b6e26";
  ctx.beginPath();
  ctx.ellipse(-9, -5, 8, 4, -0.6, 0, Math.PI * 2);
  ctx.ellipse(7, -8, 8, 4, 0.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(0,0,0,.16)";
  ctx.beginPath();
  ctx.ellipse(0, 16, 17, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPlayer() {
  const { x, y } = state.player;
  const pos = tileCenter(x, y);

  ctx.save();
  ctx.translate(pos.x, pos.y);

  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.beginPath();
  ctx.ellipse(0, 17, 16, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#315f80";
  ctx.beginPath();
  ctx.roundRect(-13, -6, 26, 27, 8);
  ctx.fill();

  ctx.fillStyle = "#f2c99d";
  ctx.beginPath();
  ctx.arc(0, -17, 13, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#5a3321";
  ctx.beginPath();
  ctx.arc(0, -23, 13, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1b2430";
  ctx.beginPath();
  ctx.arc(-5, -17, 2, 0, Math.PI * 2);
  ctx.arc(5, -17, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#1b2430";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -12, 5, 0, Math.PI);
  ctx.stroke();

  ctx.fillStyle = "#f3c76a";
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.lineTo(5, 8);
  ctx.lineTo(0, 18);
  ctx.lineTo(-5, 8);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawHUD() {
  drawRoundedRect(24, 16, 430, 35, 15, "rgba(16,24,32,.72)");
  ctx.fillStyle = COLORS.cream;
  ctx.font = "800 18px Arial";
  ctx.fillText("Garden of Grace: First Harvest", 44, 39);

  ctx.fillStyle = COLORS.gold;
  ctx.font = "700 13px Arial";
  ctx.fillText(`Day ${state.day} • Seed: ${seedInfo[selectedSeed].name}`, 298, 39);

  drawRoundedRect(672, 18, 250, 34, 15, "rgba(16,24,32,.72)");
  ctx.fillStyle = "#fff";
  ctx.font = "700 13px Arial";
  ctx.fillText("Goal: restore the old well", 696, 40);
}

function drawSparkles() {
  state.sparkles.forEach(s => {
    ctx.fillStyle = `rgba(255,244,220,${s.life / 60})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  });
}

function draw() {
  drawBackground();

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
  drawSparkles();

  drawHUD();

  if (messageTimer > 0) {
    messageTimer--;
  }
}

function movePlayer(dx, dy) {
  const nx = state.player.x + dx;
  const ny = state.player.y + dy;

  if (dx > 0) state.player.facing = "right";
  if (dx < 0) state.player.facing = "left";
  if (dy > 0) state.player.facing = "down";
  if (dy < 0) state.player.facing = "up";

  if (isBlocked(nx, ny)) {
    setMessage("That path is blocked. Some places open as your garden is restored.");
    return;
  }

  state.player.x = nx;
  state.player.y = ny;
}

function currentKey() {
  return key(state.player.x, state.player.y);
}

function plantSeed() {
  const { x, y } = state.player;
  const k = currentKey();

  if (state.tiles[y][x] !== "soil") {
    setMessage("Seeds grow best in the garden soil. Stand on a brown garden tile.");
    return;
  }

  if (state.weeds[k]) {
    setMessage("Clear the weeds first. Faith grows better where the ground is tended.");
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

  addSparkles(x, y, 10);
  setMessage(seedInfo[selectedSeed].message);
  updateUI();
}

function waterCrop() {
  const k = currentKey();
  const crop = state.crops[k];

  if (!crop) {
    setMessage("There is nothing here to water yet.");
    return;
  }

  if (crop.watered) {
    setMessage("This seed has already been watered. Give it a moment to grow.");
    return;
  }

  crop.watered = true;
  crop.growth = Math.min(3, crop.growth + 1);

  addSparkles(state.player.x, state.player.y, 8);
  setMessage("You watered the seed with care. Growth often comes one faithful step at a time.");
  updateUI();
}

function harvestCrop() {
  const k = currentKey();
  const crop = state.crops[k];

  if (!crop) {
    setMessage("There is nothing ready to harvest here.");
    return;
  }

  if (crop.growth < 3) {
    setMessage("This crop is still growing. Patience is part of the harvest.");
    return;
  }

  const info = seedInfo[crop.type];
  state[info.stat] += 1;
  state.harvest += 1;

  delete state.crops[k];

  addSparkles(state.player.x, state.player.y, 18);
  setMessage(`You harvested ${info.full}. Your ${info.name} has grown stronger.`);
  updateUI();
}

function clearWeeds() {
  const k = currentKey();

  if (!state.weeds[k]) {
    setMessage("No weeds here. Look for the dark thorny patches.");
    return;
  }

  delete state.weeds[k];
  state.kindness += 1;

  addSparkles(state.player.x, state.player.y, 12);
  setMessage("You cleared worry from the soil. The garden feels lighter.");
  updateUI();
}

function pray() {
  if (state.prayedToday) {
    setMessage("You already paused in prayer today. Keep tending the garden.");
    return;
  }

  state.prayedToday = true;
  state.peace += 1;

  const { x, y } = state.player;
  addSparkles(x, y, 28);

  Object.values(state.crops).forEach(crop => {
    if (crop.watered && crop.growth < 3) {
      crop.growth += 1;
    }
  });

  setMessage("You paused to pray. Peace settles over the garden, and watered seeds grow stronger.");
  updateUI();
}

function addSparkles(tileX, tileY, count) {
  const pos = tileCenter(tileX, tileY);

  for (let i = 0; i < count; i++) {
    state.sparkles.push({
      x: pos.x + (Math.random() - 0.5) * 42,
      y: pos.y + (Math.random() - 0.5) * 42,
      vx: (Math.random() - 0.5) * 0.7,
      vy: -Math.random() * 0.8,
      size: 2 + Math.random() * 3,
      life: 40 + Math.random() * 25
    });
  }
}

function updateSparkles() {
  state.sparkles = state.sparkles.filter(s => {
    s.x += s.vx;
    s.y += s.vy;
    s.life -= 1;
    return s.life > 0;
  });
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

  if (Math.random() < 0.5) {
    const soilTiles = [];
    for (let y = 1; y < ROWS - 1; y++) {
      for (let x = 1; x < COLS - 1; x++) {
        const k = key(x, y);
        if (state.tiles[y][x] !== "water" && state.tiles[y][x] !== "fence" && !state.crops[k] && !state.weeds[k]) {
          soilTiles.push([x, y]);
        }
      }
    }

    if (soilTiles.length) {
      const [wx, wy] = soilTiles[Math.floor(Math.random() * soilTiles.length)];
      state.weeds[key(wx, wy)] = true;
    }
  }

  setMessage("A new day begins. Mercy is new, and the garden is waiting.");
  updateUI();
}

function saveGame() {
  localStorage.setItem("gardenOfGraceSave", JSON.stringify(state));
  setMessage("Game saved. Your garden will be here when you return.");
}

function loadGame() {
  const saved = localStorage.getItem("gardenOfGraceSave");

  if (saved) {
    try {
      state = JSON.parse(saved);
      setMessage("Welcome back. Your garden remembered you.");
      updateUI();
      return;
    } catch (e) {
      console.warn("Save failed to load.", e);
    }
  }

  setupTiles();
  setMessage("Welcome to the Heartfield. Plant seeds, clear weeds, and grow in grace.");
  updateUI();
}

function resetIfMissingTiles() {
  if (!state.tiles || !state.tiles.length) {
    setupTiles();
  }
}

function gameLoop() {
  resetIfMissingTiles();
  updateSparkles();
  draw();
  requestAnimationFrame(gameLoop);
}

document.addEventListener("keydown", e => {
  const key = e.key.toLowerCase();

  if (key === "arrowup" || key === "w") movePlayer(0, -1);
  if (key === "arrowdown" || key === "s") movePlayer(0, 1);
  if (key === "arrowleft" || key === "a") movePlayer(-1, 0);
  if (key === "arrowright" || key === "d") movePlayer(1, 0);

  if (key === "p") plantSeed();
  if (key === "e") waterCrop();
  if (key === "h") harvestCrop();
  if (key === "c") clearWeeds();
  if (key === " ") pray();
  if (key === "n") newDay();

  updateUI();
});

canvas.addEventListener("click", e => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;

  const tx = Math.floor((mx - MAP_X) / TILE);
  const ty = Math.floor((my - MAP_Y) / TILE);

  if (!inBounds(tx, ty)) return;

  const dx = Math.sign(tx - state.player.x);
  const dy = Math.sign(ty - state.player.y);

  if (Math.abs(tx - state.player.x) > Math.abs(ty - state.player.y)) {
    movePlayer(dx, 0);
  } else if (ty !== state.player.y) {
    movePlayer(0, dy);
  } else if (tx !== state.player.x) {
    movePlayer(dx, 0);
  }

  updateUI();
});

document.querySelectorAll(".seedBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".seedBtn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedSeed = btn.dataset.seed;
    setMessage(`${seedInfo[selectedSeed].name} seed selected.`);
  });
});

document.getElementById("plantBtn").addEventListener("click", plantSeed);
document.getElementById("waterBtn").addEventListener("click", waterCrop);
document.getElementById("harvestBtn").addEventListener("click", harvestCrop);
document.getElementById("clearBtn").addEventListener("click", clearWeeds);
document.getElementById("prayBtn").addEventListener("click", pray);
document.getElementById("saveBtn").addEventListener("click", saveGame);

document.getElementById("upBtn").addEventListener("click", () => movePlayer(0, -1));
document.getElementById("downBtn").addEventListener("click", () => movePlayer(0, 1));
document.getElementById("leftBtn").addEventListener("click", () => movePlayer(-1, 0));
document.getElementById("rightBtn").addEventListener("click", () => movePlayer(1, 0));

setInterval(() => {
  if (Object.keys(state.crops).length > 0) {
    Object.values(state.crops).forEach(crop => {
      if (crop.watered && crop.growth < 3 && Math.random() < 0.25) {
        crop.growth += 1;
      }
    });
    updateUI();
  }
}, 8000);

setInterval(() => {
  newDay();
}, 90000);

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

loadGame();
gameLoop();

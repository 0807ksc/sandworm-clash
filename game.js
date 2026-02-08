const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const statusEl = document.getElementById('status');
const overlay = document.getElementById('overlay');
const playBtn = document.getElementById('play');
const toggleBtn = document.getElementById('toggle');
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;

const baseCellSize = 5;
const wormUnitCells = 5;
const unitPixelSize = baseCellSize * wormUnitCells;
const gridSize = unitPixelSize;
const wormRenderBlockCells = 1;
const wormRenderScale = 1;
const creatureRenderScale = 6;
const spiceCollisionScale = 0.4;
const debugCellOutline = false;
const debugCellSize = unitPixelSize;
const enemyTargetCount = 3;
const gameplaySpeedMultiplier = 0.7;
let viewWidth = canvas.width;
let viewHeight = canvas.height;
let worldWidth = canvas.width * 3;
let worldHeight = canvas.height * 3;
let cols = Math.floor(worldWidth / gridSize);
let rows = Math.floor(worldHeight / gridSize);

const assets = {
  wormHeadPlayer: 'assets/worm_head_player.png',
  wormBodyPlayer: 'assets/worm_body_player.png',
  wormHeadEnemy: 'assets/worm_head_enemy.png',
  wormBodyEnemy: 'assets/worm_body_enemy.png',
  arrow: 'assets/ui_direction_arrow.png',
  animals: {
    lizard: 'assets/animal_lizard.png',
    scorpion: 'assets/animal_scorpion.png',
    fennec: 'assets/animal_fennec.png',
    beetle: 'assets/animal_beetle.png',
    snake: 'assets/animal_snake.png',
    owl: 'assets/animal_owl.png',
    camel: 'assets/animal_camel.png',
  },
};
const images = {};

let worm = [];
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let spices = [];
const creatureTypes = [
  { name: '도마뱀', color: '#c8a26a', value: 10, speed: 2, shape: 'lizard' },
  { name: '전갈', color: '#8c6b4f', value: 15, speed: 3, shape: 'scorpion' },
  { name: '사막여우', color: '#d8c08a', value: 20, speed: 4, shape: 'fennec' },
  { name: '딱정벌레', color: '#b79d72', value: 12, speed: 2, shape: 'beetle' },
  { name: '뱀', color: '#c49a6c', value: 14, speed: 3, shape: 'snake' },
  { name: '부엉이', color: '#d1b47c', value: 18, speed: 4, shape: 'owl' },
  { name: '낙타', color: '#aa7f55', value: 16, speed: 3, shape: 'camel' },
];
let running = false;
let score = 0;
let best = Number(localStorage.getItem('sandworm-best') || 0);
let stepTime = 110;
let enemyStepTime = 140;
let shake = 0;
let touchId = null;
let enemies = [];
let particles = [];
let slowMoUntil = 0;
let pointer = { x: canvas.width / 2, y: canvas.height / 2, active: false };
let hasStarted = false;
let camera = { x: 0, y: 0 };
let statusUntil = 0;
let statusSticky = false;
let audioCtx = null;
let simTime = 0;
let playerAccum = 0;
let enemyAccum = 0;
let rafLastTime = 0;

let dustParticles = [];

function resetDust() {
  dustParticles = Array.from({ length: 240 }, () => ({
    x: Math.random() * worldWidth,
    y: Math.random() * worldHeight,
    r: 1 + Math.random() * 2.5,
    speed: 0.2 + Math.random() * 0.6,
  }));
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width));
  canvas.height = Math.max(1, Math.floor(rect.height));
  viewWidth = canvas.width;
  viewHeight = canvas.height;
  worldWidth = viewWidth * 3;
  worldHeight = viewHeight * 3;
  cols = Math.floor(worldWidth / gridSize);
  rows = Math.floor(worldHeight / gridSize);
  camera.x = Math.max(0, Math.min(camera.x, worldWidth - viewWidth));
  camera.y = Math.max(0, Math.min(camera.y, worldHeight - viewHeight));
  if (worm.length > 0) {
    worm = worm.map(seg => ({
      x: Math.max(0, Math.min(cols - 1, seg.x)),
      y: Math.max(0, Math.min(rows - 1, seg.y)),
    }));
  }
  if (enemies.length > 0) {
    enemies.forEach(enemy => {
      enemy.segments = enemy.segments.map(seg => ({
        x: Math.max(0, Math.min(cols - 1, seg.x)),
        y: Math.max(0, Math.min(rows - 1, seg.y)),
      }));
    });
  }
  resetDust();
}

function resetGame() {
  resizeCanvas();
  worm = [
    { x: 6, y: 12 },
    { x: 5, y: 12 },
    { x: 4, y: 12 },
  ];
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  score = 0;
  stepTime = 95;
  enemyStepTime = 120;
  enemies = createEnemies(enemyTargetCount);
  simTime = 0;
  playerAccum = 0;
  enemyAccum = 0;
  rafLastTime = 0;
  slowMoUntil = 0;
  pointer.active = false;
  hasStarted = true;
  camera = { x: 0, y: 0 };
  placeSpices(6);
  setStatus('사막을 누비는 중... 동물을 찾아 성장하세요.', 5000);
  updateHud();
  overlay.classList.remove('show');
}

function updateHud() {
  scoreEl.textContent = score;
  bestEl.textContent = best;
}

function centerOf(cell) {
  return {
    x: cell.x * gridSize + gridSize / 2,
    y: cell.y * gridSize + gridSize / 2,
  };
}

function unitRect(cell) {
  return {
    x: cell.x * gridSize,
    y: cell.y * gridSize,
    w: unitPixelSize,
    h: unitPixelSize,
  };
}

function spiceCollisionRect(cell) {
  const size = gridSize * creatureRenderScale * spiceCollisionScale;
  return {
    x: cell.x * gridSize + (gridSize - size) / 2,
    y: cell.y * gridSize + (gridSize - size) / 2,
    w: size,
    h: size,
  };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
    a.y < b.y + b.h && a.y + a.h > b.y;
}

function unitsOverlap(a, b) {
  return rectsOverlap(unitRect(a), unitRect(b));
}

function setStatus(message, ttlMs = 5000, sticky = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusSticky = sticky;
  statusUntil = sticky ? Number.POSITIVE_INFINITY : simTime + ttlMs;
  statusEl.classList.remove('hidden');
}

function loadImage(key, src) {
  const img = new Image();
  img.src = src;
  images[key] = img;
}

function preloadImages() {
  loadImage('wormHeadPlayer', assets.wormHeadPlayer);
  loadImage('wormBodyPlayer', assets.wormBodyPlayer);
  loadImage('wormHeadEnemy', assets.wormHeadEnemy);
  loadImage('wormBodyEnemy', assets.wormBodyEnemy);
  loadImage('arrow', assets.arrow);
  Object.entries(assets.animals).forEach(([key, src]) => {
    loadImage(`animal_${key}`, src);
  });
}

function getImage(key) {
  const img = images[key];
  if (!img || !img.complete) return null;
  return img;
}

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playTone(freq, duration, type = 'sine', gain = 0.08) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration / 1000);
  osc.connect(g);
  g.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration / 1000);
}

function sfxSpice() {
  playTone(520, 120, 'triangle', 0.08);
  playTone(760, 90, 'sine', 0.06);
}

function sfxEnemyEaten() {
  playTone(220, 120, 'square', 0.08);
  playTone(160, 140, 'sawtooth', 0.06);
}

function sfxPlayerHit() {
  playTone(110, 200, 'sawtooth', 0.12);
  playTone(70, 260, 'square', 0.08);
}

function placeSpices(count) {
  const list = [];
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = Math.floor(Math.random() * cols);
      y = Math.floor(Math.random() * rows);
    } while (
      worm.some(seg => seg.x === x && seg.y === y) ||
      enemies.some(enemy => enemy.segments.some(seg => seg.x === x && seg.y === y)) ||
      list.some(sp => sp.x === x && sp.y === y)
    );
    const type = creatureTypes[Math.floor(Math.random() * creatureTypes.length)];
    list.push({ x, y, type });
  }
  spices = list;
}

function respawnSpice() {
  let x, y;
  do {
    x = Math.floor(Math.random() * cols);
    y = Math.floor(Math.random() * rows);
  } while (
    worm.some(seg => seg.x === x && seg.y === y) ||
    enemies.some(enemy => enemy.segments.some(seg => seg.x === x && seg.y === y)) ||
    spices.some(sp => sp.x === x && sp.y === y)
  );
  const type = creatureTypes[Math.floor(Math.random() * creatureTypes.length)];
  spices.push({ x, y, type });
}

function setDirection(dir, allowReverse = false) {
  if (running === false) return;
  const opposite = direction.x + dir.x === 0 && direction.y + dir.y === 0;
  if (opposite && !allowReverse) return;
  nextDirection = dir;
}

function gameOver() {
  running = false;
  hasStarted = false;
  overlay.classList.add('show');
  toggleBtn.textContent = 'Start';
  document.body.classList.remove('running');
  setStatus('게임 오버. 다시 시작하려면 버튼을 눌러주세요.', 5000);
}

function step() {
  direction = nextDirection;
  let head = { x: worm[0].x + direction.x, y: worm[0].y + direction.y };
  const hitsEnemy = (x, y) => enemies.some(enemy => enemy.segments.some(seg => seg.x === x && seg.y === y));
  const hitsSelf = (x, y) => worm.some(seg => seg.x === x && seg.y === y);

  const bounced = bounceOffWalls(head, direction);
  if (bounced) {
    direction = bounced;
    nextDirection = bounced;
    head = { x: worm[0].x + direction.x, y: worm[0].y + direction.y };
  }

  if (hitsSelf(head.x, head.y)) {
    const newDir = bounceOffBody(direction, worm[0], hitsSelf);
    if (newDir) {
      direction = newDir;
      nextDirection = newDir;
      head = { x: worm[0].x + direction.x, y: worm[0].y + direction.y };
    }
  }

  if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) {
    gameOver();
    return;
  }

  if (hitsEnemy(head.x, head.y)) {
    gameOver();
    return;
  }

  worm.unshift(head);

  const spiceIndex = spices.findIndex(sp => rectsOverlap(unitRect(head), spiceCollisionRect(sp)));
  if (spiceIndex !== -1) {
    const spice = spices.splice(spiceIndex, 1)[0];
    score += spice.type.value;
    stepTime = Math.max(55, stepTime - spice.type.speed);
    enemyStepTime = Math.max(65, enemyStepTime - 1);
    shake = 8;
    sfxSpice();
    spawnBurst(head.x, head.y, spice.type.color);
    setStatus(`${spice.type.name}을(를) 먹었습니다. +${spice.type.value}점!`, 5000);
    respawnSpice();
    if (score > best) {
      best = score;
      localStorage.setItem('sandworm-best', String(best));
    }
  } else {
    worm.pop();
  }

  ensureEnemyCount();
  updateCamera();
  updateHud();
}

function bounceOffWalls(head, dir) {
  let nx = dir.x;
  let ny = dir.y;
  if (head.x < 0 || head.x >= cols) nx = -nx;
  if (head.y < 0 || head.y >= rows) ny = -ny;
  if (nx === dir.x && ny === dir.y) return null;
  if (nx === 0 && ny === 0) return null;
  return { x: nx, y: ny };
}

function bounceOffBody(dir, head, hitsSelf) {
  const candidates = [
    { x: dir.x, y: -dir.y },
    { x: -dir.x, y: dir.y },
    { x: -dir.x, y: -dir.y },
    { x: dir.y, y: dir.x },
    { x: -dir.y, y: dir.x },
    { x: dir.y, y: -dir.x },
    { x: -dir.y, y: -dir.x },
  ].filter(d => !(d.x === 0 && d.y === 0));

  for (const cand of candidates) {
    const nx = head.x + cand.x;
    const ny = head.y + cand.y;
    if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
    if (!hitsSelf(nx, ny)) return cand;
  }
  return null;
}

function drawBackground() {
  ctx.fillStyle = '#f5d6a4';
  ctx.fillRect(0, 0, worldWidth, worldHeight);

  ctx.fillStyle = 'rgba(255, 236, 200, 0.35)';
  dustParticles.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    p.x += p.speed;
    if (p.x > worldWidth + 20) p.x = -20;
  });

  ctx.strokeStyle = 'rgba(195, 140, 80, 0.45)';
  ctx.lineWidth = 2;
  const lineGap = 60;
  for (let y = 0; y <= worldHeight; y += lineGap) {
    ctx.beginPath();
    const wave = Math.sin((Date.now() / 1200) + (y / 220)) * 8;
    const yy = y + wave;
    ctx.moveTo(0, yy);
    ctx.bezierCurveTo(worldWidth * 0.25, yy - 10, worldWidth * 0.5, yy + 12, worldWidth * 0.75, yy - 6);
    ctx.bezierCurveTo(worldWidth * 0.85, yy - 20, worldWidth * 0.93, yy + 16, worldWidth, yy - 6);
    ctx.stroke();
  }
}

function drawSpice() {
  spices.forEach(spice => {
    if (debugCellOutline) {
      drawDebugRect(spiceCollisionRect(spice));
    }
    const cx = spice.x * gridSize + gridSize / 2;
    const cy = spice.y * gridSize + gridSize / 2;
    ctx.save();
    const t = Date.now() / 300;
    const bob = Math.sin(t + (spice.x + spice.y) * 0.3) * 2.2;
    const sway = Math.cos(t + (spice.x - spice.y) * 0.25) * 0.08;
    ctx.translate(cx, cy + bob);
    ctx.rotate(sway);
    ctx.fillStyle = spice.type.color;
    const s = creatureRenderScale;
    const animalImg = getImage(`animal_${spice.type.shape}`);
    if (animalImg) {
      const size = gridSize * creatureRenderScale;
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.drawImage(animalImg, -size / 2, -size / 2, size, size);
      ctx.restore();
      ctx.restore();
      return;
    }
    switch (spice.type.shape) {
      case 'lizard': {
        ctx.beginPath();
        ctx.ellipse(0, 2 * s, 9 * s, 4 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(60, 35, 18, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-6 * s, 6 * s);
        ctx.lineTo(-2 * s, 8 * s);
        ctx.lineTo(2 * s, 8 * s);
        ctx.lineTo(6 * s, 6 * s);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(60, 35, 18, 0.35)';
        ctx.beginPath();
        ctx.moveTo(-10 * s, 3 * s);
        ctx.lineTo(-14 * s, 4 * s);
        ctx.moveTo(10 * s, 3 * s);
        ctx.lineTo(14 * s, 4 * s);
        ctx.stroke();
        break;
      }
      case 'scorpion': {
        ctx.beginPath();
        ctx.ellipse(0, 2 * s, 8 * s, 5 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(60, 35, 18, 0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(6 * s, -4 * s, 6 * s, Math.PI * 0.2, Math.PI * 1.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-6 * s, 6 * s);
        ctx.lineTo(-10 * s, 8 * s);
        ctx.moveTo(6 * s, 6 * s);
        ctx.lineTo(10 * s, 8 * s);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(60, 35, 18, 0.35)';
        ctx.beginPath();
        ctx.moveTo(-2 * s, 8 * s);
        ctx.lineTo(-6 * s, 11 * s);
        ctx.moveTo(2 * s, 8 * s);
        ctx.lineTo(6 * s, 11 * s);
        ctx.stroke();
        break;
      }
      case 'fennec': {
        ctx.beginPath();
        ctx.ellipse(0, 4 * s, 7 * s, 4 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-6 * s, 2 * s);
        ctx.lineTo(-12 * s, -6 * s);
        ctx.lineTo(-2 * s, -2 * s);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(6 * s, 2 * s);
        ctx.lineTo(12 * s, -6 * s);
        ctx.lineTo(2 * s, -2 * s);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#f3e1bf';
        ctx.beginPath();
        ctx.ellipse(-2.5 * s, 4 * s, 1.2 * s, 1.6 * s, 0, 0, Math.PI * 2);
        ctx.ellipse(2.5 * s, 4 * s, 1.2 * s, 1.6 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'beetle': {
        ctx.beginPath();
        ctx.ellipse(0, 3 * s, 7 * s, 6 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(60, 35, 18, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -3 * s);
        ctx.lineTo(0, 9 * s);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-6 * s, 1 * s);
        ctx.lineTo(-10 * s, -1 * s);
        ctx.moveTo(6 * s, 1 * s);
        ctx.lineTo(10 * s, -1 * s);
        ctx.stroke();
        break;
      }
      case 'snake': {
        ctx.strokeStyle = spice.type.color;
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.moveTo(-10 * s, 6 * s);
        ctx.quadraticCurveTo(-2 * s, -2 * s, 8 * s, 4 * s);
        ctx.stroke();
        ctx.fillStyle = 'rgba(60, 35, 18, 0.6)';
        ctx.beginPath();
        ctx.arc(8 * s, 4 * s, 2 * s, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'owl': {
        ctx.beginPath();
        ctx.ellipse(0, 3 * s, 7 * s, 6 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f3e1bf';
        ctx.beginPath();
        ctx.ellipse(-3 * s, 2 * s, 2 * s, 2.5 * s, 0, 0, Math.PI * 2);
        ctx.ellipse(3 * s, 2 * s, 2 * s, 2.5 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(60,35,18,0.5)';
        ctx.beginPath();
        ctx.arc(-3 * s, 2 * s, 0.8 * s, 0, Math.PI * 2);
        ctx.arc(3 * s, 2 * s, 0.8 * s, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'camel': {
        ctx.beginPath();
        ctx.ellipse(0, 4 * s, 9 * s, 4 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(-3 * s, 0, 3 * s, 2.5 * s, 0, 0, Math.PI * 2);
        ctx.ellipse(4 * s, 0, 3 * s, 2.5 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(60,35,18,0.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-8 * s, 8 * s);
        ctx.lineTo(-8 * s, 12 * s);
        ctx.moveTo(8 * s, 8 * s);
        ctx.lineTo(8 * s, 12 * s);
        ctx.stroke();
        break;
      }
      default: {
        ctx.beginPath();
        ctx.ellipse(0, 2 * s, 8 * s, 5 * s, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  });
}

function getRenderedSegments(segments) {
  if (!segments || segments.length === 0) return [];
  const rendered = [
    { x: segments[0].x * gridSize, y: segments[0].y * gridSize },
  ];
  for (let i = 1; i < segments.length; i++) {
    const prevGrid = segments[i - 1];
    const currGrid = segments[i];
    const prevPos = rendered[i - 1];
    const dx = currGrid.x - prevGrid.x;
    const dy = currGrid.y - prevGrid.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) {
      rendered.push({ x: prevPos.x, y: prevPos.y });
      continue;
    }
    const ux = dx / len;
    const uy = dy / len;
    rendered.push({
      x: prevPos.x + ux * gridSize,
      y: prevPos.y + uy * gridSize,
    });
  }
  return rendered;
}

function drawWorm() {
  const rendered = getRenderedSegments(worm);
  worm.forEach((seg, idx) => {
    if (debugCellOutline) {
      drawDebugCell(seg.x, seg.y);
    }
    const renderSeg = rendered[idx];
    const x = renderSeg.x;
    const y = renderSeg.y;
    const isHead = idx === 0;
    const size = gridSize * wormRenderBlockCells * wormRenderScale;
    const cx = x + gridSize / 2;
    const cy = y + gridSize / 2;
    const img = getImage(isHead ? 'wormHeadPlayer' : 'wormBodyPlayer');

    const offset = (gridSize - size) / 2;
    ctx.fillStyle = isHead ? '#9c5a2d' : '#6b3e1e';
    ctx.beginPath();
    ctx.roundRect(x + offset, y + offset, size, size, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 220, 160, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + gridSize / 2, y + gridSize / 2, size * 0.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 230, 190, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + gridSize / 2, y + gridSize / 2, size * 0.48, 0, Math.PI * 2);
    ctx.stroke();
    if (isHead) {
      ctx.fillStyle = '#f4d6b0';
      ctx.beginPath();
      const eyeOffset = size * 0.25;
      ctx.arc(cx - eyeOffset, cy - eyeOffset, 2, 0, Math.PI * 2);
      ctx.arc(cx + eyeOffset, cy - eyeOffset, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function drawDirectionLine() {
  if (!pointer.active) return;
  const head = worm[0];
  if (!head) return;
  const hxWorld = head.x * gridSize + gridSize / 2;
  const hyWorld = head.y * gridSize + gridSize / 2;
  let dxWorld = pointer.x - hxWorld;
  let dyWorld = pointer.y - hyWorld;
  dxWorld = wrappedDelta(dxWorld, worldWidth);
  dyWorld = wrappedDelta(dyWorld, worldHeight);
  const hx = hxWorld - camera.x;
  const hy = hyWorld - camera.y;
  const px = hx + dxWorld;
  const py = hy + dyWorld;
  const dx = dxWorld;
  const dy = dyWorld;
  const dist = Math.hypot(dx, dy);
  if (dist < 6) return;
  const targetDir = directionFromAngle(dx, dy);
  const targetAngle = Math.atan2(targetDir.y, targetDir.x);
  const currentAngle = Math.atan2(direction.y, direction.x);
  let diff = targetAngle - currentAngle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const isHardReverse = Math.abs(diff) > (Math.PI * 0.75);
  ctx.save();
  ctx.strokeStyle = isHardReverse ? 'rgba(210, 60, 50, 0.8)' : 'rgba(60, 35, 18, 0.55)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(px, py);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = isHardReverse ? 'rgba(210, 60, 50, 0.9)' : 'rgba(60, 35, 18, 0.8)';
  ctx.beginPath();
  ctx.arc(px, py, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSpiceGuide() {
  if (spices.length === 0) return;
  const head = worm[0];
  const hx = head.x * gridSize + gridSize / 2;
  const hy = head.y * gridSize + gridSize / 2;
  let target = spices[0];
  let bestDist = Infinity;
  spices.forEach(spice => {
    const sx = spice.x * gridSize + gridSize / 2;
    const sy = spice.y * gridSize + gridSize / 2;
    const d = Math.hypot(sx - hx, sy - hy);
    if (d < bestDist) {
      bestDist = d;
      target = spice;
    }
  });
  const sx = target.x * gridSize + gridSize / 2;
  const sy = target.y * gridSize + gridSize / 2;
  const vx = sx - camera.x;
  const vy = sy - camera.y;
  if (vx >= 0 && vx <= viewWidth && vy >= 0 && vy <= viewHeight) return;

  const margin = 14;
  const cx = Math.max(margin, Math.min(viewWidth - margin, vx));
  const cy = Math.max(margin, Math.min(viewHeight - margin, vy));
  const angle = Math.atan2(vy - cy, vx - cx);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = target.type.color;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-8, -6);
  ctx.lineTo(-8, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawEdgeWarning() {
  const head = worm[0];
  if (!head) return;
  const hx = head.x * gridSize + gridSize / 2;
  const hy = head.y * gridSize + gridSize / 2;
  const margin = 150;
  ctx.save();
  ctx.strokeStyle = 'rgba(220, 50, 40, 0.9)';
  ctx.lineWidth = 6;
  const now = simTime;
  let warned = false;
  if (hx < margin) {
    ctx.beginPath();
    ctx.moveTo(3, 3);
    ctx.lineTo(3, viewHeight - 3);
    ctx.stroke();
    warned = true;
  }
  if (hx > worldWidth - margin) {
    ctx.beginPath();
    ctx.moveTo(viewWidth - 3, 3);
    ctx.lineTo(viewWidth - 3, viewHeight - 3);
    ctx.stroke();
    warned = true;
  }
  if (hy < margin) {
    ctx.beginPath();
    ctx.moveTo(3, 3);
    ctx.lineTo(viewWidth - 3, 3);
    ctx.stroke();
    warned = true;
  }
  if (hy > worldHeight - margin) {
    ctx.beginPath();
    ctx.moveTo(3, viewHeight - 3);
    ctx.lineTo(viewWidth - 3, viewHeight - 3);
    ctx.stroke();
    warned = true;
  }
  if (warned && now > statusUntil && !statusSticky) {
    setStatus('벽을 조심하세요.', 5000);
  }
  ctx.restore();
}

function drawParticles() {
  if (particles.length === 0) return;
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 1;
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawEnemy(enemy) {
  const rendered = getRenderedSegments(enemy.segments);
  enemy.segments.forEach((seg, idx) => {
    if (debugCellOutline) {
      drawDebugCell(seg.x, seg.y);
    }
    const renderSeg = rendered[idx];
    const x = renderSeg.x;
    const y = renderSeg.y;
    const isHead = idx === 0;
    const size = gridSize * wormRenderBlockCells * wormRenderScale;
    const cx = x + gridSize / 2;
    const cy = y + gridSize / 2;
    const img = getImage(isHead ? 'wormHeadEnemy' : 'wormBodyEnemy');

    const offset = (gridSize - size) / 2;
    ctx.fillStyle = isHead ? enemy.head : enemy.body;
    ctx.beginPath();
    ctx.roundRect(x + offset, y + offset, size, size, 6);
    ctx.fill();
    ctx.strokeStyle = enemy.ring;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + gridSize / 2, y + gridSize / 2, size * 0.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(235, 220, 200, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + gridSize / 2, y + gridSize / 2, size * 0.48, 0, Math.PI * 2);
    ctx.stroke();
    if (isHead) {
      ctx.fillStyle = '#1a0f06';
      ctx.beginPath();
      const eyeOffset = size * 0.25;
      ctx.arc(cx - eyeOffset, cy - eyeOffset, 2, 0, Math.PI * 2);
      ctx.arc(cx + eyeOffset, cy - eyeOffset, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function drawDebugCell(cellX, cellY) {
  const left = cellX * gridSize + (gridSize - debugCellSize) / 2;
  const top = cellY * gridSize + (gridSize - debugCellSize) / 2;
  drawDebugRect({ x: left, y: top, w: debugCellSize, h: debugCellSize });
}

function drawDebugRect(rect) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.95)';
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

function drawMinimap() {
  if (!minimapCtx || !minimapCanvas || worldWidth <= 0 || worldHeight <= 0) return;
  const w = minimapCanvas.width;
  const h = minimapCanvas.height;
  const sx = w / worldWidth;
  const sy = h / worldHeight;
  const visibleW = Math.min(worldWidth, Math.max(1, window.innerWidth || viewWidth));
  const visibleH = Math.min(worldHeight, Math.max(1, window.innerHeight || viewHeight));

  minimapCtx.clearRect(0, 0, w, h);
  minimapCtx.fillStyle = 'rgba(20, 14, 9, 0.25)';
  minimapCtx.fillRect(0, 0, w, h);
  minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  minimapCtx.lineWidth = 1;
  minimapCtx.strokeRect(0.5, 0.5, w - 1, h - 1);

  minimapCtx.fillStyle = 'rgba(255, 170, 90, 0.95)';
  spices.forEach((sp) => {
    const x = (sp.x * gridSize + gridSize * 0.5) * sx;
    const y = (sp.y * gridSize + gridSize * 0.5) * sy;
    minimapCtx.fillRect(x - 1.5, y - 1.5, 3, 3);
  });

  minimapCtx.fillStyle = 'rgba(232, 116, 61, 0.95)';
  enemies.forEach((enemy) => {
    enemy.segments.forEach((seg) => {
      const x = (seg.x * gridSize + gridSize * 0.5) * sx;
      const y = (seg.y * gridSize + gridSize * 0.5) * sy;
      minimapCtx.fillRect(x - 1, y - 1, 2, 2);
    });
  });

  minimapCtx.fillStyle = 'rgba(98, 238, 177, 0.95)';
  worm.forEach((seg, idx) => {
    const x = (seg.x * gridSize + gridSize * 0.5) * sx;
    const y = (seg.y * gridSize + gridSize * 0.5) * sy;
    const size = idx === 0 ? 4 : 3;
    minimapCtx.fillRect(x - size / 2, y - size / 2, size, size);
  });

  minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  minimapCtx.lineWidth = 1.2;
  minimapCtx.strokeRect(camera.x * sx, camera.y * sy, visibleW * sx, visibleH * sy);
}

function render() {
  ctx.save();
  if (shake > 0) {
    const dx = (Math.random() - 0.5) * shake;
    const dy = (Math.random() - 0.5) * shake;
    ctx.translate(dx, dy);
    shake *= 0.85;
  }
  ctx.translate(-camera.x, -camera.y);
  drawBackground();
  drawSpice();
  drawWorm();
  enemies.forEach(drawEnemy);
  drawParticles();
  ctx.restore();
  drawDirectionLine();
  drawSpiceGuide();
  drawEdgeWarning();
  drawMinimap();
}

function loop(time) {
  const delta = rafLastTime === 0 ? (1000 / 60) : Math.max(0, Math.min(64, time - rafLastTime));
  rafLastTime = time;
  if (running) {
    advanceSimulation(delta);
  }
  render();
  if (!statusSticky && statusEl && simTime > statusUntil) {
    statusEl.classList.add('hidden');
  }
  requestAnimationFrame(loop);
}

function advanceSimulation(ms) {
  if (!running) return;
  const dt = Math.max(0, Math.min(250, ms));
  simTime += dt;
  playerAccum += dt;
  enemyAccum += dt;

  let guard = 0;
  while (running && guard < 60) {
    const diagonal = direction.x !== 0 && direction.y !== 0;
    const slowFactor = simTime < slowMoUntil ? 1.6 : 1;
    const playerInterval = (stepTime * slowFactor * (diagonal ? 1.45 : 1)) / gameplaySpeedMultiplier;
    if (playerAccum < playerInterval) break;
    playerAccum -= playerInterval;
    updateDirectionToPointer();
    step();
    guard += 1;
  }

  guard = 0;
  while (running && guard < 60) {
    const slowFactor = simTime < slowMoUntil ? 1.6 : 1;
    const enemyInterval = (enemyStepTime * slowFactor) / gameplaySpeedMultiplier;
    if (enemyAccum < enemyInterval) break;
    enemyAccum -= enemyInterval;
    moveEnemies();
    resolveEnemyCollisions();
    guard += 1;
  }
}

function renderGameToText() {
  const head = worm[0] || null;
  const payload = {
    mode: running ? 'running' : (hasStarted ? 'paused' : 'menu'),
    coords: 'origin:(0,0) top-left, +x:right, +y:down, units:grid cells',
    world: { cols, rows, viewWidth, viewHeight, cameraX: camera.x, cameraY: camera.y },
    player: head ? {
      head: { x: head.x, y: head.y },
      direction: { x: direction.x, y: direction.y },
      nextDirection: { x: nextDirection.x, y: nextDirection.y },
      length: worm.length,
    } : null,
    pointer: { active: pointer.active, x: pointer.x, y: pointer.y },
    controls: {
      move: 'arrow-keys-or-wasd',
      pauseResume: 'space',
      restart: 'r',
      fullscreen: 'f',
    },
    enemies: enemies.map((enemy) => ({
      head: { x: enemy.segments[0].x, y: enemy.segments[0].y },
      length: enemy.segments.length,
    })),
    spices: spices.map((sp) => ({
      x: sp.x,
      y: sp.y,
      name: sp.type.name,
      value: sp.type.value,
    })),
    score,
    best,
    stepTime,
    enemyStepTime,
    slowMoActive: simTime < slowMoUntil,
  };
  return JSON.stringify(payload);
}

function handlePointerMove(event, applyDirection = true) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (event.clientX - rect.left) * scaleX;
  const my = (event.clientY - rect.top) * scaleY;
  const worldX = mx + camera.x;
  const worldY = my + camera.y;
  pointer.x = Math.max(0, Math.min(worldWidth, worldX));
  pointer.y = Math.max(0, Math.min(worldHeight, worldY));
  pointer.active = true;
  if (!applyDirection) return;
  const head = worm[0];
  const hx = head.x * gridSize + gridSize / 2;
  const hy = head.y * gridSize + gridSize / 2;
  const dx = pointer.x - hx;
  const dy = pointer.y - hy;
  const deadZone = 6;
  const dist = Math.hypot(dx, dy);
  if (dist < deadZone) return;
  const dir = chooseDirectionFromTarget(dx, dy, direction);
  setDirection(dir, true);
}

function wrappedDelta(delta, max) {
  if (Math.abs(delta) <= max / 2) return delta;
  return delta > 0 ? delta - max : delta + max;
}

function updateDirectionToPointer() {
  if (!pointer.active) return;
  const head = worm[0];
  const hx = head.x * gridSize + gridSize / 2;
  const hy = head.y * gridSize + gridSize / 2;
  let dx = pointer.x - hx;
  let dy = pointer.y - hy;
  dx = wrappedDelta(dx, worldWidth);
  dy = wrappedDelta(dy, worldHeight);
  const deadZone = 6;
  const dist = Math.hypot(dx, dy);
  if (dist < gridSize * 0.5) {
    pointer.active = false;
    return;
  }
  if (dist < deadZone) return;
  const dir = chooseDirectionFromTarget(dx, dy, direction);
  setDirection(dir, true);
}

function directionFromAngle(dx, dy) {
  const angle = Math.atan2(dy, dx);
  const sector = Math.PI / 4;
  let index = Math.round(angle / sector);
  index = (index + 8) % 8;
  const dirs = [
    { x: 1, y: 0 },   // right
    { x: 1, y: 1 },   // down-right
    { x: 0, y: 1 },   // down
    { x: -1, y: 1 },  // down-left
    { x: -1, y: 0 },  // left
    { x: -1, y: -1 }, // up-left
    { x: 0, y: -1 },  // up
    { x: 1, y: -1 },  // up-right
  ];
  return dirs[index];
}

function chooseDirectionFromTarget(dx, dy, currentDir) {
  const targetDir = directionFromAngle(dx, dy);
  const targetAngle = Math.atan2(targetDir.y, targetDir.x);
  const currentAngle = Math.atan2(currentDir.y, currentDir.x);
  let diff = targetAngle - currentAngle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const absDiff = Math.abs(diff);
  if (absDiff > (Math.PI * 0.75)) {
    return { x: -currentDir.x, y: -currentDir.y };
  }
  return targetDir;
}

function handleTouchMove(event) {
  if (touchId === null) return;
  const touch = Array.from(event.touches).find(t => t.identifier === touchId);
  if (!touch) return;
  handlePointerMove(touch, true);
}

function startGame() {
  if (running) return;
  initAudio();
  resetGame();
  running = true;
  document.body.classList.add('running');
  toggleBtn.textContent = 'Pause';
}

function restartGame() {
  initAudio();
  resetGame();
  running = true;
  document.body.classList.add('running');
  toggleBtn.textContent = 'Pause';
}

function createEnemies(count) {
  const presets = [
    { head: '#3c5a7a', body: '#2c3c55', ring: 'rgba(180, 210, 255, 0.4)' },
    { head: '#7b2f3a', body: '#52222a', ring: 'rgba(255, 190, 200, 0.35)' },
    { head: '#256d4a', body: '#1b4a33', ring: 'rgba(170, 255, 210, 0.35)' },
    { head: '#6d4a1a', body: '#4b3212', ring: 'rgba(255, 225, 170, 0.35)' },
  ];
  const list = [];
  for (let i = 0; i < count; i++) {
    const length = 4 + Math.floor(Math.random() * 4);
    let x, y;
    do {
      x = Math.floor(Math.random() * cols);
      y = Math.floor(Math.random() * rows);
    } while (worm.some(seg => seg.x === x && seg.y === y));
    const dir = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }][Math.floor(Math.random() * 4)];
    const segments = Array.from({ length }, (_, idx) => ({ x: x - dir.x * idx, y: y - dir.y * idx }));
    list.push({ segments, dir, ...presets[i % presets.length] });
  }
  return list;
}

function ensureEnemyCount() {
  const target = enemyTargetCount;
  if (enemies.length >= target) return;
  const add = target - enemies.length;
  enemies.push(...createEnemies(add));
}

function growEnemyBy(enemy, eatenLength) {
  if (!enemy || eatenLength <= 0) return;
  const tail = enemy.segments[enemy.segments.length - 1];
  if (!tail) return;
  for (let i = 0; i < eatenLength; i++) {
    enemy.segments.push({ ...tail });
  }
}

function turnRandomly(dir) {
  const options = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
    { x: -1, y: -1 },
  ];
  const filtered = options.filter(d => !(d.x + dir.x === 0 && d.y + dir.y === 0));
  return filtered[Math.floor(Math.random() * filtered.length)];
}

function moveEnemies() {
  enemies.forEach(enemy => {
    if (Math.random() < 0.05 && enemy.segments.length < 10) {
      enemy.segments.push({ ...enemy.segments[enemy.segments.length - 1] });
    }
    if (Math.random() < 0.25) {
      enemy.dir = turnRandomly(enemy.dir);
    }
    if (Math.random() < 0.22) {
      const head = enemy.segments[0];
      const targetEnemy = enemies.length > 1 && Math.random() < 0.7
        ? enemies.filter(e => e !== enemy)[Math.floor(Math.random() * (enemies.length - 1))]
        : null;
      const target = targetEnemy ? targetEnemy.segments[0] : worm[0];
      const dx = target.x - head.x;
      const dy = target.y - head.y;
      const dirX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
      const dirY = dy === 0 ? 0 : dy > 0 ? 1 : -1;
      if (dirX !== 0 || dirY !== 0) {
        enemy.dir = { x: dirX, y: dirY };
      }
    }
    if (Math.random() < 0.15) {
      enemy.dir = turnRandomly(enemy.dir);
    }
    const occupiedByOthers = (x, y) => {
      if (worm.some(seg => seg.x === x && seg.y === y)) return true;
      return enemies.some(other => other !== enemy && other.segments.some(seg => seg.x === x && seg.y === y));
    };

    let head = { x: enemy.segments[0].x + enemy.dir.x, y: enemy.segments[0].y + enemy.dir.y };
    let attempts = 0;
    while (attempts < 5 && (
      head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows || occupiedByOthers(head.x, head.y)
    )) {
      enemy.dir = turnRandomly(enemy.dir);
      head = { x: enemy.segments[0].x + enemy.dir.x, y: enemy.segments[0].y + enemy.dir.y };
      attempts += 1;
    }

    if (head.x >= 0 && head.x < cols && head.y >= 0 && head.y < rows && !occupiedByOthers(head.x, head.y)) {
      enemy.segments.unshift(head);
      enemy.segments.pop();
    }

  });
}

function updateCamera() {
  const margin = 150;
  const head = worm[0];
  if (!head) return;
  const hx = head.x * gridSize + gridSize / 2;
  const hy = head.y * gridSize + gridSize / 2;

  if (hx - camera.x < margin) camera.x = hx - margin;
  if (hy - camera.y < margin) camera.y = hy - margin;
  if (hx - camera.x > viewWidth - margin) camera.x = hx - (viewWidth - margin);
  if (hy - camera.y > viewHeight - margin) camera.y = hy - (viewHeight - margin);

  camera.x = Math.max(0, Math.min(camera.x, worldWidth - viewWidth));
  camera.y = Math.max(0, Math.min(camera.y, worldHeight - viewHeight));
}

function resolveEnemyCollisions() {
  const playerLen = worm.length;
  const toRemove = new Set();

  enemies.forEach((enemy, idx) => {
    const enemyLen = enemy.segments.length;
    const playerHead = worm[0];
    const enemyHead = enemy.segments[0];
    const headToHead = unitsOverlap(playerHead, enemyHead);
    const hitEnemy = enemy.segments.some(seg => unitsOverlap(seg, playerHead));
    if (hitEnemy) {
      if (playerLen > enemyLen) {
        score += 20 + enemyLen * 2;
        shake = 10;
        slowMoUntil = simTime + 350;
        sfxEnemyEaten();
        spawnBurst(enemy.segments[0].x, enemy.segments[0].y, enemy.head);
        toRemove.add(idx);
      }
    }

    if (headToHead) {
      if (enemyLen >= playerLen) {
        sfxPlayerHit();
        spawnBurst(playerHead.x, playerHead.y, '#d55d3a');
        slowMoUntil = simTime + 400;
        gameOver();
      } else {
        score += 10 + enemyLen;
        shake = 10;
        slowMoUntil = simTime + 350;
        sfxEnemyEaten();
        spawnBurst(enemyHead.x, enemyHead.y, enemy.head);
        toRemove.add(idx);
      }
    }
  });

  for (let i = 0; i < enemies.length; i++) {
    if (toRemove.has(i)) continue;
    for (let j = i + 1; j < enemies.length; j++) {
      if (toRemove.has(j)) continue;
      const a = enemies[i];
      const b = enemies[j];
      const aHead = a.segments[0];
      const bHead = b.segments[0];
      const aHitsB = b.segments.some(seg => unitsOverlap(seg, aHead));
      const bHitsA = a.segments.some(seg => unitsOverlap(seg, bHead));
      if (!aHitsB && !bHitsA) continue;
      if (a.segments.length > b.segments.length) {
        growEnemyBy(a, b.segments.length);
        spawnBurst(bHead.x, bHead.y, b.head);
        toRemove.add(j);
      } else if (b.segments.length > a.segments.length) {
        growEnemyBy(b, a.segments.length);
        spawnBurst(aHead.x, aHead.y, a.head);
        toRemove.add(i);
        break;
      } else {
        // Equal length: pick one winner so a single enemy remains and "eats" the other.
        if (Math.random() < 0.5) {
          growEnemyBy(a, b.segments.length);
          spawnBurst(bHead.x, bHead.y, b.head);
          toRemove.add(j);
        } else {
          growEnemyBy(b, a.segments.length);
          spawnBurst(aHead.x, aHead.y, a.head);
          toRemove.add(i);
          break;
        }
        break;
      }
    }
  }

  if (toRemove.size > 0) {
    enemies = enemies.filter((_, idx) => !toRemove.has(idx));
  }
  ensureEnemyCount();
}

function spawnBurst(gridX, gridY, color) {
  const cx = gridX * gridSize + gridSize / 2;
  const cy = gridY * gridSize + gridSize / 2;
  const count = 14;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.6 + Math.random() * 1.8;
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 2 + Math.random() * 2.5,
      life: 28 + Math.floor(Math.random() * 16),
      maxLife: 44,
      color,
    });
  }
}

function toggleGame() {
  if (!running) {
    if (hasStarted) {
      running = true;
      document.body.classList.add('running');
      overlay.classList.remove('show');
      toggleBtn.textContent = 'Pause';
      return;
    }
    startGame();
    return;
  }
  running = false;
  document.body.classList.remove('running');
  overlay.classList.add('show');
  toggleBtn.textContent = 'Resume';
}

async function toggleFullscreen() {
  const target = canvas.parentElement || canvas;
  if (!document.fullscreenElement) {
    try {
      await target.requestFullscreen();
    } catch (_) {
      return;
    }
  } else {
    await document.exitFullscreen();
  }
}

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  initAudio();
  handlePointerMove(event, true);
});

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'arrowup' || key === 'w') {
    event.preventDefault();
    setDirection({ x: 0, y: -1 }, true);
    pointer.active = false;
    return;
  }
  if (key === 'arrowdown' || key === 's') {
    event.preventDefault();
    setDirection({ x: 0, y: 1 }, true);
    pointer.active = false;
    return;
  }
  if (key === 'arrowleft' || key === 'a') {
    event.preventDefault();
    setDirection({ x: -1, y: 0 }, true);
    pointer.active = false;
    return;
  }
  if (key === 'arrowright' || key === 'd') {
    event.preventDefault();
    setDirection({ x: 1, y: 0 }, true);
    pointer.active = false;
    return;
  }
  if (event.key === ' ') {
    event.preventDefault();
    toggleGame();
    return;
  }
  if (key === 'r') {
    event.preventDefault();
    restartGame();
    return;
  }
  if (key === 'f') {
    event.preventDefault();
    toggleFullscreen();
  }
});

window.addEventListener('mouseleave', () => {
  pointer.active = false;
});

canvas.addEventListener('touchstart', (event) => {
  if (event.touches.length === 0) return;
  initAudio();
  const touch = event.touches[0];
  touchId = touch.identifier;
  handlePointerMove(touch, true);
}, { passive: true });

window.addEventListener('touchmove', (event) => {
  handleTouchMove(event);
}, { passive: true });

window.addEventListener('touchend', (event) => {
  const ended = Array.from(event.changedTouches).some(t => t.identifier === touchId);
  if (ended) {
    touchId = null;
    pointer.active = false;
  }
});

playBtn.addEventListener('click', () => {
  startGame();
});

toggleBtn.addEventListener('click', () => {
  toggleGame();
});

preloadImages();
resizeCanvas();
window.addEventListener('fullscreenchange', () => {
  setTimeout(resizeCanvas, 0);
});
window.addEventListener('resize', resizeCanvas);
resetGame();
window.render_game_to_text = renderGameToText;
window.advanceTime = (ms) => {
  const total = Math.max(0, Number(ms) || 0);
  if (total === 0) {
    render();
    return;
  }
  const fixedStep = 1000 / 60;
  let remaining = total;
  while (remaining > 0) {
    const chunk = Math.min(fixedStep, remaining);
    advanceSimulation(chunk);
    remaining -= chunk;
  }
  render();
  if (!statusSticky && statusEl && simTime > statusUntil) {
    statusEl.classList.add('hidden');
  }
};
requestAnimationFrame(loop);

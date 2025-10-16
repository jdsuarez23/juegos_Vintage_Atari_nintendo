// Missile Command (Atari 1980) - Defender ciudades de misiles
// Controles: Mouse para apuntar y disparar, R reinicia
// Objetivo: Destruir misiles enemigos antes de que impacten en tus ciudades

import {Input} from './engine.js';

let canvas, ctx, input;
const W = 860, H = 560;

let bases = []; // {x, y, missiles}
let cities = []; // {x, y, alive}
let missiles = []; // {x, y, tx, ty, speed, enemy}
let explosions = []; // {x, y, r, growing, maxR}
let level = 1, score = 0, best = 0, gameOver = false;
let mouseX = W / 2, mouseY = H / 2;
let speedFactor = 1;
const MAX_SPEED_FACTOR = 2.0, MIN_SPEED_FACTOR = 0.5;
let _incHeld = false, _decHeld = false;

const BASE_Y = H - 50;
const CITY_Y = H - 40;
const BASE_MISSILES = 10;

export function init(c, inp) {
  canvas = c;
  ctx = canvas.getContext('2d');
  input = inp;
  
  // Setup mouse tracking
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  });
  
  canvas.addEventListener('click', () => {
    fireMissile();
  });
  
  const b = localStorage.getItem('best_missilecommand');
  if (b) best = parseInt(b) || 0;
  
  reset();
}

export function restart() {
  level = 1;
  score = 0;
  gameOver = false;
  speedFactor = 1;
  reset();
}

function reset() {
  // 3 bases de misiles
  bases = [
    { x: 100, y: BASE_Y, missiles: BASE_MISSILES },
    { x: W / 2, y: BASE_Y, missiles: BASE_MISSILES },
    { x: W - 100, y: BASE_Y, missiles: BASE_MISSILES }
  ];
  
  // 6 ciudades entre las bases
  cities = [
    { x: 200, y: CITY_Y, alive: true },
    { x: 280, y: CITY_Y, alive: true },
    { x: 360, y: CITY_Y, alive: true },
    { x: 500, y: CITY_Y, alive: true },
    { x: 580, y: CITY_Y, alive: true },
    { x: 660, y: CITY_Y, alive: true }
  ];
  
  missiles = [];
  explosions = [];
}

function spawnEnemyMissile() {
  const startX = Math.random() * W;
  const startY = 0;
  
  // Apuntar a ciudad o base aleatoria
  let targets = [];
  cities.forEach(c => { if (c.alive) targets.push({ x: c.x, y: c.y }); });
  bases.forEach(b => { if (b.missiles > 0) targets.push({ x: b.x, y: b.y }); });
  
  if (targets.length === 0) return;
  
  const target = targets[Math.floor(Math.random() * targets.length)];
  const speed = (40 + level * 5 + Math.random() * 20) * speedFactor;
  
  missiles.push({
    x: startX,
    y: startY,
    tx: target.x,
    ty: target.y,
    speed,
    enemy: true,
    trail: []
  });
}

function fireMissile() {
  if (gameOver) return;
  
  // Encontrar base más cercana con misiles
  let nearestBase = null;
  let nearestDist = Infinity;
  
  for (const base of bases) {
    if (base.missiles <= 0) continue;
    const dist = Math.hypot(mouseX - base.x, mouseY - base.y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestBase = base;
    }
  }
  
  if (!nearestBase) return;
  
  nearestBase.missiles--;
  
  missiles.push({
    x: nearestBase.x,
    y: nearestBase.y,
    tx: mouseX,
    ty: mouseY,
    speed: 400 * speedFactor,
    enemy: false,
    trail: []
  });
}

export function update(dt) {
  if (input.pressed('r')) {
    restart();
    input.keys.delete('r');
  }
  
  if (gameOver) return;
  
  handleInput(dt);
  updateMissiles(dt);
  updateExplosions(dt);
  checkCollisions();
  
  // Spawn enemigos
  if (Math.random() < (0.008 + level * 0.002) * speedFactor) {
    spawnEnemyMissile();
  }
  
  // Victoria temporal (fin de oleada)
  if (missiles.filter(m => m.enemy).length === 0 && explosions.length === 0) {
    // Bonus por ciudades y misiles restantes
    const bonus = cities.filter(c => c.alive).length * 100 +
                  bases.reduce((sum, b) => sum + b.missiles * 5, 0);
    score += bonus;
    saveBest();
    
    level++;
    
    // Reponer misiles
    bases.forEach(b => {
      if (b.missiles < BASE_MISSILES) b.missiles = Math.min(BASE_MISSILES, b.missiles + 5);
    });
    
    missiles = [];
    explosions = [];
  }
  
  // Game over si todas las ciudades destruidas
  if (cities.every(c => !c.alive)) {
    gameOver = true;
  }
}

function handleInput(dt) {
  // Control velocidad
  if (input.pressed('=', '+')) {
    if (!_incHeld) {
      speedFactor = Math.min(MAX_SPEED_FACTOR, speedFactor + 0.1);
      _incHeld = true;
    }
  } else _incHeld = false;
  
  if (input.pressed('-', '_')) {
    if (!_decHeld) {
      speedFactor = Math.max(MIN_SPEED_FACTOR, speedFactor - 0.1);
      _decHeld = true;
    }
  } else _decHeld = false;
}

function updateMissiles(dt) {
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    
    // Calcular dirección
    const dx = m.tx - m.x;
    const dy = m.ty - m.y;
    const dist = Math.hypot(dx, dy);
    
    if (dist < 5) {
      // Llegar al destino
      missiles.splice(i, 1);
      
      if (m.enemy) {
        // Explosión enemiga (daña ciudades/bases)
        createExplosion(m.tx, m.ty, 30, true);
      } else {
        // Explosión defensiva
        createExplosion(m.tx, m.ty, 50, false);
      }
      continue;
    }
    
    // Mover
    const vx = (dx / dist) * m.speed;
    const vy = (dy / dist) * m.speed;
    m.x += vx * dt;
    m.y += vy * dt;
    
    // Trail
    m.trail.push({ x: m.x, y: m.y });
    if (m.trail.length > 15) m.trail.shift();
  }
}

function createExplosion(x, y, maxR, enemy) {
  explosions.push({
    x,
    y,
    r: 0,
    maxR,
    growing: true,
    enemy,
    life: 2.0
  });
}

function updateExplosions(dt) {
  for (let i = explosions.length - 1; i >= 0; i--) {
    const ex = explosions[i];
    
    ex.life -= dt;
    
    if (ex.growing) {
      ex.r += 80 * dt * speedFactor;
      if (ex.r >= ex.maxR) {
        ex.r = ex.maxR;
        ex.growing = false;
      }
    }
    
    if (ex.life <= 0) {
      explosions.splice(i, 1);
    }
  }
}

function checkCollisions() {
  // Misiles enemigos en explosiones defensivas
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    if (!m.enemy) continue;
    
    for (const ex of explosions) {
      if (ex.enemy) continue;
      
      const dist = Math.hypot(m.x - ex.x, m.y - ex.y);
      if (dist < ex.r) {
        missiles.splice(i, 1);
        score += 25;
        saveBest();
        break;
      }
    }
  }
  
  // Explosiones enemigas dañan ciudades y bases
  for (const ex of explosions) {
    if (!ex.enemy || ex.r < ex.maxR * 0.5) continue;
    
    // Ciudades
    for (const city of cities) {
      if (!city.alive) continue;
      const dist = Math.hypot(city.x - ex.x, city.y - ex.y);
      if (dist < ex.r + 15) {
        city.alive = false;
      }
    }
    
    // Bases
    for (const base of bases) {
      if (base.missiles <= 0) continue;
      const dist = Math.hypot(base.x - ex.x, base.y - ex.y);
      if (dist < ex.r + 20) {
        base.missiles = 0;
      }
    }
  }
}

function saveBest() {
  if (score > best) {
    best = score;
    localStorage.setItem('best_missilecommand', best);
  }
}

export function draw() {
  // Cielo nocturno
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, '#001133');
  gradient.addColorStop(1, '#000811');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
  
  // Estrellas
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 80; i++) {
    const x = (i * 73) % W;
    const y = (i * 41) % (H - 100);
    ctx.fillRect(x, y, 1, 1);
  }
  
  // Suelo
  ctx.fillStyle = '#2a1810';
  ctx.fillRect(0, H - 60, W, 60);
  
  // Ciudades
  for (const city of cities) {
    if (!city.alive) continue;
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(city.x - 15, city.y - 20, 30, 20);
    ctx.fillRect(city.x - 8, city.y - 30, 16, 10);
  }
  
  // Bases
  for (const base of bases) {
    ctx.fillStyle = base.missiles > 0 ? '#00ff00' : '#333';
    ctx.beginPath();
    ctx.arc(base.x, base.y, 20, 0, Math.PI, true);
    ctx.fill();
    
    if (base.missiles > 0) {
      ctx.fillStyle = '#fff';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(base.missiles, base.x, base.y - 5);
      ctx.textAlign = 'left';
    }
  }
  
  // Misiles
  for (const m of missiles) {
    // Trail
    ctx.strokeStyle = m.enemy ? '#ff0000' : '#00ff00';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    for (let i = 0; i < m.trail.length; i++) {
      const p = m.trail[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    
    // Punta
    ctx.fillStyle = m.enemy ? '#ff0000' : '#00ff00';
    ctx.beginPath();
    ctx.arc(m.x, m.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Explosiones
  for (const ex of explosions) {
    const alpha = ex.life / 2.0;
    ctx.globalAlpha = alpha;
    
    // Núcleo
    const grad = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, ex.r);
    grad.addColorStop(0, ex.enemy ? '#ff8800' : '#ffff00');
    grad.addColorStop(0.4, ex.enemy ? '#ff0000' : '#ff8800');
    grad.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, ex.r, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.globalAlpha = 1;
  }
  
  // Crosshair
  if (!gameOver) {
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mouseX - 10, mouseY);
    ctx.lineTo(mouseX + 10, mouseY);
    ctx.moveTo(mouseX, mouseY - 10);
    ctx.lineTo(mouseX, mouseY + 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 8, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // HUD
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, W, 50);
  ctx.fillStyle = '#fff';
  ctx.font = '14px monospace';
  ctx.fillText(`Missile Command | Level:${level} Score:${score} Best:${best} Speed:${speedFactor.toFixed(2)} (=/-)`, 20, 25);
  ctx.fillText(`Cities:${cities.filter(c => c.alive).length} Missiles:${bases.reduce((s, b) => s + b.missiles, 0)}`, 20, 42);
  
  if (gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff0000';
    ctx.font = '48px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('THE END', W / 2, H / 2);
    ctx.font = '20px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText('All cities destroyed', W / 2, H / 2 + 40);
    ctx.fillText('Press R to restart', W / 2, H / 2 + 70);
    ctx.fillText(`Final Score: ${score}`, W / 2, H / 2 + 100);
    ctx.textAlign = 'left';
  }
}

export function getStatus() {
  return `Missile Command | Lvl:${level} Score:${score} Cities:${cities.filter(c => c.alive).length}`;
}

// Frogger (1981) - Versión mejorada
// Controles: Flechas/WASD para saltar, R reinicia
// Objetivo: Llevar ranas a sus casas evitando autos y cruzando troncos

import {Input} from './engine.js';

let canvas, ctx, input;
const W = 860, H = 560;

const TILE = 40;
const ROWS = 13;
const COLS = Math.floor(W / TILE);

let frog; // {x, y, jumping, jumpTimer, dir, animTimer}
let lanes = []; // {y, type:'road'|'water'|'safe', dir, speed, items:[]}
let homes = []; // {x, occupied, animTimer}
let score = 0, lives = 3, level = 1, best = 0, gameOver = false;
let timer = 60;
let speedFactor = 1;
const MAX_SPEED_FACTOR = 2.0, MIN_SPEED_FACTOR = 0.5;
let _incHeld = false, _decHeld = false;
let particles = []; // Efectos visuales

export function init(c, inp) {
  canvas = c;
  ctx = canvas.getContext('2d');
  input = inp;
  const b = localStorage.getItem('best_frogger');
  if (b) best = parseInt(b) || 0;
  reset();
}

export function restart() {
  level = 1;
  score = 0;
  lives = 3;
  gameOver = false;
  speedFactor = 1;
  particles = [];
  reset();
}

function reset() {
  frog = { 
    x: Math.floor(COLS / 2) * TILE, 
    y: (ROWS - 1) * TILE, 
    jumping: false, 
    jumpTimer: 0, 
    dir: 0,
    animTimer: 0
  };
  timer = 60;
  buildLanes();
  buildHomes();
}

function buildHomes() {
  homes = [];
  const homeY = 0;
  const spacing = W / 6;
  for (let i = 1; i < 6; i++) {
    homes.push({ 
      x: i * spacing, 
      y: homeY, 
      occupied: false,
      animTimer: 0
    });
  }
}

function buildLanes() {
  lanes = [];
  
  // Fila superior - casas
  lanes.push({ y: 0, type: 'goal', dir: 0, speed: 0, items: [] });
  
  // Río (5 filas) - dificultad progresiva
  lanes.push({ y: TILE * 1, type: 'water', dir: 1, speed: 50 + level * 8, items: [] });
  lanes.push({ y: TILE * 2, type: 'water', dir: -1, speed: 70 + level * 10, items: [] });
  lanes.push({ y: TILE * 3, type: 'water', dir: 1, speed: 60 + level * 9, items: [] });
  lanes.push({ y: TILE * 4, type: 'water', dir: -1, speed: 55 + level * 7, items: [] });
  lanes.push({ y: TILE * 5, type: 'water', dir: 1, speed: 80 + level * 12, items: [] });
  
  // Zona segura
  lanes.push({ y: TILE * 6, type: 'safe', dir: 0, speed: 0, items: [] });
  
  // Carretera (5 filas) - dificultad progresiva
  lanes.push({ y: TILE * 7, type: 'road', dir: -1, speed: 90 + level * 15, items: [] });
  lanes.push({ y: TILE * 8, type: 'road', dir: 1, speed: 70 + level * 12, items: [] });
  lanes.push({ y: TILE * 9, type: 'road', dir: -1, speed: 100 + level * 18, items: [] });
  lanes.push({ y: TILE * 10, type: 'road', dir: 1, speed: 80 + level * 14, items: [] });
  lanes.push({ y: TILE * 11, type: 'road', dir: -1, speed: 95 + level * 16, items: [] });
  
  // Zona inicial
  lanes.push({ y: TILE * 12, type: 'safe', dir: 0, speed: 0, items: [] });
  
  // Spawn items iniciales
  for (const lane of lanes) {
    if (lane.type === 'water') {
      // Troncos con variación
      const count = 2 + Math.floor(Math.random() * 2);
      const spacing = W / count;
      for (let i = 0; i < count; i++) {
        lane.items.push({
          x: i * spacing + Math.random() * spacing * 0.3,
          w: TILE * (2 + Math.floor(Math.random() * 3)),
          type: 'log'
        });
      }
    } else if (lane.type === 'road') {
      // Autos con variación
      const count = 1 + Math.floor(Math.random() * 3);
      const spacing = W / count;
      for (let i = 0; i < count; i++) {
        lane.items.push({
          x: i * spacing + Math.random() * spacing * 0.3,
          w: TILE * (1.5 + Math.random() * 1),
          type: 'car',
          color: lane.dir > 0 ? '#ff0000' : '#00ff00'
        });
      }
    }
  }
}

export function update(dt) {
  if (input.pressed('r')) {
    restart();
    input.keys.delete('r');
  }
  
  if (gameOver) return;
  
  handleInput(dt);
  updateFrog(dt);
  updateLanes(dt);
  checkCollisions();
  updateParticles(dt);
  
  // Timer
  timer -= dt * speedFactor;
  if (timer <= 0) {
    loseLife();
  }
  
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

function handleInput(dt) {
  if (frog.jumping) return;
  
  let jumped = false;
  
  if (input.pressed('arrowup', 'w')) {
    if (!handleInput._up) {
      frog.dir = 0;
      frog.y -= TILE;
      jumped = true;
      score += 10;
      handleInput._up = true;
    }
  } else handleInput._up = false;
  
  if (input.pressed('arrowdown', 's')) {
    if (!handleInput._down) {
      frog.dir = 2;
      frog.y += TILE;
      jumped = true;
      handleInput._down = true;
    }
  } else handleInput._down = false;
  
  if (input.pressed('arrowleft', 'a')) {
    if (!handleInput._left) {
      frog.dir = 3;
      frog.x -= TILE;
      jumped = true;
      handleInput._left = true;
    }
  } else handleInput._left = false;
  
  if (input.pressed('arrowright', 'd')) {
    if (!handleInput._right) {
      frog.dir = 1;
      frog.x += TILE;
      jumped = true;
      handleInput._right = true;
    }
  } else handleInput._right = false;
  
  if (jumped) {
    frog.jumping = true;
    frog.jumpTimer = 0.2;
    frog.animTimer = 0;
  }
  
  // Límites con wrap-around para el río
  if (frog.x < -TILE) frog.x = W;
  if (frog.x > W) frog.x = -TILE;
  frog.y = Math.max(0, Math.min((ROWS - 1) * TILE, frog.y));
}

function updateFrog(dt) {
  if (frog.jumping) {
    frog.jumpTimer -= dt;
    frog.animTimer += dt;
    if (frog.jumpTimer <= 0) {
      frog.jumping = false;
    }
  }
  
  // Si está en agua, debe estar en un tronco
  const frogRow = Math.floor(frog.y / TILE);
  const lane = lanes.find(l => Math.floor(l.y / TILE) === frogRow);
  
  if (lane && lane.type === 'water' && !frog.jumping) {
    let onLog = false;
    for (const item of lane.items) {
      // Detección mejorada - considerar el centro de la rana y un margen
      const frogCenterX = frog.x + TILE / 2;
      const logCenterX = item.x + item.w / 2;
      const dist = Math.abs(frogCenterX - logCenterX);
      
      if (dist < (item.w + TILE) / 2) {
        onLog = true;
        // Moverse con el tronco
        frog.x += lane.dir * lane.speed * dt * speedFactor;
        break;
      }
    }
    
    if (!onLog) {
      createSplashEffect(frog.x + TILE/2, frog.y + TILE/2);
      loseLife();
    }
  }
  
  // Llegar a una casa
  if (frogRow === 0 && !frog.jumping) {
    let reachedHome = false;
    for (const home of homes) {
      // Detección mejorada - verificar si el centro de la rana está en el área de la casa
      const frogCenterX = frog.x + TILE / 2;
      const homeCenterX = home.x;
      const distToHome = Math.abs(frogCenterX - homeCenterX);
      
      if (!home.occupied && distToHome < TILE * 0.8) {
        home.occupied = true;
        home.animTimer = 0.5;
        score += 200 + Math.floor(timer) * 2;
        reachedHome = true;
        
        // Efecto visual
        createHomeEffect(home.x, home.y);
        
        // Reset frog
        frog.x = Math.floor(COLS / 2) * TILE;
        frog.y = (ROWS - 1) * TILE;
        frog.jumping = false;
        timer = 60;
        saveBest();
        
        // Victoria - todas las casas ocupadas
        if (homes.every(h => h.occupied)) {
          level++;
          score += 1000 * level;
          buildLanes();
          homes.forEach(h => {
            h.occupied = false;
            h.animTimer = 0;
          });
          frog.x = Math.floor(COLS / 2) * TILE;
          frog.y = (ROWS - 1) * TILE;
          timer = 60;
          saveBest();
        }
        break;
      }
    }
    
    if (!reachedHome) {
      // Cayó en el agua entre casas
      createSplashEffect(frog.x + TILE/2, frog.y + TILE/2);
      loseLife();
    }
  }
}

function updateLanes(dt) {
  for (const lane of lanes) {
    if (lane.speed === 0) continue;
    
    for (const item of lane.items) {
      item.x += lane.dir * lane.speed * dt * speedFactor;
      
      // Wrap around
      if (lane.dir > 0 && item.x > W) {
        item.x = -item.w;
      } else if (lane.dir < 0 && item.x + item.w < 0) {
        item.x = W;
      }
    }
  }
  
  // Actualizar animaciones de casas
  for (const home of homes) {
    if (home.animTimer > 0) {
      home.animTimer -= dt;
    }
  }
}

function checkCollisions() {
  const frogRow = Math.floor(frog.y / TILE);
  const lane = lanes.find(l => Math.floor(l.y / TILE) === frogRow);
  
  if (lane && lane.type === 'road') {
    for (const car of lane.items) {
      // Detección mejorada
      const frogCenterX = frog.x + TILE / 2;
      const carCenterX = car.x + car.w / 2;
      const dist = Math.abs(frogCenterX - carCenterX);
      
      if (dist < (car.w + TILE) / 2) {
        createHitEffect(frog.x + TILE/2, frog.y + TILE/2);
        loseLife();
        break;
      }
    }
  }
}

function loseLife() {
  lives--;
  if (lives <= 0) {
    gameOver = true;
  } else {
    frog.x = Math.floor(COLS / 2) * TILE;
    frog.y = (ROWS - 1) * TILE;
    timer = 60;
  }
}

function saveBest() {
  if (score > best) {
    best = score;
    localStorage.setItem('best_frogger', best);
  }
}

// Efectos visuales
function createSplashEffect(x, y) {
  for (let i = 0; i < 10; i++) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 100,
      vy: (Math.random() - 0.5) * 100,
      life: 0.5,
      color: '#00aaff'
    });
  }
}

function createHitEffect(x, y) {
  for (let i = 0; i < 15; i++) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 150,
      vy: (Math.random() - 0.5) * 150,
      life: 0.7,
      color: '#ff0000'
    });
  }
}

function createHomeEffect(x, y) {
  for (let i = 0; i < 20; i++) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 80,
      vy: -Math.random() * 100,
      life: 1.0,
      color: '#00ff00'
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

export function draw() {
  // Fondo
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  
  // Dibujar lanes
  for (const lane of lanes) {
    const y = lane.y;
    
    if (lane.type === 'goal') {
      ctx.fillStyle = '#2a4a2a';
      ctx.fillRect(0, y, W, TILE);
    } else if (lane.type === 'water') {
      ctx.fillStyle = '#0044aa';
      ctx.fillRect(0, y, W, TILE);
      // Ondas
      ctx.strokeStyle = '#0066cc';
      ctx.lineWidth = 1;
      for (let i = 0; i < W; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, y + TILE/2);
        ctx.lineTo(i + 10, y + TILE/2 - 5);
        ctx.lineTo(i + 20, y + TILE/2);
        ctx.stroke();
      }
    } else if (lane.type === 'road') {
      ctx.fillStyle = '#333';
      ctx.fillRect(0, y, W, TILE);
      // Líneas amarillas
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(0, y + TILE / 2);
      ctx.lineTo(W, y + TILE / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (lane.type === 'safe') {
      ctx.fillStyle = '#2a552a';
      ctx.fillRect(0, y, W, TILE);
    }
    
    // Dibujar items
    for (const item of lane.items) {
      if (item.type === 'log') {
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(item.x, y + 5, item.w, TILE - 10);
        ctx.fillStyle = '#654321';
        for (let i = 0; i < item.w; i += 20) {
          ctx.fillRect(item.x + i, y + 5, 3, TILE - 10);
        }
      } else if (item.type === 'car') {
        ctx.fillStyle = item.color;
        ctx.fillRect(item.x, y + 8, item.w, TILE - 16);
        // Detalles del auto
        ctx.fillStyle = '#000';
        ctx.fillRect(item.x + item.w * 0.2, y + 12, item.w * 0.2, TILE - 24);
        ctx.fillRect(item.x + item.w * 0.6, y + 12, item.w * 0.2, TILE - 24);
        // Luces
        ctx.fillStyle = item.color === '#ff0000' ? '#ffff00' : '#ffffff';
        ctx.fillRect(item.x + item.w - 5, y + 10, 5, 5);
        ctx.fillRect(item.x + item.w - 5, y + TILE - 15, 5, 5);
      }
    }
  }
  
  // Homes
  for (const home of homes) {
    // Base de la casa
    ctx.fillStyle = home.occupied ? '#00ff00' : '#004400';
    ctx.fillRect(home.x - TILE/2, home.y, TILE, TILE);
    ctx.strokeStyle = '#00aa00';
    ctx.lineWidth = 2;
    ctx.strokeRect(home.x - TILE/2, home.y, TILE, TILE);
    
    // Techo
    ctx.fillStyle = home.occupied ? '#00cc00' : '#003300';
    ctx.beginPath();
    ctx.moveTo(home.x - TILE/2 - 5, home.y);
    ctx.lineTo(home.x, home.y - TILE/2);
    ctx.lineTo(home.x + TILE/2 + 5, home.y);
    ctx.closePath();
    ctx.fill();
    
    // Animación cuando se ocupa
    if (home.animTimer > 0) {
      const scale = 1 + (0.5 - home.animTimer);
      ctx.fillStyle = `rgba(255, 255, 0, ${home.animTimer})`;
      ctx.beginPath();
      ctx.arc(home.x, home.y + TILE/2, TILE * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // Partículas
  for (const p of particles) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
  
  // Frog
  const frogX = frog.x + TILE / 2;
  const frogY = frog.y + TILE / 2;
  const jumpOffset = frog.jumping ? Math.sin(frog.animTimer * 10) * 5 : 0;
  const frogSize = frog.jumping ? TILE * 0.35 : TILE * 0.4;
  
  // Cuerpo
  ctx.fillStyle = '#00ff00';
  ctx.beginPath();
  ctx.arc(frogX, frogY - jumpOffset, frogSize, 0, Math.PI * 2);
  ctx.fill();
  
  // Ojos
  ctx.fillStyle = '#000';
  const eyeOffset = frogSize * 0.4;
  if (frog.dir === 0) { // up
    ctx.fillRect(frogX - 5, frogY - eyeOffset - jumpOffset, 4, 4);
    ctx.fillRect(frogX + 1, frogY - eyeOffset - jumpOffset, 4, 4);
  } else if (frog.dir === 1) { // right
    ctx.fillRect(frogX + eyeOffset - 4, frogY - 5 - jumpOffset, 4, 4);
    ctx.fillRect(frogX + eyeOffset - 4, frogY + 1 - jumpOffset, 4, 4);
  } else if (frog.dir === 2) { // down
    ctx.fillRect(frogX - 5, frogY + eyeOffset - 4 - jumpOffset, 4, 4);
    ctx.fillRect(frogX + 1, frogY + eyeOffset - 4 - jumpOffset, 4, 4);
  } else { // left
    ctx.fillRect(frogX - eyeOffset, frogY - 5 - jumpOffset, 4, 4);
    ctx.fillRect(frogX - eyeOffset, frogY + 1 - jumpOffset, 4, 4);
  }
  
  // HUD
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, H - 45, W, 45);
  ctx.fillStyle = '#fff';
  ctx.font = '14px monospace';
  ctx.fillText(`Frogger | Level:${level} Score:${score} Lives:${lives} Time:${Math.max(0, Math.floor(timer))} Best:${best} Spd:${speedFactor.toFixed(2)}`, 20, H - 20);
  
  // Barra de tiempo
  const timeBarWidth = 200;
  const timePercent = Math.max(0, timer / 60);
  ctx.fillStyle = '#333';
  ctx.fillRect(W - timeBarWidth - 20, H - 35, timeBarWidth, 20);
  ctx.fillStyle = timePercent > 0.3 ? '#00ff00' : '#ff0000';
  ctx.fillRect(W - timeBarWidth - 20, H - 35, timeBarWidth * timePercent, 20);
  
  if (gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff0000';
    ctx.font = '48px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', W / 2, H / 2);
    ctx.font = '20px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText('Press R to restart', W / 2, H / 2 + 50);
    ctx.fillText(`Final Score: ${score}`, W / 2, H / 2 + 80);
    ctx.textAlign = 'left';
  }
}

export function getStatus() {
  return `Frogger | Lvl:${level} Score:${score} Lives:${lives} Time:${Math.max(0, Math.floor(timer))}`;
}
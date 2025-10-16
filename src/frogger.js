// Frogger (1981) - Cruzar carretera y río
// Controles: Flechas/WASD para saltar, R reinicia
// Objetivo: Llevar ranas a sus casas evitando autos y cruzando troncos

import {Input} from './engine.js';

let canvas, ctx, input;
const W = 860, H = 560;

const TILE = 40;
const ROWS = 13;
const COLS = Math.floor(W / TILE);

let frog; // {x, y, jumping, jumpTimer, dir}
let lanes = []; // {y, type:'road'|'water'|'safe', dir, speed, items:[]}
let homes = []; // {x, occupied}
let score = 0, lives = 3, level = 1, best = 0, gameOver = false;
let timer = 60;
let speedFactor = 1;
const MAX_SPEED_FACTOR = 2.0, MIN_SPEED_FACTOR = 0.5;
let _incHeld = false, _decHeld = false;

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
  reset();
}

function reset() {
  frog = { x: Math.floor(COLS / 2) * TILE, y: (ROWS - 1) * TILE, jumping: false, jumpTimer: 0, dir: 0 };
  timer = 60;
  buildLanes();
  buildHomes();
}

function buildHomes() {
  homes = [];
  const homeY = 0;
  const spacing = W / 6;
  for (let i = 1; i < 6; i++) {
    homes.push({ x: i * spacing, y: homeY, occupied: false });
  }
}

function buildLanes() {
  lanes = [];
  
  // Fila superior - casas
  lanes.push({ y: 0, type: 'goal', dir: 0, speed: 0, items: [] });
  
  // Río (5 filas)
  lanes.push({ y: TILE * 1, type: 'water', dir: 1, speed: 50 + level * 5, items: [] });
  lanes.push({ y: TILE * 2, type: 'water', dir: -1, speed: 70 + level * 8, items: [] });
  lanes.push({ y: TILE * 3, type: 'water', dir: 1, speed: 60 + level * 6, items: [] });
  lanes.push({ y: TILE * 4, type: 'water', dir: -1, speed: 55 + level * 5, items: [] });
  lanes.push({ y: TILE * 5, type: 'water', dir: 1, speed: 80 + level * 10, items: [] });
  
  // Zona segura
  lanes.push({ y: TILE * 6, type: 'safe', dir: 0, speed: 0, items: [] });
  
  // Carretera (5 filas)
  lanes.push({ y: TILE * 7, type: 'road', dir: -1, speed: 90 + level * 10, items: [] });
  lanes.push({ y: TILE * 8, type: 'road', dir: 1, speed: 70 + level * 8, items: [] });
  lanes.push({ y: TILE * 9, type: 'road', dir: -1, speed: 100 + level * 12, items: [] });
  lanes.push({ y: TILE * 10, type: 'road', dir: 1, speed: 80 + level * 9, items: [] });
  lanes.push({ y: TILE * 11, type: 'road', dir: -1, speed: 95 + level * 11, items: [] });
  
  // Zona inicial
  lanes.push({ y: TILE * 12, type: 'safe', dir: 0, speed: 0, items: [] });
  
  // Spawn items iniciales
  for (const lane of lanes) {
    if (lane.type === 'water') {
      // Troncos
      const count = 2 + Math.floor(Math.random() * 2);
      const spacing = W / count;
      for (let i = 0; i < count; i++) {
        lane.items.push({
          x: i * spacing + Math.random() * spacing * 0.5,
          w: TILE * (2 + Math.floor(Math.random() * 3)),
          type: 'log'
        });
      }
    } else if (lane.type === 'road') {
      // Autos
      const count = 1 + Math.floor(Math.random() * 3);
      const spacing = W / count;
      for (let i = 0; i < count; i++) {
        lane.items.push({
          x: i * spacing + Math.random() * spacing * 0.5,
          w: TILE * (1.5 + Math.random() * 1),
          type: 'car'
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
    frog.jumpTimer = 0.15;
  }
  
  // Límites
  frog.x = Math.max(0, Math.min(W - TILE, frog.x));
  frog.y = Math.max(0, Math.min((ROWS - 1) * TILE, frog.y));
}

function updateFrog(dt) {
  if (frog.jumping) {
    frog.jumpTimer -= dt;
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
      // Detección más permisiva - considerar centro de la rana
      const frogCenterX = frog.x + TILE / 2;
      if (frogCenterX >= item.x - TILE/4 && frogCenterX <= item.x + item.w + TILE/4) {
        onLog = true;
        // Moverse con el tronco
        frog.x += lane.dir * lane.speed * dt * speedFactor;
        break;
      }
    }
    
    if (!onLog) {
      loseLife();
    }
  }
  
  // Llegar a una casa
  if (frogRow === 0 && !frog.jumping) {
    let reachedHome = false;
    for (const home of homes) {
      // Detección más permisiva - verificar si el centro de la rana está cerca del centro de la casa
      const frogCenterX = frog.x + TILE / 2;
      const homeCenterX = home.x;
      const distToHome = Math.abs(frogCenterX - homeCenterX);
      
      if (!home.occupied && distToHome < TILE * 1.2) {
        home.occupied = true;
        score += 200 + Math.floor(timer) * 2;
        reachedHome = true;
        
        // Reset frog
        frog.x = Math.floor(COLS / 2) * TILE;
        frog.y = (ROWS - 1) * TILE;
        frog.jumping = false;
        timer = 60;
        saveBest();
        
        // Victoria - todas las casas ocupadas
        if (homes.every(h => h.occupied)) {
          level++;
          score += 1000;
          buildLanes();
          homes.forEach(h => h.occupied = false);
          frog.x = Math.floor(COLS / 2) * TILE;
          frog.y = (ROWS - 1) * TILE;
          timer = 60;
          saveBest();
        }
        break;
      }
    }
    
    if (!reachedHome) {
      // Cayó en el agua entre casas o falló el salto - dar una oportunidad
      let onSafety = false;
      for (const home of homes) {
        const frogCenterX = frog.x + TILE / 2;
        const homeCenterX = home.x;
        const distToHome = Math.abs(frogCenterX - homeCenterX);
        if (distToHome < TILE * 1.5) {
          onSafety = true;
          break;
        }
      }
      
      if (!onSafety) {
        loseLife();
      }
    }
  }
  
  // Fuera de pantalla
  if (frog.x < -TILE || frog.x > W) {
    loseLife();
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
}

function checkCollisions() {
  const frogRow = Math.floor(frog.y / TILE);
  const lane = lanes.find(l => Math.floor(l.y / TILE) === frogRow);
  
  if (lane && lane.type === 'road') {
    for (const car of lane.items) {
      if (frog.x + TILE > car.x && frog.x < car.x + car.w) {
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
        ctx.fillStyle = lane.dir > 0 ? '#ff0000' : '#00ff00';
        ctx.fillRect(item.x, y + 8, item.w, TILE - 16);
        ctx.fillStyle = '#000';
        ctx.fillRect(item.x + item.w * 0.3, y + 12, item.w * 0.2, TILE - 24);
      }
    }
  }
  
  // Homes
  for (const home of homes) {
    ctx.fillStyle = home.occupied ? '#00ff00' : '#004400';
    ctx.fillRect(home.x - TILE / 2, home.y, TILE, TILE);
    ctx.strokeStyle = '#00aa00';
    ctx.lineWidth = 2;
    ctx.strokeRect(home.x - TILE / 2, home.y, TILE, TILE);
  }
  
  // Frog
  const frogX = frog.x + TILE / 2;
  const frogY = frog.y + TILE / 2;
  const frogSize = frog.jumping ? TILE * 0.35 : TILE * 0.4;
  
  ctx.fillStyle = '#00ff00';
  ctx.beginPath();
  ctx.arc(frogX, frogY, frogSize, 0, Math.PI * 2);
  ctx.fill();
  
  // Eyes
  ctx.fillStyle = '#000';
  const eyeOffset = frogSize * 0.4;
  if (frog.dir === 0) { // up
    ctx.fillRect(frogX - 5, frogY - eyeOffset, 4, 4);
    ctx.fillRect(frogX + 1, frogY - eyeOffset, 4, 4);
  } else if (frog.dir === 1) { // right
    ctx.fillRect(frogX + eyeOffset - 4, frogY - 5, 4, 4);
    ctx.fillRect(frogX + eyeOffset - 4, frogY + 1, 4, 4);
  } else if (frog.dir === 2) { // down
    ctx.fillRect(frogX - 5, frogY + eyeOffset - 4, 4, 4);
    ctx.fillRect(frogX + 1, frogY + eyeOffset - 4, 4, 4);
  } else { // left
    ctx.fillRect(frogX - eyeOffset, frogY - 5, 4, 4);
    ctx.fillRect(frogX - eyeOffset, frogY + 1, 4, 4);
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

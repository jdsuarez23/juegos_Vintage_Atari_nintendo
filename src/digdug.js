// Dig Dug (Atari 1982) - Versión mejorada
// Controles: Flechas/WASD mover y cavar, Espacio inflar enemigos, R reinicia, P pausar
// Objetivo: Eliminar todos los enemigos inflándolos o dejando rocas caer

import {Input} from './engine.js';

let canvas, ctx, input;
const W = 860, H = 560;

const TILE = 32;
const COLS = Math.floor(W / TILE);
const ROWS = Math.floor(H / TILE);

let player; // {x, y, dir, pumping, pumpTarget, pumpCharge, animTimer}
let enemies = []; // {x, y, type:'pooka'|'fygar', dir, speed, inflated, ghost, alive, aiTimer, state}
let grid = []; // 0=dirt, 1=air, 2=tunnel
let rocks = []; // {x, y, falling, fallTimer, shakeTimer}
let pump = null; // {x, y, length, dir, hitEnemy, animTimer}
let particles = []; // Efectos visuales
let score = 0, lives = 3, level = 1, best = 0, gameOver = false, paused = false;
let speedFactor = 1;
const MAX_SPEED_FACTOR = 2.0, MIN_SPEED_FACTOR = 0.5;
let _incHeld = false, _decHeld = false;

export function init(c, inp) {
  canvas = c;
  ctx = canvas.getContext('2d');
  input = inp;
  const b = localStorage.getItem('best_digdug');
  if (b) best = parseInt(b) || 0;
  reset();
}

export function restart() {
  level = 1;
  score = 0;
  lives = 3;
  gameOver = false;
  paused = false;
  speedFactor = 1;
  particles = [];
  reset();
}

function reset() {
  // Grid: primera fila = aire, resto = tierra
  grid = [];
  for (let y = 0; y < ROWS; y++) {
    grid[y] = [];
    for (let x = 0; x < COLS; x++) {
      grid[y][x] = y === 0 ? 1 : 0; // 0=dirt, 1=air
    }
  }
  
  player = { 
    x: 1, 
    y: 1, 
    dir: {x:1, y:0}, 
    pumping: false, 
    pumpTarget: null, 
    pumpCharge: 0,
    animTimer: 0
  };
  grid[player.y][player.x] = 1; // espacio inicial
  
  enemies = [];
  const enemyCount = Math.min(2 + level, 8);
  for (let i = 0; i < enemyCount; i++) {
    let x, y;
    do {
      x = 3 + Math.floor(Math.random() * (COLS - 6));
      y = 3 + Math.floor(Math.random() * (ROWS - 5));
    } while (Math.abs(x - player.x) < 3 && Math.abs(y - player.y) < 3);
    
    enemies.push({
      x, y,
      type: Math.random() < 0.5 ? 'pooka' : 'fygar',
      dir: {x: 0, y: 0},
      speed: 1.2 + level * 0.1,
      inflated: 0,
      ghost: true, // puede atravesar tierra
      alive: true,
      aiTimer: 0,
      state: 'wandering' // wandering, chasing, fleeing
    });
  }
  
  rocks = [];
  // Colocar algunas rocas
  const rockCount = Math.min(2 + Math.floor(level / 2), 6);
  for (let i = 0; i < rockCount; i++) {
    let x, y;
    do {
      x = 2 + Math.floor(Math.random() * (COLS - 4));
      y = 3 + Math.floor(Math.random() * (ROWS - 5));
    } while (grid[y][x] !== 0 || Math.abs(x - player.x) < 2);
    
    rocks.push({ 
      x, 
      y, 
      falling: false, 
      fallTimer: 0,
      shakeTimer: 0
    });
  }
  
  pump = null;
}

export function update(dt) {
  if (input.pressed('r')) {
    restart();
    input.keys.delete('r');
  }
  
  // Pausar juego con P o Escape
  if (input.pressed('p', 'escape')) {
    if (!update._pauseHeld) {
      paused = !paused;
      update._pauseHeld = true;
    }
  } else {
    update._pauseHeld = false;
  }
  
  if (gameOver || paused) return;
  
  handleInput(dt);
  updatePlayer(dt);
  updateEnemies(dt);
  updateRocks(dt);
  updatePump(dt);
  updateParticles(dt);
  checkCollisions();
  
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
  
  // Victoria - todos enemigos eliminados
  if (enemies.every(e => !e.alive)) {
    level++;
    score += 1000 + level * 500;
    saveBest();
    reset();
  }
}

function handleInput(dt) {
  if (player.pumping) {
    // Seguir inflando con espacio
    if (input.pressed(' ')) {
      player.pumpCharge += dt * 2 * speedFactor;
    } else {
      player.pumping = false;
      pump = null;
      player.pumpTarget = null;
    }
    return;
  }
  
  // Movimiento
  let newDir = null;
  if (input.pressed('arrowup', 'w')) newDir = {x: 0, y: -1};
  else if (input.pressed('arrowdown', 's')) newDir = {x: 0, y: 1};
  else if (input.pressed('arrowleft', 'a')) newDir = {x: -1, y: 0};
  else if (input.pressed('arrowright', 'd')) newDir = {x: 1, y: 0};
  
  if (newDir) {
    player.dir = newDir;
    const nx = player.x + newDir.x;
    const ny = player.y + newDir.y;
    
    if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
      // Cavar túnel si es tierra
      if (grid[ny][nx] === 0) {
        grid[ny][nx] = 1;
        score += 5;
        createDigEffect(nx * TILE + TILE/2, ny * TILE + TILE/2);
      }
      player.x = nx;
      player.y = ny;
      player.animTimer = 0.2;
    }
  }
  
  // Bombear
  if (input.pressed(' ')) {
    if (!handleInput._space) {
      startPump();
      handleInput._space = true;
    }
  } else handleInput._space = false;
}

function startPump() {
  pump = {
    x: player.x,
    y: player.y,
    length: 0,
    dir: player.dir,
    maxLength: 3,
    hitEnemy: null,
    animTimer: 0
  };
  player.pumping = true;
  player.pumpCharge = 0;
}

function updatePlayer(dt) {
  if (player.animTimer > 0) {
    player.animTimer -= dt;
  }
}

function updateEnemies(dt) {
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.inflated >= 4) continue; // completamente inflado, esperando explotar
    
    e.aiTimer -= dt;
    
    // Convertir a enteros para acceder al array
    const tileX = Math.floor(e.x);
    const tileY = Math.floor(e.y);
    
    // Convertirse en túnel-walker si el jugador está cerca
    const dist = Math.abs(e.x - player.x) + Math.abs(e.y - player.y);
    if (dist < 5 && tileX >= 0 && tileX < COLS && tileY >= 0 && tileY < ROWS && grid[tileY][tileX] === 1) {
      e.ghost = false;
    } else if (tileX >= 0 && tileX < COLS && tileY >= 0 && tileY < ROWS && grid[tileY][tileX] === 0) {
      e.ghost = true;
    }
    
    // Cambiar estado según la distancia al jugador
    if (dist < 4) {
      e.state = 'fleeing';
    } else if (dist < 8) {
      e.state = 'chasing';
    } else {
      e.state = 'wandering';
    }
    
    if (e.aiTimer <= 0) {
      // Cambiar dirección según el estado
      if (e.ghost) {
        // Moverse hacia el jugador a través de tierra
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        if (Math.abs(dx) > Math.abs(dy)) {
          e.dir = {x: Math.sign(dx), y: 0};
        } else {
          e.dir = {x: 0, y: Math.sign(dy)};
        }
      } else {
        // Moverse por túneles
        const dirs = [{x:1,y:0}, {x:-1,y:0}, {x:0,y:1}, {x:0,y:-1}];
        const validDirs = dirs.filter(d => {
          const nx = e.x + d.x;
          const ny = e.y + d.y;
          return nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS && grid[ny][nx] === 1;
        });
        
        if (validDirs.length > 0) {
          if (e.state === 'chasing') {
            // Moverse hacia el jugador
            let bestDir = validDirs[0];
            let bestDist = Infinity;
            
            for (const dir of validDirs) {
              const nx = e.x + dir.x;
              const ny = e.y + dir.y;
              const dist = Math.abs(nx - player.x) + Math.abs(ny - player.y);
              
              if (dist < bestDist) {
                bestDist = dist;
                bestDir = dir;
              }
            }
            
            e.dir = bestDir;
          } else if (e.state === 'fleeing') {
            // Moverse lejos del jugador
            let bestDir = validDirs[0];
            let bestDist = -Infinity;
            
            for (const dir of validDirs) {
              const nx = e.x + dir.x;
              const ny = e.y + dir.y;
              const dist = Math.abs(nx - player.x) + Math.abs(ny - player.y);
              
              if (dist > bestDist) {
                bestDist = dist;
                bestDir = dir;
              }
            }
            
            e.dir = bestDir;
          } else {
            // Movimiento aleatorio
            e.dir = validDirs[Math.floor(Math.random() * validDirs.length)];
          }
        }
      }
      
      e.aiTimer = 0.3 + Math.random() * 0.4;
    }
    
    // Mover
    const speed = e.speed * speedFactor * (e.state === 'fleeing' ? 1.3 : 1.0);
    const nx = e.x + e.dir.x * speed * dt;
    const ny = e.y + e.dir.y * speed * dt;
    
    const newTileX = Math.floor(nx);
    const newTileY = Math.floor(ny);
    
    if (newTileX >= 0 && newTileX < COLS && newTileY >= 0 && newTileY < ROWS) {
      if (e.ghost || grid[newTileY][newTileX] === 1) {
        e.x = nx;
        e.y = ny;
      }
    }
    
    // Desinflar si no se está bombeando
    if (e.inflated > 0 && (!pump || pump.hitEnemy !== e)) {
      e.inflated -= dt * 0.5;
      if (e.inflated < 0) e.inflated = 0;
    }
  }
}

function updateRocks(dt) {
  for (const rock of rocks) {
    // Detectar si debe caer (espacio debajo sin soporte)
    if (!rock.falling) {
      // Verificar que rock.y + 1 esté dentro de los límites
      if (rock.y + 1 < ROWS) {
        const below = grid[rock.y + 1][rock.x];
        if (below === 1) { // aire debajo
          rock.fallTimer += dt;
          rock.shakeTimer = Math.min(rock.shakeTimer + dt, 0.5);
          if (rock.fallTimer > 0.5) {
            rock.falling = true;
            createRockEffect(rock.x * TILE + TILE/2, rock.y * TILE + TILE/2);
          }
        } else {
          rock.fallTimer = 0;
          rock.shakeTimer = 0;
        }
      } else {
        // Si está en la última fila, no puede caer más
        rock.falling = false;
        rock.fallTimer = 0;
        rock.shakeTimer = 0;
      }
    }
    
    if (rock.falling) {
      rock.y += 4 * dt * speedFactor;
      
      // Colisión con suelo o tierra
      const tileY = Math.floor(rock.y);
      // Verificar que tileY + 1 esté dentro de los límites
      if (tileY >= ROWS - 1 || (tileY + 1 < ROWS && grid[tileY + 1][Math.floor(rock.x)] === 0)) {
        rock.falling = false;
        rock.y = tileY;
        createRockLandingEffect(rock.x * TILE + TILE/2, rock.y * TILE + TILE/2);
        
        // Verificar si aplasta enemigos
        for (const e of enemies) {
          if (!e.alive) continue;
          if (Math.floor(e.x) === Math.floor(rock.x) && Math.floor(e.y) === tileY) {
            e.alive = false;
            score += 1000;
            createEnemyDefeatEffect(e.x * TILE + TILE/2, e.y * TILE + TILE/2, e.type);
            saveBest();
          }
        }
        
        // Verificar si aplasta jugador
        if (Math.floor(player.x) === Math.floor(rock.x) && Math.floor(player.y) === tileY) {
          loseLife();
        }
      }
    }
  }
}

function updatePump(dt) {
  if (!pump) return;
  
  pump.animTimer += dt;
  
  // Extender bomba
  pump.length = Math.min(pump.maxLength, player.pumpCharge);
  
  // Detectar enemigo en línea de bomba
  if (!pump.hitEnemy) {
    for (const e of enemies) {
      if (!e.alive) continue;
      
      const ex = Math.floor(e.x);
      const ey = Math.floor(e.y);
      
      for (let i = 1; i <= pump.length; i++) {
        const px = pump.x + pump.dir.x * i;
        const py = pump.y + pump.dir.y * i;
        
        if (ex === px && ey === py) {
          pump.hitEnemy = e;
          player.pumpTarget = e;
          createPumpHitEffect(px * TILE + TILE/2, py * TILE + TILE/2);
          break;
        }
      }
    }
  }
  
  // Inflar enemigo si está conectado
  if (pump.hitEnemy && player.pumping) {
    pump.hitEnemy.inflated += dt * speedFactor;
    
    if (pump.hitEnemy.inflated >= 4) {
      // Explotar
      pump.hitEnemy.alive = false;
      score += 200 + level * 50;
      createEnemyDefeatEffect(
        pump.hitEnemy.x * TILE + TILE/2, 
        pump.hitEnemy.y * TILE + TILE/2, 
        pump.hitEnemy.type
      );
      saveBest();
      player.pumping = false;
      pump = null;
      player.pumpTarget = null;
    }
  }
}

function checkCollisions() {
  // Jugador toca enemigo
  for (const e of enemies) {
    if (!e.alive) continue;
    const dist = Math.hypot(e.x - player.x, e.y - player.y);
    if (dist < 0.8) {
      loseLife();
      break;
    }
  }
}

function loseLife() {
  lives--;
  createPlayerHitEffect(player.x * TILE + TILE/2, player.y * TILE + TILE/2);
  
  if (lives <= 0) {
    gameOver = true;
  } else {
    player.x = 1;
    player.y = 1;
    player.pumping = false;
    pump = null;
  }
}

function saveBest() {
  if (score > best) {
    best = score;
    localStorage.setItem('best_digdug', best);
  }
}

// Efectos visuales
function createDigEffect(x, y) {
  for (let i = 0; i < 8; i++) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 50,
      vy: (Math.random() - 0.5) * 50,
      life: 0.3,
      color: '#8b4513'
    });
  }
}

function createRockEffect(x, y) {
  for (let i = 0; i < 5; i++) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 30,
      vy: -Math.random() * 30,
      life: 0.5,
      color: '#666'
    });
  }
}

function createRockLandingEffect(x, y) {
  for (let i = 0; i < 10; i++) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 80,
      vy: -Math.random() * 50,
      life: 0.5,
      color: '#666'
    });
  }
}

function createPumpHitEffect(x, y) {
  for (let i = 0; i < 8; i++) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 60,
      vy: (Math.random() - 0.5) * 60,
      life: 0.4,
      color: '#00ffff'
    });
  }
}

function createEnemyDefeatEffect(x, y, type) {
  const color = type === 'pooka' ? '#ff0000' : '#00ff00';
  for (let i = 0; i < 15; i++) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 100,
      vy: -Math.random() * 100,
      life: 0.7,
      color: color
    });
  }
}

function createPlayerHitEffect(x, y) {
  for (let i = 0; i < 12; i++) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 80,
      vy: -Math.random() * 80,
      life: 0.6,
      color: '#ffffff'
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
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  
  // Dibujar grid
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const px = x * TILE;
      const py = y * TILE;
      
      if (grid[y][x] === 0) {
        // Tierra
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = '#654321';
        ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
      } else if (grid[y][x] === 1) {
        // Aire/túnel
        ctx.fillStyle = y === 0 ? '#87ceeb' : '#222';
        ctx.fillRect(px, py, TILE, TILE);
      }
    }
  }
  
  // Rocas
  for (const rock of rocks) {
    const px = rock.x * TILE;
    const py = rock.y * TILE;
    const shakeX = rock.shakeTimer > 0 ? Math.sin(rock.shakeTimer * 50) * 2 : 0;
    
    ctx.fillStyle = '#666';
    ctx.beginPath();
    ctx.arc(px + TILE/2 + shakeX, py + TILE/2, TILE * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(px + TILE/2 - 3 + shakeX, py + TILE/2 - 3, TILE * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Bomba/Pump
  if (pump) {
    const pulse = Math.sin(pump.animTimer * 10) * 0.2 + 0.8;
    ctx.strokeStyle = `rgba(0, 255, 255, ${pulse})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(player.x * TILE + TILE/2, player.y * TILE + TILE/2);
    const endX = (pump.x + pump.dir.x * pump.length) * TILE + TILE/2;
    const endY = (pump.y + pump.dir.y * pump.length) * TILE + TILE/2;
    ctx.lineTo(endX, endY);
    ctx.stroke();
    
    // Cabeza de la bomba
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.arc(endX, endY, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Partículas
  for (const p of particles) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
  
  // Enemigos
  for (const e of enemies) {
    if (!e.alive) continue;
    
    const px = e.x * TILE + TILE/2;
    const py = e.y * TILE + TILE/2;
    const size = TILE * 0.4 * (1 + e.inflated * 0.3);
    
    ctx.fillStyle = e.type === 'pooka' ? '#ff0000' : '#00ff00';
    ctx.globalAlpha = e.ghost ? 0.5 : 1;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    
    // Ojos
    ctx.fillStyle = '#fff';
    const eyeSize = size * 0.3;
    const eyeOffset = size * 0.5;
    
    // Calcular dirección de la mirada
    let lookDir = {x: 0, y: 0};
    if (e.dir.x !== 0 || e.dir.y !== 0) {
      lookDir = e.dir;
    } else {
      // Mirar hacia el jugador
      lookDir.x = player.x - e.x;
      lookDir.y = player.y - e.y;
      const mag = Math.hypot(lookDir.x, lookDir.y);
      if (mag > 0) {
        lookDir.x /= mag;
        lookDir.y /= mag;
      }
    }
    
    ctx.fillRect(px + lookDir.x * eyeOffset - eyeSize/2, py + lookDir.y * eyeOffset - eyeSize/2, eyeSize, eyeSize);
    ctx.fillRect(px + lookDir.x * eyeOffset * 0.7 - eyeSize/2, py + lookDir.y * eyeOffset * 0.7 - eyeSize/2, eyeSize, eyeSize);
    
    // Estado inflado
    if (e.inflated > 0) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.globalAlpha = e.inflated / 4;
      ctx.beginPath();
      ctx.arc(px, py, size + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  
  // Jugador
  const px = player.x * TILE + TILE/2;
  const py = player.y * TILE + TILE/2;
  const jumpOffset = player.animTimer > 0 ? Math.sin(player.animTimer * 10) * 3 : 0;
  
  ctx.fillStyle = '#fff';
  ctx.fillRect(px - TILE * 0.3, py - TILE * 0.3 + jumpOffset, TILE * 0.6, TILE * 0.6);
  ctx.fillStyle = '#0088ff';
  ctx.fillRect(px - TILE * 0.2, py - TILE * 0.2 + jumpOffset, TILE * 0.4, TILE * 0.4);
  
  // Dirección del jugador
  ctx.fillStyle = '#ffff00';
  if (player.dir.x === 1) ctx.fillRect(px + TILE * 0.25, py - 2 + jumpOffset, TILE * 0.1, 4);
  else if (player.dir.x === -1) ctx.fillRect(px - TILE * 0.35, py - 2 + jumpOffset, TILE * 0.1, 4);
  else if (player.dir.y === 1) ctx.fillRect(px - 2, py + TILE * 0.25 + jumpOffset, 4, TILE * 0.1);
  else if (player.dir.y === -1) ctx.fillRect(px - 2, py - TILE * 0.35 + jumpOffset, 4, TILE * 0.1);
  
  // HUD
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, W, 45);
  ctx.fillStyle = '#fff';
  ctx.font = '14px monospace';
  ctx.fillText(`Dig Dug | Level:${level} Score:${score} Lives:${lives} Best:${best} Speed:${speedFactor.toFixed(2)} (=/-) | P=Pause`, 20, 25);
  
  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffff00';
    ctx.font = '48px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', W / 2, H / 2);
    ctx.font = '20px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText('Press P or ESC to resume', W / 2, H / 2 + 50);
    ctx.textAlign = 'left';
  }
  
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
  return `Dig Dug | Lvl:${level} Score:${score} Lives:${lives} Spd:${speedFactor.toFixed(2)}`;
}
// Breakout (Atari 1976) - Implementación fiel al original
// Controles: A/D o Flechas para mover paleta, Espacio para lanzar, R reinicia

import {Input} from './engine.js';

let canvas, ctx, input;
const W = 860, H = 560;

let paddle; // {x, y, w, h, vx}
let ball; // {x, y, vx, vy, r, stuck}
let bricks = []; // {x, y, w, h, color, hits, alive}
let score = 0, lives = 3, level = 1, best = 0, gameOver = false;
let speedFactor = 1;
const MAX_SPEED_FACTOR = 2.5, MIN_SPEED_FACTOR = 0.5;
let _incHeld = false, _decHeld = false;

const PADDLE_W = 100, PADDLE_H = 16;
const BALL_R = 7;
const BRICK_ROWS = 8, BRICK_COLS = 14;
const BRICK_W = 54, BRICK_H = 20;
const BRICK_PADDING = 6;
const BRICK_OFFSET_TOP = 80;
const BRICK_OFFSET_LEFT = 40;

const COLORS = ['#ff0000', '#ff8800', '#ffff00', '#00ff00', '#00ffff', '#0088ff', '#8800ff', '#ff00ff'];

export function init(c, inp) {
  canvas = c;
  ctx = canvas.getContext('2d');
  input = inp;
  const b = localStorage.getItem('best_breakout');
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
  paddle = { x: W / 2 - PADDLE_W / 2, y: H - 60, w: PADDLE_W, h: PADDLE_H, vx: 0 };
  ball = { x: W / 2, y: H - 80, vx: 0, vy: 0, r: BALL_R, stuck: true };
  buildLevel(level);
  speedFactor = 1 + (level - 1) * 0.15;
}

function buildLevel(level) {
  bricks = [];
  const rows = Math.min(BRICK_ROWS + Math.floor((level - 1) / 2), 12);
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < BRICK_COLS; col++) {
      const x = BRICK_OFFSET_LEFT + col * (BRICK_W + BRICK_PADDING);
      const y = BRICK_OFFSET_TOP + row * (BRICK_H + BRICK_PADDING);
      const color = COLORS[row % COLORS.length];
      const hits = Math.min(1 + Math.floor(row / 2) + Math.floor(level / 3), 4);
      
      bricks.push({ 
        x, y, w: BRICK_W, h: BRICK_H, 
        color, hits, maxHits: hits, alive: true 
      });
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
  updatePaddle(dt);
  updateBall(dt);
  checkCollisions();

  if (bricks.every(b => !b.alive)) {
    nextLevel();
  }
}

function nextLevel() {
  level++;
  score += 1000 * level;
  saveBest();
  
  speedFactor = 1 + (level - 1) * 0.15;
  if (level % 3 === 0 && paddle.w > 60) {
    paddle.w -= 5;
  }
  
  buildLevel(level);
  ball.stuck = true;
  ball.vx = 0;
  ball.vy = 0;
}

function handleInput(dt) {
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

  paddle.vx = 0;
  if (input.pressed('a', 'arrowleft')) paddle.vx = -450 * speedFactor;
  else if (input.pressed('d', 'arrowright')) paddle.vx = 450 * speedFactor;

  if (ball.stuck && input.pressed(' ')) {
    if (!handleInput._held) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;
      const speed = 320 * speedFactor;
      ball.vx = Math.cos(angle) * speed;
      ball.vy = Math.sin(angle) * speed;
      ball.stuck = false;
    }
    handleInput._held = true;
  } else handleInput._held = false;
}

function updatePaddle(dt) {
  paddle.x += paddle.vx * dt;
  paddle.x = Math.max(20, Math.min(W - 20 - paddle.w, paddle.x));
}

function updateBall(dt) {
  if (ball.stuck) {
    ball.x = paddle.x + paddle.w / 2;
    ball.y = paddle.y - ball.r - 2;
    return;
  }

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // Colisión con paredes
  if (ball.x - ball.r < 20 && ball.vx < 0) {
    ball.x = 20 + ball.r;
    ball.vx = -ball.vx;
  }
  if (ball.x + ball.r > W - 20 && ball.vx > 0) {
    ball.x = W - 20 - ball.r;
    ball.vx = -ball.vx;
  }
  if (ball.y - ball.r < 20 && ball.vy < 0) {
    ball.y = 20 + ball.r;
    ball.vy = -ball.vy;
  }

  // Perder vida si la bola cae
  if (ball.y - ball.r > H + 20) {
    lives--;
    if (lives <= 0) {
      gameOver = true;
    } else {
      ball.stuck = true;
      ball.x = paddle.x + paddle.w / 2;
      ball.y = paddle.y - ball.r - 2;
      ball.vx = 0;
      ball.vy = 0;
    }
  }
}

function checkCollisions() {
  // Colisión con paleta - IMPLEMENTACIÓN CORREGIDA
  if (ball.vy > 0 && // Solo cuando la pelota está bajando
      ball.y + ball.r >= paddle.y &&
      ball.y - ball.r <= paddle.y + paddle.h &&
      ball.x + ball.r >= paddle.x &&
      ball.x - ball.r <= paddle.x + paddle.w) {
    
    // Calcular punto de impacto relativo (-1 a 1)
    const hitPos = ((ball.x - paddle.x) / paddle.w) * 2 - 1;
    
    // Limitar el ángulo máximo a 75 grados
    const maxAngle = Math.PI * 5/12; // 75 grados
    const angle = Math.PI - (hitPos * maxAngle + Math.PI / 2);
    
    // Mantener velocidad pero cambiar dirección
    const speed = Math.hypot(ball.vx, ball.vy);
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;
    
    // Asegurar que la pelota siempre suba después del rebote
    if (ball.vy > 0) ball.vy = -ball.vy;
    
    // Ajustar posición para evitar múltiples colisiones
    ball.y = paddle.y - ball.r - 1;
    
    // Añadir un pequeño impulso para evitar rebotes planos
    if (Math.abs(ball.vy) < 100) {
      ball.vy = -150 * speedFactor;
    }
  }

  // Colisión con ladrillos
  for (const brick of bricks) {
    if (!brick.alive) continue;
    
    // Detectar colisión AABB
    if (ball.x + ball.r > brick.x &&
        ball.x - ball.r < brick.x + brick.w &&
        ball.y + ball.r > brick.y &&
        ball.y - ball.r < brick.y + brick.h) {
      
      // Determinar dirección de rebote
      const ballCenterX = ball.x;
      const ballCenterY = ball.y;
      const brickCenterX = brick.x + brick.w / 2;
      const brickCenterY = brick.y + brick.h / 2;
      
      // Calcular distancias a cada borde
      const distLeft = Math.abs(ballCenterX - brick.x);
      const distRight = Math.abs(ballCenterX - (brick.x + brick.w));
      const distTop = Math.abs(ballCenterY - brick.y);
      const distBottom = Math.abs(ballCenterY - (brick.y + brick.h));
      
      // Encontrar la distancia mínima
      const minDist = Math.min(distLeft, distRight, distTop, distBottom);
      
      // Rebote según el borde más cercano
      if (minDist === distLeft || minDist === distRight) {
        ball.vx = -ball.vx;
        // Ajustar posición para evitar atascos
        if (minDist === distLeft) {
          ball.x = brick.x - ball.r - 1;
        } else {
          ball.x = brick.x + brick.w + ball.r + 1;
        }
      } else {
        ball.vy = -ball.vy;
        // Ajustar posición para evitar atascos
        if (minDist === distTop) {
          ball.y = brick.y - ball.r - 1;
        } else {
          ball.y = brick.y + brick.h + ball.r + 1;
        }
      }
      
      // Reducir vida del ladrillo
      brick.hits--;
      if (brick.hits <= 0) {
        brick.alive = false;
        score += 100 * level;
        saveBest();
      } else {
        score += 50 * level;
      }
      
      // Aumentar velocidad ligeramente
      const speed = Math.hypot(ball.vx, ball.vy) * 1.01;
      const angle = Math.atan2(ball.vy, ball.vx);
      ball.vx = Math.cos(angle) * speed;
      ball.vy = Math.sin(angle) * speed;
      
      // Solo manejar una colisión por frame
      break;
    }
  }
}

function saveBest() {
  if (score > best) {
    best = score;
    localStorage.setItem('best_breakout', best);
  }
}

export function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // Bordes
  ctx.fillStyle = '#333';
  ctx.fillRect(0, 0, 20, H);
  ctx.fillRect(W - 20, 0, 20, H);
  ctx.fillRect(0, 0, W, 20);

  // Ladrillos
  for (const brick of bricks) {
    if (!brick.alive) continue;
    
    ctx.fillStyle = brick.color;
    ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
    
    // Brillo para mostrar golpes restantes
    if (brick.hits < brick.maxHits) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
    }
    
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(brick.x, brick.y, brick.w, brick.h);
  }

  // Paleta
  ctx.fillStyle = '#fff';
  ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
  ctx.fillStyle = '#ccc';
  ctx.fillRect(paddle.x + 3, paddle.y + 3, paddle.w - 6, paddle.h - 6);

  // Bola
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();

  // HUD
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, H - 45, W, 45);
  ctx.fillStyle = '#fff';
  ctx.font = '14px monospace';
  ctx.fillText(`Breakout | Level:${level} Score:${score} Lives:${lives} Best:${best} Speed:${speedFactor.toFixed(2)} (=/-)`, 30, H - 20);

  if (ball.stuck) {
    ctx.fillStyle = '#ffff00';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Press SPACE to launch', W / 2, H - 100);
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
  return `Breakout | Lvl:${level} Score:${score} Lives:${lives} Spd:${speedFactor.toFixed(2)}`;
}
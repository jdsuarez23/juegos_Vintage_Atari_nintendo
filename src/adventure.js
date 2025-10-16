// Adventure (Atari 2600, 1979) - Primer action-adventure
// Controles: Flechas/WASD mover, Espacio recoger/soltar objetos, R reinicia
// Objetivo: Encontrar el cáliz dorado y llevarlo al castillo amarillo

import {Input} from './engine.js';

let canvas, ctx, input;
const W = 860, H = 560;

const TILE = 40;
const ROOM_W = Math.floor(W / TILE);
const ROOM_H = Math.floor(H / TILE);

let player; // {x, y, room, carrying}
let rooms = []; // {id, color, gates:[], items:[], dragons:[]}
let items = []; // {id, type, x, y, room, carried}
let dragons = []; // {id, color, x, y, room, state:'chase'|'guard'|'dead', target}
let currentRoom;
let score = 0, best = 0, gameOver = false, victory = false, paused = false;
let speedFactor = 1;
const MAX_SPEED_FACTOR = 2.0, MIN_SPEED_FACTOR = 0.5;
let _incHeld = false, _decHeld = false;
let flashTimer = 0; // Para feedback visual

export function init(c, inp) {
  canvas = c;
  ctx = canvas.getContext('2d');
  input = inp;
  const b = localStorage.getItem('best_adventure');
  if (b) best = parseInt(b) || 0;
  reset();
}

export function restart() {
  score = 0;
  gameOver = false;
  victory = false;
  paused = false;
  speedFactor = 1;
  flashTimer = 0;
  reset();
}

function reset() {
  buildWorld();
  player = { x: ROOM_W / 2, y: ROOM_H - 2, room: 'yellow-castle', carrying: null };
  currentRoom = rooms.find(r => r.id === player.room);
}

function buildWorld() {
  rooms = [
    { id: 'yellow-castle', color: '#ffaa00', gates: [{x: ROOM_W/2, y: 0, to: 'main'}], items: [], dragons: [] },
    { id: 'main', color: '#808080', gates: [
      {x: ROOM_W/2, y: ROOM_H-1, to: 'yellow-castle'},
      {x: 0, y: ROOM_H/2, to: 'blue-labyrinth'},
      {x: ROOM_W-1, y: ROOM_H/2, to: 'red-maze'}
    ], items: [], dragons: [] },
    { id: 'blue-labyrinth', color: '#0088ff', gates: [
      {x: ROOM_W-1, y: ROOM_H/2, to: 'main'},
      {x: ROOM_W/2, y: 0, to: 'white-castle'}
    ], items: [], dragons: [] },
    { id: 'red-maze', color: '#cc0000', gates: [
      {x: 0, y: ROOM_H/2, to: 'main'}, 
      {x: ROOM_W/2, y: 0, to: 'black-castle'}
    ], items: [], dragons: [] },
    { id: 'black-castle', color: '#111', gates: [{x: ROOM_W/2, y: ROOM_H-1, to: 'red-maze'}], items: [], dragons: [] },
    { id: 'white-castle', color: '#eeeeee', gates: [{x: ROOM_W/2, y: ROOM_H-1, to: 'blue-labyrinth'}], items: [], dragons: [] }
  ];
  
  items = [
    { id: 'chalice', type: 'chalice', x: 10, y: 7, room: 'black-castle', carried: false },
    { id: 'sword', type: 'sword', x: 5, y: 5, room: 'yellow-castle', carried: false },
    { id: 'key-black', type: 'key', color: '#111', x: 8, y: 8, room: 'white-castle', carried: false },
    { id: 'key-white', type: 'key', color: '#ccc', x: 10, y: 4, room: 'red-maze', carried: false },
    { id: 'magnet', type: 'magnet', x: 6, y: 10, room: 'blue-labyrinth', carried: false }
  ];
  
  dragons = [
    { id: 'green', color: '#00cc00', x: 8, y: 8, room: 'blue-labyrinth', state: 'chase', target: null, speed: 1.8 },
    { id: 'red', color: '#ee0000', x: 12, y: 6, room: 'red-maze', state: 'guard', target: null, speed: 1.5 },
    { id: 'gold', color: '#ffcc00', x: 8, y: 8, room: 'black-castle', state: 'guard', target: null, speed: 2.2 }
  ];
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
  
  if (gameOver || victory || paused) return;
  
  handleInput(dt);
  updatePlayer(dt);
  updateDragons(dt);
  checkCollisions();
  
  // Reducir flash timer
  if (flashTimer > 0) flashTimer -= dt;
  
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
  
  // Victoria - cáliz en castillo amarillo
  if (player.room === 'yellow-castle' && player.carrying?.id === 'chalice') {
    victory = true;
    score += 10000;
    saveBest();
  }
}

function handleInput(dt) {
  const speed = 4 * speedFactor;
  
  if (input.pressed('arrowup', 'w')) player.y -= speed * dt;
  else if (input.pressed('arrowdown', 's')) player.y += speed * dt;
  else if (input.pressed('arrowleft', 'a')) player.x -= speed * dt;
  else if (input.pressed('arrowright', 'd')) player.x += speed * dt;
  
  // Límites de sala
  player.x = Math.max(0.5, Math.min(ROOM_W - 0.5, player.x));
  player.y = Math.max(0.5, Math.min(ROOM_H - 0.5, player.y));
  
  // Recoger/soltar objetos
  if (input.pressed(' ')) {
    if (!handleInput._space) {
      if (player.carrying) {
        // Soltar
        player.carrying.x = player.x;
        player.carrying.y = player.y;
        player.carrying.room = player.room;
        player.carrying.carried = false;
        player.carrying = null;
      } else {
        // Intentar recoger
        for (const item of items) {
          if (item.room === player.room && !item.carried) {
            const dist = Math.hypot(item.x - player.x, item.y - player.y);
            if (dist < 1.5) {
              player.carrying = item;
              item.carried = true;
              break;
            }
          }
        }
      }
      handleInput._space = true;
    }
  } else handleInput._space = false;
}

function updatePlayer(dt) {
  currentRoom = rooms.find(r => r.id === player.room);
  
  // Cambiar de sala por puertas
  for (const gate of currentRoom.gates) {
    const dist = Math.hypot(gate.x - player.x, gate.y - player.y);
    if (dist < 1.0) {
      player.room = gate.to;
      
      // Reposicionar en sala nueva
      const newRoom = rooms.find(r => r.id === gate.to);
      const returnGate = newRoom.gates.find(g => g.to === currentRoom.id);
      if (returnGate) {
        player.x = returnGate.x;
        player.y = returnGate.y;
        // Alejar del gate
        if (returnGate.x === 0) player.x += 1;
        else if (returnGate.x === ROOM_W - 1) player.x -= 1;
        else if (returnGate.y === 0) player.y += 1;
        else if (returnGate.y === ROOM_H - 1) player.y -= 1;
      }
      
      currentRoom = newRoom;
      break;
    }
  }
  
  // Objeto llevado sigue al jugador
  if (player.carrying) {
    player.carrying.x = player.x;
    player.carrying.y = player.y;
    player.carrying.room = player.room;
  }
}

function updateDragons(dt) {
  for (const dragon of dragons) {
    if (dragon.state === 'dead') continue;
    
    // IA mejorada del dragón
    if (dragon.state === 'chase') {
      // Perseguir jugador si está en la misma sala
      if (dragon.room === player.room) {
        const dx = player.x - dragon.x;
        const dy = player.y - dragon.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.5) {
          dragon.x += (dx / dist) * dragon.speed * dt * speedFactor;
          dragon.y += (dy / dist) * dragon.speed * dt * speedFactor;
        }
      } else {
        // Intentar seguir al jugador a otras salas
        const currentDragonRoom = rooms.find(r => r.id === dragon.room);
        if (currentDragonRoom && currentDragonRoom.gates.length > 0) {
          // Moverse hacia la puerta más cercana
          let closestGate = currentDragonRoom.gates[0];
          let closestDist = Infinity;
          for (const gate of currentDragonRoom.gates) {
            const gateX = gate.x;
            const gateY = gate.y;
            const dist = Math.hypot(gateX - dragon.x, gateY - dragon.y);
            if (dist < closestDist) {
              closestDist = dist;
              closestGate = gate;
            }
          }
          
          const dx = closestGate.x - dragon.x;
          const dy = closestGate.y - dragon.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 0.5) {
            dragon.x += (dx / dist) * dragon.speed * 0.5 * dt * speedFactor;
            dragon.y += (dy / dist) * dragon.speed * 0.5 * dt * speedFactor;
          } else {
            // Cambiar de sala
            dragon.room = closestGate.to;
            const newRoom = rooms.find(r => r.id === closestGate.to);
            const returnGate = newRoom.gates.find(g => g.to === currentDragonRoom.id);
            if (returnGate) {
              dragon.x = returnGate.x;
              dragon.y = returnGate.y;
            }
          }
        }
      }
    } else if (dragon.state === 'guard') {
      // Guardar área (patrullar localmente)
      if (!dragon.guardX) {
        dragon.guardX = dragon.x;
        dragon.guardY = dragon.y;
      }
      
      // Perseguir si jugador cerca en la misma sala
      if (dragon.room === player.room) {
        const dist = Math.hypot(player.x - dragon.x, player.y - dragon.y);
        if (dist < 5) {
          dragon.state = 'chase';
        }
      }
      
      // Patrullar alrededor del punto de guardia
      if (!dragon.patrolTimer || dragon.patrolTimer <= 0) {
        dragon.patrolOffsetX = (Math.random() - 0.5) * 4;
        dragon.patrolOffsetY = (Math.random() - 0.5) * 4;
        dragon.patrolTimer = 2 + Math.random() * 2;
      }
      dragon.patrolTimer -= dt;
      
      const targetX = dragon.guardX + dragon.patrolOffsetX;
      const targetY = dragon.guardY + dragon.patrolOffsetY;
      const dx = targetX - dragon.x;
      const dy = targetY - dragon.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.3) {
        dragon.x += (dx / dist) * dragon.speed * 0.3 * dt * speedFactor;
        dragon.y += (dy / dist) * dragon.speed * 0.3 * dt * speedFactor;
      }
    }
    
    // Límites de sala
    dragon.x = Math.max(1, Math.min(ROOM_W - 1, dragon.x));
    dragon.y = Math.max(1, Math.min(ROOM_H - 1, dragon.y));
  }
}

function checkCollisions() {
  // Jugador toca dragón
  for (const dragon of dragons) {
    if (dragon.state === 'dead') continue;
    if (dragon.room !== player.room) continue;
    
    const dist = Math.hypot(dragon.x - player.x, dragon.y - player.y);
    
    // Dragón come al jugador
    if (dist < 1.2) {
      if (player.carrying?.type === 'sword') {
        // Matar dragón con espada
        dragon.state = 'dead';
        score += 1000;
        flashTimer = 0.3; // Flash visual
        saveBest();
      } else {
        // Jugador muere
        gameOver = true;
        flashTimer = 0.5;
      }
    }
  }
}

function saveBest() {
  if (score > best) {
    best = score;
    localStorage.setItem('best_adventure', best);
  }
}

export function draw() {
  // Fondo de sala
  ctx.fillStyle = currentRoom.color;
  ctx.fillRect(0, 0, W, H);
  
  // Flash visual para feedback
  if (flashTimer > 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, ' + (flashTimer * 0.5) + ')';
    ctx.fillRect(0, 0, W, H);
  }
  
  // Paredes de sala
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, W - 20, H - 20);
  
  // Puertas/Gates
  for (const gate of currentRoom.gates) {
    const gx = gate.x * TILE;
    const gy = gate.y * TILE;
    ctx.fillStyle = '#000';
    
    if (gate.x === 0 || gate.x === ROOM_W - 1) {
      // Puerta vertical
      ctx.fillRect(gx - 10, gy - TILE, 20, TILE * 2);
    } else {
      // Puerta horizontal
      ctx.fillRect(gx - TILE, gy - 10, TILE * 2, 20);
    }
    
    // Hueco de puerta
    ctx.fillStyle = currentRoom.color;
    if (gate.x === 0 || gate.x === ROOM_W - 1) {
      ctx.fillRect(gx - 6, gy - TILE * 0.7, 12, TILE * 1.4);
    } else {
      ctx.fillRect(gx - TILE * 0.7, gy - 6, TILE * 1.4, 12);
    }
  }
  
  // Items en sala (no llevados)
  for (const item of items) {
    if (item.room !== player.room || item.carried) continue;
    
    const ix = item.x * TILE;
    const iy = item.y * TILE;
    
    if (item.type === 'chalice') {
      // Cáliz dorado más grande y brillante
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(ix, iy - 8, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(ix, iy - 12);
      ctx.lineTo(ix - 10, iy + 8);
      ctx.lineTo(ix + 10, iy + 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(ix - 5, iy - 18, 10, 8);
      // Brillo
      ctx.fillStyle = '#ffee88';
      ctx.fillRect(ix - 3, iy - 16, 6, 4);
    } else if (item.type === 'sword') {
      ctx.fillStyle = '#c0c0c0';
      ctx.fillRect(ix - 3, iy - 20, 6, 30);
      ctx.fillRect(ix - 10, iy - 22, 20, 4);
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(ix - 4, iy + 10, 8, 10);
      // Brillo de espada
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ix - 1, iy - 18, 2, 24);
    } else if (item.type === 'key') {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(ix, iy - 10, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(ix - 2, iy - 3, 4, 14);
      ctx.fillRect(ix - 2, iy + 5, 8, 3);
      ctx.fillRect(ix - 2, iy + 9, 8, 3);
    } else if (item.type === 'magnet') {
      // Imán en forma de U
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(ix - 10, iy - 12, 6, 20);
      ctx.fillStyle = '#0000ff';
      ctx.fillRect(ix + 4, iy - 12, 6, 20);
      ctx.fillStyle = '#888888';
      ctx.fillRect(ix - 10, iy + 6, 20, 6);
    }
  }
  
  // Dragones en sala
  for (const dragon of dragons) {
    if (dragon.room !== player.room) continue;
    if (dragon.state === 'dead') {
      // Dragón muerto
      ctx.fillStyle = '#666';
      ctx.fillRect(dragon.x * TILE - 15, dragon.y * TILE - 5, 30, 10);
      ctx.fillStyle = '#444';
      ctx.fillRect(dragon.x * TILE - 12, dragon.y * TILE - 3, 24, 6);
      continue;
    }
    
    const dx = dragon.x * TILE;
    const dy = dragon.y * TILE;
    
    // Cuerpo del dragón
    ctx.fillStyle = dragon.color;
    ctx.fillRect(dx - 12, dy - 8, 24, 16);
    
    // Cola
    ctx.beginPath();
    ctx.moveTo(dx - 12, dy);
    ctx.lineTo(dx - 22, dy - 6);
    ctx.lineTo(dx - 22, dy + 6);
    ctx.closePath();
    ctx.fill();
    
    // Cabeza
    ctx.beginPath();
    ctx.moveTo(dx + 12, dy);
    ctx.lineTo(dx + 24, dy - 10);
    ctx.lineTo(dx + 30, dy);
    ctx.lineTo(dx + 24, dy + 10);
    ctx.closePath();
    ctx.fill();
    
    // Ojos
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(dx + 20, dy - 6, 5, 5);
    ctx.fillRect(dx + 20, dy + 1, 5, 5);
    
    // Alas (si está persiguiendo)
    if (dragon.state === 'chase') {
      ctx.fillStyle = dragon.color;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(dx, dy - 8);
      ctx.lineTo(dx - 8, dy - 18);
      ctx.lineTo(dx + 8, dy - 8);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(dx, dy + 8);
      ctx.lineTo(dx - 8, dy + 18);
      ctx.lineTo(dx + 8, dy + 8);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  
  // Jugador
  const px = player.x * TILE;
  const py = player.y * TILE;
  ctx.fillStyle = '#00ff00';
  ctx.fillRect(px - 10, py - 10, 20, 20);
  
  // Objeto llevado
  if (player.carrying) {
    const item = player.carrying;
    const ox = px;
    const oy = py - 30;
    
    if (item.type === 'chalice') {
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(ox, oy - 5, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(ox, oy - 8);
      ctx.lineTo(ox - 7, oy + 5);
      ctx.lineTo(ox + 7, oy + 5);
      ctx.closePath();
      ctx.fill();
    } else if (item.type === 'sword') {
      ctx.fillStyle = '#c0c0c0';
      ctx.fillRect(ox - 2, oy - 15, 4, 22);
      ctx.fillRect(ox - 7, oy - 16, 14, 3);
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(ox - 3, oy + 7, 6, 6);
    } else if (item.type === 'key') {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(ox, oy - 5, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(ox - 1, oy - 1, 2, 10);
      ctx.fillRect(ox - 1, oy + 5, 6, 2);
    } else if (item.type === 'magnet') {
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(ox - 8, oy - 10, 4, 14);
      ctx.fillStyle = '#0000ff';
      ctx.fillRect(ox + 4, oy - 10, 4, 14);
      ctx.fillStyle = '#888888';
      ctx.fillRect(ox - 8, oy + 2, 12, 4);
    }
  }
  
  // HUD
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, W, 50);
  ctx.fillStyle = '#fff';
  ctx.font = '14px monospace';
  ctx.fillText(`Adventure | Room:${currentRoom.id} Score:${score} Best:${best} Speed:${speedFactor.toFixed(2)} (=/-) | P=Pause`, 20, 25);
  ctx.fillText(`Carrying:${player.carrying ? player.carrying.id : 'nothing'} | Find the golden chalice! | Space=Pick/Drop`, 20, 42);
  
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
  
  if (victory) {
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffd700';
    ctx.font = '48px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('VICTORY!', W / 2, H / 2 - 20);
    ctx.font = '24px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText('You have found the Enchanted Chalice!', W / 2, H / 2 + 30);
    ctx.font = '20px monospace';
    ctx.fillText('Press R to play again', W / 2, H / 2 + 70);
    ctx.fillText(`Final Score: ${score}`, W / 2, H / 2 + 100);
    ctx.textAlign = 'left';
  }
  
  if (gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff0000';
    ctx.font = '48px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('EATEN BY DRAGON', W / 2, H / 2);
    ctx.font = '20px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText('Press R to restart', W / 2, H / 2 + 50);
    ctx.fillText(`Score: ${score}`, W / 2, H / 2 + 80);
    ctx.textAlign = 'left';
  }
}

export function getStatus() {
  return `Adventure | Room:${currentRoom?.id || '?'} Score:${score} Carrying:${player.carrying?.id || 'none'}`;
}

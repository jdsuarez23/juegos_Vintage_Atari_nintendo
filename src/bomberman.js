// Bomberman básico inspirado en el clásico (implementación propia)
// Controles: Flechas / WASD para mover, Espacio para bomba, R reinicia nivel.
// Objetivo: Eliminar enemigos, revelar salida (puerta) y entrar para pasar de nivel.

import {Input} from './engine.js';

let canvas, ctx, input;

const COLS=15, ROWS=13, TILE=32; // 15x13 clásico
const HARD='#'; // muro indestructible
const SOFT='S'; // bloque destructible
const EXIT='E';

let offsetX=0, offsetY=0;

let grid=[]; // matriz de celdas
/* Celda puede ser:
   ' ' vacío
   '#' muro
   'S' bloque suave
   'E' salida (visible)
   'P?' power-up codificado: 'PB' (bomba), 'PF'(flama), 'PS'(speed)
*/

let player; // {x,y, speed, maxBombs, flame, bombsPlaced, alive, invuln, inputBuffer}
let bombs=[]; // {x,y, fuse, range, owner}
let explosions=[]; // {tiles:[{x,y}], timer}
let enemies=[]; // {x,y,speed,dir:{x,y},alive,aiTimer,mode,target}
let level=1, score=0, lives=3, gameOver=false, best=0;
let exitRevealed=false;
// NUEVO: control velocidad
let speedFactor=1; const MAX_SPEED_FACTOR=2.0; const MIN_SPEED_FACTOR=0.5; let _incHeld=false; let _decHeld=false;

function clamp(v,min,max){ return v<min?min:v>max?max:v; }
function rand(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
function inside(x,y){ return x>=0&&y>=0&&x<COLS&&y<ROWS; }

export function init(c,inp){ canvas=c; ctx=canvas.getContext('2d'); input=inp; score=score||0; level=level||1; lives=lives||3; gameOver=false; const b=localStorage.getItem('best_bomberman'); if(b) best=parseInt(b)||0; speedFactor=1; newLevel(); }
export function restart(){ level=1; score=0; lives=3; gameOver=false; speedFactor=1; newLevel(); }

function newLevel(){ bombs=[]; explosions=[]; enemies=[]; exitRevealed=false; buildGrid(); spawnPlayer(); spawnEnemies(); }

function buildGrid(){ grid=Array.from({length:ROWS},()=>Array(COLS).fill(' ')); // hard walls borde y patrón
 for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++){ if(y===0||y===ROWS-1||x===0||x===COLS-1 || (y%2===0 && x%2===0)) grid[y][x]=HARD; }
 // zona segura alrededor jugador (1,1)
 const safe=[[1,1],[1,2],[2,1]];
 // colocar soft blocks
 for(let y=1;y<ROWS-1;y++) for(let x=1;x<COLS-1;x++){
   if(grid[y][x]!==' ' ) continue;
   if(safe.some(p=>p[0]===x&&p[1]===y)) continue;
   if(Math.random()<0.65) grid[y][x]=SOFT;
 }
 // elegir una soft para la salida
 let softs=[]; for(let y=1;y<ROWS-1;y++) for(let x=1;x<COLS-1;x++) if(grid[y][x]===SOFT) softs.push({x,y});
 if(softs.length){ const pick=softs[rand(0,softs.length-1)]; grid[pick.y][pick.x]='S'; grid[pick.y][pick.x+0.0001]='S'; // marca dummy
 grid[pick.y][pick.x]='S*'; } // S* indica salida oculta
 // repartir powerups bajo algunas soft restantes
 const pool=['PB','PF','PF','PS'];
 for(const code of pool){ if(!softs.length) break; const idx=rand(0,softs.length-1); const p=softs.splice(idx,1)[0]; if(grid[p.y][p.x]==='S') grid[p.y][p.x]='S:'+code; }
 calcOffsets();
}

function calcOffsets(){ const w=COLS*TILE, h=ROWS*TILE; offsetX=Math.floor((canvas.width - w)/2); offsetY=Math.floor((canvas.height - h)/2); }

function spawnPlayer(){ 
  player={
    x:1,y:1,speed:3.2,maxBombs:1,flame:1,bombsPlaced:0,alive:true,invuln:0,
    inputBuffer:{dir:null, time:0}, // buffer para input más responsivo
    moving:false
  }; 
}

function spawnEnemies(){ 
  const count= clamp(3+Math.floor(level*0.8),3,12); 
  for(let i=0;i<count;i++){ 
    let x,y; 
    do { x=rand(1,COLS-2); y=rand(1,ROWS-2); } 
    while(grid[y][x]!== ' ' || (x===1&&y===1)); 
    enemies.push({
      x,y,
      speed:1.8 + Math.random()*0.6 + level*0.08, 
      dir:{x:0,y:0}, 
      alive:true, 
      aiTimer:0,
      mode:Math.random()<0.3?'aggressive':'patrol', // modos: patrol, aggressive, flee
      target:{x:player.x, y:player.y},
      stuckTimer:0
    }); 
  } 
}

function placeBomb(){ if(!player.alive) return; if(player.bombsPlaced>=player.maxBombs) return; const bx=Math.floor(player.x); const by=Math.floor(player.y); if(bombs.some(b=>b.x===bx&&b.y===by)) return; bombs.push({x:bx,y:by,fuse:2.3,range:player.flame,owner:player}); player.bombsPlaced++; }

function updateBombs(dt){ for(const b of bombs){ b.fuse-=dt; if(b.fuse<=0){ explodeBomb(b); } } bombs = bombs.filter(b=> b.fuse>0); }

function explodeBomb(b){ // crear explosión tiles
 const tiles=[{x:b.x,y:b.y}]; const dirs=[[1,0],[-1,0],[0,1],[0,-1]]; for(const d of dirs){ for(let i=1;i<=b.range;i++){ const nx=b.x + d[0]*i; const ny=b.y + d[1]*i; if(!inside(nx,ny)) break; const cell=grid[ny][nx]; if(cell===HARD) break; tiles.push({x:nx,y:ny}); if(cell.startsWith?.('S')){ destroySoft(nx,ny); break; } if(cell.startsWith?.('P')){ // visible powerup, explosión pasa
 } }
 }
 explosions.push({tiles,timer:0.5}); if(b.owner) b.owner.bombsPlaced=Math.max(0,b.owner.bombsPlaced-1); chainOtherBombs(tiles); }

function chainOtherBombs(tiles){ for(const t of tiles){ for(const b of bombs){ if(Math.abs(b.x-t.x)<0.1 && Math.abs(b.y-t.y)<0.1){ b.fuse=0; } } } }

function destroySoft(x,y){ const cell=grid[y][x]; if(cell==='S*'){ // revelar salida
   grid[y][x]=EXIT; exitRevealed=true; }
 else if(cell.startsWith('S:')){ const code=cell.split(':')[1]; grid[y][x]= 'P'+code; }
 else { grid[y][x]=' '; }
 score+=5; saveBest(); }

function updateExplosions(dt){ explosions.forEach(e=> e.timer-=dt); explosions=explosions.filter(e=> e.timer>0); }

function passable(x,y){ 
  if(!inside(x,y)) return false; 
  const c=grid[y][x]; 
  if(c===HARD) return false; 
  if(c && c[0]==='S') return false; // bloque suave
  return true; 
}

function passableForMovement(x,y,entity){ 
  if(!passable(x,y)) return false;
  // permitir quedarse sobre bomba recién colocada hasta que salga
  if(bombs.some(b=> b.x===Math.floor(x) && b.y===Math.floor(y))){
    // permitir si es bomba del jugador y el jugador aún está parcialmente sobre ella
    if(entity === player && Math.floor(player.x)===Math.floor(x) && Math.floor(player.y)===Math.floor(y)) return true;
    return false;
  }
  return true; 
}

function moveEntity(ent,dt,useSmartMovement=false){ 
  const speed=ent.speed * speedFactor; 
  if(ent.dir.x===0 && ent.dir.y===0) return; 
  
  const oldX = ent.x, oldY = ent.y;
  let nx=ent.x + ent.dir.x * speed * dt; 
  let ny=ent.y + ent.dir.y * speed * dt; 
  
  // Movimiento suavizado - permitir deslizamiento por bordes
  if(useSmartMovement) {
    const margin = 0.3; // margen para deslizamiento
    
    // Intentar movimiento principal
    let canMoveX = passableForMovement(nx, ent.y, ent);
    let canMoveY = passableForMovement(ent.x, ny, ent);
    
    // Si no puede moverse en la dirección principal, intentar deslizamiento
    if(!canMoveX && ent.dir.x !== 0) {
      // Intentar deslizarse hacia arriba o abajo
      if(passableForMovement(nx, ent.y - margin, ent)) {
        ny = ent.y - margin;
        canMoveX = true;
      } else if(passableForMovement(nx, ent.y + margin, ent)) {
        ny = ent.y + margin;
        canMoveX = true;
      }
    }
    
    if(!canMoveY && ent.dir.y !== 0) {
      // Intentar deslizarse hacia izquierda o derecha
      if(passableForMovement(ent.x - margin, ny, ent)) {
        nx = ent.x - margin;
        canMoveY = true;
      } else if(passableForMovement(ent.x + margin, ny, ent)) {
        nx = ent.x + margin;
        canMoveY = true;
      }
    }
    
    // Aplicar movimiento
    if(canMoveX) ent.x = nx;
    if(canMoveY) ent.y = ny;
    
    // Si no se pudo mover, alinear a la grilla
    if(!canMoveX || !canMoveY) {
      if(!canMoveX) ent.x = Math.round(ent.x * 2) / 2; // alineación más suave
      if(!canMoveY) ent.y = Math.round(ent.y * 2) / 2;
      if(ent !== player) ent.dir = {x:0, y:0}; // enemigos se detienen
    }
  } else {
    // colisión tile por tile (original para enemigos básicos)
    const tx=Math.floor(nx+0.5*ent.dir.x); 
    const ty=Math.floor(ny+0.5*ent.dir.y); 
    if(passableForMovement(tx,ty,ent)){ 
      ent.x=nx; ent.y=ny; 
    } else { 
      ent.x=Math.round(ent.x); ent.y=Math.round(ent.y); 
      ent.dir={x:0,y:0}; 
    } 
  }
}

function updatePlayer(dt){ 
  if(!player.alive) return; 
  
  // Input con buffer para mayor responsividad
  let newDir = null;
  if(input.pressed('arrowup','w')) newDir = {x:0, y:-1};
  else if(input.pressed('arrowdown','s')) newDir = {x:0, y:1};
  else if(input.pressed('arrowleft','a')) newDir = {x:-1, y:0};
  else if(input.pressed('arrowright','d')) newDir = {x:1, y:0};
  
  // Sistema de buffer de input
  if(newDir) {
    player.inputBuffer.dir = newDir;
    player.inputBuffer.time = 0.2; // buffer por 200ms
  }
  
  // Decrementar timer del buffer
  if(player.inputBuffer.time > 0) {
    player.inputBuffer.time -= dt;
  }
  
  // Aplicar dirección del buffer si es posible
  if(player.inputBuffer.dir && player.inputBuffer.time > 0) {
    const testDir = player.inputBuffer.dir;
    const testX = player.x + testDir.x * 0.1;
    const testY = player.y + testDir.y * 0.1;
    
    if(passableForMovement(testX, testY, player)) {
      player.dir = player.inputBuffer.dir;
      player.inputBuffer.time = 0; // consumir buffer
      player.moving = true;
    }
  }
  
  // Si no hay input nuevo, mantener dirección actual si es válida
  if(!newDir && player.moving) {
    const testX = player.x + player.dir.x * 0.1;
    const testY = player.y + player.dir.y * 0.1;
    
    if(!passableForMovement(testX, testY, player)) {
      player.dir = {x:0, y:0};
      player.moving = false;
    }
  }
  
  // Si no hay input, detener
  if(!newDir && !player.moving) {
    player.dir = {x:0, y:0};
  }
  
  moveEntity(player, dt, true); // usar movimiento inteligente
  
  if(input.pressed(' ')) { 
    if(!placeBomb._held){ placeBomb(); } 
    placeBomb._held=true; 
  } else placeBomb._held=false; 
  
  if(player.invuln>0) player.invuln-=dt; 
  // NUEVO: control velocidad
  if(input.pressed('=','+')){ if(!_incHeld){ speedFactor=Math.min(MAX_SPEED_FACTOR,speedFactor+0.1); _incHeld=true; } } else _incHeld=false;
  if(input.pressed('-','_')){ if(!_decHeld){ speedFactor=Math.max(MIN_SPEED_FACTOR,speedFactor-0.1); _decHeld=true; } } else _decHeld=false;
}

function updateEnemies(dt){ 
  for(const e of enemies){ 
    if(!e.alive) continue; 
    
    e.aiTimer -= dt;
    e.stuckTimer += dt;
    
    // Detectar si está atascado
    const oldX = e.x, oldY = e.y;
    
    // Actualizar target (posición del jugador)
    e.target = {x: player.x, y: player.y};
    
    // Cambiar modo basado en circunstancias
    const distToPlayer = Math.abs(e.x - player.x) + Math.abs(e.y - player.y);
    
    // Si hay explosión cerca, huir
    let nearExplosion = false;
    for(const exp of explosions) {
      for(const tile of exp.tiles) {
        if(Math.abs(tile.x - e.x) <= 2 && Math.abs(tile.y - e.y) <= 2) {
          nearExplosion = true;
          break;
        }
      }
      if(nearExplosion) break;
    }
    
    if(nearExplosion) {
      e.mode = 'flee';
      e.aiTimer = 0; // cambiar dirección inmediatamente
    } else if(distToPlayer < 4 && Math.random() < 0.3) {
      e.mode = 'aggressive';
    } else if(distToPlayer > 8) {
      e.mode = 'patrol';
    }
    
    if(e.aiTimer <= 0 || (e.dir.x === 0 && e.dir.y === 0) || e.stuckTimer > 1.0) { 
      
      let newDir = {x:0, y:0};
      
      if(e.mode === 'aggressive') {
        // Perseguir al jugador usando pathfinding simple
        newDir = getDirectionToPlayer(e);
        e.aiTimer = 0.3 + Math.random() * 0.4;
        
      } else if(e.mode === 'flee') {
        // Huir del jugador y explosiones
        newDir = getFleeDirection(e);
        e.aiTimer = 0.2 + Math.random() * 0.3;
        
      } else { // patrol
        // Movimiento aleatorio evitando reversa
        const dirs = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
        const dir = dirs[Math.floor(Math.random()*dirs.length)];
        newDir = {x:dir.x, y:dir.y};
        e.aiTimer = 0.4 + Math.random() * 0.6;
      }
      
      // Probar nuevo dirección
      const testX = e.x + newDir.x * 0.1;
      const testY = e.y + newDir.y * 0.1;
      
      if(passableForMovement(testX, testY, e)) {
        e.dir = newDir;
      } else {
        e.dir = {x:0, y:0}; // detener si no se puede mover
      }
    }
    
    moveEntity(e, dt, true);
  } 
}

function getDirectionToPlayer(enemy) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  
  if(absDx > absDy) {
    return { x: dx > 0 ? 1 : -1, y: 0 };
  } else {
    return { x: 0, y: dy > 0 ? 1 : -1 };
  }
}

function getFleeDirection(enemy) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  
  if(absDx > absDy) {
    return { x: dx < 0 ? 1 : -1, y: 0 };
  } else {
    return { x: 0, y: dy < 0 ? 1 : -1 };
  }
}

function saveBest(){
 if(score<=best) return; 
 localStorage.setItem('best_bomberman',score); 
 best=score; 
}

// Colisiones y pickups
function checkCollisions(){
  // Player tocando power-ups
  const px = Math.floor(player.x);
  const py = Math.floor(player.y);
  const cell = grid[py]?.[px];
  
  if(cell && cell.startsWith('P')){
    const code = cell.substring(1);
    if(code === 'PB') player.maxBombs++;
    else if(code === 'PF') player.flame++;
    else if(code === 'PS') player.speed = Math.min(5, player.speed + 0.6);
    grid[py][px] = ' ';
    score += 20;
    saveBest();
  }
  
  // Player entra en salida
  if(cell === EXIT && exitRevealed){
    level++;
    score += 100 * level;
    saveBest();
    newLevel();
    return;
  }
  
  // Explosiones dañan jugador y enemigos
  for(const exp of explosions){
    for(const tile of exp.tiles){
      // Daño a jugador
      if(player.alive && player.invuln <= 0){
        const dist = Math.abs(tile.x - player.x) + Math.abs(tile.y - player.y);
        if(dist < 0.8){
          lives--;
          if(lives <= 0){
            gameOver = true;
            player.alive = false;
          } else {
            player.invuln = 1.5;
            player.x = 1;
            player.y = 1;
          }
        }
      }
      
      // Daño a enemigos
      for(const e of enemies){
        if(!e.alive) continue;
        const dist = Math.abs(tile.x - e.x) + Math.abs(tile.y - e.y);
        if(dist < 0.8){
          e.alive = false;
          score += 150;
          saveBest();
        }
      }
    }
  }
  
  // Enemigos tocan jugador
  if(player.alive && player.invuln <= 0){
    for(const e of enemies){
      if(!e.alive) continue;
      const dist = Math.abs(e.x - player.x) + Math.abs(e.y - player.y);
      if(dist < 0.6){
        lives--;
        if(lives <= 0){
          gameOver = true;
          player.alive = false;
        } else {
          player.invuln = 1.5;
          player.x = 1;
          player.y = 1;
        }
        break;
      }
    }
  }
  
  // Victoria si todos enemigos muertos
  if(enemies.every(e => !e.alive)){
    // revelar salida si no está revelada
    if(!exitRevealed){
      for(let y = 0; y < ROWS; y++){
        for(let x = 0; x < COLS; x++){
          if(grid[y][x] === 'S*'){
            grid[y][x] = EXIT;
            exitRevealed = true;
          }
        }
      }
    }
  }
}

// Update principal
export function update(dt){
  if(input.pressed('r')){
    restart();
    input.keys.delete('r');
  }
  
  if(gameOver) return;
  
  updatePlayer(dt);
  updateEnemies(dt);
  updateBombs(dt);
  updateExplosions(dt);
  checkCollisions();
}

// Render
export function draw(){
  drawGame();
}

function drawGame(){
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  calcOffsets();
  
  // Dibujar grilla y celdas
  for(let y = 0; y < ROWS; y++){
    for(let x = 0; x < COLS; x++){
      const cell = grid[y][x];
      const px = offsetX + x * TILE;
      const py = offsetY + y * TILE;
      
      // Fondo base
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(px, py, TILE, TILE);
      
      // Dibujar según tipo
      if(cell === HARD){
        ctx.fillStyle = '#4a4a4a';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = '#5a5a5a';
        ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
      } else if(cell && cell[0] === 'S'){
        // Bloque suave
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = '#a0522d';
        ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
      } else if(cell === EXIT){
        // Salida visible
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
        ctx.strokeStyle = '#00aa00';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 4, py + 4, TILE - 8, TILE - 8);
      } else if(cell && cell.startsWith('P')){
        // Power-up
        const code = cell.substring(1);
        ctx.fillStyle = code === 'PB' ? '#ff9800' : code === 'PF' ? '#f44336' : '#2196f3';
        ctx.beginPath();
        ctx.arc(px + TILE/2, py + TILE/2, TILE/3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  
  // Dibujar bombas
  for(const b of bombs){
    const px = offsetX + b.x * TILE + TILE/2;
    const py = offsetY + b.y * TILE + TILE/2;
    const pulse = Math.sin(b.fuse * 8) * 0.2 + 0.8;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(px, py, TILE * 0.35 * pulse, 0, Math.PI * 2);
    ctx.fill();
    // Mecha
    ctx.strokeStyle = b.fuse < 0.5 ? '#ff0000' : '#ffa500';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py - TILE * 0.35 * pulse);
    ctx.lineTo(px + 3, py - TILE * 0.5 * pulse);
    ctx.stroke();
  }
  
  // Dibujar explosiones
  for(const exp of explosions){
    const alpha = exp.timer / 0.5;
    ctx.globalAlpha = alpha;
    for(const tile of exp.tiles){
      const px = offsetX + tile.x * TILE;
      const py = offsetY + tile.y * TILE;
      ctx.fillStyle = '#ffff00';
      ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
      ctx.fillStyle = '#ff6600';
      ctx.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
    }
    ctx.globalAlpha = 1;
  }
  
  // Dibujar jugador
  if(player.alive){
    const px = offsetX + player.x * TILE + TILE/2;
    const py = offsetY + player.y * TILE + TILE/2;
    
    if(player.invuln > 0 && Math.floor(player.invuln * 10) % 2 === 0){
      ctx.globalAlpha = 0.3;
    }
    
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(px - TILE * 0.35, py - TILE * 0.35, TILE * 0.7, TILE * 0.7);
    ctx.fillStyle = '#00cc00';
    ctx.fillRect(px - TILE * 0.25, py - TILE * 0.25, TILE * 0.5, TILE * 0.5);
    
    ctx.globalAlpha = 1;
  }
  
  // Dibujar enemigos
  for(const e of enemies){
    if(!e.alive) continue;
    const px = offsetX + e.x * TILE + TILE/2;
    const py = offsetY + e.y * TILE + TILE/2;
    
    const color = e.mode === 'aggressive' ? '#ff0000' : e.mode === 'flee' ? '#ffaa00' : '#ff00ff';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, TILE * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(px - 4, py - 6, 3, 3);
    ctx.fillRect(px + 1, py - 6, 3, 3);
  }
  
  // HUD
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, canvas.width, 50);
  ctx.fillStyle = '#fff';
  ctx.font = '14px monospace';
  ctx.fillText(`Bomberman | Level:${level} Score:${score} Lives:${lives} Best:${best} Speed:${speedFactor.toFixed(2)} (=/-)`, 12, 22);
  ctx.fillText(`Bombs:${player.maxBombs} Flame:${player.flame} Exit:${exitRevealed?'Open':'Hidden'}`, 12, 40);
  
  if(gameOver){
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ff0000';
    ctx.font = '48px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2);
    ctx.font = '20px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText('Press R to restart', canvas.width/2, canvas.height/2 + 50);
    ctx.fillText(`Final Score: ${score}`, canvas.width/2, canvas.height/2 + 80);
    ctx.textAlign = 'left';
  }
}

export function getStatus(){
  return `Bomberman | Lvl:${level} Score:${score} Lives:${lives} Spd:${speedFactor.toFixed(2)}`;
}

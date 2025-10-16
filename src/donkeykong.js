// Donkey Kong clásico - Implementación inspirada en el original (1981)
// Controles: A/D o Flechas izq/der para mover, W/Flecha arriba para subir escaleras, S/Flecha abajo para bajar, Espacio para saltar
// Objetivo: Llegar hasta Pauline evitando los barriles que lanza Donkey Kong

let canvas, ctx, input;
let level = 1, score = 0, lives = 3, gameOver = false, levelComplete = false;
let best = 0;
// NUEVO: control velocidad
let speedFactor=1; const MAX_SPEED_FACTOR=2.0; const MIN_SPEED_FACTOR=0.5; let _incHeld=false; let _decHeld=false;

const GRAVITY = 800;
const JUMP_STRENGTH = -350;
const PLAYER_SPEED = 120;
const BARREL_SPEED = 80;
const MAX_VARIABLE_JUMP_HOLD = 0.16; // salto variable

let player;
let barrels = [];
let platforms = [];
let ladders = [];
let donkeyKong;
let pauline;
let gameTime = 0;
let barrelSpawnTimer = 0;
let hammer = null; // {x,y,active}
let hammerTime = 0; // tiempo restante usando martillo
let hammerSpawnTimer = 0;

export function init(c, inp) {
  canvas = c;
  ctx = canvas.getContext('2d');
  input = inp;
  speedFactor=1;
  const saved = localStorage.getItem('best_donkeykong');
  if(saved) best = parseInt(saved) || 0;
  
  setupLevel();
}

export function restart() {
  level = 1;
  score = 0;
  lives = 3;
  gameOver = false;
  levelComplete = false;
  speedFactor=1;
  setupLevel();
}

function setupLevel() {
  gameTime = 0;
  barrelSpawnTimer = 0;
  barrels = [];
  hammer = null;
  hammerTime = 0;
  hammerSpawnTimer = 5 + Math.random()*5;
  
  // Player starting position
  player = {
    x: 50,
    y: canvas.height - 100,
    width: 16,
    height: 24,
    vx: 0,
    vy: 0,
    onGround: false,
    onLadder: false,
    climbing: false,
    facingRight: true,
    invulnerable: 0,
    animFrame: 0,
    animTime: 0
  };

  // Donkey Kong position
  donkeyKong = {
    x: 80,
    y: 80,
    width: 40,
    height: 40,
    animFrame: 0,
    animTime: 0,
    throwTimer: 0
  };

  // Pauline position
  pauline = {
    x: canvas.width - 100,
    y: 60,
    width: 16,
    height: 24,
    helpAnimTime: 0
  };

  // Setup platforms (classic Donkey Kong structure)
  platforms = [
    { x: 0, y: canvas.height - 40, width: canvas.width, height: 40, slope:0 },
    { x: 100, y: canvas.height - 140, width: canvas.width - 100, height: 20, slope: +0.25 },
    { x: 0, y: canvas.height - 240, width: canvas.width - 100, height: 20, slope: -0.25 },
    { x: 100, y: canvas.height - 340, width: canvas.width - 100, height: 20, slope: +0.25 },
    { x: 0, y: 100, width: canvas.width, height: 20, slope:0 },
    { x: 60, y: 120, width: 80, height: 20, slope:0 }
  ];

  // Setup ladders
  ladders = [
    // Bottom to second
    { x: canvas.width - 50, y: canvas.height - 140, width: 20, height: 100 },
    
    // Second to third
    { x: 50, y: canvas.height - 240, width: 20, height: 100 },
    
    // Third to fourth  
    { x: canvas.width - 50, y: canvas.height - 340, width: 20, height: 100 },
    
    // Fourth to top
    { x: 50, y: 100, width: 20, height: 240 },
    
    // Partial ladders for variety
    { x: 250, y: canvas.height - 240, width: 20, height: 60 },
    { x: 400, y: canvas.height - 340, width: 20, height: 60 }
  ];
}

function updatePlayer(dt) {
  if (!player || gameOver || levelComplete) return;

  player.animTime += dt;
  if (player.animTime > 0.15) {
    player.animFrame = (player.animFrame + 1) % 4;
    player.animTime = 0;
  }

  if (player.invulnerable > 0) {
    player.invulnerable -= dt;
  }

  // Input handling
  // Ajuste velocidad
  if(input.pressed('=','+')){ if(!_incHeld){ speedFactor=Math.min(MAX_SPEED_FACTOR,speedFactor+0.1); _incHeld=true; } } else _incHeld=false;
  if(input.pressed('-','_')){ if(!_decHeld){ speedFactor=Math.max(MIN_SPEED_FACTOR,speedFactor-0.1); _decHeld=true; } } else _decHeld=false;
  // Input horizontal
  let moveLeft = input.pressed('a','arrowleft');
  let moveRight = input.pressed('d','arrowright');
  if (moveLeft){ player.vx = -PLAYER_SPEED * speedFactor; player.facingRight=false; }
  else if (moveRight){ player.vx = PLAYER_SPEED * speedFactor; player.facingRight=true; }
  else player.vx = 0;

  // Ladder climbing
  player.climbing = false; let onAnyLadder=false;
  for(const ladder of ladders){
    const cx = player.x + player.width/2;
    if(cx > ladder.x+ladder.width*0.2 && cx < ladder.x+ladder.width*0.8 && player.y + player.height > ladder.y && player.y < ladder.y + ladder.height){
      onAnyLadder=true;
      if(input.pressed('w','arrowup')){ player.vy = -PLAYER_SPEED * speedFactor; player.climbing=true; player.vx=0; break; }
      else if(input.pressed('s','arrowdown')){ player.vy = PLAYER_SPEED * speedFactor; player.climbing=true; player.vx=0; break; }
    }
  }
  if(!onAnyLadder) player.onLadder=false; else player.onLadder=true;

  // Gravedad / salto variable
  if(!player.climbing){ player.vy += GRAVITY*dt; }
  if(input.pressed(' ') && player.onGround && !player.climbing){
    if(!player._jumping){ player.vy = JUMP_STRENGTH * speedFactor; player._jumping=true; player._jumpHold=0; }
  }
  if(player._jumping){
    if(input.pressed(' ')){ player._jumpHold += dt; if(player._jumpHold < MAX_VARIABLE_JUMP_HOLD){ player.vy += -GRAVITY*0.55*dt; } }
    else player._jumping=false;
    if(player.vy>0) player._jumping=false; // cayó
  }
  if(player.onGround && !input.pressed(' ')) player._jumping=false;

  // Posición provisional
  player.x += player.vx * dt; player.y += player.vy * dt;

  // Colisiones con plataformas
  player.onGround=false;
  const platBelow = getPlatformBelow(player);
  for (const p of platforms){
    if(player.x + player.width > p.x && player.x < p.x + p.width && player.y + player.height > p.y && player.y + player.height < p.y + p.height + 12 && player.vy>=0){
      player.y = p.y - player.height; player.vy=0; player.onGround=true; // efecto pendiente
      if(Math.abs(p.slope)>0 && !player.climbing){ player.x += p.slope * 30 * dt * speedFactor; }
    }
  }

  // Limites
  player.x = Math.max(0, Math.min(canvas.width-player.width, player.x));
  if(player.y > canvas.height + 60) loseLife();

  // Martillo pickup
  if(hammer && !hammer.active && overlap(player, {x:hammer.x,y:hammer.y,width:14,height:20})){ hammer.active=true; hammerTime=8; score+=200; saveBest(); }

  // Victoria
  if (Math.abs(player.x - pauline.x) < 26 && Math.abs(player.y - pauline.y) < 26) {
    if(!levelComplete){ levelComplete=true; const timeBonus = Math.max(0, Math.floor(500 + (10 - (gameTime%10))*10)); score += timeBonus; saveBest(); }
  }
}

function updateBarrels(dt){
  barrelSpawnTimer += dt; hammerSpawnTimer -= dt;
  if(hammerSpawnTimer<=0 && !hammer){ hammer={x: 40 + Math.random()*(canvas.width-80), y: canvas.height - 80, active:false}; hammerSpawnTimer = 18 + Math.random()*10; }
  if (barrelSpawnTimer > (2.4 - level * 0.18) / speedFactor && barrels.length < 10){
    barrels.push({x: donkeyKong.x + 20, y: donkeyKong.y + 40, vx: (BARREL_SPEED + level*8) * speedFactor, vy:0, rotation:0, onGround:false});
    barrelSpawnTimer=0; donkeyKong.throwTimer=0.45;
  }
  for(let i=barrels.length-1;i>=0;i--){ const b=barrels[i]; b.vy += GRAVITY*dt; b.x += b.vx*dt; b.y += b.vy*dt; b.rotation += b.vx*dt*0.01;
    b.onGround=false; let onPlat=null;
    for(const p of platforms){ if(b.x+16>p.x && b.x<p.x+p.width && b.y+16>p.y && b.y+16<p.y+p.height+10 && b.vy>=0){ b.y=p.y-16; b.vy=0; b.onGround=true; onPlat=p; break; } }
    if(onPlat){ // aplicar pendiente
      if(Math.abs(onPlat.slope)>0){ b.x += onPlat.slope * 40 * dt * speedFactor; b.vx = (BARREL_SPEED + level*8) * speedFactor * Math.sign(onPlat.slope||1); }
      // Caer por escalera si alineado
      for(const ladder of ladders){ if(Math.abs((b.x+8) - (ladder.x+ladder.width/2))<12 && Math.random()<0.04){ b.vy = 60; b.vx *= 0.4; break; } }
    }
    // Hammer destrucción
    if(hammerTime>0 && distMid(player,b)<40){ barrels.splice(i,1); score+=150; saveBest(); continue; }
    if(b.y > canvas.height+80 || b.x<-60 || b.x>canvas.width+60) barrels.splice(i,1);
    else if(player.invulnerable<=0 && overlapCircle(player,b,14)){ if(hammerTime>0){ barrels.splice(i,1); score+=100; saveBest(); } else loseLife(); }
  }
}

function updateDonkeyKong(dt) {
  donkeyKong.animTime += dt;
  if (donkeyKong.animTime > 0.3) {
    donkeyKong.animFrame = (donkeyKong.animFrame + 1) % 2;
    donkeyKong.animTime = 0;
  }

  if (donkeyKong.throwTimer > 0) {
    donkeyKong.throwTimer -= dt;
  }
}

function updateHammer(dt) {
  if (hammerTime > 0) {
    hammerTime -= dt;
    if (hammerTime <= 0 && hammer) { hammer=null; }
  }
}

function loseLife() {
  lives--;
  player.invulnerable = 2;
  
  if (lives <= 0) {
    gameOver = true;
  } else {
    // Reset player position
    player.x = 50;
    player.y = canvas.height - 100;
    player.vx = 0;
    player.vy = 0;
  }
}

export function update(dt) {
  if (input.pressed('r')) {
    restart();
    return;
  }

  if (levelComplete) {
    // Auto advance to next level after delay
    gameTime += dt;
    if (gameTime > 2) {
      level++;
      levelComplete = false;
      setupLevel();
    }
    return;
  }

  gameTime += dt;
  updatePlayer(dt);
  updateBarrels(dt);
  updateDonkeyKong(dt);
  updateHammer(dt);
}

export function draw() {
  // Clear screen
  ctx.fillStyle = '#000814';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw platforms
  ctx.fillStyle = '#ff006e';
  for (const platform of platforms) {
    ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    
    // Platform details
    ctx.fillStyle = '#c77dff';
    for (let x = platform.x; x < platform.x + platform.width; x += 20) {
      ctx.fillRect(x + 2, platform.y + 2, 16, 4);
    }
    ctx.fillStyle = '#ff006e';
  }

  // Draw ladders
  ctx.fillStyle = '#ffd60a';
  for (const ladder of ladders) {
    ctx.fillRect(ladder.x, ladder.y, ladder.width, ladder.height);
    
    // Ladder rungs
    ctx.fillStyle = '#003566';
    for (let y = ladder.y; y < ladder.y + ladder.height; y += 12) {
      ctx.fillRect(ladder.x, y, ladder.width, 3);
    }
    ctx.fillStyle = '#ffd60a';
  }

  // Draw Donkey Kong
  ctx.save();
  ctx.translate(donkeyKong.x + donkeyKong.width/2, donkeyKong.y + donkeyKong.height/2);
  
  // Body
  ctx.fillStyle = donkeyKong.throwTimer > 0 ? '#8b4513' : '#654321';
  ctx.fillRect(-20, -15, 40, 30);
  
  // Head
  ctx.fillStyle = '#654321';
  ctx.fillRect(-15, -25, 30, 20);
  
  // Eyes
  ctx.fillStyle = '#fff';
  ctx.fillRect(-12, -20, 6, 6);
  ctx.fillRect(6, -20, 6, 6);
  ctx.fillStyle = '#000';
  ctx.fillRect(-10, -18, 2, 2);
  ctx.fillRect(8, -18, 2, 2);
  
  // Arms (animated when throwing)
  ctx.fillStyle = '#654321';
  if (donkeyKong.throwTimer > 0) {
    ctx.fillRect(-25, -10, 15, 8); // Left arm up
    ctx.fillRect(20, -5, 15, 8);   // Right arm
  } else {
    ctx.fillRect(-25, -5, 15, 8);  // Left arm
    ctx.fillRect(20, -5, 15, 8);   // Right arm
  }
  
  ctx.restore();

  // Draw Pauline
  ctx.save();
  ctx.translate(pauline.x + pauline.width/2, pauline.y + pauline.height/2);
  
  // Dress
  ctx.fillStyle = '#ff69b4';
  ctx.fillRect(-8, -5, 16, 20);
  
  // Head
  ctx.fillStyle = '#ffdbac';
  ctx.fillRect(-6, -15, 12, 12);
  
  // Hair
  ctx.fillStyle = '#8b4513';
  ctx.fillRect(-8, -20, 16, 8);
  
  // Help animation
  pauline.helpAnimTime += 0.02;
  if (Math.sin(pauline.helpAnimTime) > 0) {
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('HELP!', 0, -25);
  }
  
  ctx.restore();

  // Draw player
  if (player.invulnerable <= 0 || Math.floor(player.invulnerable * 10) % 2) {
    ctx.save();
    ctx.translate(player.x + player.width/2, player.y + player.height/2);
    
    if (!player.facingRight) {
      ctx.scale(-1, 1);
    }
    
    // Body
    ctx.fillStyle = '#0077be';
    ctx.fillRect(-6, -5, 12, 15);
    
    // Head
    ctx.fillStyle = '#ffdbac';
    ctx.fillRect(-5, -15, 10, 10);
    
    // Hat
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(-6, -18, 12, 6);
    
    // Arms and legs (simple animation)
    ctx.fillStyle = '#0077be';
    const legOffset = Math.sin(player.animFrame) * 2;
    ctx.fillRect(-8, 8, 4, 8 + legOffset);
    ctx.fillRect(4, 8, 4, 8 - legOffset);
    
    ctx.restore();
  }

  // Draw barrels
  ctx.fillStyle = '#d2691e';
  for (const barrel of barrels) {
    ctx.save();
    ctx.translate(barrel.x + 8, barrel.y + 8);
    ctx.rotate(barrel.rotation);
    
    // Barrel body
    ctx.fillRect(-8, -8, 16, 16);
    
    // Barrel bands
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(-8, -2, 16, 2);
    ctx.fillRect(-8, 2, 16, 2);
    
    ctx.restore();
  }

  // Martillo
  if(hammer && !hammer.active){ ctx.fillStyle='#ccc'; ctx.fillRect(hammer.x,hammer.y,6,20); ctx.fillStyle='#ff0'; ctx.fillRect(hammer.x-6,hammer.y,18,8); }
  if(hammerTime>0){ // martillo activo animado junto jugador
    ctx.save(); ctx.translate(player.x+player.width/2, player.y+player.height/2);
    const ang = Math.sin((8-hammerTime)*20)*Math.PI*0.4;
    ctx.rotate(ang); ctx.fillStyle='#ff0'; ctx.fillRect(4,-4,18,8); ctx.fillStyle='#ccc'; ctx.fillRect(0,-4,6,28); ctx.restore();
  }

  // Draw UI
  drawUI();
  
  if (gameOver) {
    drawGameOver();
  } else if (levelComplete) {
    drawLevelComplete();
  }
}

function drawUI() {
  ctx.fillStyle = '#fff';
  ctx.font = '16px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`Score: ${score}`, 10, 25);
  ctx.fillText(`Lives: ${lives}`, 10, 45);
  ctx.fillText(`Level: ${level}`, 10, 65);
  ctx.fillText(`Best: ${best}`, canvas.width - 120, 25);
  ctx.fillText(`Speed: ${speedFactor.toFixed(2)} (=/-)`, canvas.width - 120, 45);
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.fillStyle = '#ff0000';
  ctx.font = '48px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2 - 20);
  
  ctx.fillStyle = '#fff';
  ctx.font = '20px monospace';
  ctx.fillText('Press R to restart', canvas.width/2, canvas.height/2 + 30);
  
  ctx.textAlign = 'left';
}

function drawLevelComplete() {
  ctx.fillStyle = 'rgba(0,100,0,0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.fillStyle = '#00ff00';
  ctx.font = '36px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('LEVEL COMPLETE!', canvas.width/2, canvas.height/2 - 20);
  
  ctx.fillStyle = '#fff';
  ctx.font = '18px monospace';
  ctx.fillText(`+${500 + (level * 100)} points`, canvas.width/2, canvas.height/2 + 20);
  
  ctx.textAlign = 'left';
}

export function getStatus() {
  return `Donkey Kong | Score: ${score} Lvl:${level} Lives:${lives} Hammer:${hammerTime>0?hammerTime.toFixed(1):'-'} Spd:${speedFactor.toFixed(2)}`;
}

function saveBest() {
  if (score > best) {
    best = score;
    localStorage.setItem('best_donkeykong', best.toString());
  }
}

function overlap(a,b){ return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }
function distMid(a,b){ return Math.hypot((a.x+a.width/2)-(b.x+8),(a.y+a.height/2)-(b.y+8)); }
function overlapCircle(a,b,r){ return distMid(a,b) < r; }
function getPlatformBelow(ent){ return platforms.find(p=> ent.x + ent.width>p.x && ent.x < p.x+p.width && Math.abs((ent.y+ent.height)-p.y)<4); }

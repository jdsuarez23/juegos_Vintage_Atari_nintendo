// Super Mario Bros - Implementación inspirada en el clásico (1985)
// Controles: A/D o Flechas para mover, W/Flecha arriba/Espacio para saltar, Shift para correr, F para disparar
// Objetivo: Llegar al final del nivel, recoger monedas, eliminar enemigos

let canvas, ctx, input;
let level = 1, score = 0, lives = 3, coins = 0, gameOver = false, levelComplete = false;
let best = 0;
// Control velocidad
let speedFactor=1; const MAX_SPEED_FACTOR=2.0; const MIN_SPEED_FACTOR=0.5; let _incHeld=false; let _decHeld=false;

const GRAVITY = 1200;
const JUMP_STRENGTH = -400;
const PLAYER_SPEED = 150;
const ENEMY_SPEED = 60;
const ACCEL = 900; // aceleración horizontal
const MAX_SPEED = 180;
const FRICTION = 1200;
const MAX_JUMP_HOLD = 0.25; // Aumentado para mejor control del salto
const SPRINT_MULTIPLIER = 1.5; // Multiplicador de velocidad al correr

let player;
let enemies = [];
let platforms = [];
let collectibles = [];
let blocks = [];
let fireballs = [];
let camera = { x: 0, y: 0 };
let gameTime = 0;
let levelWidth = 2400;
let flag, castle;

export function init(c, inp) {
  canvas = c;
  ctx = canvas.getContext('2d');
  input = inp;
  speedFactor=1;
  
  const saved = localStorage.getItem('best_mario');
  if(saved) best = parseInt(saved) || 0;
  
  setupLevel();
}

export function restart() {
  level = 1;
  score = 0;
  lives = 3;
  coins = 0;
  gameOver = false;
  levelComplete = false;
  speedFactor=1;
  setupLevel();
}

function setupLevel() {
  gameTime = 0;
  enemies = [];
  collectibles = [];
  blocks = [];
  fireballs = [];
  camera = { x: 0, y: 0 };
  
  // Player starting position
  player = {
    x: 100,
    y: canvas.height - 150,
    width: 16,
    height: 24,
    vx: 0,
    vy: 0,
    onGround: false,
    facingRight: true,
    invulnerable: 0,
    animFrame: 0,
    animTime: 0,
    big: false,
    hasFire: false,
    fireballCooldown: 0,
    powerupTime: 0,
    sprinting: false
  };

  // Generate level platforms
  platforms = [
    // Ground level
    { x: 0, y: canvas.height - 40, width: levelWidth, height: 40, type: 'ground' },
    
    // Floating platforms
    { x: 300, y: canvas.height - 140, width: 120, height: 20, type: 'platform' },
    { x: 500, y: canvas.height - 200, width: 80, height: 20, type: 'platform' },
    { x: 700, y: canvas.height - 160, width: 100, height: 20, type: 'platform' },
    { x: 900, y: canvas.height - 220, width: 120, height: 20, type: 'platform' },
    { x: 1200, y: canvas.height - 180, width: 100, height: 20, type: 'platform' },
    { x: 1400, y: canvas.height - 140, width: 80, height: 20, type: 'platform' },
    { x: 1600, y: canvas.height - 200, width: 120, height: 20, type: 'platform' },
    { x: 1900, y: canvas.height - 160, width: 100, height: 20, type: 'platform' },
    
    // Pipes
    { x: 800, y: canvas.height - 80, width: 40, height: 40, type: 'pipe' },
    { x: 1300, y: canvas.height - 120, width: 40, height: 80, type: 'pipe' },
    { x: 1800, y: canvas.height - 100, width: 40, height: 60, type: 'pipe' }
  ];

  // Generate blocks
  blocks = [
    { x: 250, y: canvas.height - 180, width: 20, height: 20, type: 'brick', breakable: true },
    { x: 270, y: canvas.height - 180, width: 20, height: 20, type: 'question', item: 'coin' },
    { x: 290, y: canvas.height - 180, width: 20, height: 20, type: 'brick', breakable: true },
    { x: 310, y: canvas.height - 180, width: 20, height: 20, type: 'question', item: 'powerup' },
    
    { x: 450, y: canvas.height - 240, width: 20, height: 20, type: 'brick', breakable: true },
    { x: 470, y: canvas.height - 240, width: 20, height: 20, type: 'question', item: 'coin' },
    
    { x: 650, y: canvas.height - 200, width: 20, height: 20, type: 'question', item: 'coin' },
    { x: 750, y: canvas.height - 200, width: 20, height: 20, type: 'brick', breakable: true },
    
    { x: 1100, y: canvas.height - 220, width: 20, height: 20, type: 'question', item: 'fireflower' },
    { x: 1350, y: canvas.height - 180, width: 20, height: 20, type: 'brick', breakable: true },
    { x: 1370, y: canvas.height - 180, width: 20, height: 20, type: 'question', item: 'coin' },
    
    { x: 1550, y: canvas.height - 240, width: 20, height: 20, type: 'question', item: 'coin' },
    { x: 1750, y: canvas.height - 200, width: 20, height: 20, type: 'brick', breakable: true },
    { x: 1850, y: canvas.height - 200, width: 20, height: 20, type: 'question', item: 'powerup' },
    
    // Bloque invisible
    { x: 350, y: canvas.height - 180, width: 20, height: 20, type: 'invisible', item: 'coin', visible: false }
  ];

  // Generate enemies (Goombas and Koopas)
  enemies = [
    { x: 400, y: canvas.height - 60, width: 16, height: 16, type: 'goomba', vx: -ENEMY_SPEED * speedFactor, alive: true, squished: false },
    { x: 600, y: canvas.height - 60, width: 16, height: 24, type: 'koopa', vx: -ENEMY_SPEED * speedFactor, alive: true, shell: false },
    { x: 850, y: canvas.height - 60, width: 16, height: 16, type: 'goomba', vx: -ENEMY_SPEED * speedFactor, alive: true, squished: false },
    { x: 1100, y: canvas.height - 60, width: 16, height: 16, type: 'goomba', vx: -ENEMY_SPEED * speedFactor, alive: true, squished: false },
    { x: 1400, y: canvas.height - 60, width: 16, height: 24, type: 'koopa', vx: -ENEMY_SPEED * speedFactor, alive: true, shell: false },
    { x: 1700, y: canvas.height - 60, width: 16, height: 16, type: 'goomba', vx: -ENEMY_SPEED * speedFactor, alive: true, squished: false },
    { x: 2000, y: canvas.height - 60, width: 16, height: 16, type: 'goomba', vx: -ENEMY_SPEED * speedFactor, alive: true, squished: false }
  ];

  // Generate collectibles
  collectibles = [
    { x: 350, y: canvas.height - 100, width: 12, height: 12, type: 'coin', collected: false },
    { x: 550, y: canvas.height - 120, width: 12, height: 12, type: 'coin', collected: false },
    { x: 750, y: canvas.height - 100, width: 12, height: 12, type: 'coin', collected: false },
    { x: 950, y: canvas.height - 120, width: 12, height: 12, type: 'coin', collected: false },
    { x: 1250, y: canvas.height - 100, width: 12, height: 12, type: 'coin', collected: false },
    { x: 1550, y: canvas.height - 120, width: 12, height: 12, type: 'coin', collected: false },
    { x: 1850, y: canvas.height - 100, width: 12, height: 12, type: 'coin', collected: false }
  ];
  
  // Bandera final
  flag = {
    x: levelWidth - 100,
    y: canvas.height - 200,
    width: 20,
    height: 120,
    pole: { x: levelWidth - 90, y: canvas.height - 200, width: 10, height: 120 },
    reached: false
  };

  // Castillo
  castle = {
    x: levelWidth - 200,
    y: canvas.height - 160,
    width: 100,
    height: 120
  };
}

function updatePlayer(dt) {
  if (!player || gameOver || levelComplete) return;

  // Animación
  player.animTime += dt; 
  if(player.animTime>0.12){ 
    player.animFrame=(player.animFrame+1)%4; 
    player.animTime=0; 
  }
  if(player.invulnerable>0) player.invulnerable-=dt; 
  if(player.powerupTime>0) player.powerupTime-=dt;
  if(player.fireballCooldown>0) player.fireballCooldown-=dt;

  // Input horizontal con aceleración
  let left = input.pressed('a','arrowleft'); 
  let right = input.pressed('d','arrowright');
  player.sprinting = input.pressed('shift');
  
  if(left&&!right){ 
    player.vx -= ACCEL*dt * speedFactor; 
    player.facingRight=false; 
  }
  else if(right&&!left){ 
    player.vx += ACCEL*dt * speedFactor; 
    player.facingRight=true; 
  }
  else { // aplicar fricción
    if(player.vx>0){ 
      player.vx = Math.max(0, player.vx - FRICTION*dt * speedFactor); 
    }
    else if(player.vx<0){ 
      player.vx = Math.min(0, player.vx + FRICTION*dt * speedFactor); 
    }
  }
  
  // Aplicar sprint si está activado
  const currentMaxSpeed = player.sprinting ? MAX_SPEED * SPRINT_MULTIPLIER : MAX_SPEED;
  player.vx = Math.max(-currentMaxSpeed * speedFactor, Math.min(currentMaxSpeed * speedFactor, player.vx));

  // Salto variable
  if(input.pressed('w','arrowup',' ') && player.onGround){ 
    if(!player._jumping){ 
      player.vy = JUMP_STRENGTH * speedFactor; 
      player._jumping=true; 
      player._jumpHold=0; 
      player.onGround=false; 
    } 
  }
  if(player._jumping){
    if(input.pressed('w','arrowup',' ')){ 
      player._jumpHold+=dt; 
      if(player._jumpHold<MAX_JUMP_HOLD){ 
        player.vy += -GRAVITY*0.55*dt * speedFactor; 
      } 
    }
    else player._jumping=false;
    if(player.vy>0) player._jumping=false;
  }
  if(player.onGround && !input.pressed('w','arrowup',' ')) player._jumping=false;

  // Disparar bola de fuego
  if(input.pressed('f') && player.hasFire && player.fireballCooldown <= 0){
    fireballs.push({
      x: player.x + (player.facingRight ? player.width : 0),
      y: player.y + player.height/2,
      width: 8,
      height: 8,
      vx: (player.facingRight ? 1 : -1) * 300,
      vy: 0,
      lifetime: 2
    });
    player.fireballCooldown = 0.5;
  }

  // Gravedad
  player.vy += GRAVITY*dt * speedFactor;

  // Movimiento provisional
  player.x += player.vx*dt; 
  player.y += player.vy*dt;
  
  // Control velocidad
  if(input.pressed('=','+')){ 
    if(!_incHeld){ 
      speedFactor=Math.min(MAX_SPEED_FACTOR,speedFactor+0.1); 
      _incHeld=true; 
    } 
  } else _incHeld=false;
  if(input.pressed('-','_')){ 
    if(!_decHeld){ 
      speedFactor=Math.max(MIN_SPEED_FACTOR,speedFactor-0.1); 
      _decHeld=true; 
    } 
  } else _decHeld=false;

  // Colisiones plataformas suelo
  player.onGround=false;
  for(const platform of platforms){ 
    if(platform.type==='ground' || platform.type==='platform' || platform.type==='pipe'){
      if(player.x + player.width > platform.x && 
         player.x < platform.x+platform.width && 
         player.y + player.height > platform.y && 
         player.y + player.height < platform.y+platform.height + 14 && 
         player.vy>=0){
        player.y = platform.y - player.height; 
        player.vy=0; 
        player.onGround=true; 
      } 
    } 
  }

  // Colisiones bloques (refinadas)
  for(let i=0;i<blocks.length;i++){ 
    const b=blocks[i]; 
    if(!b) continue;
    
    if(player.x + player.width > b.x && 
       player.x < b.x + b.width && 
       player.y + player.height > b.y && 
       player.y < b.y + b.height){
      
      const fromBottom = player.vy<0 && player.y > b.y; 
      const fromTop = player.vy>0 && player.y < b.y;
      
      if(fromBottom){ 
        player.vy=0; 
        player.y = b.y + b.height; // golpe por abajo
        
        if(b.type==='question' && b.item){ 
          spawnItem(b.x, b.y-20, b.item); 
          b.type='used'; 
          b.item=null; 
          score+=100; 
        }
        else if(b.type==='invisible' && !b.visible){
          b.visible = true;
          b.type = 'question';
          spawnItem(b.x, b.y-20, b.item); 
          b.type='used'; 
          b.item=null; 
          score+=100; 
        }
        else if(b.type==='brick' && b.breakable && player.big){ 
          blocks.splice(i,1); 
          score+=50; 
          continue; 
        }
      } 
      else if(fromTop){ 
        player.vy=0; 
        player.y = b.y - player.height; 
        player.onGround=true; 
      }
      else { // lateral
        if(player.x < b.x){ 
          player.x = b.x - player.width; 
        } else player.x = b.x + b.width; 
        player.vx=0; 
      }
    }
  }

  // Límites
  player.x = Math.max(0, Math.min(levelWidth-player.width, player.x)); 
  if(player.y>canvas.height+80) loseLife();

  // Cámara suavizada
  const targetCam = Math.max(0, Math.min(levelWidth - canvas.width, player.x - canvas.width/2));
  camera.x += (targetCam - camera.x)*Math.min(1, dt*5);

  // Completar nivel con bandera
  if(overlap(player, flag.pole) && !flag.reached){
    flag.reached = true;
    levelComplete = true;
    score += 5000; // Puntos por llegar a la bandera
    saveBest();
  }
}

function spawnItem(x, y, itemType) {
  if (itemType === 'coin') {
    collectibles.push({
      x: x + 4,
      y: y,
      width: 12,
      height: 12,
      type: 'coin',
      collected: false,
      vy: -160 * speedFactor,
      lifetime: 1
    });
  } else if (itemType === 'powerup') {
    collectibles.push({
      x: x,
      y: y,
      width: 16,
      height: 16,
      type: 'mushroom',
      collected: false,
      vx: 42 * speedFactor,
      vy: 0,
      lifetime: -1,
      emerge: 0
    });
  } else if (itemType === 'fireflower') {
    collectibles.push({
      x: x,
      y: y,
      width: 16,
      height: 16,
      type: 'fireflower',
      collected: false,
      vx: 0,
      vy: 0,
      lifetime: -1,
      emerge: 0
    });
  }
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    if (!enemy.alive) continue;

    // Apply gravity
    enemy.vy = (enemy.vy || 0) + GRAVITY * dt * speedFactor;

    // Update position
    enemy.x += enemy.vx * dt;
    enemy.y += (enemy.vy || 0) * dt;

    // Platform collision
    let onGround = false;
    for (const platform of platforms) {
      if (enemy.x + enemy.width > platform.x && 
          enemy.x < platform.x + platform.width &&
          enemy.y + enemy.height > platform.y && 
          enemy.y + enemy.height < platform.y + platform.height + 14 &&
          (enemy.vy || 0) >= 0) {
        
        enemy.y = platform.y - enemy.height;
        enemy.vy = 0;
        onGround = true;
      }
    }

    if(onGround){ // borde -> voltearse
      const edgeAhead = !platforms.some(p=> 
        p.x <= enemy.x + (enemy.vx>0?enemy.width+4:-4) && 
        p.x + p.width >= enemy.x + (enemy.vx>0?enemy.width+4:-4) && 
        Math.abs((enemy.y+enemy.height)-p.y)<6);
      if(edgeAhead) enemy.vx *= -1;
    }

    // Colisión jugador
    if(player.invulnerable<=0 && overlap(player,enemy)){
      if(player.vy>0 && player.y < enemy.y){ // salto encima
        player.vy = JUMP_STRENGTH*0.55; 
        score += enemy.type==='goomba'?100:200; 
        saveBest();
        if(enemy.type==='koopa' && !enemy.shell){ 
          enemy.shell=true; 
          enemy.vx=0; 
          enemy.height=12; 
          enemy.y += (24-12); 
        }
        else if(enemy.type==='koopa' && enemy.shell){ // patear caparazón
          enemy.vx = (player.facingRight?1:-1)*300 * speedFactor; 
          score+=100; 
        }
        else { 
          enemy.alive=false; 
        }
      } else {
        if(player.big){ 
          player.big=false; 
          player.height=24; 
          player.invulnerable=2; 
          player.powerupTime=2; 
          player.hasFire = false;
        }
        else loseLife();
      }
    }

    // paredes
    if(enemy.x<0){ 
      enemy.x=0; 
      enemy.vx=Math.abs(enemy.vx); 
    } else if(enemy.x>levelWidth - enemy.width){ 
      enemy.x=levelWidth-enemy.width; 
      enemy.vx=-Math.abs(enemy.vx); 
    }
    if(enemy.y>canvas.height+120) enemies.splice(i,1);
  }
}

function updateCollectibles(dt) {
  for (let i = collectibles.length - 1; i >= 0; i--) {
    const it = collectibles[i]; 
    if (it.collected) continue;
    if (it.emerge !== undefined) { 
      it.emerge += dt; 
      it.y -= dt * 18; 
      if (it.emerge > 0.6) delete it.emerge; 
    }
    if (it.vy !== undefined) { 
      it.vy += GRAVITY * dt * speedFactor; 
      it.y += it.vy * dt; 
    }
    if (it.vx !== undefined) { 
      it.x += it.vx * dt; 
    }
    if (it.lifetime > 0) { 
      it.lifetime -= dt; 
      if (it.lifetime <= 0) { 
        collectibles.splice(i, 1); 
        continue; 
      } 
    }
    if (overlap(player, it)) {
      it.collected = true;
      if (it.type === 'coin') { 
        coins++; 
        score += 200; 
        if (coins >= 100) { 
          lives++; 
          coins -= 100; 
        } 
      }
      else if (it.type === 'mushroom' && !player.big) { 
        player.big = true; 
        player.height = 32; 
        player.powerupTime = 2; 
        score += 1000; 
      }
      else if (it.type === 'fireflower') {
        player.big = true;
        player.hasFire = true;
        player.height = 32;
        player.powerupTime = 2;
        score += 1000;
      }
      saveBest(); 
      collectibles.splice(i, 1); 
    }
  }
}

function updateFireballs(dt) {
  for (let i = fireballs.length - 1; i >= 0; i--) {
    const fireball = fireballs[i];
    fireball.x += fireball.vx * dt;
    fireball.y += fireball.vy * dt;
    
    // Gravedad
    fireball.vy += GRAVITY * dt * 0.5;
    
    // Colisiones con plataformas
    for (const platform of platforms) {
      if (overlap(fireball, platform)) {
        fireball.vy = -Math.abs(fireball.vy) * 0.8;
      }
    }
    
    // Colisiones con bloques
    for (const block of blocks) {
      if (overlap(fireball, block)) {
        fireballs.splice(i, 1);
        break;
      }
    }
    
    // Colisiones con enemigos
    for (const enemy of enemies) {
      if (enemy.alive && overlap(fireball, enemy)) {
        enemy.alive = false;
        fireballs.splice(i, 1);
        score += enemy.type === 'goomba' ? 100 : 200;
        saveBest();
        break;
      }
    }
    
    // Límite de tiempo
    fireball.lifetime -= dt;
    if (fireball.lifetime <= 0) {
      fireballs.splice(i, 1);
    }
  }
}

function loseLife() {
  lives--;
  player.invulnerable = 2;
  
  if (lives <= 0) {
    gameOver = true;
  } else {
    // Reset player position
    player.x = Math.max(100, camera.x + 100);
    player.y = canvas.height - 150;
    player.vx = 0;
    player.vy = 0;
    player.big = false;
    player.hasFire = false;
    player.height = 24;
  }
}

export function update(dt) {
  if (input.pressed('r')) {
    restart();
    return;
  }

  if (levelComplete) {
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
  updateEnemies(dt);
  updateCollectibles(dt);
  updateFireballs(dt);
}

export function draw() {
  // Save context for camera
  ctx.save();
  ctx.translate(-camera.x, 0);

  // Draw background
  ctx.fillStyle = '#5c94fc';
  ctx.fillRect(camera.x, 0, canvas.width, canvas.height);

  // Draw platforms
  for (const platform of platforms) {
    if (platform.type === 'ground') {
      drawGround(platform);
    } else if (platform.type === 'platform') {
      drawPlatform(platform);
    } else if (platform.type === 'pipe') {
      drawPipe(platform);
    }
  }

  // Draw blocks
  for (const block of blocks) {
    if (!block) continue;
    
    if (block.type === 'brick') {
      drawBrick(block);
    } else if (block.type === 'question') {
      drawQuestionBlock(block);
    } else if (block.type === 'used') {
      drawUsedBlock(block);
    } else if (block.type === 'invisible' && block.visible) {
      drawQuestionBlock(block);
    }
  }

  // Draw collectibles
  for (const item of collectibles) {
    if (item.collected) continue;
    
    if (item.type === 'coin') {
      drawCoin(item);
    } else if (item.type === 'mushroom') {
      drawMushroom(item);
    } else if (item.type === 'fireflower') {
      drawFireFlower(item);
    }
  }

  // Draw enemies
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    
    if (enemy.type === 'goomba') {
      drawGoomba(enemy);
    } else if (enemy.type === 'koopa') {
      drawKoopa(enemy);
    }
  }

  // Draw fireballs
  drawFireballs();

  // Draw player
  drawPlayer();

  // Draw flag and castle
  drawFlag();
  drawCastle();

  // Restore camera context
  ctx.restore();

  // Draw UI (fixed position)
  drawUI();
  
  if (gameOver) {
    drawGameOver();
  } else if (levelComplete) {
    drawLevelComplete();
  }
}

// Funciones de dibujo mejoradas
function drawPlayer() {
  if (player.invulnerable <= 0 || Math.floor(player.invulnerable * 10) % 2) {
    ctx.save();
    ctx.translate(player.x + player.width/2, player.y + player.height/2);
    
    if (!player.facingRight) {
      ctx.scale(-1, 1);
    }

    // Power-up flash effect
    if (player.powerupTime > 0 && Math.floor(player.powerupTime * 10) % 2) {
      ctx.globalAlpha = 0.5;
    }
    
    if (player.big) {
      // Cuerpo grande
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(-8, -8, 16, 20);
      ctx.fillStyle = '#0000ff';
      ctx.fillRect(-6, -6, 12, 8);
      // Cabeza
      ctx.fillStyle = '#ffdbac';
      ctx.fillRect(-6, -16, 12, 10);
      // Gorra
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(-7, -18, 14, 6);
      // Detalles de la gorra
      ctx.fillStyle = '#fff';
      ctx.fillRect(-5, -16, 10, 2);
      // Ojos
      ctx.fillStyle = '#000';
      ctx.fillRect(-4, -14, 2, 2);
      ctx.fillRect(2, -14, 2, 2);
      // Bigote
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(-4, -10, 8, 2);
      // Brazos
      ctx.fillStyle = '#ffdbac';
      const armSwing = Math.sin(player.animFrame * 0.5) * 2;
      ctx.fillRect(-10, -2 + armSwing, 4, 12);
      ctx.fillRect(6, -2 - armSwing, 4, 12);
      // Piernas
      const legOffset = Math.sin(player.animFrame) * 2;
      ctx.fillStyle = '#0000ff';
      ctx.fillRect(-8, 8, 4, 8 + legOffset);
      ctx.fillRect(4, 8, 4, 8 - legOffset);
      
      // Si tiene fuego, dibujar efecto
      if (player.hasFire) {
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.arc(0, -12, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Cuerpo pequeño
      ctx.fillStyle = '#0000ff';
      ctx.fillRect(-6, -5, 12, 15);
      // Cabeza
      ctx.fillStyle = '#ffdbac';
      ctx.fillRect(-5, -12, 10, 8);
      // Gorra
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(-6, -15, 12, 6);
      // Detalles de la gorra
      ctx.fillStyle = '#fff';
      ctx.fillRect(-4, -13, 8, 2);
      // Ojos
      ctx.fillStyle = '#000';
      ctx.fillRect(-3, -10, 2, 2);
      ctx.fillRect(1, -10, 2, 2);
      // Bigote
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(-3, -7, 6, 2);
      // Brazos
      ctx.fillStyle = '#ffdbac';
      const armSwing = Math.sin(player.animFrame * 0.5) * 2;
      ctx.fillRect(-8, 0 + armSwing, 4, 8);
      ctx.fillRect(4, 0 - armSwing, 4, 8);
      // Piernas
      const legOffset = Math.sin(player.animFrame) * 2;
      ctx.fillStyle = '#0000ff';
      ctx.fillRect(-6, 8, 4, 6 + legOffset);
      ctx.fillRect(2, 8, 4, 6 - legOffset);
    }
    
    ctx.restore();
  }
}

function drawGoomba(enemy) {
  // Cuerpo
  ctx.fillStyle = '#8b4513';
  ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
  // Detalles del cuerpo
  ctx.fillStyle = '#654321';
  ctx.fillRect(enemy.x + 2, enemy.y + 2, enemy.width - 4, enemy.height - 6);
  // Pies
  ctx.fillStyle = '#000';
  ctx.fillRect(enemy.x, enemy.y + enemy.height - 4, 6, 4);
  ctx.fillRect(enemy.x + enemy.width - 6, enemy.y + enemy.height - 4, 6, 4);
  // Ojos
  ctx.fillStyle = '#fff';
  ctx.fillRect(enemy.x + 3, enemy.y + 4, 3, 3);
  ctx.fillRect(enemy.x + 10, enemy.y + 4, 3, 3);
  ctx.fillStyle = '#000';
  ctx.fillRect(enemy.x + 4, enemy.y + 5, 1, 1);
  ctx.fillRect(enemy.x + 11, enemy.y + 5, 1, 1);
  // Cejas
  ctx.fillStyle = '#000';
  ctx.fillRect(enemy.x + 3, enemy.y + 3, 3, 1);
  ctx.fillRect(enemy.x + 10, enemy.y + 3, 3, 1);
}

function drawKoopa(enemy) {
  if (enemy.shell) {
    // Caparazón
    ctx.fillStyle = '#00aa00';
    ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(enemy.x + 2, enemy.y + 2, enemy.width - 4, enemy.height - 4);
    // Detalles del caparazón
    ctx.fillStyle = '#008800';
    ctx.fillRect(enemy.x + 4, enemy.y + 4, enemy.width - 8, enemy.height - 8);
  } else {
    // Cuerpo
    ctx.fillStyle = '#00aa00';
    ctx.fillRect(enemy.x, enemy.y + 8, enemy.width, enemy.height - 8);
    // Caparazón
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(enemy.x, enemy.y, enemy.width, 12);
    // Detalles del caparazón
    ctx.fillStyle = '#008800';
    ctx.fillRect(enemy.x + 2, enemy.y + 2, enemy.width - 4, 8);
    // Cabeza
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(enemy.x + 4, enemy.y - 4, 8, 8);
    // Ojos
    ctx.fillStyle = '#000';
    ctx.fillRect(enemy.x + 6, enemy.y - 2, 2, 2);
    ctx.fillRect(enemy.x + 10, enemy.y - 2, 2, 2);
    // Pies
    ctx.fillStyle = '#ff8800';
    ctx.fillRect(enemy.x + 2, enemy.y + enemy.height - 4, 4, 4);
    ctx.fillRect(enemy.x + enemy.width - 6, enemy.y + enemy.height - 4, 4, 4);
  }
}

function drawBrick(block) {
  // Ladrillo
  ctx.fillStyle = '#d2691e';
  ctx.fillRect(block.x, block.y, block.width, block.height);
  // Detalles del ladrillo
  ctx.fillStyle = '#8b4513';
  ctx.fillRect(block.x + 2, block.y + 2, block.width - 4, block.height - 4);
  // Líneas de separación
  ctx.strokeStyle = '#8b4513';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(block.x, block.y + block.height/2);
  ctx.lineTo(block.x + block.width, block.y + block.height/2);
  ctx.moveTo(block.x + block.width/2, block.y);
  ctx.lineTo(block.x + block.width/2, block.y + block.height/2);
  ctx.stroke();
}

function drawQuestionBlock(block) {
  // Bloque
  ctx.fillStyle = '#ffd700';
  ctx.fillRect(block.x, block.y, block.width, block.height);
  // Detalles del bloque
  ctx.fillStyle = '#333';
  ctx.font = '16px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('?', block.x + block.width/2, block.y + block.height - 2);
  // Borde
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.strokeRect(block.x, block.y, block.width, block.height);
}

function drawUsedBlock(block) {
  ctx.fillStyle = '#8b4513';
  ctx.fillRect(block.x, block.y, block.width, block.height);
}

function drawGround(platform) {
  // Suelo
  ctx.fillStyle = '#92d050';
  ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
  // Césped
  ctx.fillStyle = '#70a830';
  ctx.fillRect(platform.x, platform.y, platform.width, 8);
  // Detalles del césped
  ctx.fillStyle = '#5c8a20';
  for (let i = 0; i < platform.width; i += 4) {
    if (Math.random() > 0.5) {
      ctx.fillRect(platform.x + i, platform.y, 2, 4);
    }
  }
}

function drawPlatform(platform) {
  ctx.fillStyle = '#8b4513';
  ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
  // Detalles
  ctx.fillStyle = '#654321';
  ctx.fillRect(platform.x, platform.y, platform.width, 4);
}

function drawPipe(platform) {
  // Tubo
  ctx.fillStyle = '#00aa00';
  ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
  // Detalles del tubo
  ctx.fillStyle = '#008800';
  ctx.fillRect(platform.x, platform.y, platform.width, 8);
  ctx.fillRect(platform.x + 4, platform.y + 8, platform.width - 8, platform.height - 8);
  // Brillo
  ctx.fillStyle = '#00ff00';
  ctx.fillRect(platform.x + 2, platform.y + 2, platform.width - 4, 4);
}

function drawCoin(item) {
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(item.x + item.width/2, item.y + item.height/2, item.width/2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffff00';
  ctx.beginPath();
  ctx.arc(item.x + item.width/2, item.y + item.height/2, item.width/3, 0, Math.PI * 2);
  ctx.fill();
}

function drawMushroom(item) {
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(item.x, item.y + 8, item.width, item.height - 8);
  ctx.fillStyle = '#ffff00';
  ctx.fillRect(item.x + 2, item.y + 10, item.width - 4, item.height - 12);
  ctx.fillStyle = '#ff0000';
  ctx.beginPath();
  ctx.arc(item.x + item.width/2, item.y + 8, item.width/2, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(item.x + 4, item.y + 4, 2, 0, Math.PI * 2);
  ctx.arc(item.x + 12, item.y + 4, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawFireFlower(item) {
  // Tallo
  ctx.fillStyle = '#00aa00';
  ctx.fillRect(item.x + item.width/2 - 2, item.y + 8, 4, item.height - 8);
  
  // Cabeza de la flor
  ctx.fillStyle = '#ff6600';
  ctx.beginPath();
  ctx.arc(item.x + item.width/2, item.y + 8, item.width/2, 0, Math.PI * 2);
  ctx.fill();
  
  // Pétalos
  ctx.fillStyle = '#ff0000';
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const px = item.x + item.width/2 + Math.cos(angle) * 8;
    const py = item.y + 8 + Math.sin(angle) * 8;
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Centro
  ctx.fillStyle = '#ffff00';
  ctx.beginPath();
  ctx.arc(item.x + item.width/2, item.y + 8, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawFireballs() {
  for (const fireball of fireballs) {
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(fireball.x + fireball.width/2, fireball.y + fireball.height/2, fireball.width/2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#ffff00';
    ctx.beginPath();
    ctx.arc(fireball.x + fireball.width/2, fireball.y + fireball.height/2, fireball.width/3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFlag() {
  // Poste
  ctx.fillStyle = '#000';
  ctx.fillRect(flag.pole.x, flag.pole.y, flag.pole.width, flag.pole.height);
  
  // Bandera
  ctx.fillStyle = '#ff0000';
  ctx.beginPath();
  ctx.moveTo(flag.pole.x + flag.pole.width, flag.y);
  ctx.lineTo(flag.pole.x + flag.pole.width + 30, flag.y + 20);
  ctx.lineTo(flag.pole.x + flag.pole.width, flag.y + 40);
  ctx.closePath();
  ctx.fill();
}

function drawCastle() {
  // Base del castillo
  ctx.fillStyle = '#888888';
  ctx.fillRect(castle.x, castle.y, castle.width, castle.height);
  
  // Tejado
  ctx.fillStyle = '#ff0000';
  ctx.beginPath();
  ctx.moveTo(castle.x - 20, castle.y);
  ctx.lineTo(castle.x + castle.width/2, castle.y - 40);
  ctx.lineTo(castle.x + castle.width + 20, castle.y);
  ctx.closePath();
  ctx.fill();
  
  // Puerta
  ctx.fillStyle = '#000';
  ctx.fillRect(castle.x + castle.width/2 - 15, castle.y + 60, 30, 60);
  
  // Ventanas
  ctx.fillStyle = '#ffff00';
  ctx.fillRect(castle.x + 20, castle.y + 20, 20, 20);
  ctx.fillRect(castle.x + castle.width - 40, castle.y + 20, 20, 20);
}

function drawUI() {
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, canvas.width, 80);
  
  ctx.fillStyle = '#fff';
  ctx.font = '16px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`Score: ${score}`, 10, 25);
  ctx.fillText(`Lives: ${lives}`, 10, 45);
  ctx.fillText(`Coins: ${coins}`, 10, 65);
  ctx.fillText(`Level: ${level}`, 200, 25);
  ctx.fillText(`Best: ${best}`, 200, 45);
  ctx.fillText(`Speed: ${speedFactor.toFixed(2)} (=/-)`, 200, 65);
  
  // Mostrar power-up actual
  if (player.hasFire) {
    ctx.fillStyle = '#ff6600';
    ctx.fillText('FIRE POWER', 350, 45);
  } else if (player.big) {
    ctx.fillStyle = '#ff0000';
    ctx.fillText('MUSHROOM', 350, 45);
  }
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
  ctx.fillText(`+${1000 + (level * 200)} points`, canvas.width/2, canvas.height/2 + 20);
  
  ctx.textAlign = 'left';
}

function overlap(a,b){ 
  return a.x < b.x + b.width && 
         a.x + a.width > b.x && 
         a.y < b.y + b.height && 
         a.y + a.height > b.y; 
}

export function getStatus() {
  return `Super Mario | Score:${score} Lives:${lives} Coins:${coins} Lvl:${level} Spd:${speedFactor.toFixed(2)}`;
}

function saveBest() {
  if (score > best) {
    best = score;
    localStorage.setItem('best_mario', best.toString());
  }
}
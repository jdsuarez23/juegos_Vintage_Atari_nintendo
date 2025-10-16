// Pacman completamente reescrito - movimiento simple y robusto
import {Input} from './engine.js';
let canvas, ctx, input;

const TILE=20; const COLS=28; const ROWS=31; const BASE_SPEED=8;
const MAP_STR=[
  '############################',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#o####.#####.##.#####.####o#',
  '#.####.#####.##.#####.####.#',
  '#..........................#',
  '#.####.##.########.##.####.#',
  '#.####.##.########.##.####.#',
  '#......##....##....##......#',
  '######.##### ## #####.######',
  '     #.##### ## #####.#     ',
  '     #.##          ##.#     ',
  '     #.## ###  ### ##.#     ',
  '######.## #      # ##.######',
  '      .   #   P  #   .      ',
  '######.## #      # ##.######',
  '     #.## ######## ##.#     ',
  '     #.##          ##.#     ',
  '     #.## ######## ##.#     ',
  '######.## ######## ##.######',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#.####.#####.##.#####.####.#',
  '#o..##................##..o#',
  '###.##.##.########.##.##.###',
  '###.##.##.########.##.##.###',
  '#......##....##....##......#',
  '#.##########.##.##########.#',
  '#.##########.##.##########.#',
  '#..........................#',
  '############################'
];

let maze=[], pelletsRemaining=0, initialPellets=0;
let player; // {x,y,dir,nextDir,mouth}
let ghosts=[]; // {id,x,y,dir,mode,color,scatterTarget,frightTimer,lastMove}
let modeTimer=0, globalMode='scatter', modePhase=0;
let score=0, lives=3, level=1, gameOver=false, best=0; 
let ghostEatChain=0; let fruit=null;
const FRUIT_SEQUENCE=[{type:'cherry',points:100},{type:'straw',points:300},{type:'orange',points:500},{type:'apple',points:700},{type:'melon',points:1000}];
// NUEVO: control velocidad
let speedFactor=1; const MAX_SPEED_FACTOR=2.0; const MIN_SPEED_FACTOR=0.5; let _incHeld=false; let _decHeld=false;

function playerPowered(){ return ghosts.some(g=> g.mode==='fright'); }

export function init(c,inp){ 
  canvas=c; ctx=canvas.getContext('2d'); input=inp; 
  loadMap(); 
  score=0; lives=3; level=1; gameOver=false; ghostEatChain=0; fruit=null; 
  speedFactor=1;
  
  // Cargar mejor puntaje
  const stored = localStorage.getItem('best_pacman');
  if(stored) best = parseInt(stored) || 0;
  
  setupActors(); 
}

function loadMap(){ maze=MAP_STR.map(r=>r.split('')); pelletsRemaining=0; for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++) if(maze[y][x]==='.'||maze[y][x]==='o') pelletsRemaining++; initialPellets=pelletsRemaining; }

function setupActors(){ 
  // Encontrar posición inicial de Pacman
  let px=14, py=23; 
  for(let y=0; y<ROWS; y++) {
    for(let x=0; x<COLS; x++) {
      if(maze[y][x]==='P') {
        px=x; py=y;
        maze[y][x] = ' '; // Limpiar la P del mapa
      }
    }
  }
  
  player = {
    x: px + 0.0, 
    y: py + 0.0, 
    dir: {x:0, y:0}, 
    nextDir: {x:0, y:0}, 
    mouth: 0
  };
  
  // Configurar fantasmas en posiciones fijas con colores clásicos
  ghosts = [
    {
      id: 'blinky', 
      x: 14.0, y: 11.0, 
      dir: {x:-1, y:0}, 
      mode: 'chase', 
      color: '#ff0000', // Rojo clásico
      scatterTarget: {x:25, y:1}, 
      frightTimer: 0,
      lastMove: 0
    },
    {
      id: 'pinky', 
      x: 14.0, y: 14.0, 
      dir: {x:0, y:-1}, 
      mode: 'scatter', 
      color: '#ffb8ff', // Rosa clásico
      scatterTarget: {x:2, y:1}, 
      frightTimer: 0,
      lastMove: 0
    },
    {
      id: 'inky', 
      x: 13.0, y: 14.0, 
      dir: {x:0, y:-1}, 
      mode: 'scatter', 
      color: '#00ffff', // Cian clásico
      scatterTarget: {x:27, y:29}, 
      frightTimer: 0,
      lastMove: 0
    },
    {
      id: 'clyde', 
      x: 15.0, y: 14.0, 
      dir: {x:0, y:-1}, 
      mode: 'scatter', 
      color: '#ffb852', // Naranja clásico
      scatterTarget: {x:0, y:29}, 
      frightTimer: 0,
      lastMove: 0
    }
  ];
  
  modeTimer=0; globalMode='scatter'; modePhase=0;
}


export function update(dt){ if(gameOver) return; handleInput(); updateModes(dt); updateFruit(dt); movePlayer(dt); moveGhosts(dt); checkCollisions(); levelProgress(); }

function handleInput(){ 
  // Detectar input de dirección - siempre actualizar nextDir
  if(input.pressed('arrowup','w')) {
    player.nextDir = {x:0, y:-1};
  }
  else if(input.pressed('arrowdown','s')) {
    player.nextDir = {x:0, y:1};
  }
  else if(input.pressed('arrowleft','a')) {
    player.nextDir = {x:-1, y:0};
  }
  else if(input.pressed('arrowright','d')) {
    player.nextDir = {x:1, y:0};
  }
  
  // Si no hay dirección actual, intentar usar nextDir inmediatamente
  if(player.dir.x === 0 && player.dir.y === 0 && (player.nextDir.x !== 0 || player.nextDir.y !== 0)) {
    if(canMoveTo(Math.round(player.x), Math.round(player.y), player.nextDir)) {
      player.dir = {...player.nextDir};
      player.nextDir = {x: 0, y: 0};
    }
  }
  
  // Reinicio
  if(input.pressed('r')){ 
    loadMap(); setupActors(); score=0; lives=3; level=1; gameOver=false; 
    ghostEatChain=0; fruit=null; modePhase=0;
    input.keys.delete('r'); 
  } 
  // NUEVO: control velocidad
  if(input.pressed('=','+')){ if(!_incHeld){ speedFactor=Math.min(MAX_SPEED_FACTOR,speedFactor+0.1); _incHeld=true; } } else _incHeld=false;
  if(input.pressed('-','_')){ if(!_decHeld){ speedFactor=Math.max(MIN_SPEED_FACTOR,speedFactor-0.1); _decHeld=true; } } else _decHeld=false;
}

// Funciones básicas de navegación
function isWall(x, y) {
  if(x < 0 || x >= COLS || y < 0 || y >= ROWS) return true;
  return maze[y][x] === '#';
}

function wrapX(x) {
  if(x < -0.5) return COLS + x;
  if(x >= COLS - 0.5) return x - COLS;
  return x;
}

function canMoveTo(x, y, dir) {
  if(dir.x === 0 && dir.y === 0) return true;
  
  const newX = wrapX(x + dir.x);
  const newY = y + dir.y;
  
  // Verificar límites verticales
  if(newY < 0 || newY >= ROWS) return false;
  
  return !isWall(newX, newY);
}

function movePlayer(dt) {
  const speed = BASE_SPEED * dt * speedFactor;
  
  // Intentar cambiar dirección cuando está cerca del centro de un tile
  if(player.nextDir.x !== 0 || player.nextDir.y !== 0) {
    const centerX = Math.round(player.x);
    const centerY = Math.round(player.y);
    
    // Verificar si está lo suficientemente cerca del centro para cambiar dirección
    const distanceToCenter = Math.sqrt(
      Math.pow(player.x - centerX, 2) + Math.pow(player.y - centerY, 2)
    );
    
    if(distanceToCenter < 0.3) {
      if(canMoveTo(centerX, centerY, player.nextDir)) {
        player.dir = {...player.nextDir};
        player.nextDir = {x: 0, y: 0}; // Limpiar nextDir
        // Alinear suavemente al centro
        player.x = centerX;
        player.y = centerY;
      }
    }
  }
  
  // Mover en la dirección actual
  if(player.dir.x !== 0 || player.dir.y !== 0) {
    let newX = player.x + player.dir.x * speed;
    let newY = player.y + player.dir.y * speed;
    
    // Manejar wrap horizontal
    newX = wrapX(newX);
    
    // Verificar colisión en la nueva posición
    const checkX = Math.round(newX);
    const checkY = Math.round(newY);
    
    if(!isWall(checkX, checkY)) {
      player.x = newX;
      player.y = newY;
    } else {
      // Si hay colisión, detener en el centro del tile actual
      player.x = Math.round(player.x);
      player.y = Math.round(player.y);
      player.dir = {x: 0, y: 0};
    }
    
    // Verificar límites verticales
    if(player.y < 0) player.y = 0;
    if(player.y >= ROWS) player.y = ROWS - 1;
  }
  
  player.mouth += dt * 8;
}

function moveGhosts(dt) {
  ghosts.forEach(ghost => {
    ghost.lastMove += dt;
    
    // Actualizar frightened timer
    if(ghost.frightTimer > 0) {
      ghost.frightTimer -= dt;
      if(ghost.frightTimer <= 0) {
        ghost.mode = globalMode;
      }
    } else if(ghost.mode !== 'fright') {
      ghost.mode = globalMode;
    }
    
    // Mover cada 0.15 segundos (movimiento basado en tiles)
    if(ghost.lastMove >= 0.15 / speedFactor) {
      ghost.lastMove = 0;
      
      // Obtener posición actual en grid
      const gx = Math.round(ghost.x);
      const gy = Math.round(ghost.y);
      
      // Encontrar direcciones válidas
      const directions = [
        {x: 0, y: -1}, // arriba
        {x: 0, y: 1},  // abajo
        {x: -1, y: 0}, // izquierda
        {x: 1, y: 0}   // derecha
      ];
      
      const validDirs = directions.filter(dir => {
        const newX = wrapX(gx + dir.x);
        const newY = gy + dir.y;
        return !isWall(newX, newY);
      });
      
      // No permitir reversa (excepto si es la única opción o está asustado)
      const noReverseDirs = validDirs.filter(dir => 
        !(dir.x === -ghost.dir.x && dir.y === -ghost.dir.y) || validDirs.length === 1
      );
      
      const availableDirs = noReverseDirs.length > 0 ? noReverseDirs : validDirs;
      
      if(availableDirs.length > 0) {
        let chosenDir;
        
        if(ghost.mode === 'fright') {
          // Movimiento aleatorio cuando está asustado
          chosenDir = availableDirs[Math.floor(Math.random() * availableDirs.length)];
        } else {
          // Buscar la mejor dirección hacia el objetivo
          const target = getGhostTarget(ghost);
          let bestDist = Infinity;
          chosenDir = availableDirs[0];
          
          availableDirs.forEach(dir => {
            const newX = wrapX(gx + dir.x);
            const newY = gy + dir.y;
            
            // Calcular distancia euclidiana al objetivo
            const dx = newX - target.x;
            const dy = newY - target.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if(dist < bestDist) {
              bestDist = dist;
              chosenDir = dir;
            }
          });
        }
        
        ghost.dir = chosenDir;
      }
      
      // Mover un tile en la dirección elegida
      ghost.x = wrapX(ghost.x + ghost.dir.x);
      ghost.y = ghost.y + ghost.dir.y;
    }
  });
}

function getGhostTarget(ghost) {
  if(ghost.mode === 'scatter') {
    return ghost.scatterTarget;
  }
  
  if(ghost.mode === 'fright') {
    return {x: Math.random() * COLS, y: Math.random() * ROWS};
  }
  
  // Modo chase - cada fantasma tiene su propia estrategia
  const px = Math.round(player.x);
  const py = Math.round(player.y);
  
  switch(ghost.id) {
    case 'blinky':
      // Persigue directamente a Pacman
      return {x: px, y: py};
      
    case 'pinky':
      // Intenta llegar 4 tiles adelante de Pacman
      return {
        x: wrapX(px + player.dir.x * 4),
        y: Math.max(0, Math.min(ROWS-1, py + player.dir.y * 4))
      };
      
    case 'inky':
      // Comportamiento complejo basado en Blinky y Pacman
      const blinky = ghosts.find(g => g.id === 'blinky');
      if(blinky) {
        const ahead = {
          x: wrapX(px + player.dir.x * 2),
          y: Math.max(0, Math.min(ROWS-1, py + player.dir.y * 2))
        };
        return {
          x: wrapX(ahead.x + (ahead.x - Math.round(blinky.x))),
          y: Math.max(0, Math.min(ROWS-1, ahead.y + (ahead.y - Math.round(blinky.y))))
        };
      }
      return {x: px, y: py};
      
    case 'clyde':
      // Si está lejos persigue, si está cerca huye
      const dx = Math.round(ghost.x) - px;
      const dy = Math.round(ghost.y) - py;
      const distance = Math.sqrt(dx*dx + dy*dy);
      
      if(distance > 8) {
        return {x: px, y: py}; // Perseguir
      } else {
        return ghost.scatterTarget; // Huir
      }
      
    default:
      return {x: px, y: py};
  }
}

function updateModes(dt) {
  modeTimer += dt;
  
  // Alternar entre scatter y chase cada 10 segundos
  if(modeTimer >= 10) {
    modeTimer = 0;
    globalMode = globalMode === 'scatter' ? 'chase' : 'scatter';
    
    // Forzar cambio de dirección al cambiar modo
    ghosts.forEach(ghost => {
      if(ghost.mode !== 'fright') {
        // Invertir dirección
        ghost.dir = {x: -ghost.dir.x, y: -ghost.dir.y};
      }
    });
  }
}

function updateFruit(dt){ if(!fruit){ if(pelletsRemaining===initialPellets-60 || pelletsRemaining===initialPellets-140){ const f=FRUIT_SEQUENCE[(level-1)%FRUIT_SEQUENCE.length]; fruit={x:14.5,y:17.5,type:f.type,points:f.points,timer:9}; } } else { fruit.timer-=dt; if(fruit.timer<=0) fruit=null; } }

function checkCollisions() {
  // Colisión con pellets - usar posición redondeada
  const px = Math.round(player.x);
  const py = Math.round(player.y);
  
  // Solo verificar si está cerca del centro del tile
  const distanceToCenter = Math.sqrt(
    Math.pow(player.x - px, 2) + Math.pow(player.y - py, 2)
  );
  
  if(distanceToCenter < 0.4) {
    const tile = maze[py] && maze[py][px];
    
    if(tile === '.' || tile === 'o') {
      maze[py][px] = ' ';
      pelletsRemaining--;
      score += (tile === 'o') ? 50 : 10;
      saveBest();
      
      if(tile === 'o') {
        // Power pellet
        ghosts.forEach(ghost => {
          if(ghost.mode !== 'fright') {
            ghost.mode = 'fright';
            ghost.frightTimer = 8; // 8 segundos de miedo
            // Invertir dirección
            ghost.dir = {x: -ghost.dir.x, y: -ghost.dir.y};
          }
        });
        ghostEatChain = 0;
      }
    }
  }
  
  // Colisión con fruta
  if(fruit && Math.abs(player.x - fruit.x) < 0.8 && Math.abs(player.y - fruit.y) < 0.8) {
    score += fruit.points;
    saveBest();
    fruit = null;
  }
  
  // Colisión con fantasmas - más precisa
  ghosts.forEach(ghost => {
    const dx = ghost.x - player.x;
    const dy = ghost.y - player.y;
    const distance = Math.sqrt(dx*dx + dy*dy);
    
    if(distance < 0.8) {
      if(ghost.mode === 'fright') {
        // Comer fantasma
        ghostEatChain++;
        const points = 200 * Math.pow(2, ghostEatChain - 1);
        score += points;
        saveBest();
        
        // Resetear fantasma
        ghost.mode = globalMode;
        ghost.frightTimer = 0;
        ghost.x = 14;
        ghost.y = 14;
        ghost.dir = {x: 0, y: -1};
      } else {
        // Pacman muere
        loseLife();
      }
    }
  });
}

function saveBest() {
  if(score > best) {
    best = score;
    localStorage.setItem('best_pacman', best);
  }
}

function loseLife() {
  lives--;
  if(lives <= 0) {
    gameOver = true;
    return;
  }
  
  // Resetear posiciones - usar decimales para mejor fluidez
  player.x = 14.0;
  player.y = 23.0;
  player.dir = {x: 0, y: 0};
  player.nextDir = {x: 0, y: 0};
  
  // Resetear fantasmas
  ghosts.forEach(ghost => {
    ghost.x = ghost.id === 'blinky' ? 14.0 : ghost.id === 'pinky' ? 14.0 : ghost.id === 'inky' ? 13.0 : 15.0;
    ghost.y = ghost.id === 'blinky' ? 11.0 : 14.0;
    ghost.dir = ghost.id === 'blinky' ? {x: -1, y: 0} : {x: 0, y: -1};
    ghost.mode = ghost.id === 'blinky' ? 'chase' : 'scatter';
    ghost.frightTimer = 0;
    ghost.lastMove = 0;
  });
  
  globalMode = 'scatter';
  modeTimer = 0;
  ghostEatChain = 0;
  fruit = null;
}
function levelProgress(){ 
  if(pelletsRemaining===0){ 
    level++; 
    loadMap(); 
    setupActors(); 
    fruit=null; 
    ghostEatChain=0; 
  } 
}

export function draw(){ ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.save(); ctx.translate((canvas.width - COLS*TILE)/2, (canvas.height - ROWS*TILE)/2); drawMaze(); drawPellets(); if(fruit) drawFruit(); drawGhosts(); drawPlayer(); ctx.restore(); drawHUD(); if(gameOver) drawGameOver(); }

function drawMaze(){ 
  for(let y=0; y<ROWS; y++) {
    for(let x=0; x<COLS; x++) {
      if(maze[y][x]==='#') { 
        // Paredes con gradiente azul clásico
        ctx.fillStyle='#2121de'; 
        ctx.fillRect(x*TILE, y*TILE, TILE, TILE); 
        
        // Borde más claro para profundidad
        ctx.fillStyle='#4848ff'; 
        ctx.fillRect(x*TILE + 1, y*TILE + 1, TILE-2, TILE-2);
        
        // Efecto de borde interno
        ctx.fillStyle='#6464ff'; 
        ctx.fillRect(x*TILE + 2, y*TILE + 2, TILE-4, TILE-4);
      }
    }
  }
}
function drawPellets(){ 
  for(let y=0; y<ROWS; y++) {
    for(let x=0; x<COLS; x++) { 
      const t=maze[y][x]; 
      if(t==='.' || t==='o') { 
        const centerX = x*TILE + TILE/2;
        const centerY = y*TILE + TILE/2;
        
        if(t === 'o') {
          // Power pellets con efecto pulsante
          const pulse = (Math.sin(Date.now() * 0.008) + 1) / 2;
          const radius = 6 + pulse * 2;
          
          // Resplandor
          ctx.fillStyle = 'rgba(255, 224, 138, 0.3)';
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius + 3, 0, Math.PI*2);
          ctx.fill();
          
          // Power pellet principal
          ctx.fillStyle = '#ffe08a';
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI*2);
          ctx.fill();
          
          // Borde más brillante
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          // Pellets normales
          ctx.fillStyle = '#ffe08a';
          ctx.beginPath();
          ctx.arc(centerX, centerY, 2.5, 0, Math.PI*2);
          ctx.fill();
          
          // Pequeño highlight
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(centerX - 0.5, centerY - 0.5, 1, 0, Math.PI*2);
          ctx.fill();
        }
      } 
    } 
  }
}
function drawFruit(){ ctx.fillStyle='#ff4b4b'; if(fruit.type==='straw') ctx.fillStyle='#ff5faa'; else if(fruit.type==='orange') ctx.fillStyle='#ff9800'; else if(fruit.type==='apple') ctx.fillStyle='#c0392b'; else if(fruit.type==='melon') ctx.fillStyle='#4caf50'; ctx.beginPath(); ctx.arc(fruit.x*TILE, fruit.y*TILE, 7,0,Math.PI*2); ctx.fill(); }
function drawPlayer(){ 
  ctx.save(); 
  ctx.translate(player.x * TILE + TILE/2, player.y * TILE + TILE/2); 
  
  const moving = (player.dir.x || player.dir.y); 
  let ang = Math.atan2(player.dir.y, player.dir.x); 
  if(!moving) ang = 0; 
  
  // Animación de la boca más suave
  const phase = (Math.sin(player.mouth) + 1) / 2; 
  const open = moving ? (0.2 + 0.6 * phase) : 0.15; 
  
  // Cuerpo de Pacman con borde
  ctx.fillStyle = '#ffeb3b'; 
  ctx.beginPath(); 
  ctx.moveTo(0, 0); 
  ctx.arc(0, 0, TILE * 0.45, ang + open, ang + Math.PI * 2 - open); 
  ctx.fill(); 
  
  // Borde más oscuro para mejor definición
  ctx.strokeStyle = '#f9a825';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); 
  ctx.moveTo(0, 0); 
  ctx.arc(0, 0, TILE * 0.45, ang + open, ang + Math.PI * 2 - open); 
  ctx.stroke();
  
  // Ojo pequeño
  if(moving) {
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    const eyeX = Math.cos(ang) * TILE * 0.15;
    const eyeY = Math.sin(ang) * TILE * 0.15 - TILE * 0.1;
    ctx.arc(eyeX, eyeY, TILE * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore(); 
}

function drawGhosts(){ 
  ghosts.forEach(g => { 
    ctx.save(); 
    ctx.translate(g.x * TILE + TILE/2, g.y * TILE + TILE/2); 
    
    let bodyColor = g.color; 
    if(g.mode === 'fright') { 
      const remaining = g.frightTimer; 
      // Parpadeo en los últimos 2 segundos
      if(remaining < 2 && Math.floor(remaining * 8) % 2 === 0) {
        bodyColor = '#ffffff';
      } else {
        bodyColor = '#2121de'; // Azul clásico del modo asustado
      }
    } 
    
    // Cuerpo del fantasma - forma más redondeada y clásica
    ctx.fillStyle = bodyColor; 
    ctx.beginPath(); 
    
    // Cabeza redonda
    ctx.arc(0, -TILE * 0.05, TILE * 0.42, 0, Math.PI * 2); 
    
    // Cuerpo rectangular conectado
    ctx.rect(-TILE * 0.42, -TILE * 0.05, TILE * 0.84, TILE * 0.52);
    ctx.fill();
    
    // Parte inferior ondulada (picos del fantasma)
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(-TILE * 0.42, TILE * 0.47);
    
    // 6 picos para mayor detalle
    for(let i = 0; i < 6; i++) { 
      const x = -TILE * 0.42 + (i * TILE * 0.84 / 5);
      const peakX = x + TILE * 0.084;
      const peakY = i % 2 === 0 ? TILE * 0.35 : TILE * 0.47;
      const endX = x + TILE * 0.168;
      
      ctx.lineTo(peakX, peakY);
      ctx.lineTo(endX, TILE * 0.47);
    } 
    
    ctx.lineTo(TILE * 0.42, TILE * 0.47);
    ctx.lineTo(TILE * 0.42, -TILE * 0.05);
    ctx.fill();
    
    // Ojos - más grandes y expresivos
    ctx.fillStyle = '#ffffff'; 
    ctx.beginPath(); 
    ctx.arc(-TILE * 0.18, -TILE * 0.12, TILE * 0.15, 0, Math.PI * 2); 
    ctx.arc(TILE * 0.18, -TILE * 0.12, TILE * 0.15, 0, Math.PI * 2); 
    ctx.fill(); 
    
    // Pupilas
    if(g.mode === 'fright') {
      // Ojos de miedo - líneas onduladas
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      // Ojo izquierdo
      ctx.moveTo(-TILE * 0.25, -TILE * 0.18);
      ctx.quadraticCurveTo(-TILE * 0.18, -TILE * 0.08, -TILE * 0.11, -TILE * 0.18);
      ctx.moveTo(-TILE * 0.25, -TILE * 0.06);
      ctx.quadraticCurveTo(-TILE * 0.18, -TILE * 0.16, -TILE * 0.11, -TILE * 0.06);
      // Ojo derecho
      ctx.moveTo(TILE * 0.11, -TILE * 0.18);
      ctx.quadraticCurveTo(TILE * 0.18, -TILE * 0.08, TILE * 0.25, -TILE * 0.18);
      ctx.moveTo(TILE * 0.11, -TILE * 0.06);
      ctx.quadraticCurveTo(TILE * 0.18, -TILE * 0.16, TILE * 0.25, -TILE * 0.06);
      ctx.stroke();
    } else {
      // Pupilas normales que miran en la dirección de movimiento
      ctx.fillStyle = '#000000'; 
      const eyeOffsetX = g.dir.x * 4; 
      const eyeOffsetY = g.dir.y * 4; 
      ctx.beginPath(); 
      ctx.arc(-TILE * 0.18 + eyeOffsetX, -TILE * 0.12 + eyeOffsetY, TILE * 0.08, 0, Math.PI * 2); 
      ctx.arc(TILE * 0.18 + eyeOffsetX, -TILE * 0.12 + eyeOffsetY, TILE * 0.08, 0, Math.PI * 2); 
      ctx.fill(); 
    }
    
    ctx.restore(); 
  }); 
}
function drawHUD(){ 
  ctx.fillStyle='#fff'; 
  ctx.font='14px monospace'; 
  ctx.fillText(`Score: ${score}  Lives:${lives}  Level:${level}  Best:${best}  Pellets:${pelletsRemaining}  Speed: ${speedFactor.toFixed(2)} (=/-)` ,12,20); 
}
function drawGameOver(){ ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle='#ff5555'; ctx.font='40px system-ui'; ctx.textAlign='center'; ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2); ctx.font='18px monospace'; ctx.fillStyle='#fff'; ctx.fillText('R para reiniciar', canvas.width/2, canvas.height/2+40); ctx.textAlign='left'; }

export function getStatus(){ return `Pacman | Score ${score} Lives ${lives} Best ${best} Spd:${speedFactor.toFixed(2)}`; }

export function restart() {
  loadMap(); 
  setupActors(); 
  score = 0; 
  lives = 3; 
  level = 1; 
  gameOver = false; 
  ghostEatChain = 0; 
  fruit = null; 
  modePhase = 0;
  speedFactor=1;
}

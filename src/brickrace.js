// Brick Game 999 'Racing' estilo retro LCD
// Controles: A / ← mover izquierda | D / → mover derecha | R reinicia
// Objetivo: Evitar patrones de obstáculos descendentes. Puntaje por distancia.
// Estilo visual: bloques monocromo como consola handheld.

let canvas, ctx, input;

// Dimensiones lógicas de la matriz LCD
const GRID_COLS = 12; // incluye bordes laterales
const GRID_ROWS = 20;
const CELL = 22; // tamaño base de cada "píxel" grande

// Lanes jugables (excluye columnas de borde)
const LANE_COUNT = 4; // 4 carriles
// Centramos carriles en columnas internas (0 y 11 son bordes). Usaremos centros 2,4,6,8.
const LANE_CENTER_START = 2;
const LANE_SPACING = 2; // separación entre centros de carril
function laneCenterCol(l){ return LANE_CENTER_START + l*LANE_SPACING; }

let player; // {lane (0..LANE_COUNT-1), y (fila fija), lives, invuln}
let obstacles = []; // {pattern, row (float), laneOffset}
let speed = 3.2; // filas por segundo
let accel = 0.09; // incremento por segunda base (ajustable)
// NUEVO controles velocidad manual
let speedFactor=1; const MAX_SPEED_FACTOR=2.5; const MIN_SPEED_FACTOR=0.5; let _incHeld=false; let _decHeld=false;
let score = 0, best = 0, distance = 0; // distance en filas
let level = 1; let spawnTimer = 0; let gameOver=false; let shake=0;
let safeLane=0; // carril garantizado libre como "corredor"

// Patrones de obstáculo
const PATTERNS = [
  // simple bloque 1x1
  [[1]],
  // barra vertical 1x3
  [[1],[1],[1]],
  // bloque ancho 2x2
  [[1,1],[1,1]],
  // forma en T
  [[1,1,1],[0,1,0]],
  // zigzag ancho 2x3
  [[1,0],[1,1],[0,1]],
  // muro bajo 3x1
  [[1,1,1]],
  // rombo / diamante 3x3
  [[0,1,0],[1,1,1],[0,1,0]],
];

// Patrón del auto (se dibuja fijo en la parte inferior) - representación 3x5
const CAR_PATTERN = [
  [0,1,0],
  [1,1,1],
  [0,1,0],
  [1,0,1],
  [1,0,1]
];

export function init(c,inp){ canvas=c; ctx=canvas.getContext('2d'); input=inp; try{ const b=localStorage.getItem('best_brickrace'); if(b) best=parseInt(b)||0; }catch(e){} reset(); }
export function restart(){ reset(); }
export function dispose(){ obstacles.length=0; }

function reset(){ player={ lane: Math.floor(LANE_COUNT/2), y: GRID_ROWS-3, lives:3, invuln:0 }; obstacles=[]; speed=3.2; accel=0.09; speedFactor=1; score=0; distance=0; level=1; spawnTimer=0; gameOver=false; shake=0; safeLane=Math.floor(Math.random()*LANE_COUNT); }

function rand(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }

function spawnObstacle(){ // Seleccionar patrón que NO cubra el safeLane para mantener un corredor permanente
  let tries=0; let p=null; let laneOffset=0;
  while(tries<12){ p = PATTERNS[rand(0,PATTERNS.length-1)]; const width=p[0].length; if(width>=LANE_COUNT) { tries++; continue; } // no permitir llenar todo
    const maxOffset = LANE_COUNT - width;
    // construir offsets válidos que no cubran safeLane
    const candidates=[]; for(let o=0;o<=maxOffset;o++){ if(!(safeLane>=o && safeLane<o+width)) candidates.push(o); }
    if(!candidates.length){ // si patrón siempre cubre safeLane, cambiar safeLane a un carril libre después
      tries++; continue; }
    laneOffset = candidates[rand(0,candidates.length-1)];
    break;
  }
  if(!p){ p=[[1]]; laneOffset = (safeLane+1)%LANE_COUNT; }
  obstacles.push({pattern:p, row:-p.length, laneOffset});
  // chance de desplazar el corredor de forma suave (+/-1 carril) siempre que siga habiendo hueco
  if(Math.random()<0.30){ let dir = Math.random()<0.5?-1:1; const nl = safeLane + dir; if(nl>=0 && nl<LANE_COUNT) safeLane=nl; }
}

function updatePlayer(dt){ if(gameOver) return; if(player.invuln>0) player.invuln-=dt; // movimiento discreto por carril
  if(input.pressed('a','arrowleft')){ if(!updatePlayer._l){ player.lane=Math.max(0,player.lane-1); updatePlayer._l=true; } } else updatePlayer._l=false;
  if(input.pressed('d','arrowright')){ if(!updatePlayer._r){ player.lane=Math.min(LANE_COUNT-1,player.lane+1); updatePlayer._r=true; } } else updatePlayer._r=false;
}

function updateObstacles(dt){ spawnTimer -= dt; if(spawnTimer<=0){ spawnObstacle(); // spawn interval escalado por nivel
  spawnTimer = Math.max(0.42, 1.15 - level*0.07); }
  for(const o of obstacles){ o.row += speed*dt; }
  // eliminar fuera de pantalla
  obstacles = obstacles.filter(o=> o.row < GRID_ROWS + 2);
  // colisiones (si cualquier celda del patrón coincide con la posición del auto)
  for(const o of obstacles){ const width=o.pattern[0].length; for(let r=0;r<o.pattern.length;r++){ const prow=Math.floor(o.row + r); if(prow<0) continue; if(prow>=GRID_ROWS) continue; // ya fuera
      for(let c=0;c<width;c++){ if(!o.pattern[r][c]) continue; const lanePos = o.laneOffset + c; // lane dentro del rango 0..LANE_COUNT-1
        if(lanePos===player.lane){ // comprobar fila respecto a la parte ocupada por el coche patrón
          const carTop = player.y - (CAR_PATTERN.length-1); const carBottom = player.y; if(prow>=carTop && prow<=carBottom){ hitPlayer(); return; } }
      }
    }
  }
}

function hitPlayer(){ if(player.invuln>0) return; player.lives--; player.invuln=1.2; shake=0.4; if(player.lives<=0){ gameOver=true; saveBest(); } }

function updateGame(dt){ if(gameOver) return; // ajustes de velocidad manual
  if(input.pressed('=','+')){ if(!_incHeld){ speedFactor=Math.min(MAX_SPEED_FACTOR, speedFactor+0.1); _incHeld=true; } } else _incHeld=false;
  if(input.pressed('-','_')){ if(!_decHeld){ speedFactor=Math.max(MIN_SPEED_FACTOR, speedFactor-0.1); _decHeld=true; } } else _decHeld=false;
  speed += accel*dt * speedFactor; distance += (speed)*dt; score = Math.floor(distance); const newLevel = 1 + Math.floor(distance/180); if(newLevel>level){ level=newLevel; // aumento adicional al subir nivel
    speed += 0.6 + level*0.05; accel *= 1.04; }
  updatePlayer(dt); updateObstacles(dt); if(shake>0) shake-=dt; }

export function update(dt){ if(input.pressed('r')){ restart(); input.keys.delete('r'); } updateGame(dt); }

// --- DIBUJO ---
function drawLCDBackground(){ // marco estilo ladrillo
  ctx.fillStyle='#0c0c0c'; ctx.fillRect(0,0,canvas.width,canvas.height);
  const playW = GRID_COLS*CELL; const playH = GRID_ROWS*CELL; const offX = Math.floor((canvas.width-playW)/2); const offY = Math.floor((canvas.height-playH)/2);
  drawLCDBackground._offX=offX; drawLCDBackground._offY=offY;
  // pantalla
  ctx.fillStyle='#9aa57a'; ctx.fillRect(offX-16,offY-16, playW+32, playH+32);
  ctx.fillStyle='#b8c694'; ctx.fillRect(offX-8,offY-8, playW+16, playH+16);
  ctx.fillStyle='#cfd9b8'; ctx.fillRect(offX,offY, playW, playH);
  // bordes oscuros internos
  ctx.strokeStyle='#4d533c'; ctx.lineWidth=3; ctx.strokeRect(offX+1,offY+1,playW-2,playH-2);
  // título simple
  ctx.fillStyle='#2f3523'; ctx.font='12px monospace'; ctx.fillText('BRICK RACE', offX, offY-20);
}

function cellToXY(col,row){ const offX=drawLCDBackground._offX; const offY=drawLCDBackground._offY; return {x: offX + col*CELL, y: offY + row*CELL}; }

function drawBlock(col,row,active,blink=false){ if(col<0||col>=GRID_COLS||row<0||row>=GRID_ROWS) return; if(blink && Math.floor(Date.now()/160)%2===0) return;
  const {x,y}=cellToXY(col,row); const outer='#2d3424'; const inner= active? '#1a1f16':'#909b76'; const pix = CELL-4; ctx.fillStyle=outer; ctx.fillRect(x+1,y+1, CELL-2, CELL-2); ctx.fillStyle=inner; ctx.fillRect(x+2,y+2, pix-2, pix-2); if(active){ ctx.fillStyle='#cfd9b8'; ctx.fillRect(x+4,y+4,4,4); }
}

function drawBorders(){ for(let r=0;r<GRID_ROWS;r++){ // columnas 0 y GRID_COLS-1
  drawBlock(0,r,true); drawBlock(GRID_COLS-1,r,true); } }

function drawObstacles(){ for(const o of obstacles){ const width=o.pattern[0].length; for(let r=0;r<o.pattern.length;r++){ const prow=Math.floor(o.row + r); if(prow<0||prow>=GRID_ROWS) continue; for(let c=0;c<width;c++){ if(o.pattern[r][c]){ const laneCol = laneCenterCol(o.laneOffset + c); // dibujar centrado
          // el patrón es 1 columna de ancho visual; lo marcamos directamente
          drawBlock(laneCol, prow,true); } } } } }

function drawCar(){ const carTop = player.y - (CAR_PATTERN.length-1); const centerCol = laneCenterCol(player.lane); for(let r=0;r<CAR_PATTERN.length;r++){ for(let c=0;c<CAR_PATTERN[0].length;c++){ if(CAR_PATTERN[r][c]){ const col = centerCol + c - 1; const row = carTop + r; const blinking = player.invuln>0; drawBlock(col,row,true,blinking); } } } }

function drawHUD(){ ctx.fillStyle='#fff'; ctx.font='14px monospace'; ctx.textAlign='left'; ctx.fillText(`BrickRace | Score:${score} Lvl:${level} Lives:${player.lives} Spd:${(speed*speedFactor).toFixed(1)} Best:${best} (=/-)`,10,20); }

function drawGameOver(){ ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle='#ff5555'; ctx.font='40px system-ui'; ctx.textAlign='center'; ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2); ctx.font='16px monospace'; ctx.fillStyle='#fff'; ctx.fillText('R para reiniciar', canvas.width/2, canvas.height/2+40); ctx.textAlign='left'; }

export function draw(){ ctx.clearRect(0,0,canvas.width,canvas.height); if(shake>0){ const s=shake*10; ctx.save(); ctx.translate((Math.random()-0.5)*s,(Math.random()-0.5)*s); drawLCDBackground(); drawBorders(); drawObstacles(); drawCar(); ctx.restore(); } else { drawLCDBackground(); drawBorders(); drawObstacles(); drawCar(); }
  drawHUD(); if(gameOver) drawGameOver(); }

export function getStatus(){ return `BrickRace | Score ${score} Lvl ${level} Spd:${(speed*speedFactor).toFixed(1)}`; }
function saveBest(){ if(score>best){ best=score; try{ localStorage.setItem('best_brickrace', best); }catch(e){} } }

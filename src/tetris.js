// Módulo Tetris básico
import {Input} from './engine.js';

let canvas, ctx, input;
const COLS=10, ROWS=20, CELL=24;
const WELL_W=COLS*CELL, WELL_H=ROWS*CELL;
let offsetX, offsetY;

const SHAPES={
  I:[[1,1,1,1]],
  O:[[1,1],[1,1]],
  T:[[1,1,1],[0,1,0]],
  S:[[0,1,1],[1,1,0]],
  Z:[[1,1,0],[0,1,1]],
  J:[[1,0,0],[1,1,1]],
  L:[[0,0,1],[1,1,1]]
};
const COLORS={I:'#4dd0e1',O:'#ffd54f',T:'#ba68c8',S:'#66bb6a',Z:'#ef5350',J:'#5c6bc0',L:'#ff8a65'};

let grid; // ROWS x COLS
let current; // {shape, x,y, type}
let nextPiece;
let holdPiece=null; let canHold=true;
let dropTimer=0; let dropInterval=0.8; let score=0; let lines=0; let level=1; let gameOver=false; let best=0;
let speedFactor=1; const MAX_SPEED_FACTOR=2.5; const MIN_SPEED_FACTOR=0.5; let _incHeld=false; let _decHeld=false;

// Control de desplazamiento lateral (DAS + ARR)
let moveDir=0;          // -1 izquierda, 1 derecha, 0 nada
let moveTimer=0;        // acumulador tiempo
let firstPhase=true;    // fase de retraso inicial
const INITIAL_DAS=0.18; // segundos antes de auto repetición
const REPEAT=0.05;      // intervalo de repetición

// Control de pulsación única para hard drop
let spaceHeld=false;

function emptyGrid(){ return Array.from({length:ROWS},()=>Array(COLS).fill(null)); }
function randPiece(){ const keys=Object.keys(SHAPES); const type=keys[Math.floor(Math.random()*keys.length)]; return {type, shape:SHAPES[type].map(r=>[...r]), x: Math.floor(COLS/2)-2, y:0}; }

export function init(c, inp){ canvas=c; ctx=canvas.getContext('2d'); input=inp; offsetX=Math.floor((canvas.width - WELL_W)/2); offsetY=Math.floor((canvas.height - WELL_H)/2); grid=emptyGrid(); score=0; lines=0; level=1; dropInterval=0.8; speedFactor=1; gameOver=false; holdPiece=null; canHold=true; const b=localStorage.getItem('best_tetris'); if(b) best=parseInt(b)||0; current=randPiece(); nextPiece=randPiece(); moveDir=0; moveTimer=0; firstPhase=true; spaceHeld=false; }

function rotate(shape){ const h=shape.length, w=shape[0].length; const out=[]; for(let x=0;x<w;x++){ const row=[]; for(let y=h-1;y>=0;y--) row.push(shape[y][x]); out.push(row); } return out; }
function collide(p){ const {shape,x,y}=p; for(let r=0;r<shape.length;r++){ for(let c=0;c<shape[r].length;c++){ if(shape[r][c]){ const nx=x+c, ny=y+r; if(ny<0) continue; if(nx<0||nx>=COLS||ny>=ROWS||grid[ny][nx]) return true; } } } return false; }
function merge(p){ const {shape,x,y,type}=p; for(let r=0;r<shape.length;r++){ for(let c=0;c<shape[r].length;c++){ if(shape[r][c]){ const nx=x+c, ny=y+r; if(ny>=0) grid[ny][nx]=type; } } } }
function clearLines(){ let cleared=0; for(let r=ROWS-1;r>=0;r--){ if(grid[r].every(v=>v)){ grid.splice(r,1); grid.unshift(Array(COLS).fill(null)); cleared++; r++; } } if(cleared){ lines+=cleared; score+= [0,40,100,300,1200][cleared]*level; if(lines>=level*10){ level++; dropInterval=Math.max(0.05, dropInterval*Math.max(0.55,0.80 - level*0.015)); } saveBest(); } }
function saveBest(){ if(score>best){ best=score; localStorage.setItem('best_tetris', best); } }

function hardDrop(){ while(!collide({...current,y:current.y+1})) current.y++; lock(); }
function hold(){ if(!canHold) return; if(!holdPiece){ holdPiece={type:current.type, shape:current.shape.map(r=>[...r])}; current=nextPiece; nextPiece=randPiece(); } else { const temp={type:current.type, shape:current.shape}; current={type:holdPiece.type, shape:holdPiece.shape.map(r=>[...r]), x:Math.floor(COLS/2)-2, y:0}; holdPiece=temp; } current.x=Math.floor(COLS/2)-2; current.y=0; canHold=false; if(collide(current)){ gameOver=true; }
}
function softDrop(){ current.y++; if(collide(current)){ current.y--; lock(); } }
function lock(){ merge(current); clearLines(); current=nextPiece; nextPiece=randPiece(); canHold=true; if(collide(current)){ gameOver=true; }
}

export function update(dt){ if(gameOver) return; dropTimer+=dt; handleInput(dt); lateralRepeat(dt); const effInterval=dropInterval/ speedFactor; if(dropTimer>=effInterval){ softDrop(); dropTimer=0; } }

function handleInput(dt){
  // Ajuste manual velocidad (=/-)
  if(input.pressed('=','+')){ if(!_incHeld){ speedFactor=Math.min(MAX_SPEED_FACTOR,speedFactor+0.1); _incHeld=true; } } else _incHeld=false;
  if(input.pressed('-','_')){ if(!_decHeld){ speedFactor=Math.max(MIN_SPEED_FACTOR,speedFactor-0.1); _decHeld=true; } } else _decHeld=false;
  // Rotar (una sola vez por pulsación)
  if(pressedOnce(['arrowup','w'])) rotateCurrent();
  // Hold
  if(pressedOnce(['shift','c'])) hold();
  // Hard drop (una vez por pulsación espacio)
  const sp = input.pressed(' ');
  if(sp && !spaceHeld){ hardDrop(); }
  spaceHeld=sp;
  // Reiniciar
  if(pressedOnce(['r'])) init(canvas,input);
  // Soft drop (continuo)
  if(input.pressed('arrowdown','s')) softDrop();
  // Detectar dirección lateral solicitada
  const left=input.pressed('arrowleft','a');
  const right=input.pressed('arrowright','d');
  let desired=0; if(left && !right) desired=-1; else if(right && !left) desired=1;
  if(desired!==moveDir){
    moveDir=desired;
    moveTimer=0; firstPhase=true;
    if(moveDir!==0) attemptMove(moveDir); // movimiento inmediato inicial
  }
  if(moveDir===0){ moveTimer=0; firstPhase=true; }
}

// Repetición lateral controlada
function lateralRepeat(dt){
  if(moveDir===0) return;
  moveTimer+=dt;
  if(firstPhase){
    if(moveTimer>=INITIAL_DAS){ moveTimer-=INITIAL_DAS; firstPhase=false; attemptMove(moveDir); }
  } else {
    while(moveTimer>=REPEAT){ moveTimer-=REPEAT; attemptMove(moveDir); }
  }
}

// Helper para detectar pulsación única
const lastFrameKeys=new Set();
function pressedOnce(keys){
  const hit = keys.some(k=> input.keys.has(k) && !lastFrameKeys.has(k));
  if(hit){ keys.forEach(k=> lastFrameKeys.add(k)); setTimeout(()=>keys.forEach(k=>lastFrameKeys.delete(k)),0); }
  return hit;
}

function attemptMove(dx){ current.x+=dx; if(collide(current)) current.x-=dx; }
function rotateCurrent(){ const rotated=rotate(current.shape); const backup=current.shape; current.shape=rotated; if(collide(current)){ current.x++; if(collide(current)){ current.x-=2; if(collide(current)){ current.x++; current.shape=backup; } } } }

export function draw(){ drawWell(); drawGrid(); drawPiece(current); drawGhost(); drawSidePanel(); if(gameOver) drawGameOver(); }

function drawWell(){ ctx.fillStyle='#111'; ctx.fillRect(offsetX,offsetY,WELL_W,WELL_H); ctx.strokeStyle='#333'; ctx.lineWidth=2; ctx.strokeRect(offsetX-1,offsetY-1,WELL_W+2,WELL_H+2); }
function drawGrid(){ for(let r=0;r<ROWS;r++){ for(let c=0;c<COLS;c++){ const v=grid[r][c]; if(v){ drawCell(c,r,COLORS[v]); } else { ctx.fillStyle='#181818'; ctx.fillRect(offsetX+c*CELL, offsetY+r*CELL, CELL, CELL); } ctx.strokeStyle='#222'; ctx.strokeRect(offsetX+c*CELL+0.5, offsetY+r*CELL+0.5, CELL-1, CELL-1); } } }
function drawCell(x,y,color){ ctx.fillStyle=color; ctx.fillRect(offsetX+x*CELL+1, offsetY+y*CELL+1, CELL-2, CELL-2); }
function drawPiece(p){ const {shape,x,y,type}=p; for(let r=0;r<shape.length;r++){ for(let c=0;c<shape[r].length;c++){ if(shape[r][c]) drawCell(x+c,y+r,COLORS[type]); } } }
function drawGhost(){ const ghost={...current, shape: current.shape}; while(!collide({...ghost,y:ghost.y+1})) ghost.y++; ctx.globalAlpha=0.25; drawPiece(ghost); ctx.globalAlpha=1; }
function drawSidePanel(){ const panelX=offsetX+WELL_W+24; const panelY=offsetY; ctx.fillStyle='#fff'; ctx.font='14px monospace'; ctx.fillText('Score: '+score, panelX, panelY+10); ctx.fillText('Lines: '+lines, panelX, panelY+28); ctx.fillText('Level: '+level, panelX, panelY+46); ctx.fillText('Best: '+best, panelX, panelY+64); ctx.fillText('Speed x'+speedFactor.toFixed(2)+' (=/-)', panelX, panelY+82); ctx.fillText('Next:', panelX, panelY+112); drawMini(nextPiece, panelX, panelY+124); ctx.fillText('Hold:', panelX, panelY+216); if(holdPiece) drawMini(holdPiece, panelX, panelY+228); ctx.fillStyle='#ccc'; ctx.fillText('[←→] mover', panelX, panelY+316); ctx.fillText('[↑] rotar', panelX, panelY+332); ctx.fillText('[↓] bajar', panelX, panelY+348); ctx.fillText('[ESPACIO] drop', panelX, panelY+364); ctx.fillText('[C/Shift] hold', panelX, panelY+380); }
function drawMini(piece, x, y){ const shape=piece.shape; const size=16; for(let r=0;r<shape.length;r++){ for(let c=0;c<shape[r].length;c++){ if(shape[r][c]){ ctx.fillStyle=COLORS[piece.type]; ctx.fillRect(x+c*size, y+r*size, size-2, size-2); } } } }
function drawGameOver(){ ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(offsetX,offsetY,WELL_W,WELL_H); ctx.fillStyle='#ff5555'; ctx.font='32px system-ui'; ctx.textAlign='center'; ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2 - 10); ctx.fillStyle='#fff'; ctx.font='16px monospace'; ctx.fillText('R para reiniciar', canvas.width/2, canvas.height/2 + 24); ctx.textAlign='left'; }

export function getStatus(){ return `Tetris | Score ${score} Lines ${lines} Lvl ${level} Spd x${speedFactor.toFixed(2)}`; }
export function restart(){ init(canvas,input); }

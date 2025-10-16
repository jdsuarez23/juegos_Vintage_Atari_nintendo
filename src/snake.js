// Módulo Snake
import {Input} from './engine.js';

let canvas, ctx, input;
const COLS=36; const ROWS=24;
let CELL, OFFSET_X, OFFSET_Y;
let snake, dir, nextDir, food, grow, speed, accumulator, score, best=0, paused, gameOver, ticks;
let speedFactor=1; const MAX_SPEED_FACTOR=2.2; const MIN_SPEED_FACTOR=0.6; let _incHeld=false; let _decHeld=false;

function resizeConstants(){
  CELL = Math.floor(Math.min(canvas.width/COLS, canvas.height/ROWS));
  OFFSET_X = Math.floor((canvas.width - COLS*CELL)/2);
  OFFSET_Y = Math.floor((canvas.height - ROWS*CELL)/2);
}

export function init(c, inp){
  canvas=c; ctx=canvas.getContext('2d'); input=inp; resizeConstants();
  const stored=localStorage.getItem('best_snake'); if(stored) best=parseInt(stored)||0;
  snake=[{x:Math.floor(COLS/2), y:Math.floor(ROWS/2)}];
  dir={x:1,y:0}; nextDir=dir; grow=4; speed=8; speedFactor=1; score=0; gameOver=false; paused=false; ticks=0; accumulator=0;
  placeFood();
}

function placeFood(){
  while(true){
    const x=Math.floor(Math.random()*COLS); const y=Math.floor(Math.random()*ROWS);
    if(!snake.some(s=>s.x===x && s.y===y)){ food={x,y}; return; }
  }
}

function handleInput(){
  if(input.pressed('p')) { paused = !paused; input.keys.delete('p'); }
  if(input.pressed('r')) { init(canvas,input); input.keys.delete('r'); }
  // Ajuste velocidad manual (=/-) sin interferir con dirección
  if(input.pressed('=','+')){ if(!_incHeld){ speedFactor=Math.min(MAX_SPEED_FACTOR,speedFactor+0.1); _incHeld=true; } } else _incHeld=false;
  if(input.pressed('-','_')){ if(!_decHeld){ speedFactor=Math.max(MIN_SPEED_FACTOR,speedFactor-0.1); _decHeld=true; } } else _decHeld=false;
  let d=null;
  if(input.pressed('arrowup','w')) d={x:0,y:-1}; else if(input.pressed('arrowdown','s')) d={x:0,y:1}; else if(input.pressed('arrowleft','a')) d={x:-1,y:0}; else if(input.pressed('arrowright','d')) d={x:1,y:0};
  if(d && (d.x!==-dir.x || d.y!==-dir.y)) nextDir=d;
}

function step(){
  dir=nextDir; const head={x:snake[0].x + dir.x, y:snake[0].y + dir.y}; ticks++;
  if(head.x<0||head.y<0||head.x>=COLS||head.y>=ROWS){ gameOver=true; return; }
  if(snake.some(s=>s.x===head.x && s.y===head.y)){ gameOver=true; return; }
  snake.unshift(head);
  if(grow>0){ grow--; } else snake.pop();
  if(head.x===food.x && head.y===food.y){
    score+=10; if(score>best){ best=score; localStorage.setItem('best_snake', best); }
    grow+=2; speed = Math.min(18, speed+0.25); placeFood();
  }
}

export function update(dt){
  handleInput(); if(paused||gameOver) return;
  accumulator += dt; const tickTime=1/(speed*speedFactor); while(accumulator>=tickTime){ step(); accumulator-=tickTime; }
}

function drawBoard(){ ctx.fillStyle='#161616'; ctx.fillRect(OFFSET_X,OFFSET_Y,COLS*CELL,ROWS*CELL); ctx.strokeStyle='#1f1f1f'; ctx.lineWidth=1; ctx.beginPath(); for(let c=0;c<=COLS;c++){ ctx.moveTo(OFFSET_X+c*CELL+0.5,OFFSET_Y+0.5); ctx.lineTo(OFFSET_X+c*CELL+0.5,OFFSET_Y+ROWS*CELL+0.5);} for(let r=0;r<=ROWS;r++){ ctx.moveTo(OFFSET_X+0.5,OFFSET_Y+r*CELL+0.5); ctx.lineTo(OFFSET_X+COLS*CELL+0.5,OFFSET_Y+r*CELL+0.5);} ctx.stroke(); }
function drawSnake(){ for(let i=0;i<snake.length;i++){ const s=snake[i]; const x=OFFSET_X+s.x*CELL; const y=OFFSET_Y+s.y*CELL; if(i===0) ctx.fillStyle='#4caf50'; else { const t=i/(snake.length-1||1); ctx.fillStyle=`hsl(${120 - t*80} 60% ${40 + t*15}%)`; } ctx.fillRect(x+1,y+1,CELL-2,CELL-2); if(i===0){ ctx.fillStyle='#000'; const ox=dir.x!==0?0:(dir.y>0?2:-2); const oy=dir.y!==0?0:(dir.x>0?2:-2); ctx.fillRect(x+CELL/2 + (dir.x!==0? dir.x*4:ox)-3, y+CELL/2 + (dir.y!==0? dir.y*4:oy)-3,6,6); ctx.fillRect(x+CELL/2 + (dir.x!==0? dir.x*4:-ox)-3, y+CELL/2 + (dir.y!==0? dir.y*4:-oy)-3,6,6);} } }
function drawFood(){ const x=OFFSET_X+food.x*CELL; const y=OFFSET_Y+food.y*CELL; ctx.fillStyle='#ff5252'; ctx.beginPath(); ctx.arc(x+CELL/2,y+CELL/2,CELL*0.4,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#4caf50'; ctx.fillRect(x+CELL/2-2,y+CELL/2 - CELL*0.55,4,8); }
function drawHUD(){ ctx.fillStyle='#fff'; ctx.font='14px monospace'; ctx.fillText('Puntaje: '+score+'  Mejor: '+best+'  Vel: '+(speed*speedFactor).toFixed(1)+' (=/-)', 12,20); }
function drawGameOver(){ ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(OFFSET_X,OFFSET_Y,COLS*CELL,ROWS*CELL); ctx.fillStyle='#ff5555'; ctx.font='32px system-ui'; ctx.textAlign='center'; ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2 - 10); ctx.fillStyle='#fff'; ctx.font='16px monospace'; ctx.fillText('R para reiniciar', canvas.width/2, canvas.height/2 + 24); ctx.textAlign='left'; }
function drawPaused(){ ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(OFFSET_X,OFFSET_Y,COLS*CELL,ROWS*CELL); ctx.fillStyle='#ffd54f'; ctx.font='28px system-ui'; ctx.textAlign='center'; ctx.fillText('PAUSA', canvas.width/2, canvas.height/2); ctx.textAlign='left'; }

export function draw(){ drawBoard(); drawFood(); drawSnake(); drawHUD(); if(gameOver) drawGameOver(); else if(paused) drawPaused(); }

export function getStatus(){ return `Snake | Puntaje ${score} Mejor ${best} Vel ${(speed*speedFactor).toFixed(1)}`; }

export function restart(){ init(canvas,input); }

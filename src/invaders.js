// Space Invaders simplificado
import {Input} from './engine.js';
let canvas, ctx, input;

let player; // {x,y,w,h}
let bullets=[]; // {x,y,v,from:'player'|'enemy'}
let enemies=[]; // {x,y,w,h,alive}
let dir=1; // dirección horizontal de grupo
let stepDown=false;
let shootCooldown=0;
let enemyShootTimer=0;
let score=0, lives=3, wave=1, gameOver=false, best=0;
let speedFactor=1; const MAX_SPEED_FACTOR=2.2; const MIN_SPEED_FACTOR=0.6; let _incHeld=false; let _decHeld=false;
let shields=[]; // [{x,y,w,h, hp, segs:[][] }]
let ufo=null; // {x,y,w,h,v,alive}
let ufoTimer=0;

const W=860, H=560;

// control de pulsación única para disparo
let spaceHeld=false;

export function init(c, inp){
  canvas=c; ctx=canvas.getContext('2d'); input=inp;
  player={x:W/2-25,y:H-70,w:50,h:30};
  bullets=[]; enemies=[]; dir=1; stepDown=false; shootCooldown=0; enemyShootTimer=2; score=0; lives=3; wave=1; gameOver=false; spaceHeld=false; speedFactor=1;
  const b=localStorage.getItem('best_invaders'); if(b) best=parseInt(b)||0;
  ufo=null; ufoTimer= 6 + Math.random()*8; buildShields();
  spawnWave();
}

function buildShields(){
  shields=[]; const baseY=H-170; const count=4; for(let i=0;i<count;i++){
    const sx=120 + i* ( (W-240)/(count-1) ) - 45; const w=90, h=50; const segSize=10; const rows=h/segSize, cols=w/segSize; const segs=[]; for(let r=0;r<rows;r++){ const row=[]; for(let c=0;c<cols;c++){ // recorte interior para forma típica
        const hole = (r>=rows-2 && (c<2||c>cols-3)); row.push(hole?0:3); } segs.push(row); }
    shields.push({x:sx,y:baseY,w,h,hp:3,segs});
  }
}

function spawnWave(){
  enemies=[];
  const rows=5; const cols=11; const baseX=80; const baseY=70; const spacingX=54; const spacingY=38;
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      enemies.push({x:baseX + c*spacingX, y:baseY + r*spacingY, w:40, h:28, alive:true, anim:0});
    }
  }
}

export function update(dt){
  if(gameOver) return;
  handleInput(dt);
  updatePlayer(dt);
  updateEnemies(dt);
  updateBullets(dt);
  updateUFO(dt);
  checkCollisions();
  if(enemies.every(e=>!e.alive)) { wave++; spawnWave(); enemyShootTimer=Math.max(0.3,2.2 - wave*0.2); }
}

function handleInput(dt){
  // control velocidad manual
  if(input.pressed('=','+')){ if(!_incHeld){ speedFactor=Math.min(MAX_SPEED_FACTOR, speedFactor+0.1); _incHeld=true; } } else _incHeld=false;
  if(input.pressed('-','_')){ if(!_decHeld){ speedFactor=Math.max(MIN_SPEED_FACTOR, speedFactor-0.1); _decHeld=true; } } else _decHeld=false;
  if(input.pressed('r')) { init(canvas,input); input.keys.delete('r'); }
  if(input.pressed('arrowleft','a')) player.x -= 320*dt*speedFactor;
  if(input.pressed('arrowright','d')) player.x += 320*dt*speedFactor;
  player.x=Math.max(20, Math.min(W-20-player.w, player.x));
  const spaceNow=input.pressed(' ');
  if(spaceNow && !spaceHeld && shootCooldown<=0){ bullets.push({x:player.x+player.w/2,y:player.y, v:-520*speedFactor, from:'player'}); shootCooldown=0.4/ speedFactor; }
  spaceHeld=spaceNow;
  if(shootCooldown>0) shootCooldown-=dt;
}

function updatePlayer(dt){ /* future power ups */ }

function updateEnemies(dt){
  const alive=enemies.filter(e=>e.alive); const speedBase=40 + (wave-1)*8; const speedBoost = 160 * (1 - alive.length / enemies.length);
  let moveX=(speedBase+speedBoost)*dt*dir*speedFactor;
  let edge=false;
  for(const e of alive){ e.x+=moveX; e.anim += dt*6*speedFactor; if(e.x<30|| e.x+e.w>W-30) edge=true; }
  if(edge){ dir*=-1; for(const e of alive){ e.y += 18; if(e.y+e.h >= player.y-10){ lives=0; gameOver=true; } } }
  enemyShootTimer -= dt*speedFactor;
  if(enemyShootTimer<=0){
    const shooters=alive.filter(e=> !enemies.some(o=> o.alive && o!==e && Math.abs(o.x-e.x)<e.w && o.y>e.y));
    if(shooters.length){ const pick=shooters[Math.floor(Math.random()*shooters.length)]; bullets.push({x:pick.x+pick.w/2,y:pick.y+pick.h, v:(200+Math.random()*80)*speedFactor, from:'enemy'}); }
    enemyShootTimer = Math.max(0.35/ speedFactor, (1.8 - wave*0.15 - speedBoost/180)/speedFactor);
  }
}

function updateBullets(dt){ bullets.forEach(b=> b.y += b.v*dt ); bullets = bullets.filter(b=> b.y>-60 && b.y<H+60); }

function updateUFO(dt){
  ufoTimer -= dt*speedFactor;
  if(!ufo && ufoTimer<=0){ const dir=Math.random()<0.5?1:-1; ufo={x: dir<0? W-60:10, y:40, w:50, h:26, v: dir* (110+Math.random()*40)*speedFactor, alive:true}; }
  if(ufo){ ufo.x += ufo.v*dt; if(ufo.x<-80||ufo.x>W+80){ ufo=null; ufoTimer= (8 + Math.random()*10)/speedFactor; } }
}

function checkCollisions(){
  for(const b of bullets){
    if(b.from==='player'){
      if(ufo && ufo.alive && rectHit(b.x-3,b.y-6,6,12,ufo)){ ufo.alive=false; score+=300+wave*20; b.y=-999; saveBest(); }
      for(const e of enemies){ if(e.alive && rectHit(b.x-3,b.y-6,6,12,e)){ e.alive=false; b.y=-999; score+=100; saveBest(); break; } }
    } else if(b.from==='enemy'){
      if(rectHit(b.x-3,b.y-6,6,12, player)){ b.y=-999; lives--; if(lives<=0) gameOver=true; }
    }
    // Escudos
    for(const s of shields){ if(b.y>-900 && b.x > s.x && b.x < s.x + s.w && b.y > s.y && b.y < s.y + s.h){ const segSize=10; const sx=Math.floor((b.x - s.x)/segSize); const sy=Math.floor((b.y - s.y)/segSize); if(s.segs[sy] && s.segs[sy][sx]>0){ s.segs[sy][sx]--; b.y=-999; } } }
  }
  bullets = bullets.filter(b=> b.y>-900);
  // Enemigos chocando escudos los erosionan
  for(const e of enemies){ if(!e.alive) continue; for(const s of shields){ if(e.x < s.x + s.w && e.x+e.w> s.x && e.y+e.h > s.y && e.y < s.y + s.h){ damageShieldRect(s, e); } } }
}

function damageShieldRect(s, rect){ const segSize=10; for(let y=0;y<s.segs.length;y++) for(let x=0;x<s.segs[y].length;x++){ if(s.segs[y][x]<=0) continue; const cx=s.x + x*segSize; const cy=s.y + y*segSize; if(cx+segSize>rect.x && cx<rect.x+rect.w && cy+segSize>rect.y && cy<rect.y+rect.h){ s.segs[y][x]=0; } } }

function rectHit(x,y,w,h, r){ return x<r.x+r.w && x+w>r.x && y<r.y+r.h && y+h>r.y; }

function saveBest(){ if(score>best){ best=score; localStorage.setItem('best_invaders', best); } }

export function draw(){
  ctx.fillStyle='#020612'; ctx.fillRect(0,0,W,H); drawStars();
  // UFO
  if(ufo && ufo.alive){ ctx.fillStyle='#f06292'; ctx.fillRect(ufo.x,ufo.y,ufo.w,ufo.h); ctx.fillStyle='#fff'; ctx.fillRect(ufo.x+8,ufo.y+6,ufo.w-16,12); }
  // player
  ctx.fillStyle='#64b5f6'; ctx.fillRect(player.x, player.y, player.w, player.h); ctx.fillStyle='#bbdefb'; ctx.fillRect(player.x+8, player.y+8, player.w-16, player.h-16);
  // shields
  for(const s of shields){ const segSize=10; for(let y=0;y<s.segs.length;y++){ for(let x=0;x<s.segs[y].length;x++){ const hp=s.segs[y][x]; if(hp<=0) continue; const alpha= hp/3; ctx.fillStyle=`rgba(120,220,120,${alpha})`; ctx.fillRect(s.x + x*segSize, s.y + y*segSize, segSize, segSize); } } }
  // enemies
  for(const e of enemies){ if(!e.alive) continue; const frame = Math.floor(e.anim)%2; ctx.fillStyle= frame? '#8bc34a':'#aed581'; ctx.fillRect(e.x,e.y,e.w,e.h); ctx.fillStyle='#33691e'; ctx.fillRect(e.x+6,e.y+6,e.w-12,e.h-12); }
  // bullets
  for(const b of bullets){ ctx.fillStyle= b.from==='player'? '#ffeb3b':'#ff5252'; ctx.fillRect(b.x-2,b.y-8,4,10); }
  // HUD
  ctx.fillStyle='#fff'; ctx.font='14px monospace'; ctx.textAlign='left'; ctx.fillText(`Score:${score} Lives:${lives} Wave:${wave} Spd:${speedFactor.toFixed(2)} (=/-) Best:${best}` , 12,24);
  if(gameOver){ ctx.fillStyle='#f44336'; ctx.font='34px system-ui'; ctx.textAlign='center'; ctx.fillText('GAME OVER', W/2,H/2); ctx.font='16px monospace'; ctx.fillStyle='#fff'; ctx.fillText('R para reiniciar', W/2,H/2+40); }
  ctx.textAlign='left';
}

function drawStars(){
  ctx.fillStyle='#fff'; for(let i=0;i<80;i++){ const x=(i*97 % W); const y=(i*53 % H); const s=(i%5===0)?2:1; ctx.fillRect(x,y,s,s);} }

export function getStatus(){ return `Invaders | Score ${score} Wave ${wave} Spd:${speedFactor.toFixed(2)}`; }
export function restart(){ init(canvas,input); }

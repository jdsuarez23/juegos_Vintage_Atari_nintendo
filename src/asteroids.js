// Asteroids simplificado
import {Input} from './engine.js';
let canvas, ctx, input;

let ship; // {x,y,ang,vel:{x,y},alive}
let asteroids=[]; // {x,y,r, vx,vy, pts:[]}
let bullets=[]; // {x,y,vx,vy,life}
let score=0, lives=3, wave=1, gameOver=false, best=0;
let speedFactor=1; const MAX_SPEED_FACTOR=2.3; const MIN_SPEED_FACTOR=0.6; let _incHeld=false; let _decHeld=false;
const W=860,H=560;

export function init(c, inp){ canvas=c; ctx=canvas.getContext('2d'); input=inp; score=0; lives=3; wave=1; gameOver=false; speedFactor=1; const b=localStorage.getItem('best_asteroids'); if(b) best=parseInt(b)||0; ship={x:W/2,y:H/2,ang:-Math.PI/2,vel:{x:0,y:0},alive:true}; asteroids=[]; bullets=[]; spawnWave(); }

function spawnWave(){ for(let i=0;i<4+wave; i++){ asteroids.push(makeAsteroid()); } }
function makeAsteroid(size){ const r=size? size : 30+Math.random()*30; let x,y; if(Math.random()<0.5){ x=Math.random()*W; y=Math.random()<0.5? -r: H+r; } else { y=Math.random()*H; x=Math.random()<0.5? -r: W+r; } const a=Math.random()*Math.PI*2; const s=20+Math.random()*40; return {x,y,r, vx:Math.cos(a)*s, vy:Math.sin(a)*s, pts:genPoints(r)}; }
function genPoints(r){ const pts=[]; const jag=12; for(let i=0;i<jag;i++){ const ang=i/jag*Math.PI*2; const rr=r*(0.7+Math.random()*0.3); pts.push({x:Math.cos(ang)*rr,y:Math.sin(ang)*rr}); } return pts; }

export function update(dt){ if(gameOver) return; handleInput(dt); updateShip(dt); updateBullets(dt); updateAsteroids(dt); checkCollisions(); if(asteroids.length===0){ wave++; spawnWave(); } }

function handleInput(dt){ if(input.pressed('r')) { init(canvas,input); input.keys.delete('r'); }
  if(input.pressed('=','+')){ if(!_incHeld){ speedFactor=Math.min(MAX_SPEED_FACTOR,speedFactor+0.1); _incHeld=true; } } else _incHeld=false;
  if(input.pressed('-','_')){ if(!_decHeld){ speedFactor=Math.max(MIN_SPEED_FACTOR,speedFactor-0.1); _decHeld=true; } } else _decHeld=false;
  if(input.pressed('arrowleft','a')) ship.ang -= 3.2*dt*speedFactor; if(input.pressed('arrowright','d')) ship.ang += 3.2*dt*speedFactor; if(input.pressed('arrowup','w')) thrust(dt); if(input.pressed(' ')) shoot(); }

let shootCooldown=0; function shoot(){ if(shootCooldown>0) return; const speed=480*speedFactor; bullets.push({x:ship.x + Math.cos(ship.ang)*16, y:ship.y + Math.sin(ship.ang)*16, vx:Math.cos(ship.ang)*speed + ship.vel.x, vy:Math.sin(ship.ang)*speed + ship.vel.y, life:1.1}); shootCooldown=0.18/ speedFactor; }

function thrust(dt){ const power=220*speedFactor; ship.vel.x += Math.cos(ship.ang)*power*dt; ship.vel.y += Math.sin(ship.ang)*power*dt; }

function updateShip(dt){ ship.x += ship.vel.x*dt; ship.y += ship.vel.y*dt; ship.vel.x *= 0.995; ship.vel.y *= 0.995; wrap(ship); if(shootCooldown>0) shootCooldown-=dt; }
function updateBullets(dt){ bullets.forEach(b=>{ b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt; }); bullets=bullets.filter(b=> b.life>0); bullets.forEach(wrap); }
function updateAsteroids(dt){ asteroids.forEach(a=>{ a.x+=a.vx*dt*speedFactor; a.y+=a.vy*dt*speedFactor; wrap(a); }); }
function wrap(o){ if(o.x<-50) o.x+=W+100; else if(o.x>W+50) o.x-=W+100; if(o.y<-50) o.y+=H+100; else if(o.y>H+50) o.y-=H+100; }

function checkCollisions(){
  for(const b of bullets){ for(const a of asteroids){ if(dist2(b,a) < a.r*a.r){ b.life=0; splitAsteroid(a); score+=100; saveBest(); } } }
  if(ship.alive){ for(const a of asteroids){ if(dist2(ship,a) < (a.r+14)*(a.r+14)){ lives--; if(lives<=0){ gameOver=true; ship.alive=false; } else { ship.x=W/2; ship.y=H/2; ship.vel.x=0; ship.vel.y=0; ship.ang=-Math.PI/2; } break; } } }
}
function dist2(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return dx*dx+dy*dy; }
function splitAsteroid(a){ const idx=asteroids.indexOf(a); if(idx>=0) asteroids.splice(idx,1); if(a.r>26){ for(let i=0;i<2;i++){ const na=makeAsteroid(a.r*0.55); na.x=a.x; na.y=a.y; asteroids.push(na); } } }
function saveBest(){ if(score>best){ best=score; localStorage.setItem('best_asteroids', best); } }

export function draw(){ ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H); drawStars(); drawShip(); drawAsteroids(); drawBullets(); drawHUD(); if(gameOver) drawGameOver(); }
function drawStars(){ ctx.fillStyle='#fff'; for(let i=0;i<120;i++){ const x=(i*73)%W; const y=(i*41)%H; ctx.fillRect(x,y,1,1);} }
function drawShip(){ if(!ship.alive) return; ctx.save(); ctx.translate(ship.x,ship.y); ctx.rotate(ship.ang); ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(18,0); ctx.lineTo(-12,-12); ctx.lineTo(-6,0); ctx.lineTo(-12,12); ctx.closePath(); ctx.stroke(); if(input.pressed('arrowup','w')){ ctx.strokeStyle='#ff9800'; ctx.beginPath(); ctx.moveTo(-12,-8); ctx.lineTo(-22,0); ctx.lineTo(-12,8); ctx.stroke(); } ctx.restore(); }
function drawAsteroids(){ ctx.strokeStyle='#9e9e9e'; ctx.lineWidth=2; for(const a of asteroids){ ctx.beginPath(); for(let i=0;i<a.pts.length;i++){ const p=a.pts[i]; const x=a.x+p.x; const y=a.y+p.y; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);} ctx.closePath(); ctx.stroke(); } }
function drawBullets(){ ctx.fillStyle='#ffeb3b'; bullets.forEach(b=> ctx.fillRect(b.x-2,b.y-2,4,4)); }
function drawHUD(){ ctx.fillStyle='#fff'; ctx.font='14px monospace'; ctx.fillText('Score: '+score+'  Lives:'+lives+'  Wave:'+wave+'  Spd:'+speedFactor.toFixed(2)+' (=/-)  Best:'+best, 12,24); }
function drawGameOver(){ ctx.fillStyle='#f44336'; ctx.font='34px system-ui'; ctx.textAlign='center'; ctx.fillText('GAME OVER', W/2,H/2); ctx.font='16px monospace'; ctx.fillStyle='#fff'; ctx.fillText('R para reiniciar', W/2,H/2+40); ctx.textAlign='left'; }

export function getStatus(){ return `Asteroids | Score ${score} Wave ${wave} Spd:${speedFactor.toFixed(2)}`; }
export function restart(){ init(canvas,input); }

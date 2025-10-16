// Centipede clásico simplificado
// Controles: A/D o Flechas para mover, Espacio para disparar, R reinicia
// Mecánicas: Dispara segmentos. Al golpear un segmento se genera un hongo y la oruga se divide.
// Derrota todas las orugas para subir de nivel. Araña da puntos extra. Evita colisiones.

let canvas, ctx, input;
const TILE = 20; // tamaño lógico
const COLS = 42; // 42*20=840 aprox (se centrará en canvas 860)
const ROWS = 28; // área de juego superior; jugador restringido a últimas 5 filas

let mushrooms=[]; // {x,y,hits,poison}
let centipedes=[]; // [{segments:[{x,y}], dir:1| -1, speed, stepTimer, pendingDown:false}]
let bullets=[]; // {x,y,v}
let spider=null; // {x,y,vx,vy}
let level=1, score=0, lives=3, best=0, gameOver=false;
let playArea = {offsetX:0, offsetY:0};
let player; // {x,y,cooldown}

const PLAYER_SPEED=340;
const BULLET_SPEED=600;

export function init(c,inp){ canvas=c; ctx=canvas.getContext('2d'); input=inp; try{ const b=localStorage.getItem('best_centipede'); if(b) best=parseInt(b)||0; }catch(e){} reset(); }
export function restart(){ reset(); }
export function dispose(){ mushrooms.length=0; centipedes.length=0; bullets.length=0; spider=null; }

function reset(){ score=0; lives=3; level=1; gameOver=false; mushrooms=[]; centipedes=[]; bullets=[]; spider=null; randomMushrooms(); spawnCentipede(); spawnPlayer(); }

function spawnPlayer(){ player={ x:Math.floor(COLS/2), y: ROWS-2, cooldown:0 }; }

function randomMushrooms(){ const density=0.08 + level*0.01; for(let y=2;y<ROWS-5;y++){ for(let x=0;x<COLS;x++){ if(Math.random()<density){ mushrooms.push({x,y,hits:3,poison:false}); } } } }

function spawnCentipede(){ const length = Math.min(12 + level*2, 30); const segments=[]; for(let i=0;i<length;i++){ segments.push({x: i, y:0}); } centipedes.push({segments, dir:1, speed: Math.max(0.11 - level*0.004, 0.04), stepTimer:0, pendingDown:false}); }

function spawnSpider(){ if(spider || Math.random()<0.6) return; spider={ x: Math.random()<0.5? 0: COLS-1, y: ROWS-4 - Math.floor(Math.random()*4), vx: (Math.random()<0.5?-1:1)* (120+Math.random()*80), vy:(Math.random()<0.5?-1:1)*60 }; }

function updatePlayer(dt){ if(gameOver) return; // movimiento horizontal
  let mv=0; if(input.pressed('a','arrowleft')) mv=-1; else if(input.pressed('d','arrowright')) mv=1; player.x += mv * (PLAYER_SPEED*dt)/TILE; player.x=Math.max(0,Math.min(COLS-1,player.x)); // player restringido zonas bajas
  if(player.y<ROWS-5) player.y=ROWS-5; if(player.y>ROWS-1) player.y=ROWS-1;
  // disparo
  if(player.cooldown>0) player.cooldown-=dt; if(input.pressed(' ')){ if(!updatePlayer._held && player.cooldown<=0){ bullets.push({x:player.x+0.5,y:player.y-0.3,v:-BULLET_SPEED}); player.cooldown=0.18; } updatePlayer._held=true; } else updatePlayer._held=false; }

function updateBullets(dt){ for(const b of bullets){ b.y += (b.v*dt)/TILE; }
  bullets = bullets.filter(b=> b.y>-2);
}

function mushroomAt(x,y){ return mushrooms.find(m=> m.x===x && m.y===y); }

function addMushroom(x,y){ if(y<0||y>=ROWS-1) return; if(!mushroomAt(x,y)) mushrooms.push({x,y,hits:3,poison:false}); }

function updateCentipedes(dt){ for(const c of centipedes){ c.stepTimer += dt; if(c.stepTimer >= c.speed){ c.stepTimer=0; // mover cabeza tipo snake
      const head = c.segments[0]; let nx = head.x + c.dir; let ny = head.y; let needDown=false;
      // colisión con bordes
      if(nx<0 || nx>=COLS){ nx = Math.max(0,Math.min(COLS-1,nx)); needDown=true; }
      // colisión con hongo
      const mush = mushroomAt(nx,ny); if(mush){ needDown=true; }
      if(needDown){ ny = head.y + 1; c.dir*=-1; nx = head.x + c.dir; }
      // si hongo en nueva fila bloquear y volver a bajar
      if(mushroomAt(nx,ny)){ ny++; }
      // bajar dentro de límites
      if(ny>=ROWS){ ny=ROWS-1; }
      // insertar nuevo head
      c.segments.unshift({x:nx,y:ny}); c.segments.pop();
    }
  }
  // Colisiones bala-centipede
  for(let bi=bullets.length-1; bi>=0; bi--){ const b=bullets[bi]; let hit=false; for(let ci=centipedes.length-1; ci>=0 && !hit; ci--){ const c=centipedes[ci]; for(let si=0; si<c.segments.length; si++){ const s=c.segments[si]; if(Math.abs(b.x - (s.x+0.5))<0.5 && Math.abs(b.y - (s.y+0.5))<0.5){ // impacto
            bullets.splice(bi,1); hit=true; const headHit = (si===0); score += headHit? 100:10; saveBest(); addMushroom(s.x,s.y); // dividir
            if(c.segments.length>1){ const before = c.segments.slice(0,si); const after = c.segments.slice(si+1); centipedes.splice(ci,1); if(before.length) centipedes.push({segments:before, dir:c.dir, speed:c.speed, stepTimer:0}); if(after.length) centipedes.push({segments:after, dir:c.dir, speed:Math.min(c.speed+0.005,0.12), stepTimer:0}); }
            else { c.segments.splice(si,1); if(c.segments.length===0) centipedes.splice(ci,1); }
            break; }
        }
      }
    }
  // victoria (todas eliminadas)
  if(centipedes.length===0){ level++; spawnCentipede(); if(Math.random()<0.5) randomMushrooms(); }
}

function updateSpider(dt){ if(!spider){ if(Math.random()<0.002) spawnSpider(); return; } spider.x += (spider.vx*dt)/TILE; spider.y += (spider.vy*dt)/TILE; if(spider.x<0){ spider.x=0; spider.vx=Math.abs(spider.vx);} if(spider.x>COLS-1){ spider.x=COLS-1; spider.vx=-Math.abs(spider.vx);} if(spider.y<ROWS-8){ spider.y=ROWS-8; spider.vy=Math.abs(spider.vy);} if(spider.y>ROWS-2){ spider.y=ROWS-2; spider.vy=-Math.abs(spider.vy);} // colisión con bala
  for(let i=bullets.length-1;i>=0;i--){ const b=bullets[i]; if(Math.abs(b.x - (spider.x+0.5))<0.8 && Math.abs(b.y - (spider.y+0.5))<0.8){ bullets.splice(i,1); score+=300; saveBest(); spider=null; break; } }
  // colisión con jugador
  if(spider && Math.abs(spider.x - player.x)<0.6 && Math.abs(spider.y - player.y)<0.6){ loseLife(); }
  // chance de dejar hongo
  if(spider && Math.random()<0.03){ addMushroom(Math.floor(spider.x), Math.floor(spider.y)); }
}

function updateCollisions(){ // bala-hongo
  for(let bi=bullets.length-1; bi>=0; bi--){ const b=bullets[bi]; for(const m of mushrooms){ if(Math.abs(b.x-(m.x+0.5))<0.45 && Math.abs(b.y-(m.y+0.5))<0.45){ bullets.splice(bi,1); m.hits--; if(m.hits<=0){ const idx=mushrooms.indexOf(m); if(idx>=0) mushrooms.splice(idx,1); score+=5; saveBest(); } break; } } }
  // centipede-jugador
  for(const c of centipedes){ for(const s of c.segments){ if(Math.abs(s.x - player.x)<0.6 && Math.abs(s.y - player.y)<0.4){ loseLife(); return; } } }
}

function loseLife(){ if(gameOver) return; lives--; if(lives<=0){ gameOver=true; } else { bullets=[]; centipedes=[]; spawnCentipede(); player.x=Math.floor(COLS/2); player.cooldown=0.5; } }

export function update(dt){ if(input.pressed('r')){ restart(); input.keys.delete('r'); }
  if(gameOver) return; updatePlayer(dt); updateBullets(dt); updateCentipedes(dt); updateSpider(dt); updateCollisions(); }

function drawGrid(){ ctx.strokeStyle='#062'; ctx.lineWidth=1; for(let x=0;x<=COLS;x++){ ctx.beginPath(); ctx.moveTo(playArea.offsetX + x*TILE, playArea.offsetY); ctx.lineTo(playArea.offsetX + x*TILE, playArea.offsetY + ROWS*TILE); ctx.stroke(); } for(let y=0;y<=ROWS;y++){ ctx.beginPath(); ctx.moveTo(playArea.offsetX, playArea.offsetY + y*TILE); ctx.lineTo(playArea.offsetX + COLS*TILE, playArea.offsetY + y*TILE); ctx.stroke(); } }

export function draw(){ // background
  ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height); // centrar área
  playArea.offsetX = Math.floor((canvas.width - COLS*TILE)/2); playArea.offsetY = 10;
  // hongos
  for(const m of mushrooms){ const px=playArea.offsetX + m.x*TILE; const py=playArea.offsetY + m.y*TILE; ctx.fillStyle= m.poison? '#9c27b0':'#3fa34d'; ctx.fillRect(px+2,py+2,TILE-4,TILE-4); ctx.fillStyle='#1b5e20'; ctx.fillRect(px+4,py+4,TILE-8,TILE-8); if(m.hits<3){ ctx.fillStyle='#fff'; ctx.fillRect(px+6,py+6,4,4);} }
  // centípedes
  for(const c of centipedes){ for(let i=0;i<c.segments.length;i++){ const s=c.segments[i]; const px=playArea.offsetX + s.x*TILE; const py=playArea.offsetY + s.y*TILE; ctx.fillStyle= i===0? '#ff7043':'#ffcc80'; ctx.beginPath(); ctx.arc(px+TILE/2, py+TILE/2, TILE*0.42,0,Math.PI*2); ctx.fill(); if(i===0){ ctx.fillStyle='#000'; ctx.fillRect(px+TILE/2-4,py+TILE/2-2,3,3); ctx.fillRect(px+TILE/2+1,py+TILE/2-2,3,3);} } }
  // spider
  if(spider){ const px=playArea.offsetX + spider.x*TILE; const py=playArea.offsetY + spider.y*TILE; ctx.fillStyle='#8d6e63'; ctx.beginPath(); ctx.arc(px+TILE/2,py+TILE/2,TILE*0.4,0,Math.PI*2); ctx.fill(); }
  // bullets
  ctx.fillStyle='#fff'; for(const b of bullets){ const px=playArea.offsetX + b.x*TILE; const py=playArea.offsetY + b.y*TILE; ctx.fillRect(px-2,py-6,4,10); }
  // player
  ctx.fillStyle='#4fc3f7'; const ppx=playArea.offsetX + player.x*TILE; const ppy=playArea.offsetY + player.y*TILE; ctx.fillRect(ppx+4,ppy+TILE-10,TILE-8,10); ctx.fillRect(ppx+TILE/2-4, ppy+4,8,TILE-12); ctx.fillStyle='#fff'; ctx.fillRect(ppx+TILE/2-2, ppy+8,4,6);
  // HUD
  ctx.fillStyle='#fff'; ctx.font='14px monospace'; ctx.fillText(`Centipede | Score:${score} Lives:${lives} Lvl:${level} Best:${best}`,10, canvas.height-14);
  if(gameOver){ ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle='#ff5555'; ctx.font='40px system-ui'; ctx.textAlign='center'; ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2); ctx.font='16px monospace'; ctx.fillStyle='#fff'; ctx.fillText('R para reiniciar', canvas.width/2, canvas.height/2+40); ctx.textAlign='left'; }
}

export function getStatus(){ return `Centipede | Score ${score} Lvl ${level}`; }

function saveBest(){ if(score>best){ best=score; try{ localStorage.setItem('best_centipede', best); }catch(e){} } }

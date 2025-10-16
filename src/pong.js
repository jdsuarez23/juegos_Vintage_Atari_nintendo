// Pong clásico mejorado
// Controles: Jugador izquierda: W/S | Jugador derecha: Flechas Up/Down (o modo CPU si se activa)

let canvas, ctx, input;
let left, right, ball;
let scoreL=0, scoreR=0; let best=0;
let cpu=true; // CPU controla la paleta derecha si true
let pause=false;
let targetScore=11; let serve=1; let cpuLevel=1; // 1 easy 2 medium 3 hard
// NUEVO: control de velocidad / nivel
let level=1; let speedFactor=1; const MAX_SPEED=2.2; const MIN_SPEED=0.6; let _incHeld=false; let _decHeld=false;

export function init(c, inp){ canvas=c; ctx=canvas.getContext('2d'); input=inp; reset(); const b=localStorage.getItem('best_pong'); if(b) best=parseInt(b)||0; }
export function restart(){ scoreL=0; scoreR=0; level=1; speedFactor=1; reset(); }

function reset(){ left={x:40,y:canvas.height/2-50,w:16,h:100,v:0}; right={x:canvas.width-56,y:canvas.height/2-50,w:16,h:100,v:0}; newBall(); }
function newBall(){ const dir=serve; const ang=(Math.random()*0.6 -0.3); const base= 300 * speedFactor + (Math.random()*40); ball={x:canvas.width/2,y:canvas.height/2,vx:dir*base, vy: Math.sin(ang)*base*0.8, r:10}; }

export function update(dt){ if(pause) return; handleInput(dt); autoLevel(); movePaddles(dt); moveBall(dt); }

function handleInput(dt){ if(input.pressed('p')){ pause=!pause; input.keys.delete('p'); }
  if(input.pressed('c')){ cpu=!cpu; input.keys.delete('c'); }
  if(input.pressed('1')){ cpuLevel=1; input.keys.delete('1'); }
  if(input.pressed('2')){ cpuLevel=2; input.keys.delete('2'); }
  if(input.pressed('3')){ cpuLevel=3; input.keys.delete('3'); }
  if(input.pressed('n')){ newBall(); serve*=-1; input.keys.delete('n'); }
  // Ajuste manual velocidad (= / -) (opción C, no usamos flechas Up/Down aquí)
  if(input.pressed('=','+')){ if(!_incHeld){ speedFactor=Math.min(MAX_SPEED, (speedFactor+0.1)); scaleBall(); _incHeld=true; } } else _incHeld=false;
  if(input.pressed('-','_')){ if(!_decHeld){ speedFactor=Math.max(MIN_SPEED, (speedFactor-0.1)); scaleBall(); _decHeld=true; } } else _decHeld=false;
  // player left
  left.v=0; if(input.pressed('w')) left.v=-380*speedFactor; else if(input.pressed('s')) left.v=380*speedFactor;
  // detectar intención de controlar paleta derecha => desactivar CPU automáticamente
  if(input.pressed('arrowup','arrowdown')) cpu=false;
  // right manual if cpu off
  if(!cpu){ right.v=0; if(input.pressed('arrowup')) right.v=-380*speedFactor; else if(input.pressed('arrowdown')) right.v=380*speedFactor; }
}
function scaleBall(){ // ajustar velocidad actual de la bola al nuevo factor manteniendo dirección
  if(ball){ const dirX=Math.sign(ball.vx)||1; const ratio = speedFactor; const mag = 300*ratio + (Math.random()*30); const norm=Math.hypot(ball.vx,ball.vy)||1; const ux=ball.vx/norm; const uy=ball.vy/norm; const newSpeed=mag; ball.vx=ux*newSpeed; ball.vy=uy*newSpeed; }
}
function movePaddles(dt){ left.y += left.v*dt; right.y += right.v*dt; left.y=Math.max(20, Math.min(canvas.height-left.h-20,left.y)); right.y=Math.max(20, Math.min(canvas.height-right.h-20,right.y)); if(cpu){
    const react = cpuLevel===1? 0.4 : cpuLevel===2? 0.7: 1.0;
    const target = ball.y - right.h/2; const diff = target - right.y; right.y += Math.sign(diff) * Math.min(Math.abs(diff), (320 + cpuLevel*80)*dt*react*speedFactor); }
}
function moveBall(dt){ ball.x += ball.vx*dt; ball.y += ball.vy*dt; if(ball.y-ball.r<10 && ball.vy<0){ ball.y=10+ball.r; ball.vy*=-1; } if(ball.y+ball.r>canvas.height-10 && ball.vy>0){ ball.y=canvas.height-10-ball.r; ball.vy*=-1; }
  if(ball.x - ball.r < left.x + left.w && ball.x > left.x && ball.y>left.y && ball.y<left.y+left.h && ball.vx<0){ collide(left); }
  if(ball.x + ball.r > right.x && ball.x < right.x+right.w && ball.y>right.y && ball.y<right.y+right.h && ball.vx>0){ collide(right); }
  if(ball.x < -40){ scoreR++; serve=1; roundEnd(); }
  if(ball.x > canvas.width+40){ scoreL++; serve=-1; roundEnd(); }
}
function roundEnd(){ saveBest(); if(scoreL>=targetScore || scoreR>=targetScore){ pause=true; } newBall(); }
function collide(p){ const rel=(ball.y - (p.y + p.h/2))/ (p.h/2); const speed = Math.min(680*speedFactor, Math.abs(ball.vx)*1.08 + 20*speedFactor); ball.vx = (p===left?1:-1)*speed; ball.vy = rel * speed*0.75; }
function autoLevel(){ const newLevel = 1 + Math.floor((scoreL+scoreR)/4); if(newLevel>level){ level=newLevel; speedFactor=Math.min(MAX_SPEED, speedFactor + 0.12); scaleBall(); } }

export function draw(){ ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle='#333'; ctx.lineWidth=2; for(let y=10;y<canvas.height;y+=30){ ctx.beginPath(); ctx.moveTo(canvas.width/2,y); ctx.lineTo(canvas.width/2,y+15); ctx.stroke(); }
  ctx.fillStyle='#fff'; ctx.fillRect(left.x,left.y,left.w,left.h); ctx.fillRect(right.x,right.y,right.w,right.h);
  ctx.beginPath(); ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#fff'; ctx.font='48px monospace'; ctx.textAlign='center'; ctx.fillText(scoreL, canvas.width/2 - 80, 80); ctx.fillText(scoreR, canvas.width/2 + 80, 80);
  ctx.font='14px monospace'; ctx.textAlign='left'; ctx.fillText(`Best:${best} CPU:${cpu?('ON L'+cpuLevel):'OFF'} Lvl:${level} Spd:${speedFactor.toFixed(2)}  Keys: C CPU | 1-3 dif | =/- velocidad | N bola | P pausa`, 20, canvas.height-20);
  if(pause && (scoreL>=targetScore || scoreR>=targetScore)){ ctx.fillStyle='#fff'; ctx.font='28px monospace'; ctx.textAlign='center'; ctx.fillText('PARTIDA TERMINADA - R para reiniciar', canvas.width/2, canvas.height/2); }
  ctx.textAlign='left'; }

export function getStatus(){ return `Pong | ${scoreL} - ${scoreR} Lvl:${level} Spd:${speedFactor.toFixed(2)}`; }
function saveBest(){ const max=Math.max(scoreL,scoreR); if(max>best){ best=max; localStorage.setItem('best_pong', best); } }

// Engine genérico simple
export class Input {
  constructor(){
    this.keys=new Set();
    this._downHandler = (e)=>{
      const k=e.key.toLowerCase();
      if(this.blockKeys.includes(k)) e.preventDefault();
      this.keys.add(k);
    };
    this._upHandler = (e)=>{ this.keys.delete(e.key.toLowerCase()); };
    this._spacePrevent = (e)=>{ if(e.code==='Space' && e.target===document.body){ e.preventDefault(); } };
    this.blockKeys=[' ','arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'];
    addEventListener('keydown', this._downHandler, {passive:false});
    addEventListener('keyup', this._upHandler, {passive:false});
    window.addEventListener('keydown', this._spacePrevent, {passive:false});
  }
  pressed(...k){return k.some(key=>this.keys.has(key.toLowerCase()));}
  clear(){ this.keys.clear(); }
  dispose(){
    removeEventListener('keydown', this._downHandler, {passive:false});
    removeEventListener('keyup', this._upHandler, {passive:false});
    window.removeEventListener('keydown', this._spacePrevent, {passive:false});
    this.keys.clear();
  }
}

export class GameManager {
  constructor(canvas){
    this.canvas=canvas; this.ctx=canvas.getContext('2d');
    this.input=new Input();
    this.current=null; this.last=0; this.running=false; this.overlayInfo='';
    this.lastError=null; this.errorCount=0;
  }
  set(gameModule){
    if(this.current?.dispose){ try{ this.current.dispose(); }catch(e){} }
    this.input.clear();
    this.current=gameModule;
    this.lastError=null; this.errorCount=0;
    if(gameModule?.init) try{ gameModule.init(this.canvas,this.input); } catch(e){ this.lastError=e; console.error('Init error',e); }
    // enfocar canvas
    if(this.canvas?.focus) this.canvas.focus();
  }
  restart(){ if(this.current?.restart) this.current.restart(); }
  loop(t){
    const dt=Math.min(0.05,(t-this.last)/1000); this.last=t;
    try{
      if(this.current?.update) this.current.update(dt);
      this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
      if(this.current?.draw) this.current.draw(this.ctx);
      if(this.current?.getStatus){
        this.ctx.fillStyle='#000a'; this.ctx.fillRect(0,this.canvas.height-28,this.canvas.width,28);
        this.ctx.fillStyle='#fff'; this.ctx.font='14px monospace';
        let status=this.current.getStatus();
        if(this.lastError) status += ' | ERR:'+ (this.lastError.message||this.lastError);
        this.ctx.fillText(status,10,this.canvas.height-10);
      }
    }catch(e){
      this.lastError=e; this.errorCount++; console.error('Game loop error',e);
      this.ctx.fillStyle='#200'; this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
      this.ctx.fillStyle='#f55'; this.ctx.font='16px monospace';
      this.ctx.fillText('ERROR en juego. Ver consola. Click otro boton para cambiar.',20,40);
      if(this.errorCount>20){
        this.ctx.fillText('Demasiados errores. Detenido.',20,70);
        return; // parar para no saturar
      }
    }
    requestAnimationFrame(this.loop.bind(this));
  }
  start(){ if(!this.running){ this.running=true; requestAnimationFrame(this.loop.bind(this)); } }
  resume(){ if(!this.running){ this.running=true; requestAnimationFrame(this.loop.bind(this)); } }
}

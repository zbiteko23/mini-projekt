const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const info = document.getElementById('info');
const modesContainer = document.getElementById('modes');

let current = null;
const initialCanvas = { w: canvas.width, h: canvas.height };

const games = {
  had: initHad,
  dropper: initDropper,
  miny: initMines
};

const gameModes = {
  had: [{id:'classic',label:'Classic'},{id:'fast',label:'Rychle'}],
  dropper: [{id:'classic',label:'Classic'},{id:'magnet',label:'Magnet'},{id:'hard',label:'Hard'}],
  miny: [{id:'classic',label:'Classic'},{id:'easy',label:'Easy'},{id:'timed',label:'Timed'}]
};

document.getElementById('btn-had').addEventListener('click', ()=>start('had'));
document.getElementById('btn-dropper').addEventListener('click', ()=>start('dropper'));
document.getElementById('btn-miny').addEventListener('click', ()=>start('miny'));

function renderModes(name, activeMode){
  const modes = gameModes[name];
  if(!modes || modes.length===0){ modesContainer.innerHTML=''; modesContainer.setAttribute('aria-hidden','true'); return; }
  modesContainer.setAttribute('aria-hidden','false');
  modesContainer.innerHTML = '';
  for(const m of modes){
    const btn = document.createElement('button');
    btn.textContent = m.label;
    btn.dataset.mode = m.id;
    btn.className = (m.id===activeMode? 'active':'');
    btn.addEventListener('click', ()=>{ start(name,m.id); });
    modesContainer.appendChild(btn);
  }
}

function start(name, mode){
  stopCurrent();
  info.textContent = '';
  // clear canvas drawing
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const modes = gameModes[name];
  const selectedMode = mode || (modes && modes[0] && modes[0].id) || null;
  renderModes(name, selectedMode);
  current = games[name](selectedMode);
}

function stopCurrent(){
  if(!current) return;
  if(current.stop) current.stop();
  current = null;
  // restore canvas size if needed
  if(canvas.width !== initialCanvas.w || canvas.height !== initialCanvas.h){
    canvas.width = initialCanvas.w; canvas.height = initialCanvas.h;
  }
  modesContainer.innerHTML=''; modesContainer.setAttribute('aria-hidden','true');
}

// --- Had (Snake) ---
function initHad(mode){
  const size = 20;
  const cols = Math.floor(canvas.width/size);
  const rows = Math.floor(canvas.height/size);
  let snake = [{x:Math.floor(cols/2),y:Math.floor(rows/2)}];
  let dir = {x:1,y:0};
  let apple = placeApple();
  let running = true;
  // mode affects speed
  const interval = mode==='fast'? 70 : 120;
  let tick = setInterval(loop, interval);

  window.addEventListener('keydown', onKey);

  function placeApple(){
    while(true){
      const a = {x:Math.floor(Math.random()*cols), y:Math.floor(Math.random()*rows)};
      if(!snake.some(s=>s.x===a.x && s.y===a.y)) return a;
    }
  }

  function onKey(e){
    if(e.key==='ArrowUp' && dir.y!==1) dir={x:0,y:-1};
    if(e.key==='ArrowDown' && dir.y!==-1) dir={x:0,y:1};
    if(e.key==='ArrowLeft' && dir.x!==1) dir={x:-1,y:0};
    if(e.key==='ArrowRight' && dir.x!==-1) dir={x:1,y:0};
  }

  function loop(){
    const head = {x:snake[0].x+dir.x, y:snake[0].y+dir.y};
    if(head.x<0||head.y<0||head.x>=cols||head.y>=rows||snake.some(s=>s.x===head.x && s.y===head.y)){
      running=false; info.textContent='Konec hry. Stiskni znovu Had pro restart.'; clearInterval(tick); return;
    }
    snake.unshift(head);
    if(head.x===apple.x && head.y===apple.y){
      apple=placeApple();
    } else {
      snake.pop();
    }
    draw();
  }

  function draw(){
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#e74c3c'; ctx.fillRect(apple.x*size,apple.y*size,size,size);
    ctx.fillStyle='#2c3e50';
    for(const s of snake) ctx.fillRect(s.x*size,s.y*size,size-1,size-1);
  }

  draw();

  return {
    stop(){ clearInterval(tick); window.removeEventListener('keydown', onKey); }
  };
}

// --- Dropper ---
function initDropper(mode){
  // Falling-through-gaps mechanic: player 'falls' and must align with gaps in horizontal bars
  const player = { x: canvas.width/2, y: canvas.height*0.4, r: 12 };
  let score = 0;
  let running = true;
  const obstacles = [];

  // Mode adjustments
  let speed = mode==='hard' ? 3.2 : 2.2;
  let gapMin = mode==='hard' ? 60 : 90;
  let gapMax = mode==='hard' ? 120 : 160;
  const spawnDelay = mode==='hard' ? 900 : 1200;

  // spawn obstacles that are horizontal bars with a gap
  function spawnObstacle(){
    const gapW = Math.floor(gapMin + Math.random()*(gapMax-gapMin));
    const gapX = Math.floor(10 + Math.random()*(canvas.width - gapW - 20));
    const thickness = 26;
    // start below the canvas so they 'rise' past the player
    obstacles.push({ y: canvas.height + 40, gapX, gapW, thickness });
  }

  // initial fill
  for(let i=0;i<3;i++){ spawnObstacle(); }
  const spawnTick = setInterval(spawnObstacle, spawnDelay);
  const tick = setInterval(loop, 20);

  // controls
  function onMove(e){ const rect = canvas.getBoundingClientRect(); player.x = e.clientX - rect.left; clampPlayer(); }
  function onKey(e){ if(e.key==='ArrowLeft') player.x -= 28; if(e.key==='ArrowRight') player.x += 28; clampPlayer(); }
  function clampPlayer(){ player.x = Math.max(player.r, Math.min(canvas.width - player.r, player.x)); }

  canvas.addEventListener('mousemove', onMove);
  window.addEventListener('keydown', onKey);

  function loop(){
    // move obstacles upward to simulate falling down through them
    for(const ob of obstacles) ob.y -= speed;

    // magnet mode nudges player toward nearest gap center
    if(mode==='magnet'){
      let nearest = null; let bestDist = Infinity;
      for(const ob of obstacles){ const d = Math.abs(ob.y - player.y); if(d < bestDist){ bestDist = d; nearest = ob; } }
      if(nearest){ const target = nearest.gapX + nearest.gapW/2; player.x += (target - player.x) * 0.04; clampPlayer(); }
    }

    for(let i=obstacles.length-1;i>=0;i--){
      const ob = obstacles[i];
      // passed obstacle -> increase score
      if(ob.y + ob.thickness < 0){ obstacles.splice(i,1); score++; continue; }

      // collision check when obstacle overlaps player's vertical position
      if(player.y > ob.y && player.y < ob.y + ob.thickness){
        if(player.x - player.r < ob.gapX || player.x + player.r > ob.gapX + ob.gapW){
          end(); return;
        }
      }
    }
    draw();
  }

  function end(){ running=false; clearInterval(tick); clearInterval(spawnTick); canvas.removeEventListener('mousemove', onMove); window.removeEventListener('keydown', onKey); info.textContent = `Prohra. Skóre: ${score}. Stiskni Dropper pro restart.`; }

  function draw(){
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
    // draw obstacles as bars with a gap
    for(const ob of obstacles){
      ctx.fillStyle = '#34495e';
      // left part
      ctx.fillRect(0, ob.y, ob.gapX, ob.thickness);
      // right part
      ctx.fillRect(ob.gapX + ob.gapW, ob.y, canvas.width - (ob.gapX + ob.gapW), ob.thickness);
      // subtle divider
      ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(0, ob.y + ob.thickness - 2, canvas.width, 2);
    }

    // draw player
    ctx.fillStyle = '#e67e22'; ctx.beginPath(); ctx.arc(player.x, player.y, player.r, 0, Math.PI*2); ctx.fill();

    // HUD
    ctx.fillStyle = '#111'; ctx.font = '16px Arial'; ctx.fillText('Skóre: ' + score, 10, 20);
    if(mode === 'hard'){ ctx.fillStyle = '#c0392b'; ctx.fillText('Hard mode', canvas.width - 110, 20); }
    if(mode === 'magnet'){ ctx.fillStyle = '#2c3e50'; ctx.fillText('Magnet', canvas.width - 90, 20); }
  }

  return { stop(){ clearInterval(tick); clearInterval(spawnTick); canvas.removeEventListener('mousemove', onMove); window.removeEventListener('keydown', onKey); } };
}

// --- Hledání min (Mines) ---
function initMines(mode){
  const cols=10, rows=8, cell=40; canvas.width = cols*cell; canvas.height = rows*cell;
  let mines = 18;
  if(mode==='easy') mines = 10;
  const grid = Array(cols*rows).fill(0).map(()=>({mine:false,revealed:false,flag:false,count:0}));
  for(let i=0;i<mines;i++){
    while(true){const idx=Math.floor(Math.random()*grid.length); if(!grid[idx].mine){grid[idx].mine=true;break;}}
  }
  function index(x,y){return y*cols+x}
  for(let y=0;y<rows;y++) for(let x=0;x<cols;x++){
    const idx=index(x,y); if(grid[idx].mine) continue;
    let c=0; for(let yy=Math.max(0,y-1);yy<=Math.min(rows-1,y+1);yy++) for(let xx=Math.max(0,x-1);xx<=Math.min(cols-1,x+1);xx++){ if(grid[index(xx,yy)].mine) c++; }
    grid[idx].count=c;
  }
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('contextmenu', onRight);

  let gameOver=false;
  let timerInterval = null; let timeLeft = 0;
  if(mode==='timed'){
    timeLeft = 60; // seconds
    timerInterval = setInterval(()=>{ timeLeft--; if(timeLeft<=0){ gameOver=true; clearInterval(timerInterval); info.textContent='Èas vypršel. Stiskni Hledání min pro restart.'; } draw(); },1000);
  }

  draw();

  function reveal(x,y){ const idx=index(x,y); if(grid[idx].revealed||grid[idx].flag) return; grid[idx].revealed=true; if(grid[idx].mine){ gameOver=true; info.textContent='Prohra. Stiskni Hledání min pro restart.'; return; } if(grid[idx].count===0){ for(let yy=Math.max(0,y-1);yy<=Math.min(rows-1,y+1);yy++) for(let xx=Math.max(0,x-1);xx<=Math.min(cols-1,x+1);xx++){ if(!(xx===x && yy===y)) reveal(xx,yy);} } }

  function onClick(e){ if(gameOver) return; const rect=canvas.getBoundingClientRect(); const x=Math.floor((e.clientX-rect.left)/cell); const y=Math.floor((e.clientY-rect.top)/cell); reveal(x,y); draw(); }
  function onRight(e){ e.preventDefault(); if(gameOver) return; const rect=canvas.getBoundingClientRect(); const x=Math.floor((e.clientX-rect.left)/cell); const y=Math.floor((e.clientY-rect.top)/cell); const idx=index(x,y); grid[idx].flag=!grid[idx].flag; draw(); }

  function draw(){ ctx.fillStyle='#bdc3c7'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.strokeStyle='#7f8c8d'; ctx.font='16px Arial';
    for(let y=0;y<rows;y++) for(let x=0;x<cols;x++){ const idx=index(x,y); const cellX=x*cell, cellY=y*cell; ctx.strokeRect(cellX,cellY,cell,cell); if(grid[idx].revealed){ if(grid[idx].mine){ ctx.fillStyle='#c0392b'; ctx.fillRect(cellX+4,cellY+4,cell-8,cell-8); } else { ctx.fillStyle='#ecf0f1'; ctx.fillRect(cellX+1,cellY+1,cell-2,cell-2); if(grid[idx].count>0){ ctx.fillStyle='#2c3e50'; ctx.fillText(grid[idx].count,cellX+12,cellY+24); } } } else { ctx.fillStyle='#95a5a6'; ctx.fillRect(cellX+1,cellY+1,cell-2,cell-2); if(grid[idx].flag){ ctx.fillStyle='#e67e22'; ctx.fillText('F',cellX+12,cellY+24); } } }
    if(mode==='timed'){
      ctx.fillStyle='#111'; ctx.fillText('Èas: '+timeLeft+'s',10,20);
    }
  }

  return { stop(){ canvas.removeEventListener('click', onClick); canvas.removeEventListener('contextmenu', onRight); if(timerInterval) clearInterval(timerInterval); } };
}

// start default
info.textContent='Vyber hru nahoøe.';

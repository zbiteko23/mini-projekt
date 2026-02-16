// Tower defense with path, spots and toolbar UI
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const levelSelect = document.getElementById('levelSelect');
const startWaveBtn = document.getElementById('startWave');
const moneyEl = document.getElementById('money');
const livesEl = document.getElementById('lives');
const waveEl = document.getElementById('wave');
const waveTotalEl = document.getElementById('waveTotal');
const logEl = document.getElementById('log');

const hudMoney = document.getElementById('hud-money');
const hudWave = document.getElementById('hud-wave');
const hudWaveTotal = document.getElementById('hud-waveTotal');
const hudLives = document.getElementById('hud-lives');

const towerCards = document.querySelectorAll('.tower-card');
let selectedTowerType = null;
let hoverSpotIndex = -1;

const GAME_CONFIG = {
  levels: [
    { id:1, name:'Easy', waves:5, enemyBaseHp:10, enemyCountBase:3 },
    { id:2, name:'Normal', waves:6, enemyBaseHp:14, enemyCountBase:4 },
    { id:3, name:'Hard', waves:7, enemyBaseHp:20, enemyCountBase:5 },
    { id:4, name:'Very Hard', waves:8, enemyBaseHp:28, enemyCountBase:6 },
    { id:5, name:'Insane', waves:10, enemyBaseHp:40, enemyCountBase:8 }
  ],
  towers: {
    arrow: { cost:50, range:100, dmg:6, rate:300 },
    magic: { cost:80, range:90, dmg:10, rate:800, aoe:20 },
    mortar: { cost:100, range:150, dmg:16, rate:1400, aoe:40 },
    knight: { cost:60, range:30, dmg:12, rate:600 }
  }
};

// enemy type templates
const ENEMY_TYPES = {
  runner: { speed: 80, hpMult: 0.6, reward: 5, color: '#ffcc00', size: 12, name: 'Rychlý' },
  grunt:  { speed: 40, hpMult: 1.0, reward: 10, color: '#b00',     size: 12, name: 'Normální' },
  tank:   { speed: 20, hpMult: 2.4, reward: 20, color: '#400',     size: 16, name: 'Tank' }
};

// path defined as points to follow
const PATH = [ {x:-20,y:240}, {x:150,y:240}, {x:150,y:120}, {x:350,y:120}, {x:350,y:360}, {x:650,y:360}, {x:650,y:200}, {x:900,y:200} ];

// spots placed near the path
const SPOTS = [
  {x:80,y:180,r:22,occupied:false}, {x:220,y:80,r:22,occupied:false}, {x:300,y:180,r:22,occupied:false},
  {x:420,y:260,r:22,occupied:false}, {x:520,y:120,r:22,occupied:false}, {x:600,y:300,r:22,occupied:false},
  {x:720,y:140,r:22,occupied:false}
];

let state = {
  money: 200,
  lives: 20,
  level: GAME_CONFIG.levels[0],
  waveIndex: 0,
  waveCount: 0,
  towers: [],
  enemies: [],
  lastTime: performance.now(),
  waveRunning: false
};

function log(text){ const el = document.createElement('div'); el.textContent = text; logEl.prepend(el); }

function init(){
  for(const lvl of GAME_CONFIG.levels){
    const opt = document.createElement('option'); opt.value = lvl.id; opt.textContent = lvl.name; levelSelect.appendChild(opt);
  }
  levelSelect.addEventListener('change', ()=>{
    const id = parseInt(levelSelect.value,10); state.level = GAME_CONFIG.levels.find(l=>l.id===id); resetLevel();
  });
  startWaveBtn.addEventListener('click', startNextWave);
  towerCards.forEach(c=>c.addEventListener('click', ()=>{ towerCards.forEach(x=>x.classList.remove('selected')); c.classList.add('selected'); selectedTowerType = c.dataset.type; }));
  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('mousemove', onCanvasMove);
  resetLevel();
  requestAnimationFrame(loop);
}

function resetLevel(){
  state.money = 200; state.lives = 20; state.waveIndex = 0; state.waveCount = state.level.waves; state.towers = []; state.enemies = []; state.waveRunning = false; // reset spots
  for(const s of SPOTS) s.occupied = false;
  updateUI(); log('Level '+state.level.name+' vybrán.');
}

function updateUI(){ moneyEl.textContent = state.money; livesEl.textContent = state.lives; waveEl.textContent = state.waveIndex; waveTotalEl.textContent = state.waveCount; hudMoney.textContent = state.money; hudWave.textContent = state.waveIndex; hudWaveTotal.textContent = state.waveCount; hudLives.textContent = state.lives; }

function startNextWave(){ if(state.waveRunning) return; if(state.waveIndex>=state.waveCount){ log('Všechny vlny dokonèeny'); return; } state.waveIndex++; state.waveRunning=true; spawnWave(state.waveIndex); updateUI(); }

// choose enemy type for a given wave index (mix of types grows with wave)
function chooseEnemyType(waveIdx){
  // probabilities change as waves increase
  if(waveIdx <= 2){ // early waves: mostly runners and grunts
    const r = Math.random();
    return r < 0.55 ? 'runner' : 'grunt';
  } else if(waveIdx <= 4){ // introduce some tanks
    const r = Math.random();
    if(r < 0.35) return 'runner';
    if(r < 0.85) return 'grunt';
    return 'tank';
  } else { // later waves: more tanks and grunts
    const r = Math.random();
    if(r < 0.2) return 'runner';
    if(r < 0.7) return 'grunt';
    return 'tank';
  }
}

function spawnWave(idx){
  const base = state.level;
  const count = base.enemyCountBase + Math.floor(idx*1.5);
  for(let i=0;i<count;i++){
    setTimeout(()=>{
      const type = chooseEnemyType(idx);
      const tpl = ENEMY_TYPES[type];
      // hp scales with base hp, type multiplier and wave index
      const hp = Math.max(1, Math.floor(base.enemyBaseHp * tpl.hpMult * (1 + idx*0.18)));
      const speed = tpl.speed + (Math.random()*6 - 3); // small variance
      const reward = Math.max(1, Math.floor(tpl.reward * (1 + Math.floor(idx/2))));
      state.enemies.push(createEnemy(type, hp, speed, reward));
    }, i*700);
  }
  log('Vlna '+idx+' spuštìna ('+count+' nepøátel)');
}

function createEnemy(type, hp, speed, reward){
  const tpl = ENEMY_TYPES[type] || ENEMY_TYPES['grunt'];
  return {
    x: PATH[0].x,
    y: PATH[0].y,
    hp: hp,
    maxHp: hp,
    speed: speed,
    id: Math.random().toString(36).slice(2),
    pathIndex: 0,
    type: type,
    color: tpl.color,
    size: tpl.size,
    reward: reward,
    displayName: tpl.name
  };
}

function onCanvasMove(e){ const rect = canvas.getBoundingClientRect(); const mx = e.clientX - rect.left; const my = e.clientY - rect.top; hoverSpotIndex = -1; for(let i=0;i<SPOTS.length;i++){ const s = SPOTS[i]; const d = Math.hypot(mx-s.x,my-s.y); if(d <= s.r+6){ hoverSpotIndex = i; break; } } }

function onCanvasClick(e){ const rect = canvas.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top; if(!selectedTowerType){ log('Vyber typ vìže v dolním panelu.'); return; }
  // find clicked spot
  for(let i=0;i<SPOTS.length;i++){
    const s = SPOTS[i]; const d = Math.hypot(x-s.x,y-s.y);
    if(d <= s.r && !s.occupied){ const cfg = GAME_CONFIG.towers[selectedTowerType]; if(state.money < cfg.cost){ log('Nedostatek penìz'); return; } state.money -= cfg.cost; s.occupied = true; state.towers.push({type:selectedTowerType,x:s.x,y:s.y,cfg,spotIndex:i,lastShot:0}); updateUI(); log('Postavena vìž: '+selectedTowerType+' na spot '+i); return; }
  }
  log('Klikni na èerné místo pro postavení vìže.');
}

function loop(now){ const dt = now - state.lastTime; state.lastTime = now; update(dt); draw(); requestAnimationFrame(loop); }

function update(dt){ // update enemies along path
  for(const e of state.enemies){
    const targetPoint = PATH[e.pathIndex+1] || PATH[PATH.length-1];
    const dx = targetPoint.x - e.x; const dy = targetPoint.y - e.y; const dist = Math.hypot(dx,dy);
    if(dist < 2){ e.pathIndex++; } else { e.x += (dx/dist) * e.speed * dt/1000; e.y += (dy/dist) * e.speed * dt/1000; }
  }

  // remove enemies that reached end
  for(let i=state.enemies.length-1;i>=0;i--){ if(state.enemies[i].pathIndex >= PATH.length-1){ state.lives -= 1; state.enemies.splice(i,1); if(state.lives<=0){ log('Prohrál jsi'); resetLevel(); } updateUI(); } }

  // towers attack
  for(const t of state.towers){ t.lastShot += dt; const range = t.cfg.range; const rate = t.cfg.rate; if(t.lastShot >= rate){ // find target
      let target = null; let bestDist = Infinity;
      for(const e of state.enemies){ const dx = e.x - t.x; const dy = e.y - t.y; const dist = Math.hypot(dx,dy); if(dist <= range && dist < bestDist){ bestDist = dist; target = e; } }
      if(target){ t.lastShot = 0; if(t.cfg.aoe){ // AOE damage
          for(const e of state.enemies){ const dx=e.x-t.x; const dy=e.y-t.y; if(Math.hypot(dx,dy) <= (t.cfg.aoe + 0.0001)) e.hp -= t.cfg.dmg; }
        } else {
          target.hp -= t.cfg.dmg;
        }
      }
    }
  }

  // remove dead enemies and grant reward
  for(let i=state.enemies.length-1;i>=0;i--){ const e=state.enemies[i]; if(e.hp<=0){ state.money += e.reward || 10; state.enemies.splice(i,1); updateUI(); } }

  // wave end
  if(state.waveRunning && state.enemies.length===0){ state.waveRunning=false; log('Vlna '+state.waveIndex+' dokonèena'); if(state.waveIndex>=state.waveCount){ log('Level dokonèen!'); } }
}

function draw(){ // background - grass
  ctx.fillStyle = '#7bbf6b'; ctx.fillRect(0,0,canvas.width,canvas.height);

  // draw trees background decoration
  for(let x=40;x<canvas.width;x+=120){ for(let y=40;y<canvas.height;y+=120){ ctx.fillStyle='rgba(20,60,20,0.12)'; ctx.beginPath(); ctx.arc(x,y,22,0,Math.PI*2); ctx.fill(); } }

  // draw path as band along PATH points
  ctx.lineWidth = 56; ctx.lineJoin='round'; ctx.lineCap='round';
  // outer dark
  ctx.strokeStyle = '#8b5a2b'; ctx.beginPath(); ctx.moveTo(PATH[0].x,PATH[0].y); for(let i=1;i<PATH.length;i++) ctx.lineTo(PATH[i].x,PATH[i].y); ctx.stroke();
  // inner lighter
  ctx.lineWidth = 36; ctx.strokeStyle='#b8865b'; ctx.beginPath(); ctx.moveTo(PATH[0].x,PATH[0].y); for(let i=1;i<PATH.length;i++) ctx.lineTo(PATH[i].x,PATH[i].y); ctx.stroke();

  // draw spots (black places for towers)
  for(let i=0;i<SPOTS.length;i++){
    const s = SPOTS[i]; ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
    ctx.fillStyle = s.occupied ? '#222' : '#000'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = (i===hoverSpotIndex ? '#f6e58d' : '#333'); ctx.stroke();
  }

  // draw towers
  for(const t of state.towers){ drawTower(t); }

  // draw enemies
  for(const e of state.enemies){ drawEnemy(e); }

  // overlay: draw tower ranges when selected
  if(selectedTowerType && hoverSpotIndex>=0){ const s = SPOTS[hoverSpotIndex]; const cfg = GAME_CONFIG.towers[selectedTowerType]; ctx.beginPath(); ctx.arc(s.x,s.y,cfg.range,0,Math.PI*2); ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 2; ctx.stroke(); }
}

function drawTower(t){ ctx.save(); ctx.translate(t.x,t.y);
  if(t.type==='arrow'){ ctx.fillStyle='#2c7'; ctx.fillRect(-10,-10,20,20); ctx.fillStyle='#000'; ctx.fillText(t.cfg.cost, -10, 28);
  } else if(t.type==='magic'){ ctx.fillStyle='#8a2be2'; ctx.beginPath(); ctx.arc(0,0,12,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#000'; ctx.fillText(t.cfg.cost, -10, 28);
  } else if(t.type==='mortar'){ ctx.fillStyle='#b15a3a'; ctx.fillRect(-12,-8,24,16); ctx.fillStyle='#000'; ctx.fillText(t.cfg.cost, -14, 30);
  } else if(t.type==='knight'){ ctx.fillStyle='#777'; ctx.fillRect(-10,-14,20,28); ctx.fillStyle='#000'; ctx.fillText(t.cfg.cost, -12, 30);
  }
  ctx.restore();
}

function drawEnemy(e){ ctx.save(); ctx.translate(e.x,e.y); ctx.fillStyle = e.color || '#b00'; ctx.beginPath(); ctx.arc(0,0,e.size/2,0,Math.PI*2); ctx.fill(); // hp bar
  ctx.fillStyle='#222'; ctx.fillRect(-12,-14,24,4);
  ctx.fillStyle='#0f0'; ctx.fillRect(-12,-14,24*(Math.max(0,e.hp)/e.maxHp),4);
  ctx.restore(); }

init();

// Minimal tower defense prototype
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const levelSelect = document.getElementById('levelSelect');
const startWaveBtn = document.getElementById('startWave');
const moneyEl = document.getElementById('money');
const livesEl = document.getElementById('lives');
const waveEl = document.getElementById('wave');
const waveTotalEl = document.getElementById('waveTotal');
const logEl = document.getElementById('log');

const towerButtons = document.querySelectorAll('.tower-btn');
let selectedTowerType = null;

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
  towerButtons.forEach(b=>b.addEventListener('click', ()=>{ towerButtons.forEach(x=>x.classList.remove('selected')); b.classList.add('selected'); selectedTowerType = b.dataset.type; }));
  canvas.addEventListener('click', onCanvasClick);
  resetLevel();
  requestAnimationFrame(loop);
}

function resetLevel(){
  state.money = 200; state.lives = 20; state.waveIndex = 0; state.waveCount = state.level.waves; state.towers = []; state.enemies = []; state.waveRunning = false; updateUI(); log('Level '+state.level.name+' vybrán.');
}

function updateUI(){ moneyEl.textContent = state.money; livesEl.textContent = state.lives; waveEl.textContent = state.waveIndex; waveTotalEl.textContent = state.waveCount; }

function startNextWave(){ if(state.waveRunning) return; if(state.waveIndex>=state.waveCount){ log('Všechny vlny dokonèeny'); return; } state.waveIndex++; state.waveRunning=true; spawnWave(state.waveIndex); updateUI(); }

function spawnWave(idx){ const base = state.level; const count = base.enemyCountBase + Math.floor(idx*1.5); const hp = Math.floor(base.enemyBaseHp * (1 + idx*0.12)); for(let i=0;i<count;i++){ setTimeout(()=>{ state.enemies.push(createEnemy(hp)); }, i*800); } log('Vlna '+idx+' spuštìna ('+count+' nepøátel)'); }

function createEnemy(hp){ return { x: -20, y: 60 + Math.random()*360, hp: hp, maxHp:hp, speed: 20 + Math.random()*30, id: Math.random().toString(36).slice(2) }; }

function onCanvasClick(e){ const rect = canvas.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top; if(selectedTowerType){ const cfg = GAME_CONFIG.towers[selectedTowerType]; if(state.money < cfg.cost){ log('Nedostatek penìz'); return; } state.money -= cfg.cost; state.towers.push({type:selectedTowerType,x,y, cfg, lastShot:0}); updateUI(); log('Postavena vìž: '+selectedTowerType); } }

function loop(now){ const dt = now - state.lastTime; state.lastTime = now; update(dt); draw(); requestAnimationFrame(loop); }

function update(dt){ // update enemies
  for(const e of state.enemies){ e.x += (e.speed * dt/1000); }
  // simple path end check
  for(let i=state.enemies.length-1;i>=0;i--){ if(state.enemies[i].x > canvas.width + 20){ state.lives -= 1; state.enemies.splice(i,1); if(state.lives<=0){ log('Prohrál jsi'); resetLevel(); } updateUI(); } }

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

  // remove dead enemies
  for(let i=state.enemies.length-1;i>=0;i--){ const e=state.enemies[i]; if(e.hp<=0){ state.money += 10; state.enemies.splice(i,1); updateUI(); } }

  // wave end
  if(state.waveRunning && state.enemies.length===0){ state.waveRunning=false; log('Vlna '+state.waveIndex+' dokonèena'); if(state.waveIndex>=state.waveCount){ log('Level dokonèen!'); } }
}

function draw(){ ctx.clearRect(0,0,canvas.width,canvas.height); // draw path
  ctx.fillStyle='#e6e6e6'; ctx.fillRect(0,0,canvas.width,canvas.height);
  // draw towers
  for(const t of state.towers){ drawTower(t); }
  // draw enemies
  for(const e of state.enemies){ drawEnemy(e); }
}

function drawTower(t){ ctx.fillStyle='#333'; ctx.beginPath(); if(t.type==='arrow'){ ctx.fillStyle='#2c7'; ctx.fillRect(t.x-10,t.y-10,20,20); } else if(t.type==='magic'){ ctx.fillStyle='#8a2be2'; ctx.beginPath(); ctx.arc(t.x,t.y,12,0,Math.PI*2); ctx.fill(); } else if(t.type==='mortar'){ ctx.fillStyle='#b15a3a'; ctx.fillRect(t.x-12,t.y-8,24,16); } else if(t.type==='knight'){ ctx.fillStyle='#777'; ctx.fillRect(t.x-10,t.y-14,20,28); }
}

function drawEnemy(e){ ctx.fillStyle='#b00'; ctx.fillRect(e.x-10,e.y-10,20,20); // hp bar
  ctx.fillStyle='#222'; ctx.fillRect(e.x-12,e.y-14,24,4);
  ctx.fillStyle='#0f0'; ctx.fillRect(e.x-12,e.y-14,24*(e.hp/e.maxHp),4);
}

init();

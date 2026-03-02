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
    arrow: { cost:50, range:120, dmg:8, rate:300, projectileSpeed:500, splash:0, color:'#2c7' },
    magic: { cost:80, range:110, dmg:14, rate:900, projectileSpeed:240, splash:28, color:'#8a2be2' },
    mortar: { cost:100, range:160, dmg:26, rate:1600, projectileSpeed:140, splash:48, color:'#b15a3a' },
    laser: { cost:120, range:200, dmg:36, rate:2200, projectileSpeed:380, splash:0, color:'#46f0ff' }
  }
};

// enemy type templates
const ENEMY_TYPES = {
  runner: { speed: 80, hpMult: 0.6, reward: 5, color: '#ffcc00', size: 12, name: 'Rychlý' },
  grunt:  { speed: 40, hpMult: 1.0, reward: 10, color: '#b00',     size: 12, name: 'Normální' },
  tank:   { speed: 20, hpMult: 2.4, reward: 20, color: '#400',     size: 18, name: 'Tank' }
};

// path defined as points to follow
const PATH = [ {x:-20,y:240}, {x:150,y:240}, {x:150,y:120}, {x:350,y:120}, {x:350,y:360}, {x:650,y:360}, {x:650,y:200}, {x:900,y:200} ];

// spots will be generated around path
let SPOTS = [];

let state = {
  money: 200,
  lives: 20,
  level: GAME_CONFIG.levels[0],
  waveIndex: 0,
  waveCount: 0,
  towers: [],
  enemies: [],
  projectiles: [],
  lastTime: performance.now(),
  waveRunning: false
};

function log(text){ const el = document.createElement('div'); el.textContent = text; logEl.prepend(el); }

function generateSpots(){
  SPOTS = [];
  const minSpacing = 60; // minimum distance between spots
  const offsets = [60, -60, 100, -100];
  for(let i=0;i<PATH.length-1;i++){
    const a = PATH[i], b = PATH[i+1];
    const dx = b.x - a.x, dy = b.y - a.y; const segLen = Math.hypot(dx,dy);
    const segCount = Math.max(1, Math.floor(segLen / 140));
    const nx = -dy / segLen, ny = dx / segLen; // normal
    for(let s=0;s<=segCount;s++){
      const t = s/segCount;
      const px = a.x + dx * t; const py = a.y + dy * t;
      for(const off of offsets){
        const ox = px + nx * off + (Math.random()*10-5);
        const oy = py + ny * off + (Math.random()*10-5);
        // keep inside canvas bounds with margin
        if(ox < 30 || oy < 30 || ox > canvas.width-30 || oy > canvas.height-30) continue;
        // ensure not too close to existing spots
        let ok = true;
        for(const spt of SPOTS){ if(Math.hypot(spt.x-ox,spt.y-oy) < minSpacing) { ok=false; break; } }
        if(ok) SPOTS.push({x:Math.round(ox), y:Math.round(oy), r:22, occupied:false});
      }
    }
  }
  // add a few random near path nodes
  for(let i=1;i<PATH.length-1;i++){
    if(Math.random()<0.6){ const p=PATH[i]; const ox=p.x + (Math.random()*2-1)*80; const oy=p.y + (Math.random()*2-1)*80; if(ox>30 && oy>30 && ox<canvas.width-30 && oy<canvas.height-30) SPOTS.push({x:Math.round(ox),y:Math.round(oy),r:22,occupied:false}); }
  }
}

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
  state.money = 200; state.lives = 20; state.waveIndex = 0; state.waveCount = state.level.waves; state.towers = []; state.enemies = []; state.projectiles = []; state.waveRunning = false;
  generateSpots();
  updateUI(); log('Level '+state.level.name+' vybrán.');
}

function updateUI(){ moneyEl.textContent = state.money; livesEl.textContent = state.lives; waveEl.textContent = state.waveIndex; waveTotalEl.textContent = state.waveCount; hudMoney.textContent = state.money; hudWave.textContent = state.waveIndex; hudWaveTotal.textContent = state.waveCount; hudLives.textContent = state.lives; }

function startNextWave(){ if(state.waveRunning) return; if(state.waveIndex>=state.waveCount){ log('Všechny vlny dokonèeny'); return; } state.waveIndex++; state.waveRunning=true; spawnWave(state.waveIndex); updateUI(); }

// choose enemy type for a given wave index (mix of types grows with wave)
function chooseEnemyType(waveIdx){
  if(waveIdx <= 2){ const r=Math.random(); return r<0.55?'runner':'grunt'; }
  else if(waveIdx <= 4){ const r=Math.random(); if(r<0.35) return 'runner'; if(r<0.85) return 'grunt'; return 'tank'; }
  else { const r=Math.random(); if(r<0.2) return 'runner'; if(r<0.7) return 'grunt'; return 'tank'; }
}

function spawnWave(idx){
  const base = state.level;
  const count = base.enemyCountBase + Math.floor(idx*1.5);
  for(let i=0;i<count;i++){
    setTimeout(()=>{
      const type = chooseEnemyType(idx);
      const tpl = ENEMY_TYPES[type];
      const hp = Math.max(1, Math.floor(base.enemyBaseHp * tpl.hpMult * (1 + idx*0.18)));
      const speed = tpl.speed + (Math.random()*6 - 3);
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

function onCanvasClick(e){ const rect = canvas.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top; // first check if click on existing tower -> upgrade
  for(let ti=0;ti<state.towers.length;ti++){ const t = state.towers[ti]; const d = Math.hypot(x-t.x,y-t.y); if(d <= 18){ // upgrade interaction if no tower type selected
      if(selectedTowerType){ break; } // ignore if building currently
      const upgradeCost = Math.floor((t.cfg.cost||50) * (1 + (t.level||1) * 0.7));
      if(state.money < upgradeCost){ log('Nedostatek penìz na upgrade. Cena: '+upgradeCost); return; }
      if(confirm('Chcete upgradovat vìž? Cena: '+upgradeCost)){
        state.money -= upgradeCost;
        // apply upgrade: increase damage, range, faster rate and projectile speed
        t.level = (t.level||1) + 1;
        t.cfg.dmg = Math.ceil(t.cfg.dmg * 1.35);
        t.cfg.range = Math.ceil(t.cfg.range * 1.12);
        t.cfg.rate = Math.max(60, Math.floor(t.cfg.rate * 0.88));
        t.cfg.projectileSpeed = Math.ceil(t.cfg.projectileSpeed * 1.08);
        // laser special: keep single bounce
        if(t.type==='laser') t.bounceLimit = 1;
        log('Vìž upgradována na úroveò '+t.level);
        updateUI();
      }
      return;
    } }

  // not clicking on a tower -> try place tower on spot
  if(!selectedTowerType){ log('Vyber typ vìže v dolním panelu.'); return; }
  for(let i=0;i<SPOTS.length;i++){
    const s = SPOTS[i]; const d = Math.hypot(x-s.x,y-s.y);
    if(d <= s.r && !s.occupied){ const cfg = GAME_CONFIG.towers[selectedTowerType]; if(state.money < cfg.cost){ log('Nedostatek penìz'); return; } state.money -= cfg.cost; s.occupied = true; const newTower = {type:selectedTowerType,x:s.x,y:s.y,cfg:JSON.parse(JSON.stringify(cfg)),spotIndex:i,lastShot:0,level:1};
      // laser tower initial bounce limit set to single bounce
      if(newTower.type==='laser') newTower.bounceLimit = 1;
      state.towers.push(newTower); updateUI(); log('Postavena vìž: '+selectedTowerType+' na spot '+i); return; }
  }
  log('Klikni na èerné místo pro postavení vìže.');
}

function loop(now){ const dt = now - state.lastTime; state.lastTime = now; update(dt); draw(); requestAnimationFrame(loop); }

function findEnemyById(id){ for(const e of state.enemies) if(e.id===id) return e; return null; }

function update(dt){ // update enemies along path
  for(const e of state.enemies){
    const targetPoint = PATH[e.pathIndex+1] || PATH[PATH.length-1];
    const dx = targetPoint.x - e.x; const dy = targetPoint.y - e.y; const dist = Math.hypot(dx,dy);
    if(dist < 2){ e.pathIndex++; } else { e.x += (dx/dist) * e.speed * dt/1000; e.y += (dy/dist) * e.speed * dt/1000; }
  }

  // remove enemies that reached end
  for(let i=state.enemies.length-1;i>=0;i--){ if(state.enemies[i].pathIndex >= PATH.length-1){ state.lives -= 1; state.enemies.splice(i,1); if(state.lives<=0){ log('Prohrál jsi'); resetLevel(); } updateUI(); } }

  // towers attack -> spawn projectiles instead of instant damage
  for(const t of state.towers){ t.lastShot += dt; const range = t.cfg.range; const rate = t.cfg.rate; if(t.lastShot >= rate){
      let target = null; let bestDist = Infinity;
      for(const e of state.enemies){ const dx = e.x - t.x; const dy = e.y - t.y; const dist = Math.hypot(dx,dy); if(dist <= range && dist < bestDist){ bestDist = dist; target = e; } }
      if(target){ t.lastShot = 0;
        // create projectile
        const proj = {
          x: t.x,
          y: t.y,
          targetId: target.id,
          speed: t.cfg.projectileSpeed,
          dmg: t.cfg.dmg,
          splash: t.cfg.splash || 0,
          color: t.cfg.color || '#000',
          radius: (t.type==='mortar'?6:4),
          ownerType: t.type
        };
        if(t.type==='laser'){
          proj.bouncesLeft = t.bounceLimit || 1;
          proj.bounceRange = 260; // how far it can jump
        }
        state.projectiles.push(proj);
      }
    }
  }

  // update projectiles
  for(let i=state.projectiles.length-1;i>=0;i--){ const p = state.projectiles[i]; const target = findEnemyById(p.targetId); if(!target){ state.projectiles.splice(i,1); continue; }
    const dx = target.x - p.x; const dy = target.y - p.y; const dist = Math.hypot(dx,dy);
    if(dist <= (target.size/2 + p.radius) ){
      // hit
      if(p.ownerType==='laser'){
        // laser: apply damage and try to bounce to next enemy (only one bounce allowed)
        target.hp -= p.dmg;
        p.bouncesLeft = Math.max(0, (p.bouncesLeft||0) - 1);
        if(p.bouncesLeft > 0){
          // find nearest enemy not the same as target within bounceRange
          let next = null; let best = Infinity;
          for(const e of state.enemies){ if(e.id===target.id) continue; const dd = Math.hypot(e.x - p.x, e.y - p.y); if(dd < best && dd <= p.bounceRange){ best = dd; next = e; } }
          if(next){ p.targetId = next.id; // continue traveling
            // move a bit towards new target immediately
            continue;
          }
        }
        // no more bounces -> remove projectile
        state.projectiles.splice(i,1);
        continue;
      }

      // non-laser: normal hit
      if(p.splash && p.splash>0){ // apply splash damage
        for(const e of state.enemies){ const dd = Math.hypot(e.x - p.x, e.y - p.y); if(dd <= p.splash){ e.hp -= p.dmg; } }
      } else {
        target.hp -= p.dmg;
      }
      // remove projectile
      state.projectiles.splice(i,1);
      continue;
    }
    // move towards target
    const nx = dx/dist, ny = dy/dist;
    p.x += nx * p.speed * dt/1000; p.y += ny * p.speed * dt/1000;
    // safety: remove if offscreen
    if(p.x < -50 || p.x > canvas.width+50 || p.y < -50 || p.y > canvas.height+50) state.projectiles.splice(i,1);
  }

  // remove dead enemies and grant reward
  for(let i=state.enemies.length-1;i>=0;i--){ const e=state.enemies[i]; if(e.hp<=0){ state.money += e.reward || 10; state.enemies.splice(i,1); updateUI(); } }

  // wave end
  if(state.waveRunning && state.enemies.length===0 && state.projectiles.length===0){ state.waveRunning=false; log('Vlna '+state.waveIndex+' dokonèena'); if(state.waveIndex>=state.waveCount){ log('Level dokonèen!'); } }
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

  // draw projectiles
  for(const p of state.projectiles){ if(p.ownerType==='laser'){
      // laser visual: bright core + thin trail
      ctx.beginPath(); ctx.fillStyle = p.color; ctx.arc(p.x,p.y,p.radius+1,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.strokeStyle = 'rgba(70,240,255,0.35)'; ctx.lineWidth = 2; ctx.moveTo(p.x, p.y); // short trail in direction of velocity
      // approximate previous position by moving opposite of target vector
      const target = findEnemyById(p.targetId);
      if(target){ const dx = target.x - p.x, dy = target.y - p.y, d = Math.hypot(dx,dy); if(d>0){ ctx.lineTo(p.x - dx/d*8, p.y - dy/d*8); ctx.stroke(); } }
      // show remaining bounces small text
      ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.font='10px Arial'; ctx.fillText((p.bouncesLeft||0), p.x+6, p.y-6);
      if(p.splash && p.splash>0){ ctx.beginPath(); ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 1; ctx.arc(p.x,p.y,p.splash,0,Math.PI*2); ctx.stroke(); }
    } else {
      ctx.beginPath(); ctx.fillStyle = p.color; ctx.arc(p.x,p.y,p.radius,0,Math.PI*2); ctx.fill();
      if(p.splash && p.splash>0){ ctx.beginPath(); ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 1; ctx.arc(p.x,p.y,p.splash,0,Math.PI*2); ctx.stroke(); }
    } }

  // overlay: draw tower ranges when selected
  if(selectedTowerType && hoverSpotIndex>=0){ const s = SPOTS[hoverSpotIndex]; const cfg = GAME_CONFIG.towers[selectedTowerType]; ctx.beginPath(); ctx.arc(s.x,s.y,cfg.range,0,Math.PI*2); ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 2; ctx.stroke(); }
}

function drawTower(t){ ctx.save(); ctx.translate(t.x,t.y);
  // show base icon and level
  ctx.fillStyle = t.cfg.color || '#2c7';
  if(t.type==='arrow'){ ctx.fillRect(-10,-10,20,20); }
  else if(t.type==='magic'){ ctx.beginPath(); ctx.arc(0,0,12,0,Math.PI*2); ctx.fill(); }
  else if(t.type==='mortar'){ ctx.fillRect(-12,-8,24,16); }
  else if(t.type==='laser'){ // laser tower looks like a tall emitter
    ctx.fillStyle = '#aeefff'; ctx.fillRect(-8,-14,16,28); ctx.fillStyle = t.cfg.color; ctx.fillRect(-6,-12,12,24);
  }
  ctx.fillStyle='#000'; ctx.font='11px Arial'; ctx.fillText('Lv'+(t.level||1), -14, -16);
  ctx.restore();
}

function drawEnemy(e){ ctx.save(); ctx.translate(e.x,e.y); ctx.fillStyle = e.color || '#b00'; ctx.beginPath(); ctx.arc(0,0,e.size/2,0,Math.PI*2); ctx.fill(); // hp bar
  ctx.fillStyle='#222'; ctx.fillRect(-12,-14,24,4);
  ctx.fillStyle='#0f0'; ctx.fillRect(-12,-14,24*(Math.max(0,e.hp)/e.maxHp),4);
  ctx.restore(); }

init();

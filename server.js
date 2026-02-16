const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const SCORES_FILE = path.join(DATA_DIR, 'scores.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
// ensure scores file exists
if (!fs.existsSync(SCORES_FILE)) fs.writeFileSync(SCORES_FILE, JSON.stringify({ scores: [] }, null, 2));

app.use(express.json());
// serve static files from project root
app.use(express.static(path.join(__dirname)));

app.get('/api/scores', (req, res) => {
  const limit = parseInt(req.query.limit || '10', 10);
  fs.readFile(SCORES_FILE, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'read error' });
    try{
      const obj = JSON.parse(data);
      const rows = (obj.scores || []).slice().sort((a,b)=>b.score - a.score).slice(0, limit);
      res.json(rows);
    }catch(e){ res.status(500).json({ error: 'parse error' }); }
  });
});

app.post('/api/scores', (req, res) => {
  const { name, score } = req.body || {};
  if (!name || typeof score !== 'number') return res.status(400).json({ error: 'invalid body' });
  fs.readFile(SCORES_FILE, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'read error' });
    try{
      const obj = JSON.parse(data);
      const id = Date.now();
      const entry = { id, name, score, created_at: new Date().toISOString() };
      obj.scores = obj.scores || [];
      obj.scores.push(entry);
      fs.writeFile(SCORES_FILE, JSON.stringify(obj, null, 2), (err2) => {
        if (err2) return res.status(500).json({ error: 'write error' });
        res.json({ id });
      });
    }catch(e){ res.status(500).json({ error: 'parse error' }); }
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

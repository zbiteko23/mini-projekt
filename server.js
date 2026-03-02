const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'scores.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new sqlite3.Database(DB_FILE);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game TEXT NOT NULL,
    name TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

app.use(express.json());
// serve static files from project root
app.use(express.static(path.join(__dirname)));

app.get('/api/scores', (req, res) => {
  const game = req.query.game || 'had';
  const limit = parseInt(req.query.limit || '10', 10);
  db.all('SELECT name, score, created_at FROM scores WHERE game = ? ORDER BY score DESC, created_at ASC LIMIT ?', [game, limit], (err, rows) => {
    if (err) return res.status(500).json({ error: 'db error' });
    res.json(rows);
  });
});

app.post('/api/scores', (req, res) => {
  const { game, name, score } = req.body || {};
  if (!game || !name || typeof score !== 'number') return res.status(400).json({ error: 'invalid body' });
  db.run('INSERT INTO scores (game, name, score) VALUES (?,?,?)', [game, name, score], function(err) {
    if (err) return res.status(500).json({ error: 'db error' });
    res.json({ id: this.lastID });
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

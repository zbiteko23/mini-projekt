const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase client (server-side with service role key for admin operations)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ─── Auth middleware ───────────────────────────────────────────────────────────
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  req.user = user;
  next();
}

// ─── Auth routes ──────────────────────────────────────────────────────────────

// Register
app.post('/api/auth/register', async (req, res) => {
  const { email, password, username } = req.body || {};
  if (!email || !password || !username)
    return res.status(400).json({ error: 'email, password a username jsou povinné' });

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { username },
    email_confirm: true   // skip email confirmation for simplicity
  });

  if (error) return res.status(400).json({ error: error.message });

  // Sign in immediately to get a session token
  const { data: session, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signInErr) return res.status(500).json({ error: signInErr.message });

  res.json({
    user: { id: data.user.id, email: data.user.email, username },
    access_token: session.session.access_token
  });
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'email a password jsou povinné' });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });

  const username = data.user.user_metadata?.username || data.user.email;
  res.json({
    user: { id: data.user.id, email: data.user.email, username },
    access_token: data.session.access_token
  });
});

// Logout (client-side token invalidation is enough, but we can revoke server-side)
app.post('/api/auth/logout', requireAuth, async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  await supabase.auth.admin.signOut(token);
  res.json({ message: 'Odhlášení úspěšné' });
});

// Get current user info
app.get('/api/auth/me', requireAuth, (req, res) => {
  const username = req.user.user_metadata?.username || req.user.email;
  res.json({ id: req.user.id, email: req.user.email, username });
});

// ─── Scores routes ────────────────────────────────────────────────────────────

app.get('/api/scores', async (req, res) => {
  const game = req.query.game || 'had';
  const limit = parseInt(req.query.limit || '10', 10);

  const { data, error } = await supabase
    .from('scores')
    .select('name, score, created_at')
    .eq('game', game)
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) return res.status(500).json({ error: 'db error' });
  res.json(data);
});

app.post('/api/scores', requireAuth, async (req, res) => {
  const { game, score } = req.body || {};
  if (!game || typeof score !== 'number')
    return res.status(400).json({ error: 'invalid body' });

  const username = req.user.user_metadata?.username || req.user.email;

  const { data, error } = await supabase
    .from('scores')
    .insert({ game, name: username, score, user_id: req.user.id })
    .select('id')
    .single();

  if (error) return res.status(500).json({ error: 'db error' });
  res.json({ id: data.id });
});

app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));

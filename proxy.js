const express    = require('express');
const session    = require('express-session');
const Anthropic  = require('@anthropic-ai/sdk');
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Env checks ──────────────────────────────────────────────
const apiKey     = process.env.ANTHROPIC_API_KEY;
const sitePass   = process.env.SITE_PASSWORD;
const sessionKey = process.env.SESSION_SECRET || 'change-me-in-production';

if (!apiKey)   { console.error('❌  Missing ANTHROPIC_API_KEY'); process.exit(1); }
if (!sitePass) { console.error('❌  Missing SITE_PASSWORD');     process.exit(1); }

const client = new Anthropic({ apiKey });

// ── Middleware ───────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);
app.use(session({
  secret: sessionKey,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 8 * 60 * 60 * 1000,
    secure: true,
    sameSite: 'lax'
  }
}));

// ── Auth helpers ─────────────────────────────────────────────
const isLoggedIn = (req) => req.session?.auth === true;

const requireAuth = (req, res, next) => {
  if (isLoggedIn(req)) return next();
  res.redirect('/login');
};

// ── Login page ───────────────────────────────────────────────
app.get('/login', (req, res) => {
  if (isLoggedIn(req)) return res.redirect('/');
  const err = req.query.err ? '<p style="color:#ef4444;font-size:.85rem;margin:0 0 12px">Incorrect password — try again</p>' : '';
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>HR Outreach Hub — Login</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',system-ui,sans-serif;background:#0f172a;min-height:100vh;display:flex;align-items:center;justify-content:center}
    .card{background:#fff;border-radius:16px;padding:36px 32px;width:min(360px,90vw);box-shadow:0 20px 60px rgba(0,0,0,.4)}
    h1{font-size:1.2rem;font-weight:700;color:#0f172a;margin-bottom:4px}
    .sub{font-size:.78rem;color:#64748b;margin-bottom:24px}
    label{display:block;font-size:.72rem;font-weight:600;color:#64748b;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px}
    input[type=password]{width:100%;padding:10px 13px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:.9rem;outline:none;margin-bottom:14px;transition:border-color .2s}
    input[type=password]:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12)}
    button{width:100%;padding:12px;background:#0f172a;color:#fff;border:none;border-radius:8px;font-size:.92rem;font-weight:700;cursor:pointer;transition:background .2s}
    button:hover{background:#2563eb}
  </style>
</head>
<body>
  <div class="card">
    <h1>HR Outreach Hub</h1>
    <p class="sub">BCA College · T&amp;P Dashboard · Bangalore 2026</p>
    ${err}
    <form method="POST" action="/login">
      <label>Password</label>
      <input type="password" name="password" placeholder="Enter site password" autofocus>
      <button type="submit">Unlock →</button>
    </form>
  </div>
</body>
</html>`);
});

app.post('/login', (req, res) => {
  if (req.body.password === sitePass) {
    req.session.auth = true;
    return res.redirect('/');
  }
  res.redirect('/login?err=1');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ── Protected static files ───────────────────────────────────
app.use(requireAuth, express.static(path.join(__dirname)));

// ── Anthropic proxy (protected) ──────────────────────────────
app.post('/api/messages', requireAuth, async (req, res) => {
  try {
    const { model, max_tokens, system, messages, mcp_servers } = req.body;
    const params = {
      model:      model      || 'claude-sonnet-4-20250514',
      max_tokens: max_tokens || 4000,
      messages,
    };
    if (system)      params.system      = system;
    if (mcp_servers) params.mcp_servers = mcp_servers;

 const response = await client.messages.create(params, {
  headers: {
    'anthropic-beta': 'mcp-client-2025-04-04'
  }
});
    res.json(response);
  } catch (err) {
    console.error('Anthropic API error:', err.message);
    res.status(err.status || 500).json({ error: { message: err.message } });
  }
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  HR Outreach Hub running at http://localhost:${PORT}`);
});

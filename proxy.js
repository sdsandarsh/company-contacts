const express    = require('express');
const session    = require('express-session');
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Env checks ──────────────────────────────────────────────
const sitePass      = process.env.SITE_PASSWORD;
const sessionKey    = process.env.SESSION_SECRET || 'change-me-in-production';
const fullEnrichKey = process.env.FULLENRICH_API_KEY || null;

if (!sitePass) { console.error('❌  Missing SITE_PASSWORD'); process.exit(1); }
if (!fullEnrichKey) console.warn('⚠️   FULLENRICH_API_KEY not set — enrichment will be skipped');

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
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: { message: 'Session expired — please refresh and log in again.' } });
  }
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

// ── FullEnrich proxy (protected) ─────────────────────────────
// Accepts: { contacts: [{ firstname, lastname, company_name, domain, linkedin_url }] }
// Returns: enriched contacts with verified emails + phones
app.post('/api/enrich', requireAuth, async (req, res) => {
  if (!fullEnrichKey) {
    return res.status(503).json({ error: { message: 'FullEnrich API key not configured on server.' } });
  }

  const { contacts } = req.body;
  if (!contacts || !contacts.length) {
    return res.status(400).json({ error: { message: 'No contacts provided.' } });
  }

  try {
    // Step 1 — Start bulk enrichment
    const startResp = await fetch('https://app.fullenrich.com/api/v1/contact/enrich/bulk', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${fullEnrichKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `HR Outreach Hub — ${new Date().toISOString()}`,
        datas: contacts.map(c => ({
          firstname:    c.firstname    || '',
          lastname:     c.lastname     || '',
          company_name: c.company_name || '',
          domain:       c.domain       || '',
          linkedin_url: c.linkedin_url || '',
          enrich_fields: ['contact.emails', 'contact.phones']
        }))
      })
    });

    if (!startResp.ok) {
      const errText = await startResp.text();
      throw new Error(`FullEnrich error ${startResp.status}: ${errText}`);
    }

    const startData = await startResp.json();
    const enrichmentId = startData?.id;
    if (!enrichmentId) throw new Error('No enrichment ID returned from FullEnrich');

    // Step 2 — Poll until done (max 30s)
    const maxAttempts = 15;
    const delay = ms => new Promise(r => setTimeout(r, ms));

    for (let i = 0; i < maxAttempts; i++) {
      await delay(2000);
      const pollResp = await fetch(`https://app.fullenrich.com/api/v1/contact/enrich/bulk/${enrichmentId}`, {
        headers: { 'Authorization': `Bearer ${fullEnrichKey}` }
      });

      if (!pollResp.ok) continue;
      const pollData = await pollResp.json();

      if (pollData?.status === 'done') {
        return res.json({ results: pollData.datas || [] });
      }
    }

    // Timed out — return empty so UI degrades gracefully
    return res.json({ results: [], warning: 'FullEnrich timed out — try again shortly.' });

  } catch (err) {
    console.error('FullEnrich error:', err.message);
    res.status(500).json({ error: { message: err.message } });
  }
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  HR Outreach Hub running at http://localhost:${PORT}`);
});

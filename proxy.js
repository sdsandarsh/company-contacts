const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Load API key from environment variable
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('❌  Missing ANTHROPIC_API_KEY in environment.');
  console.error('    Set it before running: export ANTHROPIC_API_KEY=sk-ant-...');
  process.exit(1);
}

const client = new Anthropic({ apiKey });

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Serve the HTML file at /
app.use(express.static(path.join(__dirname, 'public')));

// Proxy endpoint — forwards requests to Anthropic
app.post('/api/messages', async (req, res) => {
  try {
    const { model, max_tokens, system, messages, mcp_servers } = req.body;

    const params = {
      model: model || 'claude-sonnet-4-20250514',
      max_tokens: max_tokens || 4000,
      messages,
    };
    if (system)      params.system = system;
    if (mcp_servers) params.mcp_servers = mcp_servers;

    const response = await client.messages.create(params);
    res.json(response);
  } catch (err) {
    console.error('Anthropic API error:', err.message);
    res.status(err.status || 500).json({
      error: { message: err.message || 'Internal server error' }
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅  HR Outreach Hub running at http://localhost:${PORT}`);
  console.log(`    Open http://localhost:${PORT} in your browser`);
});

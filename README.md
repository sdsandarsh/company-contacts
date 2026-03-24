# HR Outreach Hub — Bangalore 2026

A Training & Placement dashboard for BCA colleges to find and track HR contacts at Bangalore companies. Powered by Claude AI + Vibe Prospecting MCP.

## Features

- **HR Tracker** — 12 pre-loaded HR contacts with status tracking (Pending / Contacted / Replied)
- **Claude AI Search** — paste company names, Claude finds HR contacts via Vibe Prospecting
- **Company Scout** — discover careers pages, emails, and LinkedIn profiles
- **Export** — download contacts as `.xlsx` or copy directly into Excel

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/hr-outreach-hub.git
cd hr-outreach-hub
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set your environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in all three values:

```
ANTHROPIC_API_KEY=sk-ant-api03-...
SITE_PASSWORD=your-strong-password-here
SESSION_SECRET=any-long-random-string
```

- Get your Anthropic key at [console.anthropic.com](https://console.anthropic.com) → API Keys → Create Key
- `SITE_PASSWORD` is what you'll enter to log in to the app
- `SESSION_SECRET` can be any random string — keeps sessions secure

### 4. Run the server

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```
hr-outreach-hub/
├── proxy.js          # Express server — proxies requests to Anthropic API
├── package.json
├── .env.example      # Copy to .env and add your API key
├── .gitignore        # node_modules and .env are excluded
└── public/
    └── index.html    # The full HR Outreach Hub app
```

---

## Security

- Your API key lives only in `.env` on your machine — never in the HTML
- `.env` is in `.gitignore` so it will never be committed to GitHub
- The proxy runs locally; no data leaves your machine except to Anthropic's API

---

## Passkeys

| Screen | Code |
|--------|------|
| Dashboard unlock | `7002` |
| Admin panel | `1995` |

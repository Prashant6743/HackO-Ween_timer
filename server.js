const express = require('express');
const path = require('path');
const timeHandler = require('./api/time');
const breakHandler = require('./api/break');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies for POST requests
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

/**
 * API: Return authoritative server time in ISO 8601 format (UTC).
 * Uses the shared handler in ./api/time.js (which also powers Vercel serverless deployment)
 */
app.get('/api/time', (req, res) => {
  timeHandler(req, res);
});

/**
 * API: Food/Dinner Break state handler (GET and POST)
 */
app.all('/api/break', (req, res) => {
  breakHandler(req, res);
});

/**
 * Route: Controller Dashboard (/ud and /admin)
 */
app.get('/ud', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ud.html'));
});

app.get('/admin', (req, res) => {
  res.redirect('/ud');
});

// Fallback: serve index.html for any unmatched routes (SPA support)
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Run server locally
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n🎃 HackO'Ween server running at http://localhost:${PORT}`);
    console.log(`   Server time API: http://localhost:${PORT}/api/time`);
    console.log(`   Press Ctrl+C to stop.\n`);
  });
}

module.exports = app;

import express from 'express';
import cors from 'cors';
import { execSync } from 'child_process';

const app = express();
const PORT = 3100;

// Only allow requests from Tailscale network and Netlify
app.use(cors({
  origin: [
    'https://coreconx-mission-control.netlify.app',
    /^http:\/\/100\.\d+\.\d+\.\d+/,
    'http://localhost:3000',
  ],
  credentials: true,
}));

app.use(express.json());

// Auth middleware — simple bearer token
const API_TOKEN = process.env.MC_API_TOKEN || 'coreconx-mc-2026';
app.use('/api', (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${API_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Helper: run gog command and return output
function gog(args) {
  try {
    const result = execSync(`/opt/homebrew/bin/gog -a chuck@coreconx.group ${args}`, {
      timeout: 30000,
      encoding: 'utf-8',
      env: { ...process.env, PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' },
    });
    return result.trim();
  } catch (e) {
    console.error(`gog error: ${e.message}`);
    return null;
  }
}

// Helper: run curl for Linear API
function linearQuery(query) {
  try {
    const result = execSync(`curl -s -X POST https://api.linear.app/graphql -H "Authorization: ${process.env.LINEAR_API_KEY}" -H "Content-Type: application/json" -d '${JSON.stringify({ query }).replace(/'/g, "'\\''")}'`, {
      timeout: 15000,
      encoding: 'utf-8',
      env: { ...process.env, PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' },
    });
    return JSON.parse(result);
  } catch (e) {
    console.error(`Linear error: ${e.message}`);
    return null;
  }
}

// ==================== CRM (Google Sheets) ====================

app.get('/api/crm/companies', (req, res) => {
  const sheetId = '1arbZpTV9DSVS8w-4FA8XhV59x_DWxpGIP1dI5vxX3ak';
  const raw = gog(`sheets get ${sheetId} "Companies!A1:Z100" -p`);
  if (!raw) return res.status(500).json({ error: 'Failed to fetch CRM data' });

  const lines = raw.split('\n').filter(l => l.trim());
  if (lines.length < 2) return res.json([]);

  const headers = lines[0].split('\t');
  const companies = lines.slice(1).map(line => {
    const cols = line.split('\t');
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (cols[i] || '').trim(); });
    return obj;
  });

  res.json(companies);
});

app.get('/api/crm/contacts', (req, res) => {
  const sheetId = '1arbZpTV9DSVS8w-4FA8XhV59x_DWxpGIP1dI5vxX3ak';
  const raw = gog(`sheets get ${sheetId} "Contacts!A1:Z100" -p`);
  if (!raw) return res.status(500).json({ error: 'Failed to fetch contacts' });

  const lines = raw.split('\n').filter(l => l.trim());
  if (lines.length < 2) return res.json([]);

  const headers = lines[0].split('\t');
  const contacts = lines.slice(1).map(line => {
    const cols = line.split('\t');
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (cols[i] || '').trim(); });
    return obj;
  });

  res.json(contacts);
});

app.get('/api/crm/pipeline', (req, res) => {
  const sheetId = '1arbZpTV9DSVS8w-4FA8XhV59x_DWxpGIP1dI5vxX3ak';
  const raw = gog(`sheets get ${sheetId} "Pipeline!A1:Z100" -p`);
  if (!raw) return res.status(500).json({ error: 'Failed to fetch pipeline' });

  const lines = raw.split('\n').filter(l => l.trim());
  if (lines.length < 2) return res.json([]);

  const headers = lines[0].split('\t');
  const pipeline = lines.slice(1).map(line => {
    const cols = line.split('\t');
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (cols[i] || '').trim(); });
    return obj;
  });

  res.json(pipeline);
});

// ==================== Gmail ====================

app.get('/api/emails/inbox', (req, res) => {
  const raw = gog('gmail search "is:unread" --max 20 -j');
  if (!raw) return res.status(500).json({ error: 'Failed to fetch emails' });
  try {
    res.json(JSON.parse(raw));
  } catch {
    res.json({ raw });
  }
});

app.get('/api/emails/sent', (req, res) => {
  const raw = gog('gmail search "in:sent" --max 20 -j');
  if (!raw) return res.status(500).json({ error: 'Failed to fetch sent emails' });
  try {
    res.json(JSON.parse(raw));
  } catch {
    res.json({ raw });
  }
});

// ==================== Linear (Tasks) ====================

app.get('/api/tasks', (req, res) => {
  if (!process.env.LINEAR_API_KEY) {
    return res.status(500).json({ error: 'LINEAR_API_KEY not set' });
  }

  const result = linearQuery(`{
    issues(first: 50, orderBy: updatedAt) {
      nodes {
        id
        identifier
        title
        description
        priority
        state { name color }
        assignee { name }
        createdAt
        updatedAt
        project { name }
        labels { nodes { name color } }
      }
    }
  }`);

  if (!result) return res.status(500).json({ error: 'Failed to fetch tasks' });
  res.json(result.data?.issues?.nodes || []);
});

// ==================== Google Calendar ====================

app.get('/api/calendar/events', (req, res) => {
  const raw = gog('calendar events -j');
  if (!raw) return res.status(500).json({ error: 'Failed to fetch calendar' });
  try {
    res.json(JSON.parse(raw));
  } catch {
    res.json({ raw });
  }
});

// ==================== Email Templates (Google Sheets) ====================

const SHEET_ID = '1arbZpTV9DSVS8w-4FA8XhV59x_DWxpGIP1dI5vxX3ak';
const TEMPLATE_TABS = [
  { name: 'Onboarding', sheet: 'Tpl — Onboarding', icon: '📥', gid: '1728656310' },
  { name: 'Transactional', sheet: 'Tpl — Transactional', icon: '💳', gid: '304550879' },
  { name: 'Engagement', sheet: 'Tpl — Engagement', icon: '📊', gid: '907890264' },
  { name: 'Marketplace', sheet: 'Tpl — Marketplace', icon: '🤝', gid: '380872628' },
  { name: 'Support', sheet: 'Tpl — Support', icon: '🎧', gid: '1087175277' },
  { name: 'Outreach', sheet: 'Tpl — Outreach', icon: '📨', gid: '1856657472' },
];

app.get('/api/templates', (req, res) => {
  const categories = [];

  for (const tab of TEMPLATE_TABS) {
    const raw = gog(`sheets get ${SHEET_ID} "${tab.sheet}!A1:G50" -p`);
    if (!raw) {
      categories.push({ name: tab.name, icon: tab.icon, sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${tab.gid}`, templates: [] });
      continue;
    }

    const lines = raw.split('\n').filter(l => l.trim());
    if (lines.length < 2) {
      categories.push({ name: tab.name, icon: tab.icon, sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${tab.gid}`, templates: [] });
      continue;
    }

    const headers = lines[0].split('\t').map(h => h.trim());
    const templates = lines.slice(1).map(line => {
      const cols = line.split('\t');
      return {
        name: (cols[0] || '').trim(),
        subject: (cols[1] || '').trim(),
        bodyPreview: (cols[2] || '').trim(),
        variationA: (cols[3] || '').trim(),
        variationB: (cols[4] || '').trim(),
        variables: (cols[5] || '').trim(),
        notes: (cols[6] || '').trim(),
      };
    }).filter(t => t.name);

    categories.push({
      name: tab.name,
      icon: tab.icon,
      count: templates.length,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${tab.gid}`,
      templates,
    });
  }

  res.json(categories);
});

// ==================== Errors & Diagnostics (Google Sheets) ====================

const ERRORS_SHEET_ID = '1arbZpTV9DSVS8w-4FA8XhV59x_DWxpGIP1dI5vxX3ak';
const ERRORS_TAB = 'Errors';

app.get('/api/errors', (req, res) => {
  const raw = gog(`sheets get ${ERRORS_SHEET_ID} "${ERRORS_TAB}!A1:H100" -p`);
  if (!raw) return res.status(500).json({ error: 'Failed to fetch errors' });

  const lines = raw.split('\n').filter(l => l.trim());
  if (lines.length < 2) return res.json([]);

  const headers = lines[0].split('\t').map(h => h.trim().toLowerCase());
  const errors = lines.slice(1).map(line => {
    const cols = line.split('\t');
    return {
      id: (cols[0] || '').trim(),
      level: (cols[1] || '').trim(),
      title: (cols[2] || '').trim(),
      message: (cols[3] || '').trim(),
      timestamp: (cols[4] || '').trim(),
      source: (cols[5] || '').trim(),
      suggestion: (cols[6] || '').trim(),
      resolved: (cols[7] || '').trim().toLowerCase() === 'true',
    };
  }).filter(e => e.id);

  res.json(errors);
});

app.post('/api/errors', (req, res) => {
  const { level, title, message, source, suggestion, resolved } = req.body;
  if (!title || !message) return res.status(400).json({ error: 'title and message required' });

  const id = 'e' + Date.now();
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '') + ' PDT';

  const row = [[id, level || 'error', title, message, timestamp, source || '', suggestion || '', resolved ? 'true' : 'false']];
  const result = gog(`sheets append ${ERRORS_SHEET_ID} "${ERRORS_TAB}!A:H" --values-json '${JSON.stringify(row)}'`);
  if (!result && result !== '') return res.status(500).json({ error: 'Failed to log error' });

  res.json({ id, logged: true });
});

app.patch('/api/errors/:id', (req, res) => {
  const { id } = req.params;
  const { resolved, level, suggestion } = req.body;

  // Read all errors to find the row
  const raw = gog(`sheets get ${ERRORS_SHEET_ID} "${ERRORS_TAB}!A1:H100" -p`);
  if (!raw) return res.status(500).json({ error: 'Failed to fetch errors' });

  const lines = raw.split('\n').filter(l => l.trim());
  const rowIndex = lines.findIndex((line, i) => i > 0 && line.split('\t')[0]?.trim() === id);
  if (rowIndex === -1) return res.status(404).json({ error: 'Error not found' });

  const cols = lines[rowIndex].split('\t');
  const sheetRow = rowIndex + 1; // 1-indexed

  if (resolved !== undefined) cols[7] = resolved ? 'true' : 'false';
  if (resolved) cols[1] = 'resolved';
  if (level) cols[1] = level;
  if (suggestion) cols[6] = suggestion;

  const row = [cols.map(c => c.trim())];
  gog(`sheets update ${ERRORS_SHEET_ID} "${ERRORS_TAB}!A${sheetRow}:H${sheetRow}" --values-json '${JSON.stringify(row)}'`);

  res.json({ id, updated: true });
});

// ==================== System Status ====================

app.get('/api/status', (req, res) => {
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();

  // Check if key services are reachable
  const gogOk = gog('gmail search "test" --max 1') !== null;
  const linearOk = process.env.LINEAR_API_KEY ? linearQuery('{ viewer { id } }') !== null : false;

  res.json({
    status: 'online',
    uptime: Math.floor(uptime),
    memory: Math.floor(memUsage.heapUsed / 1024 / 1024) + 'MB',
    services: {
      gmail: gogOk ? 'connected' : 'error',
      linear: linearOk ? 'connected' : 'error',
      sheets: gogOk ? 'connected' : 'error', // uses same auth
    },
    timestamp: new Date().toISOString(),
  });
});

// ==================== Health ====================

app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CoreConX API server running on http://0.0.0.0:${PORT}`);
  console.log(`Tailscale: http://100.70.32.111:${PORT}`);
});

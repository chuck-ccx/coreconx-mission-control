import express from 'express';
import cors from 'cors';

// Route modules
import authRouter, { authMiddleware } from './routes/auth.js';
import healthRouter from './routes/health.js';
import crmRouter from './routes/crm.js';
import emailsRouter from './routes/emails.js';
import tasksRouter from './routes/tasks.js';
import calendarRouter from './routes/calendar.js';
import agentsRouter from './routes/agents.js';
import brainRouter from './routes/brain.js';
import activityRouter from './routes/activity.js';
import miscRouter from './routes/misc.js';

const REQUIRED_ENV = [
  'MC_API_TOKEN',
  'MC_USERNAME',
  'MC_PASSWORD',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'LINEAR_API_KEY',
];

const missing = REQUIRED_ENV.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
  console.error('Server refusing to start. Set these in ~/.zshrc and restart PM2.');
  process.exit(1);
}

const app = express();
const PORT = 3100;

// Only allow requests from Tailscale network and Netlify
app.use(cors({
  origin: [
    'https://coreconx-mission-control.netlify.app',
    /^https?:\/\/.*\.vercel\.app$/,
    /^https?:\/\/(www\.)?ccxmc\.ca$/,
    /^http:\/\/100\.\d+\.\d+\.\d+/,
    'http://localhost:3000',
  ],
  credentials: true,
}));

app.use(express.json());

// ── Public routes (no auth) ──────────────────────────────────────
app.use(authRouter);   // /auth/login
app.use(healthRouter);  // /deploy, /health, /health/nightly-review, /api/health-monitor

// ── Auth middleware — all /api/* routes below require bearer token ─
app.use('/api', authMiddleware);

// ── Protected /api/* routes ──────────────────────────────────────
app.use('/api/crm', crmRouter);
app.use('/api/emails', emailsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/brain', brainRouter);
app.use('/api/activity', activityRouter);
app.use('/api', miscRouter);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CoreConX API server running on http://0.0.0.0:${PORT}`);
  console.log(`Tailscale: http://100.70.32.111:${PORT}`);
});

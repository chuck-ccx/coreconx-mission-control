import { Router } from 'express';
import { execSync, exec } from 'child_process';
import { readFileSync } from 'fs';

const router = Router();

const DEPLOY_SECRET = process.env.DEPLOY_SECRET;
router.post('/deploy', (req, res) => {
  const token = req.headers['x-deploy-token'];
  if (!DEPLOY_SECRET || !token || token !== DEPLOY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const repoDir = '/Users/chucka.i./.openclaw/workspace/coreconx-mission-control';
    const pullResult = execSync('git pull origin main', { cwd: repoDir, timeout: 30000 }).toString();
    const installResult = execSync('npm install --production', { cwd: repoDir, timeout: 60000 }).toString();
    res.json({ ok: true, pull: pullResult.trim(), install: installResult.substring(0, 200), restarting: true });
    setTimeout(() => exec('pm2 restart mc-api'), 500);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Public health endpoints (no auth required — used by external watchdog)
router.get('/health/nightly-review', (_req, res) => {
  try {
    const content = readFileSync('/Users/chucka.i./.openclaw/workspace/last-nightly-review.txt', 'utf-8').trim();
    const today = new Date().toISOString().split('T')[0];
    res.json({ lastRun: content, ranToday: content.startsWith(today), checkedAt: new Date().toISOString() });
  } catch (_e) {
    res.json({ lastRun: 'never', ranToday: false, checkedAt: new Date().toISOString() });
  }
});

router.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

export default router;

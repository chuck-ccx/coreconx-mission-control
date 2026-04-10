import { Router } from 'express';

const router = Router();

// Login endpoint — validates credentials from env vars (not behind bearer auth)
const MC_USERNAME = process.env.MC_USERNAME; // MUST be set in env — no fallback
const MC_PASSWORD = process.env.MC_PASSWORD; // MUST be set in env — no fallback
const API_TOKEN = process.env.MC_API_TOKEN;

router.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!MC_USERNAME || !MC_PASSWORD) {
    return res.status(500).json({ error: 'Server auth not configured — set MC_USERNAME and MC_PASSWORD' });
  }
  if (username === MC_USERNAME && password === MC_PASSWORD) {
    return res.json({ authenticated: true, token: API_TOKEN });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

// Auth middleware — simple bearer token
export function authMiddleware(req, res, next) {
  if (!API_TOKEN) {
    return res.status(500).json({ error: 'Server auth not configured — set MC_API_TOKEN' });
  }
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${API_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

export default router;

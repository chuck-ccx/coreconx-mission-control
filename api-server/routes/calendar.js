import { Router } from 'express';
import { gog } from '../helpers.js';

const router = Router();

router.get('/events', (req, res) => {
  const raw = gog('calendar events -j');
  if (!raw) return res.status(500).json({ error: 'Failed to fetch calendar' });
  try {
    res.json(JSON.parse(raw));
  } catch {
    res.json({ raw });
  }
});

export default router;

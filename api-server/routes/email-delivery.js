import { Router } from 'express';
import { Resend } from 'resend';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_FROM = 'CoreConX <noreply@coreconx.group>';

router.post('/send', (req, res) => {
  const { to, subject, html, from } = req.body;

  // Validate required fields
  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
  }

  // Validate email format
  const recipients = Array.isArray(to) ? to : [to];
  for (const addr of recipients) {
    if (!EMAIL_REGEX.test(addr)) {
      return res.status(400).json({ error: `Invalid email address: ${addr}` });
    }
  }

  // Check API key
  if (!process.env.RESEND_API_KEY) {
    return res.status(503).json({ error: 'Email service not configured (RESEND_API_KEY missing)' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  resend.emails.send({
    from: from || DEFAULT_FROM,
    to: recipients,
    subject,
    html,
  })
    .then(({ data, error }) => {
      if (error) {
        console.error('Resend API error:', error);
        return res.status(502).json({ error: 'Email delivery failed', details: error.message });
      }
      res.json({ sent: true, id: data.id });
    })
    .catch((err) => {
      console.error('Resend send error:', err);
      res.status(500).json({ error: 'Internal error sending email' });
    });
});

export default router;

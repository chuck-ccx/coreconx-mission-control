import { Router } from 'express';
import { execSync } from 'child_process';
import crypto from 'crypto';

const router = Router();

function verifyLinearSignature(req) {
  const secret = process.env.LINEAR_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('LINEAR_WEBHOOK_SECRET not set — skipping signature validation');
    return true;
  }

  const signature = req.headers['x-linear-signature'];
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(req.rawBody);
  const expected = hmac.digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function sendNotification(message, identifier, title) {
  const escaped = message.replace(/"/g, '\\"');
  try {
    execSync(`openclaw message send --channel discord --target 1485641294637432884 --message "${escaped}"`);
    console.log('Discord notification sent');
  } catch (err) {
    console.error('Discord notification failed:', err.message);
  }

  const systemText = `TASK APPROVED: [${identifier}] '${title}' — this is a go order. Read skills/delegation/SKILL.md. Acknowledge to Dylan, create the brief, dispatch the agent. Do not wait.`;
  const escapedSystem = systemText.replace(/"/g, '\\"');
  try {
    execSync(`openclaw system event --text "${escapedSystem}" --mode now`);
    console.log('System event sent to Chuck session');
  } catch (err) {
    console.error('System event failed:', err.message);
  }
}

const APPROVED_STATES = ['In Progress', 'Todo'];

router.post('/webhooks/linear', (req, res) => {
  console.log('Linear webhook received:', JSON.stringify(req.body));

  if (!verifyLinearSignature(req)) {
    console.warn('Linear webhook signature validation failed');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  try {
    const { action, type, data, updatedFrom } = req.body;

    if (action !== 'update' || type !== 'Issue' || !updatedFrom?.stateId) {
      console.log('Ignoring non-qualifying webhook event');
      return res.json({ ok: true, ignored: true });
    }

    const stateName = data?.state?.name;
    if (!APPROVED_STATES.includes(stateName)) {
      console.log(`Ignoring state transition to "${stateName}"`);
      return res.json({ ok: true, ignored: true });
    }

    const identifier = data?.identifier || 'UNKNOWN';
    const title = data?.title || 'Untitled';
    const assignee = data?.assignee?.name || 'Unassigned';
    const message = `Task approved: [${identifier}] ${title} — assigned to ${assignee}. Check Linear and begin work.`;

    console.log('Sending notification:', message);
    sendNotification(message, identifier, title);
  } catch (err) {
    console.error('Error processing Linear webhook:', err.message);
  }

  return res.json({ ok: true });
});

router.post('/webhooks/linear/test', (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (token !== process.env.MC_API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { identifier, title } = req.body;
  const message = `Task approved: [${identifier}] ${title} — assigned to Test. Check Linear and begin work.`;

  console.log('Test notification:', message);
  sendNotification(message, identifier || 'TEST', title || 'Test task');

  return res.json({ ok: true, message: 'Notification sent' });
});

export default router;

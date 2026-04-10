import { Router } from 'express';
import { readFileSync, existsSync } from 'fs';
import { gog } from '../helpers.js';

const router = Router();

const CACHE_DIR = new URL('./cache', new URL('../', import.meta.url)).pathname;

router.get('/inbox', (req, res) => {
  const raw = gog('gmail search "is:unread" --max 20 -j');
  if (raw) {
    try { return res.json(JSON.parse(raw)); } catch { return res.json({ raw }); }
  }
  // Cache fallback
  try {
    const cachePath = `${CACHE_DIR}/emails-unread.json`;
    if (existsSync(cachePath)) {
      console.log('Gmail API failed, using cache fallback...');
      return res.json(JSON.parse(readFileSync(cachePath, 'utf-8')));
    }
  } catch (e) { console.error(`Email cache error: ${e.message}`); }
  res.status(500).json({ error: 'Failed to fetch emails' });
});

router.get('/sent', (req, res) => {
  const raw = gog('gmail search "in:sent" --max 20 -j');
  if (!raw) return res.status(500).json({ error: 'Failed to fetch sent emails' });
  try {
    res.json(JSON.parse(raw));
  } catch {
    res.json({ raw });
  }
});

// ==================== Gmail — Inbox by Alias ====================

router.get('/alias/:alias', (req, res) => {
  const alias = req.params.alias;
  const raw = gog(`gmail search "to:${alias}" --max 20 -j`);
  if (!raw) return res.status(500).json({ error: 'Failed to fetch emails for alias' });
  try {
    res.json(JSON.parse(raw));
  } catch {
    res.json({ threads: [] });
  }
});

// ==================== Gmail — Thread Details ====================

router.get('/thread/:threadId', (req, res) => {
  const { threadId } = req.params;
  const raw = gog(`gmail thread get ${threadId} -j`);
  if (!raw) return res.status(500).json({ error: 'Failed to fetch thread' });
  try {
    const data = JSON.parse(raw);
    const thread = data.thread || data;
    const messages = (thread.messages || []).map(msg => {
      const headers = msg.payload?.headers || [];
      const getHeader = (name) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
      // Try to get body from parts or snippet
      let body = msg.snippet || '';
      if (msg.payload?.parts) {
        const textPart = msg.payload.parts.find(p => p.mimeType === 'text/plain');
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
        }
      } else if (msg.payload?.body?.data) {
        body = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8');
      }
      return {
        id: msg.id,
        from: getHeader('From'),
        to: getHeader('To'),
        date: getHeader('Date'),
        subject: getHeader('Subject'),
        body,
        snippet: msg.snippet || '',
      };
    });
    res.json({ id: thread.id, messages });
  } catch {
    // Fallback: try fetching individual message with gmail get
    const singleRaw = gog(`gmail get ${threadId} -j`);
    if (singleRaw) {
      try {
        const msg = JSON.parse(singleRaw);
        res.json({
          id: threadId,
          messages: [{
            id: msg.message?.id || threadId,
            from: msg.headers?.from || '',
            to: msg.headers?.to || '',
            date: msg.headers?.date || '',
            subject: msg.headers?.subject || '',
            body: msg.body || '',
            snippet: msg.message?.snippet || '',
          }]
        });
        return;
      } catch {}
    }
    res.json({ id: threadId, messages: [] });
  }
});

// ==================== Gmail — Drafts ====================

router.get('/drafts', (req, res) => {
  const raw = gog('gmail drafts list -j');
  if (!raw) return res.status(500).json({ error: 'Failed to fetch drafts' });
  try {
    res.json(JSON.parse(raw));
  } catch {
    res.json({ drafts: [] });
  }
});

router.post('/draft', (req, res) => {
  const { to, subject, body, from, replyToMessageId } = req.body;
  if (!to || !subject || !body) return res.status(400).json({ error: 'to, subject, and body required' });

  let cmd = `gmail drafts create --to "${to}" --subject "${subject.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
  if (from) cmd += ` --from "${from}"`;
  if (replyToMessageId) cmd += ` --reply-to-message-id "${replyToMessageId}"`;
  cmd += ' -j';

  const raw = gog(cmd);
  if (!raw) return res.status(500).json({ error: 'Failed to create draft' });
  try {
    res.json(JSON.parse(raw));
  } catch {
    res.json({ created: true, raw });
  }
});

router.post('/draft/:draftId/send', (req, res) => {
  const { draftId } = req.params;
  const raw = gog(`gmail drafts send ${draftId} -j -y`);
  if (!raw && raw !== '') return res.status(500).json({ error: 'Failed to send draft' });
  try {
    res.json(JSON.parse(raw));
  } catch {
    res.json({ sent: true, raw });
  }
});

router.delete('/draft/:draftId', (req, res) => {
  const raw = gog(`gmail drafts delete ${req.params.draftId} -y`);
  if (raw === null) return res.status(500).json({ error: 'Failed to delete draft' });
  res.json({ deleted: true });
});

// ==================== Gmail — Send (approve) ====================

router.post('/send', (req, res) => {
  const { to, subject, body, from, replyToMessageId, threadId } = req.body;
  if (!to || !subject || !body) return res.status(400).json({ error: 'to, subject, and body required' });

  let cmd = `gmail send --to "${to}" --subject "${subject.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
  if (from) cmd += ` --from "${from}"`;
  if (replyToMessageId) cmd += ` --reply-to-message-id "${replyToMessageId}"`;
  if (threadId) cmd += ` --thread-id "${threadId}"`;
  cmd += ' -j -y';

  const raw = gog(cmd);
  if (!raw && raw !== '') return res.status(500).json({ error: 'Failed to send email' });
  try {
    res.json(JSON.parse(raw));
  } catch {
    res.json({ sent: true, raw });
  }
});

// ==================== Gmail — Archive / Mark Read ====================

router.post('/archive/:messageId', (req, res) => {
  const raw = gog(`gmail archive ${req.params.messageId} -y`);
  if (raw === null) return res.status(500).json({ error: 'Failed to archive' });
  res.json({ archived: true });
});

router.post('/mark-read/:messageId', (req, res) => {
  const raw = gog(`gmail mark-read ${req.params.messageId} -y`);
  if (raw === null) return res.status(500).json({ error: 'Failed to mark read' });
  res.json({ markedRead: true });
});

router.post('/trash/:messageId', (req, res) => {
  const raw = gog(`gmail trash ${req.params.messageId} -y`);
  if (raw === null) return res.status(500).json({ error: 'Failed to trash' });
  res.json({ trashed: true });
});

export default router;

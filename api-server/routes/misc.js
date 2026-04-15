import { Router } from 'express';
import { execSync, execFile } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { gog, linearQuery, supabase } from '../helpers.js';

const router = Router();

// ==================== Health Monitor (behind auth) ====================

// Health monitoring endpoint — runs the health check script and returns results
router.get('/health-monitor', async (req, res) => {
  const scriptPath = '/Users/chucka.i./.openclaw/workspace/scripts/mc-health-check.sh';

  execFile('bash', [scriptPath], { timeout: 30000 }, (error, stdout, _stderr) => {
    if (error) {
      return res.json({ error: 'Health check failed', details: error.message });
    }
    try {
      const report = JSON.parse(stdout);
      res.json(report);
    } catch {
      res.json({ error: 'Failed to parse health check output', raw: stdout.slice(0, 500) });
    }
  });
});

// ==================== Email Templates (Google Sheets) ====================

const SHEET_ID = process.env.CRM_SHEET_ID || '1arbZpTV9DSVS8w-4FA8XhV59x_DWxpGIP1dI5vxX3ak';
const TEMPLATE_TABS = [
  { name: 'Onboarding', sheet: 'Tpl — Onboarding', icon: '📥', gid: '1728656310' },
  { name: 'Transactional', sheet: 'Tpl — Transactional', icon: '💳', gid: '304550879' },
  { name: 'Engagement', sheet: 'Tpl — Engagement', icon: '📊', gid: '907890264' },
  { name: 'Marketplace', sheet: 'Tpl — Marketplace', icon: '🤝', gid: '380872628' },
  { name: 'Support', sheet: 'Tpl — Support', icon: '🎧', gid: '1087175277' },
  { name: 'Outreach', sheet: 'Tpl — Outreach', icon: '📨', gid: '1856657472' },
];

router.get('/templates', (req, res) => {
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

const ERRORS_SHEET_ID = process.env.CRM_SHEET_ID || '1arbZpTV9DSVS8w-4FA8XhV59x_DWxpGIP1dI5vxX3ak';
const ERRORS_TAB = 'Errors';

router.get('/errors', (req, res) => {
  const raw = gog(`sheets get ${ERRORS_SHEET_ID} "${ERRORS_TAB}!A1:H100" -p`);
  if (!raw) return res.status(500).json({ error: 'Failed to fetch errors' });

  const lines = raw.split('\n').filter(l => l.trim());
  if (lines.length < 2) return res.json([]);

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

router.post('/errors', (req, res) => {
  const { level, title, message, source, suggestion, resolved } = req.body;
  if (!title || !message) return res.status(400).json({ error: 'title and message required' });

  const id = 'e' + Date.now();
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '') + ' PDT';

  const row = [[id, level || 'error', title, message, timestamp, source || '', suggestion || '', resolved ? 'true' : 'false']];
  const result = gog(`sheets append ${ERRORS_SHEET_ID} "${ERRORS_TAB}!A:H" --values-json '${JSON.stringify(row)}'`);
  if (!result && result !== '') return res.status(500).json({ error: 'Failed to log error' });

  res.json({ id, logged: true });
});

router.patch('/errors/:id', (req, res) => {
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

// ==================== Outreach Tracker (in-memory) ====================

const outreachContacts = [];
let outreachNextId = 1;

router.get('/outreach', (req, res) => {
  res.json(outreachContacts);
});

router.post('/outreach', (req, res) => {
  const { name, company, email, status, notes, nextFollowUp } = req.body;
  if (!name || !company) return res.status(400).json({ error: 'name and company are required' });
  const contact = {
    id: outreachNextId++,
    name,
    company,
    email: email || '',
    status: status || 'Not Contacted',
    lastContactDate: null,
    nextFollowUp: nextFollowUp || null,
    notes: notes || '',
    createdAt: new Date().toISOString(),
  };
  outreachContacts.push(contact);
  res.json(contact);
});

router.patch('/outreach/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const contact = outreachContacts.find(c => c.id === id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });
  const { name, company, email, status, notes, lastContactDate, nextFollowUp } = req.body;
  if (name !== undefined) contact.name = name;
  if (company !== undefined) contact.company = company;
  if (email !== undefined) contact.email = email;
  if (status !== undefined) {
    contact.status = status;
    // Auto-set lastContactDate when status changes to an active state
    if (['Emailed', 'Followed Up', 'Responded', 'Converted'].includes(status)) {
      contact.lastContactDate = new Date().toISOString().split('T')[0];
    }
  }
  if (notes !== undefined) contact.notes = notes;
  if (lastContactDate !== undefined) contact.lastContactDate = lastContactDate;
  if (nextFollowUp !== undefined) contact.nextFollowUp = nextFollowUp;
  res.json(contact);
});

router.delete('/outreach/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = outreachContacts.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Contact not found' });
  outreachContacts.splice(idx, 1);
  res.json({ deleted: true });
});

// ==================== System Status ====================

router.get('/status', (req, res) => {
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

// ==================== Legal Docs ====================

router.get('/legal/docs', (req, res) => {
  // Try to pull from Google Drive; fall back to hardcoded list
  try {
    const raw = gog('drive search "legal" --max 50 -j');
    if (raw) {
      const files = JSON.parse(raw);
      if (Array.isArray(files) && files.length > 0) {
        return res.json(files);
      }
    }
  } catch (e) {
    console.error('Legal docs Drive search failed, using fallback:', e.message);
  }

  // Fallback: serve the canonical legal doc list
  res.json([
    { id: "tos", title: "Terms of Service", phase: "Phase 1", category: "MVP Launch", url: "https://docs.google.com/document/d/1k8123ZrJiTJhrrnYHtltx5ZJmbrDPz-NEtJHyVKtu2A/edit", summary: "Governs user access to CoreConX platform. Covers account creation, acceptable use, intellectual property, limitation of liability, termination. BC/Canada jurisdiction, PIPEDA compliant. Entity: CoreConX (not incorporated). Free during early access, $150/mo per user after.", status: "Live", lastUpdated: "Apr 8" },
    { id: "privacy", title: "Privacy Policy", phase: "Phase 1", category: "MVP Launch", url: "https://docs.google.com/document/d/1e4Y9yMl8QTsX1W8k3cQ6qcUWuNkVBYNeAoUc8hDskSM/edit", summary: "Details how CoreConX collects, uses, stores, and protects personal information. PIPEDA compliant. Privacy Officer: Dylan Fader. 30-day data retention after termination. Covers drilling performance data, shift records, project information.", status: "Live", lastUpdated: "Apr 8" },
    { id: "aup", title: "Acceptable Use Policy", phase: "Phase 1", category: "MVP Launch", url: "https://docs.google.com/document/d/10aUm-xY3tmYVE6nr002sEWTiTjoj25AKvZAN2HLsI00/edit", summary: "Defines prohibited activities on the platform — no unauthorized access, no data scraping, no abuse of drilling data. Enforcement procedures and account suspension policies.", status: "Live", lastUpdated: "Apr 8" },
    { id: "cookie", title: "Cookie Policy", phase: "Phase 1", category: "MVP Launch", url: "https://docs.google.com/document/d/1jUpikcRCTqdLIiamXr7xrBnxDfyIWyfVbXdzvjKBpZY/edit", summary: "Explains use of cookies and tracking technologies. Essential cookies, analytics, preferences. How to manage/disable cookies. Compliant with Canadian privacy requirements.", status: "Live", lastUpdated: "Apr 8" },
    { id: "getting-started", title: "Getting Started Guide", phase: "Phase 1", category: "MVP Launch", url: "https://docs.google.com/document/d/1ehRkppftE-L53QiVqNTeBL9pXZP2gHqlcFKK73vFSdc/edit", summary: "Onboarding guide for new users. Account setup, first drill log, shift tracking, project creation. App coming soon to App Store/Google Play.", status: "Live", lastUpdated: "Apr 8" },
    { id: "subscription", title: "Subscription Agreement", phase: "Phase 2", category: "Paid Plans & Data", url: "#", summary: "Covers subscription plans, billing cycles, payment terms. Free during early access, then $150/mo per user. 30-day data retention after termination. No payment processing system yet.", status: "Draft", lastUpdated: "Apr 8" },
    { id: "dpa", title: "Data Processing Agreement", phase: "Phase 2", category: "Paid Plans & Data", url: "#", summary: "Governs how CoreConX processes customer drilling data. Data security measures, breach notification procedures, sub-processor management. SOC 2 claims removed — honest about current security posture.", status: "Draft", lastUpdated: "Apr 8" },
    { id: "sla", title: "Service Level Agreement", phase: "Phase 2", category: "Paid Plans & Data", url: "#", summary: "Uptime commitments and support response times. Chuck (AI) provides 24/7 support. No enterprise response time promises. Status page planned but not live yet.", status: "Draft", lastUpdated: "Apr 8" },
    { id: "refund", title: "Refund & Cancellation Policy", phase: "Phase 2", category: "Paid Plans & Data", url: "#", summary: "How to cancel subscriptions and request refunds. 30-day data retention after termination (consistent across all docs). Pro-rated refunds for annual plans.", status: "Draft", lastUpdated: "Apr 8" },
    { id: "eula", title: "End User License Agreement", phase: "Phase 2", category: "Paid Plans & Data", url: "#", summary: "License terms for the CoreConX mobile app. Usage rights, restrictions, intellectual property. Standard EULA for mobile applications distributed through app stores.", status: "Draft", lastUpdated: "Apr 8" },
    { id: "marketplace-terms", title: "Marketplace Terms", phase: "Phase 3", category: "Marketplace", url: "#", summary: "Terms for the contractor-mine matching marketplace. How listings work, matching process, payment flow through platform. NOT FOR PUBLICATION — Phase 3 not built yet.", status: "Not Published", lastUpdated: "Apr 8" },
    { id: "contractor", title: "Independent Contractor Agreement", phase: "Phase 3", category: "Marketplace", url: "#", summary: "Template agreement for drill contractors listing on the marketplace. Responsibilities, insurance requirements, performance standards. NOT FOR PUBLICATION.", status: "Not Published", lastUpdated: "Apr 8" },
    { id: "commission", title: "Commission & Fee Schedule", phase: "Phase 3", category: "Marketplace", url: "#", summary: "Platform fees and commission structure. $1/meter model for marketplace transactions. NOT FOR PUBLICATION — pricing model still being finalized.", status: "Not Published", lastUpdated: "Apr 8" },
    { id: "dispute", title: "Dispute Resolution Policy", phase: "Phase 3", category: "Marketplace", url: "#", summary: "How disputes between mines and contractors are handled. Mediation process, escalation procedures, resolution timelines. NOT FOR PUBLICATION.", status: "Not Published", lastUpdated: "Apr 8" },
    { id: "insurance-req", title: "Insurance & Liability Requirements", phase: "Phase 3", category: "Marketplace", url: "#", summary: "Minimum insurance requirements for contractors on the marketplace. E&O, general liability, workers comp. NOT FOR PUBLICATION.", status: "Not Published", lastUpdated: "Apr 8" },
    { id: "nda", title: "NDA Template", phase: "Phase 3", category: "Marketplace", url: "#", summary: "Non-disclosure agreement template for sensitive project data shared between mines and contractors through the marketplace.", status: "Not Published", lastUpdated: "Apr 8" },
    { id: "casl", title: "CASL Compliance Policy", phase: "General", category: "Legal", url: "https://docs.google.com/document/d/1hxNOjpdPFZ9WK7eb1Ht32yOc8_GqXVTSTOOY0xaLOPQ/edit", summary: "Canadian Anti-Spam Legislation compliance. Consent requirements for commercial emails, unsubscribe mechanisms, record-keeping. Critical for email outreach campaigns.", status: "Live", lastUpdated: "Apr 8" },
    { id: "pipeda", title: "PIPEDA Compliance Policy", phase: "General", category: "Legal", url: "https://docs.google.com/document/d/1yX1T1TMrsxFPhcAVzkerL48hGhHVNHjm3oPCbUIIbLo/edit", summary: "Personal Information Protection and Electronic Documents Act compliance. 10 fair information principles, consent management, access rights. Privacy Officer: Dylan Fader.", status: "Live", lastUpdated: "Apr 8" },
    { id: "ip-assignment", title: "IP Assignment Agreement", phase: "General", category: "Legal", url: "https://docs.google.com/document/d/1CvJaeAZP6ihCxAgM2Ow01GdhYdLlkU-bFdd0PRq37vI/edit", summary: "Intellectual property assignment for contractors who built the app. Ensures CoreConX owns all code, designs, and IP created during development.", status: "Live", lastUpdated: "Apr 8" },
    { id: "employee", title: "Employee & Contractor Agreement", phase: "General", category: "Legal", url: "https://docs.google.com/document/d/1BklnEoyttFVzfIgJPgKlggWwitV1-ZYh-Lwa8JbExq0/edit", summary: "Template for hiring employees or contractors. Roles, compensation, IP ownership, confidentiality, termination. No employees currently — for future use.", status: "Live", lastUpdated: "Apr 8" },
    { id: "insurance-internal", title: "Insurance Requirements (Internal)", phase: "General", category: "Legal", url: "https://docs.google.com/document/d/1gM0MKa_LKJc2sVknxODg_X6p5zG5YveRBXnlOBOZLFw/edit", summary: "Internal reference for insurance needs — E&O, cyber liability, general business insurance. Planning document for when CoreConX incorporates.", status: "Live", lastUpdated: "Apr 8" },
  ]);
});

// ==================== Secure Chat ====================

const CHAT_DIR = process.env.CHAT_DIR || '/Users/chucka.i./.openclaw/workspace/secure-chat';

const SECRET_PATTERN =
  /\b(lin_api_[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9_-]{10,}|ghp_[A-Za-z0-9]{10,}|gho_[A-Za-z0-9]{10,}|xoxb-[A-Za-z0-9-]{10,}|xoxp-[A-Za-z0-9-]{10,}|glpat-[A-Za-z0-9_-]{10,}|AKIA[0-9A-Z]{12,})\b/g;

function redactSecrets(text) {
  return text.replace(SECRET_PATTERN, (match) => {
    const prefix = match.slice(0, Math.min(match.indexOf('_') + 4, 8));
    return `${prefix}${'•'.repeat(8)}`;
  });
}

router.post('/chat/send', (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string' || message.length > 10000) {
    return res.status(400).json({ error: 'Invalid message' });
  }

  try {
    if (!existsSync(CHAT_DIR)) mkdirSync(CHAT_DIR, { recursive: true });

    // Redact any secrets before persisting to disk
    const safeMessage = redactSecrets(message.trim());

    const entry = JSON.stringify({
      from: 'dylan',
      message: safeMessage,
      timestamp: new Date().toISOString(),
    });
    appendFileSync(`${CHAT_DIR}/messages.jsonl`, entry + '\n');

    // Fire OpenClaw system event — use redacted message only
    try {
      const safeMsg = safeMessage.substring(0, 200).replace(/\n/g, ' ');
      execSync('openclaw system event --mode now --text "$CHAT_MSG"', {
        timeout: 5000,
        shell: '/bin/bash',
        env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}`, CHAT_MSG: `Secure chat from Dylan: ${safeMsg}` },
      });
    } catch (err) {
      console.error('[chat] OpenClaw notify failed');
    }

    res.json({ ok: true, received: true });
  } catch (err) {
    console.error('[chat] Write failed');
    res.status(500).json({ error: 'Failed to store message' });
  }
});

router.get('/chat/history', (_req, res) => {
  try {
    const filePath = `${CHAT_DIR}/messages.jsonl`;
    if (!existsSync(filePath)) return res.json([]);
    const lines = readFileSync(filePath, 'utf-8').trim().split('\n').filter(Boolean);
    const messages = lines.slice(-50).map(line => JSON.parse(line));
    res.json(messages);
  } catch (err) {
    console.error(`[chat] Read failed: ${err.message}`);
    res.json([]);
  }
});

// ==================== RBAC / User Management ====================

// List all users (profiles table)
router.get('/users', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get current user profile by email
router.get('/users/me', async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: 'Email query param required' });

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (error) return res.status(404).json({ error: 'Profile not found' });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Invite a new user — creates a profile with 'invited' status
router.post('/users/invite', async (req, res) => {
  const { email, role, invited_by } = req.body;
  if (!email || !role) return res.status(400).json({ error: 'Email and role are required' });

  const validRoles = ['admin', 'manager', 'viewer'];
  if (!validRoles.includes(role)) return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });

  try {
    // Check if user already exists
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) return res.status(409).json({ error: 'User with this email already exists' });

    // Send invite via Supabase Auth (generates magic link email)
    const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(email);
    if (authError) return res.status(500).json({ error: `Auth invite failed: ${authError.message}` });

    // Create profile record
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email,
        role,
        status: 'invited',
        display_name: email.split('@')[0],
        invited_by: invited_by || null,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update a user's role
router.patch('/users/:id/role', async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  const validRoles = ['admin', 'manager', 'viewer'];
  if (!role || !validRoles.includes(role)) return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update a user's status (active, disabled)
router.patch('/users/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['active', 'disabled'];
  if (!status || !validStatuses.includes(status)) return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete a user
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Remove from Supabase Auth
    const { error: authError } = await supabase.auth.admin.deleteUser(id);
    if (authError) console.error(`Auth delete warning: ${authError.message}`);

    // Remove profile
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== Email Workflows (COR-77, COR-78, COR-84) ====================

// COR-77: Invite teammate email
router.post('/team/invite', (req, res) => {
  const { email, company_id, role } = req.body;
  if (!email || !company_id || !role) {
    return res.status(400).json({ error: 'email, company_id, and role are required' });
  }

  const signupLink = `https://ccxmc.ca/signup?invite=true&company=${encodeURIComponent(company_id)}&role=${encodeURIComponent(role)}`;
  const subject = `You're invited to join CoreConX Mission Control`;
  const body = [
    `Hi,`,
    ``,
    `You've been invited to join CoreConX Mission Control as a ${role}.`,
    ``,
    `Click the link below to create your account and get started:`,
    `${signupLink}`,
    ``,
    `If you didn't expect this invitation, you can safely ignore this email.`,
    ``,
    `— The CoreConX Team`,
  ].join('\\n');

  const raw = gog(`gmail send --to "${email}" --subject "${subject.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"')}" -j -y`);
  if (raw === null) return res.status(500).json({ error: 'Failed to send invite email' });

  try {
    res.json({ sent: true, email, role, company_id, ...JSON.parse(raw) });
  } catch {
    res.json({ sent: true, email, role, company_id, raw });
  }
});

// COR-78: Shift summary email
router.post('/shifts/:id/summary-email', async (req, res) => {
  const { id } = req.params;

  try {
    const { data: shift, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !shift) return res.status(404).json({ error: 'Shift not found' });

    const ownerEmail = shift.drill_owner_email || shift.owner_email;
    if (!ownerEmail) return res.status(400).json({ error: 'No drill owner email on this shift' });

    const subject = `Shift Summary — ${shift.name || shift.site_name || 'Shift'} (${shift.date || new Date().toISOString().split('T')[0]})`;
    const lines = [
      `Shift Summary`,
      `=============`,
      ``,
      `Site: ${shift.site_name || 'N/A'}`,
      `Date: ${shift.date || 'N/A'}`,
      `Shift: ${shift.name || shift.shift_type || 'N/A'}`,
      ``,
      `Meters Drilled: ${shift.meters ?? shift.meters_drilled ?? 'N/A'}`,
      `Holes Completed: ${shift.holes ?? shift.holes_completed ?? 'N/A'}`,
      `Crew: ${shift.crew || shift.crew_count || 'N/A'}`,
      `Consumables: ${shift.consumables || 'N/A'}`,
      ``,
      `Notes: ${shift.notes || 'None'}`,
      ``,
      `---`,
      `To unsubscribe from shift summaries, visit:`,
      `https://ccxmc.ca/settings/notifications?unsubscribe=shift-summary`,
    ];
    const body = lines.join('\\n');

    const raw = gog(`gmail send --to "${ownerEmail}" --subject "${subject.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"')}" -j -y`);
    if (raw === null) return res.status(500).json({ error: 'Failed to send shift summary email' });

    try {
      res.json({ sent: true, shift_id: id, to: ownerEmail, ...JSON.parse(raw) });
    } catch {
      res.json({ sent: true, shift_id: id, to: ownerEmail, raw });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// COR-84: Founding partner welcome email
router.post('/onboarding/founding-partner', (req, res) => {
  const { email, name } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });

  const displayName = name || email.split('@')[0];
  const subject = `Welcome to CoreConX — Founding Partner`;
  const lines = [
    `Hi ${displayName},`,
    ``,
    `Welcome aboard as a CoreConX Founding Partner!`,
    ``,
    `As a founding partner, you get:`,
    `- Lifetime discounted pricing`,
    `- Priority feature requests`,
    `- Direct access to the founding team`,
    `- Early access to new modules`,
    ``,
    `We're building Mission Control to be the operational backbone for drilling companies, and your early support makes all the difference.`,
    ``,
    `We'd love to hear your story — would you be willing to share a short testimonial about why you chose CoreConX? Just reply to this email with a few sentences about your experience so far.`,
    ``,
    `Get started at: https://ccxmc.ca/dashboard`,
    ``,
    `Thanks for believing in what we're building.`,
    ``,
    `— Chuck & the CoreConX Team`,
  ];
  const body = lines.join('\\n');

  const raw = gog(`gmail send --to "${email}" --subject "${subject.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"')}" -j -y`);
  if (raw === null) return res.status(500).json({ error: 'Failed to send founding partner email' });

  try {
    res.json({ sent: true, email, name: displayName, ...JSON.parse(raw) });
  } catch {
    res.json({ sent: true, email, name: displayName, raw });
  }
});

export default router;

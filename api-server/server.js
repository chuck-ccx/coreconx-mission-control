import express from 'express';
import cors from 'cors';
import { execSync, execFile } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Supabase admin client (service role — full access, server-side only)
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

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

// Login endpoint — validates credentials from env vars (not behind bearer auth)
const MC_USERNAME = process.env.MC_USERNAME; // MUST be set in env — no fallback
const MC_PASSWORD = process.env.MC_PASSWORD; // MUST be set in env — no fallback
app.post('/auth/login', (req, res) => {
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
const API_TOKEN = process.env.MC_API_TOKEN; // MUST be set in env — no fallback
app.use('/api', (req, res, next) => {
  if (!API_TOKEN) {
    return res.status(500).json({ error: 'Server auth not configured — set MC_API_TOKEN' });
  }
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

// ==================== CRM via Supabase ====================

app.get('/api/crm/supabase/companies', async (req, res) => {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/crm/supabase/companies', async (req, res) => {
  const { name, website, province_state, country, city, num_rigs, specialties, size, lead_status, lead_score, priority, notes, recent_intel } = req.body;
  if (!name) return res.status(400).json({ error: 'Company name is required' });
  const { data, error } = await supabase
    .from('companies')
    .insert({ name, website, province_state, country, city, num_rigs: num_rigs || null, specialties, size, lead_status: lead_status || 'Research', lead_score: lead_score || 0, priority, notes, recent_intel })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.patch('/api/crm/supabase/companies/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  delete updates.id;
  const { data, error } = await supabase
    .from('companies')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/crm/supabase/contacts', async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/crm/supabase/contacts', async (req, res) => {
  const { full_name, email, company_name, phone, role } = req.body;
  if (!full_name) return res.status(400).json({ error: 'Full name is required' });
  const { data, error } = await supabase
    .from('profiles')
    .insert({ full_name, email, company_name, phone, role })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.patch('/api/crm/supabase/contacts/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  delete updates.id;
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ==================== CRM Documents (in-memory) ====================

const DEFAULT_DOCS = [
  { name: 'NDA (Non-Disclosure Agreement)', status: 'Not Sent', sentDate: null, signedDate: null },
  { name: 'Service Agreement', status: 'Not Sent', sentDate: null, signedDate: null },
  { name: 'Master Service Agreement (MSA)', status: 'Not Sent', sentDate: null, signedDate: null },
];

const documentsStore = new Map();

function getCompanyDocs(companyName) {
  if (!documentsStore.has(companyName)) {
    documentsStore.set(companyName, DEFAULT_DOCS.map(d => ({ ...d })));
  }
  return documentsStore.get(companyName);
}

app.get('/api/crm/documents/:companyName', (req, res) => {
  const docs = getCompanyDocs(decodeURIComponent(req.params.companyName));
  res.json(docs);
});

app.post('/api/crm/documents/:companyName', (req, res) => {
  const { name, status, sentDate, signedDate } = req.body;
  if (!name) return res.status(400).json({ error: 'Document name is required' });
  const docs = getCompanyDocs(decodeURIComponent(req.params.companyName));
  docs.push({ name, status: status || 'Not Sent', sentDate: sentDate || null, signedDate: signedDate || null });
  res.json(docs);
});

app.patch('/api/crm/documents/:companyName/:docIndex', (req, res) => {
  const companyName = decodeURIComponent(req.params.companyName);
  const idx = parseInt(req.params.docIndex);
  const docs = getCompanyDocs(companyName);
  if (idx < 0 || idx >= docs.length) return res.status(404).json({ error: 'Document not found' });
  const { status, sentDate, signedDate } = req.body;
  if (status) docs[idx].status = status;
  if (sentDate !== undefined) docs[idx].sentDate = sentDate;
  if (signedDate !== undefined) docs[idx].signedDate = signedDate;
  res.json(docs);
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
    issues(first: 50, orderBy: updatedAt, filter: { state: { type: { nin: ["canceled"] } } }) {
      nodes {
        id
        identifier
        title
        description
        priority
        dueDate
        state { id name color type }
        assignee { id name }
        createdAt
        updatedAt
        project { id name }
        labels { nodes { name color } }
      }
    }
  }`);

  if (!result) return res.status(500).json({ error: 'Failed to fetch tasks' });
  res.json(result.data?.issues?.nodes || []);
});

// ==================== Linear — Workflow States ====================

app.get('/api/tasks/states', (req, res) => {
  if (!process.env.LINEAR_API_KEY) {
    return res.status(500).json({ error: 'LINEAR_API_KEY not set' });
  }

  const result = linearQuery(`{ workflowStates { nodes { id name color type position } } }`);
  if (!result) return res.status(500).json({ error: 'Failed to fetch states' });
  res.json(result.data?.workflowStates?.nodes || []);
});

// ==================== Linear — Update Issue Status ====================

app.patch('/api/tasks/:id', (req, res) => {
  if (!process.env.LINEAR_API_KEY) {
    return res.status(500).json({ error: 'LINEAR_API_KEY not set' });
  }

  const { id } = req.params;
  const { stateId, priority } = req.body;
  if (!stateId && priority === undefined) {
    return res.status(400).json({ error: 'stateId or priority required' });
  }

  const updates = [];
  if (stateId) updates.push(`stateId: "${stateId}"`);
  if (priority !== undefined) updates.push(`priority: ${priority}`);

  const mutation = `mutation { issueUpdate(id: "${id}", input: { ${updates.join(', ')} }) { success issue { id identifier title state { name color type } } } }`;
  const result = linearQuery(mutation);
  if (!result || !result.data?.issueUpdate?.success) {
    return res.status(500).json({ error: 'Failed to update task', details: result });
  }

  res.json(result.data.issueUpdate.issue);
});

// ==================== Linear — Delete (Cancel) Issue ====================

app.delete('/api/tasks/:id', (req, res) => {
  if (!process.env.LINEAR_API_KEY) {
    return res.status(500).json({ error: 'LINEAR_API_KEY not set' });
  }

  const { id } = req.params;

  // First get the cancelled state
  const statesResult = linearQuery(`{ workflowStates(filter: { type: { eq: "cancelled" } }) { nodes { id name } } }`);
  const cancelledState = statesResult?.data?.workflowStates?.nodes?.[0];
  if (!cancelledState) {
    return res.status(500).json({ error: 'Could not find cancelled state' });
  }

  const mutation = `mutation { issueUpdate(id: "${id}", input: { stateId: "${cancelledState.id}" }) { success issue { id identifier title } } }`;
  const result = linearQuery(mutation);
  if (!result || !result.data?.issueUpdate?.success) {
    return res.status(500).json({ error: 'Failed to delete task', details: result });
  }

  res.json({ deleted: true, issue: result.data.issueUpdate.issue });
});

// ==================== Linear — Approve Issue (add label) ====================

app.post('/api/tasks/:id/approve', (req, res) => {
  if (!process.env.LINEAR_API_KEY) {
    return res.status(500).json({ error: 'LINEAR_API_KEY not set' });
  }

  const { id } = req.params;

  // Find or create the "Approved" label
  let labelResult = linearQuery(`{ issueLabels(filter: { name: { eq: "Approved" } }) { nodes { id name } } }`);
  let labelId = labelResult?.data?.issueLabels?.nodes?.[0]?.id;

  if (!labelId) {
    // Create the label
    const createLabel = linearQuery(`mutation { issueLabelCreate(input: { name: "Approved", color: "#22c55e" }) { success issueLabel { id } } }`);
    labelId = createLabel?.data?.issueLabelCreate?.issueLabel?.id;
  }

  if (!labelId) {
    return res.status(500).json({ error: 'Could not find or create Approved label' });
  }

  // Get current labels on the issue
  const issueResult = linearQuery(`{ issue(id: "${id}") { labels { nodes { id } } } }`);
  const currentLabelIds = (issueResult?.data?.issue?.labels?.nodes || []).map(l => l.id);

  // Add approved label
  if (!currentLabelIds.includes(labelId)) {
    currentLabelIds.push(labelId);
  }

  // Also move to "In Progress" when approving
  const statesResult = linearQuery(`{ team(id: "COR") { states(filter: { type: { eq: "started" } }) { nodes { id name } } } }`);
  const inProgressStateId = statesResult?.data?.team?.states?.nodes?.[0]?.id;

  const labelIdList = currentLabelIds.map(lid => `"${lid}"`).join(', ');
  const input = inProgressStateId
    ? `{ labelIds: [${labelIdList}], stateId: "${inProgressStateId}" }`
    : `{ labelIds: [${labelIdList}] }`;
  const mutation = `mutation { issueUpdate(id: "${id}", input: ${input}) { success issue { id identifier title state { name } labels { nodes { name color } } } } }`;
  const result = linearQuery(mutation);
  if (!result || !result.data?.issueUpdate?.success) {
    return res.status(500).json({ error: 'Failed to approve task', details: result });
  }

  const issue = result.data.issueUpdate.issue;
  res.json({ approved: true, issue });

  // Fire-and-forget: notify OpenClaw to pick up the task immediately
  const text = `Task approved: ${issue.identifier} - ${issue.title}`;
  console.log(`[approve] firing system event: ${text}`);
  execFile('/opt/homebrew/bin/openclaw', ['system', 'event', '--text', text, '--mode', 'now'], {
    env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` }
  }, (err, stdout, stderr) => {
    if (err) {
      console.error(`[approve] OpenClaw notify FAILED: ${err.message}`);
      if (stderr) console.error(`[approve] stderr: ${stderr}`);
    } else {
      console.log(`[approve] OpenClaw notify OK: ${stdout.trim()}`);
    }
  });
});

// ==================== Linear — Unapprove Issue (remove label) ====================

app.post('/api/tasks/:id/unapprove', (req, res) => {
  if (!process.env.LINEAR_API_KEY) {
    return res.status(500).json({ error: 'LINEAR_API_KEY not set' });
  }

  const { id } = req.params;

  // Find the "Approved" label
  const labelResult = linearQuery(`{ issueLabels(filter: { name: { eq: "Approved" } }) { nodes { id } } }`);
  const labelId = labelResult?.data?.issueLabels?.nodes?.[0]?.id;
  if (!labelId) return res.json({ unapproved: true }); // no label exists, nothing to remove

  // Get current labels on the issue
  const issueResult = linearQuery(`{ issue(id: "${id}") { labels { nodes { id } } } }`);
  const currentLabelIds = (issueResult?.data?.issue?.labels?.nodes || []).map(l => l.id).filter(lid => lid !== labelId);

  const labelIdList = currentLabelIds.map(lid => `"${lid}"`).join(', ');
  const mutation = `mutation { issueUpdate(id: "${id}", input: { labelIds: [${labelIdList}] }) { success } }`;
  linearQuery(mutation);

  res.json({ unapproved: true });
});

// ==================== Linear — Team Members ====================

app.get('/api/tasks/members', (req, res) => {
  if (!process.env.LINEAR_API_KEY) {
    return res.status(500).json({ error: 'LINEAR_API_KEY not set' });
  }

  const result = linearQuery(`{ users { nodes { id name email displayName active } } }`);
  if (!result) return res.status(500).json({ error: 'Failed to fetch members' });

  const users = (result.data?.users?.nodes || [])
    .filter(u => u.active !== false)
    .map(u => ({ id: u.id, name: u.displayName || u.name, email: u.email }));

  // Add AI agents as virtual members — uses label-based assignment
  users.push({ id: 'chuck-ai', name: 'Chuck (AI)', email: 'chuck@coreconx.group' });
  users.push({ id: 'code-agent', name: 'Code Agent', email: null });

  res.json(users);
});

// ==================== Linear — Assign Issue ====================

app.post('/api/tasks/:id/assign', (req, res) => {
  if (!process.env.LINEAR_API_KEY) {
    return res.status(500).json({ error: 'LINEAR_API_KEY not set' });
  }

  const { id } = req.params;
  const { userId } = req.body; // null to unassign, 'chuck-ai' for Chuck, or a real Linear user ID

  if (userId === 'chuck-ai') {
    // Chuck isn't a Linear user — add "Assigned: Chuck" label instead
    let labelResult = linearQuery(`{ issueLabels(filter: { name: { eq: "Assigned: Chuck" } }) { nodes { id } } }`);
    let labelId = labelResult?.data?.issueLabels?.nodes?.[0]?.id;
    if (!labelId) {
      const createLabel = linearQuery(`mutation { issueLabelCreate(input: { name: "Assigned: Chuck", color: "#6366f1" }) { success issueLabel { id } } }`);
      labelId = createLabel?.data?.issueLabelCreate?.issueLabel?.id;
    }
    if (!labelId) return res.status(500).json({ error: 'Could not create Chuck label' });

    // Get current labels and add Chuck's
    const issueResult = linearQuery(`{ issue(id: "${id}") { labels { nodes { id } } } }`);
    const currentLabelIds = (issueResult?.data?.issue?.labels?.nodes || []).map(l => l.id);
    if (!currentLabelIds.includes(labelId)) currentLabelIds.push(labelId);
    const labelIdList = currentLabelIds.map(lid => `"${lid}"`).join(', ');

    const mutation = `mutation { issueUpdate(id: "${id}", input: { labelIds: [${labelIdList}], assigneeId: null }) { success issue { id assignee { name } labels { nodes { name color } } } } }`;
    const result = linearQuery(mutation);
    if (!result?.data?.issueUpdate?.success) return res.status(500).json({ error: 'Failed to assign to Chuck' });
    return res.json({ assigned: true, assignee: { name: 'Chuck (AI)', id: 'chuck-ai' }, issue: result.data.issueUpdate.issue });
  }

  if (userId === 'code-agent') {
    // Code Agent isn't a Linear user — add "Assigned: Code Agent" label instead
    let labelResult = linearQuery(`{ issueLabels(filter: { name: { eq: "Assigned: Code Agent" } }) { nodes { id } } }`);
    let labelId = labelResult?.data?.issueLabels?.nodes?.[0]?.id;
    if (!labelId) {
      const createLabel = linearQuery(`mutation { issueLabelCreate(input: { name: "Assigned: Code Agent", color: "#10b981" }) { success issueLabel { id } } }`);
      labelId = createLabel?.data?.issueLabelCreate?.issueLabel?.id;
    }
    if (!labelId) return res.status(500).json({ error: 'Could not create Code Agent label' });

    // Get current labels and add Code Agent's
    const issueResult = linearQuery(`{ issue(id: "${id}") { labels { nodes { id } } } }`);
    const currentLabelIds = (issueResult?.data?.issue?.labels?.nodes || []).map(l => l.id);
    if (!currentLabelIds.includes(labelId)) currentLabelIds.push(labelId);

    // Also remove Chuck label if switching assignment
    const chuckLabelResult = linearQuery(`{ issueLabels(filter: { name: { eq: "Assigned: Chuck" } }) { nodes { id } } }`);
    const chuckLabelId = chuckLabelResult?.data?.issueLabels?.nodes?.[0]?.id;
    const finalLabelIds = currentLabelIds.filter(lid => lid !== chuckLabelId);
    if (!finalLabelIds.includes(labelId)) finalLabelIds.push(labelId);
    const finalLabelIdList = finalLabelIds.map(lid => `"${lid}"`).join(', ');

    const mutation = `mutation { issueUpdate(id: "${id}", input: { labelIds: [${finalLabelIdList}], assigneeId: null }) { success issue { id assignee { name } labels { nodes { name color } } } } }`;
    const result = linearQuery(mutation);
    if (!result?.data?.issueUpdate?.success) return res.status(500).json({ error: 'Failed to assign to Code Agent' });
    return res.json({ assigned: true, assignee: { name: 'Code Agent', id: 'code-agent' }, issue: result.data.issueUpdate.issue });
  }

  if (userId === null || userId === 'unassign') {
    // Unassign — remove all agent labels (Chuck + Code Agent)
    const chuckLabelResult = linearQuery(`{ issueLabels(filter: { name: { eq: "Assigned: Chuck" } }) { nodes { id } } }`);
    const chuckLabelId = chuckLabelResult?.data?.issueLabels?.nodes?.[0]?.id;
    const codeLabelResult = linearQuery(`{ issueLabels(filter: { name: { eq: "Assigned: Code Agent" } }) { nodes { id } } }`);
    const codeLabelId = codeLabelResult?.data?.issueLabels?.nodes?.[0]?.id;
    const agentLabelIds = [chuckLabelId, codeLabelId].filter(Boolean);

    let labelUpdate = '';
    if (agentLabelIds.length > 0) {
      const issueResult = linearQuery(`{ issue(id: "${id}") { labels { nodes { id } } } }`);
      const currentLabelIds = (issueResult?.data?.issue?.labels?.nodes || []).map(l => l.id).filter(lid => !agentLabelIds.includes(lid));
      const labelIdList = currentLabelIds.map(lid => `"${lid}"`).join(', ');
      labelUpdate = `, labelIds: [${labelIdList}]`;
    }

    const mutation = `mutation { issueUpdate(id: "${id}", input: { assigneeId: null${labelUpdate} }) { success issue { id assignee { name } } } }`;
    const result = linearQuery(mutation);
    if (!result?.data?.issueUpdate?.success) return res.status(500).json({ error: 'Failed to unassign' });
    return res.json({ assigned: true, assignee: null, issue: result.data.issueUpdate.issue });
  }

  // Regular Linear user assignment — also remove agent labels if present
  const chuckLabel = linearQuery(`{ issueLabels(filter: { name: { eq: "Assigned: Chuck" } }) { nodes { id } } }`);
  const codeLabel = linearQuery(`{ issueLabels(filter: { name: { eq: "Assigned: Code Agent" } }) { nodes { id } } }`);
  const agentLabelsToRemove = [chuckLabel?.data?.issueLabels?.nodes?.[0]?.id, codeLabel?.data?.issueLabels?.nodes?.[0]?.id].filter(Boolean);

  let labelUpdate = '';
  if (agentLabelsToRemove.length > 0) {
    const issueResult = linearQuery(`{ issue(id: "${id}") { labels { nodes { id } } } }`);
    const currentLabelIds = (issueResult?.data?.issue?.labels?.nodes || []).map(l => l.id).filter(lid => !agentLabelsToRemove.includes(lid));
    const labelIdList = currentLabelIds.map(lid => `"${lid}"`).join(', ');
    labelUpdate = `, labelIds: [${labelIdList}]`;
  }

  const mutation = `mutation { issueUpdate(id: "${id}", input: { assigneeId: "${userId}"${labelUpdate} }) { success issue { id assignee { id name } } } }`;
  const result = linearQuery(mutation);
  if (!result?.data?.issueUpdate?.success) return res.status(500).json({ error: 'Failed to assign task', details: result });
  res.json({ assigned: true, assignee: result.data.issueUpdate.issue.assignee, issue: result.data.issueUpdate.issue });
});

// ==================== Gmail — Inbox by Alias ====================

app.get('/api/emails/alias/:alias', (req, res) => {
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

app.get('/api/emails/thread/:threadId', (req, res) => {
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

app.get('/api/emails/drafts', (req, res) => {
  const raw = gog('gmail drafts list -j');
  if (!raw) return res.status(500).json({ error: 'Failed to fetch drafts' });
  try {
    res.json(JSON.parse(raw));
  } catch {
    res.json({ drafts: [] });
  }
});

app.post('/api/emails/draft', (req, res) => {
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

app.post('/api/emails/draft/:draftId/send', (req, res) => {
  const { draftId } = req.params;
  const raw = gog(`gmail drafts send ${draftId} -j -y`);
  if (!raw && raw !== '') return res.status(500).json({ error: 'Failed to send draft' });
  try {
    res.json(JSON.parse(raw));
  } catch {
    res.json({ sent: true, raw });
  }
});

app.delete('/api/emails/draft/:draftId', (req, res) => {
  const raw = gog(`gmail drafts delete ${req.params.draftId} -y`);
  if (raw === null) return res.status(500).json({ error: 'Failed to delete draft' });
  res.json({ deleted: true });
});

// ==================== Gmail — Send (approve) ====================

app.post('/api/emails/send', (req, res) => {
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

app.post('/api/emails/archive/:messageId', (req, res) => {
  const raw = gog(`gmail archive ${req.params.messageId} -y`);
  if (raw === null) return res.status(500).json({ error: 'Failed to archive' });
  res.json({ archived: true });
});

app.post('/api/emails/mark-read/:messageId', (req, res) => {
  const raw = gog(`gmail mark-read ${req.params.messageId} -y`);
  if (raw === null) return res.status(500).json({ error: 'Failed to mark read' });
  res.json({ markedRead: true });
});

app.post('/api/emails/trash/:messageId', (req, res) => {
  const raw = gog(`gmail trash ${req.params.messageId} -y`);
  if (raw === null) return res.status(500).json({ error: 'Failed to trash' });
  res.json({ trashed: true });
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

// ==================== Agents ====================

// Helper: parse REGISTRY.md into agent definitions
function parseRegistry(text) {
  const lines = text.split('\n').filter(l => l.trim().startsWith('|') && !l.includes('---'));
  if (lines.length < 2) return [];
  // skip header row
  return lines.slice(1).map(line => {
    const cols = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cols.length < 5) return null;
    return {
      id: cols[0],
      purpose: cols[1],
      modelTier: cols[2],
      registryStatus: cols[3],
      spawned: cols[4],
      notes: cols[5] || '',
    };
  }).filter(Boolean);
}

// Helper: map registry + session data into model name
function resolveModel(modelTier, sessionModel) {
  if (sessionModel) return sessionModel;
  if (/T3/i.test(modelTier)) return 'Claude Opus 4';
  if (/T2/i.test(modelTier)) return 'Claude Haiku';
  if (/T1/i.test(modelTier)) return 'DeepSeek / Llama';
  return modelTier || 'Unknown';
}

// Helper: read cron jobs and return map of agent name -> enabled
function getCronEnabledMap() {
  const map = {};
  try {
    const cronData = JSON.parse(readFileSync(process.env.HOME + '/.openclaw/workspace/cron/jobs.json', 'utf-8'));
    for (const job of (cronData.jobs || [])) {
      map[job.id] = job.enabled !== false;
    }
  } catch { /* file may not exist */ }
  return map;
}

app.get('/api/agents', (req, res) => {
  const agents = [];
  const now = Date.now();
  const cronEnabled = getCronEnabledMap();

  // 1. Read REGISTRY.md
  let registryAgents = [];
  try {
    const text = readFileSync(process.env.HOME + '/.openclaw/workspace/agents/REGISTRY.md', 'utf-8');
    registryAgents = parseRegistry(text);
  } catch { /* file may not exist */ }

  // 2. Get OpenClaw sessions
  let sessions = [];
  try {
    const raw = execSync('/opt/homebrew/bin/openclaw sessions --json --all-agents', {
      timeout: 10000,
      encoding: 'utf-8',
      env: { ...process.env, PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' },
    });
    const parsed = JSON.parse(raw);
    sessions = parsed.sessions || parsed || [];
  } catch { /* openclaw may not be available */ }

  // 3. Get task counts from Linear (assigned tasks per assignee name)
  let taskCounts = {};
  if (process.env.LINEAR_API_KEY) {
    const result = linearQuery(`{
      issues(first: 200, filter: { state: { type: { nin: ["completed", "canceled"] } } }) {
        nodes {
          assignee { name }
          labels { nodes { name } }
        }
      }
    }`);
    if (result?.data?.issues?.nodes) {
      for (const issue of result.data.issues.nodes) {
        // Count by assignee name
        const assigneeName = issue.assignee?.name;
        if (assigneeName) {
          taskCounts[assigneeName] = (taskCounts[assigneeName] || 0) + 1;
        }
        // Also count "Assigned: <agent>" labels — map to agent IDs
        for (const label of (issue.labels?.nodes || [])) {
          const match = label.name.match(/^Assigned:\s*(.+)/i);
          if (match) {
            const name = match[1].trim();
            taskCounts[name] = (taskCounts[name] || 0) + 1;
            // Map label names to registry IDs (e.g. "Code Agent" → "code")
            const idForm = name.toLowerCase().replace(/\s+agent$/i, '').replace(/\s+/g, '-');
            if (idForm !== name) taskCounts[idForm] = (taskCounts[idForm] || 0) + 1;
          }
        }
      }
    }
  }

  // Build the "Chuck" primary agent from session data
  const mainSession = sessions.find(s => s.agentId === 'main' && s.kind === 'direct');
  agents.push({
    id: 'chuck',
    name: 'Chuck',
    role: 'COO — Operations & Strategy',
    model: mainSession?.model || 'Claude Opus 4.6',
    status: mainSession && (now - mainSession.updatedAt) < 600000 ? 'active' : 'idle',
    taskCount: taskCounts['Chuck'] || taskCounts['Chuck (AI)'] || 0,
    lastActive: mainSession ? new Date(mainSession.updatedAt).toISOString() : null,
    techStack: ['OpenClaw', 'Claude Opus 4', 'Linear', 'Google Workspace', 'GitHub'],
    enabled: true, // Chuck is always on
  });

  // Add agents from REGISTRY.md
  for (const ra of registryAgents) {
    const matchedSession = sessions.find(s => s.agentId === ra.id);
    const isActive = ra.registryStatus?.toLowerCase() === 'active';
    const enabled = cronEnabled[ra.id] !== undefined ? cronEnabled[ra.id] : isActive;
    agents.push({
      id: ra.id,
      name: ra.id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      role: ra.purpose,
      model: resolveModel(ra.modelTier, matchedSession?.model),
      status: !enabled ? 'idle'
        : matchedSession && (now - matchedSession.updatedAt) < 600000 ? 'active'
        : isActive ? 'idle' : 'error',
      taskCount: taskCounts[ra.id] || 0,
      lastActive: matchedSession ? new Date(matchedSession.updatedAt).toISOString() : ra.spawned || null,
      techStack: ra.notes ? ra.notes.split(/[.,;]/).map(s => s.trim()).filter(Boolean).slice(0, 5) : [],
      enabled,
    });
  }

  res.json(agents);
});

// Toggle agent on/off
app.put('/api/agents/:id/toggle', (req, res) => {
  const agentId = req.params.id;
  const { enabled } = req.body;

  if (agentId === 'chuck') {
    return res.status(400).json({ error: 'Cannot disable Chuck' });
  }

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled must be a boolean' });
  }

  // 1. Update cron jobs.json
  const cronPath = process.env.HOME + '/.openclaw/cron/jobs.json';
  try {
    const cronData = JSON.parse(readFileSync(cronPath, 'utf-8'));
    const job = cronData.jobs.find(j => j.name === agentId);
    if (job) {
      job.enabled = enabled;
      job.updatedAtMs = Date.now();
      writeFileSync(cronPath, JSON.stringify(cronData, null, 2));
    }
  } catch (e) {
    return res.status(500).json({ error: 'Failed to update cron config', detail: e.message });
  }

  // 2. Update REGISTRY.md
  const registryPath = process.env.HOME + '/.openclaw/workspace/agents/REGISTRY.md';
  try {
    let text = readFileSync(registryPath, 'utf-8');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('|') && lines[i].includes(agentId)) {
        const cols = lines[i].split('|').map(c => c.trim());
        // cols: ['', agent, purpose, tier, status, spawned, notes, '']
        const statusIdx = cols.findIndex((c, idx) => idx > 0 && (c === 'Active' || c === 'Paused'));
        if (statusIdx !== -1) {
          cols[statusIdx] = enabled ? 'Active' : 'Paused';
          lines[i] = '| ' + cols.filter(Boolean).join(' | ') + ' |';
        }
      }
    }
    writeFileSync(registryPath, lines.join('\n'));
  } catch { /* non-critical */ }

  // 3. Reload cron daemon
  try {
    execSync('/opt/homebrew/bin/openclaw cron reload 2>/dev/null || true', {
      timeout: 5000,
      encoding: 'utf-8',
      env: { ...process.env, PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' },
    });
  } catch { /* non-critical */ }

  res.json({ id: agentId, enabled });
});

// ==================== Outreach Tracker (in-memory) ====================
// TODO: persist to Google Sheet when ready

const outreachContacts = [];
let outreachNextId = 1;

app.get('/api/outreach', (req, res) => {
  res.json(outreachContacts);
});

app.post('/api/outreach', (req, res) => {
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

app.patch('/api/outreach/:id', (req, res) => {
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

app.delete('/api/outreach/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = outreachContacts.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Contact not found' });
  outreachContacts.splice(idx, 1);
  res.json({ deleted: true });
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

// ==================== Legal Docs ====================

app.get('/api/legal/docs', (req, res) => {
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

app.post('/api/chat/send', (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string' || message.length > 10000) {
    return res.status(400).json({ error: 'Invalid message' });
  }

  try {
    if (!existsSync(CHAT_DIR)) mkdirSync(CHAT_DIR, { recursive: true });

    const entry = JSON.stringify({
      from: 'dylan',
      message: message.trim(),
      timestamp: new Date().toISOString(),
    });
    appendFileSync(`${CHAT_DIR}/messages.jsonl`, entry + '\n');

    // Fire OpenClaw system event so Chuck picks it up
    try {
      const safeMsg = message.trim().substring(0, 200).replace(/\n/g, ' ');
      execSync('openclaw system event --mode now --text "$CHAT_MSG"', {
        timeout: 5000,
        shell: '/bin/bash',
        env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}`, CHAT_MSG: `Secure chat from Dylan: ${safeMsg}` },
      });
    } catch (err) {
      console.error(`[chat] OpenClaw notify failed: ${err.message}`);
    }

    res.json({ ok: true, received: true });
  } catch (err) {
    console.error(`[chat] Write failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to store message' });
  }
});

app.get('/api/chat/history', (_req, res) => {
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

// ==================== Health ====================

app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Health monitoring endpoint — runs the health check script and returns results
app.get('/api/health-monitor', async (req, res) => {
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

// ==================== RBAC / User Management ====================

// List all users (profiles table)
app.get('/api/users', async (req, res) => {
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
app.get('/api/users/me', async (req, res) => {
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
app.post('/api/users/invite', async (req, res) => {
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
app.patch('/api/users/:id/role', async (req, res) => {
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
app.patch('/api/users/:id/status', async (req, res) => {
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
app.delete('/api/users/:id', async (req, res) => {
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CoreConX API server running on http://0.0.0.0:${PORT}`);
  console.log(`Tailscale: http://100.70.32.111:${PORT}`);
});

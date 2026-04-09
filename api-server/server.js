import express from 'express';
import cors from 'cors';
import { execSync, exec } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

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
  exec(`/opt/homebrew/bin/openclaw system event --text '${text.replace(/'/g, "\\'")}' --mode now`, (err) => {
    if (err) console.error('OpenClaw notify failed:', err.message);
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
    const labelIdList = currentLabelIds.map(lid => `"${lid}"`).join(', ');

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
    res.json(JSON.parse(raw));
  } catch {
    res.json({ raw });
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

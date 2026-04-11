import { Router } from 'express';
import { execFile } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { linearQuery } from '../helpers.js';

const router = Router();

const EVENTS_PATH = process.env.TASK_EVENTS_PATH || (process.env.HOME + '/.openclaw/workspace/task-events.json');

function loadEvents() {
  try {
    if (existsSync(EVENTS_PATH)) return JSON.parse(readFileSync(EVENTS_PATH, 'utf-8'));
  } catch { /* corrupt file */ }
  return [];
}

function saveEvent(event) {
  const events = loadEvents();
  events.push({ ...event, timestamp: new Date().toISOString() });
  if (events.length > 500) events.splice(0, events.length - 500);
  writeFileSync(EVENTS_PATH, JSON.stringify(events, null, 2));
  return events;
}

router.get('/', (req, res) => {
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

router.get('/states', (req, res) => {
  if (!process.env.LINEAR_API_KEY) {
    return res.status(500).json({ error: 'LINEAR_API_KEY not set' });
  }

  const result = linearQuery(`{ workflowStates { nodes { id name color type position } } }`);
  if (!result) return res.status(500).json({ error: 'Failed to fetch states' });
  res.json(result.data?.workflowStates?.nodes || []);
});

// ==================== Linear — Update Issue Status ====================

router.patch('/:id', (req, res) => {
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

router.delete('/:id', (req, res) => {
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

router.post('/:id/approve', (req, res) => {
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

  saveEvent({
    type: 'approved',
    taskId: id,
    identifier: issue.identifier,
    title: issue.title,
    agent: 'dylan',
  });

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

router.post('/:id/unapprove', (req, res) => {
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

// ==================== Task Pickup — Chuck acknowledges a task ====================

router.post('/:id/pickup', (req, res) => {
  const { id } = req.params;
  const { agent = 'chuck', identifier, title } = req.body || {};

  saveEvent({
    type: 'pickup',
    taskId: id,
    identifier: identifier || id,
    title: title || '',
    agent,
  });

  console.log(`[pickup] ${agent} picked up ${identifier || id}: ${title || '(no title)'}`);
  res.json({ acknowledged: true });
});

// ==================== Task Progress — Chuck reports progress ====================

router.post('/:id/progress', (req, res) => {
  const { id } = req.params;
  const { agent = 'chuck', identifier, message, status } = req.body || {};

  saveEvent({
    type: 'progress',
    taskId: id,
    identifier: identifier || id,
    agent,
    message: message || '',
    status: status || 'in_progress',
  });

  console.log(`[progress] ${identifier || id}: ${message}`);
  res.json({ recorded: true });
});

// ==================== Task Events Feed ====================

router.get('/events', (req, res) => {
  const events = loadEvents();
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const since = req.query.since ? new Date(req.query.since) : null;

  let filtered = events;
  if (since) {
    filtered = events.filter(e => new Date(e.timestamp) > since);
  }

  res.json(filtered.slice(-limit));
});

// ==================== Linear — Team Members ====================

router.get('/members', (req, res) => {
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

router.post('/:id/assign', (req, res) => {
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

export default router;

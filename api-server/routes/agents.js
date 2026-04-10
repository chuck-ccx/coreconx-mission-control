import { Router } from 'express';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { linearQuery } from '../helpers.js';

const router = Router();

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

router.get('/', (req, res) => {
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
router.put('/:id/toggle', (req, res) => {
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

export default router;

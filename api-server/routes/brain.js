import { Router } from 'express';
import { readFileSync, existsSync, readdirSync } from 'fs';

const router = Router();

const VAULT_PATH = '/Users/chucka.i./.openclaw/Chuck\'s Files';

router.get('/mistakes', (_req, res) => {
  try {
    const raw = readFileSync(`${VAULT_PATH}/mistakes/mistakes.md`, 'utf-8');
    const entries = raw.split(/^## /m).filter(Boolean).slice(1).map(block => {
      const lines = block.trim().split('\n');
      const title = lines[0] || '';
      const body = lines.slice(1).join('\n').trim();
      return { title, body };
    });
    res.json(entries);
  } catch (_e) { res.json([]); }
});

router.get('/daily', (_req, res) => {
  try {
    const dailyDir = `${VAULT_PATH}/daily`;
    if (!existsSync(dailyDir)) return res.json([]);
    const files = readdirSync(dailyDir).filter(f => f.endsWith('.md')).sort().reverse().slice(0, 14);
    const logs = files.map(f => ({
      date: f.replace('.md', ''),
      content: readFileSync(`${dailyDir}/${f}`, 'utf-8').slice(0, 2000)
    }));
    res.json(logs);
  } catch (_e) { res.json([]); }
});

router.get('/working-context', (_req, res) => {
  try {
    const content = readFileSync(`${VAULT_PATH}/agent-shared/working-context.md`, 'utf-8');
    res.json({ content });
  } catch (_e) { res.json({ content: 'No working context available.' }); }
});

router.get('/agents', (_req, res) => {
  try {
    const agentsDir = '/Users/chucka.i./.openclaw/workspace/agents';
    const registry = readFileSync(`${agentsDir}/REGISTRY.md`, 'utf-8');
    const agentFiles = readdirSync(agentsDir).filter(f => f.endsWith('.md') && f !== 'REGISTRY.md');
    const agents = agentFiles.map(f => {
      const content = readFileSync(`${agentsDir}/${f}`, 'utf-8');
      const nameMatch = content.match(/^# (.+)/m);
      const purposeMatch = content.match(/\*\*Purpose:\*\* (.+)/);
      const tierMatch = content.match(/\*\*Model Tier:\*\* (.+)/);
      return {
        id: f.replace('.md', ''),
        name: nameMatch ? nameMatch[1] : f.replace('.md', ''),
        purpose: purposeMatch ? purposeMatch[1] : '',
        tier: tierMatch ? tierMatch[1] : 'unknown'
      };
    });
    res.json({ registry, agents });
  } catch (_e) { res.json({ registry: '', agents: [] }); }
});

router.get('/memory', (_req, res) => {
  try {
    const raw = readFileSync('/Users/chucka.i./.openclaw/workspace/MEMORY.md', 'utf-8');
    const sections = raw.split(/^## /m).filter(Boolean).map(block => {
      const lines = block.trim().split('\n');
      return { title: lines[0] || '', content: lines.slice(1).join('\n').trim() };
    });
    res.json(sections);
  } catch (_e) { res.json([]); }
});

router.get('/cross-agent-rules', (_req, res) => {
  try {
    const content = readFileSync(`${VAULT_PATH}/agent-shared/cross-agent-rules.md`, 'utf-8');
    res.json({ content });
  } catch (_e) { res.json({ content: '' }); }
});

router.get('/nightly-review-status', (_req, res) => {
  try {
    const filePath = '/Users/chucka.i./.openclaw/workspace/last-nightly-review.txt';
    const content = readFileSync(filePath, 'utf-8').trim();
    const today = new Date().toISOString().split('T')[0];
    const ranToday = content.startsWith(today);
    res.json({ lastRun: content, ranToday, checkedAt: new Date().toISOString() });
  } catch (_e) {
    res.json({ lastRun: 'never', ranToday: false, checkedAt: new Date().toISOString() });
  }
});

export default router;

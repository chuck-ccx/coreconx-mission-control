import { Router } from 'express';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { linearQuery } from '../helpers.js';

const router = Router();

// Helper: run gh CLI command
function gh(args) {
  try {
    const result = execSync(`/opt/homebrew/bin/gh ${args}`, {
      timeout: 15000,
      encoding: 'utf-8',
      env: { ...process.env, PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' },
    });
    return result.trim();
  } catch (e) {
    console.error(`gh error: ${e.message}`);
    return null;
  }
}

// GET /api/activity/prs — GitHub PR status across CoreConX repos
router.get('/prs', (req, res) => {
  const repos = ['wundergunder/coreconx-web', 'chuck-ccx/coreconx-mission-control'];
  const allPRs = [];

  for (const repo of repos) {
    try {
      const raw = gh(`pr list -R ${repo} --state all --limit 20 --json number,title,state,author,createdAt,updatedAt,url,headRefName,isDraft,mergeable,additions,deletions,reviewDecision`);
      if (raw) {
        const prs = JSON.parse(raw);
        allPRs.push(...prs.map(pr => ({ ...pr, repo })));
      }
    } catch (e) {
      console.error(`PR fetch error for ${repo}: ${e.message}`);
    }
  }

  // Sort by updatedAt descending
  allPRs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  res.json(allPRs);
});

// GET /api/activity/feed — unified activity feed from Linear + GitHub
router.get('/feed', (req, res) => {
  const events = [];

  // Recent Linear task updates
  const linearResult = linearQuery(`{
    issues(
      filter: { team: { key: { eq: "COR" } } }
      orderBy: updatedAt
      first: 30
    ) {
      nodes {
        identifier
        title
        state { name }
        assignee { name }
        updatedAt
        labels { nodes { name } }
      }
    }
  }`);

  if (linearResult?.data?.issues?.nodes) {
    for (const issue of linearResult.data.issues.nodes) {
      events.push({
        type: 'task',
        id: issue.identifier,
        title: issue.title,
        status: issue.state?.name,
        assignee: issue.assignee?.name || 'Unassigned',
        labels: issue.labels?.nodes?.map(l => l.name) || [],
        timestamp: issue.updatedAt,
      });
    }
  }

  // Recent GitHub commits on main branches
  const repos = ['wundergunder/coreconx-web', 'chuck-ccx/coreconx-mission-control'];
  for (const repo of repos) {
    try {
      const raw = gh(`api repos/${repo}/commits?per_page=10 --jq '.[] | {sha: .sha, message: .commit.message, author: .commit.author.name, date: .commit.author.date}'`);
      if (raw) {
        for (const line of raw.split('\n')) {
          if (!line.trim()) continue;
          try {
            const commit = JSON.parse(line);
            events.push({
              type: 'commit',
              id: commit.sha?.substring(0, 7),
              title: commit.message?.split('\n')[0],
              author: commit.author,
              repo,
              timestamp: commit.date,
            });
          } catch { /* skip malformed */ }
        }
      }
    } catch (e) {
      console.error(`Commit fetch error for ${repo}: ${e.message}`);
    }
  }

  // Sort all events by timestamp descending
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  res.json(events.slice(0, 50));
});

// GET /api/activity/agents — agent session logs
router.get('/agents', (req, res) => {
  const logs = [];

  // Read daily log files for agent activity
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const workspace = process.env.WORKSPACE_DIR || '/Users/chucka.i./.openclaw/workspace';

  for (const date of [today, yesterday]) {
    const logPath = `${workspace}/memory/${date}.md`;
    if (existsSync(logPath)) {
      try {
        const content = readFileSync(logPath, 'utf-8');
        // Extract task-related entries
        const lines = content.split('\n');
        for (const line of lines) {
          const taskMatch = line.match(/\*\*(COR-\d+)\*\*.*?[—–-]\s*(.+)/);
          if (taskMatch) {
            logs.push({
              id: taskMatch[1],
              summary: taskMatch[2].trim(),
              date,
              raw: line.trim(),
            });
          }
        }
      } catch { /* skip */ }
    }
  }

  res.json(logs);
});

export default router;

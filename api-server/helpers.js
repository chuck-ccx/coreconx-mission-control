import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper: run gog command and return output
export function gog(args, timeoutMs = 30000) {
  try {
    const result = execSync(`/opt/homebrew/bin/gog -a chuck@coreconx.group ${args}`, {
      timeout: timeoutMs,
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
export function linearQuery(query) {
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

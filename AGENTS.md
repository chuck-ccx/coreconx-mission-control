<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Mission Control — Read Before Coding

**MANDATORY:** Read `agents/mc-architecture.md` before making any changes. It has the full stack, route structure, env vars, deploy pipeline, and common mistakes to avoid.

Key rules:
- This is a **static export** (`output: "export"`) — NO SSR, NO Next.js API routes
- All backend logic goes in `api-server/routes/` (Express.js on PM2)
- All frontend data fetching uses `src/lib/api.ts` → `apiFetch()`
- Always run `npm run lint && npm run build` before committing
- GitHub org is `chuck-ccx` — NEVER `wundergunder`

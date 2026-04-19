#!/usr/bin/env node

/**
 * Email Enrichment Script — COR-133
 *
 * Pipeline:
 *   - Load Contacts + Companies cache.
 *   - For each contact missing a valid email (but with a name + company domain):
 *       * Generate candidate patterns.
 *       * Verify via Hunter.io /v2/email-verifier (domain-search is BANNED).
 *       * Cross-verify winner via ZeroBounce /v2/validate.
 *       * Only write if BOTH services agree (Hunter valid OR accept_all+score>=80;
 *         ZeroBounce status == 'valid').
 *   - Re-verify the existing valid emails via ZeroBounce to flag bad ones.
 *   - Preserve column order (COR-114 bug-preventing) when writing back.
 *   - Emit docs/enrichment-report.json.
 *
 * Usage:  node scripts/enrich-emails.js [--write] [--limit N]
 *         (without --write, performs dry-run and still writes the report)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { URL } from 'url';
import https from 'https';

// ───── env loading ───────────────────────────────────────────
function loadEnv(p) {
  if (!existsSync(p)) return;
  const txt = readFileSync(p, 'utf-8');
  for (const line of txt.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv('/Users/chucka.i./.openclaw/workspace/.env');

const HUNTER_API_KEY = process.env.HUNTER_API_KEY;
const ZEROBOUNCE_API_KEY = process.env.ZEROBOUNCE_API_KEY;
if (!HUNTER_API_KEY || !ZEROBOUNCE_API_KEY) {
  console.error('Missing HUNTER_API_KEY or ZEROBOUNCE_API_KEY in env.');
  process.exit(1);
}

// ───── config ────────────────────────────────────────────────
const WRITE = process.argv.includes('--write');
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit');
  return i >= 0 ? parseInt(process.argv[i + 1], 10) : Infinity;
})();

const SHEET_ID = process.env.CRM_SHEET_ID || '1arbZpTV9DSVS8w-4FA8XhV59x_DWxpGIP1dI5vxX3ak';
const CONTACTS_CACHE = './api-server/cache/crm-contacts.json';
const COMPANIES_CACHE = './api-server/cache/crm-companies.json';
const REPORT_PATH = './docs/enrichment-report.json';

// The real Contacts header row (A1 in the sheet is polluted with stale data).
// We hold the logical header for mapping by name — we do NOT write this back to A1.
const LOGICAL_HEADERS = [
  'Company Name', 'Contact Name', 'Title/Role', 'Email', 'Phone',
  'LinkedIn', 'Preferred Channel', 'Decision Maker?', 'Relationship Status',
  'Last Contact Date', 'Next Follow-up', 'Notes',
  'source_type', 'source_url', 'verification_status',
  'risk_flags', 'confidence', 'send_ready', 'reason', 'checked_at',
];

const GENERIC_PREFIXES = new Set([
  'info', 'admin', 'contact', 'contactus', 'sales', 'hello',
  'support', 'office', 'enquiries', 'inquiries', 'general',
  'hr', 'careers', 'jobs', 'marketing', 'accounts', 'accounting',
  'billing', 'webmaster', 'postmaster', 'mail',
]);

// ───── utilities ─────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function httpGetJSON(urlStr) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    https.get({
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: { 'User-Agent': 'coreconx-enrich/1.0' },
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: { raw: data, parseError: e.message } });
        }
      });
    }).on('error', reject);
  });
}

function asciiFold(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

function splitName(full) {
  const cleaned = (full || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return { first: '', last: '' };
  // Drop common suffixes like Jr., Sr., III before splitting
  const parts = cleaned.split(' ').filter(p => !/^(jr|sr|ii|iii|iv)\.?$/i.test(p));
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts[parts.length - 1] };
}

function isGenericLocalPart(email) {
  if (!email) return false;
  const local = email.split('@')[0].toLowerCase();
  return GENERIC_PREFIXES.has(local);
}

function normalizeDomain(website) {
  if (!website) return '';
  let d = website.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '').replace(/^www\./, '');
  d = d.split(/[\/?#]/)[0];
  return d;
}

function generateCandidates(first, last, domain) {
  const f = asciiFold(first);
  const l = asciiFold(last);
  if (!f || !domain) return [];
  const patterns = new Set();
  if (f) patterns.add(`${f}`);
  if (f && l) {
    patterns.add(`${f}.${l}`);
    patterns.add(`${f[0]}${l}`);
    patterns.add(`${f}${l[0]}`);
    patterns.add(`${f}.${l[0]}`);
    patterns.add(`${f}${l}`);
    patterns.add(`${f}_${l}`);
  }
  return [...patterns].map(lp => `${lp}@${domain}`);
}

// ───── cache loading ─────────────────────────────────────────
function loadContacts() {
  const d = JSON.parse(readFileSync(CONTACTS_CACHE, 'utf-8'));
  return { range: d.range, rawRows: d.values }; // row 0 is the (polluted) header row
}

function loadCompanies() {
  // NOTE: Companies sheet A1 cell is polluted (contains stray data, not "Company Name").
  // Use positional columns: col 0 = Company Name, col 1 = Website. Skip row 0 as header.
  const d = JSON.parse(readFileSync(COMPANIES_CACHE, 'utf-8'));
  const rows = d.values.slice(1);
  return rows.map(r => ({
    name: (r[0] || '').trim(),
    website: (r[1] || '').trim(),
  })).filter(c => c.name);
}

function domainForCompany(companies, companyName) {
  if (!companyName) return '';
  const needle = companyName.toLowerCase().trim();
  const match = companies.find(c => c.name.toLowerCase() === needle);
  if (!match) return '';
  return normalizeDomain(match.website);
}

// ───── Hunter + ZeroBounce ───────────────────────────────────
let hunterCalls = 0;
let zbCalls = 0;

let hunterExhausted = false;

async function hunterVerify(email) {
  if (hunterExhausted) return { ok: false, status: 'plan_exhausted', score: 0 };
  hunterCalls++;
  const url = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${HUNTER_API_KEY}`;
  const { status, body } = await httpGetJSON(url);
  await sleep(120); // ≈8 req/sec, well under 10
  if (body && Array.isArray(body.errors)) {
    const err = body.errors[0] || {};
    if (err.id === 'too_many_requests' || err.code === 429 || err.code === 402) {
      hunterExhausted = true;
      console.error(`Hunter plan exhausted: ${err.details}`);
    }
    return { ok: false, status: `error:${err.id || err.code}`, score: 0, error: err.details };
  }
  if (status !== 200 || !body || !body.data) {
    return { ok: false, status: `http:${status}`, score: 0, raw: { status, body } };
  }
  const d = body.data;
  const score = typeof d.score === 'number' ? d.score : 0;
  const result = d.result || d.status || '';
  const pass = result === 'valid' || (result === 'accept_all' && score >= 80);
  return {
    ok: pass,
    status: result,
    score,
    disposable: !!d.disposable,
    webmail: !!d.webmail,
    raw: d,
  };
}

async function zbVerify(email) {
  zbCalls++;
  const url = `https://api.zerobounce.net/v2/validate?api_key=${ZEROBOUNCE_API_KEY}&email=${encodeURIComponent(email)}`;
  const { status, body } = await httpGetJSON(url);
  await sleep(120);
  if (status !== 200 || !body) return { ok: false, status: 'error', raw: { status, body } };
  return {
    ok: body.status === 'valid',
    status: body.status || '',
    sub_status: body.sub_status || '',
    raw: body,
  };
}

// ───── main ──────────────────────────────────────────────────
async function main() {
  console.log(`=== COR-133 Email Enrichment ===`);
  console.log(`Mode: ${WRITE ? 'WRITE (will update sheet)' : 'DRY-RUN'}`);

  const companies = loadCompanies();
  const { rawRows } = loadContacts();

  const headerIdx = Object.fromEntries(LOGICAL_HEADERS.map((h, i) => [h, i]));
  const COL = {
    company: 0,
    name: headerIdx['Contact Name'],
    email: headerIdx['Email'],
    verif: headerIdx['verification_status'],
    risk: headerIdx['risk_flags'],
    conf: headerIdx['confidence'],
    sendReady: headerIdx['send_ready'],
    reason: headerIdx['reason'],
    checkedAt: headerIdx['checked_at'],
    source: headerIdx['source_type'],
    sourceUrl: headerIdx['source_url'],
  };

  const results = [];
  const genericOnly = [];
  const nowFlaggedBad = [];

  // Snapshot before count (valid emails in Email column, any verification_status)
  const beforeValidCount = rawRows.slice(1)
    .filter(r => {
      const em = (r[COL.email] || '').trim();
      const v = (r[COL.verif] || '').trim().toUpperCase();
      return em.includes('@') && (v === 'VALID' || v === '' || v === 'CATCH_ALL');
    }).length;

  const rowsToWrite = []; // { rowIndex (1-based in sheet), row (full array) }
  let processed = 0;

  for (let i = 1; i < rawRows.length; i++) {
    if (processed >= LIMIT) break;
    const sheetRow = i + 1; // 1-based row number in Google Sheet (row 1 is header)
    const original = rawRows[i].slice();
    // pad to full column width
    while (original.length < LOGICAL_HEADERS.length) original.push('');

    const company = (original[COL.company] || '').trim();
    const name = (original[COL.name] || '').trim();
    const existingEmail = (original[COL.email] || '').trim();
    const existingVerif = (original[COL.verif] || '').trim().toUpperCase();

    if (!name && !existingEmail) continue; // skip blank rows

    const { first, last } = splitName(name);
    const domain = domainForCompany(companies, company);

    const record = {
      sheet_row: sheetRow,
      company,
      name,
      existing_email: existingEmail,
      domain,
      action: null,
      reason: null,
    };

    // CASE 1 — row already has an email → re-verify via ZeroBounce (only if not freshly verified)
    if (existingEmail && existingEmail.includes('@')) {
      // Skip ones we already marked INVALID/CATCH_ALL recently (avoid duplicate spend)
      // but re-check blanks and VALID stamps as instructed ("re-verify the existing 6 through ZB").
      if (existingVerif === 'INVALID' || existingVerif === 'SPAMTRAP') {
        record.action = 'skip-already-bad';
        record.reason = `prior ${existingVerif}`;
        results.push(record);
        processed++;
        continue;
      }
      const zb = await zbVerify(existingEmail);
      record.zb_status = zb.status;
      record.zb_sub = zb.sub_status;
      if (zb.ok) {
        record.action = 'reverified-valid';
        // stamp the row
        original[COL.verif] = 'VALID';
        original[COL.sendReady] = 'true';
        original[COL.reason] = `ZB:${zb.status}`;
        original[COL.checkedAt] = new Date().toISOString();
        rowsToWrite.push({ sheetRow, row: original });
      } else {
        const bad = zb.status === 'invalid' || zb.status === 'spamtrap' || zb.status === 'abuse';
        record.action = bad ? 'flag-bad' : 'zb-uncertain';
        if (bad) {
          nowFlaggedBad.push({ row: sheetRow, company, name, email: existingEmail, zb_status: zb.status, zb_sub: zb.sub_status });
          original[COL.verif] = zb.status === 'spamtrap' ? 'SPAMTRAP' : 'INVALID';
          original[COL.sendReady] = 'false';
          original[COL.risk] = zb.sub_status || zb.status;
          original[COL.reason] = `ZB flagged bad: ${zb.status}/${zb.sub_status}`;
          original[COL.checkedAt] = new Date().toISOString();
          rowsToWrite.push({ sheetRow, row: original });
        } else {
          original[COL.verif] = (zb.status || 'UNKNOWN').toUpperCase();
          original[COL.sendReady] = 'false';
          original[COL.reason] = `ZB ${zb.status}`;
          original[COL.checkedAt] = new Date().toISOString();
          rowsToWrite.push({ sheetRow, row: original });
        }
      }
      results.push(record);
      processed++;
      continue;
    }

    // CASE 2 — row missing email: attempt to derive
    if (!name || !domain) {
      record.action = 'skip-insufficient';
      record.reason = !name ? 'no name' : 'no company domain';
      results.push(record);
      continue;
    }

    const candidates = generateCandidates(first, last, domain);
    record.candidates = candidates;

    let winner = null;
    let hunterWinner = null;
    const hunterTried = [];

    for (const cand of candidates) {
      const h = await hunterVerify(cand);
      hunterTried.push({ email: cand, status: h.status, score: h.score });
      if (h.ok && !h.disposable) {
        hunterWinner = { email: cand, ...h };
        break;
      }
    }
    record.hunter_tried = hunterTried;

    if (!hunterWinner) {
      record.action = 'not_found';
      record.reason = 'no hunter match';
      results.push(record);
      processed++;
      continue;
    }

    // Reject if only a generic mailbox survived AND is paired with a personal name
    if (isGenericLocalPart(hunterWinner.email)) {
      genericOnly.push({ row: sheetRow, company, name, email: hunterWinner.email, hunter_status: hunterWinner.status });
      record.action = 'generic-only';
      record.reason = `generic mailbox ${hunterWinner.email} not paired with personal contact`;
      results.push(record);
      processed++;
      continue;
    }

    // ZeroBounce cross-check
    const zb = await zbVerify(hunterWinner.email);
    record.zb_status = zb.status;
    record.zb_sub = zb.sub_status;

    if (!zb.ok) {
      record.action = 'hunter-pass-zb-fail';
      record.reason = `ZB ${zb.status}/${zb.sub_status}`;
      results.push(record);
      processed++;
      continue;
    }

    // WRITE — winner survived both checks
    winner = hunterWinner.email;
    record.action = 'verified';
    record.winner = winner;

    original[COL.email] = winner;
    original[COL.verif] = 'VALID';
    original[COL.sendReady] = 'true';
    original[COL.conf] = String(hunterWinner.score || 90);
    original[COL.source] = 'hunter+zerobounce';
    original[COL.sourceUrl] = `https://hunter.io/email-verifier/${winner}`;
    original[COL.reason] = `Hunter:${hunterWinner.status} ZB:${zb.status}`;
    original[COL.checkedAt] = new Date().toISOString();
    rowsToWrite.push({ sheetRow, row: original });

    results.push(record);
    processed++;
  }

  // Compute after count
  const afterValid = results.filter(r => r.action === 'verified' || r.action === 'reverified-valid').length;

  // ── Write back to the sheet (preserve column order by submitting A{n}:T{n} full row)
  if (WRITE && rowsToWrite.length) {
    console.log(`Writing ${rowsToWrite.length} rows back to the Contacts sheet...`);
    for (const { sheetRow, row } of rowsToWrite) {
      // Always submit exactly LOGICAL_HEADERS.length columns: A..T (20 cols)
      const endCol = 'T';
      const range = `Contacts!A${sheetRow}:${endCol}${sheetRow}`;
      const payload = JSON.stringify([row.slice(0, LOGICAL_HEADERS.length)]);
      try {
        execSync(
          `gog -a chuck@coreconx.group sheets update ${SHEET_ID} "${range}" --values-json '${payload.replace(/'/g, "'\\''")}' --input USER_ENTERED`,
          { stdio: ['ignore', 'pipe', 'pipe'] }
        );
      } catch (e) {
        console.error(`  ! Failed row ${sheetRow}: ${e.message}`);
      }
    }
  }

  // ── Write report
  const report = {
    timestamp: new Date().toISOString(),
    mode: WRITE ? 'write' : 'dry-run',
    before_valid_count: beforeValidCount,
    after_valid_count: afterValid + (WRITE ? 0 : 0), // newly-verified this run
    api_calls: { hunter: hunterCalls, zerobounce: zbCalls },
    generic_only: genericOnly,
    newly_flagged_bad: nowFlaggedBad,
    rows_written: WRITE ? rowsToWrite.length : 0,
    results,
  };
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log('=== SUMMARY ===');
  console.log(`Before (had email): ${beforeValidCount}`);
  console.log(`Newly verified this run: ${afterValid}`);
  console.log(`Generic-only (not written): ${genericOnly.length}`);
  console.log(`Previously-good flagged bad: ${nowFlaggedBad.length}`);
  console.log(`Hunter calls: ${hunterCalls}, ZeroBounce calls: ${zbCalls}`);
  console.log(`Report: ${REPORT_PATH}`);
  if (!WRITE) console.log(`\nDry-run complete. Re-run with --write to push to sheet.`);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});

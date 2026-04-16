import { Router } from 'express';
import { readFileSync, existsSync } from 'fs';
import { gog, supabase } from '../helpers.js';
import { authMiddleware } from './auth.js';

const router = Router();

const CRM_SHEET_ID = process.env.CRM_SHEET_ID || '1arbZpTV9DSVS8w-4FA8XhV59x_DWxpGIP1dI5vxX3ak';

function filterEmptyRows(rows) {
  if (!rows) return rows;
  return rows.filter(row => {
    const firstVal = Object.values(row)[0];
    return firstVal && firstVal.trim() !== '';
  });
}

function parseCSV(text) {
  const lines = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === '\n' && !inQuotes) { lines.push(current); current = ''; continue; }
    if (ch === '\r' && !inQuotes) continue;
    current += ch;
  }
  if (current.trim()) lines.push(current);
  return lines.filter(l => l.trim()).map(l => l.split(','));
}

const CACHE_DIR = new URL('./cache', new URL('../', import.meta.url)).pathname;

function readCache(cacheFile) {
  try {
    const path = `${CACHE_DIR}/${cacheFile}`;
    if (!existsSync(path)) return null;
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    if (!data.values || data.values.length < 2) return [];
    const headers = data.values[0];
    return data.values.slice(1).map(cols => {
      const obj = {};
      headers.forEach((h, i) => { obj[h.trim()] = (cols[i] || '').trim(); });
      return obj;
    });
  } catch (e) {
    console.error(`Cache read error: ${e.message}`);
    return null;
  }
}

function getSheetData(sheetId, range) {
  const raw = gog(`sheets get ${sheetId} "${range}" -p`);
  if (raw) {
    const lines = raw.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split('\t');
    const rows = lines.slice(1).map(line => {
      const cols = line.split('\t');
      const obj = {};
      headers.forEach((h, i) => { obj[h.trim()] = (cols[i] || '').trim(); });
      return obj;
    });
    return filterEmptyRows(rows);
  }
  // Fallback 1: JSON cache files (refreshed by cron/script)
  const cacheMap = {
    'Companies!A1:Z100': 'crm-companies.json',
    'Contacts!A1:Z100': 'crm-contacts.json',
  };
  const cacheFile = cacheMap[range];
  if (cacheFile) {
    console.log(`Sheets API failed for ${range}, using cache fallback...`);
    const cached = readCache(cacheFile);
    if (cached !== null) return filterEmptyRows(cached);
  }
  // Fallback 2: CSV export via Drive API
  console.log(`Cache miss for ${range}, trying CSV export fallback...`);
  const exportResult = gog(`sheets export ${sheetId} --format csv`);
  if (!exportResult) return null;
  const pathMatch = exportResult.match(/path\t(.+)/);
  if (!pathMatch) return null;
  try {
    const csvText = readFileSync(pathMatch[1].trim(), 'utf-8');
    const csvRows = parseCSV(csvText);
    if (csvRows.length < 2) return [];
    const headers = csvRows[0];
    const mapped = csvRows.slice(1).map(cols => {
      const obj = {};
      headers.forEach((h, i) => { obj[h.trim()] = (cols[i] || '').trim(); });
      return obj;
    });
    return filterEmptyRows(mapped);
  } catch (e) {
    console.error(`CSV fallback error: ${e.message}`);
    return null;
  }
}

router.get('/companies', (req, res) => {
  const data = getSheetData(CRM_SHEET_ID, 'Companies!A1:Z100');
  if (data === null) return res.status(500).json({ error: 'Failed to fetch CRM data' });
  res.json(data);
});

router.get('/contacts', (req, res) => {
  const data = getSheetData(CRM_SHEET_ID, 'Contacts!A1:Z100');
  if (data === null) return res.status(500).json({ error: 'Failed to fetch contacts' });
  res.json(data);
});

router.get('/pipeline', (req, res) => {
  const raw = gog(`sheets get ${CRM_SHEET_ID} "Pipeline!A1:Z100" -p`);
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

  res.json(filterEmptyRows(pipeline));
});

// ==================== CRM via Supabase ====================

router.get('/supabase/companies', async (req, res) => {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/supabase/companies', authMiddleware, async (req, res) => {
  const { name, website, province_state, country, city, num_rigs, specialties, size, lead_status, lead_score, priority, notes, recent_intel, pipeline_stage, deal_value } = req.body;
  if (!name) return res.status(400).json({ error: 'Company name is required' });
  const { data, error } = await supabase
    .from('companies')
    .insert({ name, website, province_state, country, city, num_rigs: num_rigs || null, specialties, size, lead_status: lead_status || 'Research', lead_score: lead_score || 0, priority, notes, recent_intel, pipeline_stage: pipeline_stage || 'Lead', deal_value: deal_value || null })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.patch('/supabase/companies/:id', authMiddleware, async (req, res) => {
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

router.get('/supabase/contacts', async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/supabase/contacts', authMiddleware, async (req, res) => {
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

router.patch('/supabase/contacts/:id', authMiddleware, async (req, res) => {
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

// ==================== CRM Documents (Supabase) ====================

router.get('/documents/:companyName', async (req, res) => {
  const companyName = decodeURIComponent(req.params.companyName);
  const { data, error } = await supabase
    .from('crm_documents')
    .select('*')
    .eq('company_name', companyName)
    .order('created_at');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/documents/:companyName', authMiddleware, async (req, res) => {
  const companyName = decodeURIComponent(req.params.companyName);
  const { name, status, sent_date, signed_date } = req.body;
  if (!name) return res.status(400).json({ error: 'Document name is required' });
  const { data, error } = await supabase
    .from('crm_documents')
    .insert({ company_name: companyName, name, status: status || 'Not Sent', sent_date: sent_date || null, signed_date: signed_date || null })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.patch('/documents/:companyName/:docId', authMiddleware, async (req, res) => {
  const docId = req.params.docId;
  const updates = {};
  if (req.body.status !== undefined) updates.status = req.body.status;
  if (req.body.sent_date !== undefined) updates.sent_date = req.body.sent_date;
  if (req.body.signed_date !== undefined) updates.signed_date = req.body.signed_date;
  const { data, error } = await supabase
    .from('crm_documents')
    .update(updates)
    .eq('id', docId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;

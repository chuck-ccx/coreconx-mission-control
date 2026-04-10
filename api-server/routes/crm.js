import { Router } from 'express';
import { readFileSync, existsSync } from 'fs';
import { gog, supabase } from '../helpers.js';

const router = Router();

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
    return lines.slice(1).map(line => {
      const cols = line.split('\t');
      const obj = {};
      headers.forEach((h, i) => { obj[h.trim()] = (cols[i] || '').trim(); });
      return obj;
    });
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
    if (cached !== null) return cached;
  }
  // Fallback 2: CSV export via Drive API
  console.log(`Cache miss for ${range}, trying CSV export fallback...`);
  const exportResult = gog(`sheets export ${sheetId} --format csv`);
  if (!exportResult) return null;
  const pathMatch = exportResult.match(/path\t(.+)/);
  if (!pathMatch) return null;
  try {
    const csvText = readFileSync(pathMatch[1].trim(), 'utf-8');
    const rows = parseCSV(csvText);
    if (rows.length < 2) return [];
    const headers = rows[0];
    return rows.slice(1).map(cols => {
      const obj = {};
      headers.forEach((h, i) => { obj[h.trim()] = (cols[i] || '').trim(); });
      return obj;
    });
  } catch (e) {
    console.error(`CSV fallback error: ${e.message}`);
    return null;
  }
}

router.get('/companies', (req, res) => {
  const sheetId = '1arbZpTV9DSVS8w-4FA8XhV59x_DWxpGIP1dI5vxX3ak';
  const data = getSheetData(sheetId, 'Companies!A1:Z100');
  if (data === null) return res.status(500).json({ error: 'Failed to fetch CRM data' });
  res.json(data);
});

router.get('/contacts', (req, res) => {
  const sheetId = '1arbZpTV9DSVS8w-4FA8XhV59x_DWxpGIP1dI5vxX3ak';
  const data = getSheetData(sheetId, 'Contacts!A1:Z100');
  if (data === null) return res.status(500).json({ error: 'Failed to fetch contacts' });
  res.json(data);
});

router.get('/pipeline', (req, res) => {
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

router.get('/supabase/companies', async (req, res) => {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/supabase/companies', async (req, res) => {
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

router.patch('/supabase/companies/:id', async (req, res) => {
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

router.post('/supabase/contacts', async (req, res) => {
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

router.patch('/supabase/contacts/:id', async (req, res) => {
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

router.get('/documents/:companyName', (req, res) => {
  const docs = getCompanyDocs(decodeURIComponent(req.params.companyName));
  res.json(docs);
});

router.post('/documents/:companyName', (req, res) => {
  const { name, status, sentDate, signedDate } = req.body;
  if (!name) return res.status(400).json({ error: 'Document name is required' });
  const docs = getCompanyDocs(decodeURIComponent(req.params.companyName));
  docs.push({ name, status: status || 'Not Sent', sentDate: sentDate || null, signedDate: signedDate || null });
  res.json(docs);
});

router.patch('/documents/:companyName/:docIndex', (req, res) => {
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

export default router;

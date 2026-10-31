'use strict';
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const MEDIA_BUCKET = 'media';
const TOKEN_MS = 8 * 60 * 60 * 1000;
const ENQ_STATUSES = ['Pending', 'Confirmed', 'Cancelled'];
const DAY_STATUSES = ['available', 'booked', 'blocked'];
const CONTENT_KEYS = ['tagline', 'hall', 'contact', 'facilities', 'events', 'gallery', 'packages', 'menu', 'reviews'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Starting content, used only when the database has no row for a section yet.
const DEFAULTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'db.json'), 'utf8')).content;

const sb = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '8mb' }));

// CORS: only needed if the frontend is hosted on another site (e.g. GitHub Pages).
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use('/api', (req, res, next) => {
  if (!sb) return res.status(503).json({ error: 'The database is not connected. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.' });
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// ---------- helpers ----------
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const fail = (status, message) => { const e = new Error(message); e.status = status; throw e; };
const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const clean = (v, max) => String(v ?? '').trim().slice(0, max);
const digits = (s) => String(s ?? '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
const isMobile = (p) => /^[6-9]\d{9}$/.test(p);
const bookedNote = (name) => 'Booked: ' + name;

// ---------- admin login (signed token, no server memory needed) ----------
const loginAttempts = new Map();
const sign = (value) => crypto.createHmac('sha256', ADMIN_SECRET).update(String(value)).digest('hex');
function makeToken() { const exp = Date.now() + TOKEN_MS; return exp + '.' + sign(exp); }
function checkToken(t) {
  const [exp, sig] = String(t || '').split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const want = sign(exp);
  return sig.length === want.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want));
}
function requireAdmin(req, res, next) {
  if (!checkToken((req.headers.authorization || '').replace(/^Bearer /, ''))) {
    return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
  }
  next();
}

app.post('/api/admin/login', (req, res) => {
  if (!ADMIN_PASSWORD || !ADMIN_SECRET) fail(503, 'Admin is not configured. Set ADMIN_PASSWORD and ADMIN_SECRET on the server.');
  const now = Date.now();
  const rec = loginAttempts.get(req.ip) || { count: 0, until: 0 };
  if (rec.until > now) fail(429, 'Too many wrong attempts. Try again in 15 minutes.');
  const a = crypto.createHash('sha256').update(String(req.body?.password || '')).digest();
  const b = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
  if (!crypto.timingSafeEqual(a, b)) {
    rec.count += 1;
    if (rec.count >= 5) { rec.until = now + 15 * 60 * 1000; rec.count = 0; }
    loginAttempts.set(req.ip, rec);
    fail(401, 'Wrong password.');
  }
  loginAttempts.delete(req.ip);
  res.json({ token: makeToken() });
});
app.post('/api/admin/logout', (req, res) => res.json({ ok: true })); // tokens are stateless; the browser discards it

// ---------- content ----------
async function getContent() {
  const { data, error } = await sb.from('site_content').select('key,value');
  if (error) throw error;
  const out = JSON.parse(JSON.stringify(DEFAULTS));
  for (const row of data) out[row.key] = row.value;
  return out;
}

async function seedIfEmpty() {
  const { count, error } = await sb.from('site_content').select('key', { count: 'exact', head: true });
  if (error) throw error;
  if (count === 0) {
    const rows = Object.entries(DEFAULTS).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }));
    const { error: e2 } = await sb.from('site_content').insert(rows);
    if (e2) throw e2;
    console.log('Starting content saved to the database.');
  }
}

// Validation: only known fields are kept, and text lengths are limited.
const FAC = { icon: 4, title: 120, text: 500, active: 'b' };
const EVT = { title: 120, text: 500, image: 500 };
const GAL = { src: 500, category: 80, caption: 160 };
const PKG = { name: 120, pricing: 120, features: 'l', draft: 'b' };
const REV = { text: 600, name: 120 };
const MENU_ITEM = { id: 40, name: 120, category: 80, description: 400, price: 60, available: 'b' };
const strArr = (v, max, count) => (Array.isArray(v) ? v : []).slice(0, count).map((x) => clean(x, max)).filter(Boolean);
const objArr = (v, count, shape) => {
  if (!Array.isArray(v)) fail(400, 'Expected a list.');
  if (v.length > count) fail(400, 'Too many items in this list.');
  return v.map((it) => {
    const o = {};
    for (const [k, t] of Object.entries(shape)) {
      const x = it?.[k];
      if (t === 'b') o[k] = !!x;
      else if (t === 'l') o[k] = strArr(x, 300, 30);
      else o[k] = clean(x, t);
    }
    return o;
  });
};
const asObj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : fail(400, 'Invalid data.'));

function sanitizeContent(key, v) {
  switch (key) {
    case 'tagline': return clean(v, 200);
    case 'hall': {
      const o = asObj(v);
      return { name: clean(o.name, 120), capacity: clean(o.capacity, 120), note: clean(o.note, 500), areas: strArr(o.areas, 100, 30) };
    }
    case 'contact': {
      const o = asObj(v);
      const phones = strArr(o.phones, 20, 5).map(digits);
      if (phones.some((p) => !isMobile(p))) fail(400, 'Check the phone numbers. Each must be a 10-digit Indian mobile number.');
      const whatsapp = digits(o.whatsapp);
      if (!isMobile(whatsapp)) fail(400, 'Check the WhatsApp number. It must be a 10-digit Indian mobile number.');
      return { address: clean(o.address, 300), phones, whatsapp, mapsQuery: clean(o.mapsQuery, 200), hours: clean(o.hours, 120), wheelchair: !!o.wheelchair, restaurant: clean(o.restaurant, 120) };
    }
    case 'facilities': return objArr(v, 50, FAC);
    case 'events': return objArr(v, 50, EVT);
    case 'gallery': return objArr(v, 300, GAL);
    case 'packages': return objArr(v, 30, PKG);
    case 'reviews': return objArr(v, 50, REV);
    case 'menu': {
      const o = asObj(v);
      const items = objArr(o.items, 300, MENU_ITEM).map((i) => ({ ...i, id: i.id || 'm' + crypto.randomBytes(4).toString('hex') }));
      return { categories: strArr(o.categories, 60, 30), items };
    }
    default: fail(404, 'Unknown section.');
  }
}

// ---------- public API ----------
app.get('/api/content', wrap(async (req, res) => {
  const c = await getContent();
  res.json({
    ...c,
    facilities: c.facilities.filter((f) => f.active),
    menu: { categories: c.menu.categories, items: c.menu.items.filter((i) => i.available) }
  });
}));

app.get('/api/availability', wrap(async (req, res) => {
  const from = isDate(req.query.from) ? req.query.from : todayIST();
  let to = isDate(req.query.to) ? req.query.to : addDays(from, 120);
  if (to > addDays(from, 400)) to = addDays(from, 400);
  const { data, error } = await sb.from('availability').select('day,status').gte('day', from).lte('day', to);
  if (error) throw error;
  const days = {};
  for (const r of data) days[r.day] = r.status;
  res.json({ from, to, days }); // public: status only, never notes or customer data
}));

app.post('/api/enquiries', wrap(async (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true, message: 'Thank you.' }); // honeypot for bots

  const errors = {};
  const name = clean(b.name, 80);
  if (name.length < 2) errors.name = 'Please enter your name.';
  const phone = digits(clean(b.phone, 20));
  if (!isMobile(phone)) errors.phone = 'Enter a valid 10-digit mobile number.';
  const email = clean(b.email, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email or leave it empty.';
  const eventType = clean(b.eventType, 60);
  const content = await getContent();
  if (!content.events.some((e) => e.title === eventType)) errors.eventType = 'Choose an event type.';
  const date = clean(b.date, 10);
  if (!isDate(date) || date < todayIST()) errors.date = 'Choose a date from today onwards.';
  const guests = parseInt(b.guests, 10);
  if (!(guests >= 1 && guests <= 5000)) errors.guests = 'Enter the expected number of guests (1 to 5000).';
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  const { data: day } = await sb.from('availability').select('status').eq('day', date).maybeSingle();
  if (day && day.status !== 'available') {
    return res.status(409).json({ errors: { date: 'Sorry, this date is not available. Please choose another date or call us.' } });
  }
  const { data: dup } = await sb.from('enquiries').select('id').eq('phone', phone).eq('event_date', date).neq('status', 'Cancelled').limit(1);
  if (dup && dup.length) {
    return res.status(409).json({ errors: { date: 'We already have an open enquiry from this number for this date.' } });
  }

  const { data: row, error } = await sb.from('enquiries').insert({
    name, phone, email, event_type: eventType, event_date: date, guests,
    package: clean(b.package, 60), budget: clean(b.budget, 60), requirements: clean(b.requirements, 1000)
  }).select('id').single();
  if (error) throw error;
  res.status(201).json({
    ok: true,
    id: row.id,
    message: 'Thank you! We have received your enquiry for ' + date + '. Our team will contact you to confirm. This is an enquiry, not a confirmed booking.'
  });
}));

// ---------- admin: enquiries ----------
const mapEnquiry = (r) => ({
  id: r.id, createdAt: r.created_at, updatedAt: r.updated_at, status: r.status, name: r.name, phone: r.phone,
  email: r.email, eventType: r.event_type, date: r.event_date, guests: r.guests, package: r.package,
  budget: r.budget, requirements: r.requirements, adminNote: r.admin_note
});

async function setDay(day, status, note) {
  const { error } = await sb.from('availability').upsert({ day, status, note, updated_at: new Date().toISOString() }, { onConflict: 'day' });
  if (error) throw error;
}

app.get('/api/admin/overview', requireAdmin, wrap(async (req, res) => {
  const { data, error } = await sb.from('enquiries').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  const list = data.map(mapEnquiry);
  const today = todayIST();
  const count = (s) => list.filter((e) => e.status === s).length;
  res.json({
    total: list.length, pending: count('Pending'), confirmed: count('Confirmed'), cancelled: count('Cancelled'),
    upcoming: list.filter((e) => e.date >= today && e.status !== 'Cancelled').sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10),
    recent: list.slice(0, 8)
  });
}));

app.get('/api/admin/enquiries', requireAdmin, wrap(async (req, res) => {
  const { data, error } = await sb.from('enquiries').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  res.json(data.map(mapEnquiry));
}));

app.patch('/api/admin/enquiries/:id', requireAdmin, wrap(async (req, res) => {
  const id = req.params.id;
  if (!UUID.test(id)) fail(404, 'Enquiry not found.');
  const { data: e } = await sb.from('enquiries').select('*').eq('id', id).maybeSingle();
  if (!e) fail(404, 'Enquiry not found.');
  const { status, adminNote } = req.body || {};
  const patch = { updated_at: new Date().toISOString() };

  if (status !== undefined) {
    if (!ENQ_STATUSES.includes(status)) fail(400, 'Invalid status.');
    const { data: day } = await sb.from('availability').select('status,note').eq('day', e.event_date).maybeSingle();
    if (status === 'Confirmed') {
      if (day && day.status !== 'available' && day.note !== bookedNote(e.name)) {
        fail(409, 'This date is already marked ' + day.status + ' in the calendar. Free it first or pick another date.');
      }
      await setDay(e.event_date, 'booked', bookedNote(e.name));
    }
    if (status === 'Cancelled' && day && day.note === bookedNote(e.name)) {
      const { error } = await sb.from('availability').delete().eq('day', e.event_date);
      if (error) throw error;
    }
    patch.status = status;
  }
  if (adminNote !== undefined) patch.admin_note = clean(adminNote, 500);

  const { data: up, error } = await sb.from('enquiries').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  res.json(mapEnquiry(up));
}));

app.get('/api/admin/export.csv', requireAdmin, wrap(async (req, res) => {
  const { data, error } = await sb.from('enquiries').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  const rows = data.map(mapEnquiry);
  const cols = ['id', 'createdAt', 'status', 'name', 'phone', 'email', 'eventType', 'date', 'guests', 'package', 'budget', 'requirements', 'adminNote'];
  const esc = (v) => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="enquiries.csv"');
  res.send([cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n'));
}));

// ---------- admin: hall availability ----------
app.get('/api/admin/availability', requireAdmin, wrap(async (req, res) => {
  const { data, error } = await sb.from('availability').select('day,status,note').order('day');
  if (error) throw error;
  const out = {};
  for (const r of data) out[r.day] = { status: r.status, note: r.note };
  res.json(out);
}));

app.put('/api/admin/availability', requireAdmin, wrap(async (req, res) => {
  const { dates, status, note } = req.body || {};
  if (!Array.isArray(dates) || !dates.length || dates.length > 400 || !dates.every(isDate)) fail(400, 'Choose a valid date range.');
  if (!DAY_STATUSES.includes(status)) fail(400, 'Status must be available, booked or blocked.');
  if (status === 'available') {
    const { error } = await sb.from('availability').delete().in('day', dates);
    if (error) throw error;
  } else {
    const now = new Date().toISOString();
    const rows = dates.map((d) => ({ day: d, status, note: clean(note, 200), updated_at: now }));
    const { error } = await sb.from('availability').upsert(rows, { onConflict: 'day' });
    if (error) throw error;
  }
  res.json({ ok: true, updated: dates.length });
}));

// ---------- admin: content ----------
app.get('/api/admin/content', requireAdmin, wrap(async (req, res) => res.json(await getContent())));

app.put('/api/admin/content/:key', requireAdmin, wrap(async (req, res) => {
  const key = req.params.key;
  if (!CONTENT_KEYS.includes(key)) fail(404, 'Unknown section.');
  const value = sanitizeContent(key, req.body?.value);
  const { error } = await sb.from('site_content').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
  res.json({ ok: true, value });
}));

// ---------- admin: photo upload (stored in Supabase Storage) ----------
app.post('/api/admin/upload', requireAdmin, wrap(async (req, res) => {
  const m = /^data:(image\/(jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.dataUrl || ''));
  if (!m) fail(400, 'Please upload a JPG, PNG or WebP image.');
  const buf = Buffer.from(m[3], 'base64');
  if (buf.length > 5 * 1024 * 1024) fail(400, 'The image is larger than 5 MB. Please use a smaller photo.');
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[m[1]];
  const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  const { error } = await sb.storage.from(MEDIA_BUCKET).upload(name, buf, { contentType: m[1], upsert: false });
  if (error) throw error;
  const { data } = sb.storage.from(MEDIA_BUCKET).getPublicUrl(name);
  res.json({ url: data.publicUrl });
}));

// ---------- errors ----------
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That photo is too large. Please use a smaller image.' });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error('Server error:', err && err.message ? err.message : err);
  res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
});

app.listen(PORT, () => {
  console.log('Vaishnavi Banquet server running on port ' + PORT);
  if (sb) seedIfEmpty().catch((e) => console.error('Could not save starting content:', e.message || e));
  else console.warn('WARNING: Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
});

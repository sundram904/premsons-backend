const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'premsons-secret-2024';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Prem@2024!';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const formLimiter = rateLimit({ windowMs: 15*60*1000, max: 10 });

// ── DATABASE ──────────────────────────────────────────────
const db = new sqlite3.Database(path.join(__dirname, 'premsons.db'));

function run(sql, p=[]) { return new Promise((res,rej) => db.run(sql,p,function(e){e?rej(e):res(this)})); }
function get(sql, p=[]) { return new Promise((res,rej) => db.get(sql,p,(e,r)=>e?rej(e):res(r))); }
function all(sql, p=[]) { return new Promise((res,rej) => db.all(sql,p,(e,r)=>e?rej(e):res(r))); }

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS inquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, phone TEXT NOT NULL,
    project TEXT, message TEXT,
    status TEXT DEFAULT 'new',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL
  )`);
  db.get('SELECT id FROM admin WHERE username=?', ['admin'], (e,r) => {
    if (!r) {
      const h = bcrypt.hashSync(ADMIN_PASSWORD, 10);
      db.run('INSERT INTO admin (username,password) VALUES (?,?)', ['admin', h]);
      console.log('✅ Admin created. Password:', ADMIN_PASSWORD);
    }
  });
});

// ── AUTH ──────────────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ success:false, message:'Login required' });
  try { req.admin = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ success:false, message:'Invalid token' }); }
}

// ── PUBLIC API ────────────────────────────────────────────
app.post('/api/inquiry', formLimiter, async (req, res) => {
  const { name, phone, project, message } = req.body;
  if (!name || !phone)
    return res.status(400).json({ success:false, message:'Naam aur phone zaroori hai.' });
  try {
    const r = await run('INSERT INTO inquiries (name,phone,project,message) VALUES (?,?,?,?)',
      [name.trim(), phone.trim(), project||'', message||'']);
    res.json({ success:true, message:'Shukriya! Hum jald aapse sampark karenge.', id:r.lastID });
  } catch(e) {
    res.status(500).json({ success:false, message:'Server error.' });
  }
});

// ── ADMIN API ─────────────────────────────────────────────
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const admin = await get('SELECT * FROM admin WHERE username=?', [username]);
  if (!admin || !bcrypt.compareSync(password, admin.password))
    return res.status(401).json({ success:false, message:'Username ya password galat hai.' });
  const token = jwt.sign({ id:admin.id }, JWT_SECRET, { expiresIn:'8h' });
  res.json({ success:true, token });
});

app.get('/api/admin/stats', auth, async (req, res) => {
  const total      = (await get("SELECT COUNT(*) c FROM inquiries")).c;
  const newL       = (await get("SELECT COUNT(*) c FROM inquiries WHERE status='new'")).c;
  const inProgress = (await get("SELECT COUNT(*) c FROM inquiries WHERE status='in_progress'")).c;
  const closed     = (await get("SELECT COUNT(*) c FROM inquiries WHERE status='closed'")).c;
  const today      = (await get("SELECT COUNT(*) c FROM inquiries WHERE date(created_at)=date('now','localtime')")).c;
  const month      = (await get("SELECT COUNT(*) c FROM inquiries WHERE strftime('%Y-%m',created_at)=strftime('%Y-%m','now','localtime')")).c;
  res.json({ success:true, stats:{ total, new:newL, inProgress, closed, today, month } });
});

app.get('/api/admin/inquiries', auth, async (req, res) => {
  const { status, search, page=1 } = req.query;
  const limit = 20, offset = (page-1)*limit;
  let where = 'WHERE 1=1'; const params = [];
  if (status && status!=='all') { where+=' AND status=?'; params.push(status); }
  if (search) { where+=' AND (name LIKE ? OR phone LIKE ? OR project LIKE ?)'; const s=`%${search}%`; params.push(s,s,s); }
  const cnt = (await get(`SELECT COUNT(*) c FROM inquiries ${where}`, params)).c;
  const rows = await all(`SELECT * FROM inquiries ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params,limit,offset]);
  res.json({ success:true, total:cnt, page:+page, pages:Math.ceil(cnt/limit), data:rows });
});

app.patch('/api/admin/inquiries/:id/status', auth, async (req, res) => {
  const { status } = req.body;
  if (!['new','in_progress','closed'].includes(status))
    return res.status(400).json({ success:false, message:'Invalid status.' });
  await run('UPDATE inquiries SET status=? WHERE id=?', [status, req.params.id]);
  res.json({ success:true });
});

app.delete('/api/admin/inquiries/:id', auth, async (req, res) => {
  await run('DELETE FROM inquiries WHERE id=?', [req.params.id]);
  res.json({ success:true });
});

// ── SERVE ADMIN PAGE ──────────────────────────────────────
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Catch-all: serve index.html for any unknown route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`🚀 Premsons Infra running on port ${PORT}`));

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
const JWT_SECRET = process.env.JWT_SECRET || 'premsons-secret-2024-change-this';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'premsons@2024';

// ── Middleware ─────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiter
const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Bahut zyada requests. 15 minute baad try karein.' }
});

// ── Database Setup ─────────────────────────────────────────
const db = new sqlite3.Database(path.join(__dirname, 'premsons.db'), (err) => {
  if (err) console.error('DB Error:', err);
  else console.log('✅ Database connected');
});

// Helper: run query (INSERT/UPDATE/DELETE)
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

// Helper: get single row
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Helper: get multiple rows
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Create tables + default admin
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS inquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    project TEXT,
    message TEXT,
    status TEXT DEFAULT 'new',
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  )`);

  db.get('SELECT id FROM admin WHERE username = ?', ['admin'], (err, row) => {
    if (!row) {
      const hashed = bcrypt.hashSync(ADMIN_PASSWORD, 10);
      db.run('INSERT INTO admin (username, password) VALUES (?, ?)', ['admin', hashed]);
      console.log('✅ Admin account created. Password:', ADMIN_PASSWORD);
    }
  });
});

// ── Auth Middleware ────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Login required' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

// ── PUBLIC ROUTES ──────────────────────────────────────────

// POST /api/inquiry
app.post('/api/inquiry', formLimiter, async (req, res) => {
  const { name, phone, project, message } = req.body;
  if (!name || !phone)
    return res.status(400).json({ success: false, message: 'Naam aur phone zaroori hai.' });
  if (!/^[6-9]\d{9}$/.test(phone.replace(/\s+/g, '')))
    return res.status(400).json({ success: false, message: 'Valid 10-digit Indian phone number daalen.' });
  try {
    const result = await run(
      'INSERT INTO inquiries (name, phone, project, message) VALUES (?, ?, ?, ?)',
      [name.trim(), phone.trim(), project?.trim() || '', message?.trim() || '']
    );
    res.json({ success: true, message: 'Shukriya! Premsons Infra jald aapse sampark karega.', id: result.lastID });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error. Baad mein try karein.' });
  }
});

// ── ADMIN ROUTES ───────────────────────────────────────────

// POST /api/admin/login
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const admin = await get('SELECT * FROM admin WHERE username = ?', [username]);
  if (!admin || !bcrypt.compareSync(password, admin.password))
    return res.status(401).json({ success: false, message: 'Username ya password galat hai.' });
  const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ success: true, token });
});

// GET /api/admin/inquiries
app.get('/api/admin/inquiries', authMiddleware, async (req, res) => {
  const { status, search, page = 1 } = req.query;
  const limit = 20;
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const params = [];

  if (status && status !== 'all') { where += ' AND status = ?'; params.push(status); }
  if (search) {
    where += ' AND (name LIKE ? OR phone LIKE ? OR project LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  const countRow = await get(`SELECT COUNT(*) as count FROM inquiries ${where}`, params);
  const rows = await all(`SELECT * FROM inquiries ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);

  res.json({ success: true, total: countRow.count, page: +page, pages: Math.ceil(countRow.count / limit), data: rows });
});

// GET /api/admin/stats
app.get('/api/admin/stats', authMiddleware, async (req, res) => {
  const total      = (await get("SELECT COUNT(*) as c FROM inquiries")).c;
  const newLeads   = (await get("SELECT COUNT(*) as c FROM inquiries WHERE status='new'")).c;
  const inProgress = (await get("SELECT COUNT(*) as c FROM inquiries WHERE status='in_progress'")).c;
  const closed     = (await get("SELECT COUNT(*) as c FROM inquiries WHERE status='closed'")).c;
  const today      = (await get("SELECT COUNT(*) as c FROM inquiries WHERE date(created_at)=date('now','localtime')")).c;
  const thisMonth  = (await get("SELECT COUNT(*) as c FROM inquiries WHERE strftime('%Y-%m',created_at)=strftime('%Y-%m','now','localtime')")).c;
  res.json({ success: true, stats: { total, newLeads, inProgress, closed, today, thisMonth } });
});

// PATCH /api/admin/inquiries/:id/status
app.patch('/api/admin/inquiries/:id/status', authMiddleware, async (req, res) => {
  const { status } = req.body;
  if (!['new', 'in_progress', 'closed'].includes(status))
    return res.status(400).json({ success: false, message: 'Invalid status.' });
  await run('UPDATE inquiries SET status = ? WHERE id = ?', [status, req.params.id]);
  res.json({ success: true, message: 'Status update ho gaya.' });
});

// DELETE /api/admin/inquiries/:id
app.delete('/api/admin/inquiries/:id', authMiddleware, async (req, res) => {
  await run('DELETE FROM inquiries WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'Inquiry delete ho gayi.' });
});

// Admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`\n🏗️  Premsons Infra Backend`);
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔐 Admin: /admin\n`);
});

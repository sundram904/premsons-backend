const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'premsons-secret-2024-change-this';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'premsons@2024';

// ── Middleware ─────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiter for contact form (max 5 submissions per 15 min per IP)
const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Bahut zyada requests. 15 minute baad try karein.' }
});

// ── Database Setup ─────────────────────────────────────────
const db = new Database(path.join(__dirname, 'premsons.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS inquiries (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT NOT NULL,
    phone     TEXT NOT NULL,
    project   TEXT,
    message   TEXT,
    status    TEXT DEFAULT 'new',
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS admin (
    id       INTEGER PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );
`);

// Create default admin if not exists
const existingAdmin = db.prepare('SELECT id FROM admin WHERE username = ?').get('admin');
if (!existingAdmin) {
  const hashed = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  db.prepare('INSERT INTO admin (username, password) VALUES (?, ?)').run('admin', hashed);
  console.log('✅ Admin account created. Username: admin | Password:', ADMIN_PASSWORD);
}

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

// POST /api/inquiry — Contact form submission
app.post('/api/inquiry', formLimiter, (req, res) => {
  const { name, phone, project, message } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ success: false, message: 'Naam aur phone zaroori hai.' });
  }
  if (!/^[6-9]\d{9}$/.test(phone.replace(/\s+/g, ''))) {
    return res.status(400).json({ success: false, message: 'Valid 10-digit Indian phone number daalen.' });
  }

  try {
    const stmt = db.prepare(
      'INSERT INTO inquiries (name, phone, project, message) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(
      name.trim(),
      phone.trim(),
      project?.trim() || '',
      message?.trim() || ''
    );
    res.json({
      success: true,
      message: 'Shukriya! Premsons Infra jald aapse sampark karega.',
      id: result.lastInsertRowid
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error. Baad mein try karein.' });
  }
});

// ── ADMIN ROUTES ───────────────────────────────────────────

// POST /api/admin/login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const admin = db.prepare('SELECT * FROM admin WHERE username = ?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password)) {
    return res.status(401).json({ success: false, message: 'Username ya password galat hai.' });
  }
  const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ success: true, token });
});

// GET /api/admin/inquiries — All leads
app.get('/api/admin/inquiries', authMiddleware, (req, res) => {
  const { status, search, page = 1 } = req.query;
  const limit = 20;
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const params = [];

  if (status && status !== 'all') {
    where += ' AND status = ?';
    params.push(status);
  }
  if (search) {
    where += ' AND (name LIKE ? OR phone LIKE ? OR project LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM inquiries ${where}`).get(...params).count;
  const rows = db.prepare(`SELECT * FROM inquiries ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);

  res.json({ success: true, total, page: +page, pages: Math.ceil(total / limit), data: rows });
});

// GET /api/admin/stats — Dashboard numbers
app.get('/api/admin/stats', authMiddleware, (req, res) => {
  const total    = db.prepare("SELECT COUNT(*) as c FROM inquiries").get().c;
  const newLeads = db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE status='new'").get().c;
  const inProgress = db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE status='in_progress'").get().c;
  const closed   = db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE status='closed'").get().c;
  const today    = db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE date(created_at)=date('now','localtime')").get().c;
  const thisMonth= db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE strftime('%Y-%m',created_at)=strftime('%Y-%m','now','localtime')").get().c;

  res.json({ success: true, stats: { total, newLeads, inProgress, closed, today, thisMonth } });
});

// PATCH /api/admin/inquiries/:id/status — Update lead status
app.patch('/api/admin/inquiries/:id/status', authMiddleware, (req, res) => {
  const { status } = req.body;
  const validStatuses = ['new', 'in_progress', 'closed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status.' });
  }
  db.prepare('UPDATE inquiries SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true, message: 'Status update ho gaya.' });
});

// DELETE /api/admin/inquiries/:id
app.delete('/api/admin/inquiries/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM inquiries WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Inquiry delete ho gayi.' });
});

// Admin panel HTML — serve from /admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ── Start Server ───────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏗️  Premsons Infra Backend`);
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔐 Admin panel: http://localhost:${PORT}/admin`);
  console.log(`📋 API ready\n`);
});

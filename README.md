# 🏗️ Premsons Infra — Backend

Node.js + Express + SQLite backend with Admin Panel.

---

## 📁 Files
```
premsons-backend/
├── server.js          ← Main server
├── public/
│   └── admin.html     ← Admin dashboard
├── package.json
├── railway.json       ← Railway deployment config
└── .env.example       ← Environment variables
```

---

## 🚀 Railway pe Deploy kaise karein (FREE)

### Step 1 — GitHub pe upload karein
1. GitHub account banao → github.com
2. New repository banao: `premsons-backend`
3. Yeh saare files upload karo

### Step 2 — Railway pe deploy karein
1. **railway.app** pe jao
2. "Start a New Project" click karo
3. "Deploy from GitHub repo" select karo
4. Apna `premsons-backend` repo select karo
5. Deploy automatically ho jaayega! ✅

### Step 3 — Environment variables set karein
Railway Dashboard → Your Project → Variables tab mein:
```
ADMIN_PASSWORD = apna_strong_password
JWT_SECRET     = koi_bhi_random_string_likhdo
```

### Step 4 — Live URL milegi
Railway ek URL dega jaise:
`https://premsons-backend-production.up.railway.app`

---

## 🔐 Admin Panel
```
URL:      https://your-url.railway.app/admin
Username: admin
Password: jo ADMIN_PASSWORD set kiya
```

---

## 📡 API Endpoints

| Method | URL | Kya karta hai |
|--------|-----|---------------|
| POST | /api/inquiry | Contact form submit |
| POST | /api/admin/login | Admin login |
| GET | /api/admin/inquiries | Sab leads dekho |
| GET | /api/admin/stats | Dashboard numbers |
| PATCH | /api/admin/inquiries/:id/status | Status update |
| DELETE | /api/admin/inquiries/:id | Lead delete |

---

## 🌐 Website se Connect karna

Contact form mein yeh JavaScript add karein:

```javascript
async function submitForm() {
  const res = await fetch('https://YOUR-RAILWAY-URL/api/inquiry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: document.getElementById('name').value,
      phone: document.getElementById('phone').value,
      project: document.getElementById('project').value,
      message: document.getElementById('message').value,
    })
  });
  const data = await res.json();
  alert(data.message);
}
```

---

## 💻 Local mein chalana

```bash
npm install
node server.js
# Open: http://localhost:3000/admin
```

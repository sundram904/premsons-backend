# 🏗️ Premsons Infra — Website Deploy Guide
## Poora Step-by-Step (Koi bhi kar sakta hai!)

---

## 📁 Aapke Files ka Structure
```
premsons-backend/
├── public/
│   ├── index.html     ← 🌐 WEBSITE (frontend)
│   └── admin.html     ← 🔐 ADMIN PANEL
├── server.js          ← ⚙️  BACKEND
├── package.json
└── railway.json
```

---

## 🚀 STEP 1 — GitHub Account Banao (FREE)

1. **github.com** pe jao
2. "Sign Up" karo (email se)
3. Account verify karo

---

## 🚀 STEP 2 — Files GitHub pe Upload Karo

1. GitHub login karo
2. Top-right mein **"+"** button → **"New repository"**
3. Repository name: `premsons-infra`
4. "Public" select karo
5. **"Create repository"** click karo
6. Phir **"uploading an existing file"** link pe click karo
7. Saare files drag & drop karo (folder sahi se upload ho):
   - `server.js`
   - `package.json`
   - `railway.json`
   - `public/index.html`
   - `public/admin.html`
8. **"Commit changes"** click karo ✅

---

## 🚀 STEP 3 — Railway pe Deploy Karo (FREE)

1. **railway.app** pe jao
2. **"Start a New Project"** click karo
3. **"Deploy from GitHub repo"** select karo
4. GitHub account connect karo
5. `premsons-infra` repo select karo
6. Deploy shuru ho jaayega — 2-3 minute lagenge ⏳
7. Deploy ho jaane ke baad **"Settings" → "Domains"** pe jao
8. **"Generate Domain"** click karo
9. Aapko milega kuch aisa:
   `https://premsons-infra-production.up.railway.app`
   
   **Yeh copy karke rakh lo! ⭐**

---

## 🚀 STEP 4 — Environment Variables Set Karo

Railway Dashboard mein:
1. Apna project open karo
2. **"Variables"** tab pe click karo
3. Yeh add karo:

| Variable Name   | Value                    |
|-----------------|--------------------------|
| ADMIN_PASSWORD  | apna_strong_password     |
| JWT_SECRET      | koi_bhi_random_words_likh|

4. **"Add"** → **"Deploy"** click karo

---

## 🚀 STEP 5 — Website mein Railway URL Lagao

1. `public/index.html` file open karo (Notepad se)
2. Yeh line dhundo:
   ```
   const API_URL = 'https://YOUR-RAILWAY-URL.up.railway.app';
   ```
3. Apna Railway URL lagao:
   ```
   const API_URL = 'https://premsons-infra-production.up.railway.app';
   ```
4. File save karo
5. GitHub pe file dobara upload karo (purani replace ho jaayegi)
6. Railway automatically redeploy kar dega ✅

---

## ✅ DONE! Ab Check Karo

| Kya check karein | URL |
|-----------------|-----|
| 🌐 Website | https://your-url.railway.app |
| 🔐 Admin Panel | https://your-url.railway.app/admin |

**Admin Login:**
- Username: `admin`
- Password: jo ADMIN_PASSWORD set kiya

---

## 📞 Agar Koi Problem Aaye

Yeh steps follow karo ya kisi technical friend se help lo.
Premsons Infra office: New Atwarpur, Yadavchak, Kurthaul, Patna – 804453
Phone: +91 91623 58831

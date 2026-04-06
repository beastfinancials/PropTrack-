# PropVault — Setup Guide
## From zero to live in ~20 minutes

---

## STEP 1 — Supabase (your database, free)

1. Go to **supabase.com** → click "Start your project" → sign up
2. Click **"New project"** → name it `propvault` → set a password → pick a region → Create
3. Wait ~2 minutes for it to spin up
4. In the left sidebar click **"SQL Editor"**
5. Copy the entire contents of `supabase-schema.sql` and paste it → click **"Run"**
6. In the left sidebar click **"Authentication"** → **"Providers"**
7. Enable **Google** provider — follow Supabase's guide to get Google OAuth credentials (takes ~5 min at console.cloud.google.com)
8. Go to **Project Settings → API** and copy:
   - `Project URL` (looks like https://xxxx.supabase.co)
   - `anon public` key

---

## STEP 2 — GitHub (where your code lives, free)

1. Go to **github.com** → sign up or sign in
2. Click **"New repository"** → name it `propvault` → set to **Private** → Create
3. Click **"uploading an existing file"** link
4. Upload ALL the files from this folder maintaining the folder structure:
   - `package.json`
   - `src/App.js`
   - `src/App.css`
   - `src/index.js`
   - `src/lib/supabase.js`
   - `src/pages/AuthPage.js`
   - `src/pages/Dashboard.js`
   - `public/index.html`
5. Commit the files

---

## STEP 3 — Vercel (deploys your app, free)

1. Go to **vercel.com** → sign up with GitHub
2. Click **"Add New Project"** → select your `propvault` repo → click Import
3. Before clicking Deploy, click **"Environment Variables"** and add:
   - `REACT_APP_SUPABASE_URL` = your Supabase Project URL
   - `REACT_APP_SUPABASE_ANON_KEY` = your Supabase anon key
4. Click **Deploy** — Vercel builds and deploys automatically (~2 min)
5. You'll get a URL like `propvault.vercel.app` — that's your app!

---

## STEP 4 — Final Supabase config

1. Back in Supabase → **Authentication → URL Configuration**
2. Add your Vercel URL to **"Site URL"**: `https://propvault.vercel.app`
3. Add to **"Redirect URLs"**: `https://propvault.vercel.app/**`

---

## STEP 5 — Share with your group

Just send them the Vercel URL. Each person creates their own account. Their data is 100% private — Row Level Security means nobody can see anyone else's data.

---

## Updating the app later

If you want to make changes, just re-upload files to GitHub and Vercel auto-redeploys in ~2 minutes.

---

## Questions?

The hardest part is Step 1 Google OAuth setup. If you get stuck, Supabase has a walkthrough at:
docs.supabase.com/docs/guides/auth/social-login/auth-google

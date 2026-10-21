# Aila & Aaku — Personal AI Assistant (PWA)

Ek hi app mein do characters: **Aila** (caring, pyaar se baat karne wali) aur **Aaku** (mast dost). Phone aur desktop dono par install hota hai (PWA), sab free tools par chalta hai.

## Setup (sab FREE, lagbhag 20 minute)

### 1. Gemini API key (AI ka brain)
1. https://aistudio.google.com par Google account se login karo.
2. **Get API key** → **Create API key** → key copy karke kahin note kar lo.

### 2. Supabase (permanent memory) — optional par recommended
1. https://supabase.com → **New project** (free plan).
2. Left menu **SQL Editor** → **New query** → is folder ki `supabase.sql` file ka poora text paste karo → **Run**.
3. **Project Settings → API** se do cheezein copy karo:
   - **Project URL**
   - **service_role** (ya "secret") key — ye key kisi ko mat dikhana.

> Supabase skip karoge to yaadein sirf usi phone/browser mein save hongi.

### 3. GitHub par code daalo
1. https://github.com par account banao → **New repository** → naam `aila` → **Private** → Create.
2. **"uploading an existing file"** link dabao.
3. Is zip ko unzip karo, phir folder ke **andar ki saari files aur folders** (`app`, `lib`, `public`, `package.json`, ...) drag-drop karo. (Folder ko nahi, uske andar ka content.)
4. **Commit changes** dabao.

### 4. Vercel par publish karo
1. https://vercel.com → **Continue with GitHub**.
2. **Add New → Project** → `aila` repo ke saamne **Import**.
3. **Environment Variables** mein ye add karo:

| Name | Value |
|---|---|
| `GEMINI_API_KEY` | Step 1 wali key |
| `APP_PASSCODE` | Koi bhi secret PIN/password (taaki aur log tumhari free limit use na karein) |
| `SUPABASE_URL` | Step 2 wala Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Step 2 wali service_role key |

4. **Deploy** dabao. 1-2 minute mein tumhara link mil jayega (jaise `aila-xyz.vercel.app`).

### 5. Phone/Desktop par install karo
- **Android (Chrome):** link kholo → menu (⋮) → **Install app** / **Add to Home screen**.
- **Desktop (Chrome/Edge):** address bar mein install icon (⊕) dabao. App ke **Settings** mein bhi "Install" button aata hai.
- Pehli baar kholne par **Passcode** poochega (jo `APP_PASSCODE` rakha), phir **Mic** aur **Notification** permission **Allow** karo.

## Kya-kya chalta hai
- Text + voice chat (Hinglish / हिंदी / اردو / English), hands-free **Live voice** (header ka waveform button)
- Aila / Aaku switch (button se, ya bolke "Aaku se baat karni hai")
- Permanent memory (Settings mein dekh/delete kar sakte ho)
- Taaza news, mausam, prices, web search (Google Search grounding)
- Photo / PDF / text file samajhna (📎), camera se photo kheench ke poochna (📷)
- Reminder / alarm (bolke), Google Calendar event (link), image generation
- Mood samajh ke tone badalna
- Premium dark UI, install hone wali app

## Honest limits (browser app ki wajah se)
- **Phone ki notifications padhna:** browser/PWA ko ye access nahi milta. Iske liye alag native Android app chahiye (Kotlin/Flutter + Notification Listener permission). Alag project.
- **WhatsApp:** chupke se message nahi bhej sakta. Aila message likh deti hai, **WhatsApp kholo aur bhejo** button dabate hi chat khulti hai, bas **Send** dabana hota hai.
- **Reminder:** tabhi bajta hai jab app khula ya background mein chalu ho. Band app par nahi bajega.
- **Live video (Gemini Live jaisa):** free mein nahi. Iske badle 📷 se photo kheench ke pooch sakte ho.
- **Kashmiri / Himachali:** text mein koshish karta hai, par voice quality Hindi/Urdu/English jaisi nahi.
- **Free limits:** Gemini free tier ki daily/minute limit hoti hai; limit poori hone par app saaf message dikhata hai.
- **Image generation:** free `pollinations.ai` service se hoti hai; kabhi slow ho ya band ho to image nahi dikhegi (link phir bhi milta hai).
- Awaaz ka gender device ki available voices par depend karta hai; Aila ka pitch ऊँचा aur Aaku ka gehra rakha gaya hai.

## Agar kuch gadbad ho
- **"GEMINI_API_KEY set nahi hai"** → Vercel → Project → Settings → Environment Variables check karo, phir **Deployments → ⋯ → Redeploy**.
- **Vercel build fail** → build log ka error copy karke Claude ko bhej do, wo fix kar dega.
- **Mic nahi chal raha** → Chrome use karo, site ko Mic permission do. (Voice input Chrome/Edge mein chalta hai.)
- **Passcode bhool gaye** → Vercel mein `APP_PASSCODE` badlo + Redeploy; app mein Settings → **Passcode badlo**.
- **Model error** → Vercel mein `GEMINI_MODEL` variable se naya model naam do (default `gemini-2.5-flash`).

## Computer par local chalana (optional)
```
npm install
cp .env.example .env.local     # phir .env.local mein keys bharo
npm run dev                    # http://localhost:3000
```

## Files ka map
- `app/page.js` — poora UI (chat, voice, memory panel, reminders)
- `app/globals.css` — premium design
- `app/api/chat/route.js` — Gemini se baat (search + photo/PDF)
- `app/api/memory/route.js` — yaadein save/list/delete
- `lib/personas.js` — Aila/Aaku ki personality, bhashayein, system prompt
- `lib/gemini.js`, `lib/supabase.js`, `lib/auth.js`, `lib/tags.js` — helpers
- `public/` — manifest, service worker, icons
- `supabase.sql` — database table

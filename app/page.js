'use client';

import { useEffect, useRef, useState } from 'react';
import { PERSONAS, LANGS } from '../lib/personas';
import { parseTags, cleanForSpeech, whatsappLink, calendarLink, imageUrl, fmtIn } from '../lib/tags';

/* ------------------------------------------------------------------ */
/* Chhote helpers                                                      */
/* ------------------------------------------------------------------ */

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const ls = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v == null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
  del(k) {
    try {
      localStorage.removeItem(k);
    } catch {}
  },
};

const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const I = {
  mic: (
    <svg {...svgProps}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
    </svg>
  ),
  send: (
    <svg {...svgProps}>
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  ),
  clip: (
    <svg {...svgProps}>
      <path d="m21 11-9.2 9.2a5 5 0 0 1-7-7L14 4a3.3 3.3 0 0 1 4.7 4.7L9.5 17.9a1.7 1.7 0 0 1-2.4-2.4L15 7.6" />
    </svg>
  ),
  cam: (
    <svg {...svgProps}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  menu: (
    <svg {...svgProps}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  live: (
    <svg {...svgProps}>
      <path d="M3 12h2M7 8v8M11 4v16M15 8v8M19 10v4" />
    </svg>
  ),
  x: (
    <svg {...svgProps}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
};

function beep() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const play = (t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.4);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.45);
    };
    [0, 0.6, 1.2].forEach(play);
    setTimeout(() => {
      try {
        ctx.close();
      } catch {}
    }, 2500);
  } catch {}
}

async function notify(title, body) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg && reg.showNotification) {
      await reg.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        tag: 'aila-' + Date.now(),
      });
    } else {
      new Notification(title, { body });
    }
  } catch {}
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error('File padh nahi paya'));
    r.readAsDataURL(file);
  });
}

function resizeImage(file, max = 1280) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = c.toDataURL('image/jpeg', 0.85);
      URL.revokeObjectURL(url);
      resolve({ data: dataUrl.split(',')[1], mimeType: 'image/jpeg', preview: dataUrl });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image khul nahi payi'));
    };
    img.src = url;
  });
}

function pickVoice(lang, gender) {
  try {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    const norm = (v) => (v.lang || '').replace('_', '-').toLowerCase();
    const l = lang.toLowerCase();
    let pool = voices.filter((v) => norm(v) === l);
    if (!pool.length) pool = voices.filter((v) => norm(v).startsWith(l.slice(0, 2)));
    if (!pool.length) return null;
    const isF = (v) => /female|woman|neerja|swara|heera|kalpana|veena|zira|samantha|aditi|raveena/i.test(v.name);
    const isM = (v) => !isF(v) && /(^|[^a-z])male|madhur|hemant|prabhat|ravi|rishi|david|mark/i.test(v.name);
    const want = gender === 'f' ? pool.find(isF) : pool.find(isM);
    return want || pool[0];
  } catch {
    return null;
  }
}

async function api(path, opts = {}, retry = true) {
  const pass = ls.get('aila_pass', '');
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'x-passcode': pass, ...(opts.headers || {}) },
  });
  if (res.status === 401 && retry) {
    const p = window.prompt('Passcode daalo (jo Vercel mein APP_PASSCODE set kiya hai):');
    if (p) {
      ls.set('aila_pass', p);
      return api(path, opts, false);
    }
  }
  return res;
}

function localNow() {
  try {
    return new Date().toLocaleString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return new Date().toString();
  }
}

function renderInline(line) {
  const l = line.replace(/^\s*[*-]\s+/, '• ');
  return l.split(/(\*\*[^*]+\*\*)/g).map((s, i) =>
    s.length > 4 && s.startsWith('**') && s.endsWith('**') ? <strong key={i}>{s.slice(2, -2)}</strong> : <span key={i}>{s}</span>
  );
}

function Rich({ text }) {
  const paras = String(text || '').split(/\n{2,}/);
  return (
    <>
      {paras.map((p, i) => (
        <p key={i} dir="auto">
          {p.split('\n').map((line, j) => (
            <span key={j}>
              {j > 0 && <br />}
              {renderInline(line)}
            </span>
          ))}
        </p>
      ))}
    </>
  );
}

const SUGGESTIONS = [
  'Aaj ki taaza khabar sunao',
  'Mausam kaisa hai?',
  '10 minute baad yaad dilana',
  'Ek sundar sunset ki tasveer banao',
];

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export default function Home() {
  const [persona, setPersona] = useState('aila');
  const [langId, setLangId] = useState('hinglish');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speakOn, setSpeakOn] = useState(true);
  const [liveMode, setLiveMode] = useState(false);
  const [memories, setMemories] = useState([]);
  const [memConfigured, setMemConfigured] = useState(false);
  const [panel, setPanel] = useState(false);
  const [att, setAtt] = useState(null);
  const [toast, setToast] = useState('');
  const [installEvt, setInstallEvt] = useState(null);
  const [notifPerm, setNotifPerm] = useState('default');
  const [ready, setReady] = useState(false);

  // Hamesha latest values (async callbacks ke liye)
  const S = useRef({});
  S.current = { persona, langId, speakOn, liveMode, messages, memories, att };

  const busyRef = useRef(false);
  const recRef = useRef(null);
  const sendRef = useRef(null);
  const speakTok = useRef(0);
  const toastT = useRef(null);
  const endRef = useRef(null);
  const taRef = useRef(null);
  const fileRef = useRef(null);
  const camRef = useRef(null);

  /* ---------- toast ---------- */
  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(''), 3800);
  }

  /* ---------- memory ---------- */
  async function loadMemories() {
    try {
      const res = await api('/api/memory');
      const d = await res.json();
      if (d.configured) {
        setMemConfigured(true);
        setMemories(d.items || []);
      } else {
        setMemConfigured(false);
        setMemories(ls.get('aila_mem', []));
      }
    } catch {
      setMemories(ls.get('aila_mem', []));
    }
  }

  async function extractMemory(userText, assistantText) {
    if (!userText || userText.length < 6) return;
    const existing = S.current.memories.map((m) => m.content).slice(-100);
    const res = await api('/api/memory', { method: 'POST', body: JSON.stringify({ userText, assistantText, existing }) }, false);
    const d = await res.json();
    if (!d.added || !d.added.length) return;
    if (d.configured) {
      setMemories((p) => [...p, ...d.added]);
    } else {
      const items = d.added.map((c) => ({ id: uid(), content: c.content }));
      const next = [...ls.get('aila_mem', []), ...items];
      ls.set('aila_mem', next);
      setMemories(next);
    }
  }

  async function deleteMemory(m) {
    setMemories((p) => p.filter((x) => x.id !== m.id));
    if (memConfigured) {
      try {
        await api(`/api/memory?id=${encodeURIComponent(m.id)}`, { method: 'DELETE' }, false);
      } catch {}
    } else {
      ls.set('aila_mem', ls.get('aila_mem', []).filter((x) => x.id !== m.id));
    }
  }

  /* ---------- reminders ---------- */
  function addReminder(mins, text) {
    const list = ls.get('aila_rem', []);
    list.push({ id: uid(), due: Date.now() + mins * 60000, text });
    ls.set('aila_rem', list);
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then((p) => setNotifPerm(p)).catch(() => {});
      }
    } catch {}
  }

  function fireReminder(r) {
    const late = Date.now() - r.due > 120000;
    beep();
    notify('Aila reminder', r.text);
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: 'assistant',
        system: true,
        text: `⏰ Reminder: ${r.text}${late ? ' (app band hone ki wajah se ye der se dikha)' : ''}`,
      },
    ]);
    if (S.current.speakOn) speak(`Reminder: ${r.text}`, S.current.persona);
  }

  /* ---------- voice out ---------- */
  function stopSpeaking() {
    speakTok.current += 1;
    try {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    } catch {}
    setSpeaking(false);
  }

  function speak(text, who, onDone) {
    const clean = cleanForSpeech(text);
    if (!clean || !('speechSynthesis' in window)) {
      if (onDone) onDone();
      return;
    }
    const synth = window.speechSynthesis;
    synth.cancel();
    const token = ++speakTok.current;
    const lang = LANGS.find((x) => x.id === S.current.langId) || LANGS[0];
    const p = PERSONAS[who] || PERSONAS.aila;

    // Lambe text ko chhote tukdon mein todo (Chrome lambi awaaz beech mein kaat deta hai)
    const parts = [];
    let cur = '';
    for (const s of clean.match(/[^.!?।؟]+[.!?।؟]*\s*/g) || [clean]) {
      if ((cur + s).length > 200 && cur) {
        parts.push(cur);
        cur = s;
      } else {
        cur += s;
      }
    }
    if (cur.trim()) parts.push(cur);

    const voice = pickVoice(lang.tts, p.gender);
    let finished = false;
    const done = () => {
      if (finished || token !== speakTok.current) return;
      finished = true;
      setSpeaking(false);
      if (onDone) onDone();
    };

    setSpeaking(true);
    parts.forEach((part, i) => {
      const u = new SpeechSynthesisUtterance(part.trim());
      u.lang = lang.tts;
      u.pitch = p.pitch;
      u.rate = p.rate;
      if (voice) u.voice = voice;
      if (i === parts.length - 1) u.onend = done;
      u.onerror = done;
      synth.speak(u);
    });
  }

  /* ---------- voice in ---------- */
  function stopListening(abort) {
    const r = recRef.current;
    if (!r) return;
    if (abort) r._abort = true;
    try {
      if (abort) r.abort();
      else r.stop();
    } catch {}
    if (abort) {
      recRef.current = null;
      setListening(false);
    }
  }

  function turnOffLive() {
    S.current.liveMode = false;
    setLiveMode(false);
  }

  function startListening() {
    if (busyRef.current || recRef.current) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      showToast('Is browser mein voice input nahi chalta. Android/desktop Chrome use karo.');
      if (S.current.liveMode) turnOffLive();
      return;
    }
    stopSpeaking();
    const lang = LANGS.find((x) => x.id === S.current.langId) || LANGS[0];
    const rec = new SR();
    rec.lang = lang.rec;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let finalText = '';
    let err = '';

    rec.onstart = () => setListening(true);
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setInput((finalText + interim).trim());
    };
    rec.onerror = (e) => {
      err = e.error || 'error';
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        showToast('Mic ki permission allow karo (browser/site settings mein).');
        if (S.current.liveMode) turnOffLive();
      } else if (err === 'language-not-supported') {
        showToast('Is language ka voice input is device par nahi hai. Language badal ke dekho.');
        if (S.current.liveMode) turnOffLive();
      }
    };
    rec.onend = () => {
      if (recRef.current === rec) recRef.current = null;
      setListening(false);
      if (rec._abort) return;
      const text = finalText.trim();
      if (text) {
        setInput('');
        if (sendRef.current) sendRef.current(text);
        return;
      }
      setInput('');
      const fatal = err === 'not-allowed' || err === 'service-not-allowed' || err === 'language-not-supported';
      if (S.current.liveMode && !busyRef.current && !fatal) {
        setTimeout(() => {
          if (S.current.liveMode) startListening();
        }, 500);
      }
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      recRef.current = null;
    }
  }

  function toggleMic() {
    if (listening) {
      stopListening(false);
    } else {
      startListening();
    }
  }

  function toggleLive() {
    const next = !S.current.liveMode;
    S.current.liveMode = next;
    setLiveMode(next);
    if (next) {
      S.current.speakOn = true;
      setSpeakOn(true);
      showToast('Live voice ON: bas bolte jao, main sunti/sunta rahunga.');
      startListening();
    } else {
      stopListening(true);
      stopSpeaking();
    }
  }

  /* ---------- send ---------- */
  async function send(rawText) {
    const text = String(rawText == null ? '' : rawText).trim();
    const attach = S.current.att;
    if ((!text && !attach) || busyRef.current) return;

    busyRef.current = true;
    setBusy(true);
    stopSpeaking();
    stopListening(true);
    setInput('');
    setAtt(null);

    let apiText = text || 'Is file/photo ko dekho aur mujhe samjhao.';
    let attachment = null;
    if (attach) {
      if (attach.kind === 'text') apiText += `\n\n[File: ${attach.name}]\n${attach.text}`;
      else attachment = { mimeType: attach.mimeType, data: attach.data };
    }

    const userMsg = {
      id: uid(),
      role: 'user',
      text: text || (attach ? 'Isko dekho aur samjhao.' : ''),
      apiText,
      att: attach ? { name: attach.name, kind: attach.kind, preview: attach.preview || null } : null,
    };
    const nextMsgs = [...S.current.messages, userMsg];
    setMessages(nextMsgs);

    const history = nextMsgs
      .filter((m) => !m.error && !m.system)
      .map((m) => ({ role: m.role, text: m.apiText || m.text || '' }));

    let bot = null;
    let newPersona = null;
    try {
      const res = await api('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          persona: S.current.persona,
          langId: S.current.langId,
          messages: history,
          memories: S.current.memories.map((m) => m.content).slice(-120),
          attachment,
          nowISO: localNow(),
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server error (${res.status}). Thodi der baad try karo.`);

      const { clean, actions } = parseTags(data.text);
      const acts = [];
      for (const a of actions) {
        if (a.type === 'REMINDER' || a.type === 'ALARM' || a.type === 'TIMER') {
          const mins = parseFloat(a.args[0]);
          const rtext = a.args.slice(1).join('|') || 'Reminder';
          if (Number.isFinite(mins) && mins >= 0) {
            addReminder(mins, rtext);
            acts.push({ type: 'reminder', label: `⏰ ${rtext} (${fmtIn(mins)})` });
          }
        } else if (a.type === 'WHATSAPP') {
          acts.push({
            type: 'link',
            label: '💬 WhatsApp kholo aur bhejo',
            href: whatsappLink(a.args[0], a.args.slice(1).join('|')),
          });
        } else if (a.type === 'CALENDAR') {
          acts.push({ type: 'link', label: '📅 Calendar mein add karo', href: calendarLink(a.args[0], a.args[1], a.args[2]) });
        } else if (a.type === 'IMAGE') {
          const prompt = a.args.join('|');
          if (prompt) acts.push({ type: 'image', prompt, seed: Math.floor(Math.random() * 1e6) });
        } else if (a.type === 'SWITCH') {
          const id = (a.args[0] || '').toLowerCase();
          if (PERSONAS[id]) newPersona = id;
        }
      }
      bot = {
        id: uid(),
        role: 'assistant',
        text: clean || (acts.length ? '' : '…'),
        actions: acts,
        sources: Array.isArray(data.sources) ? data.sources : [],
        persona: newPersona || S.current.persona,
      };
    } catch (e) {
      const msg = e && e.message ? e.message : '';
      const net = /failed to fetch|networkerror|load failed/i.test(msg);
      bot = {
        id: uid(),
        role: 'assistant',
        error: true,
        text: `⚠️ ${net ? 'Server se connection nahi ho paya. Internet check karo.' : msg || 'Kuch gadbad ho gayi.'}`,
      };
    }

    busyRef.current = false;
    setBusy(false);
    setMessages((prev) => [...prev, bot]);

    if (bot.error) {
      if (S.current.liveMode) turnOffLive();
      return;
    }

    if (newPersona) {
      S.current.persona = newPersona;
      setPersona(newPersona);
    }

    if (S.current.speakOn || S.current.liveMode) {
      speak(bot.text, bot.persona, () => {
        if (S.current.liveMode) setTimeout(startListening, 350);
      });
      if (!bot.text && S.current.liveMode) startListening();
    }

    extractMemory(userMsg.text, bot.text).catch(() => {});
  }
  sendRef.current = send;

  /* ---------- attachments ---------- */
  async function onPickFile(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      if (f.type.startsWith('image/')) {
        const r = await resizeImage(f);
        setAtt({ kind: 'image', name: f.name || 'photo.jpg', mimeType: r.mimeType, data: r.data, preview: r.preview });
      } else if (f.type === 'application/pdf') {
        if (f.size > 3 * 1024 * 1024) return showToast('PDF 3 MB se chhoti honi chahiye.');
        const data = await fileToBase64(f);
        setAtt({ kind: 'pdf', name: f.name, mimeType: 'application/pdf', data });
      } else if (f.type.startsWith('text/') || /\.(txt|md|csv|json)$/i.test(f.name)) {
        const t = await f.text();
        setAtt({ kind: 'text', name: f.name, text: t.slice(0, 20000) });
      } else {
        showToast('Sirf photo, PDF ya text file chalegi.');
      }
    } catch (err) {
      showToast(err.message || 'File nahi khul payi.');
    }
  }

  /* ---------- install ---------- */
  async function installApp() {
    if (!installEvt) return;
    try {
      installEvt.prompt();
      await installEvt.userChoice;
    } catch {}
    setInstallEvt(null);
  }

  /* ---------- effects ---------- */
  useEffect(() => {
    const p = ls.get('aila_persona', 'aila');
    if (PERSONAS[p]) setPersona(p);
    const l = ls.get('aila_lang', 'hinglish');
    if (LANGS.some((x) => x.id === l)) setLangId(l);
    setSpeakOn(ls.get('aila_speak', true) !== false);
    const saved = ls.get('aila_msgs', []);
    if (Array.isArray(saved)) setMessages(saved);
    try {
      if ('Notification' in window) setNotifPerm(Notification.permission);
    } catch {}
    setReady(true);

    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

    const onPrompt = (e) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    const onInstalled = () => setInstallEvt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    try {
      window.speechSynthesis && window.speechSynthesis.getVoices();
    } catch {}

    loadMemories();

    // Reminder checker: har 5 second mein dekhta hai kuch due to nahi
    const timer = setInterval(() => {
      const list = ls.get('aila_rem', []);
      if (!Array.isArray(list) || !list.length) return;
      const now = Date.now();
      const due = list.filter((r) => r.due <= now);
      if (!due.length) return;
      ls.set(
        'aila_rem',
        list.filter((r) => r.due > now)
      );
      due.forEach(fireReminder);
    }, 5000);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    ls.set(
      'aila_msgs',
      messages.slice(-60).map((m) => ({
        id: m.id,
        role: m.role,
        text: m.text,
        error: m.error,
        system: m.system,
        actions: m.actions,
        sources: m.sources,
        persona: m.persona,
        att: m.att ? { name: m.att.name, kind: m.att.kind } : null,
      }))
    );
  }, [messages, ready]);

  useEffect(() => {
    if (ready) ls.set('aila_persona', persona);
    document.body.className = persona === 'aaku' ? 'aaku' : '';
  }, [persona, ready]);

  useEffect(() => {
    if (ready) ls.set('aila_lang', langId);
  }, [langId, ready]);

  useEffect(() => {
    if (ready) ls.set('aila_speak', speakOn);
  }, [speakOn, ready]);

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  useEffect(() => {
    const t = taRef.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = Math.min(t.scrollHeight, 120) + 'px';
  }, [input]);

  /* ---------- derived ---------- */
  const P = PERSONAS[persona] || PERSONAS.aila;
  const fem = persona === 'aila';
  const orbState = listening ? 'listening' : speaking ? 'speaking' : busy ? 'thinking' : 'idle';
  const statusText = listening
    ? fem
      ? 'Sun rahi hoon…'
      : 'Sun raha hoon…'
    : speaking
    ? fem
      ? 'Bol rahi hoon… (rokne ke liye orb dabao)'
      : 'Bol raha hoon… (rokne ke liye orb dabao)'
    : busy
    ? fem
      ? 'Soch rahi hoon…'
      : 'Soch raha hoon…'
    : liveMode
    ? 'Live voice chalu hai'
    : '';

  const greeting = fem
    ? 'Hii! Main Aila hoon. Bolo, aaj main tumhari kya madad karun?'
    : 'Yo! Main Aaku. Bol bhai, aaj kya scene hai?';

  const orbEl = (
    <div
      className={`orb ${orbState}`}
      onClick={() => {
        if (speaking) stopSpeaking();
      }}
      role="img"
      aria-label={P.name}
    >
      <i className="ring" />
      <i className="ring r2" />
      <i className="ring r3" />
      <i className="core" />
    </div>
  );

  /* ---------- render ---------- */
  return (
    <div className="app">
      <div className="bg" />

      <header className="header">
        <div className="brand">
          <div className={`logo ${orbState}`}>{P.emoji}</div>
          <div className="brand-text">
            <div className="brand-name">{P.name}</div>
            <div className="brand-sub">{P.tagline}</div>
          </div>
        </div>

        <div className="switch" role="tablist" aria-label="Character chuno">
          {Object.values(PERSONAS).map((p) => (
            <button
              key={p.id}
              className={persona === p.id ? 'on' : ''}
              onClick={() => {
                setPersona(p.id);
                stopSpeaking();
              }}
            >
              {p.emoji} {p.name}
            </button>
          ))}
        </div>

        <button className={`icon-btn ${liveMode ? 'on' : ''}`} onClick={toggleLive} aria-label="Live voice">
          {I.live}
        </button>
        <button className="icon-btn" onClick={() => setPanel(true)} aria-label="Settings">
          {I.menu}
        </button>
      </header>

      <main className="chat">
        {messages.length === 0 ? (
          <div className="hero">
            {orbEl}
            <h1>{P.name}</h1>
            <p>{greeting}</p>
            <div className="chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <div key={m.id} className={`msg ${m.role === 'user' ? 'user' : 'bot'} ${m.error ? 'err' : ''}`}>
                <div className="bubble">
                  {m.att && (
                    <div className="attach-tag">
                      {m.att.kind === 'image' ? '🖼️' : '📄'} {m.att.name}
                    </div>
                  )}
                  {m.att && m.att.preview && <img className="att-img" src={m.att.preview} alt="" />}
                  {m.text ? <Rich text={m.text} /> : null}

                  {m.actions && m.actions.filter((a) => a.type === 'image').map((a, i) => (
                    <div key={'img' + i}>
                      <img
                        className="gen-img"
                        src={imageUrl(a.prompt, a.seed)}
                        alt={a.prompt}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <div className="actions">
                        <a className="action" href={imageUrl(a.prompt, a.seed)} target="_blank" rel="noopener noreferrer">
                          🖼️ Image kholo / save karo
                        </a>
                      </div>
                    </div>
                  ))}

                  {m.actions && m.actions.some((a) => a.type !== 'image') && (
                    <div className="actions">
                      {m.actions
                        .filter((a) => a.type !== 'image')
                        .map((a, i) =>
                          a.type === 'link' ? (
                            <a key={i} className="action" href={a.href} target="_blank" rel="noopener noreferrer">
                              {a.label}
                            </a>
                          ) : (
                            <div key={i} className="action">
                              {a.label}
                            </div>
                          )
                        )}
                    </div>
                  )}

                  {m.sources && m.sources.length > 0 && (
                    <div className="sources">
                      {m.sources.map((s, i) => (
                        <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer">
                          {s.title}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="msg bot">
                <div className="bubble">
                  <span className="typing">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={endRef} />
      </main>

      <footer className="composer">
        <div className="status">
          {statusText}
        </div>

        {att && (
          <div className="att-preview">
            {att.preview ? <img src={att.preview} alt="" /> : <span style={{ flex: 'none' }}>📄</span>}
            <span>{att.name}</span>
            <button className="round ghost" style={{ width: 32, height: 32 }} onClick={() => setAtt(null)} aria-label="Hatao">
              {I.x}
            </button>
          </div>
        )}

        <div className="bar">
          <button className="round ghost" onClick={() => fileRef.current && fileRef.current.click()} aria-label="File jodo">
            {I.clip}
          </button>
          <button className="round ghost" onClick={() => camRef.current && camRef.current.click()} aria-label="Camera">
            {I.cam}
          </button>
          <textarea
            ref={taRef}
            rows={1}
            value={input}
            placeholder={fem ? 'Aila se kuch bhi bolo ya likho…' : 'Aaku se kuch bhi bol ya likh…'}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(hover: hover)').matches) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          {input.trim() || att ? (
            <button className="round solid" disabled={busy} onClick={() => send(input)} aria-label="Bhejo">
              {I.send}
            </button>
          ) : (
            <button className={`round mic ${listening ? 'on' : 'solid'}`} onClick={toggleMic} aria-label="Bolo">
              {I.mic}
            </button>
          )}
        </div>

        <input ref={fileRef} type="file" hidden accept="image/*,application/pdf,text/plain,.txt,.md,.csv,.json" onChange={onPickFile} />
        <input ref={camRef} type="file" hidden accept="image/*" capture="environment" onChange={onPickFile} />
      </footer>

      {panel && (
        <>
          <div className="overlay" onClick={() => setPanel(false)} />
          <div className="sheet" role="dialog" aria-label="Settings">
            <h2>Settings</h2>

            {installEvt && (
              <div className="setting">
                <span>App install karo (home screen par)</span>
                <button className="btn primary" onClick={installApp}>
                  Install
                </button>
              </div>
            )}

            <h3>Bhasha (voice + jawab)</h3>
            <div className="row">
              {LANGS.map((l) => (
                <button key={l.id} className={`pill ${langId === l.id ? 'on' : ''}`} onClick={() => setLangId(l.id)}>
                  {l.label}
                </button>
              ))}
            </div>
            <p className="hint">
              Kashmiri/Himachali bolne par koshish karungi/karunga, lekin voice quality Hindi/Urdu/English jaisi nahi hogi.
            </p>

            <h3>Voice</h3>
            <div className="setting">
              <span>Jawab bolkar sunao</span>
              <button className={`toggle ${speakOn ? 'on' : ''}`} onClick={() => setSpeakOn(!speakOn)} aria-label="Voice reply" />
            </div>
            <div className="setting">
              <span>Live voice (hands-free)</span>
              <button
                className={`toggle ${liveMode ? 'on' : ''}`}
                onClick={() => {
                  toggleLive();
                  setPanel(false);
                }}
                aria-label="Live voice"
              />
            </div>

            <h3>Reminders</h3>
            <div className="setting">
              <span>
                Notifications:{' '}
                {notifPerm === 'granted' ? 'chalu ✅' : notifPerm === 'denied' ? 'band (browser settings se kholo)' : 'abhi band'}
              </span>
              {notifPerm === 'default' && (
                <button
                  className="btn"
                  onClick={async () => {
                    try {
                      setNotifPerm(await Notification.requestPermission());
                    } catch {
                      showToast('Is browser mein notification support nahi.');
                    }
                  }}
                >
                  Allow
                </button>
              )}
            </div>
            <p className="hint">Reminder tabhi bajta hai jab app khula ho ya background mein chalu ho.</p>

            <h3>
              Yaadein ({memories.length}) · {memConfigured ? 'Supabase (permanent)' : 'sirf is device par'}
            </h3>
            {memories.length === 0 && <p className="hint">Abhi kuch yaad nahi. Jaise jaise baat karoge, main important baatein yaad rakhungi.</p>}
            {memories.map((m) => (
              <div className="mem" key={m.id}>
                <span>{m.content}</span>
                <button onClick={() => deleteMemory(m)} aria-label="Bhool jao">
                  ×
                </button>
              </div>
            ))}

            <h3>Aur</h3>
            <div className="row">
              <button
                className="btn danger"
                onClick={() => {
                  setMessages([]);
                  ls.del('aila_msgs');
                  setPanel(false);
                }}
              >
                Chat saaf karo
              </button>
              <button
                className="btn"
                onClick={() => {
                  const p = window.prompt('Naya passcode daalo:');
                  if (p != null) ls.set('aila_pass', p);
                }}
              >
                Passcode badlo
              </button>
              <button className="btn" onClick={() => setPanel(false)}>
                Band karo
              </button>
            </div>
          </div>
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

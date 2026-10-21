// Assistant ke reply mein chhupe hue [[TAG|arg|arg]] commands ko alag karta hai.

export function parseTags(raw) {
  const actions = [];
  const clean = String(raw || '')
    .replace(/\[\[\s*([A-Z_]+)\s*\|([^\]]*)\]\]/g, (m, type, args) => {
      actions.push({ type, args: args.split('|').map((s) => s.trim()) });
      return '';
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { clean, actions };
}

// Bolne se pehle text saaf karna (markdown, links, emojis hatana)
export function cleanForSpeech(text) {
  return String(text || '')
    .replace(/\[\[[^\]]*\]\]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/^\s*#+\s*/gm, '')
    .replace(/^\s*[*-]\s+/gm, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function whatsappLink(number, text) {
  let n = String(number || '').replace(/[^\d]/g, '');
  if (n.length === 10) n = '91' + n; // India ka 10 digit number
  const base = n ? `https://wa.me/${n}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text || '')}`;
}

export function calendarLink(title, start, end) {
  const ok = (s) => /^\d{8}T\d{6}$/.test(String(s || ''));
  let url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title || 'Event')}`;
  if (ok(start)) {
    const e = ok(end) ? end : start;
    url += `&dates=${start}/${e}`;
  }
  return url;
}

export function imageUrl(prompt, seed) {
  const p = encodeURIComponent(String(prompt || 'beautiful landscape').slice(0, 400));
  return `https://image.pollinations.ai/prompt/${p}?width=768&height=768&nologo=true&seed=${seed || 1}`;
}

export function fmtIn(mins) {
  const m = Math.round(Number(mins) || 0);
  if (m < 1) return 'abhi';
  if (m < 60) return `${m} min baad`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h < 24) return r ? `${h} ghante ${r} min baad` : `${h} ghante baad`;
  const d = Math.floor(h / 24);
  return `${d} din ${h % 24} ghante baad`;
}

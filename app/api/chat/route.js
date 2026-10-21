import { NextResponse } from 'next/server';
import { checkAuth } from '../../../lib/auth';
import { callGemini } from '../../../lib/gemini';
import { buildSystemPrompt } from '../../../lib/personas';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Passcode galat hai ya nahi diya gaya.' }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request samajh nahi aayi.' }, { status: 400 });
  }

  const { persona = 'aila', langId = 'hinglish', messages = [], memories = [], attachment = null, nowISO, tz } = body || {};

  // History ko Gemini ke format mein badlo (sirf aakhri 20 messages)
  const history = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string' && m.text.trim())
    .slice(-20)
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', text: m.text.slice(0, 6000) }));

  while (history.length && history[0].role !== 'user') history.shift();
  if (!history.length || history[history.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'Koi message nahi mila.' }, { status: 400 });
  }

  const contents = history.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));

  // Attachment (image / pdf) sirf aakhri user message ke saath jaata hai
  if (attachment && typeof attachment.data === 'string' && typeof attachment.mimeType === 'string') {
    const okType = /^image\/(png|jpe?g|webp|heic|heif)$/i.test(attachment.mimeType) || attachment.mimeType === 'application/pdf';
    if (okType && attachment.data.length < 6_000_000) {
      contents[contents.length - 1].parts.push({
        inlineData: { mimeType: attachment.mimeType, data: attachment.data },
      });
    }
  }

  const system = buildSystemPrompt({ persona, langId, memories, nowISO, tz });

  try {
    const { text, sources, blocked } = await callGemini({ system, contents, search: true, temperature: 0.8 });
    if (!text) {
      return NextResponse.json({
        text: blocked
          ? 'Is baat ka jawab main nahi de sakti/sakta. Kuch aur poochho?'
          : 'Mujhe jawab nahi mila, ek baar phir bolo?',
        sources: [],
      });
    }
    return NextResponse.json({ text, sources });
  } catch (e) {
    const status = e?.status && e.status >= 400 && e.status < 600 ? e.status : 500;
    return NextResponse.json({ error: e?.message || 'Kuch gadbad ho gayi.' }, { status: status === 401 ? 502 : status });
  }
}

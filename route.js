import { NextResponse } from 'next/server';
import { checkAuth } from '../../../lib/auth';
import { callGemini } from '../../../lib/gemini';
import { sbConfigured, listMemories, addMemories, deleteMemory } from '../../../lib/supabase';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const unauthorized = () =>
  NextResponse.json({ error: 'Passcode galat hai ya nahi diya gaya.' }, { status: 401 });

// Saari yaadein
export async function GET(req) {
  if (!checkAuth(req)) return unauthorized();
  if (!sbConfigured()) return NextResponse.json({ configured: false, items: [] });
  try {
    const items = await listMemories();
    return NextResponse.json({ configured: true, items: items || [] });
  } catch (e) {
    return NextResponse.json({ configured: false, items: [], error: e.message });
  }
}

// Baatcheet se naye facts nikalo aur save karo
export async function POST(req) {
  if (!checkAuth(req)) return unauthorized();

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
  const userText = String(body?.userText || '').slice(0, 2000);
  const assistantText = String(body?.assistantText || '').slice(0, 2000);
  const existing = (Array.isArray(body?.existing) ? body.existing : []).filter((x) => typeof x === 'string').slice(-100);
  const configured = sbConfigured();

  if (userText.trim().length < 6) return NextResponse.json({ configured, added: [] });

  const prompt = `Neeche user aur assistant ki ek baatcheet hai.
User ke baare mein SIRF naye, lambe samay tak kaam aane wale facts nikalo (naam, rishte, pasand/napasand, kaam/padhai, shehar, routine, important dates, goals, health/preferences jo user ne khud bataye).
Temporary baatein, sawal, news, ya assistant ki baatein mat nikalo. Neeche di gayi "already known" list ke facts dobara mat do.
Output SIRF ek JSON array of short strings (max 3, har ek Hinglish mein, 3rd-person jaise "User ko chai pasand hai"). Kuch bhi nahi mila to [].

Already known:
${existing.map((e) => `- ${e}`).join('\n') || '(none)'}

User: ${userText}
Assistant: ${assistantText}`;

  let facts = [];
  try {
    const { text } = await callGemini({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      json: true,
      temperature: 0.2,
    });
    const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) facts = parsed;
  } catch {
    return NextResponse.json({ configured, added: [] });
  }

  const known = new Set(existing.map((e) => e.trim().toLowerCase()));
  const fresh = [];
  for (const f of facts) {
    if (typeof f !== 'string') continue;
    const t = f.trim();
    if (t.length < 3 || t.length > 200) continue;
    if (known.has(t.toLowerCase())) continue;
    known.add(t.toLowerCase());
    fresh.push(t);
    if (fresh.length >= 3) break;
  }
  if (!fresh.length) return NextResponse.json({ configured, added: [] });

  if (configured) {
    try {
      const rows = await addMemories(fresh);
      return NextResponse.json({ configured: true, added: rows || [] });
    } catch (e) {
      return NextResponse.json({ configured: true, added: [], error: e.message });
    }
  }
  return NextResponse.json({ configured: false, added: fresh.map((content) => ({ content })) });
}

// Ek yaad delete karo
export async function DELETE(req) {
  if (!checkAuth(req)) return unauthorized();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id chahiye' }, { status: 400 });
  if (!sbConfigured()) return NextResponse.json({ ok: true });
  try {
    await deleteMemory(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

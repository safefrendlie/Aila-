const DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export function getModel() {
  return 'gemini-1.5-flash';
}

function friendlyError(status, bodyText) {
  if (status === 429) return 'Free limit abhi poori ho gayi hai. Thodi der baad (ya kal) phir try karo.';
  if (status === 400 && /API key/i.test(bodyText)) return 'GEMINI_API_KEY galat hai. Vercel mein key dobara check karo.';
  if (status === 401 || status === 403) return 'Gemini API key kaam nahi kar rahi (permission/key issue). Key check karo.';
  if (status === 404) return `Model "${getModel()}" nahi mila. GEMINI_MODEL setting check karo.`;
  if (status >= 500) return 'Gemini server abhi busy hai. Thodi der baad try karo.';
  return `Gemini error (${status}).`;
}

export async function callGemini({ system, contents, search = false, json = false, temperature = 0.8 }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    const e = new Error('GEMINI_API_KEY set nahi hai. Vercel -> Settings -> Environment Variables mein daalo, phir Redeploy karo.');
    e.status = 500;
    throw e;
  }
  const base = process.env.GEMINI_API_BASE || DEFAULT_BASE;
  const url = `${base}/${getModel()}:generateContent`;

  const body = { contents, generationConfig: { temperature } };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  if (json) body.generationConfig.responseMimeType = 'application/json';
  if (search) body.tools = [{ google_search: {} }];

  const doFetch = (b) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(b),
    });

  let res = await doFetch(body);
  // Agar search tool is model par support na ho to bina search ke dobara try
  if (!res.ok && search && res.status === 400) {
    delete body.tools;
    res = await doFetch(body);
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    const err = new Error(friendlyError(res.status, t));
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const cand = data?.candidates?.[0];
  const text = (cand?.content?.parts || [])
    .map((p) => (p && typeof p.text === 'string' && !p.thought ? p.text : ''))
    .join('')
    .trim();

  const seen = new Set();
  const sources = [];
  for (const c of cand?.groundingMetadata?.groundingChunks || []) {
    const w = c?.web;
    if (w?.uri && !seen.has(w.uri)) {
      seen.add(w.uri);
      sources.push({ title: w.title || w.uri, uri: w.uri });
    }
  }
  return { text, sources: sources.slice(0, 4), blocked: !text && !!data?.promptFeedback?.blockReason };
}

// Supabase REST API ko seedha fetch se call karte hain (koi extra package nahi chahiye).

export function sbConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function sb(path, opts = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
  const headers = {
    apikey: key,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    ...(opts.headers || {}),
  };
  // Purani JWT-style keys (eyJ...) ko Authorization header bhi chahiye
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;

  const res = await fetch(`${base}/rest/v1/${path}`, { ...opts, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase error ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

export const listMemories = () => sb('memories?select=id,content&order=id.asc&limit=300');

export const addMemories = (items) =>
  sb('memories?select=id,content', {
    method: 'POST',
    body: JSON.stringify(items.map((content) => ({ content }))),
  });

export const deleteMemory = (id) => sb(`memories?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });

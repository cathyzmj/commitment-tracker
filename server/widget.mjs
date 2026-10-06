// /api/widget — a small mailbox between the app and the Scriptable widget.
//   PUT    (app)    stores today's/this week's summary
//   GET    (widget) reads it back
//   DELETE (app)    removes it when widget sharing is turned off
// Every request carries "Authorization: Bearer <key>". The key is a random secret created on
// the phone; only its SHA-256 hash is used as the storage name, so the key itself isn't stored.

const KEY_RE = /^[A-Za-z0-9_-]{32,128}$/;
const MAX_BYTES = 64 * 1024;

const json = (status, body) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

async function storageName(key) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function handle(req, store) {
  const key = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!KEY_RE.test(key)) return json(401, { error: 'Missing or invalid widget key.' });
  const name = await storageName(key);

  switch (req.method) {
    case 'GET': {
      const stored = await store.get(name);
      if (!stored) return json(404, { error: 'No data yet. In the Commitments app, open ⋯ → Phone widget and tap “Send now”.' });
      return new Response(stored, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
    }
    case 'PUT': case 'POST': {
      const text = await req.text();
      if (text.length > MAX_BYTES) return json(413, { error: 'Summary too large.' });
      let data;
      try { data = JSON.parse(text); } catch { return json(400, { error: 'Expected JSON.' }); }
      if (!data || typeof data !== 'object' || data.v !== 1) return json(400, { error: 'Unexpected summary format.' });
      await store.set(name, JSON.stringify(data));
      return json(200, { ok: true });
    }
    case 'DELETE':
      await store.delete(name);
      return json(200, { ok: true });
    default:
      return json(405, { error: 'Method not allowed.' });
  }
}


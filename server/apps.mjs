// GET /api/apps — your application tracker from Notion (opening dates, deadlines, apply links).
//
// Reads a Notion database through the official API with a read-only internal integration whose
// secret is stored as the server secret NOTION_TOKEN (never sent to the browser).
// NOTION_APPS_DATABASE is the database to read (its link or ID), also kept as a server secret.
//
// Access: only devices that use sync can call this. The request carries the sync key
// ("Authorization: Bearer <key>"), and the key is accepted if a synced copy exists for it.
import { syncStorageName } from './sync.mjs';

const KEY_RE = /^[A-Za-z0-9_-]{32,128}$/;
const NOTION_VERSION = '2022-06-28';
const MAX_PAGES = 10; // 1,000 rows is plenty

const json = (status, body) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

// ---------- Reading Notion property values ----------
const plain = (rich) => (Array.isArray(rich) ? rich.map((t) => t.plain_text || '').join('').trim() : '');
function value(prop) {
  if (!prop) return null;
  switch (prop.type) {
    case 'title': return plain(prop.title);
    case 'rich_text': return plain(prop.rich_text);
    case 'url': return prop.url || null;
    case 'select': return prop.select ? prop.select.name : null;
    case 'status': return prop.status ? prop.status.name : null;
    case 'multi_select': return (prop.multi_select || []).map((o) => o.name);
    case 'date': return prop.date ? { start: prop.date.start, end: prop.date.end || null } : null;
    default: return null;
  }
}
// Finds a property by preferred names first, then by a name pattern of the right type.
function find(props, type, names, pattern) {
  for (const n of names) if (props[n] && props[n].type === type) return props[n];
  if (pattern) for (const [n, p] of Object.entries(props)) if (p.type === type && pattern.test(n)) return p;
  return null;
}
const day = (d) => (d && d.start ? d.start.slice(0, 10) : null);
const time = (d) => (d && d.start && d.start.length > 10 ? d.start.slice(11, 16) : null);

export function toApplication(page) {
  const p = page.properties || {};
  const title = Object.values(p).find((x) => x.type === 'title');
  const open = value(find(p, 'date', ['Opening Date', 'Open Date', 'Opens'], /open/i));
  const close = value(find(p, 'date', ['Closing Date', 'Deadline', 'Closes'], /clos|deadline/i));
  const next = value(find(p, 'date', ['Next ddl', 'Next deadline'], /next|ddl/i));
  return {
    id: page.id,
    company: value(title) || 'Untitled',
    programme: value(find(p, 'rich_text', ['Programme Name', 'Program Name', 'Role'], /programme|program|role/i)) || '',
    status: value(find(p, 'select', ['My Status', 'Status', 'Stage'], /status|stage/i)) || value(find(p, 'status', [], /./)) || '',
    sector: value(find(p, 'select', ['Sector', 'Track'], /sector|track/i)) || '',
    rolling: value(find(p, 'select', ['Rolling'], /rolling/i)) || '',
    materials: value(find(p, 'multi_select', ['Materials'], /material/i)) || [],
    url: value(find(p, 'url', ['URL', 'Apply', 'Link'], /url|link|apply/i)) || '',
    open: day(open), openTime: time(open),
    close: day(close), closeTime: time(close),
    next: day(next), nextTime: time(next),
    notionUrl: page.url || '',
  };
}

async function queryNotion({ token, database, fetchImpl }) {
  const rows = [];
  let cursor;
  for (let i = 0; i < MAX_PAGES; i++) {
    const res = await fetchImpl(`https://api.notion.com/v1/databases/${database}/query`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'notion-version': NOTION_VERSION, 'content-type': 'application/json' },
      body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
      signal: AbortSignal.timeout(20000),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) throw Object.assign(new Error('Notion rejected the connection. Check the NOTION_TOKEN secret.'), { status: 502 });
    if (res.status === 404) throw Object.assign(new Error('Notion can’t see the database. In Notion, open it → ••• → Connections → add your integration.'), { status: 502 });
    if (!res.ok) throw Object.assign(new Error(body.message || `Notion returned an error (${res.status}).`), { status: 502 });
    rows.push(...(body.results || []));
    if (!body.has_more) break;
    cursor = body.next_cursor;
  }
  return rows;
}

// Accepts a database ID or a Notion link and returns the 32-character ID.
export function databaseId(value) {
  const m = String(value || '').replace(/-/g, '').match(/[0-9a-f]{32}/i);
  return m ? m[0].toLowerCase() : null;
}

export async function handle(req, { syncStore, env, fetchImpl = fetch }) {
  if (req.method !== 'GET') return json(405, { error: 'Use GET' });
  const key = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!KEY_RE.test(key)) return json(401, { error: 'Turn on sync to see your applications.' });
  if (!(await syncStore.getWithMetadata(await syncStorageName(key), { type: 'json' }))) {
    return json(403, { error: 'Turn on sync to see your applications.' });
  }
  const token = env.NOTION_TOKEN;
  if (!token) return json(503, { error: 'Notion isn’t connected yet (see Applications → Set up).', setup: true });
  try {
    const database = databaseId(env.NOTION_APPS_DATABASE);
    if (!database) return json(503, { error: 'Notion isn’t connected yet (see Applications → Set up).', setup: true });
    const pages = await queryNotion({ token, database, fetchImpl });
    const apps = pages.filter((pg) => !pg.archived && !pg.in_trash).map(toApplication);
    return json(200, { fetchedAt: new Date().toISOString(), apps });
  } catch (e) {
    return json(e.status || 502, { error: e.message || 'Couldn’t reach Notion.' });
  }
}


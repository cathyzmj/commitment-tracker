// Tests /api/apps with an in-memory sync store and a fake Notion API.
import assert from 'node:assert';
import { handle, toApplication, databaseId } from '../server/apps.mjs';
import { syncStorageName } from '../server/sync.mjs';
import { memoryStore } from './sync-fn-store.mjs';

const KEY = 'k'.repeat(43);
const syncStore = memoryStore();
await syncStore.setJSON(await syncStorageName(KEY), { version: 1, records: {}, tombs: {} }, { onlyIfNew: true });

// A Notion page as the API returns it.
const page = (id, { company, programme, status, open, close, next, url, rolling = 'No', sector = 'Buy-Side' }) => ({
  object: 'page', id, url: `https://www.notion.so/${id}`, archived: false, in_trash: false,
  properties: {
    'Company Name': { type: 'title', title: [{ plain_text: company }] },
    'Programme Name': { type: 'rich_text', rich_text: programme ? [{ plain_text: programme }] : [] },
    'My Status': { type: 'select', select: status ? { name: status } : null },
    Sector: { type: 'select', select: { name: sector } },
    Rolling: { type: 'select', select: { name: rolling } },
    Materials: { type: 'multi_select', multi_select: [{ name: 'CV' }, { name: 'Online test' }] },
    URL: { type: 'url', url: url || null },
    'Opening Date': { type: 'date', date: open ? { start: open, end: null } : null },
    'Closing Date': { type: 'date', date: close ? { start: close, end: null } : null },
    'Next ddl': { type: 'date', date: next ? { start: next, end: null } : null },
    'Last Year Opening': { type: 'date', date: { start: '2025-09-20', end: null } },
  },
});
const pages = [
  page('a1', { company: 'Blackstone', programme: '2027 Spring Insight Program', status: 'Not started', open: '2026-09-17', close: '2026-10-16', url: 'https://blackstone.example/apply' }),
  page('a2', { company: 'Point72', programme: '2027 Academy Spring Insight', status: 'Not started', open: '2026-09-29', close: '2026-11-15T17:00:00.000+01:00' }),
  page('a3', { company: 'Nomura', programme: 'Spring Insight Women Immersion', status: 'Online test', open: '2026-08-31', next: '2026-09-10', rolling: 'Yes' }),
];
let calls = [];
const fakeNotion = (responses) => async (url, opts) => {
  calls.push({ url, body: JSON.parse(opts.body), auth: opts.headers.authorization, version: opts.headers['notion-version'] });
  const r = responses.shift();
  return new Response(JSON.stringify(r.body), { status: r.status || 200 });
};
const get = (opts, { key = KEY } = {}) => handle(new Request('https://x/api/apps', { headers: key ? { authorization: `Bearer ${key}` } : {} }), { syncStore, ...opts })
  .then(async (r) => ({ status: r.status, body: await r.json() }));

// --- property mapping
const blackstone = toApplication(pages[0]);
assert.equal(blackstone.company, 'Blackstone');
assert.equal(blackstone.programme, '2027 Spring Insight Program');
assert.equal(blackstone.open, '2026-09-17');
assert.equal(blackstone.close, '2026-10-16');
assert.equal(blackstone.url, 'https://blackstone.example/apply');
assert.equal(blackstone.status, 'Not started');
assert.deepEqual(blackstone.materials, ['CV', 'Online test']);
assert.equal(toApplication(pages[1]).close, '2026-11-15', 'date-times keep the day');
assert.equal(toApplication(pages[1]).closeTime, '17:00');
assert.equal(toApplication(pages[2]).next, '2026-09-10');
assert.equal(toApplication(pages[0]).open, '2026-09-17', '"Last Year Opening" is not mistaken for the opening date');

// --- access
assert.equal((await get({ env: { NOTION_TOKEN: 't' } }, { key: '' })).status, 401);
assert.equal((await get({ env: { NOTION_TOKEN: 't' } }, { key: 'z'.repeat(43) })).status, 403, 'a key without synced data is refused');
const noToken = await get({ env: {} });
assert.equal(noToken.status, 503);
assert.equal(noToken.body.setup, true);

// --- reads every page of results
calls = [];
const DB = '0123456789abcdef0123456789abcdef';
const ok = await get({ env: { NOTION_TOKEN: 'secret_abc', NOTION_APPS_DATABASE: `https://www.notion.so/ws/Tracker-${DB}?v=1` }, fetchImpl: fakeNotion([
  { body: { results: pages.slice(0, 2), has_more: true, next_cursor: 'c2' } },
  { body: { results: [pages[2], { ...page('gone', { company: 'Deleted' }), in_trash: true }], has_more: false } },
]) });
assert.equal(ok.status, 200);
assert.deepEqual(ok.body.apps.map((a) => a.company), ['Blackstone', 'Point72', 'Nomura'], 'trashed pages are dropped');
assert.equal(calls.length, 2);
assert.equal(calls[1].body.start_cursor, 'c2');
assert.equal(calls[0].auth, 'Bearer secret_abc');
assert(calls[0].url.endsWith(`/databases/${DB}/query`), 'reads the configured database (link accepted)');
assert.equal(databaseId('01234567-89ab-cdef-0123-456789abcdef'), DB, 'dashed IDs work');
assert.equal((await get({ env: { NOTION_TOKEN: 't' } })).body.setup, true, 'no database configured -> setup');

// --- Notion errors are explained
const notShared = await get({ env: { NOTION_TOKEN: 't', NOTION_APPS_DATABASE: DB }, fetchImpl: fakeNotion([{ status: 404, body: { message: 'Could not find database' } }]) });
assert.equal(notShared.status, 502);
assert.match(notShared.body.error, /Connections/);
const badToken = await get({ env: { NOTION_TOKEN: 't', NOTION_APPS_DATABASE: DB }, fetchImpl: fakeNotion([{ status: 401, body: {} }]) });
assert.match(badToken.body.error, /NOTION_TOKEN/);
console.log('ALL APPS FUNCTION TESTS PASSED');

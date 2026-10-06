// Tests /api/widget with an in-memory stand-in for the server store.
import assert from 'node:assert';
import { handle } from '../server/widget.mjs';

const mem = new Map();
const store = {
  get: async (k) => mem.get(k) ?? null,
  set: async (k, v) => { mem.set(k, v); },
  delete: async (k) => { mem.delete(k); },
};
const KEY = 'a'.repeat(43);
const call = (method, { key = KEY, body } = {}) => handle(new Request('https://x/api/widget', {
  method, body, headers: key ? { authorization: `Bearer ${key}` } : {},
}), store);

assert.equal((await call('GET', { key: '' })).status, 401, 'no key');
assert.equal((await call('GET', { key: 'short' })).status, 401, 'bad key');
assert.equal((await call('GET')).status, 404, 'nothing stored yet');
assert.equal((await call('PUT', { body: 'not json' })).status, 400);
assert.equal((await call('PUT', { body: JSON.stringify({ v: 2 }) })).status, 400);
assert.equal((await call('PUT', { body: JSON.stringify({ v: 1, pad: 'x'.repeat(70000) }) })).status, 413);
assert.equal((await call('PUT', { body: JSON.stringify({ v: 1, week: '2026-09-28' }) })).status, 200);
const got = await call('GET');
assert.equal(got.status, 200);
assert.equal((await got.json()).week, '2026-09-28');
assert(![...mem.keys()].includes(KEY), 'raw key must not be used as the storage name');
assert.equal((await call('GET', { key: 'b'.repeat(43) })).status, 404, 'other keys see nothing');
assert.equal((await call('DELETE')).status, 200);
assert.equal((await call('GET')).status, 404, 'deleted');
assert.equal((await call('PATCH')).status, 405);
console.log('ALL WIDGET FUNCTION TESTS PASSED');

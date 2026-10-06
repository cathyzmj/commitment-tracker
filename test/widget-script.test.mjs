// Runs widget/commitments-widget.js against a strict mock of Scriptable's API.
// Objects are sealed with only real Scriptable property names, so typos fail loudly.
import assert from 'node:assert';
import fs from 'node:fs';
process.env.TZ = 'Europe/London';
const here = decodeURIComponent(new URL('.', import.meta.url).pathname);
const source = fs.readFileSync(here + '../widget/commitments-widget.js', 'utf8');
const fixture = JSON.parse(fs.readFileSync(here + 'widget-fixture.json', 'utf8'));
assert(source.includes("'__WIDGET_KEY__'") && source.includes("'__ORIGIN__'"), 'placeholders the app replaces');

function run({ family, runsInWidget = true, now = '2026-10-01T12:00:00', response, offlineCache }) {
  const FIXED = new Date(now).getTime();
  class FakeDate extends Date { constructor(...a) { super(...(a.length ? a : [FIXED])); } static now() { return FIXED; } }
  const texts = []; let widget = null, presented = null; const files = new Map(offlineCache ? [['/docs/commitments-widget-cache.json', JSON.stringify(offlineCache)]] : []);
  class Color { constructor(hex) { this.hex = hex; } static dynamic(l, d) { return { l, d }; } }
  class Size { constructor(w, h) { this.width = w; this.height = h; } }
  const Font = { systemFont: (s) => ({ s }), boldSystemFont: (s) => ({ s, b: 1 }) };
  class WidgetText { constructor(t) { this.text = t; this.font = null; this.textColor = null; this.lineLimit = 0; this.minimumScaleFactor = 1; Object.seal(this); texts.push(this); }
    leftAlignText() {} centerAlignText() {} rightAlignText() {} }
  class WidgetImage { constructor(i) { this.image = i; this.imageSize = null; this.tintColor = null; Object.seal(this); } }
  class WidgetStack {
    constructor() { this.children = []; this.backgroundColor = null; this.size = null; this.cornerRadius = 0; this.spacing = 0; this.url = null; Object.seal(this); }
    addText(t) { assert.equal(typeof t, 'string', 'addText needs a string'); const x = new WidgetText(t); this.children.push(x); return x; }
    addImage(i) { const x = new WidgetImage(i); this.children.push(x); return x; }
    addStack() { const x = new WidgetStack(); this.children.push(x); return x; }
    addSpacer(n) { this.children.push({ spacer: n }); }
    setPadding() {} layoutHorizontally() {} layoutVertically() {} topAlignContent() {} centerAlignContent() {} bottomAlignContent() {}
  }
  class ListWidget extends WidgetStack {
    constructor() { super(); }
    presentSmall() { presented = 'small'; return Promise.resolve(); } presentMedium() { presented = 'medium'; return Promise.resolve(); } presentLarge() { presented = 'large'; return Promise.resolve(); }
  }
  // refreshAfterDate exists only on ListWidget in Scriptable.
  const refresh = new WeakMap();
  Object.defineProperty(WidgetStack.prototype, 'refreshAfterDate', { set(v) { assert(this instanceof ListWidget, 'refreshAfterDate only on ListWidget'); refresh.set(this, v); }, get() { return refresh.get(this); } });
  class Request {
    constructor(url) { this.url = url; this.headers = {}; this.timeoutInterval = 60; this.method = 'GET'; this.response = null; Object.seal(this); }
    async loadJSON() {
      assert.equal(this.headers.Authorization, 'Bearer TESTKEY');
      assert.equal(this.url, 'https://example.test/api/widget');
      if (response === 'offline') throw new Error('The Internet connection appears to be offline.');
      this.response = { statusCode: response.status }; return response.body;
    }
  }
  const FileManager = { local: () => ({ documentsDirectory: () => '/docs', joinPath: (a, b) => `${a}/${b}`,
    fileExists: (p) => files.has(p), readString: (p) => files.get(p), writeString: (p, s) => files.set(p, s) }) };
  const SFSymbol = { named: (n) => ({ image: { symbol: n } }) };
  const config = { runsInWidget, widgetFamily: runsInWidget ? family : undefined };
  const Script = { setWidget: (w) => { widget = w; }, complete: () => {} };
  const Device = { isUsingDarkAppearance: () => false };
  const code = source.replaceAll('__WIDGET_KEY__', 'TESTKEY').replaceAll('__ORIGIN__', 'https://example.test');
  const AsyncFunction = (async () => {}).constructor;
  const fn = new AsyncFunction('Date', 'Color', 'Size', 'Font', 'ListWidget', 'Request', 'FileManager', 'SFSymbol', 'config', 'Script', 'Device', code);
  return fn(FakeDate, Color, Size, Font, ListWidget, Request, FileManager, SFSymbol, config, Script, Device)
    .then(() => ({ widget, presented, texts: texts.map((t) => t.text), files }));
}

const ok = { status: 200, body: fixture };
for (const family of ['small', 'medium', 'large', 'extraLarge', 'accessoryRectangular', 'accessoryInline', 'accessoryCircular']) {
  const r = await run({ family, response: ok });
  assert(r.widget, family + ': widget set');
  console.log(`${family.padEnd(21)} ${r.texts.join(' | ')}`);
}
const med = await run({ family: 'medium', response: ok });
assert(med.texts.includes('1') && med.texts.includes('/6'), 'today 1/6 (5 daily + 1 one-off)');
assert(med.texts.includes('1.3h of 5.3h'));
assert(med.texts.indexOf('Statistics Seminar') < med.texts.indexOf('Practice questions'), 'still-to-do items come first');
assert(med.texts.includes('2/3'), 'counter progress');
assert(med.texts.some((t) => t.startsWith('Updated ')));
assert(med.files.size === 1, 'caches the last good data');

const nextWeek = await run({ family: 'medium', response: ok, now: '2026-10-05T09:00:00' });
console.log('new week               ', nextWeek.texts.join(' | '));
assert(nextWeek.texts[0].startsWith('New week'));

const offline = await run({ family: 'small', response: 'offline', offlineCache: fixture });
console.log('offline (cached)       ', offline.texts.join(' | '));
assert(offline.texts.some((t) => t.startsWith('Offline · Updated')));

const offlineNoCache = await run({ family: 'small', response: 'offline' });
assert.deepEqual(offlineNoCache.texts, ['Commitments', 'No connection']);

const notSet = await run({ family: 'small', response: { status: 404, body: { error: 'No data yet.' } } });
assert.deepEqual(notSet.texts, ['Commitments', 'No data yet.']);

const inApp = await run({ runsInWidget: false, response: ok });
assert.equal(inApp.presented, 'medium', 'running in the app shows a medium preview');
console.log('\nALL WIDGET SCRIPT TESTS PASSED');

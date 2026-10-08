'use strict';

// ---------- Defaults ----------
// A commitment has a frequency (daily / weekly / once) and a kind:
//   task    – done or not done (planned time = `hours`)
//   counter – count towards `target` `unit`s in `step`s (e.g. 3 emails; 15 h)
const DEFAULT_COMMITMENTS = [
  // Examples for a fresh install; edit them in the Commitments tab.
  // [freq, kind, section, name, target, unit, hours]
  ['daily', 'task', 'Study', 'Independent study', 1, '', 2],
  ['daily', 'task', 'Study', 'Practice questions', 1, '', 0.5],
  ['daily', 'counter', 'Networking', 'Outreach messages', 3, 'messages', 0.5],
  ['daily', 'task', 'Health', 'Exercise', 1, '', 0.5],
  ['weekly', 'counter', 'Career', 'Applications', 5, 'h', 5],
  ['weekly', 'counter', 'Projects', 'Side project', 10, 'h', 10],
  ['weekly', 'task', 'Social', 'Club meeting', 1, '', 1],
]
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FREQS = ['daily', 'weekly', 'once'];
const FREQ_LABEL = { daily: 'Daily', weekly: 'Weekly', once: 'One-off' };
const LONG_PRESS_MS = 450;

// ---------- Dates ----------
const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfToday = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
const todayISO = () => isoDate(startOfToday());
const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));
const weekOf = (iso) => isoDate(mondayOf(parseISO(iso)));
const currentWeekKey = () => isoDate(mondayOf(startOfToday()));
const shiftWeek = (key, n) => isoDate(addDays(parseISO(key), 7 * n));
const weekEnd = (key) => isoDate(addDays(parseISO(key), 6));
const weeksBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / (7 * 864e5));
const dayDate = (key, i) => addDays(parseISO(key), i);
const dayIndexOf = (iso) => Math.round((parseISO(iso) - mondayOf(parseISO(iso))) / 864e5);
const fmtDay = (d, opts) => d.toLocaleDateString('en-GB', opts);
const fmtShort = (iso) => fmtDay(parseISO(iso), { weekday: 'short', day: 'numeric', month: 'short' });
function todayIndex(key) {
  const diff = Math.round((startOfToday() - parseISO(key)) / 864e5);
  return diff >= 0 && diff < 7 ? diff : -1;
}
function weekRange(key) {
  const a = parseISO(key), b = addDays(a, 6);
  return `${fmtDay(a, { day: 'numeric', month: 'short' })} – ${fmtDay(b, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

// ---------- Formatting ----------
const round2 = (x) => Math.round(x * 100) / 100;
const fmtH = (x) => `${round2(x)}h`;
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
// Short stable hash (cyrb53) used for ids that must come out the same on every device.
function hash36(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
const num = (v, d = 0) => { const n = parseFloat(v); return isFinite(n) && n >= 0 ? n : d; };
const validTime = (t) => (/^\d{2}:\d{2}$/.test(String(t || '')) ? t : null);
const timeRange = (x) => (x.time ? `${x.time}${x.endTime ? '–' + x.endTime : ''}` : '');
const isHourUnit = (u) => /^(h|hr|hrs|hour|hours)$/i.test(String(u || '').trim());
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICONS = {
  today: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 12.3l2.7 2.7L16.2 9.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  week: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 12h17M9.2 4.5v15M14.8 4.5v15" stroke="currentColor" stroke-width="1.8"/></svg>',
  apps: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="7" width="17" height="12.5" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="7" y="13" width="4" height="3" rx="1" fill="currentColor"/></svg>',
  commitments: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6.5h11M9 12h11M9 17.5h11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="4.5" cy="6.5" r="1.4" fill="currentColor"/><circle cx="4.5" cy="12" r="1.4" fill="currentColor"/><circle cx="4.5" cy="17.5" r="1.4" fill="currentColor"/></svg>',
};

// Only allow web and Notion links (also guards against javascript: URLs in imported data).
function cleanUrl(u) {
  u = String(u || '').trim();
  if (!u) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
  try {
    const p = new URL(u);
    return ['http:', 'https:', 'notion:'].includes(p.protocol) ? p.href : '';
  } catch { return ''; }
}
function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } }
// Notion web links open in the browser from a home-screen app; notion:// opens the Notion app.
const notionAppUrl = (u) => u.replace(/^https:\/\/(www\.)?notion\.so\//, 'notion://www.notion.so/');
function linkify(text) {
  return escapeHtml(text).replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]/g,
    (m) => `<a href="${m}" target="_blank" rel="noopener">${m}</a>`);
}

// ---------- Storage (IndexedDB) ----------
const DB_NAME = 'commitment-tracker', STORE = 'kv', STATE_KEY = 'state';
let dbPromise;
function openDb() {
  dbPromise = dbPromise || new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
async function loadState() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(STATE_KEY);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
let writeState = async function () {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(state, STATE_KEY);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
};
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 150);
}
function flush() {
  if (saveTimer === null) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  const changed = stampChanges();
  writeState().catch((e) => toast('Could not save: ' + e.message));
  scheduleWidgetPush();
  if (changed) scheduleSync();
}

// ---------- State & migration ----------
let state;
let viewKey = currentWeekKey();
let lastCurrentKey = viewKey;
let reorderMode = false;

function newCommitment(fields) {
  return {
    id: uid(), name: '', section: 'Other', freq: 'daily', kind: 'task', target: 1, unit: '', step: 1,
    hours: 1, date: null, time: null, endTime: null, notes: '', notionUrl: '', links: [], source: null, schedule: false,
    archived: false, order: 0, ...fields,
  };
}
function defaultState() {
  return {
    version: 2,
    commitments: DEFAULT_COMMITMENTS.map(([freq, kind, section, name, target, unit, hours], i) =>
      newCommitment({ freq, kind, section, name, target, unit, hours, step: isHourUnit(unit) ? 0.5 : 1, order: i })),
    weeks: {},
    calendars: { feeds: [] },
    widget: { enabled: false, token: null, lastPush: null, lastError: null },
    sync: freshSync(),
    apps: { items: [], fetchedAt: null, error: null, setup: false },
    lastBackup: null,
  };
}
const fit7 = (a, fill) => (Array.isArray(a) ? a.slice(0, 7) : []).concat(Array(7).fill(fill)).slice(0, 7);

function normaliseCommitment(c) {
  const n = newCommitment(c);
  n.freq = FREQS.includes(n.freq) ? n.freq : 'daily';
  n.kind = n.kind === 'counter' ? 'counter' : 'task';
  n.links = (Array.isArray(n.links) ? n.links : []).map((l) => ({ label: String(l.label || ''), url: cleanUrl(l.url) })).filter((l) => l.url);
  n.notionUrl = cleanUrl(n.notionUrl);
  n.stageUrl = cleanUrl(n.stageUrl); // test / interview link for application follow-ups
  n.time = validTime(n.time); n.endTime = validTime(n.endTime);
  n.tbc = n.freq === 'once' && !n.date; // date to be confirmed
  if (n.stage === 'IV') { n.stage = 'IT'; n.name = n.name.replace(/ · IV$/, ' · IT'); } // interview was IV briefly
  return n;
}
function normaliseItem(it) {
  it.ticks = fit7(it.ticks, false).map(Boolean);
  it.counts = fit7(it.counts, 0).map((n) => num(n));
  it.mins = fit7(it.mins, null).map((m) => (m == null ? null : num(m)));
  it.count = num(it.count);
  it.done = !!it.done;
  return it;
}

function migrate(s) {
  if (!s || !Array.isArray(s.commitments) || typeof s.weeks !== 'object' || s.weeks === null) {
    throw new Error("This doesn't look like a Commitments backup.");
  }
  if ((s.version || 1) < 2) {
    // v1: every commitment was hours-based; weekly ones logged hours in 0.5h steps.
    const convert = (o) => {
      const freq = o.type === 'weekly' ? 'weekly' : 'daily';
      const hours = num(o.target);
      if (freq === 'weekly') return { freq, kind: 'counter', target: hours, unit: 'h', step: 0.5, hours, name: o.name };
      return { freq, kind: 'task', target: 1, unit: '', step: 1, hours, name: o.name };
    };
    for (const c of s.commitments) { Object.assign(c, convert(c)); delete c.type; }
    for (const w of Object.values(s.weeks)) {
      for (const it of Object.values(w.items || {})) {
        const v1Hours = num(it.hours);
        const conv = convert(it);
        const ticks = fit7(it.ticks, false);
        it.counts = conv.kind === 'counter' && conv.freq === 'daily' ? ticks.map((t) => (t ? conv.target : 0)) : Array(7).fill(0);
        it.count = conv.freq === 'weekly' ? v1Hours : 0;
        Object.assign(it, conv, { date: null });
        delete it.type;
      }
    }
    s.version = 2;
  }
  s.commitments = s.commitments.map(normaliseCommitment);
  const feeds = s.calendars && Array.isArray(s.calendars.feeds) ? s.calendars.feeds : [];
  const obj = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});
  const wd = obj(s.widget);
  s.widget = {
    enabled: !!wd.enabled && /^[A-Za-z0-9_-]{32,128}$/.test(wd.token || ''), token: wd.token || null,
    lastPush: wd.lastPush || null, lastError: wd.lastError || null,
  };
  const ap = obj(s.apps);
  s.apps = { items: Array.isArray(ap.items) ? ap.items : [], fetchedAt: ap.fetchedAt || null, error: ap.error || null, setup: !!ap.setup };
  const sy = obj(s.sync);
  s.sync = {
    ...freshSync(),
    enabled: !!sy.enabled && /^[A-Za-z0-9_-]{32,128}$/.test(sy.key || ''), key: sy.key || null,
    version: Number(sy.version) || 0, stamps: obj(sy.stamps), dirty: obj(sy.dirty), tombs: obj(sy.tombs),
    lastSync: sy.lastSync || null, lastError: sy.lastError || null,
  };
  if (!s.sync.enabled) s.sync = freshSync();
  s.calendars = {
    feeds: feeds.filter((f) => f && f.url).map((f) => ({
      id: f.id || uid(), name: String(f.name || 'Calendar'), url: String(f.url), section: String(f.section || 'Calendar'),
      lastSync: f.lastSync || null, lastError: f.lastError || null,
      decisions: obj(f.decisions), skipped: obj(f.skipped), pending: Array.isArray(f.pending) ? f.pending : [], ask: !!f.ask,
      allSchedule: !!f.allSchedule,
    })),
  };
  for (const [key, w] of Object.entries(s.weeks)) {
    w.start = w.start || key;
    w.items = w.items || {};
    for (const it of Object.values(w.items)) {
      normaliseItem(it);
      it.kind = it.kind === 'counter' ? 'counter' : 'task';
      it.freq = FREQS.includes(it.freq) ? it.freq : 'daily';
    }
  }
  return s;
}

// ---------- Weeks ----------
// A week stores a snapshot of each commitment so past weeks keep the plan they had.
const SNAPSHOT_FIELDS = ['name', 'section', 'freq', 'kind', 'target', 'unit', 'step', 'hours', 'order', 'date', 'time', 'endTime', 'schedule'];
function blankItem(c) {
  const it = { ticks: Array(7).fill(false), counts: Array(7).fill(0), mins: Array(7).fill(null), count: 0, done: false };
  for (const f of SNAPSHOT_FIELDS) it[f] = c[f];
  return it;
}
const hasData = (it) => it.ticks.some(Boolean) || it.counts.some((n) => n > 0) || it.mins.some((m) => m != null) || it.count > 0 || it.done;

function applyCommitment(it, c) {
  if (it.kind !== c.kind) {
    // Carry progress across when a task becomes a counter or vice versa.
    if (c.kind === 'counter') {
      it.counts = it.counts.map((n, i) => (it.ticks[i] ? Math.max(n, c.target) : n));
      if (it.done) it.count = Math.max(it.count, c.target);
    } else {
      it.ticks = it.ticks.map((t, i) => t || reached(it.counts[i], it.target));
      it.done = it.done || reached(it.count, it.target);
    }
  }
  for (const f of SNAPSHOT_FIELDS) it[f] = c[f];
  it.archived = false;
}
function belongs(c, w) {
  if (c.archived) return false;
  if (c.freq === 'once') return !!c.date && c.date >= w.start && c.date <= weekEnd(w.start);
  return true;
}
// Live weeks (current/future) follow every commitment edit. Past weeks stay frozen,
// except one-off items, which always live in the week of their date.
function syncWeek(w, live) {
  const byId = new Map(state.commitments.map((c) => [c.id, c]));
  for (const c of state.commitments) {
    if (!live && c.freq !== 'once') continue;
    if (!belongs(c, w)) continue;
    if (w.items[c.id]) applyCommitment(w.items[c.id], c);
    else w.items[c.id] = blankItem(c);
  }
  for (const [id, it] of Object.entries(w.items)) {
    const c = byId.get(id);
    if (!it.freq) continue;
    if (!live && it.freq !== 'once') continue;
    if (c && belongs(c, w)) continue;
    if (!hasData(it)) delete w.items[id];
    else it.archived = true;
  }
}
const isLiveWeek = (key) => key >= currentWeekKey();
function getWeek(key, create = isLiveWeek(key)) {
  let w = state.weeks[key];
  if (!w && create) { w = state.weeks[key] = { start: key, items: {} }; save(); }
  if (w) syncWeek(w, isLiveWeek(key));
  return w;
}

// ---------- Progress maths ----------
const reached = (n, target) => (target > 0 ? n >= target - 1e-9 : n > 0);
const plannedHours = (it) => (it.kind === 'counter' && isHourUnit(it.unit) ? it.target : it.hours);
const counterHours = (it, n) => (isHourUnit(it.unit) ? n : it.target > 0 ? (it.hours * n) / it.target : 0);
const dayDone = (it, i) => (it.kind === 'task' ? it.ticks[i] : reached(it.counts[i], it.target));
const dayStarted = (it, i) => (it.kind === 'task' ? it.ticks[i] : it.counts[i] > 0);
function dayHours(it, i) {
  if (it.mins[i] != null && dayStarted(it, i)) return it.mins[i] / 60;
  return it.kind === 'task' ? (it.ticks[i] ? it.hours : 0) : counterHours(it, it.counts[i]);
}
const periodDone = (it) => (it.kind === 'task' ? it.done : reached(it.count, it.target));
const periodHours = (it) => (it.kind === 'task' ? (it.done ? it.hours : 0) : counterHours(it, it.count));

function weekStats(w) {
  const cur = currentWeekKey();
  const ti = todayIndex(w.start);
  const daysElapsed = w.start < cur ? 7 : w.start > cur ? 0 : ti + 1;
  const today = todayISO();
  let planned = 0, actual = 0, pace = 0, ticked = 0, total = 0;
  for (const it of Object.values(w.items)) {
    if (!it.freq || it.schedule) continue;
    const ph = plannedHours(it);
    if (it.freq === 'daily') {
      planned += ph * 7; pace += ph * daysElapsed; total += 7;
      for (let i = 0; i < 7; i++) { if (dayDone(it, i)) ticked++; actual += dayHours(it, i); }
    } else {
      planned += ph; total += 1;
      pace += it.freq === 'weekly' ? (ph * daysElapsed) / 7 : it.date <= today ? ph : 0;
      if (periodDone(it)) ticked++;
      actual += periodHours(it);
    }
  }
  return { planned, actual, pace, ticked, total, pct: total ? ticked / total : 0 };
}
function dayStats(w, i) {
  const iso = isoDate(dayDate(w.start, i));
  let planned = 0, actual = 0, done = 0, total = 0;
  for (const it of Object.values(w.items)) {
    if (!it.freq || it.schedule) continue;
    if (it.freq === 'daily') {
      planned += plannedHours(it); actual += dayHours(it, i); total++; if (dayDone(it, i)) done++;
    } else if (it.freq === 'once' && it.date === iso) {
      planned += plannedHours(it); actual += periodHours(it); total++; if (periodDone(it)) done++;
    }
  }
  return { planned, actual, done, total };
}

function itemsOf(w, freq) {
  return Object.entries(w.items).filter(([, it]) => it.freq === freq)
    .sort((a, b) => (freq === 'once' ? onceSortKey(a[1]).localeCompare(onceSortKey(b[1])) : 0) || a[1].order - b[1].order);
}
// Schedule items are repeating calendar events (e.g. lectures): shown on the calendar and in the
// day's schedule, but not to-dos, so they don't count towards % ticked or planned/actual hours.
const isTask = ([, it]) => !it.schedule;
const isSched = ([, it]) => !!it.schedule;
const locationOf = (x) => ((x.notes || '').startsWith('📍') ? x.notes.split('\n')[0].replace('📍', '').trim() : '');
// Week items don't carry notes, so look the location up on the commitment itself.
const stageUrlById = (id) => { const c = state.commitments.find((x) => x.id === id); return (c && c.stageUrl) || ''; };
const locationById = (id) => { const c = state.commitments.find((x) => x.id === id); return c ? locationOf(c) : ''; };
const onceSortKey = (x) => `${x.date || ''} ${x.time || '  :  '}`;
function groupBySection(entries, getSection = (e) => e[1].section) {
  const sections = new Map();
  for (const e of entries) {
    const s = getSection(e) || 'Other';
    if (!sections.has(s)) sections.set(s, []);
    sections.get(s).push(e);
  }
  return sections;
}

// Short descriptions such as "3 emails/day", "15h/week", "1h".
function targetLabel(x) {
  const per = x.freq === 'daily' ? '/day' : x.freq === 'weekly' ? '/week' : '';
  if (x.kind === 'counter') {
    return isHourUnit(x.unit) ? `${round2(x.target)}h${per}` : `${round2(x.target)} ${x.unit || ''}`.trim() + per + (x.hours ? ` · ≈${fmtH(x.hours)}` : '');
  }
  return `${fmtH(x.hours)}${per}`;
}
function countLabel(it, n) {
  return isHourUnit(it.unit) ? `${round2(n)} of ${fmtH(it.target)}` : `${round2(n)}/${round2(it.target)} ${it.unit || ''}`.trim();
}

// ---------- Routing ----------
// #/today  #/week  #/commitments  #/c/<id>  #/c/<id>/edit  #/new/<freq>
function parseHash() {
  const [a, b, c] = location.hash.replace(/^#\/?/, '').split('/');
  if (a === 'c' && b) return { tab: 'commitments', id: b, edit: c === 'edit' };
  if (a === 'apps') return { tab: 'apps', day: /^\d{4}-\d{2}-\d{2}$/.test(b || '') ? b : null };
  if (a === 'widget') return { tab: 'commitments', page: 'widget' };
  if (a === 'sync') return { tab: 'commitments', page: 'sync' };
  if (a === 'calendar') return { tab: 'commitments', page: b === 'review' ? 'review' : 'calendar' };
  if (a === 'new') return { tab: 'commitments', id: 'new', edit: true, freq: FREQS.includes(b) ? b : 'daily' };
  return { tab: ['today', 'week', 'cal', 'commitments'].includes(a) ? a : 'cal' };
}
let route = parseHash();
window.addEventListener('hashchange', () => {
  route = parseHash();
  if (route.tab === 'apps') {
    if (route.day) { appsDay = route.day; appsMonth = route.day.slice(0, 7); }
    refreshApps();
  }
  closeSheet();
  render();
  window.scrollTo(0, 0);
});
function goBack(fallback = '#/cal') {
  if (history.length > 1) history.back(); else location.hash = fallback;
}

// ---------- Rendering ----------
const $app = document.getElementById('app');
const $sheet = document.getElementById('sheet');

function render() {
  if (!state) return; // still loading saved data
  let html;
  if (route.page === 'sync') html = syncPageHtml();
  else if (route.page === 'widget') html = widgetPageHtml();
  else if (route.page === 'calendar') html = calendarPageHtml();
  else if (route.page === 'review') html = reviewPageHtml();
  else if (route.id && route.edit) html = editPageHtml();
  else if (route.id) html = detailPageHtml(route.id);
  else if (route.tab === 'week') html = weekTabHtml();
  else if (route.tab === 'cal') html = calendarTabHtml();
  else if (route.tab === 'apps') html = appsTabHtml();
  else if (route.tab === 'commitments') html = commitmentsTabHtml();
  else html = todayTabHtml();
  $app.dataset.tab = route.id || route.page ? 'page' : route.tab;
  $app.innerHTML = html + tabBarHtml() + sideNavHtml();
  fillSideSections();
}

// ---------- Side navigation (wide screens, e.g. the Mac app) ----------
// The main pages, plus the current page's sections as jump links (highlighted while scrolling).
// Phones keep the bottom tab bar instead (CSS switches at 900px).
const NAV_PAGES = [['cal', 'Calendar'], ['today', 'Today'], ['week', 'Week'], ['apps', 'Applications'], ['commitments', 'Commitments']];
function sideNavHtml() {
  const extra = [['#/calendar', 'Calendars'], ['#/sync', `Sync${state.sync.enabled ? ' · on' : ''}`], ['#/widget', 'Phone widget']];
  return `<aside class="sidenav" aria-label="Navigation">
    <div class="sn-brand"><img src="icons/icon-192.png" alt=""><b>Commitments</b></div>
    <nav class="sn-main">${NAV_PAGES.map(([t, label]) => `
      <a href="#/${t}" class="sn-page ${route.tab === t ? 'on' : ''}" ${route.tab === t && !route.id && !route.page ? 'aria-current="page"' : ''}>${ICONS[t]}<span>${label}</span></a>
      ${route.tab === t ? '<div class="sn-sections"></div>' : ''}`).join('')}</nav>
    <div class="sn-extra">
      ${extra.map(([href, label]) => `<a href="${href}" class="${location.hash === href ? 'on' : ''}">${label}</a>`).join('')}
      <button data-act="export-xlsx">Export to Excel</button>
    </div>
  </aside>`;
}
function pageSections() {
  return [...$app.querySelectorAll(':scope > section.card, :scope > details.card, :scope > form.card')].map((el, i) => {
    const title = el.dataset.section || el.querySelector('.card-head h2')?.textContent || el.querySelector(':scope > summary')?.textContent || '';
    el.id = el.id || `sec-${i}`;
    return { el, title: title.trim() };
  }).filter((x) => x.title);
}
function fillSideSections() {
  const holder = $app.querySelector('.sn-sections');
  if (!holder) return;
  const secs = pageSections();
  holder.innerHTML = secs.length > 1 ? secs.map((x) => `<button data-jump="${x.el.id}">${escapeHtml(x.title)}</button>`).join('') : '';
  highlightSection();
}
// Marks the section currently at the top of the window.
let jumpHoldUntil = 0;
function highlightSection() {
  const links = [...$app.querySelectorAll('.sn-sections [data-jump]')];
  if (!links.length || Date.now() < jumpHoldUntil) return;
  let current = links[0].dataset.jump;
  for (const l of links) {
    const el = document.getElementById(l.dataset.jump);
    if (el && el.getBoundingClientRect().top < 140) current = l.dataset.jump;
  }
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = links[links.length - 1].dataset.jump;
  links.forEach((l) => l.classList.toggle('on', l.dataset.jump === current));
}
document.addEventListener('toggle', (e) => {
  const d = e.target;
  if (d.dataset && d.dataset.fold) { if (d.open) appsExpanded.add(`open:${d.dataset.fold}`); else appsExpanded.delete(`open:${d.dataset.fold}`); }
}, true);
let scrollTick = false;
window.addEventListener('scroll', () => {
  if (scrollTick) return;
  scrollTick = true;
  requestAnimationFrame(() => { scrollTick = false; highlightSection(); });
}, { passive: true });

function tabBarHtml() {
  const tab = (t, label) => `<a href="#/${t}" class="${route.tab === t ? 'on' : ''}" ${route.tab === t && !route.id ? 'aria-current="page"' : ''}>${ICONS[t]}<span>${label}</span></a>`;
  return `<nav class="tabbar">${tab('cal', 'Calendar')}${tab('today', 'Today')}${tab('week', 'Week')}${tab('apps', 'Applications')}${tab('commitments', 'Commitments')}</nav>`;
}

function topBar({ left = '', label = '', title = '', right = '', titleAct = '' }) {
  const t = `<span class="lbl">${label}</span><span class="range">${title}</span>`;
  return `<div class="nav">${left || '<span class="icon-spacer"></span>'}
    ${titleAct ? `<button class="wk" ${titleAct}>${t}</button>` : `<div class="wk">${t}</div>`}
    ${right || '<span class="icon-spacer"></span>'}</div>`;
}
const menuBtn = '<button class="icon-btn" data-act="menu" aria-label="Menu">⋯</button>';

// --- daily cells (shared by Week grid, Today list and detail page) ---
function cellInner(it, i) {
  if (it.kind === 'task') return it.ticks[i] ? (it.mins[i] != null ? `<span class="m">${it.mins[i]}</span>` : CHECK) : '';
  const n = it.counts[i];
  return n > 0 ? `<span class="m">${round2(n)}</span>` : '';
}
function cellClass(it, i) {
  if (dayDone(it, i)) return 'on';
  return dayStarted(it, i) ? 'part' : '';
}
function cellLabel(it, i) {
  const what = it.kind === 'task' ? (it.ticks[i] ? 'done' : 'not done') : countLabel(it, it.counts[i]);
  return `${it.name}, ${DAY_NAMES[i]}: ${what}${it.mins[i] != null ? `, ${it.mins[i]} minutes` : ''}`;
}
function dayCellsHtml(wk, id, it) {
  const ti = todayIndex(wk);
  const today = startOfToday();
  return it.ticks.map((_, i) => `<button class="cell ${cellClass(it, i)} ${i === ti ? 'today' : ''} ${dayDate(wk, i) > today ? 'future' : ''}"
      data-cell="${wk}:${id}:${i}" aria-label="${escapeHtml(cellLabel(it, i))}"><span class="box">${cellInner(it, i)}</span></button>`).join('');
}
function dayHeadHtml(wk) {
  const ti = todayIndex(wk);
  return `<div class="row head">${DAY_NAMES.map((d, i) =>
    `<div class="dh ${i === ti ? 'today' : ''}"><span>${d[0]}</span><b>${dayDate(wk, i).getDate()}</b></div>`).join('')}</div>`;
}

// --- weekly / one-off rows (shared) ---
function periodRowHtml(wk, id, it, { showDate = false } = {}) {
  const done = periodDone(it);
  const sub = [showDate && it.date ? fmtShort(it.date) : '', timeRange(it),
    it.kind === 'counter' ? countLabel(it, it.count) : fmtH(it.hours)].filter(Boolean).join(' · ');
  const pct = it.kind === 'counter' ? (it.target ? Math.min(100, (it.count / it.target) * 100) : it.count > 0 ? 100 : 0) : 0;
  const check = it.kind === 'task'
    ? `<button class="chk ${done ? 'on' : ''}" data-act="pdone" data-wk="${wk}" data-id="${id}" aria-pressed="${done}" aria-label="${escapeHtml(it.name)} done">${done ? CHECK : ''}</button>`
    : `<span class="chk ring ${done ? 'on' : ''}" aria-hidden="true">${done ? CHECK : ''}</span>`;
  const stepper = it.kind === 'counter' ? `
    <div class="stepper">
      <button data-act="pstep" data-wk="${wk}" data-id="${id}" data-dir="-1" aria-label="Minus ${it.step}" ${it.count <= 0 ? 'disabled' : ''}>−</button>
      <button data-act="pstep" data-wk="${wk}" data-id="${id}" data-dir="1" aria-label="Plus ${it.step}">+</button>
    </div>` : '<span></span>';
  return `
    <div class="wrow ${done ? 'is-done' : ''} ${it.archived ? 'archived' : ''}">
      ${check}
      <a class="name" href="#/c/${id}">
        <div class="n">${escapeHtml(it.name)}</div>
        <div class="sub">${sub}</div>
        ${it.kind === 'counter' ? `<div class="mini"><i style="width:${pct}%"></i></div>` : ''}
      </a>
      ${stageUrlById(id) ? `<a class="mini-btn go-link" href="${escapeHtml(stageUrlById(id))}" target="_blank" rel="noopener" title="Open link">↗</a>` : stepper}
    </div>`;
}

function statsHtml(s, { showPace }) {
  const barW = s.planned ? Math.min(100, (s.actual / s.planned) * 100) : 0;
  const paceX = s.planned ? Math.min(100, (s.pace / s.planned) * 100) : 0;
  return `
    <div class="stats">
      <div class="stat"><b>${Math.round(s.pct * 100)}%</b><span>ticked · ${s.ticked}/${s.total}</span></div>
      <div class="stat right"><b>${fmtH(s.actual)} <small>/ ${fmtH(s.planned)}</small></b><span>actual / planned</span></div>
    </div>
    <div class="hbar" role="img" aria-label="${fmtH(s.actual)} of ${fmtH(s.planned)} planned">
      <i style="width:${barW}%"></i>${showPace && s.pace > 0 ? `<em style="left:${paceX}%"></em>` : ''}
    </div>
    ${showPace && s.pace > 0 ? `<div class="pace">Pace for end of today: ${fmtH(s.pace)} · ${s.actual >= s.pace - 1e-9 ? 'on track' : fmtH(s.pace - s.actual) + ' behind'}</div>` : ''}`;
}

// ---------- Today tab ----------
function todayTabHtml() {
  const wk = currentWeekKey();
  const w = getWeek(wk);
  const ti = todayIndex(wk);
  const ds = dayStats(w, ti);
  const ws = weekStats(w);
  const iso = todayISO();

  let daily = '';
  for (const [section, entries] of groupBySection(itemsOf(w, 'daily'))) {
    daily += `<div class="sec">${escapeHtml(section)}</div>`;
    for (const [id, it] of entries) {
      const key = `${wk}:${id}:${ti}`;
      const daysDone = it.ticks.filter((_, i) => dayDone(it, i)).length;
      const control = it.kind === 'task'
        ? `<button class="big cell ${cellClass(it, ti)}" data-cell="${key}" aria-label="${escapeHtml(cellLabel(it, ti))}"><span class="box">${cellInner(it, ti)}</span></button>`
        : `<div class="ctr">
             <button class="ctr-minus" data-act="cdec" data-key="${key}" aria-label="Minus ${it.step}" ${it.counts[ti] <= 0 ? 'disabled' : ''}>−</button>
             <button class="big cell ${cellClass(it, ti)}" data-cell="${key}" aria-label="${escapeHtml(cellLabel(it, ti))}">
               <span class="box wide">${round2(it.counts[ti])}<small>/${round2(it.target)}</small></span></button>
           </div>`;
      daily += `
        <div class="trow ${it.archived ? 'archived' : ''}">
          <a class="name" href="#/c/${id}"><div class="n">${escapeHtml(it.name)}</div>
            <div class="sub">${targetLabel(it)} · ${daysDone}/7 this week</div></a>
          ${control}
        </div>`;
    }
  }
  const onceToday = itemsOf(w, 'once').filter(isTask).filter(([, it]) => it.date === iso);
  const onceLater = itemsOf(w, 'once').filter(isTask).filter(([, it]) => it.date > iso);
  const schedToday = itemsOf(w, 'once').filter(isSched).filter(([, it]) => it.date === iso);
  const weekly = itemsOf(w, 'weekly');

  return `
    <header class="top">
      ${topBar({ label: 'Today', title: fmtDay(startOfToday(), { weekday: 'long', day: 'numeric', month: 'short' }), right: menuBtn })}
      <div class="stats">
        <div class="stat"><b>${ds.done}<small>/${ds.total}</small></b><span>done today</span></div>
        <div class="stat right"><b>${fmtH(ds.actual)} <small>/ ${fmtH(ds.planned)}</small></b><span>today actual / planned</span></div>
      </div>
      <div class="hbar"><i style="width:${ds.planned ? Math.min(100, (ds.actual / ds.planned) * 100) : 0}%"></i></div>
      <div class="pace"><a href="#/week">This week: ${fmtH(ws.actual)} of ${fmtH(ws.planned)} · ${Math.round(ws.pct * 100)}% ticked ›</a></div>
    </header>
    ${reviewBannerHtml()}
    ${schedToday.length ? `<section class="card"><div class="card-head"><h2>Schedule</h2><a class="txt-btn" href="#/cal">Calendar ›</a></div>
      ${scheduleRowsHtml(schedToday)}</section>` : ''}
    ${appsTodayCardHtml()}
    <section class="card">
      <div class="card-head"><h2>Daily</h2><span class="hint">Tap to log · hold for minutes</span></div>
      ${daily || '<p class="muted pad">No daily commitments yet.</p>'}
    </section>
    ${onceToday.length ? `<section class="card"><div class="card-head"><h2>Today only</h2></div>
      ${onceToday.map(([id, it]) => periodRowHtml(wk, id, it)).join('')}</section>` : ''}
    ${weekly.length ? `<section class="card"><div class="card-head"><h2>This week</h2><span class="hint">Weekly goals</span></div>
      ${weekly.map(([id, it]) => periodRowHtml(wk, id, it)).join('')}</section>` : ''}
    ${tbcTodayHtml()}
    ${onceLater.length ? `<section class="card"><div class="card-head"><h2>Coming up this week</h2></div>
      ${onceLater.map(([id, it]) => periodRowHtml(wk, id, it, { showDate: true })).join('')}</section>` : ''}`;
}

// One-offs whose date is still to be confirmed (shown folded on Today).
function tbcTodayHtml() {
  const list = state.commitments.filter((c) => c.freq === 'once' && !c.date && !c.archived);
  if (!list.length) return '';
  return `<details class="card fold"><summary>Date to be confirmed (${list.length})</summary>
    ${list.map((c) => `<a class="crow" href="#/c/${c.id}"><div class="ctext"><div class="n">${escapeHtml(c.name)}</div>
      <div class="sub">${escapeHtml(c.section)} · tap to set a date</div></div><span class="chev">›</span></a>`).join('')}</details>`;
}

// Compact schedule list: time · name · place. Past sessions are dimmed.
function scheduleRowsHtml(entries) {
  const now = new Date();
  const nowHM = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return entries.map(([id, it]) => {
    const past = it.date < todayISO() || (it.date === todayISO() && (it.endTime || it.time || '99:99') <= nowHM);
    const where = locationById(id);
    return `<div class="srow ${past ? 'past' : ''}" data-open="#/c/${id}">
      <span class="stime">${it.time ? escapeHtml(timeRange(it)) : 'All day'}</span>
      <span class="sname">${escapeHtml(it.name)}${where ? `<small>${escapeHtml(where)}</small>` : ''}</span></div>`;
  }).join('');
}

// ---------- Week tab ----------
function weekLabel(key) {
  const n = weeksBetween(currentWeekKey(), key);
  if (n === 0) return 'This week';
  if (n === -1) return 'Last week';
  if (n === 1) return 'Next week';
  return n < 0 ? `${-n} weeks ago` : `In ${n} weeks`;
}

function weekTabHtml() {
  const w = getWeek(viewKey);
  const isCurrent = viewKey === currentWeekKey();
  const header = `
    <header class="top">
      ${topBar({
        left: '<button class="icon-btn" data-act="prev" aria-label="Previous week">‹</button>',
        label: weekLabel(viewKey) + (isCurrent ? '' : ' · tap for this week'),
        title: weekRange(viewKey),
        titleAct: `data-act="thisweek" ${isCurrent ? 'disabled' : ''}`,
        right: '<button class="icon-btn" data-act="next" aria-label="Next week">›</button>' + menuBtn,
      })}
      ${w ? statsHtml(weekStats(w), { showPace: isCurrent }) : ''}
    </header>`;
  const hasRecurring = w && Object.values(w.items).some((it) => it.freq !== 'once');
  const startCard = !hasRecurring && !isLiveWeek(viewKey) ? `
    <section class="card empty">
      <p>No record of daily/weekly commitments for this week.</p>
      <button class="btn primary" data-act="start-week">Fill it in with current commitments</button>
    </section>` : '';
  if (!w) return header + startCard;

  let grid = '';
  for (const [section, entries] of groupBySection(itemsOf(w, 'daily'))) {
    grid += `<div class="sec">${escapeHtml(section)}</div>`;
    for (const [id, it] of entries) {
      const daysDone = it.ticks.filter((_, i) => dayDone(it, i)).length;
      const hrs = it.ticks.reduce((s, _, i) => s + dayHours(it, i), 0);
      grid += `
        <div class="row ${it.archived ? 'archived' : ''}">
          <a class="name" href="#/c/${id}"><span class="n">${escapeHtml(it.name)}</span>
            <span class="sub">${daysDone}/7 · ${fmtH(hrs)} of ${fmtH(plannedHours(it) * 7)}</span></a>
          ${dayCellsHtml(viewKey, id, it)}
        </div>`;
    }
  }
  const once = itemsOf(w, 'once').filter(isTask);
  const weekly = itemsOf(w, 'weekly');
  return header + startCard + (grid ? `
    <section class="card daily">
      <div class="card-head"><h2>Daily</h2><span class="hint">Tap to log · hold for minutes</span></div>
      ${dayHeadHtml(viewKey)}${grid}
    </section>` : '') +
    (once.length ? `<section class="card"><div class="card-head"><h2>One-off</h2></div>
      ${once.map(([id, it]) => periodRowHtml(viewKey, id, it, { showDate: true })).join('')}</section>` : '') +
    (weekly.length ? `<section class="card weekly"><div class="card-head"><h2>Weekly</h2><span class="hint">± logs progress</span></div>
      ${[...groupBySection(weekly)].map(([s, es]) => `<div class="sec">${escapeHtml(s)}</div>` +
        es.map(([id, it]) => periodRowHtml(viewKey, id, it)).join('')).join('')}</section>` : '');
}

// ---------- Calendar tab ----------
// A time grid of one-off events (lectures, seminars, meetings). Phones show one day at a time
// with a day strip to switch; wide screens show the whole week (CSS hides the other days on phones).
const HOUR_PX = 52;
let calViewDay = todayISO(); // selected day (phone view)

const toMinutes = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fmtTime = (mins) => `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;

// Side-by-side columns for overlapping events.
function layoutDay(events) {
  const sorted = [...events].sort((a, b) => a.start - b.start || b.end - a.end);
  let cluster = [], clusterEnd = -1;
  const lanesEnd = [];
  const finish = () => { const n = Math.max(...cluster.map((e) => e.lane)) + 1; cluster.forEach((e) => { e.lanes = n; }); };
  for (const e of sorted) {
    if (cluster.length && e.start >= clusterEnd) { finish(); cluster = []; lanesEnd.length = 0; }
    let lane = lanesEnd.findIndex((end) => end <= e.start);
    if (lane < 0) lane = lanesEnd.length;
    lanesEnd[lane] = e.end;
    e.lane = lane;
    cluster.push(e);
    clusterEnd = Math.max(clusterEnd, e.end);
  }
  if (cluster.length) finish();
  return sorted;
}

function calendarTabHtml() {
  const wk = weekOf(calViewDay);
  const w = getWeek(wk);
  const today = todayISO();
  const days = DAY_NAMES.map((_, i) => isoDate(dayDate(wk, i)));
  const once = w ? itemsOf(w, 'once') : [];
  const timed = {}, untimed = {};
  for (const d of days) { timed[d] = []; untimed[d] = []; }
  for (const [id, it] of once) {
    if (!timed[it.date]) continue;
    if (it.time) {
      const start = toMinutes(it.time);
      const end = it.endTime && toMinutes(it.endTime) > start ? toMinutes(it.endTime) : start + Math.max(30, Math.round((it.hours || 1) * 60));
      timed[it.date].push({ id, it, start, end });
    } else {
      untimed[it.date].push([id, it]);
    }
  }
  // Show 08:00–20:00 at least, widened to fit the week's events.
  const all = days.flatMap((d) => timed[d]);
  const startHour = Math.min(8, ...all.map((e) => Math.floor(e.start / 60)));
  const endHour = Math.max(20, ...all.map((e) => Math.ceil(e.end / 60)));
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const gridH = hours.length * HOUR_PX;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const strip = days.map((d, i) => {
    const n = timed[d].length + untimed[d].length;
    return `<button class="cday ${d === calViewDay ? 'sel' : ''} ${d === today ? 'today' : ''}" data-act="cal-day" data-date="${d}">
      <span>${DAY_NAMES[i][0]}</span><b>${parseISO(d).getDate()}</b><i class="${n ? 'dot' : ''}"></i></button>`;
  }).join('');

  const dailyChip = (d, i) => {
    if (!w) return '';
    const s = dayStats(w, i);
    const dailyTotal = itemsOf(w, 'daily').length;
    if (!dailyTotal) return '';
    const done = itemsOf(w, 'daily').filter(([, it]) => dayDone(it, i)).length;
    return `<a class="chip-daily ${done === dailyTotal ? 'all' : ''}" href="#/${d === today ? 'today' : 'week'}">Daily ${done}/${dailyTotal}</a>`;
  };

  const cols = days.map((d, i) => {
    const evs = layoutDay(timed[d]).map((e) => {
      const sched = !!e.it.schedule;
      const done = !sched && periodDone(e.it);
      const top = ((e.start - startHour * 60) / 60) * HOUR_PX;
      const height = Math.max(22, ((e.end - e.start) / 60) * HOUR_PX - 2);
      const where = locationById(e.id);
      const tip = `${e.it.name} · ${fmtTime(e.start)}–${fmtTime(e.end)}${where ? ' · ' + where : ''}`;
      return `<div class="cev ${sched ? 'sched' : ''} ${done ? 'done' : ''} ${height < 40 ? 'short' : ''}" data-open="#/c/${e.id}" title="${escapeHtml(tip)}"
          style="top:${top}px;height:${height}px;left:calc(${(e.lane / e.lanes) * 100}% + 2px);width:calc(${100 / e.lanes}% - 4px)">
        ${sched ? '' : `<button class="cev-chk" data-act="pdone" data-wk="${wk}" data-id="${e.id}" aria-label="${escapeHtml(e.it.name)} done" aria-pressed="${done}">${done ? CHECK : ''}</button>`}
        <div class="cev-body"><b>${escapeHtml(e.it.name)}</b></div>
      </div>`;
    }).join('');
    const nowLine = d === today && nowMin >= startHour * 60 && nowMin <= endHour * 60
      ? `<div class="cnow" style="top:${((nowMin - startHour * 60) / 60) * HOUR_PX}px"></div>` : '';
    return `<div class="ccol ${d === calViewDay ? 'sel' : ''} ${d === today ? 'today' : ''}" style="height:${gridH}px">${evs}${nowLine}</div>`;
  }).join('');

  const appsByDay = {};
  for (const e of appEvents()) (appsByDay[e.date] = appsByDay[e.date] || []).push(e);
  const allDay = days.map((d, i) => `<div class="call ${d === calViewDay ? 'sel' : ''}">
      ${dailyChip(d, i)}
      ${(appsByDay[d] || []).map((e) => `<a class="chip-app k-${e.kind}" href="#/apps/${d}" title="${escapeHtml(`${e.a.company} ${APP_EVENT_LABEL[e.kind]}`)}">${escapeHtml(e.a.company)} ${e.kind === 'open' ? 'opens' : e.kind === 'close' ? 'closes' : 'due'}</a>`).join('')}
      ${untimed[d].map(([id, it]) => { const sched = !!it.schedule; const done = !sched && periodDone(it); return `<div class="cuntimed ${sched ? 'sched' : ''} ${done ? 'done' : ''}" data-open="#/c/${id}">
        ${sched ? '' : `<button class="cev-chk" data-act="pdone" data-wk="${wk}" data-id="${id}" aria-label="${escapeHtml(it.name)} done">${done ? CHECK : ''}</button>`}
        <span>${escapeHtml(it.name)}</span></div>`; }).join('')}
    </div>`).join('');

  const heads = days.map((d, i) => `<div class="chead ${d === today ? 'today' : ''}"><span>${DAY_NAMES[i]}</span><b>${parseISO(d).getDate()}</b></div>`).join('');
  const isThisWeek = wk === currentWeekKey();
  const nothing = !all.length && !days.some((d) => untimed[d].length);

  return `
    <header class="top">
      ${topBar({
        left: '<button class="icon-btn" data-act="cal-prev" aria-label="Previous week">‹</button>',
        label: isThisWeek ? 'Calendar' : 'Calendar · tap for this week',
        title: weekRange(wk),
        titleAct: `data-act="cal-today" ${isThisWeek && calViewDay === today ? 'disabled' : ''}`,
        right: '<button class="icon-btn" data-act="cal-next" aria-label="Next week">›</button>' + menuBtn,
      })}
      <div class="cstrip">${strip}</div>
    </header>
    <section class="card cal">
      <div class="cgrid-head"><div class="ctimes-gap"></div>${heads}</div>
      <div class="call-row"><div class="ctimes-gap small muted">all day</div>${allDay}</div>
      <div class="cgrid">
        <div class="ctimes">${hours.map((h) => `<div style="height:${HOUR_PX}px">${pad(h)}:00</div>`).join('')}</div>
        <div class="ccols" style="height:${gridH}px;background-size:100% ${HOUR_PX}px">${cols}</div>
      </div>
      ${nothing ? `<p class="muted small pad center">No events this week. Connect a calendar in <a href="#/calendar">Commitments → Calendars</a>, or add a one-off with a time.</p>` : ''}
    </section>`;
}

// ---------- Applications (from Notion) ----------
// /api/apps reads your Notion tracker (see server/apps.mjs). The list is cached on this
// device and refreshed every 30 minutes while the app is open, or with the refresh button.
const APPS_REFRESH_MS = 30 * 60e3;
let appsLoading = false;
let appsMonth = todayISO().slice(0, 7); // month shown in the Applications calendar (YYYY-MM)
let appsDay = null;                     // day picked in that calendar
const APPS_PREVIEW = 6;                 // roles shown per section before "Show all"
const appsExpanded = new Set();         // sections showing everything (and folds left open)

const APP_INACTIVE = /^(not applicable|rejected|withdrawn|n\/a)$/i;
const APP_IN_PROGRESS = /submitted|applied|online test|video|interview|assessment|final|\bot\b|\bvi\b/i;
// done · open · upcoming · unknown (no opening date yet) · closed · inprogress · offer · inactive
function appPhase(a, today = todayISO()) {
  const s = a.status || '';
  if (a.done) return 'done';
  if (APP_INACTIVE.test(s)) return 'inactive';
  if (/offer/i.test(s)) return 'offer';
  if (APP_IN_PROGRESS.test(s)) return 'inprogress';
  if (a.close && a.close < today) return 'closed';
  if (!a.open) return 'unknown'; // only roles that have actually opened count as open
  if (a.open > today) return 'upcoming';
  return 'open';
}
const daysUntil = (iso) => Math.round((parseISO(iso) - startOfToday()) / 864e5);
function relDay(iso) {
  const n = daysUntil(iso);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}
const fmtDayShort = (iso) => fmtDay(parseISO(iso), { day: 'numeric', month: 'short' });

// Dated events for calendars: openings and deadlines you still care about.
function appEvents() {
  const out = [];
  for (const a of state.apps.items) {
    const phase = appPhase(a);
    if (phase === 'inactive' || phase === 'offer') continue;
    if (a.open && (phase === 'open' || phase === 'upcoming')) out.push({ date: a.open, kind: 'open', a });
    if (a.close && ['open', 'upcoming', 'unknown', 'closed'].includes(phase)) out.push({ date: a.close, kind: 'close', a });
    // A follow-up task on that day already shows it, so skip the extra "next step" chip.
    if (a.next && phase === 'inprogress' && !followupsFor(a.id).some((c) => c.date === a.next)) out.push({ date: a.next, kind: 'next', a });
  }
  return out;
}
const APP_EVENT_LABEL = { open: 'opens', close: 'closes', next: 'next step due' };

async function refreshApps({ force = false } = {}) {
  if (!state || !state.sync.enabled || appsLoading) return;
  if (!force && state.apps.fetchedAt && Date.now() - new Date(state.apps.fetchedAt) < APPS_REFRESH_MS && !state.apps.error) return;
  appsLoading = true;
  if (route.tab === 'apps') render();
  try {
    const res = await fetch('/api/apps', { headers: { authorization: `Bearer ${state.sync.key}` } });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      state.apps = { items: Array.isArray(body.apps) ? body.apps : [], fetchedAt: body.fetchedAt || new Date().toISOString(), error: null, setup: false };
    } else {
      state.apps.error = body.error || `Couldn’t load applications (${res.status})`;
      state.apps.setup = !!body.setup;
    }
  } catch {
    state.apps.error = 'Offline. Showing the last copy from Notion.';
  } finally {
    appsLoading = false;
    writeState().catch(() => {});
    if (!route.edit && !sheetCtx && ['apps', 'cal', 'today'].includes(route.tab) && !route.id && !route.page) render();
  }
}

function appRowHtml(a) {
  const phase = appPhase(a);
  const dates = [
    a.open ? `${a.open > todayISO() ? 'Opens' : 'Opened'} ${fmtDayShort(a.open)}` : '',
    a.close ? `${a.close >= todayISO() ? 'Closes' : 'Closed'} ${fmtDayShort(a.close)}${a.close >= todayISO() ? ` (${relDay(a.close)})` : ''}` : '',
    a.next && phase === 'inprogress' ? `Next step ${fmtDayShort(a.next)} (${relDay(a.next)})` : '',
  ].filter(Boolean).join(' · ');
  const urgent = a.close && phase === 'open' && daysUntil(a.close) <= 7 && daysUntil(a.close) >= 0;
  const notion = a.notionUrl ? notionAppUrl(a.notionUrl) : '';
  const mats = a.materials || [];
  const ticked = new Set(a.materialsDone || []);
  const followChips = followupsFor(a.id).map((c) => `<span class="fchip-wrap"><a class="fchip ${onceDone(c) ? 'on' : ''}" href="#/c/${c.id}">
    ${onceDone(c) ? '✓ ' : ''}${escapeHtml(c.stage)} · ${c.date ? fmtDayShort(c.date) : 'TBC'}</a>${c.stageUrl
    ? `<a class="fchip go" href="${escapeHtml(c.stageUrl)}" target="_blank" rel="noopener" title="Open ${escapeHtml(c.stage)} link">↗</a>` : ''}</span>`).join('');
  const checklist = mats.length ? `<div class="achecklist">
      ${mats.map((m) => `<button class="mchk ${ticked.has(m) ? 'on' : ''}" data-act="app-mat" data-id="${a.id}" data-m="${escapeHtml(m)}" aria-pressed="${ticked.has(m)}">
        <span class="mbox">${ticked.has(m) ? CHECK : ''}</span>${escapeHtml(m)}</button>`).join('')}
      <span class="mprog">${mats.filter((m) => ticked.has(m)).length}/${mats.length}</span>${followChips}</div>` : (followChips ? `<div class="achecklist">${followChips}</div>` : '');
  return `
    <div class="arow2 ${urgent ? 'urgent' : ''} ${a.done ? 'is-done' : ''}">
      <div class="ctext">
        <div class="n">${escapeHtml(a.company)}</div>
        ${a.programme ? `<div class="sub">${escapeHtml(a.programme)}</div>` : ''}
        <div class="achips">
          ${a.status ? `<span class="achip st-${phase}">${escapeHtml(a.status)}</span>` : ''}
          ${/^yes$/i.test(a.rolling) && (phase === 'open' || phase === 'upcoming') ? '<span class="achip rolling">Rolling · apply early</span>' : ''}
          ${a.sector ? `<span class="achip">${escapeHtml(a.sector)}</span>` : ''}
        </div>
        ${dates ? `<div class="adates">${dates}</div>` : ''}
        ${checklist}
      </div>
      <div class="abtns">
        ${a.url ? `<a class="mini-btn primary-mini" href="${escapeHtml(cleanUrl(a.url))}" target="_blank" rel="noopener">Apply ↗</a>` : ''}
        ${a.done ? '' : `<button class="mini-btn" data-act="app-followup" data-id="${a.id}">+ Follow-up</button>`}
        ${todayTaskFor(a.id)
          ? `<button class="mini-btn done-on" data-act="app-today" data-id="${a.id}" aria-pressed="true" title="Tap again to remove from today">✓ On today</button>`
          : (a.done ? '' : `<button class="mini-btn" data-act="app-today" data-id="${a.id}" aria-pressed="false">+ Today</button>`)}
        <button class="mini-btn ${a.done ? 'done-on' : ''}" data-act="app-done" data-id="${a.id}" aria-pressed="${!!a.done}">${a.done ? '✓ Done' : 'Done'}</button>

        ${notion ? `<a class="mini-btn notion-mini" title="Open in Notion" aria-label="Open in Notion" href="${escapeHtml(notion)}" ${notion === a.notionUrl ? 'target="_blank" rel="noopener"' : ''}>N</a>` : ''}
      </div>
    </div>`;
}

function appsMonthHtml(events) {
  const [y, m] = appsMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m, 0).getDate();
  const byDay = {};
  for (const e of events) (byDay[e.date] = byDay[e.date] || []).push(e);
  const today = todayISO();
  let cells = '';
  for (let i = 0; i < startPad; i++) cells += '<span class="mday blank"></span>';
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${y}-${pad(m)}-${pad(d)}`;
    const evs = byDay[iso] || [];
    const dots = ['open', 'close', 'next'].filter((k) => evs.some((e) => e.kind === k)).map((k) => `<i class="dot-${k}"></i>`).join('');
    cells += `<button class="mday ${iso === today ? 'today' : ''} ${iso === appsDay ? 'sel' : ''} ${evs.length ? 'has' : ''}" data-act="apps-day" data-date="${iso}">
      <b>${d}</b><span class="mdots">${dots}</span></button>`;
  }
  const title = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const dayList = appsDay ? (byDay[appsDay] || []) : null;
  return `
    <section class="card" data-section="Calendar">
      <div class="mhead">
        <button class="icon-btn" data-act="apps-month" data-dir="-1" aria-label="Previous month">‹</button>
        <b>${title}</b>
        <button class="icon-btn" data-act="apps-month" data-dir="1" aria-label="Next month">›</button>
      </div>
      <div class="mgrid">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x) => `<span class="mdow">${x}</span>`).join('')}${cells}</div>
      <div class="mlegend"><span><i class="dot-open"></i>Opens</span><span><i class="dot-close"></i>Deadline</span><span><i class="dot-next"></i>Next step</span></div>
      ${dayList ? `<div class="mdaylist"><div class="sec">${fmtDay(parseISO(appsDay), { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        ${dayList.length ? dayList.map((e) => appRowHtml(e.a)).join('') : '<p class="muted small pad">Nothing on this day.</p>'}</div>` : ''}
    </section>`;
}

function appsSetupHtml() {
  return `
    <section class="card howto">
      <div class="card-head"><h2>Connect your Notion tracker</h2></div>
      <p class="small pad">One-time setup (about 3 minutes). The connection is <b>read-only</b>: the app can see your tracker but never change it.</p>
      <ol>
        <li>Open <b>notion.so/profile/integrations</b> → <b>New integration</b>. Name it <b>Commitments</b>, type <b>Internal</b>, pick your workspace → <b>Save</b>.</li>
        <li>Under <b>Capabilities</b>, keep only <b>Read content</b> (untick Update and Insert) → Save. Copy the <b>Internal Integration Secret</b>.</li>
        <li>In Notion, open your applications database → <b>•••</b> (top right) → <b>Connections</b> → add <b>Commitments</b>. Copy the database link too.</li>
        <li>On the computer you deploy from, run <b>npx wrangler secret put NOTION_TOKEN</b> (paste the secret) and <b>npx wrangler secret put NOTION_APPS_DATABASE</b> (paste the database link or ID).</li>
      </ol>
    </section>`;
}

function appsTabHtml() {
  const A = state.apps;
  const today = todayISO();
  const header = `
    <header class="top">
      ${topBar({
        left: '<span class="icon-spacer"></span>',
        label: appsLoading ? 'Updating from Notion…' : A.fetchedAt ? `From Notion · updated ${ago(A.fetchedAt)}` : 'From Notion',
        title: 'Applications',
        right: '<button class="icon-btn" data-act="apps-refresh" aria-label="Refresh from Notion">↻</button>' + menuBtn,
      })}
    </header>`;
  if (!state.sync.enabled) {
    return header + `<section class="card empty"><p>Applications come from your Notion tracker and need sync turned on, so only your devices can read them.</p>
      <a class="btn primary" href="#/sync">Set up sync</a></section>`;
  }
  const items = A.items;
  const warn = A.error && !A.setup ? `<p class="small pad err">⚠️ ${escapeHtml(A.error)}</p>` : '';
  if (!items.length) return header + (A.setup ? appsSetupHtml() : '') + (warn ? `<section class="card">${warn}</section>` : '') +
    (!A.setup && !A.error && !appsLoading ? '<section class="card empty"><p>No applications found in Notion yet.</p></section>' : '');

  const withPhase = items.map((a) => ({ a, phase: appPhase(a, today) }));
  const by = (key) => (x, y) => (x.a[key] || '9999').localeCompare(y.a[key] || '9999');
  const closingSoon = withPhase.filter((x) => x.phase === 'open' && x.a.close && daysUntil(x.a.close) <= 14).sort(by('close'));
  const openNow = withPhase.filter((x) => x.phase === 'open' && !closingSoon.includes(x)).sort(by('close'));
  const upcoming = withPhase.filter((x) => x.phase === 'upcoming').sort(by('open'));
  const progress = withPhase.filter((x) => x.phase === 'inprogress' || x.phase === 'offer').sort(by('next'));
  const rest = withPhase.filter((x) => x.phase === 'closed' || x.phase === 'inactive');
  const finished = withPhase.filter((x) => x.phase === 'done');
  const unknown = withPhase.filter((x) => x.phase === 'unknown').sort(by('close'));
  const grid = (key, list) => {
    const all = appsExpanded.has(key) || list.length <= APPS_PREVIEW;
    return `<div class="apps-grid">${(all ? list : list.slice(0, APPS_PREVIEW)).map((x) => appRowHtml(x.a)).join('')}</div>
      ${list.length > APPS_PREVIEW ? `<button class="txt-btn show-all" data-act="apps-more" data-key="${key}">${all ? 'Show less' : `Show all (${list.length})`}</button>` : ''}`;
  };
  const section = (title, list, hint = '') => (list.length ? `<section class="card apps-list"><div class="card-head"><h2>${title}</h2><span class="hint">${hint || list.length}</span></div>
    ${grid(title, list)}</section>` : '');
  const fold = (title, list) => (list.length ? `<details class="card fold apps-list" ${appsExpanded.has(`open:${title}`) ? 'open' : ''} data-fold="${title}">
    <summary>${title} (${list.length})</summary>${grid(title, list)}</details>` : '');
  return header + (warn ? `<section class="card">${warn}</section>` : '') +
    appsMonthHtml(appEvents()) +
    section('Closing soon', closingSoon, 'next 2 weeks') +
    section('In progress', progress) +
    section('Open now', openNow) +
    section('Opening soon', upcoming) +
    fold('No opening date yet', unknown) + fold('Done', finished) + fold('Closed or not applying', rest);
}

// ---------- Application follow-ups (OT, HV, interviews…) ----------
// A follow-up is a one-off task in the Applications section, linked to its application (appRef)
// and tagged with a stage. It can also set the role's Next ddl and status in Notion.
const FOLLOWUP_STAGES = [
  // [abbreviation, name, planned hours, matching Notion status]
  ['OT', 'Online test', 1, 'Online test'],
  ['HV', 'HireVue', 0.5, 'Video interview'],
  ['VI', 'Video interview', 0.5, 'Video interview'],
  ['PI', 'Phone interview', 0.5, ''],
  ['IT', 'Interview', 1, ''],
  ['AC', 'Assessment centre', 4, ''],
  ['SD', 'Superday', 4, ''],
  ['GA', 'Game-based assessment', 0.5, 'Online test'],
  ['SJT', 'Situational judgement test', 0.5, 'Online test'],
  ['Other', 'Other', 1, ''],
];
const stageInfo = (abbr) => FOLLOWUP_STAGES.find((x) => x[0] === abbr) || ['Other', abbr, 1, ''];
const followupsFor = (appId) => state.commitments.filter((c) => c.appRef === appId && c.stage && !c.archived)
  .sort((x, y) => onceSortKey(x).localeCompare(onceSortKey(y)));
function onceDone(c) {
  const it = c.date && state.weeks[weekOf(c.date)] && state.weeks[weekOf(c.date)].items[c.id];
  return !!(it && periodDone(it));
}

function openFollowupSheet(appId) {
  const a = state.apps.items.find((x) => x.id === appId);
  if (!a) return;
  openSheet(`
    <div class="sheet-head"><h3>Follow-up · ${escapeHtml(a.company)}</h3>
      <p class="muted">${escapeHtml(a.programme || '')}</p></div>
    <form class="form flat" data-form="followup" data-app="${a.id}" data-tbc="false" data-freq="once">
      <div class="stage-grid">${FOLLOWUP_STAGES.map(([ab, name], i) => `<label class="stage"><input type="radio" name="stage" value="${ab}" ${i === 0 ? 'checked' : ''}>
        <span><b>${ab === 'Other' ? '…' : ab}</b><small>${name}</small></span></label>`).join('')}</div>
      <label class="f stage-other" hidden>Label<input name="label" placeholder="e.g. Case study"></label>
      <label class="toggle-row only-once"><input type="checkbox" name="tbc"><span>Date to be confirmed</span></label>
      <div class="f2 tbc-hide">
        <label class="f">Due / date<input type="date" name="date" value="${todayISO()}"></label>
        <label class="f">Time (optional)<input type="time" name="time"></label>
      </div>
      <label class="f">Test / interview link (optional)<input name="url" inputmode="url" autocapitalize="off" autocorrect="off" placeholder="HireVue invite, test portal, Zoom…"></label>
      <label class="toggle-row"><input type="checkbox" name="notion" checked>
        <span>Update Notion<small>Set Next ddl to this date, and the status where it matches (e.g. HV → Video interview).</small></span></label>
      <button class="btn primary" type="submit">Add follow-up</button>
    </form>`, { followup: appId });
}

function saveFollowup(form) {
  const f = new FormData(form);
  const a = state.apps.items.find((x) => x.id === form.dataset.app);
  if (!a) return;
  const [abbr, stageName, hours, notionStatus] = stageInfo(f.get('stage'));
  const label = abbr === 'Other' ? (String(f.get('label') || '').trim() || 'Follow-up') : abbr;
  const tbc = f.get('tbc') === 'on';
  const date = tbc ? null : (f.get('date') || todayISO());
  state.commitments.push(newCommitment({
    name: `${a.company} · ${label}`, section: 'Applications', freq: 'once', kind: 'task',
    date, tbc, time: tbc ? null : validTime(f.get('time')), hours,
    notes: [`${abbr === 'Other' ? label : stageName} for ${a.company}${a.programme ? ` – ${a.programme}` : ''}`,
      a.close ? `Application closes ${fmtDayShort(a.close)}` : ''].filter(Boolean).join('\n'),
    notionUrl: cleanUrl(a.notionUrl), links: a.url && cleanUrl(a.url) ? [{ label: 'Application', url: cleanUrl(a.url) }] : [],
    appRef: a.id, stage: label, stageUrl: cleanUrl(f.get('url')), order: nextOrder(),
  }));
  save();
  closeSheet();
  if (f.get('notion') === 'on') {
    const change = {};
    if (date) change.next = date;
    if (notionStatus && notionStatus !== a.status) change.status = notionStatus;
    if (Object.keys(change).length) updateApp(a.id, change);
  }
  render();
  toast(`Added ${a.company} · ${label}${date ? ` for ${fmtDayShort(date)}` : ' (date TBC)'}`);
}

// "+ Today": a one-off task for today that links back to the application.
const todayTaskFor = (appId) => state.commitments.find((c) => c.appRef === appId && c.freq === 'once' && c.date === todayISO() && !c.archived);
// Tapping "+ Today" again (now "✓ On today") takes the task off today.
function toggleAppToday(appId) {
  const task = todayTaskFor(appId);
  if (!task) return addAppToToday(appId);
  const it = state.weeks[weekOf(task.date)] && state.weeks[weekOf(task.date)].items[task.id];
  if (it && hasData(it) && !confirm(`“${task.name}” is already ticked off today. Remove it anyway?`)) return;
  removeCommitment(task.id);
  save();
  render();
  toast(`Removed “${task.name}” from today`);
}
function addAppToToday(appId) {
  const a = state.apps.items.find((x) => x.id === appId);
  if (!a || todayTaskFor(appId)) return;
  const left = (a.materials || []).filter((m) => !(a.materialsDone || []).includes(m));
  const notes = [a.programme, left.length ? `Still to do: ${left.join(', ')}` : '', a.close ? `Closes ${fmtDayShort(a.close)} (${relDay(a.close)})` : '']
    .filter(Boolean).join('\n');
  state.commitments.push(newCommitment({
    name: `Apply: ${a.company}`, section: 'Applications', freq: 'once', kind: 'task', date: todayISO(), hours: 1,
    notes, notionUrl: cleanUrl(a.notionUrl), links: a.url && cleanUrl(a.url) ? [{ label: 'Apply', url: cleanUrl(a.url) }] : [],
    appRef: appId, order: nextOrder(),
  }));
  save();
  render();
  toast(`Added “Apply: ${a.company}” to today`);
}

// Ticking Done or a material writes to Notion. The screen updates straight away and goes back if
// Notion refuses. Changes to one application are sent one after another so they arrive in order.
const appQueues = {};
function updateApp(id, change) {
  const a = state.apps.items.find((x) => x.id === id);
  if (!a) return;
  const before = { done: !!a.done, materialsDone: [...(a.materialsDone || [])] };
  Object.assign(a, change);
  render();
  const send = async () => {
    try {
      const res = await fetch('/api/apps', {
        method: 'POST',
        headers: { authorization: `Bearer ${state.sync.key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ id, ...change }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Couldn’t update Notion (${res.status})`);
      writeState().catch(() => {});
    } catch (e) {
      Object.assign(a, before);
      toast(e.message === 'Failed to fetch' ? 'Offline. Couldn’t update Notion.' : e.message);
      if (route.tab === 'apps' || route.tab === 'today') render();
    }
  };
  appQueues[id] = (appQueues[id] || Promise.resolve()).then(send);
}

// Small "closing this week" card for Today.
function appsTodayCardHtml() {
  if (!state.apps.items.length) return '';
  const soon = appEvents().filter((e) => e.kind !== 'open' && daysUntil(e.date) >= 0 && daysUntil(e.date) <= 7)
    .sort((x, y) => x.date.localeCompare(y.date)).slice(0, 4);
  if (!soon.length) return '';
  return `<section class="card"><div class="card-head"><h2>Applications</h2><a class="txt-btn" href="#/apps">All ›</a></div>
    ${soon.map((e) => `<div class="srow" data-open="#/apps/${e.date}"><span class="stime ${daysUntil(e.date) <= 2 ? 'err' : ''}">${relDay(e.date)}</span>
      <span class="sname">${escapeHtml(e.a.company)} ${APP_EVENT_LABEL[e.kind]}<small>${escapeHtml(e.a.programme || '')}</small></span></div>`).join('')}</section>`;
}

// ---------- Commitments tab ----------
function sortedCommitments(freq, archived = false) {
  return state.commitments.filter((c) => c.freq === freq && !!c.archived === archived)
    .sort((a, b) => (freq === 'once' ? onceSortKey(a).localeCompare(onceSortKey(b)) : 0) || a.order - b.order);
}
// Orders only need to be distinct, not consecutive. Only missing or duplicate orders are repaired, so
// adding or deleting one commitment doesn't change every other one (which sync would treat as edits).
const nextOrder = () => state.commitments.reduce((m, c) => (Number.isFinite(c.order) ? Math.max(m, c.order) : m), -1) + 1;
function renumber() {
  const seen = new Set();
  for (const c of [...state.commitments].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))) {
    if (!Number.isFinite(c.order) || seen.has(c.order)) c.order = nextOrder();
    seen.add(c.order);
  }
}
function sectionNames() {
  return [...new Set(state.commitments.filter((c) => !c.archived).map((c) => c.section))];
}
function metaLine(c) {
  const parts = [c.kind === 'counter' ? 'Counter' : 'Task', targetLabel(c)];
  if (c.freq === 'once' && c.date) parts.unshift(...[fmtShort(c.date), timeRange(c)].filter(Boolean));
  if (c.freq === 'once' && !c.date) parts.unshift('Date TBC');
  if (c.source) parts.push('📅');
  return parts.join(' · ');
}

function commitmentsTabHtml() {
  const row = (c, i, list) => reorderMode && c.freq !== 'once'
    ? `<div class="crow" data-cid="${c.id}"><div class="ctext"><div class="n">${escapeHtml(c.name)}</div><div class="sub">${escapeHtml(c.section)}</div></div>
        <span class="reorder"><button class="mini-btn" data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
        <button class="mini-btn" data-act="down" ${i === list.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button></span></div>`
    : `<a class="crow" href="#/c/${c.id}"><div class="ctext"><div class="n">${escapeHtml(c.name)}</div>
        <div class="sub">${metaLine(c)}${c.notionUrl || c.links.length ? ' · 🔗' : ''}</div></div><span class="chev">›</span></a>`;
  const block = (freq, title, list) => {
    let body = '';
    if (freq === 'once') body = list.map((c, i) => row(c, i, list)).join('');
    else for (const [s, cs] of groupBySection(list, (c) => c.section)) body += `<div class="sec">${escapeHtml(s)}</div>` + cs.map((c) => row(c, list.indexOf(c), list)).join('');
    return `<section class="card">
      <div class="card-head"><h2>${title}</h2><a class="txt-btn" href="#/new/${freq}">+ Add</a></div>
      ${body || '<p class="muted pad small">None yet.</p>'}</section>`;
  };
  const today = todayISO();
  const once = sortedCommitments('once').filter((c) => !c.schedule && !c.appRef);
  const tbcList = once.filter((c) => !c.date);
  const upcoming = [...tbcList, ...once.filter((c) => c.date && c.date >= today)];
  const past = once.filter((c) => c.date && c.date < today).reverse();
  const archived = state.commitments.filter((c) => c.archived);
  return `
    <header class="top">
      ${topBar({ left: `<button class="txt-btn" data-act="reorder">${reorderMode ? 'Done' : 'Reorder'}</button>`, label: `${state.commitments.filter((c) => !c.archived).length} active`, title: 'Commitments', right: menuBtn })}
    </header>
    ${reviewBannerHtml()}
    ${block('daily', 'Daily', sortedCommitments('daily'))}
    ${block('weekly', 'Weekly', sortedCommitments('weekly'))}
    ${block('once', 'One-off', upcoming)}
    ${applicationsCardHtml()}
    ${calendarsCardHtml()}
    ${past.length ? `<details class="card fold"><summary>Past one-offs (${past.length})</summary>${past.map((c) => row(c, 0, [c])).join('')}</details>` : ''}
    ${archived.length ? `<details class="card fold"><summary>Archived (${archived.length})</summary>
      ${archived.map((c) => `<div class="crow" data-cid="${c.id}"><div class="ctext"><div class="n">${escapeHtml(c.name)}</div>
        <div class="sub">${FREQ_LABEL[c.freq]} · ${metaLine(c)}</div></div><button class="mini-btn" data-act="restore">Restore</button></div>`).join('')}
    </details>` : ''}`;
}

function moveCommitment(id, dir) {
  const c = state.commitments.find((x) => x.id === id);
  const list = sortedCommitments(c.freq);
  const i = list.indexOf(c), j = i + dir;
  if (j < 0 || j >= list.length) return;
  [list[i].order, list[j].order] = [list[j].order, list[i].order];
  renumber();
}

// ---------- Commitment detail page ----------
function weekKeyFor(c) { return c.freq === 'once' && c.date ? weekOf(c.date) : currentWeekKey(); }

function scheduleDetailHtml(c) {
  const feed = c.source && state.calendars.feeds.find((f) => f.id === c.source.feed);
  const where = locationOf(c);
  const extra = (c.notes || '').split('\n').filter((l, i) => !(i === 0 && l.startsWith('📍'))).join('\n').trim();
  return `
    <header class="top">
      ${topBar({ left: '<button class="icon-btn" data-act="back" aria-label="Back">‹</button>', label: `Schedule · ${escapeHtml(feed ? feed.name : 'Calendar')}`, title: escapeHtml(c.name) })}
    </header>
    <section class="card">
      <div class="sched-facts">
        <div><span>When</span><b>${fmtDay(parseISO(c.date), { weekday: 'long', day: 'numeric', month: 'long' })}${c.time ? ` · ${escapeHtml(timeRange(c))}` : ''}</b></div>
        ${where ? `<div><span>Where</span><b>${escapeHtml(where)}</b></div>` : ''}
      </div>
      ${extra ? `<div class="notes small">${linkify(extra)}</div>` : ''}
      <p class="help pad">Part of your timetable from ${escapeHtml(feed ? feed.name : 'your calendar')}. It's shown on your calendar but isn't a to-do. To tick these off instead, set the series to <b>Task</b> in <a href="#/calendar">Calendars</a>.</p>
    </section>`;
}

function detailPageHtml(id) {
  const c = state.commitments.find((x) => x.id === id);
  if (c && c.schedule) return scheduleDetailHtml(c);
  if (!c) return `<header class="top">${topBar({ left: '<button class="icon-btn" data-act="back">‹</button>', title: 'Not found' })}</header>
    <section class="card empty"><p>This commitment no longer exists.</p><a class="btn" href="#/commitments">All commitments</a></section>`;
  const wk = weekKeyFor(c);
  const w = c.archived ? state.weeks[wk] : getWeek(wk, true);
  const it = w && w.items[id];

  let progress = '';
  if (it && c.freq === 'daily') {
    const daysDone = it.ticks.filter((_, i) => dayDone(it, i)).length;
    const hrs = it.ticks.reduce((s, _, i) => s + dayHours(it, i), 0);
    progress = `<div class="card-head"><h2>This week</h2><span class="hint">${daysDone}/7 days · ${fmtH(hrs)} of ${fmtH(plannedHours(it) * 7)}</span></div>
      ${dayHeadHtml(wk)}<div class="row">${dayCellsHtml(wk, id, it)}</div>`;
  } else if (it) {
    progress = `<div class="card-head"><h2>${c.freq === 'once' ? fmtDay(parseISO(c.date), { weekday: 'long', day: 'numeric', month: 'long' }) : 'This week'}</h2></div>
      ${periodRowHtml(wk, id, it)}`;
  }

  const stageCard = !c.stage ? '' : c.stageUrl
    ? `<section class="card"><a class="btn primary full" href="${escapeHtml(c.stageUrl)}" target="_blank" rel="noopener">Open ${escapeHtml(c.stage)} link ↗</a>
        <p class="small muted center pad">${escapeHtml(hostOf(c.stageUrl))} · <a href="#/c/${id}/edit">change</a></p></section>`
    : `<form class="card form" data-form="stage-link" data-id="${id}">
        <label class="f">${escapeHtml(c.stage)} link<input name="url" inputmode="url" autocapitalize="off" autocorrect="off" placeholder="Paste the test or interview link"></label>
        <button class="btn primary" type="submit">Save link</button></form>`;
  if (c.freq === 'once' && !c.date) {
    progress = `<div class="card-head"><h2>Date to be confirmed</h2></div>
      <p class="small muted pad">Not on your calendar yet. Set a date when it's fixed.</p>
      <a class="btn primary full" href="#/c/${id}/edit">Set date</a>`;
  }
  const links = [];
  if (c.notionUrl) {
    const appUrl = notionAppUrl(c.notionUrl);
    links.push(`<a class="link-btn notion" href="${escapeHtml(appUrl)}" ${appUrl === c.notionUrl ? 'target="_blank" rel="noopener"' : ''}>
      <span class="li">N</span><span><b>Open in Notion</b><small>${escapeHtml(hostOf(c.notionUrl))}</small></span></a>`);
    if (appUrl !== c.notionUrl) links.push(`<a class="small muted web-link" href="${escapeHtml(c.notionUrl)}" target="_blank" rel="noopener">Open Notion page in browser instead</a>`);
  }
  for (const l of c.links) {
    links.push(`<a class="link-btn" href="${escapeHtml(l.url)}" target="_blank" rel="noopener">
      <span class="li">↗</span><span><b>${escapeHtml(l.label || hostOf(l.url))}</b><small>${escapeHtml(hostOf(l.url))}</small></span></a>`);
  }

  const past = Object.values(state.weeks)
    .filter((hw) => hw.items[id] && hw.start < currentWeekKey() && c.freq !== 'once')
    .sort((a, b) => (a.start < b.start ? 1 : -1)).slice(0, 8)
    .map((hw) => {
      const h = hw.items[id];
      const txt = h.freq === 'daily'
        ? `${h.ticks.filter((_, i) => dayDone(h, i)).length}/7 days · ${fmtH(h.ticks.reduce((s, _, i) => s + dayHours(h, i), 0))}`
        : h.kind === 'counter' ? countLabel(h, h.count) : h.done ? 'Done' : 'Not done';
      return `<div class="hrow"><span>w/c ${fmtDay(parseISO(hw.start), { day: 'numeric', month: 'short' })}</span><span>${txt}</span></div>`;
    }).join('');

  return `
    <header class="top">
      ${topBar({
        left: '<button class="icon-btn" data-act="back" aria-label="Back">‹</button>',
        label: `${FREQ_LABEL[c.freq]} · ${escapeHtml(c.section)}`,
        title: escapeHtml(c.name),
        right: `<a class="txt-btn" href="#/c/${id}/edit">Edit</a>`,
      })}
      <div class="chips-meta"><span>${c.kind === 'counter' ? 'Counter' : 'Task'}</span><span>${targetLabel(c)}</span>${c.archived ? '<span>Archived</span>' : ''}</div>
      ${sourceNoteHtml(c)}
    </header>
    ${stageCard}
    ${progress ? `<section class="card">${progress}</section>` : ''}
    <section class="card">
      <div class="card-head"><h2>What to do</h2></div>
      ${c.notes ? `<div class="notes">${linkify(c.notes)}</div>` : `<p class="muted small pad">Nothing yet. Tap <a href="#/c/${id}/edit">Edit</a> to add what to do, resource links and your Notion page.</p>`}
      ${links.length ? `<div class="links">${links.join('')}</div>` : ''}
    </section>
    ${past ? `<section class="card"><div class="card-head"><h2>Previous weeks</h2></div>${past}</section>` : ''}`;
}

// ---------- Edit / new commitment page ----------
function editPageHtml() {
  const isNew = route.id === 'new';
  const c = isNew
    ? newCommitment({ freq: route.freq, date: route.freq === 'once' ? todayISO() : null, hours: route.freq === 'weekly' ? 2 : 1 })
    : state.commitments.find((x) => x.id === route.id);
  if (!c) return detailPageHtml(route.id);
  const radio = (name, value, label, cur) =>
    `<label><input type="radio" name="${name}" value="${value}" ${cur === value ? 'checked' : ''}><span>${label}</span></label>`;
  const linkRow = (l = { label: '', url: '' }) => `
    <div class="linkrow"><input name="linkLabel" placeholder="Label (e.g. Course website)" value="${escapeHtml(l.label)}">
      <input name="linkUrl" inputmode="url" autocapitalize="off" autocorrect="off" placeholder="https://…" value="${escapeHtml(l.url)}">
      <button type="button" class="mini-btn" data-act="rmlink" aria-label="Remove link">×</button></div>`;
  return `
    <header class="top">
      ${topBar({
        left: '<button class="txt-btn" data-act="back">Cancel</button>',
        title: isNew ? 'New commitment' : 'Edit',
        right: '<button class="txt-btn strong" type="submit" form="cform">Save</button>',
      })}
    </header>
    <datalist id="sections">${sectionNames().map((s) => `<option value="${escapeHtml(s)}">`).join('')}</datalist>
    <form id="cform" class="card form" data-form="commitment" data-id="${isNew ? '' : c.id}"
      data-freq="${c.freq}" data-kind="${c.kind}" data-hourunit="${isHourUnit(c.unit)}" data-tbc="${!!c.tbc}">
      <label class="f">Name<input name="name" required value="${escapeHtml(c.name)}" placeholder="e.g. Practice questions"></label>
      <label class="f">Section<input name="section" list="sections" value="${escapeHtml(c.section === 'Other' && isNew ? '' : c.section)}" placeholder="e.g. Career prep"></label>
      <div class="f">How often<div class="seg">${radio('freq', 'daily', 'Daily', c.freq)}${radio('freq', 'weekly', 'Weekly', c.freq)}${radio('freq', 'once', 'One-off', c.freq)}</div></div>
      ${c.source ? '' : `<label class="toggle-row only-once"><input type="checkbox" name="tbc" ${c.tbc ? 'checked' : ''}>
        <span>Date to be confirmed<small>Keep it on your list without a date; set one when it's fixed.</small></span></label>`}
      <label class="f only-once tbc-hide">Date<input type="date" name="date" value="${c.date || todayISO()}"></label>
      <div class="f2 only-once tbc-hide">
        <label class="f">Start time<input type="time" name="time" value="${c.time || ''}"></label>
        <label class="f">End time<input type="time" name="endTime" value="${c.endTime || ''}"></label>
      </div>
      ${c.source ? '<p class="help">📅 Synced from your calendar: date, time and name will follow the calendar.</p>' : ''}
      <div class="f">Type<div class="seg">${radio('kind', 'task', 'Task', c.kind)}${radio('kind', 'counter', 'Counter', c.kind)}</div>
        <span class="help only-task">Done or not done, e.g. a lecture, seminar, coffee chat or study block.</span>
        <span class="help only-counter">Count towards a number, e.g. send 3 emails or log 15 hours.</span></div>
      <div class="f3 only-counter">
        <label class="f">Target<input name="target" type="number" inputmode="decimal" min="0" step="any" value="${round2(c.target)}"></label>
        <label class="f">Unit<input name="unit" value="${escapeHtml(c.unit)}" placeholder="emails / h"></label>
        <label class="f">Step<input name="step" type="number" inputmode="decimal" min="0" step="any" value="${round2(c.step)}"></label>
      </div>
      <label class="f only-time"><span>Planned time (hours <span class="per-day">per day</span><span class="per-week">per week</span><span class="per-once">total</span>)</span>
        <input name="hours" type="number" inputmode="decimal" min="0" step="0.25" value="${round2(c.hours)}"></label>
      <label class="f">What to do<textarea name="notes" rows="5" placeholder="Steps, chapter you're on, checklist…">${escapeHtml(c.notes)}</textarea></label>
      ${c.stage ? `<label class="f">Test / interview link<input name="stageUrl" inputmode="url" autocapitalize="off" autocorrect="off" value="${escapeHtml(c.stageUrl || '')}" placeholder="HireVue invite, test portal, Zoom…"></label>` : ''}
      <label class="f">Notion page<input name="notionUrl" inputmode="url" autocapitalize="off" autocorrect="off" value="${escapeHtml(c.notionUrl)}" placeholder="https://www.notion.so/…"></label>
      <div class="f">Links<div class="linklist">${(c.links.length ? c.links : [undefined]).map(linkRow).join('')}</div>
        <button type="button" class="mini-btn add-link" data-act="addlink">+ Add link</button></div>
      <button class="btn primary" type="submit">Save</button>
      ${isNew ? '' : `<div class="danger">
        ${c.archived ? '<button type="button" class="btn" data-act="restore-one">Restore</button>' : '<button type="button" class="btn" data-act="archive-one">Archive</button>'}
        <button type="button" class="btn warn" data-act="delete-one">Delete</button></div>`}
    </form>
    <template id="linkRowTpl">${linkRow()}</template>`;
}

function saveCommitmentForm(form) {
  const f = new FormData(form);
  const name = String(f.get('name') || '').trim();
  if (!name) { toast('Give it a name'); return; }
  const freq = FREQS.includes(f.get('freq')) ? f.get('freq') : 'daily';
  const kind = f.get('kind') === 'counter' ? 'counter' : 'task';
  const unit = kind === 'counter' ? String(f.get('unit') || '').trim() : '';
  const target = kind === 'counter' ? num(f.get('target'), 1) : 1;
  const fields = {
    name, freq, kind, unit, target,
    section: String(f.get('section') || '').trim() || 'Other',
    date: freq === 'once' && f.get('tbc') !== 'on' ? (f.get('date') || todayISO()) : null,
    tbc: freq === 'once' && f.get('tbc') === 'on',
    time: freq === 'once' && f.get('tbc') !== 'on' ? validTime(f.get('time')) : null,
    endTime: freq === 'once' && f.get('tbc') !== 'on' ? validTime(f.get('endTime')) : null,
    step: kind === 'counter' ? num(f.get('step'), 0) || (isHourUnit(unit) ? 0.5 : 1) : 1,
    hours: kind === 'counter' && isHourUnit(unit) ? target : num(f.get('hours')),
    notes: String(f.get('notes') || '').trim(),
    notionUrl: cleanUrl(f.get('notionUrl')),
    ...(f.has('stageUrl') ? { stageUrl: cleanUrl(f.get('stageUrl')) } : {}),
    links: f.getAll('linkUrl').map((u, i) => ({ label: String(f.getAll('linkLabel')[i] || '').trim(), url: cleanUrl(u) })).filter((l) => l.url),
  };
  let c = state.commitments.find((x) => x.id === form.dataset.id);
  if (c) {
    if (c.freq === 'once' && fields.freq === 'once') moveOnceItem(c.id, c.date, fields.date);
    if (c.freq !== fields.freq) fields.order = nextOrder();
    Object.assign(c, fields);
  } else {
    c = newCommitment({ ...fields, order: nextOrder() });
    state.commitments.push(c);
  }
  renumber();
  save();
  location.replace(`#/c/${c.id}`);
}

// A one-off's progress lives in the week of its date: move it if the date changes week.
function moveOnceItem(id, oldDate, newDate) {
  if (!oldDate || !newDate || weekOf(oldDate) === weekOf(newDate)) return;
  const from = state.weeks[weekOf(oldDate)];
  if (!from || !from.items[id]) return;
  const to = state.weeks[weekOf(newDate)] || (state.weeks[weekOf(newDate)] = { start: weekOf(newDate), items: {} });
  to.items[id] = from.items[id];
  delete from.items[id];
}
function removeCommitment(id) {
  state.commitments = state.commitments.filter((x) => x.id !== id);
  for (const w of Object.values(state.weeks)) delete w.items[id];
}

function deleteCommitment(id) {
  const c = state.commitments.find((x) => x.id === id);
  if (!c) return;
  const used = Object.values(state.weeks).some((w) => w.items[id] && hasData(w.items[id]));
  const msg = used
    ? `Delete “${c.name}” and all its logged progress? (Archive keeps the history instead.)`
    : `Delete “${c.name}”?`;
  if (!confirm(msg)) return;
  // Don't let the next calendar sync bring a deleted event back.
  const feed = c.source && state.calendars.feeds.find((f) => f.id === c.source.feed);
  if (feed) feed.skipped[c.source.key] = true;
  removeCommitment(id);
  renumber(); save();
  location.replace('#/commitments');
}

// ---------- Calendar import ----------
// Calendar feeds (.ics links) are fetched through /api/ics (server/ics.mjs) and their events
// become one-off tasks. Each recurring series is reviewed once (import or skip); after that,
// syncs keep imported events up to date for the current week plus the next three.
const SYNC_EVERY_MS = 20 * 60e3; // calendars refresh at most every 20 minutes (on open and while open)
const SYNC_DAYS = 28;
const calCache = {}; // feedId -> instances from the last fetch (memory only)
const pendingCount = () => state.calendars.feeds.reduce((n, f) => n + f.pending.length, 0);
function syncWindow() {
  const from = parseISO(currentWeekKey());
  return { from, to: addDays(from, SYNC_DAYS) };
}
function ago(iso) {
  if (!iso) return 'never';
  const m = Math.round((Date.now() - new Date(iso)) / 6e4);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 24 * 60) return `${Math.round(m / 60)} h ago`;
  return fmtDay(new Date(iso), { day: 'numeric', month: 'short' });
}

async function fetchIcs(url) {
  let res;
  try {
    res = await fetch('/api/ics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) });
  } catch {
    throw new Error('No connection. Calendar sync needs the internet.');
  }
  if (!res.ok) {
    let msg = '';
    try { msg = (await res.json()).error; } catch { /* not JSON */ }
    throw new Error(msg || `Calendar sync failed (${res.status})`);
  }
  return res.text();
}

function describeSeries(list) {
  const first = list[0];
  const days = [...new Set(list.map((i) => DAY_NAMES[dayIndexOf(i.date)]))];
  return {
    uid: first.uid, name: first.summary, count: list.length, first: first.date,
    when: first.allDay ? 'All day' : timeRange(first), days: days.join('/'), location: first.location,
    suggested: defaultDecision(list),
  };
}
const defaultDecision = (list) => (list.some((i) => i.recurring) ? 'schedule' : 'task');
const DECISION_LABEL = { schedule: 'Schedule', task: 'Task', skip: 'Skip' };

// Turn fetched instances into one-off commitments according to the feed's decisions.
function applyFeed(feed, insts) {
  const { from, to } = syncWindow();
  const fromISO = isoDate(from), lastISO = isoDate(addDays(to, -1));
  const series = new Map();
  for (const i of insts) {
    if (!series.has(i.uid)) series.set(i.uid, []);
    series.get(i.uid).push(i);
  }
  const seen = new Set();
  let added = 0, decided = 0;
  feed.pending = [];
  for (const [seriesUid, list] of series) {
    let d = feed.decisions[seriesUid];
    if (!d) {
      // New series: import straight away (repeating → schedule, single → task) unless you asked to review first.
      if (feed.ask) { feed.pending.push(describeSeries(list)); continue; }
      d = feed.decisions[seriesUid] = { d: defaultDecision(list), name: list[0].summary };
      decided++;
    }
    if (d.name !== list[0].summary) d.name = list[0].summary;
    if (d.d === 'import') d.d = defaultDecision(list); // decisions made before schedule/task existed
    const recurring = list.some((i) => i.recurring);
    if (d.recurring !== recurring) d.recurring = recurring;
    if (d.d === 'skip') continue;
    // A timetable calendar (e.g. school courses) is all schedule, whatever each event looks like.
    const schedule = feed.allSchedule || d.d === 'schedule';
    for (const inst of list) {
      if (feed.skipped[inst.key]) continue;
      seen.add(inst.key);
      const fields = { name: inst.summary, date: inst.date, time: inst.time, endTime: inst.endTime, hours: inst.hours, schedule };
      const c = state.commitments.find((x) => x.source && x.source.feed === feed.id && x.source.key === inst.key);
      if (c) {
        moveOnceItem(c.id, c.date, fields.date);
        Object.assign(c, fields);
      } else {
        const notes = [inst.location && `📍 ${inst.location}`, inst.description.slice(0, 1000)].filter(Boolean).join('\n\n');
        state.commitments.push(newCommitment({
          ...fields, id: `cal-${hash36(`${feed.id}|${inst.key}`)}`, freq: 'once', kind: 'task', section: feed.section || 'Calendar', notes,
          order: nextOrder(), source: { feed: feed.id, key: inst.key, uid: seriesUid },
        }));
        added++;
      }
    }
  }
  // Events that disappeared from the calendar (cancelled, deleted, or series skipped):
  // remove them from the window unless something was already logged.
  for (const c of [...state.commitments]) {
    if (!c.source || c.source.feed !== feed.id || seen.has(c.source.key)) continue;
    if (!c.date || c.date < fromISO || c.date > lastISO) continue;
    const it = state.weeks[weekOf(c.date)] && state.weeks[weekOf(c.date)].items[c.id];
    if (!it || !hasData(it)) removeCommitment(c.id);
  }
  renumber();
  return added;
}

async function syncFeed(feed) {
  try {
    const text = await fetchIcs(feed.url);
    calCache[feed.id] = parseIcs(text, syncWindow());
    const added = applyFeed(feed, calCache[feed.id]);
    feed.lastSync = new Date().toISOString();
    feed.lastError = null;
    return added;
  } catch (e) {
    feed.lastError = e.message;
    throw e;
  } finally {
    save();
  }
}

let syncing = false;
async function syncAll({ quiet = false, force = false, feedId = null } = {}) {
  if (syncing || !navigator.onLine && quiet) return;
  const due = state.calendars.feeds.filter((f) => (feedId ? f.id === feedId : true) &&
    (force || !f.lastSync || Date.now() - new Date(f.lastSync) > SYNC_EVERY_MS));
  if (!due.length) return;
  syncing = true;
  if (!quiet) toast('Syncing calendar…');
  let added = 0, error = null;
  for (const f of due) {
    try { added += await syncFeed(f); } catch (e) { error = e; }
  }
  syncing = false;
  if (!sheetCtx && !route.edit) render();
  const pending = pendingCount();
  if (error && !quiet) toast(error.message);
  else if (added) toast(`Added ${added} calendar event${added === 1 ? '' : 's'}`);
  else if (!quiet) toast(pending ? `${pending} new event series to review` : 'Calendar up to date');
}

function addFeed(form) {
  const f = new FormData(form);
  const raw = String(f.get('url') || '').trim().replace(/^webcals?:\/\//i, 'https://');
  let url;
  try { url = new URL(raw); } catch { toast('Paste the full calendar link (starts with https:// or webcal://)'); return; }
  if (url.protocol !== 'https:') { toast('The calendar link must start with https:// or webcal://'); return; }
  const hint = calendarLinkHint(url);
  if (hint) { alert(hint); return; }
  const feed = {
    id: uid(), name: String(f.get('name') || '').trim() || 'Calendar', url: url.href,
    section: String(f.get('section') || '').trim() || 'Calendar',
    lastSync: null, lastError: null, decisions: {}, skipped: {}, pending: [], ask: false,
    allSchedule: f.get('allSchedule') === 'on',
  };
  state.calendars.feeds.push(feed);
  save();
  form.reset();
  render();
  syncAll({ force: true, feedId: feed.id }).then(() => {
    if (feed.pending.length && !feed.lastError) location.hash = '#/calendar/review';
  });
}

// Catch links that are clearly not a usable calendar feed before trying to sync.
function calendarLinkHint(url) {
  if (url.hostname !== 'calendar.google.com') return '';
  const p = decodeURIComponent(url.pathname);
  if (!p.includes('/ical/')) return 'That’s a Google Calendar sharing or settings link, not the iCal address.\n\nIn Google Calendar settings, open the calendar → Integrate calendar → copy “Secret address in iCal format”.';
  if (p.includes('@import.calendar.google.com')) return 'This is a calendar you subscribed to in Google (e.g. a school timetable). Google can’t share those again.\n\nUse the original link you subscribed with, e.g. the iCal/subscribe link from your school timetable.';
  if (p.endsWith('/public/basic.ics')) return 'That’s the public address, which only works if the calendar is public.\n\nUse “Secret address in iCal format” instead. For a calendar you subscribed to (like a school timetable), use the original link you subscribed with.';
  return '';
}

function removeFeed(id) {
  const feed = state.calendars.feeds.find((f) => f.id === id);
  if (!feed || !confirm(`Disconnect “${feed.name}”? Imported events you haven't ticked are removed; logged ones are kept.`)) return;
  for (const c of [...state.commitments]) {
    if (!c.source || c.source.feed !== id) continue;
    const it = c.date && state.weeks[weekOf(c.date)] && state.weeks[weekOf(c.date)].items[c.id];
    if (it && hasData(it)) c.source = null;
    else removeCommitment(c.id);
  }
  state.calendars.feeds = state.calendars.feeds.filter((f) => f.id !== id);
  delete calCache[id];
  renumber(); save(); render();
}

function setDecision(feedId, seriesUid, d) {
  const feed = state.calendars.feeds.find((f) => f.id === feedId);
  if (!feed || !feed.decisions[seriesUid] || !DECISION_LABEL[d]) return;
  feed.decisions[seriesUid].d = d;
  save();
  if (calCache[feed.id]) { applyFeed(feed, calCache[feed.id]); save(); render(); }
  else syncAll({ force: true, feedId });
  toast(d === 'skip' ? 'Stopped importing this series' : `Importing as ${DECISION_LABEL[d].toLowerCase()}`);
}

function submitReview(form) {
  const fd = new FormData(form);
  let imported = 0, needSync = false;
  for (const feed of state.calendars.feeds) {
    if (!feed.pending.length) continue;
    for (const p of feed.pending) {
      const d = DECISION_LABEL[fd.get(`d:${feed.id}|${p.uid}`)] ? fd.get(`d:${feed.id}|${p.uid}`) : p.suggested || 'task';
      feed.decisions[p.uid] = { d, name: p.name };
      if (d !== 'skip') imported++;
    }
    if (calCache[feed.id]) applyFeed(feed, calCache[feed.id]);
    else needSync = true;
  }
  save();
  if (needSync) syncAll({ force: true });
  toast(imported ? `Importing ${imported} series` : 'Skipped');
  location.hash = '#/today';
}

function reviewBannerHtml() {
  const n = pendingCount();
  return n ? `<a class="banner" href="#/calendar/review"><span>📅</span><span><b>${n} new calendar event${n === 1 ? '' : 's'}</b>
    <small>Choose which to track</small></span><span class="chev">›</span></a>` : '';
}

function sourceNoteHtml(c) {
  if (!c.source) return '';
  const feed = state.calendars.feeds.find((f) => f.id === c.source.feed);
  return `<p class="source-note">📅 From ${escapeHtml(feed ? feed.name : 'your calendar')}. Date and time follow the calendar.</p>`;
}

// Tasks linked to applications (+ Today and follow-ups), grouped by application.
function applicationsCardHtml() {
  const linked = state.commitments.filter((c) => c.appRef && !c.archived);
  if (!linked.length) return '';
  const groups = new Map();
  for (const c of linked.sort((x, y) => onceSortKey(x).localeCompare(onceSortKey(y)))) {
    if (!groups.has(c.appRef)) groups.set(c.appRef, []);
    groups.get(c.appRef).push(c);
  }
  const companyOf = (id, list) => (state.apps.items.find((a) => a.id === id) || {}).company || list[0].name.split(' · ')[0].replace(/^Apply: /, '');
  return `<section class="card">
    <div class="card-head"><h2>Applications</h2><a class="txt-btn" href="#/apps">All roles ›</a></div>
    ${[...groups].map(([id, list]) => `<div class="sec">${escapeHtml(companyOf(id, list))}</div>
      ${list.map((c) => `<a class="crow" href="#/c/${c.id}"><div class="ctext"><div class="n">${onceDone(c) ? '✓ ' : ''}${escapeHtml(c.stage ? `${c.stage}${stageInfo(c.stage)[1] !== c.stage ? ` · ${stageInfo(c.stage)[1]}` : ''}` : c.name)}</div>
        <div class="sub">${c.date ? `${fmtShort(c.date)}${c.time ? ` · ${c.time}` : ''}` : 'Date TBC'}</div></div><span class="chev">›</span></a>`).join('')}`).join('')}
  </section>`;
}

function calendarsCardHtml() {
  const feeds = state.calendars.feeds;
  return `<section class="card">
    <div class="card-head"><h2>Calendars</h2><a class="txt-btn" href="#/calendar">${feeds.length ? 'Manage' : '+ Connect'}</a></div>
    ${feeds.length ? feeds.map((f) => `<a class="crow" href="#/calendar"><div class="ctext"><div class="n">${escapeHtml(f.name)}</div>
      <div class="sub ${f.lastError ? 'err' : ''}">${f.lastError ? escapeHtml(f.lastError) : `Synced ${ago(f.lastSync)}`}</div></div><span class="chev">›</span></a>`).join('')
      : '<p class="muted small pad">Import lectures, seminars and meetings from Google, Apple or Outlook as one-off tasks.</p>'}
  </section>`;
}

function calendarPageHtml() {
  const feeds = state.calendars.feeds;
  const feedCard = (f) => {
    const entries = Object.entries(f.decisions).sort((a, b) => (a[1].name || '').localeCompare(b[1].name || ''));
    const counts = { schedule: 0, task: 0, skip: 0 };
    for (const [, v] of entries) counts[v.d === 'import' ? 'task' : v.d] = (counts[v.d === 'import' ? 'task' : v.d] || 0) + 1;
    const row = ([u, v]) => {
      let cur = v.d === 'import' ? (v.recurring ? 'schedule' : 'task') : v.d;
      if (f.allSchedule && cur !== 'skip') cur = 'schedule';
      return `<div class="crow"><div class="ctext"><div class="n">${escapeHtml(v.name || u)}</div>
        <div class="sub">${v.recurring ? 'Repeating' : 'One-off'}</div></div>
        <span class="seg-mini">${['schedule', 'task', 'skip'].filter((d) => !(f.allSchedule && d === 'task')).map((d) => `<button class="${d === cur ? 'on' : ''}" data-act="cal-decide" data-feed="${f.id}" data-uid="${escapeHtml(u)}" data-d="${d}">${DECISION_LABEL[d]}</button>`).join('')}</span></div>`;
    };
    return `<section class="card">
      <div class="card-head"><h2>${escapeHtml(f.name)}</h2><span class="hint">→ section “${escapeHtml(f.section)}”</span></div>
      <p class="small pad ${f.lastError ? 'err' : 'muted'}">${f.lastError ? '⚠️ ' + escapeHtml(f.lastError) : `Synced ${ago(f.lastSync)} · updates automatically while the app is open`}</p>
      <div class="btn-row">
        <button class="btn" data-act="cal-sync" data-feed="${f.id}">Sync now</button>
        ${f.pending.length ? `<a class="btn primary" href="#/calendar/review">Review ${f.pending.length} new</a>` : ''}
      </div>
      <label class="toggle-row"><input type="checkbox" data-act="cal-allsched" data-feed="${f.id}" ${f.allSchedule ? 'checked' : ''}>
        <span>This is my timetable<small>All its events show as schedule (not one-off tasks): on the calendar and in Today's schedule, and not counted in your hours.</small></span></label>
      <label class="toggle-row"><input type="checkbox" data-act="cal-ask" data-feed="${f.id}" ${f.ask ? 'checked' : ''}>
        <span>Ask me before importing new events<small>Off: repeating events become schedule, one-offs become tasks.</small></span></label>
      ${entries.length ? `<details class="fold-in"><summary>Series (${counts.schedule} schedule · ${counts.task} task · ${counts.skip} skipped)</summary>${entries.map(row).join('')}</details>` : ''}
      <button class="btn warn full" data-act="cal-remove" data-feed="${f.id}">Disconnect</button>
    </section>`;
  };
  return `
    <header class="top">
      ${topBar({ left: '<button class="icon-btn" data-act="back" aria-label="Back">‹</button>', label: 'Your timetable and events', title: 'Calendars' })}
    </header>
    ${feeds.map(feedCard).join('')}
    <form class="card form" data-form="calendar-add">
      <div class="card-head"><h2>${feeds.length ? 'Add another calendar' : 'Connect a calendar'}</h2></div>
      <label class="f">Calendar link (iCal / .ics)<input name="url" required inputmode="url" autocapitalize="off" autocorrect="off" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"></label>
      <label class="toggle-row"><input type="checkbox" name="allSchedule">
        <span>This is my timetable<small>All its events are schedule (classes, lectures), never one-off tasks.</small></span></label>
      <div class="f2">
        <label class="f">Name<input name="name" placeholder="e.g. Google Calendar"></label>
        <label class="f">Put events in section<input name="section" list="sections" placeholder="Calendar"></label>
      </div>
      <datalist id="sections">${sectionNames().map((s) => `<option value="${escapeHtml(s)}">`).join('')}</datalist>
      <button class="btn primary" type="submit">Connect</button>
      <p class="help">🔒 The link is stored only on this phone (and in your JSON backups). Anyone with it can read that calendar, so treat it like a password.</p>
    </form>
    <section class="card howto">
      <div class="card-head"><h2>Where to find the link</h2></div>
      <details class="fold-in" open><summary>Google Calendar</summary><ol>
        <li>On a computer, open calendar.google.com → ⚙️ <b>Settings</b>.</li>
        <li>Under <b>Settings for my calendars</b>, click your calendar → <b>Integrate calendar</b>.</li>
        <li>Copy <b>Secret address in iCal format</b> and paste it above (AirDrop or Notes to get it to your phone).</li></ol>
        <p class="help">Calendars you <b>subscribed to</b> in Google (under “Other calendars”, e.g. a school timetable) have no secret address. Use the original link instead (see below).</p></details>
      <details class="fold-in"><summary>School timetable (or any subscribed calendar)</summary><ol>
        <li>Go back to where you got the calendar link, e.g. your timetable’s <b>Subscribe</b> / <b>iCal</b> / <b>Add to calendar</b> option.</li>
        <li>Copy that link (it often starts with <b>webcal://</b> or ends in <b>.ics</b>) and paste it above.</li>
        <li>You can keep it in Google Calendar too; the two don’t interfere.</li></ol></details>
      <details class="fold-in"><summary>Outlook / school email calendar</summary><ol>
        <li>Open outlook.office.com → ⚙️ <b>Settings</b> → <b>Calendar</b> → <b>Shared calendars</b>.</li>
        <li>Under <b>Publish a calendar</b>, pick your calendar and <b>Can view all details</b> → <b>Publish</b>.</li>
        <li>Copy the <b>ICS</b> link.</li></ol></details>
      <details class="fold-in"><summary>Apple iCloud Calendar</summary><ol>
        <li>iPhone <b>Calendar</b> app → <b>Calendars</b> → ⓘ next to the calendar.</li>
        <li>Turn on <b>Public Calendar</b> → <b>Share Link</b> → Copy.</li>
        <li>Note: anyone with this link can see the calendar.</li></ol></details>
    </section>`;
}

function reviewPageHtml() {
  const feeds = state.calendars.feeds.filter((f) => f.pending.length);
  if (!feeds.length) {
    return `<header class="top">${topBar({ left: '<button class="icon-btn" data-act="back" aria-label="Back">‹</button>', title: 'New calendar events' })}</header>
      <section class="card empty"><p>Nothing new to review.</p><a class="btn" href="#/calendar">Calendars</a></section>`;
  }
  return `
    <header class="top">
      ${topBar({ left: '<button class="icon-btn" data-act="back" aria-label="Back">‹</button>', label: 'Next 4 weeks', title: 'New calendar events' })}
    </header>
    <form data-form="review">
      ${feeds.map((f) => `<section class="card">
        <div class="card-head"><h2>${escapeHtml(f.name)}</h2></div>
        ${f.pending.map((p) => `<div class="rrow">
          <span class="ctext"><span class="n">${escapeHtml(p.name)}</span>
          <span class="sub">${p.count > 1 ? `${p.days} · ${escapeHtml(p.when)} · ${p.count}×` : `${fmtShort(p.first)} · ${escapeHtml(p.when)}`}${p.location ? ' · ' + escapeHtml(p.location) : ''}</span></span>
          <select name="d:${f.id}|${escapeHtml(p.uid)}" aria-label="Import as">
            ${['schedule', 'task', 'skip'].map((d) => `<option value="${d}" ${d === (p.suggested || 'task') ? 'selected' : ''}>${DECISION_LABEL[d]}</option>`).join('')}
          </select></div>`).join('')}
      </section>`).join('')}
      <div class="sticky-actions">
        <button class="btn primary full" type="submit">Save</button>
        <p class="help center"><b>Schedule</b>: shown on your calendar (lectures, classes). <b>Task</b>: something to tick off (a coffee chat). Decided once per series; change it anytime in Commitments → Calendars.</p>
      </div>
    </form>`;
}

// ---------- Phone widget (Scriptable) ----------
// The widget can't read this app's storage, so the app sends a compact summary to /api/widget
// under a random key; the Scriptable script (widget/commitments-widget.js) reads it back.
const WIDGET_PUSH_DELAY = 3000;
let widgetTimer = null;
let lastWidgetSig = '';
let widgetTemplate = null;

function newWidgetKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function widgetSnapshot() {
  const wk = currentWeekKey();
  const w = getWeek(wk);
  const ws = weekStats(w);
  return {
    v: 1,
    updatedAt: new Date().toISOString(),
    week: wk,
    days: DAY_NAMES.map((_, i) => {
      const d = dayStats(w, i);
      return { done: d.done, total: d.total, actual: round2(d.actual), planned: round2(d.planned) };
    }),
    stats: { planned: round2(ws.planned), actual: round2(ws.actual), pct: Math.round(ws.pct * 100) },
    daily: itemsOf(w, 'daily').map(([, it]) => ({
      n: it.name, k: it.kind === 'counter' ? 'c' : 't', tg: it.target, u: it.unit,
      d: it.ticks.map((t, i) => (it.kind === 'task' ? (t ? 1 : 0) : it.counts[i])),
    })),
    once: itemsOf(w, 'once').filter(isTask).map(([, it]) => ({
      n: it.name, date: it.date, time: it.time, endTime: it.endTime, done: periodDone(it) ? 1 : 0,
    })),
    weekly: itemsOf(w, 'weekly').map(([, it]) => ({
      n: it.name, k: it.kind === 'counter' ? 'c' : 't', tg: it.kind === 'counter' ? it.target : 1, u: it.unit,
      c: it.kind === 'counter' ? it.count : it.done ? 1 : 0, done: periodDone(it) ? 1 : 0,
    })),
  };
}

function scheduleWidgetPush(delay = WIDGET_PUSH_DELAY) {
  if (!state.widget.enabled) return;
  clearTimeout(widgetTimer);
  widgetTimer = setTimeout(() => pushWidget(), delay);
}

async function pushWidget({ force = false } = {}) {
  clearTimeout(widgetTimer);
  widgetTimer = null;
  const wd = state.widget;
  if (!wd.enabled || !wd.token) return false;
  const snap = widgetSnapshot();
  const { updatedAt, ...rest } = snap;
  const sig = JSON.stringify(rest);
  if (!force && sig === lastWidgetSig) return true;
  try {
    const res = await fetch('/api/widget', {
      method: 'PUT', keepalive: true, body: JSON.stringify(snap),
      headers: { authorization: `Bearer ${wd.token}`, 'content-type': 'application/json' },
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Widget update failed (${res.status})`);
    lastWidgetSig = sig;
    wd.lastPush = updatedAt;
    wd.lastError = null;
    return true;
  } catch (e) {
    wd.lastError = navigator.onLine ? e.message : 'Offline. Will send when you are back online.';
    return false;
  } finally {
    writeState().catch(() => {});
    if (route.page === 'widget') render();
  }
}

async function deleteWidgetData(token) {
  const res = await fetch('/api/widget', { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Couldn’t reach the server. Try again when online.');
}

function widgetScript() {
  return widgetTemplate && widgetTemplate.replaceAll('__WIDGET_KEY__', state.widget.token).replaceAll('__ORIGIN__', location.origin);
}
async function loadWidgetTemplate() {
  if (widgetTemplate) return;
  try {
    widgetTemplate = await (await fetch('widget/commitments-widget.js')).text();
    if (route.page === 'widget') render();
  } catch { /* shown as unavailable on the page */ }
}

async function widgetAction(act) {
  const wd = state.widget;
  if (act === 'widget-on') {
    wd.enabled = true;
    wd.token = wd.token || newWidgetKey();
    save(); render();
    if (await pushWidget({ force: true })) toast('Widget sharing is on');
  } else if (act === 'widget-send') {
    toast((await pushWidget({ force: true })) ? 'Sent to widget' : wd.lastError);
  } else if (act === 'widget-off' || act === 'widget-reset') {
    if (act === 'widget-reset' && !confirm('Make a new widget key? Widgets using the old script stop working until you paste the new script.')) return;
    try { await deleteWidgetData(wd.token); } catch (e) { toast(e.message); return; }
    lastWidgetSig = '';
    if (act === 'widget-off') { wd.enabled = false; wd.token = null; wd.lastPush = null; wd.lastError = null; save(); render(); toast('Widget sharing is off'); }
    else { wd.token = newWidgetKey(); save(); render(); await pushWidget({ force: true }); toast('New key made. Copy the script again.'); }
  } else if (act === 'widget-copy') {
    const script = widgetScript();
    if (!script) { toast('Script still loading…'); return; }
    navigator.clipboard.writeText(script)
      .then(() => toast('Widget script copied'))
      .catch(() => { const d = document.getElementById('scriptBox'); if (d) { d.open = true; d.querySelector('textarea').select(); } toast('Select the script below and copy it'); });
  }
}

function widgetPageHtml() {
  const wd = state.widget;
  const back = '<button class="icon-btn" data-act="back" aria-label="Back">‹</button>';
  if (!wd.enabled) {
    return `
      <header class="top">${topBar({ left: back, label: 'Scriptable', title: 'Phone widget' })}</header>
      <section class="card">
        <div class="card-head"><h2>Today on your Home Screen</h2></div>
        <p class="pad">See today's progress and what's left, on your Home Screen, Lock Screen or Mac desktop, using the free <b>Scriptable</b> app.</p>
        <p class="pad small muted">How it works: when you log something, this app sends a short summary (commitment names and today's and this week's progress) to your own site under a private random key. The widget reads it from there. Nothing else leaves your phone.</p>
        <button class="btn primary full" data-act="widget-on">Turn on</button>
      </section>`;
  }
  loadWidgetTemplate();
  const script = widgetScript();
  return `
    <header class="top">${topBar({ left: back, label: 'Scriptable', title: 'Phone widget' })}</header>
    <section class="card">
      <div class="card-head"><h2>Sharing is on</h2></div>
      <p class="small pad ${wd.lastError ? 'err' : 'muted'}">${wd.lastError ? '⚠️ ' + escapeHtml(wd.lastError) : `Last sent ${ago(wd.lastPush)}. Updates a few seconds after each change.`}</p>
      <div class="btn-row"><button class="btn" data-act="widget-send">Send now</button><button class="btn" data-act="widget-off">Turn off</button></div>
    </section>
    <section class="card howto">
      <div class="card-head"><h2>Set up the widget</h2></div>
      <ol>
        <li>Install <b>Scriptable</b> from the App Store (free).</li>
        <li><button class="btn primary" data-act="widget-copy" ${script ? '' : 'disabled'}>Copy widget script</button></li>
        <li>Open Scriptable → tap <b>+</b> → paste → tap the title at the top, rename it <b>Commitments</b> → <b>Done</b>.</li>
        <li>Long-press your Home Screen → <b>Edit</b> → <b>Add Widget</b> → search <b>Scriptable</b> → pick a size → <b>Add Widget</b>.</li>
        <li>Long-press the new widget → <b>Edit Widget</b> → <b>Script</b>: <b>Commitments</b>.</li>
      </ol>
      <details class="fold-in"><summary>Lock Screen</summary><ol>
        <li>Long-press the Lock Screen → <b>Customize</b> → <b>Lock Screen</b> → tap the widget area.</li>
        <li>Add a <b>Scriptable</b> widget, tap it, and choose <b>Commitments</b>.</li></ol></details>
      <details class="fold-in"><summary>Mac desktop (macOS Sonoma or later)</summary><ol>
        <li>Your Mac must use the same Apple ID as your iPhone.</li>
        <li>Right-click the desktop → <b>Edit Widgets</b> → find <b>Scriptable</b> under your iPhone → drag a widget onto the desktop.</li>
        <li>Then right-click it → <b>Edit</b> → choose <b>Commitments</b>.</li></ol></details>
      <details class="fold-in" id="scriptBox"><summary>Show script</summary>
        <textarea readonly rows="8" class="code">${escapeHtml(script || 'Loading…')}</textarea></details>
      <p class="help">The widget shows what this app last sent, so it updates when you use the app. Tapping the widget opens Scriptable.</p>
    </section>
    <section class="card">
      <div class="card-head"><h2>Private key</h2></div>
      <p class="small pad muted">The script contains a private key. If you shared it by mistake, make a new one; old copies stop working.</p>
      <button class="btn warn full" data-act="widget-reset">Make a new key</button>
    </section>`;
}

// ---------- Sync between devices ----------
// The data is split into records: "c:<id>" commitments, "ws:<week>:<id>" week item details,
// "wp:<week>:<id>" week item progress and "f:<id>" calendar feeds. Each local change is stamped
// with the time it was made; only changed records are sent, and the server keeps the newest
// version of each (see server/sync.mjs). Splitting progress from details means that
// renaming something on one device can't undo a tick made on the other.
const SYNC_DEBOUNCE_MS = 2000;
const SYNC_POLL_MS = 120000; // data sync check while the app sits open (changes still sync ~2s after you make them)
const PROGRESS_FIELDS = ['ticks', 'counts', 'mins', 'count', 'done'];
const FEED_FIELDS = ['id', 'name', 'url', 'section', 'decisions', 'skipped', 'ask', 'allSchedule'];
const RECORD_ORDER = { c: 0, f: 1, ws: 2, wp: 3 };
let recordHashes = null; // record key -> JSON of the record as last stamped or received
let syncTimer = null;
let syncInFlight = null;
let syncAgain = false;

const freshSync = () => ({ enabled: false, key: null, version: 0, stamps: {}, dirty: {}, tombs: {}, lastSync: null, lastError: null });
function stableStringify(v) {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v === undefined ? null : v);
}
const pick = (o, fields) => { const r = {}; for (const f of fields) if (o[f] !== undefined) r[f] = o[f]; return r; };
const omit = (o, fields) => { const r = {}; for (const [k, v] of Object.entries(o)) if (!fields.includes(k)) r[k] = v; return r; };
const progressHasData = (p) => (p.ticks || []).some(Boolean) || (p.counts || []).some((n) => n > 0) ||
  (p.mins || []).some((m) => m != null) || p.count > 0 || !!p.done;
function splitKey(k) {
  const i = k.indexOf(':');
  const type = k.slice(0, i), rest = k.slice(i + 1);
  if (type === 'ws' || type === 'wp') { const j = rest.indexOf(':'); return [type, rest.slice(0, j), rest.slice(j + 1)]; }
  return [type, rest];
}

function recordPayloads() {
  const out = new Map();
  for (const c of state.commitments) out.set(`c:${c.id}`, c);
  for (const [wk, w] of Object.entries(state.weeks)) {
    for (const [id, it] of Object.entries(w.items)) {
      out.set(`ws:${wk}:${id}`, omit(it, PROGRESS_FIELDS));
      out.set(`wp:${wk}:${id}`, pick(it, PROGRESS_FIELDS));
    }
  }
  for (const f of state.calendars.feeds) out.set(`f:${f.id}`, pick(f, FEED_FIELDS));
  return out;
}
function payloadFor(k) {
  const [type, a, b] = splitKey(k);
  if (type === 'c') return state.commitments.find((x) => x.id === a);
  if (type === 'f') { const f = state.calendars.feeds.find((x) => x.id === a); return f && pick(f, FEED_FIELDS); }
  const it = state.weeks[a] && state.weeks[a].items[b];
  if (!it) return undefined;
  return type === 'ws' ? omit(it, PROGRESS_FIELDS) : pick(it, PROGRESS_FIELDS);
}
function rememberHash(k) {
  const p = payloadFor(k);
  if (p === undefined) recordHashes.delete(k); else recordHashes.set(k, stableStringify(p));
}
function resetRecordHashes() {
  recordHashes = new Map();
  for (const [k, p] of recordPayloads()) recordHashes.set(k, stableStringify(p));
}

// Compares every record with how it looked last time and stamps the ones that changed.
function stampChanges() {
  const S = state.sync;
  if (!S.enabled) return false;
  if (!recordHashes) resetRecordHashes();
  const now = Date.now();
  const current = recordPayloads();
  let changed = false;
  for (const [k, p] of current) {
    const h = stableStringify(p);
    const prev = recordHashes.get(k);
    if (prev === h) continue;
    // A week freshly created on this device starts empty; that must never beat real ticks from elsewhere.
    const emptyNew = prev === undefined && k.startsWith('wp:') && !progressHasData(p);
    S.stamps[k] = emptyNew ? 0 : now;
    S.dirty[k] = 1;
    delete S.tombs[k];
    recordHashes.set(k, h);
    changed = true;
  }
  for (const k of [...recordHashes.keys()]) {
    if (current.has(k)) continue;
    recordHashes.delete(k);
    S.tombs[k] = now;
    delete S.dirty[k];
    delete S.stamps[k];
    changed = true;
  }
  return changed;
}

function applyRecord(k, p) {
  const [type, a, b] = splitKey(k);
  if (type === 'c') {
    const c = normaliseCommitment(p);
    const i = state.commitments.findIndex((x) => x.id === c.id);
    if (i >= 0) state.commitments[i] = c; else state.commitments.push(c);
  } else if (type === 'f') {
    const f = state.calendars.feeds.find((x) => x.id === p.id);
    if (f) Object.assign(f, pick(p, FEED_FIELDS));
    else state.calendars.feeds.push({ lastSync: null, lastError: null, pending: [], decisions: {}, skipped: {}, ...pick(p, FEED_FIELDS) });
  } else {
    const w = state.weeks[a] || (state.weeks[a] = { start: a, items: {} });
    const it = w.items[b] || (w.items[b] = {});
    if (type === 'ws') {
      for (const f of Object.keys(it)) if (!PROGRESS_FIELDS.includes(f)) delete it[f];
      Object.assign(it, omit(p, PROGRESS_FIELDS));
    } else {
      Object.assign(it, pick(p, PROGRESS_FIELDS));
    }
    normaliseItem(it);
  }
}
function removeRecord(k) {
  const [type, a, b] = splitKey(k);
  if (type === 'c') state.commitments = state.commitments.filter((x) => x.id !== a);
  else if (type === 'f') state.calendars.feeds = state.calendars.feeds.filter((x) => x.id !== a);
  else if (state.weeks[a]) delete state.weeks[a].items[b];
}

// Applies changes from the server, unless this device has a newer unsent change to the same record.
function applyRemote({ records = {}, tombs = {} }) {
  const S = state.sync;
  stampChanges(); // anything edited while the request was in flight counts as a local change
  let applied = 0;
  const keys = Object.keys(records).sort((x, y) => RECORD_ORDER[splitKey(x)[0]] - RECORD_ORDER[splitKey(y)[0]]);
  for (const k of keys) {
    const { p, m } = records[k];
    if (S.dirty[k] && (S.stamps[k] || 0) > m) continue;
    applyRecord(k, p);
    S.stamps[k] = m;
    delete S.dirty[k];
    delete S.tombs[k];
    const [type, a, b] = splitKey(k);
    if (type === 'ws' || type === 'wp') { rememberHash(`ws:${a}:${b}`); rememberHash(`wp:${a}:${b}`); } else rememberHash(k);
    applied++;
  }
  for (const [k, t] of Object.entries(tombs)) {
    if (S.dirty[k] && (S.stamps[k] || 0) > t) continue;
    removeRecord(k);
    delete S.stamps[k];
    delete S.dirty[k];
    const [type, a, b] = splitKey(k);
    if (type === 'ws' || type === 'wp') { rememberHash(`ws:${a}:${b}`); rememberHash(`wp:${a}:${b}`); } else rememberHash(k);
    applied++;
  }
  return applied;
}

function scheduleSync(delay = SYNC_DEBOUNCE_MS) {
  if (!state.sync.enabled) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncNow(), delay);
}

async function syncNow({ join = false } = {}) {
  const S = state.sync;
  if (!S.enabled || !S.key) return 0;
  if (syncInFlight) { syncAgain = true; return syncInFlight; }
  clearTimeout(syncTimer);
  syncInFlight = (async () => {
    if (saveTimer !== null) flush(); else stampChanges();
    const payloads = recordPayloads();
    const records = {}, sentStamps = {}, tombs = { ...S.tombs };
    for (const k of Object.keys(S.dirty)) {
      const p = payloads.get(k);
      if (p === undefined) { delete S.dirty[k]; continue; }
      records[k] = { p, m: S.stamps[k] || 0 };
      sentStamps[k] = S.stamps[k] || 0;
    }
    let res, body;
    try {
      res = await fetch('/api/sync', {
        method: 'POST',
        headers: { authorization: `Bearer ${S.key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ since: S.version, join, records, tombs }),
      });
      body = await res.json().catch(() => ({}));
    } catch {
      S.lastError = 'Offline. Will sync when you’re back online.';
      return -1;
    }
    if (res.status === 410) { stopSync(); S.lastError = body.error; toast(body.error); return -1; }
    if (!res.ok) { S.lastError = body.error || `Sync failed (${res.status})`; return -1; }
    // What was sent is now on the server, unless it changed again while the request was in flight.
    for (const k of Object.keys(sentStamps)) if ((S.stamps[k] || 0) === sentStamps[k]) delete S.dirty[k];
    for (const [k, t] of Object.entries(tombs)) if (S.tombs[k] === t) delete S.tombs[k];
    const applied = applyRemote(body);
    S.version = body.version;
    S.lastSync = new Date().toISOString();
    S.lastError = null;
    return applied;
  })();
  try {
    const applied = await syncInFlight;
    writeState().catch(() => {});
    if (applied > 0) {
      scheduleWidgetPush();
      if (!route.edit && !sheetCtx) render();
    } else if (route.page === 'sync') {
      render();
    }
    return applied;
  } finally {
    syncInFlight = null;
    if (syncAgain) { syncAgain = false; scheduleSync(300); }
  }
}

function stopSync() {
  clearTimeout(syncTimer);
  state.sync = freshSync();
  recordHashes = null;
  save();
  render();
}

async function startSync() {
  state.sync = { ...freshSync(), enabled: true, key: newWidgetKey() };
  recordHashes = new Map(); // everything on this device counts as new
  stampChanges();
  save();
  render();
  toast('Uploading your data…');
  const r = await syncNow();
  toast(r >= 0 ? 'Sync is on. Copy the key to your other device.' : state.sync.lastError);
}

async function joinSync(form) {
  const key = String(new FormData(form).get('key') || '').trim();
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(key)) { toast('That doesn’t look like a sync key. Copy it again from your other device.'); return; }
  const hasProgress = Object.values(state.weeks).some((w) => Object.values(w.items).some(hasData));
  if (hasProgress && !confirm('Replace everything on this device with the data from your other device?')) return;
  const before = JSON.parse(JSON.stringify(state));
  state.commitments = [];
  state.weeks = {};
  state.calendars.feeds = [];
  state.sync = { ...freshSync(), enabled: true, key };
  recordHashes = new Map();
  toast('Joining…');
  const r = await syncNow({ join: true });
  if (r < 0) {
    const err = state.sync.lastError;
    state = before;
    recordHashes = null;
    save(); render();
    toast(err || 'Couldn’t join');
    return;
  }
  save();
  toast('Synced with your other device');
  location.hash = '#/today';
}

async function syncAction(act) {
  if (act === 'sync-on') return startSync();
  if (act === 'sync-now') {
    const r = await syncNow();
    toast(r < 0 ? state.sync.lastError : r ? `Synced · ${r} change${r === 1 ? '' : 's'}` : 'Up to date');
  } else if (act === 'sync-copy') {
    navigator.clipboard.writeText(state.sync.key).then(() => toast('Sync key copied'), () => {
      const i = document.getElementById('syncKey'); if (i) { i.select(); } toast('Select the key and copy it');
    });
  } else if (act === 'sync-off') {
    if (!confirm('Stop syncing on this device? Your data stays here; your other devices keep syncing.')) return;
    stopSync();
    toast('Sync is off on this device');
  } else if (act === 'sync-delete') {
    if (!confirm('Delete the synced copy from the server? Every device stops syncing. Data already on each device is kept.')) return;
    try {
      const res = await fetch('/api/sync', { method: 'DELETE', headers: { authorization: `Bearer ${state.sync.key}` } });
      if (!res.ok) throw new Error();
    } catch { toast('Couldn’t reach the server. Try again when online.'); return; }
    stopSync();
    toast('Synced copy deleted');
  }
}

function syncPageHtml() {
  const S = state.sync;
  const back = '<button class="icon-btn" data-act="back" aria-label="Back">‹</button>';
  if (!S.enabled) {
    return `
      <header class="top">${topBar({ left: back, label: 'iPhone ↔ Mac', title: 'Sync' })}</header>
      <section class="card">
        <div class="card-head"><h2>Use the app on all your devices</h2></div>
        <p class="pad">Keep your commitments, ticks and calendars the same on your iPhone and Mac. No account needed: your data is copied to your own site under a private key.</p>
      </section>
      <section class="card">
        <div class="card-head"><h2>1 · On the device with your data</h2></div>
        <p class="small pad muted">Usually your iPhone. This uploads everything and gives you a sync key.</p>
        <button class="btn primary full" data-act="sync-on">Turn on sync</button>
      </section>
      <form class="card form" data-form="sync-join">
        <div class="card-head"><h2>2 · On your other device</h2></div>
        <p class="small muted">Paste the sync key from your first device. This device's current data is replaced by the synced data.</p>
        <label class="f">Sync key<input name="key" class="mono" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Paste key"></label>
        <button class="btn primary" type="submit">Join</button>
      </form>`;
  }
  return `
    <header class="top">${topBar({ left: back, label: 'iPhone ↔ Mac', title: 'Sync' })}</header>
    <section class="card">
      <div class="card-head"><h2>Sync is on</h2></div>
      <p class="small pad ${S.lastError ? 'err' : 'muted'}">${S.lastError ? '⚠️ ' + escapeHtml(S.lastError) : `Last synced ${ago(S.lastSync)}. Syncs when you open the app, after changes, and every minute or so while it's open.`}</p>
      <div class="btn-row"><button class="btn" data-act="sync-now">Sync now</button></div>
    </section>
    <section class="card">
      <div class="card-head"><h2>Sync key</h2></div>
      <input id="syncKey" class="mono full-input" readonly value="${escapeHtml(S.key)}" aria-label="Sync key">
      <div class="btn-row"><button class="btn primary" data-act="sync-copy">Copy key</button></div>
      <p class="small muted pad">On your other device: open the app → ⋯ → <b>Sync</b> → paste the key → <b>Join</b>. Anyone with this key can see and change your data, so only send it to yourself (AirDrop, Notes).</p>
    </section>
    <section class="card howto">
      <div class="card-head"><h2>Set up your Mac</h2></div>
      <ol>
        <li>Open <b>${escapeHtml(location.host)}</b> in <b>Safari</b> → <b>File</b> → <b>Add to Dock</b>. (Chrome: ⋮ → <b>Cast, save and share</b> → <b>Install page as app</b>.)</li>
        <li>Open the app from the Dock → ⋯ → <b>Sync</b> → paste the key → <b>Join</b>.</li>
      </ol>
    </section>
    <section class="card">
      <div class="btn-row"><button class="btn" data-act="sync-off">Turn off on this device</button></div>
      <button class="btn warn full" data-act="sync-delete">Delete synced copy</button>
    </section>`;
}

// ---------- Sheets (bottom modals) ----------
let sheetCtx = null;
function openSheet(html, ctx = null) {
  sheetCtx = ctx;
  $sheet.innerHTML = `<div class="backdrop" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  $sheet.hidden = false;
  document.body.classList.add('locked');
}
function closeSheet() {
  $sheet.hidden = true;
  $sheet.innerHTML = '';
  sheetCtx = null;
  document.body.classList.remove('locked');
}

function cellRef(key) {
  const [wk, id, i] = key.split(':');
  const w = state.weeks[wk];
  return { wk, id, i: Number(i), it: w && w.items[id] };
}

function openDaySheet(key) {
  const { wk, i, it } = cellRef(key);
  if (!it) return;
  const target = Math.round(plannedHours(it) * 60);
  const cur = it.mins[i];
  const presets = [...new Set([15, 30, 45, 60, 90, 120, target])].filter((m) => m > 0).sort((a, b) => a - b);
  const counter = it.kind === 'counter' ? `
    <div class="sheet-counter">
      <button class="round" data-act="sdec" ${it.counts[i] <= 0 ? 'disabled' : ''} aria-label="Minus">−</button>
      <div><b>${round2(it.counts[i])}</b><span>of ${round2(it.target)} ${escapeHtml(it.unit)}</span></div>
      <button class="round" data-act="sinc" aria-label="Plus">+</button>
    </div>
    <h4>Time spent (optional)</h4>` : '';
  openSheet(`
    <div class="sheet-head"><h3>${escapeHtml(it.name)}</h3>
      <p class="muted">${fmtDay(dayDate(wk, i), { weekday: 'long', day: 'numeric', month: 'short' })} · planned ${target} min</p></div>
    ${counter}
    <div class="chips">${presets.map((m) => `<button class="chip ${cur === m ? 'on' : ''}" data-act="setmin" data-m="${m}">${m}m</button>`).join('')}</div>
    <form class="inline" data-form="minutes">
      <input id="minIn" type="number" inputmode="numeric" min="0" step="5" placeholder="Minutes" value="${cur ?? ''}">
      <button class="btn primary" type="submit">Save</button>
    </form>
    <div class="sheet-actions">
      ${dayStarted(it, i) ? `<button class="btn" data-act="clearday">${it.kind === 'task' ? 'Untick' : 'Reset to 0'}</button>` : ''}
      <button class="btn" data-act="close">Close</button>
    </div>`, { key });
}

// Logging minutes also marks the day as started (ticks a task; counters need at least 1).
function setMinutes(m) {
  const { it, i } = cellRef(sheetCtx.key);
  if (m > 0) {
    it.mins[i] = m;
    if (it.kind === 'task') it.ticks[i] = true;
    else if (it.counts[i] <= 0) it.counts[i] = it.target || it.step || 1;
  } else {
    it.mins[i] = null;
  }
  save(); closeSheet(); render();
}
function clearDay() {
  const { it, i } = cellRef(sheetCtx.key);
  it.ticks[i] = false; it.counts[i] = 0; it.mins[i] = null;
  save(); closeSheet(); render();
}
function bumpCount(key, dir) {
  const { it, i } = cellRef(key);
  if (!it) return;
  it.counts[i] = Math.max(0, round2(it.counts[i] + dir * (it.step || 1)));
  if (it.counts[i] === 0) it.mins[i] = null;
  save();
}

function openMenu() {
  const last = state.lastBackup ? fmtDay(new Date(state.lastBackup), { day: 'numeric', month: 'short', year: 'numeric' }) : 'never';
  openSheet(`
    <div class="sheet-head"><h3>Menu</h3></div>
    <div class="menu">
      <a class="btn" href="#/sync">Sync with Mac / other devices${state.sync.enabled ? ' · on' : ''}</a>
      <a class="btn" href="#/widget">Phone widget</a>
      <button class="btn" data-act="export-xlsx">Export all weeks to Excel</button>
      <button class="btn" data-act="export-json">Back up (JSON)</button>
      <button class="btn" data-act="import-json">Restore from backup…</button>
      <p class="muted small">Last backup: ${last}. Data lives only on this device, so back up now and then.</p>
      <button class="btn" data-act="close">Close</button>
    </div>`);
}

// ---------- Export / import ----------
async function deliver(blob, filename) {
  const file = new File([blob], filename, { type: blob.type });
  const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (mobile && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return true; }
    catch (e) { if (e.name === 'AbortError') return false; }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}

function exportedWeeks() {
  const cur = currentWeekKey();
  return Object.values(state.weeks)
    .filter((w) => Object.keys(w.items).length && (w.start <= cur || Object.values(w.items).some(hasData)))
    .sort((a, b) => (a.start < b.start ? 1 : -1));
}

function exportXlsx() {
  const bold = (v) => ({ v, s: 'b' });
  const kindLabel = (it) => (it.kind === 'counter' ? 'Counter' : 'Task');
  const targetCell = (it) => (it.kind === 'counter' ? `${round2(it.target)} ${it.unit}`.trim() : fmtH(it.hours));

  const summary = [[bold('Week starting'), bold('Week ending'), bold('Planned h'), bold('Actual h'),
    bold('Actual vs plan'), bold('Ticked'), bold('Total'), bold('% ticked')]];
  const log = [[bold('Week starting'), bold('Date'), bold('Day'), bold('Frequency'), bold('Kind'), bold('Section'),
    bold('Commitment'), bold('Target'), bold('Unit'), bold('Done / count'), bold('Met target'), bold('Actual h')]];
  const weekSheets = [];

  for (const w of exportedWeeks()) {
    const s = weekStats(w);
    summary.push([w.start, weekEnd(w.start), round2(s.planned), round2(s.actual),
      { v: s.planned ? s.actual / s.planned : 0, s: 'pct' }, s.ticked, s.total, { v: s.pct, s: 'pct' }]);

    const rows = [
      [bold(`Week of ${weekRange(w.start)}`)],
      ['Planned h', round2(s.planned), 'Actual h', round2(s.actual), '% ticked', { v: s.pct, s: 'pct' }],
      [],
      [bold('Section'), bold('Daily commitment'), bold('Kind'), bold('Target/day'),
        ...DAY_NAMES.map((d, i) => bold(`${d} ${dayDate(w.start, i).getDate()}`)), bold('Days met'), bold('Actual h')],
    ];
    for (const [, it] of itemsOf(w, 'daily')) {
      // Task cells: 1 when done. Counter cells: the count.
      const cells = it.ticks.map((t, i) => (it.kind === 'task' ? (t ? 1 : null) : it.counts[i] || null));
      rows.push([it.section, it.name, kindLabel(it), targetCell(it), ...cells,
        it.ticks.filter((_, i) => dayDone(it, i)).length, round2(it.ticks.reduce((a, _, i) => a + dayHours(it, i), 0))]);
      for (let i = 0; i < 7; i++) {
        log.push([w.start, isoDate(dayDate(w.start, i)), DAY_NAMES[i], 'Daily', kindLabel(it), it.section, it.name,
          it.kind === 'counter' ? it.target : 1, it.unit, it.kind === 'counter' ? it.counts[i] : it.ticks[i] ? 1 : 0,
          dayDone(it, i) ? 1 : 0, round2(dayHours(it, i))]);
      }
    }
    rows.push([], [bold('Section'), bold('Weekly / one-off'), bold('Kind'), bold('Date'), bold('Target'),
      bold('Progress'), bold('Met target'), bold('Actual h')]);
    for (const [, it] of [...itemsOf(w, 'weekly'), ...itemsOf(w, 'once').filter(isTask)]) {
      rows.push([it.section, it.name, kindLabel(it), it.date || 'This week', targetCell(it),
        it.kind === 'counter' ? it.count : it.done ? 'Done' : '', periodDone(it) ? 'Yes' : '', round2(periodHours(it))]);
      log.push([w.start, it.date || '', it.date ? DAY_NAMES[dayIndexOf(it.date)] : '', FREQ_LABEL[it.freq], kindLabel(it),
        it.section, it.name, it.kind === 'counter' ? it.target : 1, it.unit, it.kind === 'counter' ? it.count : it.done ? 1 : 0,
        periodDone(it) ? 1 : 0, round2(periodHours(it))]);
    }
    weekSheets.push({ name: `Wk ${w.start}`, cols: [14, 30, 9, 12, 8, 8, 8, 8, 8, 8, 8, 10, 10], rows });
  }

  const blob = buildXlsx([
    { name: 'Summary', cols: [14, 14, 11, 11, 14, 9, 8, 10], rows: summary },
    ...weekSheets,
    { name: 'Log', cols: [14, 12, 6, 10, 9, 14, 32, 8, 8, 12, 11, 9], rows: log },
  ]);
  deliver(blob, `commitments-${todayISO()}.xlsx`);
}

function exportJson() {
  flush();
  state.lastBackup = new Date().toISOString();
  save();
  const data = { app: 'weekly-commitment-tracker', exportedAt: state.lastBackup, state };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  deliver(blob, `commitments-backup-${todayISO()}.json`);
}

async function importJson(file) {
  try {
    const data = JSON.parse(await file.text());
    const next = migrate(data.state || data);
    const n = Object.keys(next.weeks).length;
    if (!confirm(`Replace everything on this device with this backup (${next.commitments.length} commitments, ${n} weeks)?`)) return;
    next.sync = state.sync;
    state = next;
    save(); flush();
    closeSheet(); render();
    toast('Backup restored');
  } catch (e) {
    toast(e.message || 'Import failed');
  }
}

// ---------- Toast ----------
let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2500);
}

// ---------- Events ----------
// Long-press on a day cell opens the day sheet (minutes, exact count); a tap logs it.
let press = null;
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('[data-cell]');
  if (!el) return;
  const p = { key: el.dataset.cell, x: e.clientX, y: e.clientY, fired: false, moved: false };
  p.timer = setTimeout(() => { p.fired = true; openDaySheet(p.key); }, LONG_PRESS_MS);
  press = p;
});
document.addEventListener('pointermove', (e) => {
  if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) { press.moved = true; clearTimeout(press.timer); }
});
for (const t of ['pointerup', 'pointercancel']) document.addEventListener(t, () => { if (press) clearTimeout(press.timer); });
document.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-cell]')) e.preventDefault(); });

document.addEventListener('click', (e) => {
  const cell = e.target.closest('[data-cell]');
  if (cell) {
    const p = press; press = null;
    if (p && p.key === cell.dataset.cell && (p.fired || p.moved)) return;
    const { it, i } = cellRef(cell.dataset.cell);
    if (!it) return;
    if (it.kind === 'task') {
      it.ticks[i] = !it.ticks[i];
      if (!it.ticks[i]) it.mins[i] = null;
      save();
    } else {
      bumpCount(cell.dataset.cell, 1);
    }
    render();
    return;
  }
  const jump = e.target.closest('[data-jump]');
  if (jump) {
    const el = document.getElementById(jump.dataset.jump);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Highlight what was clicked, even if the page can't scroll that section to the top.
    $app.querySelectorAll('.sn-sections [data-jump]').forEach((l) => l.classList.toggle('on', l === jump));
    jumpHoldUntil = Date.now() + 900;
    return;
  }
  const btn = e.target.closest('[data-act]');
  if (!btn) {
    const open = e.target.closest('[data-open]');
    if (open) location.hash = open.dataset.open;
    return;
  }
  const act = btn.dataset.act;
  const periodItem = () => state.weeks[btn.dataset.wk]?.items[btn.dataset.id];
  switch (act) {
    case 'apps-refresh': refreshApps({ force: true }); break;
    case 'apps-more': {
      const k = btn.dataset.key;
      if (appsExpanded.has(k)) appsExpanded.delete(k); else appsExpanded.add(k);
      render(); break;
    }
    case 'app-today': toggleAppToday(btn.dataset.id); break;
    case 'app-followup': openFollowupSheet(btn.dataset.id); break;
    case 'app-done': {
      const a = state.apps.items.find((x) => x.id === btn.dataset.id);
      if (a) { updateApp(a.id, { done: !a.done }); toast(a.done ? `${a.company}: done ✓` : `${a.company}: not done`); }
      break;
    }
    case 'app-mat': {
      const a = state.apps.items.find((x) => x.id === btn.dataset.id);
      if (!a) break;
      const set = new Set(a.materialsDone || []);
      if (set.has(btn.dataset.m)) set.delete(btn.dataset.m); else set.add(btn.dataset.m);
      updateApp(a.id, { materialsDone: [...set] });
      break;
    }
    case 'apps-day': appsDay = appsDay === btn.dataset.date ? null : btn.dataset.date; render(); break;
    case 'apps-month': {
      const [y, m] = appsMonth.split('-').map(Number);
      const d = new Date(y, m - 1 + Number(btn.dataset.dir), 1);
      appsMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; appsDay = null; render(); break;
    }
    case 'cal-day': calViewDay = btn.dataset.date; render(); break;
    case 'cal-prev': case 'cal-next': calViewDay = isoDate(addDays(parseISO(calViewDay), act === 'cal-prev' ? -7 : 7)); render(); break;
    case 'cal-today': calViewDay = todayISO(); render(); break;
    case 'prev': viewKey = shiftWeek(viewKey, -1); render(); break;
    case 'next': viewKey = shiftWeek(viewKey, 1); render(); break;
    case 'thisweek': viewKey = currentWeekKey(); render(); break;
    case 'back': goBack(); break;
    case 'menu': openMenu(); break;
    case 'close': closeSheet(); break;
    case 'start-week': {
      const w = state.weeks[viewKey] || (state.weeks[viewKey] = { start: viewKey, items: {} });
      syncWeek(w, true);
      save(); render(); break;
    }
    case 'pdone': {
      const it = periodItem();
      if (it) { it.done = !it.done; save(); render(); }
      break;
    }
    case 'pstep': {
      const it = periodItem();
      if (it) { it.count = Math.max(0, round2(it.count + Number(btn.dataset.dir) * (it.step || 1))); save(); render(); }
      break;
    }
    case 'cdec': bumpCount(btn.dataset.key, -1); render(); break;
    case 'sinc': case 'sdec': {
      const key = sheetCtx.key;
      bumpCount(key, act === 'sinc' ? 1 : -1);
      render(); openDaySheet(key); break;
    }
    case 'setmin': setMinutes(Number(btn.dataset.m)); break;
    case 'clearday': clearDay(); break;
    case 'reorder': reorderMode = !reorderMode; render(); break;
    case 'up': case 'down':
      moveCommitment(btn.closest('[data-cid]').dataset.cid, act === 'up' ? -1 : 1);
      save(); render(); break;
    case 'restore': {
      const c = state.commitments.find((x) => x.id === btn.closest('[data-cid]').dataset.cid);
      c.archived = false; c.order = nextOrder();
      renumber(); save(); render(); toast(`Restored “${c.name}”`); break;
    }
    case 'archive-one': case 'restore-one': {
      const c = state.commitments.find((x) => x.id === route.id);
      c.archived = act === 'archive-one';
      if (!c.archived) c.order = nextOrder();
      renumber(); save();
      toast(c.archived ? `Archived “${c.name}”` : `Restored “${c.name}”`);
      location.replace(c.archived ? '#/commitments' : `#/c/${c.id}`);
      break;
    }
    case 'delete-one': deleteCommitment(route.id); break;
    case 'addlink': {
      const tpl = document.getElementById('linkRowTpl');
      btn.parentElement.querySelector('.linklist').append(tpl.content.cloneNode(true));
      break;
    }
    case 'rmlink': {
      const list = btn.closest('.linklist');
      btn.closest('.linkrow').remove();
      if (!list.children.length) list.append(document.getElementById('linkRowTpl').content.cloneNode(true));
      break;
    }
    case 'cal-sync': syncAll({ force: true, feedId: btn.dataset.feed }); break;
    case 'cal-remove': removeFeed(btn.dataset.feed); break;
    case 'cal-decide': setDecision(btn.dataset.feed, btn.dataset.uid, btn.dataset.d); break;
    case 'cal-allsched': {
      const feed = state.calendars.feeds.find((f) => f.id === btn.dataset.feed);
      if (!feed) break;
      feed.allSchedule = btn.checked;
      if (calCache[feed.id]) { applyFeed(feed, calCache[feed.id]); save(); render(); }
      else { save(); syncAll({ force: true, feedId: feed.id }); }
      toast(feed.allSchedule ? `${feed.name}: all events are now schedule` : `${feed.name}: events follow each series again`);
      break;
    }
    case 'cal-ask': {
      const feed = state.calendars.feeds.find((f) => f.id === btn.dataset.feed);
      if (feed) { feed.ask = btn.checked; save(); }
      break;
    }
    case 'review-all': document.querySelectorAll('input[name="imp"]').forEach((x) => { x.checked = btn.dataset.on === '1'; }); btn.dataset.on = btn.dataset.on === '1' ? '0' : '1'; break;
    case 'sync-on': case 'sync-now': case 'sync-copy': case 'sync-off': case 'sync-delete': syncAction(act); break;
    case 'widget-on': case 'widget-off': case 'widget-send': case 'widget-reset': case 'widget-copy': widgetAction(act); break;
    case 'export-xlsx': exportXlsx(); break;
    case 'export-json': exportJson(); break;
    case 'import-json': document.getElementById('importFile').click(); break;
  }
});

// Edit form: show/hide fields as frequency, type and unit change.
function syncFollowupForm(form) {
  const fd = new FormData(form);
  form.dataset.tbc = String(fd.get('tbc') === 'on');
  const other = form.querySelector('.stage-other');
  if (other) other.hidden = fd.get('stage') !== 'Other';
}
function syncFormVisibility(form) {
  const fd = new FormData(form);
  form.dataset.freq = fd.get('freq');
  form.dataset.kind = fd.get('kind');
  form.dataset.hourunit = String(isHourUnit(fd.get('unit')));
  form.dataset.tbc = String(fd.get('tbc') === 'on');
}
document.addEventListener('input', (e) => {
  const fu = e.target.closest('form[data-form="followup"]');
  if (fu) syncFollowupForm(fu);
  const form = e.target.closest('form[data-form="commitment"]');
  if (form) syncFormVisibility(form);
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'importFile') {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) importJson(f);
    return;
  }
  const form = e.target.closest('form[data-form="commitment"]');
  if (form) syncFormVisibility(form);
});

document.addEventListener('submit', (e) => {
  const form = e.target.dataset.form;
  if (!form) return;
  e.preventDefault();
  if (form === 'minutes') setMinutes(Math.max(0, Math.round(Number(document.getElementById('minIn').value) || 0)));
  else if (form === 'commitment') saveCommitmentForm(e.target);
  else if (form === 'calendar-add') addFeed(e.target);
  else if (form === 'review') submitReview(e.target);
  else if (form === 'sync-join') joinSync(e.target);
  else if (form === 'followup') saveFollowup(e.target);
  else if (form === 'stage-link') {
    const c = state.commitments.find((x) => x.id === e.target.dataset.id);
    const url = cleanUrl(new FormData(e.target).get('url'));
    if (!c || !url) { toast('Paste a full link (https://…)'); return; }
    c.stageUrl = url; save(); render(); toast('Link saved');
  }
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$sheet.hidden) closeSheet(); });

// Coming back to the app (e.g. next morning): refresh "today", and follow the week
// rollover if you were looking at the old current week.
document.addEventListener('visibilitychange', () => {
  if (!state) return; // still loading saved data
  if (document.visibilityState === 'hidden') {
    flush();
    if (widgetTimer) pushWidget();
    if (state.sync.enabled && Object.keys(state.sync.dirty).length + Object.keys(state.sync.tombs).length) syncNow();
    return;
  }
  const cur = currentWeekKey();
  if (cur !== lastCurrentKey) { if (viewKey === lastCurrentKey) viewKey = cur; lastCurrentKey = cur; }
  if (!sheetCtx && !route.edit) render();
  syncThenCalendars();
  if (swRegistration) swRegistration.update().catch(() => {});
});
window.addEventListener('pagehide', flush);

// ---------- Boot ----------
// Data sync first, so a calendar sync never runs on stale data from this device.
async function syncThenCalendars() {
  if (!state) return;
  if (state.sync.enabled) await syncNow();
  syncAll({ quiet: true });
  refreshApps();
}
let swRegistration = null;
let reloadingForUpdate = false;
(async function init() {
  let loaded, wasV1 = false;
  try {
    loaded = await loadState();
    if (loaded) { wasV1 = (loaded.version || 1) < 2; loaded = migrate(loaded); }
  } catch (e) {
    // Don't overwrite whatever is stored if we couldn't read it.
    console.error(e);
    state = defaultState();
    writeState = async () => {};
    render();
    toast('Could not open saved data — changes will not be kept. Reload the app.');
    return;
  }
  if (loaded) {
    state = loaded;
    if (wasV1) save();
  } else {
    state = defaultState();
    save();
  }
  if (state.sync.enabled) resetRecordHashes();
  render();
  syncThenCalendars();
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, SYNC_POLL_MS);
  setInterval(() => { if (document.visibilityState === 'visible') { syncAll({ quiet: true }); refreshApps(); } }, 5 * 60e3);
  scheduleWidgetPush(1000);
  navigator.storage?.persist?.();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then((reg) => { swRegistration = reg; }).catch((e) => console.warn('SW failed', e));
    // A new version took over: reload once so the page runs it (unless you're in the middle of something).
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloadingForUpdate) return;
      if (route.edit || sheetCtx) { toast('App updated. It will refresh next time you open it.'); return; }
      reloadingForUpdate = true;
      writeState().catch(() => {}).finally(() => location.reload());
    });
  }
})();

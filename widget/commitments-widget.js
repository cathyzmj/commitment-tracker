// Commitments widget for Scriptable (https://scriptable.app)
// Shows today's commitments and this week's hours from your Commitments app.
// Set up from the app: ⋯ → Phone widget → Copy widget script, then paste into a new Scriptable script.
// The key below is private: anyone with it can read your widget summary.

const KEY = '__WIDGET_KEY__';
const ORIGIN = '__ORIGIN__';

const C = {
  bg: Color.dynamic(new Color('#ffffff'), new Color('#1b1f1d')),
  ink: Color.dynamic(new Color('#1b1f1d'), new Color('#eef1ef')),
  muted: Color.dynamic(new Color('#6b716e'), new Color('#9aa29e')),
  accent: Color.dynamic(new Color('#1d7a5f'), new Color('#3cbf94')),
  track: Color.dynamic(new Color('#ecebe6'), new Color('#2a302d')),
};
const DAY = 864e5;
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtH = (x) => `${Math.round(x * 10) / 10}h`;
const startOfToday = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
const mondayOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));

// ---------- Data ----------
const fm = FileManager.local();
const cachePath = fm.joinPath(fm.documentsDirectory(), 'commitments-widget-cache.json');

async function loadData() {
  try {
    const req = new Request(`${ORIGIN}/api/widget`);
    req.headers = { Authorization: `Bearer ${KEY}` };
    req.timeoutInterval = 10;
    const body = await req.loadJSON();
    const status = req.response && req.response.statusCode;
    if (status !== 200) return { error: (body && body.error) || `Couldn't load (${status})` };
    fm.writeString(cachePath, JSON.stringify(body));
    return { data: body };
  } catch (e) {
    // Offline: fall back to the last good copy.
    if (fm.fileExists(cachePath)) return { data: JSON.parse(fm.readString(cachePath)), offline: true };
    return { error: 'No connection' };
  }
}

// Works out today's view from the summary the app sent.
function todayView(data) {
  const today = startOfToday();
  const weekKey = iso(mondayOf(today));
  if (data.week !== weekKey) return { newWeek: true };
  const ti = Math.round((today - new Date(`${weekKey}T00:00:00`)) / DAY);
  const todayIso = iso(today);
  const reached = (n, tg) => (tg > 0 ? n >= tg : n > 0);
  const items = [
    ...data.once.filter((o) => o.date === todayIso).map((o) => ({
      name: o.n, time: o.time, done: !!o.done, label: o.time || '',
    })),
    ...data.daily.map((d) => ({
      name: d.n, done: d.k === 't' ? d.d[ti] > 0 : reached(d.d[ti], d.tg),
      label: d.k === 'c' ? `${Math.round(d.d[ti] * 100) / 100}/${d.tg}` : '',
    })),
  ];
  // Still to do first, then done; keep the app's order within each group.
  items.sort((a, b) => Number(a.done) - Number(b.done));
  const day = data.days[ti] || { done: 0, total: 0, actual: 0, planned: 0 };
  return { items, day, week: data.stats, weekly: data.weekly };
}

// ---------- Drawing helpers ----------
function text(parent, str, size, { bold = false, color = C.ink, lines = 1 } = {}) {
  const t = parent.addText(str);
  t.font = bold ? Font.boldSystemFont(size) : Font.systemFont(size);
  t.textColor = color;
  t.lineLimit = lines;
  t.minimumScaleFactor = 0.7;
  return t;
}
function bar(parent, frac, width, height = 6) {
  const outer = parent.addStack();
  outer.size = new Size(width, height);
  outer.backgroundColor = C.track;
  outer.cornerRadius = height / 2;
  outer.layoutHorizontally();
  const filled = Math.max(0, Math.min(1, frac || 0)) * width;
  if (filled >= 1) {
    const inner = outer.addStack();
    inner.size = new Size(Math.max(height, filled), height);
    inner.backgroundColor = C.accent;
    inner.cornerRadius = height / 2;
  }
  outer.addSpacer();
}
function icon(parent, done, size) {
  const img = parent.addImage(SFSymbol.named(done ? 'checkmark.circle.fill' : 'circle').image);
  img.imageSize = new Size(size, size);
  img.tintColor = done ? C.accent : C.muted;
}
function itemRow(parent, it, size) {
  const row = parent.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  row.spacing = 5;
  icon(row, it.done, size + 1);
  text(row, it.name, size, { color: it.done ? C.muted : C.ink });
  row.addSpacer();
  if (it.label) text(row, it.label, size - 1, { color: C.muted });
}
function updatedLabel(data, offline) {
  const d = new Date(data.updatedAt);
  const sameDay = iso(d) === iso(new Date());
  const when = sameDay ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : d.toLocaleDateString('en-GB', { weekday: 'short' }) + ` ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${offline ? 'Offline · ' : ''}Updated ${when}`;
}
function summaryBlock(parent, v, width) {
  const big = parent.addStack();
  big.layoutHorizontally();
  big.bottomAlignContent();
  text(big, String(v.day.done), 30, { bold: true });
  text(big, `/${v.day.total}`, 16, { bold: true, color: C.muted });
  text(parent, 'done today', 11, { color: C.muted });
  parent.addSpacer(6);
  text(parent, `${fmtH(v.day.actual)} of ${fmtH(v.day.planned)}`, 12, { bold: true });
  parent.addSpacer(3);
  bar(parent, v.day.planned ? v.day.actual / v.day.planned : 0, width);
  parent.addSpacer(6);
  text(parent, `Week ${v.week.pct}% · ${fmtH(v.week.actual)}/${fmtH(v.week.planned)}`, 10, { color: C.muted });
}

// ---------- Layouts ----------
function messageWidget(title, body) {
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  text(w, title, 15, { bold: true, lines: 2 });
  w.addSpacer(4);
  text(w, body, 12, { color: C.muted, lines: 4 });
  return w;
}

function buildWidget(family, data, offline) {
  const v = todayView(data);
  if (v.newWeek) return messageWidget('New week 🎉', 'Open the Commitments app to start this week.');
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.refreshAfterDate = new Date(Date.now() + 15 * 60e3);

  if (family === 'accessoryInline') {
    w.addText(`✓ ${v.day.done}/${v.day.total} today · ${fmtH(v.day.actual)}`);
    return w;
  }
  if (family === 'accessoryCircular') {
    text(w, `${v.day.done}/${v.day.total}`, 16, { bold: true }).centerAlignText();
    text(w, 'today', 9).centerAlignText();
    return w;
  }
  if (family === 'accessoryRectangular') {
    text(w, `Today ${v.day.done}/${v.day.total} · ${fmtH(v.day.actual)}/${fmtH(v.day.planned)}`, 13, { bold: true });
    const next = v.items.find((it) => !it.done);
    text(w, next ? `Next: ${next.name}` : 'All done ✓', 12, { lines: 2 });
    return w;
  }

  w.setPadding(14, 14, 12, 14);
  if (family === 'small') {
    summaryBlock(w, v, 125);
    w.addSpacer();
    text(w, updatedLabel(data, offline), 9, { color: C.muted });
    return w;
  }

  if (family === 'medium') {
    const cols = w.addStack();
    cols.layoutHorizontally();
    const left = cols.addStack();
    left.layoutVertically();
    left.size = new Size(118, 0);
    summaryBlock(left, v, 110);
    left.addSpacer();
    text(left, updatedLabel(data, offline), 9, { color: C.muted });
    cols.addSpacer(12);
    const right = cols.addStack();
    right.layoutVertically();
    right.spacing = 4;
    const max = 6;
    v.items.slice(0, max).forEach((it) => itemRow(right, it, 12));
    if (v.items.length > max) text(right, `+${v.items.length - max} more`, 10, { color: C.muted });
    if (!v.items.length) text(right, 'Nothing planned today', 12, { color: C.muted });
    right.addSpacer();
    return w;
  }

  // large (and extraLarge on iPad)
  const head = w.addStack();
  head.layoutHorizontally();
  const left = head.addStack();
  left.layoutVertically();
  summaryBlock(left, v, 140);
  head.addSpacer();
  text(head, updatedLabel(data, offline), 9, { color: C.muted });
  w.addSpacer(10);
  text(w, 'TODAY', 10, { bold: true, color: C.muted });
  w.addSpacer(4);
  const list = w.addStack();
  list.layoutVertically();
  list.spacing = 5;
  const max = 9;
  v.items.slice(0, max).forEach((it) => itemRow(list, it, 13));
  if (v.items.length > max) text(list, `+${v.items.length - max} more`, 11, { color: C.muted });
  const goals = (v.weekly || []).filter((g) => !g.done).slice(0, 3);
  if (goals.length) {
    w.addSpacer(10);
    text(w, 'THIS WEEK', 10, { bold: true, color: C.muted });
    w.addSpacer(4);
    for (const g of goals) {
      const row = w.addStack();
      row.layoutHorizontally();
      row.centerAlignContent();
      text(row, g.n, 12);
      row.addSpacer();
      text(row, g.k === 'c' ? `${g.c}/${g.tg}${g.u === 'h' ? 'h' : ''}` : '', 11, { color: C.muted });
      if (g.k === 'c') { w.addSpacer(2); bar(w, g.tg ? g.c / g.tg : 0, 300, 4); }
      w.addSpacer(4);
    }
  }
  w.addSpacer();
  return w;
}

// ---------- Run ----------
const family = config.widgetFamily || 'medium';
const { data, error, offline } = await loadData();
const widget = data ? buildWidget(family, data, offline) : messageWidget('Commitments', error);
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();

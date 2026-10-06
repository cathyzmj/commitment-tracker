// Minimal iCalendar (.ics) parser with recurring-event expansion. No dependencies.
// parseIcs(text, { from: Date, to: Date }) -> instances starting in [from, to), sorted by start:
//   { uid, key, summary, location, description, allDay, start, end, date, time, endTime, hours, recurring }
// Supports DTSTART/DTEND/DURATION with TZID, UTC or floating times, all-day events,
// RRULE (DAILY / WEEKLY / MONTHLY / YEARLY with INTERVAL, COUNT, UNTIL, BYDAY, BYMONTHDAY),
// EXDATE, RECURRENCE-ID overrides and STATUS:CANCELLED.
(function (root) {
  const DAY = 864e5;
  const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']; // JS getUTCDay() order
  // Outlook / Exchange feeds use Windows zone names.
  const WINDOWS_TZ = {
    'GMT Standard Time': 'Europe/London', 'Greenwich Standard Time': 'Atlantic/Reykjavik',
    'W. Europe Standard Time': 'Europe/Berlin', 'Romance Standard Time': 'Europe/Paris',
    'Central Europe Standard Time': 'Europe/Budapest', 'Central European Standard Time': 'Europe/Warsaw',
    'China Standard Time': 'Asia/Shanghai', 'Singapore Standard Time': 'Asia/Singapore',
    'Tokyo Standard Time': 'Asia/Tokyo', 'India Standard Time': 'Asia/Kolkata',
    'Eastern Standard Time': 'America/New_York', 'Central Standard Time': 'America/Chicago',
    'Pacific Standard Time': 'America/Los_Angeles', 'UTC': 'UTC', 'Coordinated Universal Time': 'UTC',
  };

  // ---------- Lexing ----------
  const unfold = (text) => text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  function parseLine(line) {
    let i = 0, quoted = false;
    for (; i < line.length; i++) {
      if (line[i] === '"') quoted = !quoted;
      else if (line[i] === ':' && !quoted) break;
    }
    const [name, ...rawParams] = line.slice(0, i).split(';');
    const params = {};
    for (const p of rawParams) {
      const eq = p.indexOf('=');
      if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
    }
    return { name: name.toUpperCase(), params, value: line.slice(i + 1) };
  }
  const unescapeText = (v) => v.replace(/\\([\\;,nN])/g, (_, c) => (c === 'n' || c === 'N' ? '\n' : c));

  // ---------- Time zones ----------
  const validTz = {};
  function normTz(tzid) {
    if (!tzid) return null;
    let t = tzid.replace(/^\/[^/]+\/[^/]+\//, ''); // "/mozilla.org/20070129_1/Europe/London"
    t = WINDOWS_TZ[t] || t;
    if (!(t in validTz)) {
      try { new Intl.DateTimeFormat('en-US', { timeZone: t }); validTz[t] = true; } catch { validTz[t] = false; }
    }
    return validTz[t] ? t : null; // unknown zone: treat as floating (device-local) time
  }
  const fmtCache = {};
  function tzOffsetMs(utcMs, tz) {
    const f = fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }));
    const p = {};
    for (const x of f.formatToParts(new Date(utcMs))) p[x.type] = x.value;
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(utcMs / 1000) * 1000;
  }
  // Wall-clock time in a zone -> UTC milliseconds. tz: 'UTC', an IANA zone, or null (device-local).
  function wallToMs(w, tz) {
    if (tz === 'UTC') return Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
    if (!tz) return new Date(w.y, w.m - 1, w.d, w.h, w.mi, w.s).getTime();
    const guess = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
    const first = guess - tzOffsetMs(guess, tz);
    return guess - tzOffsetMs(first, tz); // second pass settles DST boundaries
  }

  // ---------- Values ----------
  function parseDate(value, params = {}) {
    const v = value.trim();
    let m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
    if (m || params.VALUE === 'DATE') {
      m = m || /^(\d{4})(\d{2})(\d{2})/.exec(v);
      if (!m) return null;
      return { allDay: true, tz: null, wall: { y: +m[1], m: +m[2], d: +m[3], h: 0, mi: 0, s: 0 } };
    }
    m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(v);
    if (!m) return null;
    return {
      allDay: false, tz: m[7] ? 'UTC' : normTz(params.TZID),
      wall: { y: +m[1], m: +m[2], d: +m[3], h: +m[4], mi: +m[5], s: +(m[6] || 0) },
    };
  }
  const dateMs = (dt) => wallToMs(dt.wall, dt.allDay ? null : dt.tz);
  function parseDuration(v) {
    const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim());
    if (!m) return 0;
    const ms = ((+m[2] || 0) * 7 * DAY) + ((+m[3] || 0) * DAY) + ((+m[4] || 0) * 36e5) + ((+m[5] || 0) * 6e4) + ((+m[6] || 0) * 1e3);
    return m[1] === '-' ? -ms : ms;
  }
  function parseRrule(v) {
    const r = {};
    for (const part of v.split(';')) {
      const [k, val] = part.split('=');
      if (k && val != null) r[k.toUpperCase()] = val;
    }
    return {
      freq: (r.FREQ || '').toUpperCase(),
      interval: Math.max(1, parseInt(r.INTERVAL || '1', 10) || 1),
      count: r.COUNT ? parseInt(r.COUNT, 10) : null,
      until: r.UNTIL ? parseDate(r.UNTIL) : null,
      byday: r.BYDAY ? r.BYDAY.split(',').map((s) => {
        const m = /^([+-]?\d+)?(MO|TU|WE|TH|FR|SA|SU)$/i.exec(s.trim());
        return m ? { n: m[1] ? parseInt(m[1], 10) : 0, wd: WEEKDAYS.indexOf(m[2].toUpperCase()) } : null;
      }).filter(Boolean) : null,
      bymonthday: r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number).filter(Boolean) : null,
    };
  }
  // Identifies one occurrence; matches EXDATE / RECURRENCE-ID values for the same instant.
  const instKey = (dt) => (dt.allDay ? `D${dt.wall.y}${String(dt.wall.m).padStart(2, '0')}${String(dt.wall.d).padStart(2, '0')}` : `T${dateMs(dt)}`);

  // ---------- Recurrence ----------
  // Yields wall-clock occurrence dates (keeping DTSTART's time of day) in ascending order, forever;
  // the caller stops on COUNT / UNTIL / window end.
  function* occurrences(start, rule) {
    const startDay = Date.UTC(start.y, start.m - 1, start.d);
    const wall = (ms) => { const d = new Date(ms); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: start.h, mi: start.mi, s: start.s }; };
    const wd = (ms) => new Date(ms).getUTCDay();
    if (rule.freq === 'DAILY') {
      for (let ms = startDay; ; ms += DAY * rule.interval) {
        if (rule.byday && !rule.byday.some((b) => b.wd === wd(ms))) continue;
        yield wall(ms);
      }
    } else if (rule.freq === 'WEEKLY') {
      const offsets = [...new Set((rule.byday ? rule.byday.map((b) => b.wd) : [wd(startDay)]).map((d) => (d + 6) % 7))].sort((a, b) => a - b);
      for (let week = startDay - ((wd(startDay) + 6) % 7) * DAY; ; week += 7 * DAY * rule.interval) {
        for (const o of offsets) if (week + o * DAY >= startDay) yield wall(week + o * DAY);
      }
    } else if (rule.freq === 'MONTHLY') {
      for (let k = 0; ; k += rule.interval) {
        const first = new Date(Date.UTC(start.y, start.m - 1 + k, 1));
        const y = first.getUTCFullYear(), mo = first.getUTCMonth();
        const dim = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
        let days = [];
        if (rule.byday) {
          for (const b of rule.byday) {
            const all = [];
            for (let d = 1; d <= dim; d++) if (new Date(Date.UTC(y, mo, d)).getUTCDay() === b.wd) all.push(d);
            if (b.n > 0) { if (all[b.n - 1]) days.push(all[b.n - 1]); }
            else if (b.n < 0) { if (all[all.length + b.n]) days.push(all[all.length + b.n]); }
            else days.push(...all);
          }
        } else {
          for (const md of rule.bymonthday || [start.d]) {
            const d = md > 0 ? md : dim + md + 1;
            if (d >= 1 && d <= dim) days.push(d);
          }
        }
        for (const d of [...new Set(days)].sort((a, b) => a - b)) {
          const ms = Date.UTC(y, mo, d);
          if (ms >= startDay) yield wall(ms);
        }
      }
    } else if (rule.freq === 'YEARLY') {
      for (let k = 0; ; k += rule.interval) {
        const ms = Date.UTC(start.y + k, start.m - 1, start.d);
        if (new Date(ms).getUTCDate() === start.d) yield wall(ms); // skips 29 Feb in non-leap years
      }
    } else {
      yield { ...start };
    }
  }

  // ---------- Parsing ----------
  function readEvents(text) {
    const events = [];
    let ev = null, depth = 0;
    for (const raw of unfold(text)) {
      if (!raw) continue;
      const { name, params, value } = parseLine(raw);
      if (name === 'BEGIN') {
        if (value.toUpperCase() === 'VEVENT' && !ev) { ev = { exdates: new Set() }; depth = 0; }
        else if (ev) depth++; // e.g. VALARM inside an event
        continue;
      }
      if (name === 'END') {
        if (ev && value.toUpperCase() === 'VEVENT' && depth === 0) { events.push(ev); ev = null; }
        else if (ev) depth--;
        continue;
      }
      if (!ev || depth > 0) continue;
      switch (name) {
        case 'UID': ev.uid = value.trim(); break;
        case 'SUMMARY': ev.summary = unescapeText(value).trim(); break;
        case 'LOCATION': ev.location = unescapeText(value).trim(); break;
        case 'DESCRIPTION': ev.description = unescapeText(value).trim(); break;
        case 'STATUS': ev.status = value.trim().toUpperCase(); break;
        case 'DTSTART': ev.start = parseDate(value, params); break;
        case 'DTEND': ev.end = parseDate(value, params); break;
        case 'DURATION': ev.duration = parseDuration(value); break;
        case 'RRULE': ev.rrule = parseRrule(value); break;
        case 'RECURRENCE-ID': ev.recurrenceId = parseDate(value, params); break;
        case 'EXDATE':
          for (const v of value.split(',')) {
            const d = parseDate(v, params);
            if (d) ev.exdates.add(instKey(d));
          }
          break;
      }
    }
    return events.filter((e) => e.start);
  }

  function durationOf(ev) {
    if (ev.end) {
      const ms = dateMs(ev.end) - dateMs(ev.start);
      return ms > 0 ? ms : ev.start.allDay ? DAY : 0;
    }
    if (ev.duration) return ev.duration;
    return ev.start.allDay ? DAY : 0;
  }

  const pad = (n) => String(n).padStart(2, '0');
  function instance(ev, uid, key, dt, recurring = false) {
    const start = dateMs(dt);
    const end = start + durationOf(ev);
    const s = new Date(start), e = new Date(end);
    return {
      uid, key: `${uid}|${key}`,
      summary: ev.summary || '(No title)', location: ev.location || '', description: ev.description || '',
      allDay: dt.allDay, start, end,
      date: `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`,
      time: dt.allDay ? null : `${pad(s.getHours())}:${pad(s.getMinutes())}`,
      endTime: dt.allDay || end === start ? null : `${pad(e.getHours())}:${pad(e.getMinutes())}`,
      hours: dt.allDay ? 0 : Math.round(((end - start) / 36e5) * 4) / 4,
      recurring, // part of a repeating series (e.g. a weekly lecture)
    };
  }

  function parseIcs(text, { from, to }) {
    const fromMs = +from, toMs = +to;
    const events = readEvents(text);
    const overrides = new Map(); // uid -> Map(originalKey -> override event)
    const masters = [];
    for (const ev of events) {
      ev.uid = ev.uid || `${ev.summary || ''}@${instKey(ev.start)}`;
      if (ev.recurrenceId) {
        if (!overrides.has(ev.uid)) overrides.set(ev.uid, new Map());
        overrides.get(ev.uid).set(instKey(ev.recurrenceId), ev);
      } else {
        masters.push(ev);
      }
    }
    const out = [];
    const inWindow = (ms) => ms >= fromMs && ms < toMs;
    for (const ev of masters) {
      const ovs = overrides.get(ev.uid) || new Map();
      if (!ev.rrule || !ev.rrule.freq) {
        if (ev.status !== 'CANCELLED' && inWindow(dateMs(ev.start))) out.push(instance(ev, ev.uid, instKey(ev.start), ev.start));
        continue;
      }
      const rule = ev.rrule;
      const untilMs = rule.until
        ? (rule.until.allDay ? wallToMs({ ...rule.until.wall, h: 23, mi: 59, s: 59 }, ev.start.allDay ? null : ev.start.tz) : dateMs(rule.until))
        : Infinity;
      let n = 0, guard = 0;
      for (const w of occurrences(ev.start.wall, rule)) {
        if (++guard > 50000) break;
        const dt = { allDay: ev.start.allDay, tz: ev.start.tz, wall: w };
        const ms = dateMs(dt);
        if (ms > untilMs) break;
        if (rule.count && ++n > rule.count) break;
        if (ms >= toMs) break;
        const key = instKey(dt);
        if (ms < fromMs || ev.exdates.has(key) || ovs.has(key) || ev.status === 'CANCELLED') continue;
        out.push(instance(ev, ev.uid, key, dt, true));
      }
    }
    // Moved or edited single occurrences (they may move into or out of the window).
    for (const [uid, ovs] of overrides) {
      const master = masters.find((m) => m.uid === uid);
      for (const [key, ov] of ovs) {
        if (ov.status === 'CANCELLED' || !inWindow(dateMs(ov.start))) continue;
        out.push(instance({ ...master, ...ov, rrule: null }, uid, key, ov.start, !!(master && master.rrule)));
      }
    }
    return out.sort((a, b) => a.start - b.start);
  }

  const api = { parseIcs };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);

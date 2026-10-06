// POST /api/ics  { "url": "<calendar feed URL>" }  ->  the .ics text
// Browsers can't fetch calendar feeds from another site (CORS), so this relays the request.
// It stores nothing and logs nothing: the private feed URL only lives on the phone.
// Any public https host is allowed (school timetables live on all sorts of servers), but
// internal addresses are blocked and only real calendar files are passed back, so this
// can't be used as a general-purpose proxy.
function blockedHost(host) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  return h === 'localhost' || /\.(local|internal|localhost)$/.test(h) || !h.includes('.') ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':'); // IPv4 / IPv6 literals
}
const MAX_BYTES = 5 * 1024 * 1024;

const error = (status, message) => Response.json({ error: message }, { status, headers: { 'cache-control': 'no-store' } });

function allowedUrl(raw) {
  let url;
  try { url = new URL(String(raw || '').trim().replace(/^webcals?:\/\//i, 'https://')); } catch { return null; }
  if (url.protocol !== 'https:' || url.port || url.username || blockedHost(url.hostname)) return null;
  return url;
}

// Google answers 404 for every kind of unusable iCal link; explain the likely cause.
function googleHint(url) {
  const p = decodeURIComponent(url.pathname);
  if (p.includes('@import.calendar.google.com')) return 'Google can’t share a calendar you subscribed to (like a school timetable added by link). Use the original link you subscribed with instead.';
  if (p.endsWith('/public/basic.ics')) return 'That’s the public address, which only works if the calendar is public. Use “Secret address in iCal format” instead (for a calendar you subscribed to, use the original link).';
  return 'Google didn’t recognise that link. Copy “Secret address in iCal format” again. It changes if the secret address was reset.';
}

export async function handle(req, { fetchImpl = fetch } = {}) {
  if (req.method !== 'POST') return error(405, 'Use POST');
  let body;
  try { body = await req.json(); } catch { return error(400, 'Expected JSON body'); }
  const url = allowedUrl(body && body.url);
  if (!url) return error(400, 'That doesn’t look like a calendar link. It should start with https:// or webcal://.');

  let res;
  try {
    res = await fetchImpl(url, { redirect: 'follow', headers: { 'user-agent': 'commitment-tracker/1.0', accept: 'text/calendar,*/*' }, signal: AbortSignal.timeout(15000) });
  } catch {
    return error(502, 'Couldn’t reach the calendar. Check the link and try again.');
  }
  if (!allowedUrl(res.url)) return error(400, 'The calendar link redirected somewhere unexpected.');
  if (res.status === 404 || res.status === 403 || res.status === 401) {
    return error(400, url.hostname === 'calendar.google.com' ? googleHint(url) : 'The calendar refused the link. It may have been reset; copy a fresh one.');
  }
  if (!res.ok) return error(502, `The calendar returned an error (${res.status}).`);
  const text = await res.text();
  if (text.length > MAX_BYTES) return error(413, 'This calendar is too large to import.');
  if (!/BEGIN:VCALENDAR/i.test(text.slice(0, 2000))) return error(400, 'That link doesn’t point to a calendar feed (.ics).');
  return new Response(text, { headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'no-store' } });
}

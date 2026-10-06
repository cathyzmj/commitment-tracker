const assert = require('assert');
const fs = require('fs');
const { parseIcs } = require('../ics.js');
const text = fs.readFileSync(__dirname + '/sample.ics', 'utf8');
const got = parseIcs(text, { from: new Date(2026, 8, 28), to: new Date(2026, 10, 2) }); // 28 Sep – 1 Nov
const rows = got.map((e) => `${e.date} ${e.time || 'all-day'}${e.endTime ? '-' + e.endTime : ''} ${e.hours}h ${e.summary}`);
console.log(rows.join('\n'));
const has = (s) => assert(rows.includes(s), 'missing: ' + s);
// Weekly Mon/Wed, 10:00 local both sides of the 25 Oct DST change
has('2026-09-28 10:00-11:00 1h Statistics Lecture');
has('2026-09-30 10:00-11:00 1h Statistics Lecture');
has('2026-10-26 10:00-11:00 1h Statistics Lecture');
has('2026-10-28 10:00-11:00 1h Statistics Lecture');
assert(!rows.some((r) => r.startsWith('2026-10-07')), 'EXDATE not applied');
has('2026-10-12 14:00-15:00 1h Statistics Lecture (moved)');
assert(!rows.some((r) => r.startsWith('2026-10-12 10:00')), 'overridden instance still present');
assert(!rows.some((r) => r.includes('Cancelled')), 'cancelled event present');
assert(!rows.some((r) => r.includes('alarm')), 'VALARM leaked');
has('2026-10-05 all-day 0h Internship deadline');
has('2026-10-02 10:00-10:45 0.75h Coffee chat with alumni');
assert.equal(got.find((e) => e.uid === 'utc@x').description, 'Prep questions:\n1. Deal flow, sourcing\n2. Day in the life');
assert.equal(got.find((e) => e.uid === 'lecture-stats@uni').location, 'Old Building, OLD.1.07');
assert.equal(rows.filter((r) => r.includes('Morning run')).length, 3);
has('2026-10-01 18:00-19:30 1.5h Club monthly meeting');
assert(!rows.some((r) => r.includes('Club monthly') && r.startsWith('2026-11-05')), 'outside window');
has('2026-10-27 15:30-16:30 1h Office hours (Outlook TZ)');
has('2026-10-02 14:00-14:30 0.5h NY call');
assert(!rows.some((r) => r.includes('Outside window')));
const keys = got.map((e) => e.key);
assert.equal(new Set(keys).size, keys.length, 'duplicate keys');
// Lectures: 5 weeks x 2 days = 10, minus EXDATE = 9 (incl. the moved one)
assert.equal(got.filter((e) => e.uid === 'lecture-stats@uni').length, 9);
assert(got.filter((e) => e.uid === 'lecture-stats@uni').every((e) => e.recurring), 'lectures (incl. moved one) are recurring');
assert(!got.find((e) => e.uid === 'utc@x').recurring, 'single coffee chat is not recurring');
console.log('\nALL ICS TESTS PASSED (' + got.length + ' instances)');

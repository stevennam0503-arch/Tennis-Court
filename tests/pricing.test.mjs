import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tariffRows, getCourtMatrix, getSlotPrice, WEEK_DAYS, STANDARD_TIME_BLOCKS} from '../frontend/src/guest/pricing.mjs';

const court = { id: 'vip', price: 500000 };

test('weekday and weekend tariffs align across half-hour boundaries and base-price gaps', () => {
  const rows = tariffRows(court, [
    { court: 'vip', dayType: 'WEEKDAY', start: 17.5, end: 21, price: 600000 },
    { court: 'vip', dayType: 'WEEKEND', start: 6, end: 23, price: 700000 },
    { court: 'other', dayType: 'WEEKDAY', start: 8, end: 10, price: 1 }
  ]);
  assert.deepEqual(rows, [
    { start: '06:00', end: '17:30', weekday: 500000, weekend: 700000 },
    { start: '17:30', end: '21:00', weekday: 600000, weekend: 700000 },
    { start: '21:00', end: '23:00', weekday: 500000, weekend: 700000 }
  ]);
});

test('a court without special tariffs shows its actual base price on both calendars', () => {
  assert.deepEqual(tariffRows(court, []), [
    { start: '06:00', end: '23:00', weekday: 500000, weekend: 500000 }
  ]);
});

test('getCourtMatrix generates a 6x7 Excel-style matrix with 6 standard time blocks and 7 days', () => {
  const matrix = getCourtMatrix(court, []);
  assert.equal(matrix.length, 6);
  assert.equal(matrix.length, STANDARD_TIME_BLOCKS.length);

  for (const row of matrix) {
    assert.ok(row.time);
    assert.ok(row.label);
    assert.equal(Object.keys(row.days).length, 7);
    for (const day of WEEK_DAYS) {
      assert.ok(row.days[day.key]);
      assert.ok(typeof row.days[day.key].price === 'number');
    }
  }
});

test('getSlotPrice applies 25% automatic flash discount during weekday off-peak (09:00 - 16:00)', () => {
  const testCourt = { id: 'outdoor', price: 140000 };
  const mon = WEEK_DAYS.find(d => d.key === 'mon');
  const sat = WEEK_DAYS.find(d => d.key === 'sat');

  // Mon 10:00 -> 140,000 * 0.75 = 105,000
  const flashPrice = getSlotPrice(testCourt, [], mon, 10);
  assert.equal(flashPrice, 105000);

  // Sat 10:00 -> weekend, no flash discount
  const weekendPrice = getSlotPrice(testCourt, [], sat, 10);
  assert.equal(weekendPrice, 140000);
});

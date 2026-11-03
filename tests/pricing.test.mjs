import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tariffRows, getCourtMatrix, getSlotPrice, WEEK_DAYS} from '../frontend/src/guest/pricing.mjs';

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

test('getCourtMatrix generates a matrix driven by zone prices with 7 days per time block', () => {
  const prices = [
    { court: 'vip', dayType: 'WEEKDAY', start: 6, end: 17, price: 500000 },
    { court: 'vip', dayType: 'WEEKDAY', start: 17, end: 23, price: 600000 },
    { court: 'vip', dayType: 'WEEKEND', start: 6, end: 23, price: 700000 }
  ];
  const matrix = getCourtMatrix(court, prices);
  assert.equal(matrix.length, 2);

  for (const row of matrix) {
    assert.ok(row.time);
    assert.ok(row.label);
    assert.equal(Object.keys(row.days).length, 7);
    for (const day of WEEK_DAYS) {
      assert.ok(row.days[day.key]);
      assert.ok(typeof row.days[day.key].price === 'number');
    }
  }

  // Row 1: 06:00 - 17:00 -> Weekday 500k, Weekend 700k
  assert.equal(matrix[0].days.mon.price, 500000);
  assert.equal(matrix[0].days.sat.price, 700000);

  // Row 2: 17:00 - 23:00 -> Weekday 600k, Weekend 700k
  assert.equal(matrix[1].days.mon.price, 600000);
  assert.equal(matrix[1].days.sat.price, 700000);

  // Fallback when prices is empty: 1 block covering 06:00 - 23:00 with base price
  const emptyMatrix = getCourtMatrix(court, []);
  assert.equal(emptyMatrix.length, 1);
  assert.equal(emptyMatrix[0].days.mon.price, 500000);
  assert.equal(emptyMatrix[0].days.sun.price, 500000);
});

test('getSlotPrice reads rate directly from prices based on dayType and hour without hardcoded formulas', () => {
  const testCourt = { id: 'outdoor', price: 160000 };
  const prices = [
    { court: 'outdoor', dayType: 'WEEKDAY', start: 6, end: 10, price: 160000 },
    { court: 'outdoor', dayType: 'WEEKDAY', start: 10, end: 15, price: 120000 },
    { court: 'outdoor', dayType: 'WEEKDAY', start: 17, end: 22, price: 260000 },
    { court: 'outdoor', dayType: 'WEEKEND', start: 6, end: 17, price: 200000 },
    { court: 'outdoor', dayType: 'WEEKEND', start: 17, end: 22, price: 320000 }
  ];
  const mon = WEEK_DAYS.find(d => d.key === 'mon');
  const sat = WEEK_DAYS.find(d => d.key === 'sat');

  // Mon 10:00 -> 120,000 (weekday 10-15h)
  assert.equal(getSlotPrice(testCourt, prices, mon, 10), 120000);

  // Mon 18:00 -> 260,000 (weekday 17-22h)
  assert.equal(getSlotPrice(testCourt, prices, mon, 18), 260000);

  // Sat 10:00 -> 200,000 (weekend 06-17h)
  assert.equal(getSlotPrice(testCourt, prices, sat, 10), 200000);

  // Sat 18:00 -> 320,000 (weekend 17-22h)
  assert.equal(getSlotPrice(testCourt, prices, sat, 18), 320000);

  // Unconfigured hour (e.g. 22:30 with no match in prices) -> falls back to base price
  assert.equal(getSlotPrice(testCourt, prices, mon, 22.5), 160000);

  // Without prices -> falls back to court base price
  assert.equal(getSlotPrice(testCourt, [], mon, 10), 160000);
});

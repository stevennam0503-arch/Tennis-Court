import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';

const base = process.env.COURTLY_API_URL || 'http://localhost:3000/api';

class Client {
  cookies = new Map();
  csrf = null;
  async call(path, method = 'GET', body, expected = 200) {
    if (!['GET', 'HEAD'].includes(method) && !this.csrf) {
      const r = await this.call('/csrf');
      this.csrf = r;
    }
    const r = await fetch(base + path, {
      method,
      headers: {
        'content-type': 'application/json',
        origin: new URL(base).origin,
        cookie: [...this.cookies].map(([k, v]) => k + '=' + v).join('; '),
        ...(this.csrf ? {[this.csrf.headerName]: this.csrf.token} : {})
      },
      ...(body === undefined ? {} : {body: JSON.stringify(body)})
    });
    for (const raw of r.headers.getSetCookie()) {
      const pair = raw.split(';')[0], index = pair.indexOf('=');
      this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    const text = await r.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = {raw: text.slice(0, 300)}; }
    if (expected !== null) assert.equal(r.status, expected, `${method} ${path}: ${r.status} ${JSON.stringify(data)}`);
    return expected === null ? {status: r.status, body: data} : data;
  }
}

test('Multi-court booking in single order validation', async () => {
  const admin = new Client();
  const alice = new Client();
  const offset = 4;
  const date = new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  const email = `multi-${randomUUID().slice(0, 8)}@example.com`;

  // Register alice
  await alice.call('/auth/register', 'POST', {name: 'Alice Multi', email, password: 'CourtlyCustomer!2026'});

  // Trigger schedule generation via overview
  const overview = await alice.call('/overview?date=' + date);
  const activeCourts = overview.courts.filter(c => c.status === 'ACTIVE');
  assert(activeCourts.length >= 2, 'Need at least 2 active courts');

  const c1 = activeCourts[0].id;
  const c2 = activeCourts[1].id;
  const slot = (courtId, hour) => overview.schedules.find(s => s.court === courtId && s.date === date && s.hour === hour)?.id;
  const isAvailable = (courtId, h) => overview.schedules.some(s => s.court === courtId && s.hour === h && s.status === 'AVAILABLE');

  // Find parallel available hours
  const possibleHours = [9, 10, 11, 13, 14, 15, 16, 17, 21].filter(h =>
    isAvailable(c1, h) && isAvailable(c1, h + 0.5) && isAvailable(c2, h) && isAvailable(c2, h + 0.5)
  );
  assert(possibleHours.length >= 2, 'Need available hours');
  const hParallel = possibleHours[0];

  // 1. Parallel booking: c1 and c2 at the same hour
  const parallelSlots = [slot(c1, hParallel), slot(c1, hParallel + 0.5), slot(c2, hParallel), slot(c2, hParallel + 0.5)].filter(Boolean);
  assert.equal(parallelSlots.length, 4);

  const parallelOrder = await alice.call('/orders', 'POST', {
    requestId: randomUUID(),
    scheduleIds: parallelSlots,
    assignments: []
  });
  assert(parallelOrder.id, 'Parallel order should be created');

  const checkParallel = (await alice.call('/overview?date=' + date)).orders.find(o => o.id === parallelOrder.id);
  assert.equal(checkParallel.slots.length, 4);
  const courtIdsInOrder = new Set(checkParallel.slots.map(s => s.court));
  assert.equal(courtIdsInOrder.size, 2, 'Order must contain 2 distinct courts');

  // 2. Sequential booking: c1 at hSeq and c2 at hSeq + 1 (connected)
  const overview2 = await alice.call('/overview?date=' + date);
  const isAvailable2 = (courtId, h) => overview2.schedules.some(s => s.court === courtId && s.hour === h && s.status === 'AVAILABLE');
  const hSeq = possibleHours.find(h => h !== hParallel && isAvailable2(c1, h) && isAvailable2(c1, h + 0.5) && isAvailable2(c2, h + 1) && isAvailable2(c2, h + 1.5));
  assert(hSeq !== undefined, 'Need available sequential hours');
  const seqSlots = [slot(c1, hSeq), slot(c1, hSeq + 0.5), slot(c2, hSeq + 1), slot(c2, hSeq + 1.5)].filter(Boolean);
  assert.equal(seqSlots.length, 4);

  const seqOrder = await alice.call('/orders', 'POST', {
    requestId: randomUUID(),
    scheduleIds: seqSlots,
    assignments: []
  });
  assert(seqOrder.id, 'Sequential order should be created');

  // 3. Disparate times: c1 morning + c2 evening (gap > 30 mins) -> should reject with 400
  const disparateSlots = [slot(c1, 8), slot(c1, 8.5), slot(c2, 22), slot(c2, 22.5)].filter(Boolean);
  assert.equal(disparateSlots.length, 4);

  const dispRes = await alice.call('/orders', 'POST', {
    requestId: randomUUID(),
    scheduleIds: disparateSlots,
    assignments: []
  }, null);
  assert.equal(dispRes.status, 400);
  assert.match(dispRes.body.message, /cùng khung giờ hoặc nối tiếp nhau/);
});

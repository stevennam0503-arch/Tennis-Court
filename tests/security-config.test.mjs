import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const BASE = process.env.COURTLY_API_URL || 'http://localhost:8081/api';

class Client {
  cookies = new Map();
  csrf = null;

  async call(path, method = 'GET', body, expected = 200) {
    if (!['GET', 'HEAD'].includes(method) && !this.csrf) {
      const r = await this.call('/csrf');
      this.csrf = r;
    }
    const r = await fetch(BASE + path, {
      method,
      headers: {
        'content-type': 'application/json',
        origin: new URL(BASE).origin,
        cookie: [...this.cookies].map(([k, v]) => k + '=' + v).join('; '),
        ...(this.csrf ? { [this.csrf.headerName]: this.csrf.token } : {})
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    for (const raw of r.headers.getSetCookie()) {
      const pair = raw.split(';')[0], idx = pair.indexOf('=');
      this.cookies.set(pair.slice(0, idx), pair.slice(idx + 1));
    }
    const text = await r.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 300) }; }
    if (expected !== null) {
      assert.equal(r.status, expected, `${method} ${path}: ${r.status} ${JSON.stringify(data)}`);
    }
    return expected === null ? { status: r.status, body: data } : data;
  }
}

test('Spring Security authorization enforcement across roles', async () => {
  const anon = new Client();
  const customer = new Client();
  const staff = new Client();
  const admin = new Client();

  // 1. Unauthenticated requests MUST return 401
  await anon.call('/settings', 'PUT', { holdMinutes: 15, depositPercent: 30, cancelRefundPercent: 100 }, 401);
  await anon.call('/catalog/courts', 'POST', { name: 'Unauthorized' }, 401);
  await anon.call('/payments/cash-desk', 'GET', undefined, 401);
  await anon.call('/tournaments/' + randomUUID() + '/draw', 'POST', {}, 401);

  // 2. Register a customer and login
  const custEmail = `cust-${randomUUID().slice(0, 8)}@example.com`;
  const reg = await customer.call('/auth/register', 'POST', {
    name: 'Customer Test',
    email: custEmail,
    password: 'CustomerPass!2026'
  });
  assert.equal(reg.user.role, 'CUSTOMER');

  // Customer calling admin-only endpoints MUST return 403 Forbidden
  await customer.call('/settings', 'PUT', { holdMinutes: 15, depositPercent: 30, cancelRefundPercent: 100 }, 403);
  await customer.call('/catalog/courts', 'POST', { name: 'Unauthorized' }, 403);
  await customer.call('/payments/cash-desk', 'GET', undefined, 403);
  await customer.call('/tournaments/' + randomUUID() + '/draw', 'POST', {}, 403);
  await customer.call('/payments/' + randomUUID() + '/refunds', 'POST', { requestId: randomUUID() }, 403);

  // 3. Login as STAFF
  const staffLog = await staff.call('/auth/login', 'POST', {
    email: 'staff@gmail.com',
    password: '12345'
  });
  assert.equal(staffLog.user.role, 'STAFF');

  // Staff calling admin-only endpoints MUST return 403 Forbidden
  await staff.call('/settings', 'PUT', { holdMinutes: 15, depositPercent: 30, cancelRefundPercent: 100 }, 403);
  await staff.call('/catalog/courts', 'POST', { name: 'Unauthorized' }, 403);
  await staff.call('/tournaments/' + randomUUID() + '/draw', 'POST', {}, 403);
  await staff.call('/payments/' + randomUUID() + '/refunds', 'POST', { requestId: randomUUID() }, 403);

  // BUT Staff calling cashier desk MUST return 200 OK
  const cashDesk = await staff.call('/payments/cash-desk', 'GET');
  assert(Array.isArray(cashDesk));

  // 4. Login as ADMIN
  const adminLog = await admin.call('/auth/login', 'POST', {
    email: 'admin@gmail.com',
    password: '12345'
  });
  assert.equal(adminLog.user.role, 'ADMIN');

  // Admin calling admin endpoints MUST succeed (200 OK)
  await admin.call('/settings', 'PUT', { holdMinutes: 15, depositPercent: 30, cancelRefundPercent: 100 }, 200);

  const adminCashDesk = await admin.call('/payments/cash-desk', 'GET');
  assert(Array.isArray(adminCashDesk));

  const overview = await admin.call('/overview?date=2026-10-30', 'GET');
  assert.equal(overview.viewer.role, 'ADMIN');
});

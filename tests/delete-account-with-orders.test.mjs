import test from 'node:test';
import assert from 'node:assert/strict';

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
    for (const raw of r.headers.getSetCookie?.() || []) {
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

test('Admin can delete account with orders and user can re-register with same email', async () => {
  const testEmail = `test_re_reg_${Date.now()}@gmail.com`;
  const customer = new Client();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  // 1. Register new customer account
  const regRes = await customer.call('/auth/register', 'POST', {
    email: testEmail,
    password: 'password123',
    name: 'Customer With Orders',
    phone: '0987654321'
  });
  assert.equal(regRes.authenticated, true);
  const customerId = regRes.user.accountId;
  console.log(`Registered test customer ${testEmail} with ID ${customerId}`);

  // 2. Fetch available schedules to book for tomorrow
  const overview = await customer.call('/overview?date=' + tomorrow);
  const availableSlot = overview.schedules.find(s => s.status === 'AVAILABLE');
  assert.ok(availableSlot, 'Must find an available slot for tomorrow');

  // 3. Create an order with this customer
  const orderRes = await customer.call('/orders', 'POST', {
    requestId: 'req-' + Date.now(),
    scheduleIds: [availableSlot.id],
    assignments: []
  });
  assert.ok(orderRes.id, 'Order must be created successfully');
  console.log(`Created order ${orderRes.id} for customer ${testEmail}`);

  // 4. Admin logs in
  const admin = new Client();
  const adminLogin = await admin.call('/auth/login', 'POST', {
    email: 'admin@gmail.com',
    password: '12345'
  });
  assert.equal(adminLogin.authenticated, true);
  assert.equal(adminLogin.user.role, 'ADMIN');

  // 5. Admin deletes the customer account (which has an existing order!)
  await admin.call(`/catalog/accounts/${customerId}`, 'DELETE', {});
  console.log(`Admin deleted customer account ${customerId} successfully!`);

  // 6. Verify that the order still exists in overview and is safe
  const adminOverview = await admin.call('/overview?date=' + tomorrow);
  const orderCheck = adminOverview.orders.find(o => o.id === orderRes.id);
  assert.ok(orderCheck, 'Order must still exist in overview');
  assert.equal(orderCheck.name, 'Customer With Orders');
  assert.equal(orderCheck.phone, '0987654321');
  assert.ok(!orderCheck.accountId, 'accountId must be null or omitted');
  console.log(`Order ${orderRes.id} preserved with customer info intact and accountId dissociated!`);

  // 7. Customer re-registers with the EXACT SAME EMAIL
  const newCustomer = new Client();
  const reRegRes = await newCustomer.call('/auth/register', 'POST', {
    email: testEmail,
    password: 'newpassword456',
    name: 'Customer Re-registered',
    phone: '0987654321'
  });
  assert.equal(reRegRes.authenticated, true);
  assert.equal(reRegRes.user.email, testEmail);
  assert.notEqual(reRegRes.user.accountId, customerId);
  console.log(`SUCCESS: Re-registered with same email ${testEmail}! New Account ID: ${reRegRes.user.accountId}`);
});

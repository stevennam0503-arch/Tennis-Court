import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

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

async function waitForBackend() {
  for (let i = 0; i < 30; i++) {
    try {
      const ping = await fetch(BASE + '/auth/session');
      if (ping.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

test('Password persistence across multiple backend restarts', async () => {
  const staffClient = new Client();

  // 1. Initial login with 12345
  const loginRes = await staffClient.call('/auth/login', 'POST', {
    email: 'staff@gmail.com',
    password: '12345'
  });
  assert.equal(loginRes.authenticated, true);
  assert.equal(loginRes.user.email, 'staff@gmail.com');
  assert.equal(loginRes.user.role, 'STAFF');

  // 2. Change password to StaffSecure!2026
  const changeRes = await staffClient.call('/auth/password', 'POST', {
    currentPassword: '12345',
    password: 'StaffSecure!2026',
    confirm: 'StaffSecure!2026'
  });
  assert.equal(changeRes.authenticated, true);

  // 3. Verify old password 12345 is immediately rejected
  const oldLoginClient = new Client();
  const oldLoginRes = await oldLoginClient.call('/auth/login', 'POST', {
    email: 'staff@gmail.com',
    password: '12345'
  }, 400);
  assert.match(oldLoginRes.message, /Email hoặc mật khẩu không đúng/);

  // 4. Verify new password works
  const newLoginClient = new Client();
  const newLoginRes = await newLoginClient.call('/auth/login', 'POST', {
    email: 'staff@gmail.com',
    password: 'StaffSecure!2026'
  });
  assert.equal(newLoginRes.authenticated, true);

  // 5. FIRST RESTART: Restart backend container (simulating server reboot #1)
  console.log('Restarting backend container (Restart 1)...');
  execSync('docker compose restart backend', { stdio: 'inherit' });
  assert.equal(await waitForBackend(), true, 'Backend failed to restart within 30s');

  // 6. Verify old password 12345 is STILL REJECTED after restart 1
  const postRestart1OldClient = new Client();
  const postRestart1OldRes = await postRestart1OldClient.call('/auth/login', 'POST', {
    email: 'staff@gmail.com',
    password: '12345'
  }, 400);
  assert.match(postRestart1OldRes.message, /Email hoặc mật khẩu không đúng/);

  // 7. Verify changed password is STILL ACCEPTED after restart 1!
  const postRestart1NewClient = new Client();
  const postRestart1NewRes = await postRestart1NewClient.call('/auth/login', 'POST', {
    email: 'staff@gmail.com',
    password: 'StaffSecure!2026'
  });
  assert.equal(postRestart1NewRes.authenticated, true);

  // 8. SECOND RESTART: Restart backend container AGAIN (simulating server reboot #2)
  console.log('Restarting backend container (Restart 2)...');
  execSync('docker compose restart backend', { stdio: 'inherit' });
  assert.equal(await waitForBackend(), true, 'Backend failed to restart within 30s on reboot 2');

  // 9. Verify old password is STILL REJECTED and new password STILL WORKS on reboot 2!
  const postRestart2OldClient = new Client();
  await postRestart2OldClient.call('/auth/login', 'POST', {
    email: 'staff@gmail.com',
    password: '12345'
  }, 400);

  const postRestart2NewClient = new Client();
  const postRestart2NewRes = await postRestart2NewClient.call('/auth/login', 'POST', {
    email: 'staff@gmail.com',
    password: 'StaffSecure!2026'
  });
  assert.equal(postRestart2NewRes.authenticated, true);

  // 10. Revert password back to 12345 directly via DB so other test suites stay consistent
  execSync(
    'docker compose exec -T postgres psql -U courtly -d courtly -c ' +
    '"UPDATE accounts SET password_hash = \'$2a$12$Vz8h4kTHkJihfSdtuexqI.kAACu2Pd5TZ/g/tSBOvoqAH9zZqdRpW\' WHERE email = \'staff@gmail.com\';"'
  );

  // Verify revert succeeded
  const revertClient = new Client();
  const revertRes = await revertClient.call('/auth/login', 'POST', {
    email: 'staff@gmail.com',
    password: '12345'
  });
  assert.equal(revertRes.authenticated, true);
});

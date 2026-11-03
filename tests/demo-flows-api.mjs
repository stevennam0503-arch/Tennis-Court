// Kiểm thử 4 luồng demo Hội đồng trên bộ dữ liệu sau "Đặt lại dữ liệu mẫu" (DEMO_MODE=true, PAYMENT_MODE=DEMO).
// Script đặt reset trước khi chạy và reset lại khi xong để database demo sạch. Chỉ chạy trên database demo.
import assert from 'node:assert/strict';
assert.equal(process.env.COURTLY_TEST_WRITE, '1', 'Use the demo database (DEMO_MODE=true); the script resets demo data');
const base = process.env.COURTLY_API_URL || 'http://127.0.0.1:8081/api';

class Client {
  cookies = new Map();
  async call(path, method = 'GET', body) {
    const headers = { 'Content-Type': 'application/json' };
    if (method !== 'GET') { const csrf = await this.call('/csrf'); headers[csrf.data.headerName] = csrf.data.token; }
    headers.Cookie = [...this.cookies].map(([k, v]) => k + '=' + v).join('; ');
    const r = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const c of r.headers.getSetCookie()) { const [k, ...v] = c.split(';')[0].split('='); this.cookies.set(k, v.join('=')); }
    const text = await r.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: r.status, ok: r.ok, data };
  }
  async login(email, ...passwords) {
    let last;
    for (const password of passwords) { last = await this.call('/auth/login', 'POST', { email, password }); if (last.ok) break; }
    return last;
  }
}

const results = [];
const check = (flow, step, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} [L${flow}] ${step}${detail ? ' — ' + detail : ''}`);
};
const msg = r => (r.data && (r.data.message || r.data.error)) || JSON.stringify(r.data).slice(0, 160);
const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const day = new Date(Date.parse(today) + 864e5).toISOString().slice(0, 10);
const tier = h => h >= 24 ? 100 : h >= 12 ? 50 : 0;

const admin = new Client(), staff = new Client(), member = new Client(), fresh = new Client(), guest = new Client();
assert.ok((await admin.login('admin@gmail.com', '123456', '12345')).ok, 'admin login');
assert.ok((await admin.call('/catalog/demo-reset', 'POST', {})).ok, 'demo reset');
check(1, 'Admin đăng nhập', (await admin.login('admin@gmail.com', '123456')).ok);
check(3, 'Staff đăng nhập', (await staff.login('staff@gmail.com', '123456')).ok);
check(2, 'Hội viên Plus đăng nhập', (await member.login('hoangnam@gmail.com', '123456')).ok);

// LUỒNG 1 — mở bán
const ov = (await admin.call(`/overview?date=${day}`)).data;
const courts = ov.courts;
check(1, 'Đủ 10 sân', courts.length === 10, courts.map(c => c.name.replace('Sân ', '')).join(','));
check(1, 'Chính sách giữ chỗ 5 phút, cọc 50%', ov.settings.holdMinutes === 5 && ov.settings.depositPercent === 50);
check(1, 'Gói hội viên', (ov.membershipPlans || []).length > 0, (ov.membershipPlans || []).map(p => `${p.name} ${p.discountPercent}%`).join(', '));
const slotsOf = (court, from, n) => ov.schedules.filter(s => s.court === court.id && s.date === day && s.start >= from && s.status === 'AVAILABLE').sort((a, b) => a.start.localeCompare(b.start)).slice(0, n);
const a02 = courts.find(c => c.name.endsWith('A02'));
const maint = slotsOf(a02, '21:00:00', 1)[0];
const m1 = await admin.call('/catalog/schedules/maintenance', 'POST', { scheduleIds: [maint.id], maintenance: true, reason: 'Kiểm thử bảo trì' });
const seen = (await guest.call(`/public/overview?date=${day}`)).data.schedules.find(s => s.id === maint.id);
check(1, 'Bảo trì slot → khách thấy ngay', m1.ok && seen?.status === 'MAINTENANCE', `slot ${maint.start} → ${seen?.status}`);
await admin.call('/catalog/schedules/maintenance', 'POST', { scheduleIds: [maint.id], maintenance: false, reason: 'Mở lại' });

// LUỒNG 2 — đặt sân, thanh toán
const email = `demo.test.${Date.now()}@example.com`;
const reg = await fresh.call('/auth/register', 'POST', { name: 'Khách Kiểm Thử', email, password: 'Demo@123456', phone: '0901234567' });
check(2, 'Khách mới đăng ký', reg.ok, reg.ok ? '' : msg(reg));
check(2, 'Khách mới đăng nhập', (await fresh.login(email, 'Demo@123456')).ok);
const want = slotsOf(a02, '09:00:00', 2);
const o1 = await fresh.call('/orders', 'POST', { requestId: crypto.randomUUID(), scheduleIds: want.map(s => s.id), name: 'Khách Kiểm Thử', phone: '0901234567' });
const orderId = o1.data?.id;
check(2, 'Tạo đơn giữ chỗ', o1.ok && orderId, o1.ok ? '' : msg(o1));
const o2 = await member.call('/orders', 'POST', { requestId: crypto.randomUUID(), scheduleIds: want.map(s => s.id), name: 'Trần Hoàng Nam', phone: '0912345678' });
check(2, 'Khách thứ 2 đặt trùng slot bị từ chối', !o2.ok, `HTTP ${o2.status}: ${msg(o2)}`);
const findOrder = async c => (await c.call(`/overview?date=${day}`)).data.orders.find(o => o.id === orderId);
let mine = await findOrder(fresh);
const holdMinutes = Math.round((Date.parse(mine?.holdUntil) - Date.now()) / 60000);
check(2, 'HOLDING 5 phút, cọc 50%', mine?.status === 'HOLDING' && holdMinutes <= 5 && Number(mine.deposit) * 2 === Number(mine.total), `tổng ${mine?.total}, cọc ${mine?.deposit}, còn ${holdMinutes} phút`);
const tr = await fresh.call('/transfers', 'POST', { type: 'ORDER', targetId: orderId, purpose: 'DEPOSIT' });
check(2, 'Tạo mã VietQR cọc', tr.ok, tr.ok ? `${tr.data.amount}đ` : msg(tr));
const sb = tr.ok && await fresh.call(`/transfers/${tr.data.id}/sandbox`, 'POST', { scenario: 'SUCCESS' });
mine = await findOrder(fresh);
check(2, 'Thanh toán QR → CONFIRMED', sb?.ok && mine?.status === 'CONFIRMED', mine?.status);
const memb = slotsOf(courts.find(c => c.name.endsWith('B03')), '10:00:00', 2);
const mo = await member.call('/booking/options', 'POST', { scheduleIds: memb.map(s => s.id) });
check(2, 'Hội viên Plus được giảm 15%', mo.ok && mo.data.courtQuote?.discountPercent === 15, mo.ok ? JSON.stringify(mo.data.courtQuote) : msg(mo));

// LUỒNG 3 — phục vụ, chăm sóc
const preview = await fresh.call(`/orders/${orderId}/cancellation-preview`);
check(3, 'Xem trước hủy đúng mốc 3 tầng', preview.ok && preview.data.refundPercent === tier(preview.data.hoursUntilMatch), preview.ok ? `${preview.data.hoursUntilMatch}h → ${preview.data.refundPercent}%` : msg(preview));
const ci = await staff.call(`/orders/${orderId}/check-in`, 'POST', { visitDate: day, reason: 'Kiểm thử check-in sớm có lý do' });
check(3, 'Staff check-in', ci.ok, ci.ok ? '' : msg(ci));
check(3, 'Gia hạn: có phương án', (await staff.call(`/orders/${orderId}/extension-options`)).ok);
mine = await findOrder(staff);
const due = Number(mine.total) - Number(mine.paid);
const pay = await staff.call('/payments', 'POST', { orderId, amount: due, method: 'CASH', transactionCode: 'TEST-' + Date.now(), reason: 'Thu nốt tại quầy' });
check(3, 'Thu tiền mặt phần còn lại', pay.ok, `${due}đ`);
const co = await staff.call(`/orders/${orderId}/check-out`, 'POST', {});
mine = await findOrder(staff);
check(3, 'Check-out → COMPLETED', co.ok && mine?.status === 'COMPLETED', co.ok ? mine?.status : msg(co));
check(3, 'Xuất phiếu thu', (await staff.call(`/orders/${orderId}/invoice`, 'POST', {})).ok);
const fb = await fresh.call('/feedback', 'POST', { requestId: crypto.randomUUID(), rating: 5, topic: 'COURT', message: 'Sân sạch, nhân viên hỗ trợ nhanh. Kiểm thử demo.', publishConsent: true });
check(3, 'Khách gửi feedback', fb.ok, fb.ok ? '' : msg(fb));
const rp = fb.ok && await admin.call(`/content/feedback/${fb.data.id}`, 'PATCH', { status: 'PUBLISHED', reply: 'Cảm ơn bạn!' });
check(3, 'Admin duyệt → feedback công khai', rp?.ok && JSON.stringify((await guest.call('/public/content')).data).includes('Kiểm thử demo'));

// LUỒNG 4 — đối soát, báo cáo
const ps = (await admin.call(`/overview?date=${day}`)).data.payments.filter(p => p.orderId === orderId);
check(4, 'Giao dịch của đơn được ghi nhận đủ', ps.reduce((a, p) => a + Number(p.amount), 0) === Number(mine.total), ps.map(p => `${p.type}/${p.method} ${p.amount}`).join(' + '));
check(4, 'Đối soát ngoại lệ', (await admin.call('/payments/reconciliation')).ok);
check(4, 'Danh sách công nợ quầy', (await admin.call('/payments/cash-desk')).ok);

assert.ok((await admin.call('/catalog/demo-reset', 'POST', {})).ok, 'demo reset after test');
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} PASS (dữ liệu demo đã được reset lại)`);
process.exitCode = passed === results.length ? 0 : 1;

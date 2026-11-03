// Integration test: Single Source of Truth for Zone Pricing (TASK_PRICING_SINGLE_SOURCE.md)
// Yêu cầu: COURTLY_TEST_WRITE=1, tự reset trước và sau, thoát mã khác 0 nếu có lỗi.
import assert from 'node:assert/strict';
import { getCourtMatrix } from '../frontend/src/guest/pricing.mjs';

assert.equal(process.env.COURTLY_TEST_WRITE, '1', 'Use the demo database (DEMO_MODE=true); script resets demo data');
const base = process.env.COURTLY_API_URL || 'http://127.0.0.1:8081/api';

class Client {
  cookies = new Map();
  async call(path, method = 'GET', body) {
    const headers = { 'Content-Type': 'application/json' };
    if (method !== 'GET') {
      const csrf = await this.call('/csrf');
      headers[csrf.data.headerName] = csrf.data.token;
    }
    headers.Cookie = [...this.cookies].map(([k, v]) => k + '=' + v).join('; ');
    const r = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const c of r.headers.getSetCookie()) {
      const [k, ...v] = c.split(';')[0].split('=');
      this.cookies.set(k, v.join('='));
    }
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: r.status, ok: r.ok, data };
  }
  async login(email, ...passwords) {
    let last;
    for (const password of passwords) {
      last = await this.call('/auth/login', 'POST', { email, password });
      if (last.ok) break;
    }
    return last;
  }
}

const results = [];
const check = (step, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${step}${detail ? ' — ' + detail : ''}`);
};
const msg = r => (r.data && (r.data.message || r.data.error)) || JSON.stringify(r.data).slice(0, 160);

const admin = new Client();
const staff = new Client();
const fresh = new Client();

const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const tomorrow = new Date(Date.parse(today) + 864e5).toISOString().slice(0, 10);

// Tìm ngày trong tương lai (>= 40 ngày) rơi vào ngày thường (Thứ 2 - Thứ 6)
let targetFutureDate = new Date(Date.parse(today) + 40 * 864e5);
while (targetFutureDate.getDay() === 0 || targetFutureDate.getDay() === 6) {
  targetFutureDate = new Date(targetFutureDate.getTime() + 864e5);
}
const futureWeekday = targetFutureDate.toISOString().slice(0, 10);

try {
  // BƯỚC 1: RESET DỮ LIỆU VÀ LẤY BASELINE
  assert.ok((await admin.login('admin@gmail.com', '123456')).ok, 'admin login');
  assert.ok((await staff.login('staff@gmail.com', '123456')).ok, 'staff login');
  assert.ok((await admin.call('/catalog/demo-reset', 'POST', {})).ok, 'demo reset trước khi chạy');

  const ovInit = (await admin.call(`/overview?date=${tomorrow}`)).data;
  const a01 = ovInit.courts.find(c => c.name.endsWith('A01'));
  const a02 = ovInit.courts.find(c => c.name.endsWith('A02'));
  assert.ok(a01 && a02, 'Tìm thấy sân A01 và A02');

  // Ghi lại giá slot 18:00 của A01 ngày mai (= X)
  const a01Slot18 = ovInit.schedules.find(s => s.court === a01.id && s.date === tomorrow && s.start === '18:00:00');
  assert.ok(a01Slot18, 'Tìm thấy slot 18:00 của A01 ngày mai');
  const priceX = Number(a01Slot18.price);
  check('Ghi nhận giá slot 18:00 A01 ngày mai', priceX > 0, `Giá X = ${priceX}đ`);

  // Khách đặt 1 slot 10:00 của A02 ngày mai (đơn giá Y)
  const a02Slot10 = ovInit.schedules.find(s => s.court === a02.id && s.date === tomorrow && s.start === '10:00:00');
  assert.ok(a02Slot10, 'Tìm thấy slot 10:00 của A02 ngày mai');
  const priceY = Number(a02Slot10.price);

  const freshEmail = `test.pricing.${Date.now()}@courtly.vn`;
  await fresh.call('/auth/register', 'POST', { name: 'Khách Test Giá', email: freshEmail, password: 'Password@123', phone: '0988776655' });
  await fresh.login(freshEmail, 'Password@123');

  const orderRes = await fresh.call('/orders', 'POST', {
    requestId: crypto.randomUUID(),
    scheduleIds: [a02Slot10.id],
    name: 'Khách Test Giá',
    phone: '0988776655'
  });
  check('Khách đặt 1 slot 10:00 của A02', orderRes.ok && orderRes.data?.id, `Đơn giá Y = ${priceY}đ`);
  const orderId = orderRes.data?.id;

  // BƯỚC 2: ADMIN ĐỔI BẢNG GIÁ KHU OUTDOOR QUA API
  // Đổi khung ngày thường 17–22h thành 300.000đ/h, effectiveFrom = today
  const newTariffRows = [
    { dayType: 'WEEKDAY', start: '06:00', end: '10:00', pricePerHour: 160000 },
    { dayType: 'WEEKDAY', start: '10:00', end: '15:00', pricePerHour: 120000 },
    { dayType: 'WEEKDAY', start: '15:00', end: '17:00', pricePerHour: 180000 },
    { dayType: 'WEEKDAY', start: '17:00', end: '22:00', pricePerHour: 300000 },
    { dayType: 'WEEKDAY', start: '22:00', end: '23:00', pricePerHour: 160000 },
    { dayType: 'WEEKEND', start: '06:00', end: '17:00', pricePerHour: 200000 },
    { dayType: 'WEEKEND', start: '17:00', end: '22:00', pricePerHour: 320000 },
    { dayType: 'WEEKEND', start: '22:00', end: '23:00', pricePerHour: 200000 }
  ];

  const updateRes = await admin.call('/catalog/zones/OUTDOOR/tariff', 'PUT', {
    effectiveFrom: today,
    rows: newTariffRows
  });
  check('Admin PUT /api/catalog/zones/OUTDOOR/tariff', updateRes.ok, `Updated slots = ${updateRes.data?.updatedSlots}`);

  // BƯỚC 3: KIỂM TRA TOÀN BỘ RÀNG BUỘC
  const ovAfter = (await admin.call(`/overview?date=${tomorrow}`)).data;

  // 3.1. court_prices của cả 4 sân A01–A04 có khung mới; sân B, V không đổi
  const outdoorCourts = ovAfter.courts.filter(c => c.type === 'OUTDOOR' && c.status === 'ACTIVE');
  check('Đủ 4 sân OUTDOOR hoạt động', outdoorCourts.length === 4);

  let outdoorPricesMatch = true;
  for (const c of outdoorCourts) {
    const cp = ovAfter.prices.filter(p => p.court === c.id && p.dayType === 'WEEKDAY' && p.start >= 17 && p.end <= 22);
    if (!cp.length || Number(cp[0].price) !== 300000) {
      outdoorPricesMatch = false;
      break;
    }
  }
  check('court_prices của cả 4 sân A01–A04 có khung 17–22h = 300.000', outdoorPricesMatch);

  const indoorCourt = ovAfter.courts.find(c => c.type === 'INDOOR' && c.status === 'ACTIVE');
  const vipCourt = ovAfter.courts.find(c => c.type === 'VIP' && c.status === 'ACTIVE');
  const indoorPrices = ovAfter.prices.filter(p => p.court === indoorCourt?.id);
  const vipPrices = ovAfter.prices.filter(p => p.court === vipCourt?.id);
  check('court_prices của sân Khu B và VIP không bị đổi',
    indoorPrices.every(p => Number(p.price) !== 300000) && vipPrices.every(p => Number(p.price) !== 300000));

  // 3.2. Slot 18:00 còn trống của A01 ngày mai = 150.000 (≠ X); slot cùng giờ ngày +40 = 150.000
  const a01Slot18After = ovAfter.schedules.find(s => s.court === a01.id && s.date === tomorrow && s.start === '18:00:00');
  check('Slot 18:00 trống của A01 ngày mai = 150.000 (≠ X)',
    Number(a01Slot18After?.price) === 150000 && Number(a01Slot18After?.price) !== priceX,
    `Giá cũ X=${priceX}đ -> Giá mới=${a01Slot18After?.price}đ`);

  // Sinh và kiểm tra slot ngày +40
  const ovFuture = (await admin.call(`/overview?date=${futureWeekday}`)).data;
  const futureSlot18 = ovFuture.schedules.find(s => s.court === a01.id && s.date === futureWeekday && s.start === '18:00:00');
  check(`Slot 18:00 A01 ngày tương lai (${futureWeekday}) = 150.000`,
    Number(futureSlot18?.price) === 150000,
    `Giá slot ngày +40=${futureSlot18?.price}đ`);

  // 3.3. Đơn ở bước 1 vẫn đơn giá Y, tổng tiền không đổi
  const orderAfter = ovAfter.orders.find(o => o.id === orderId);
  const bookedSlot = orderAfter?.slots?.[0];
  check('Đơn đã đặt giữ nguyên đơn giá Y và tổng tiền',
    orderAfter && Number(orderAfter.total) === priceY && Number(bookedSlot?.price || bookedSlot?.unitPrice) === priceY,
    `Đơn total=${orderAfter?.total}đ, slot price=${bookedSlot?.price || bookedSlot?.unitPrice}đ`);

  // 3.4. Dữ liệu trang Bảng giá (getCourtMatrix(court, prices)) cho A01 khung 18h ngày thường = 300.000
  const matrix = getCourtMatrix(a01, ovAfter.prices);
  const block18 = matrix.find(b => b.start <= 18 && b.end > 18);
  check('getCourtMatrix(A01) khung 18h ngày thường = 300.000',
    block18 && block18.days.mon.price === 300000,
    `Khung ${block18?.time}: giá Thứ 2 = ${block18?.days?.mon?.price}`);

  // 3.5. STAFF gọi endpoint -> 403 Forbidden
  const staffRes = await staff.call('/catalog/zones/OUTDOOR/tariff', 'PUT', {
    effectiveFrom: today,
    rows: newTariffRows
  });
  check('STAFF gọi endpoint cập nhật bảng giá -> bị từ chối 403', staffRes.status === 403, `HTTP ${staffRes.status}`);

  // 3.6. Bảng giá có khung chồng lấn hoặc không phủ kín 06-23h -> 400 và không thay đổi gì
  const invalidGapRows = [
    { dayType: 'WEEKDAY', start: '07:00', end: '23:00', pricePerHour: 200000 },
    { dayType: 'WEEKEND', start: '06:00', end: '23:00', pricePerHour: 200000 }
  ];
  const gapRes = await admin.call('/catalog/zones/OUTDOOR/tariff', 'PUT', {
    effectiveFrom: today,
    rows: invalidGapRows
  });
  check('Bảng giá thiếu giờ (bắt đầu từ 07:00) -> 400', gapRes.status === 400, `HTTP ${gapRes.status}: ${msg(gapRes)}`);

  const invalidOverlapRows = [
    { dayType: 'WEEKDAY', start: '06:00', end: '14:00', pricePerHour: 200000 },
    { dayType: 'WEEKDAY', start: '12:00', end: '23:00', pricePerHour: 250000 },
    { dayType: 'WEEKEND', start: '06:00', end: '23:00', pricePerHour: 200000 }
  ];
  const overlapRes = await admin.call('/catalog/zones/OUTDOOR/tariff', 'PUT', {
    effectiveFrom: today,
    rows: invalidOverlapRows
  });
  check('Bảng giá chồng lấn khung giờ -> 400', overlapRes.status === 400, `HTTP ${overlapRes.status}: ${msg(overlapRes)}`);

} finally {
  // BƯỚC 4: RESET VỀ LẠI BASELINE
  const cleanupReset = await admin.call('/catalog/demo-reset', 'POST', {});
  check('Reset database về lại baseline sau khi kiểm thử', cleanupReset.ok);

  const ovFinal = (await admin.call(`/overview?date=${tomorrow}`)).data;
  const a01Final = ovFinal.courts.find(c => c.name.endsWith('A01'));
  const a01PricesFinal = ovFinal.prices.filter(p => p.court === a01Final?.id && p.dayType === 'WEEKDAY' && p.start >= 17 && p.end <= 22);
  check('Bảng giá A01 về đúng baseline sau reset (260.000đ/h)',
    Number(a01PricesFinal[0]?.price) === 260000,
    `Giá baseline=${a01PricesFinal[0]?.price}đ`);
}

const failed = results.filter(r => !r).length;
console.log(`\nKết quả kiểm thử Zone Tariff API: ${results.length - failed}/${results.length} checks PASS.`);
if (failed > 0) {
  process.exit(1);
}

// Integration test: Single Source of Truth for Zone Pricing (TASK_PRICING_SINGLE_SOURCE.md & TASK_PRICING_FOLLOWUP.md)
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

const addDays = (baseStr, days) => {
  const d = new Date(Date.parse(baseStr) + days * 864e5);
  return d.toISOString().slice(0, 10);
};

const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const tomorrow = addDays(today, 1);

try {
  // =========================================================================
  // BƯỚC 1: RESET DỮ LIỆU VÀ LẤY BASELINE
  // =========================================================================
  assert.ok((await admin.login('admin@gmail.com', '123456')).ok, 'admin login');
  assert.ok((await staff.login('staff@gmail.com', '123456')).ok, 'staff login');
  assert.ok((await admin.call('/catalog/demo-reset', 'POST', {})).ok, 'demo reset trước khi chạy');

  const ovInit = (await admin.call(`/overview?date=${tomorrow}`)).data;
  const a01 = ovInit.courts.find(c => c.name.endsWith('A01'));
  const a02 = ovInit.courts.find(c => c.name.endsWith('A02'));
  const a03 = ovInit.courts.find(c => c.name.endsWith('A03'));
  const b01 = ovInit.courts.find(c => c.name.endsWith('B01'));
  const b03 = ovInit.courts.find(c => c.name.endsWith('B03'));
  assert.ok(a01 && a02 && a03 && b01 && b03, 'Tìm thấy sân A01, A02, A03, B01, B03');

  // Ghi lại giá slot 18:00 của A01 ngày mai (= X)
  const a01Slot18 = ovInit.schedules.find(s => s.court === a01.id && s.date === tomorrow && s.start === '18:00:00');
  assert.ok(a01Slot18, 'Tìm thấy slot 18:00 của A01 ngày mai');
  const priceX = Number(a01Slot18.price);
  check('Ghi nhận giá slot 18:00 A01 ngày mai', priceX > 0, `Giá X = ${priceX}đ`);

  // Khách đặt 1 slot 10:00 của A03 ngày mai (đơn giá Y)
  const a03Slot10 = ovInit.schedules.find(s => s.court === a03.id && s.date === tomorrow && s.start === '10:00:00');
  assert.ok(a03Slot10, 'Tìm thấy slot 10:00 của A03 ngày mai');
  const priceY = Number(a03Slot10.price);

  const freshEmail = `test.pricing.${Date.now()}@courtly.vn`;
  await fresh.call('/auth/register', 'POST', { name: 'Khách Test Giá', email: freshEmail, password: 'Password@123', phone: '0988776655' });
  await fresh.login(freshEmail, 'Password@123');

  const orderRes = await fresh.call('/orders', 'POST', {
    requestId: crypto.randomUUID(),
    scheduleIds: [a03Slot10.id],
    name: 'Khách Test Giá',
    phone: '0988776655'
  });
  check('Khách đặt 1 slot 10:00 của A03', orderRes.ok && orderRes.data?.id, `Đơn giá Y = ${priceY}đ`);
  const orderId = orderRes.data?.id;

  // =========================================================================
  // BƯỚC 2: VALIDATION GIỜ SAI & NGÀY ÁP DỤNG > 90 NGÀY
  // =========================================================================
  const validBaseRows = [
    { dayType: 'WEEKDAY', start: '06:00', end: '23:00', pricePerHour: 200000 },
    { dayType: 'WEEKEND', start: '06:00', end: '23:00', pricePerHour: 250000 }
  ];

  // Giờ sai: "25:00", "ab:cd", "6h"
  for (const badTime of ['25:00', 'ab:cd', '6h']) {
    const badRows = [
      { dayType: 'WEEKDAY', start: '06:00', end: badTime, pricePerHour: 200000 },
      { dayType: 'WEEKEND', start: '06:00', end: '23:00', pricePerHour: 250000 }
    ];
    const res = await admin.call('/catalog/zones/OUTDOOR/tariff', 'PUT', { effectiveFrom: today, rows: badRows });
    check(`Giờ không hợp lệ ("${badTime}") -> HTTP 400`, res.status === 400, `HTTP ${res.status}: ${msg(res)}`);
  }

  // Ngày áp dụng > 90 ngày
  const over90Date = addDays(today, 91);
  const over90Res = await admin.call('/catalog/zones/OUTDOOR/tariff', 'PUT', { effectiveFrom: over90Date, rows: validBaseRows });
  check('Ngày áp dụng quá 90 ngày -> HTTP 400', over90Res.status === 400, `HTTP ${over90Res.status}: ${msg(over90Res)}`);

  // Bảng giá thiếu giờ hoặc chồng lấn -> 400
  const invalidGapRows = [
    { dayType: 'WEEKDAY', start: '07:00', end: '23:00', pricePerHour: 200000 },
    { dayType: 'WEEKEND', start: '06:00', end: '23:00', pricePerHour: 200000 }
  ];
  const gapRes = await admin.call('/catalog/zones/OUTDOOR/tariff', 'PUT', { effectiveFrom: today, rows: invalidGapRows });
  check('Bảng giá thiếu giờ (bắt đầu từ 07:00) -> 400', gapRes.status === 400, `HTTP ${gapRes.status}: ${msg(gapRes)}`);

  const invalidOverlapRows = [
    { dayType: 'WEEKDAY', start: '06:00', end: '14:00', pricePerHour: 200000 },
    { dayType: 'WEEKDAY', start: '12:00', end: '23:00', pricePerHour: 250000 },
    { dayType: 'WEEKEND', start: '06:00', end: '23:00', pricePerHour: 200000 }
  ];
  const overlapRes = await admin.call('/catalog/zones/OUTDOOR/tariff', 'PUT', { effectiveFrom: today, rows: invalidOverlapRows });
  check('Bảng giá chồng lấn khung giờ -> 400', overlapRes.status === 400, `HTTP ${overlapRes.status}: ${msg(overlapRes)}`);

  // STAFF gọi endpoint -> 403 Forbidden
  const staffRes = await staff.call('/catalog/zones/OUTDOOR/tariff', 'PUT', { effectiveFrom: today, rows: validBaseRows });
  check('STAFF gọi endpoint cập nhật bảng giá -> bị từ chối 403', staffRes.status === 403, `HTTP ${staffRes.status}`);

  // =========================================================================
  // BƯỚC 3: ĐỔI BẢNG GIÁ KHU OUTDOOR TỪ HÔM NAY (17-22h = 300.000)
  // =========================================================================
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
  check('Admin PUT /api/catalog/zones/OUTDOOR/tariff (hôm nay)', updateRes.ok, `Updated slots = ${updateRes.data?.updatedSlots}`);

  const ovAfter = (await admin.call(`/overview?date=${tomorrow}`)).data;

  // court_prices của cả 4 sân A01–A04 có khung mới; sân B, V không đổi
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

  // Slot 18:00 còn trống của A01 ngày mai = 150.000 (≠ X)
  const a01Slot18After = ovAfter.schedules.find(s => s.court === a01.id && s.date === tomorrow && s.start === '18:00:00');
  check('Slot 18:00 trống của A01 ngày mai = 150.000 (≠ X)',
    Number(a01Slot18After?.price) === 150000 && Number(a01Slot18After?.price) !== priceX,
    `Giá cũ X=${priceX}đ -> Giá mới=${a01Slot18After?.price}đ`);

  // Đơn ở bước 1 vẫn đơn giá Y, tổng tiền không đổi
  const orderAfter = ovAfter.orders.find(o => o.id === orderId);
  const bookedSlot = orderAfter?.slots?.[0];
  check('Đơn đã đặt giữ nguyên đơn giá Y và tổng tiền',
    orderAfter && Number(orderAfter.total) === priceY && Number(bookedSlot?.price || bookedSlot?.unitPrice) === priceY,
    `Đơn total=${orderAfter?.total}đ, slot price=${bookedSlot?.price || bookedSlot?.unitPrice}đ`);

  // Dữ liệu trang Bảng giá (getCourtMatrix(court, prices)) cho A01 khung 18h ngày thường = 300.000
  const matrix = getCourtMatrix(a01, ovAfter.prices);
  const block18 = matrix.find(b => b.start <= 18 && b.end > 18);
  check('getCourtMatrix(A01) khung 18h ngày thường = 300.000',
    block18 && block18.days.mon.price === 300000,
    `Khung ${block18?.time}: giá Thứ 2 = ${block18?.days?.mon?.price}`);

  // =========================================================================
  // BƯỚC 4: SÂN BẢO TRÌ (A02 -> MAINTENANCE -> ĐỔI GIÁ KHU -> MỞ LẠI -> SLOT KHỚP A01)
  // =========================================================================
  // Chuyển A02 sang MAINTENANCE
  const maintRes = await admin.call(`/catalog/courts/${a02.id}`, 'PUT', {
    name: a02.name,
    type: a02.type,
    status: 'MAINTENANCE',
    price: a02.price,
    description: a02.description,
    address: a02.address,
    amenities: a02.amenities
  });
  check('Chuyển A02 sang MAINTENANCE', maintRes.ok);

  // Đổi giá khu OUTDOOR với khung 17-22h = 320.000
  const outdoorTariffMaint = newTariffRows.map(r =>
    r.dayType === 'WEEKDAY' && r.start === '17:00' ? { ...r, pricePerHour: 320000 } : r
  );
  await admin.call('/catalog/zones/OUTDOOR/tariff', 'PUT', { effectiveFrom: today, rows: outdoorTariffMaint });

  // Kiểm tra court_prices của A02 (đang MAINTENANCE) nhận giá 320.000
  const ovMaint = (await admin.call(`/overview?date=${tomorrow}`)).data;
  const a02Prices = ovMaint.prices.filter(p => p.court === a02.id && p.dayType === 'WEEKDAY' && p.start >= 17 && p.end <= 22);
  check('court_prices của A02 (đang MAINTENANCE) nhận bảng giá mới (320.000đ/h)',
    a02Prices.length > 0 && Number(a02Prices[0].price) === 320000,
    `Giá A02=${a02Prices[0]?.price}đ`);

  // Mở lại A02 sang ACTIVE
  const reopenA02Res = await admin.call(`/catalog/courts/${a02.id}`, 'PUT', {
    name: a02.name,
    type: a02.type,
    status: 'ACTIVE',
    price: a02.price,
    description: a02.description,
    address: a02.address,
    amenities: a02.amenities
  });
  check('Mở lại A02 sang ACTIVE', reopenA02Res.ok);

  // Slot 18:00 ngày mai của A02 bằng sân A01 (= 160.000)
  const ovA02Reopened = (await admin.call(`/overview?date=${tomorrow}`)).data;
  const a01Slot18Now = ovA02Reopened.schedules.find(s => s.court === a01.id && s.date === tomorrow && s.start === '18:00:00');
  const a02Slot18Now = ovA02Reopened.schedules.find(s => s.court === a02.id && s.date === tomorrow && s.start === '18:00:00');
  check('Slot 18:00 ngày mai của A02 bằng sân A01 (160.000đ)',
    Number(a02Slot18Now?.price) === Number(a01Slot18Now?.price) && Number(a02Slot18Now?.price) === 160000,
    `A01=${a01Slot18Now?.price}đ, A02=${a02Slot18Now?.price}đ`);

  // =========================================================================
  // BƯỚC 5: SÂN NGỪNG KHAI THÁC ĐƯỢC MỞ LẠI (B03 -> NGỪNG -> ĐỔI GIÁ INDOOR -> MỞ LẠI -> KHỚP B01)
  // =========================================================================
  // Ngừng B03 (sau reset B03 không có đơn sắp tới)
  const delB03 = await admin.call(`/catalog/courts/${b03.id}`, 'DELETE');
  check('Ngừng khai thác Sân B03', delB03.ok);

  // Đổi giá khu INDOOR: 17–22h ngày thường thành 380.000đ/h
  const indoorTariffRows = [
    { dayType: 'WEEKDAY', start: '06:00', end: '10:00', pricePerHour: 200000 },
    { dayType: 'WEEKDAY', start: '10:00', end: '15:00', pricePerHour: 180000 },
    { dayType: 'WEEKDAY', start: '15:00', end: '17:00', pricePerHour: 240000 },
    { dayType: 'WEEKDAY', start: '17:00', end: '22:00', pricePerHour: 380000 },
    { dayType: 'WEEKDAY', start: '22:00', end: '23:00', pricePerHour: 200000 },
    { dayType: 'WEEKEND', start: '06:00', end: '17:00', pricePerHour: 280000 },
    { dayType: 'WEEKEND', start: '17:00', end: '22:00', pricePerHour: 420000 },
    { dayType: 'WEEKEND', start: '22:00', end: '23:00', pricePerHour: 280000 }
  ];
  const updateIndoorRes = await admin.call('/catalog/zones/INDOOR/tariff', 'PUT', { effectiveFrom: today, rows: indoorTariffRows });
  check('Admin đổi bảng giá khu INDOOR (17–22h = 380.000đ)', updateIndoorRes.ok);

  // Mở lại B03
  const reopenB03 = await admin.call(`/catalog/courts/${b03.id}`, 'PUT', {
    name: b03.name,
    type: 'INDOOR',
    status: 'ACTIVE',
    price: b03.price,
    description: b03.description,
    address: b03.address,
    amenities: b03.amenities
  });
  check('Mở lại Sân B03', reopenB03.ok);

  // Bảng giá và slot còn trống của B03 bằng B01
  const ovB03 = (await admin.call(`/overview?date=${tomorrow}`)).data;
  const b01Prices = ovB03.prices.filter(p => p.court === b01.id && p.dayType === 'WEEKDAY' && p.start >= 17 && p.end <= 22);
  const b03Prices = ovB03.prices.filter(p => p.court === b03.id && p.dayType === 'WEEKDAY' && p.start >= 17 && p.end <= 22);
  check('Bảng giá của B03 khớp B01 sau khi mở lại (380.000đ/h)',
    b03Prices.length > 0 && Number(b03Prices[0].price) === Number(b01Prices[0].price) && Number(b03Prices[0].price) === 380000,
    `B01=${b01Prices[0]?.price}đ, B03=${b03Prices[0]?.price}đ`);

  const b01Slot18 = ovB03.schedules.find(s => s.court === b01.id && s.date === tomorrow && s.start === '18:00:00');
  const b03Slot18 = ovB03.schedules.find(s => s.court === b03.id && s.date === tomorrow && s.start === '18:00:00');
  check('Slot 18:00 còn trống của B03 bằng B01 (190.000đ)',
    Number(b03Slot18?.price) === Number(b01Slot18?.price) && Number(b03Slot18?.price) === 190000,
    `B01 slot=${b01Slot18?.price}đ, B03 slot=${b03Slot18?.price}đ`);

  // =========================================================================
  // BƯỚC 6: NGÀY ÁP DỤNG TƯƠNG LAI (effectiveFrom = hôm nay + 30)
  // =========================================================================
  // Reset demo để chuẩn bị ca kiểm thử độc lập
  assert.ok((await admin.call('/catalog/demo-reset', 'POST', {})).ok, 'demo reset trước khi test ngày tương lai');

  const effDay30 = addDays(today, 30);
  const day27 = addDays(today, 27);
  const day40 = addDays(today, 40);

  // Đổi giá OUTDOOR với effectiveFrom = hôm nay + 30; khung 17-22h = 360.000 cho cả WEEKDAY và WEEKEND
  const futureTariffRows = [
    { dayType: 'WEEKDAY', start: '06:00', end: '17:00', pricePerHour: 160000 },
    { dayType: 'WEEKDAY', start: '17:00', end: '22:00', pricePerHour: 360000 },
    { dayType: 'WEEKDAY', start: '22:00', end: '23:00', pricePerHour: 160000 },
    { dayType: 'WEEKEND', start: '06:00', end: '17:00', pricePerHour: 200000 },
    { dayType: 'WEEKEND', start: '17:00', end: '22:00', pricePerHour: 360000 },
    { dayType: 'WEEKEND', start: '22:00', end: '23:00', pricePerHour: 200000 }
  ];

  const futureTariffRes = await admin.call('/catalog/zones/OUTDOOR/tariff', 'PUT', {
    effectiveFrom: effDay30,
    rows: futureTariffRows
  });
  check(`Admin đổi bảng giá OUTDOOR áp dụng từ ${effDay30} (+30 ngày)`, futureTariffRes.ok);

  // 1. Slot đã sinh sẵn ngày mai = giá cũ (130.000)
  const ovTomorrowFuture = (await admin.call(`/overview?date=${tomorrow}`)).data;
  const a01TomorrowSlot18 = ovTomorrowFuture.schedules.find(s => s.court === a01.id && s.date === tomorrow && s.start === '18:00:00');
  check('Slot đã sinh sẵn ngày mai vẫn giữ giá cũ (130.000đ)',
    Number(a01TomorrowSlot18?.price) === 130000,
    `Giá ngày mai=${a01TomorrowSlot18?.price}đ`);

  // 2. Slot 18:00 A01 ngày +27 (lần đầu mở) = giá cũ (<= 140.000đ, không bị nhận 180.000đ của giá mới)
  const ovDay27 = (await admin.call(`/overview?date=${day27}`)).data;
  const a01Day27Slot18 = ovDay27.schedules.find(s => s.court === a01.id && s.date === day27 && s.start === '18:00:00');
  check(`Slot 18:00 A01 ngày +27 (${day27}, lần đầu mở) giữ giá cũ`,
    Number(a01Day27Slot18?.price) < 180000 && (Number(a01Day27Slot18?.price) === 130000 || Number(a01Day27Slot18?.price) === 140000),
    `Giá slot ngày +27=${a01Day27Slot18?.price}đ`);

  // 3. Slot 18:00 A01 ngày +30 và ngày +40 = giá mới (180.000đ)
  const ovDay30 = (await admin.call(`/overview?date=${effDay30}`)).data;
  const a01Day30Slot18 = ovDay30.schedules.find(s => s.court === a01.id && s.date === effDay30 && s.start === '18:00:00');
  check(`Slot 18:00 A01 ngày +30 (${effDay30}) = giá mới (180.000đ)`,
    Number(a01Day30Slot18?.price) === 180000,
    `Giá slot ngày +30=${a01Day30Slot18?.price}đ`);

  const ovDay40 = (await admin.call(`/overview?date=${day40}`)).data;
  const a01Day40Slot18 = ovDay40.schedules.find(s => s.court === a01.id && s.date === day40 && s.start === '18:00:00');
  check(`Slot 18:00 A01 ngày +40 (${day40}) = giá mới (180.000đ)`,
    Number(a01Day40Slot18?.price) === 180000,
    `Giá slot ngày +40=${a01Day40Slot18?.price}đ`);

} finally {
  // =========================================================================
  // BƯỚC 7: RESET VỀ LẠI BASELINE
  // =========================================================================
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

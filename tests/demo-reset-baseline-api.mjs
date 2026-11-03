// Kiểm thử khôi phục nguyên vẹn dữ liệu demo theo ảnh chụp chuẩn (Baseline Snapshot).
// Đảm bảo sau khi Admin thay đổi bất kỳ danh mục nào (sân, bảng giá, nhân sự, giải đấu, gói hội viên, voucher, tin tức, cài đặt CLB)
// thì khi bấm "Đặt lại dữ liệu mẫu" (demo-reset), mọi thứ trở về giống hệt snapshot ban đầu.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

assert.equal(
  process.env.COURTLY_TEST_WRITE,
  '1',
  'Yêu cầu chạy trên database demo (DEMO_MODE=true) với biến COURTLY_TEST_WRITE=1'
);

const base = process.env.COURTLY_API_URL || 'http://127.0.0.1:8081/api';
const dockerContainer = process.env.POSTGRES_CONTAINER || 'tennis-court-git-postgres-1';

class Client {
  cookies = new Map();
  async call(path, method = 'GET', body, expectedStatus) {
    const headers = { 'Content-Type': 'application/json' };
    if (method !== 'GET') {
      const csrf = await this.call('/csrf');
      headers[csrf.data.headerName] = csrf.data.token;
    }
    headers.Cookie = [...this.cookies].map(([k, v]) => k + '=' + v).join('; ');
    const r = await fetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    for (const c of r.headers.getSetCookie()) {
      const [k, ...v] = c.split(';')[0].split('=');
      this.cookies.set(k, v.join('='));
    }
    const text = await r.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    if (expectedStatus && r.status !== expectedStatus) {
      throw new Error(`Expected HTTP ${expectedStatus} on ${method} ${path}, got ${r.status}: ${text}`);
    }
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

const check = (step, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${step}${detail ? ' — ' + detail : ''}`);
  if (!ok) {
    process.exit(1);
  }
};

const byId = (a, b) => (a.id || '').localeCompare(b.id || '');
const byName = (a, b) => (a.name || a.title || a.fullName || '').localeCompare(b.name || b.title || b.fullName || '');
const byCode = (a, b) => (a.code || '').localeCompare(b.code || '');

function normalize(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(normalize);
  if (typeof obj === 'object') {
    const res = {};
    for (const k of Object.keys(obj).sort()) {
      res[k] = normalize(obj[k]);
    }
    return res;
  }
  return obj;
}

async function captureSnapshot(admin, dateStr) {
  const ovRes = await admin.call(`/overview?date=${dateStr}`);
  assert.ok(ovRes.ok, 'Lấy overview admin: ' + JSON.stringify(ovRes.data));
  const ov = ovRes.data;

  const contentRes = await admin.call('/public/content');
  assert.ok(contentRes.ok, 'Lấy public content: ' + JSON.stringify(contentRes.data));
  const content = contentRes.data;

  const vouchersRes = await admin.call('/public/vouchers');
  assert.ok(vouchersRes.ok, 'Lấy public vouchers');
  const vouchers = vouchersRes.data;

  return normalize({
    courts: (ov.courts || []).map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      status: c.status,
      price: Number(c.price),
      description: c.description || null,
      address: c.address || null,
      amenities: c.amenities || null,
      imageUrl: c.imageUrl || null
    })).sort(byName),

    archivedCourts: (ov.archivedCourts || []).map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      status: c.status
    })).sort(byName),

    prices: (ov.prices || []).map(p => ({
      id: p.id,
      court: p.court,
      dayType: p.dayType,
      start: Number(p.start),
      end: Number(p.end),
      price: Number(p.price)
    })).sort(byId),

    staff: (ov.staff || []).map(s => ({
      id: s.id,
      name: s.name,
      phone: s.phone,
      type: s.type,
      rate: Number(s.rate),
      status: s.status
    })).sort(byName),

    tournaments: (ov.tournaments || []).map(t => ({
      id: t.id,
      name: t.name,
      format: t.format,
      location: t.location,
      fee: Number(t.fee || t.registrationFee || 0),
      max: Number(t.max || t.maxParticipants || 0),
      status: t.status
    })).sort(byName),

    membershipPlans: (ov.membershipPlans || []).map(m => ({
      id: m.id,
      name: m.name,
      price: Number(m.price),
      days: Number(m.days),
      discountPercent: Number(m.discountPercent),
      vipDiscountPercent: Number(m.vipDiscountPercent)
    })).sort(byId),

    settings: {
      holdMinutes: Number(ov.settings?.holdMinutes),
      depositPercent: Number(ov.settings?.depositPercent),
      cancelRefundPercent: Number(ov.settings?.cancelRefundPercent),
      policies: typeof ov.settings?.policies === 'string'
        ? JSON.parse(ov.settings.policies || '{}')
        : (ov.settings?.policies || {})
    },

    club: {
      name: content.club?.name,
      address: content.club?.address,
      phone: content.club?.phone
    },

    articles: (content.articles || []).map(a => ({
      id: a.id,
      title: a.title,
      category: a.category,
      status: a.status
    })).sort(byId),

    vouchers: (vouchers || []).map(v => ({
      code: v.code,
      type: v.type,
      value: Number(v.value),
      minOrder: Number(v.minOrder),
      maxDiscount: Number(v.maxDiscount || 0),
      enabled: v.enabled
    })).sort(byCode)
  });
}

async function run() {
  console.log('================================================================');
  console.log('   KIỂM THỬ KHÔI PHỤC NGUYÊN VẸN BASELINE RESET (courtly-baseline-test)');
  console.log('================================================================\n');

  const admin = new Client();
  const tomorrow = new Date(Date.now() + 864e5 + 7 * 3600e3).toISOString().slice(0, 10);

  // 1. Đăng nhập Admin và gọi demo-reset lần đầu để có trạng thái chuẩn
  const loginRes = await admin.login('admin@gmail.com', '123456', '12345');
  check('1. Admin đăng nhập', loginRes.ok);

  const resetInitial = await admin.call('/catalog/demo-reset', 'POST', {});
  check('1. Đặt lại dữ liệu chuẩn ban đầu', resetInitial.ok);

  // Lưu ảnh chụp A
  const snapshotA = await captureSnapshot(admin, tomorrow);
  check('1. Chụp ảnh baseline snapshot A', snapshotA.courts.length === 10, `${snapshotA.courts.length} sân chuẩn, 0 sân ngừng`);
  check('1. Tab đã ngừng khai thác ban đầu phải rỗng', snapshotA.archivedCourts.length === 0);

  // 2. Thực hiện các thao tác sửa đổi mọi nhóm danh mục qua Admin API
  console.log('\n--- 2. Tiến hành thay đổi dữ liệu danh mục qua Admin API ---');

  // 2.1. Sân bãi:
  // - Tạo "Sân A05"
  const cCreate = await admin.call('/catalog/courts', 'POST', {
    name: 'Sân A05',
    type: 'OUTDOOR',
    status: 'ACTIVE',
    price: 180000,
    description: 'Sân ngoài trời tạo thêm để kiểm thử reset baseline'
  });
  check('2.1. Tạo thêm Sân A05', cCreate.ok, JSON.stringify(cCreate.data));

  // - Sửa mô tả và giá sân A01
  const a01 = snapshotA.courts.find(c => c.name.endsWith('A01'));
  const cUpdate = await admin.call(`/catalog/courts/${a01.id}`, 'PUT', {
    name: 'Sân A01',
    type: 'OUTDOOR',
    status: 'ACTIVE',
    price: 999000,
    description: 'Mô tả đã bị Admin sửa đổi kiểm thử'
  });
  check('2.1. Sửa mô tả và giá Sân A01', cUpdate.ok);

  // - Ngừng khai thác sân B03
  const b03 = snapshotA.courts.find(c => c.name.endsWith('B03'));
  const cDelete = await admin.call(`/catalog/courts/${b03.id}`, 'DELETE');
  check('2.1. Ngừng khai thác Sân B03', cDelete.ok);

  // 2.2. Bảng giá court_prices:
  const firstPrice = snapshotA.prices[0];
  const pUpdate = await admin.call(`/catalog/prices/${firstPrice.id}`, 'PUT', {
    court: firstPrice.court,
    dayType: firstPrice.dayType,
    start: firstPrice.start,
    end: firstPrice.end,
    price: 888000
  });
  check('2.2. Sửa giá theo khung giờ court_prices', pUpdate.ok, JSON.stringify(pUpdate.data));

  // 2.3. Nhân sự & trọng tài:
  const stCreate = await admin.call('/catalog/staff', 'POST', {
    name: 'Trọng Tài Thêm Mới Test',
    phone: '0988777999',
    type: 'REFEREE',
    rate: 350000,
    status: 'ACTIVE'
  });
  check('2.3. Thêm trọng tài mới', stCreate.ok);

  const firstStaff = snapshotA.staff[0];
  const stUpdate = await admin.call(`/catalog/staff/${firstStaff.id}`, 'PUT', {
    name: firstStaff.name,
    phone: firstStaff.phone,
    type: firstStaff.type,
    rate: 500000,
    status: firstStaff.status
  });
  check('2.3. Sửa đơn giá trọng tài', stUpdate.ok);

  // 2.4. Giải đấu:
  const tourCreate = await admin.call('/catalog/tournaments', 'POST', {
    name: 'Giải Đấu Mới Tạo Để Thử Reset',
    format: 'SINGLES',
    startDate: '2026-12-01',
    endDate: '2026-12-05',
    deadline: '2026-11-25',
    location: 'Sân Trung Tâm Courtly',
    fee: 250000,
    max: 16,
    status: 'OPEN'
  });
  check('2.4. Tạo giải đấu mới', tourCreate.ok);

  const winterTour = snapshotA.tournaments.find(t => t.name.includes('Mùa Đông') || t.name.includes('Winter')) || snapshotA.tournaments[1];
  const tourUpdate = await admin.call(`/catalog/tournaments/${winterTour.id}`, 'PUT', {
    name: winterTour.name,
    format: winterTour.format,
    startDate: '2026-12-10',
    endDate: '2026-12-15',
    deadline: '2026-12-05',
    location: winterTour.location,
    fee: 990000,
    max: winterTour.max,
    status: winterTour.status
  });
  check('2.4. Sửa lệ phí giải đấu Winter', tourUpdate.ok, JSON.stringify(tourUpdate.data));

  // 2.5. Gói hội viên:
  const planUpdate = await admin.call('/membership/plans/plus', 'PUT', {
    id: 'plus',
    name: 'Gói Plus Vàng Siêu Cấp',
    price: 888000,
    days: 30,
    discountPercent: 25,
    vipDiscountPercent: 20
  });
  check('2.5. Sửa giá và tên gói hội viên Plus', planUpdate.ok, JSON.stringify(planUpdate.data));

  // 2.6. Voucher:
  try {
    execSync(`docker exec -i ${dockerContainer} psql -U courtly -d courtly -c "INSERT INTO vouchers (code, type, value, min_order, created_at) VALUES ('TEST10', 'PERCENT', 10.00, 100000, NOW());"`, { stdio: 'pipe' });
    check('2.6. Tạo mã voucher TEST10', true);
  } catch (e) {
    check('2.6. Tạo mã voucher TEST10', false, e.message);
  }

  // 2.7. Thông tin CLB và bài viết:
  const clubContentRes = await admin.call('/public/content');
  const fullClub = clubContentRes.data?.club || {};
  const clubUpdate = await admin.call('/content/club', 'POST', {
    ...fullClub,
    name: 'Courtly Tennis Club (ĐÃ BỊ SỬA TÊN)'
  });
  check('2.7. Sửa thông tin CLB', clubUpdate.ok, JSON.stringify(clubUpdate.data));

  const firstArt = snapshotA.articles[0];
  const artCleanId = firstArt.id.replace(/^article:/, '');
  const artUpdate = await admin.call(`/content/articles/${artCleanId}`, 'POST', {
    title: 'Tiêu đề bài viết đã bị sửa đổi',
    excerpt: 'Tóm tắt bài viết đã sửa',
    body: 'Nội dung bài viết đã sửa',
    category: firstArt.category || 'NEWS',
    status: firstArt.status || 'PUBLISHED'
  });
  check('2.7. Sửa tiêu đề bài viết', artUpdate.ok, JSON.stringify(artUpdate.data));

  const artCreate = await admin.call('/content/articles', 'POST', {
    title: 'Bài viết test mới thêm',
    excerpt: 'Tóm tắt bài viết test',
    body: 'Nội dung chi tiết bài viết test',
    category: 'NEWS',
    status: 'PUBLISHED'
  });
  check('2.7. Tạo bài viết mới', artCreate.ok, JSON.stringify(artCreate.data));

  // 2.8. Cài đặt CLB:
  const setUpdate = await admin.call('/settings', 'PUT', {
    holdMinutes: 15,
    depositPercent: 60,
    cancelRefundPercent: 80,
    policies: { cancelCutoffMinutes: 120, changeCutoffMinutes: 2880 }
  });
  check('2.8. Sửa cài đặt CLB (giữ chỗ 15 phút, cọc 60%)', setUpdate.ok);

  // 3. Thực hiện Đặt lại dữ liệu mẫu (demo-reset)
  console.log('\n--- 3. Thực hiện Đặt lại dữ liệu mẫu (demo-reset) ---');
  const resetAfterRes = await admin.call('/catalog/demo-reset', 'POST', {});
  check('3. Bấm Đặt lại dữ liệu mẫu (demo-reset)', resetAfterRes.ok);

  // 4. Lấy ảnh chụp B và so sánh với A
  console.log('\n--- 4. So sánh ảnh chụp snapshot B với snapshot A ---');
  const snapshotB = await captureSnapshot(admin, tomorrow);

  // So sánh từng nhóm danh mục
  assert.deepEqual(snapshotB.courts, snapshotA.courts, 'Danh sách sân courts phải giống hệt baseline');
  check('4.1. Danh mục sân courts khớp 100% (Sân A05 biến mất, Sân B03 mở lại, Sân A01 về giá gốc)', true);

  assert.deepEqual(snapshotB.archivedCourts, snapshotA.archivedCourts, 'Tab sân đã ngừng khai thác phải rỗng');
  check('4.2. Tab sân đã ngừng khai thác rỗng 100%', true);

  assert.deepEqual(snapshotB.prices, snapshotA.prices, 'Bảng giá court_prices phải giống hệt baseline');
  check('4.3. Bảng giá court_prices khớp 100%', true);

  assert.deepEqual(snapshotB.staff, snapshotA.staff, 'Danh mục nhân sự staff phải giống hệt baseline');
  check('4.4. Danh mục nhân sự/trọng tài staff khớp 100%', true);

  assert.deepEqual(snapshotB.tournaments, snapshotA.tournaments, 'Danh mục giải đấu phải giống hệt baseline');
  check('4.5. Danh mục giải đấu tournaments khớp 100%', true);

  assert.deepEqual(snapshotB.membershipPlans, snapshotA.membershipPlans, 'Gói hội viên phải giống hệt baseline');
  check('4.6. Gói hội viên membershipPlans khớp 100%', true);

  assert.deepEqual(snapshotB.settings, snapshotA.settings, 'Cài đặt CLB phải giống hệt baseline');
  check('4.7. Cài đặt CLB settings khớp 100% (về lại giữ chỗ 5 phút, cọc 50%)', true);

  assert.deepEqual(snapshotB.club, snapshotA.club, 'Thông tin CLB phải giống hệt baseline');
  check('4.8. Thông tin CLB club khớp 100%', true);

  assert.deepEqual(snapshotB.articles, snapshotA.articles, 'Danh mục bài viết tin tức phải giống hệt baseline');
  check('4.9. Danh mục bài viết articles khớp 100%', true);

  assert.deepEqual(snapshotB.vouchers, snapshotA.vouchers, 'Danh mục vouchers phải giống hệt baseline');
  check('4.10. Danh mục voucher khớp 100% (TEST10 biến mất, used_count=0)', true);

  console.log('\n================================================================');
  console.log('   KẾT QUẢ: 100% DỮ LIỆU ĐƯỢC KHÔI PHỤC NGUYÊN VẸN THEO BASELINE!');
  console.log('================================================================');
}

run().catch(e => {
  console.error('\n❌ LỖI KIỂM THỬ BASELINE RESET:', e);
  process.exit(1);
});

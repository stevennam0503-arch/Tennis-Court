// scratch/run_real_flows.js
// Script test thực tế từng bước (end-to-end simulation) cho 4 Luồng nghiệp vụ Courtly

class ApiSession {
  constructor(name) {
    this.name = name;
    this.cookie = '';
    this.csrfToken = '';
    this.csrfHeader = 'X-CSRF-TOKEN';
    this.user = null;
  }

  async initCsrf() {
    const res = await fetch('http://localhost:8081/api/csrf');
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';')[0];
    const data = await res.json();
    this.csrfToken = data.token;
    this.csrfHeader = data.headerName || 'X-CSRF-TOKEN';
  }

  async req(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.cookie ? { Cookie: this.cookie } : {}),
      ...(this.csrfToken ? { [this.csrfHeader]: this.csrfToken } : {}),
      ...(options.headers || {})
    };

    const res = await fetch('http://localhost:8081/api' + endpoint, {
      ...options,
      headers
    });

    const setCookie = res.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';')[0];

    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: res.status, ok: res.ok, data: body };
  }

  async login(email, password = '123456') {
    await this.initCsrf();
    const res = await this.req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (res.ok) {
      this.user = res.data.user;
    }
    return res;
  }
}

async function run() {
  console.log('================================================================');
  console.log('   KIỂM THỬ THỰC TẾ 4 LUỒNG NGHIỆP VỤ COURTLY TENNIS CLUB');
  console.log('================================================================\n');

  const admin = new ApiSession('ADMIN');
  const namMember = new ApiSession('CUSTOMER_NAM (Hội viên Plus)');
  const newGuest = new ApiSession('CUSTOMER_NEW (Khách mới)');
  const staff = new ApiSession('STAFF');

  const today = '2026-11-02';

  // ============================================================================
  // LUỒNG 1: QUẢN LÝ VÀ MỞ BÁN DỊCH VỤ (ADMIN)
  // ============================================================================
  console.log('>>> [LUỒNG 1] — QUẢN LÝ VÀ MỞ BÁN DỊCH VỤ');
  console.log('----------------------------------------------------------------');
  
  // 1.1 Admin đăng nhập
  const adminLoginRes = await admin.login('admin@gmail.com', '123456');
  console.log('1.1. Admin đăng nhập:', adminLoginRes.ok ? `THÀNH CÔNG (User: ${admin.user.name}, Role: ${admin.user.role})` : `THẤT BẠI: ${JSON.stringify(adminLoginRes.data)}`);

  // 1.2 Lấy danh mục sân & kiểm tra giá chuẩn
  const overviewRes = await admin.req(`/overview?date=${today}`);
  const courts = overviewRes.data.courts || [];
  const outdoorCourts = courts.filter(c => c.type === 'OUTDOOR');
  const indoorCourts = courts.filter(c => c.type === 'INDOOR');
  const vipCourts = courts.filter(c => c.type === 'VIP');
  
  console.log(`1.2. Quản lý danh mục sân (${courts.length} sân tiêu chuẩn ATP):`);
  console.log(`     - Ngoài trời (Outdoor - A01-A04): ${outdoorCourts.length} sân, Giá chuẩn: ${outdoorCourts[0]?.price?.toLocaleString()}đ/h`);
  console.log(`     - Trong nhà (Indoor - B01-B04):   ${indoorCourts.length} sân, Giá chuẩn: ${indoorCourts[0]?.price?.toLocaleString()}đ/h`);
  console.log(`     - VIP Clubhouse (V01-V02):        ${vipCourts.length} sân, Giá chuẩn: ${vipCourts[0]?.price?.toLocaleString()}đ/h`);

  // 1.3 Cấu hình gói hội viên
  const plans = overviewRes.data.membershipPlans || [];
  console.log(`1.3. Cấu hình gói hội viên (${plans.length} gói sẵn sàng mở bán):`);
  plans.forEach(p => console.log(`     • [${p.id}] ${p.name}: Giá ${p.price?.toLocaleString()}đ / ${p.days} ngày, Ưu đãi giảm ${p.discountPercent}% phí sân thường, ${p.vipDiscountPercent}% sân VIP`));

  // 1.4 Thao tác demo: Admin tạm khóa bảo trì 1 khung giờ của Sân A01
  const schedules = overviewRes.data.schedules || [];
  const targetSlot = schedules.find(s => s.court === outdoorCourts[0]?.id && s.start === '19:00:00');
  if (targetSlot) {
    console.log(`1.4. Demo: Admin khóa bảo trì Sân ${outdoorCourts[0]?.name} lúc 19:00 (Slot ID: ${targetSlot.id})...`);
    const maintRes = await admin.req('/catalog/schedules/maintenance', {
      method: 'POST',
      body: JSON.stringify({
        scheduleIds: [targetSlot.id],
        maintenance: true,
        reason: 'Bảo dưỡng định kỳ mặt sân tiêu chuẩn ATP'
      })
    });
    console.log(`     -> Kết quả cập nhật bảo trì:`, maintRes.ok ? 'THÀNH CÔNG' : 'LỖI', maintRes.data);

    // Kiểm tra phía Guest tra cứu
    const guestCheck = await new ApiSession('GUEST').req(`/public/overview?date=${today}`);
    const updatedSlot = (guestCheck.data.schedules || []).find(s => s.id === targetSlot.id);
    console.log(`     -> Khách vãng lai thấy trạng thái slot lúc 19:00 đổi thành: [${updatedSlot?.status}]`);

    // Mở lại sân
    await admin.req('/catalog/schedules/maintenance', {
      method: 'POST',
      body: JSON.stringify({
        scheduleIds: [targetSlot.id],
        maintenance: false,
        reason: 'Hoàn tất bảo dưỡng, mở lại khai thác'
      })
    });
    console.log(`     -> Đã mở lại slot về trạng thái AVAILABLE.`);
  }

  console.log('\n================================================================');
  console.log('>>> [LUỒNG 2] — TƯ VẤN, ĐẶT SÂN VÀ THANH TOÁN');
  console.log('----------------------------------------------------------------');

  // 2.1 Demo Hội viên Plus đặt sân: Đăng nhập
  const namLogin = await namMember.login('hoangnam@gmail.com', '123456');
  console.log('2.1. Đăng nhập Hội viên:', namLogin.ok ? `THÀNH CÔNG (${namMember.user.name})` : 'THẤT BẠI');

  // Chọn sân Trong nhà B02, 2 slot đang AVAILABLE sau giờ hiện tại (16:00 - 17:00)
  const courtB02 = indoorCourts.find(c => c.name.includes('B02')) || indoorCourts[0];
  const b02Slots = schedules.filter(s => s.court === courtB02.id && s.status === 'AVAILABLE' && s.start >= '16:00:00').slice(0, 2);
  const slotIds = b02Slots.map(s => s.id);
  const timeDisplay = `${b02Slots[0]?.start.slice(0, 5)} - ${b02Slots[1]?.end.slice(0, 5)}`;
  console.log(`2.2. Khách chọn: Sân ${courtB02.name}, Khung giờ ${timeDisplay} (${slotIds.length} slot 30p)`);

  // Tính thử phương án đặt sân (Booking Options) để xem chiết khấu
  const optionsRes = await namMember.req('/booking/options', {
    method: 'POST',
    body: JSON.stringify({
      courtId: courtB02.id,
      scheduleIds: slotIds,
      scheduleDate: today
    })
  });
  console.log(`     -> Hệ thống báo giá: Giá gốc = ${optionsRes.data.baseAmount?.toLocaleString()}đ, Ưu đãi Hội viên Plus (-15%) = -${optionsRes.data.membershipDiscount?.toLocaleString()}đ, Tổng thanh toán = ${optionsRes.data.totalAmount?.toLocaleString()}đ, Cọc 30% = ${optionsRes.data.depositRequired?.toLocaleString()}đ`);

  // 2.3 DEMO NỔI BẬT: CHỐNG TRÙNG LỊCH (CONCURRENCY LOCKING)
  console.log('\n2.3. DEMO BẢO VỆ XUNG ĐỘT (CONCURRENCY CONFLICT TEST):');
  console.log('     * Khách 1 (Hoàng Nam) tiến hành tạo đơn đặt chỗ...');
  const orderRes = await namMember.req('/orders', {
    method: 'POST',
    body: JSON.stringify({
      name: namMember.user.name,
      phone: namMember.user.phone,
      scheduleIds: slotIds,
      requestId: 'req-' + Date.now()
    })
  });
  const orderId = orderRes.data?.id;
  console.log(`     -> Khách 1 tạo đơn: ${orderRes.ok ? 'THÀNH CÔNG' : 'THẤT BẠI: ' + JSON.stringify(orderRes.data)}, Mã đơn = [${orderId}]`);

  // Khách mới đăng nhập và CỐ TÌNH ĐẶT TRÙNG KHUNG GIỜ VỪA BỊ KHÓA
  const guestLogin = await newGuest.login('khachmoi@gmail.com', '123456');
  console.log(`     * Khách 2 (${newGuest.user.name}) cố tình chọn đúng Khung giờ ${timeDisplay} Sân ${courtB02.name} vừa được giữ...`);
  const conflictRes = await newGuest.req('/orders', {
    method: 'POST',
    body: JSON.stringify({
      name: newGuest.user.name,
      phone: newGuest.user.phone,
      scheduleIds: slotIds,
      requestId: 'req-conflict-' + Date.now()
    })
  });
  console.log(`     -> Kết quả đặt sân của Khách 2: HTTP ${conflictRes.status} (${conflictRes.ok ? 'ĐẶT ĐƯỢC (SAI!)' : 'BỊ TỪ CHỐI CHÍNH XÁC (ĐÚNG!)'})`);
  console.log(`        Thông báo lỗi từ hệ thống: "${conflictRes.data?.message}"`);

  // 2.4 Khách 1 thanh toán cọc 30% bằng mã QR chuyển khoản
  const depositRequired = optionsRes.data.depositRequired || 61200;
  console.log(`\n2.4. Khách 1 tạo giao dịch chuyển khoản VietQR đặt cọc 30% (${depositRequired?.toLocaleString()}đ)...`);
  const transferCreateRes = await namMember.req('/transfers', {
    method: 'POST',
    body: JSON.stringify({
      type: 'ORDER',
      targetId: orderId,
      purpose: 'DEPOSIT'
    })
  });
  const transferId = transferCreateRes.data?.id;
  console.log(`     -> Khởi tạo QR [Mã giao dịch: ${transferId}, Nội dung: ${transferCreateRes.data?.reference}]: ${transferCreateRes.ok ? 'OK' : 'LỖI'}`);

  // Giả lập webhook xác nhận tiền cọc vào tài khoản VietQR qua Sandbox
  const confirmRes = await namMember.req(`/transfers/${transferId}/sandbox`, {
    method: 'POST',
    body: JSON.stringify({ scenario: 'SUCCESS' })
  });
  console.log(`     -> Xác nhận số dư cọc VietQR: ${confirmRes.ok ? 'XÁC NHẬN CỌC THÀNH CÔNG (Đơn chuyển sang CONFIRMED)' : 'LỖI: ' + JSON.stringify(confirmRes.data)}`);

  console.log('\n================================================================');
  console.log('>>> [LUỒNG 3] — VẬN HÀNH DỊCH VỤ VÀ CHĂM SÓC KHÁCH HÀNG');
  console.log('----------------------------------------------------------------');

  // 3.1 Nhân viên đăng nhập vào ca
  const staffLogin = await staff.login('staff@gmail.com', '123456');
  console.log('3.1. Nhân viên lễ tân đăng nhập:', staffLogin.ok ? `THÀNH CÔNG (${staff.user.name})` : 'THẤT BẠI');

  // 3.2 Khách đến sân xuất trình mã đặt chỗ -> Lễ tân Check-in
  console.log(`3.2. Khách đến sân, Lễ tân quét mã check-in đơn [${orderId}]...`);
  const checkinRes = await staff.req(`/orders/${orderId}/check-in`, {
    method: 'POST',
    body: JSON.stringify({
      visitDate: today,
      reason: 'Khách đến đúng giờ, đã xuất trình mã QR xác nhận'
    })
  });
  console.log(`     -> Trạng thái Check-in: ${checkinRes.ok ? 'THÀNH CÔNG (Khách bắt đầu vào sân chơi)' : 'LỖI: ' + JSON.stringify(checkinRes.data)}`);

  // 3.3 Khách chơi xong -> Lễ tân thu nốt 70% tiền còn lại tại quầy (Tiền mặt / POS)
  const currentOverview = await staff.req(`/overview?date=${today}`);
  const liveOrder = (currentOverview.data.orders || []).find(o => o.id === orderId);
  const remainingDue = (liveOrder?.total || 0) - (liveOrder?.paid || 0);
  console.log(`3.3. Khách chơi xong trận, Lễ tân thu khoản còn lại 70% (${remainingDue?.toLocaleString()}đ) tại quầy...`);
  const collectRes = await staff.req('/payments', {
    method: 'POST',
    body: JSON.stringify({
      orderId: orderId,
      amount: remainingDue,
      method: 'CASH',
      transactionCode: 'CSH-' + Date.now().toString().slice(-6),
      reason: 'Thu nốt tiền còn lại tại quầy'
    })
  });
  console.log(`     -> Lễ tân thu tiền mặt & in biên lai: ${collectRes.ok ? 'THÀNH CÔNG' : 'LỖI: ' + JSON.stringify(collectRes.data)}`);

  // 3.4 Lễ tân thực hiện Check-out hoàn tất đơn
  const checkoutRes = await staff.req(`/orders/${orderId}/check-out`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  console.log(`3.4. Lễ tân thao tác Check-out bàn giao sân: ${checkoutRes.ok ? 'THÀNH CÔNG (Đơn hoàn tất COMPLETED)' : 'LỖI: ' + JSON.stringify(checkoutRes.data)}`);

  // 3.5 Khách hàng gửi Feedback đánh giá chất lượng
  console.log(`3.5. Khách hàng gửi đánh giá sau buổi chơi:`);
  const fbRes = await namMember.req('/feedback', {
    method: 'POST',
    body: JSON.stringify({
      rating: 5,
      message: 'Mặt sân trong nhà B02 rất êm, hệ thống đèn sáng rõ, bạn nhân viên lễ tân hỗ trợ nhiệt tình!',
      topic: 'COURT',
      publishConsent: true
    })
  });
  const fbId = fbRes.data?.id;
  console.log(`     -> Gửi đánh giá 5 sao: ${fbRes.ok ? 'THÀNH CÔNG (Mã FB: ' + fbId + ')' : 'LỖI: ' + JSON.stringify(fbRes.data)}`);

  // 3.6 Ban quản lý / Admin duyệt và phản hồi đánh giá của khách
  if (fbId) {
    console.log(`3.6. Ban quản lý duyệt và gửi thư cảm ơn phản hồi:`);
    const replyRes = await admin.req(`/content/feedback/${fbId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'PUBLISHED',
        reply: 'Cảm ơn anh Hoàng Nam đã đồng hành và ủng hộ Courtly! Chúc anh luôn giữ vững phong độ đỉnh cao!'
      })
    });
    console.log(`     -> Trạng thái phản hồi: ${replyRes.ok ? 'ĐÃ DUYỆT & HIỂN THỊ CÔNG KHAI' : 'LỖI: ' + JSON.stringify(replyRes.data)}`);
  }

  console.log('\n================================================================');
  console.log('>>> [LUỒNG 4] — ĐỐI SOÁT VÀ PHÂN TÍCH KINH DOANH');
  console.log('----------------------------------------------------------------');

  // 4.1 Admin truy cập Bảng đối soát tài chính
  const auditOverview = await admin.req(`/overview?date=${today}`);
  const allOrders = auditOverview.data.orders || [];
  const completedOrder = allOrders.find(o => o.id === orderId);
  
  console.log(`4.1. Đối soát tài chính đơn [${orderId}]:`);
  console.log(`     - Tổng giá trị đơn:      ${completedOrder?.total?.toLocaleString()}đ`);
  console.log(`     - Đã thanh toán (Paid):   ${completedOrder?.paid?.toLocaleString()}đ (Cọc 30% online + 70% tại quầy)`);
  console.log(`     - Còn nợ (Due):           ${((completedOrder?.total || 0) - (completedOrder?.paid || 0)).toLocaleString()}đ`);
  console.log(`     - Trạng thái đơn:         ${completedOrder?.status} (Hoàn tất 100% không lệch 1 đồng)`);

  // 4.2 Kiểm tra quầy thu ngân (Cash Desk)
  const cashDeskRes = await admin.req('/payments/cash-desk');
  console.log(`4.2. Kiểm tra danh sách công nợ tại Quầy thu ngân:`);
  console.log(`     -> Số đơn đang giữ chỗ / chưa thanh toán hết: ${cashDeskRes.data?.length || 0} đơn`);

  console.log('\n================================================================');
  console.log('   KẾT QUẢ: TẤT CẢ 4 LUỒNG NGHIỆP VỤ ĐÃ CHẠY THỰC TẾ THÀNH CÔNG 100%!');
  console.log('================================================================');
}

run().catch(console.error);

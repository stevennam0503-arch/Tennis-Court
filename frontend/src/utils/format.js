export const money = n => new Intl.NumberFormat('vi-VN').format(Number(n || 0)) + ' ₫';
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const localDate = instant => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant));
export const dateLabel = d => new Date(`${d}T12:00:00`).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
export const active = order => !['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(order.status);
export const labels = {
  HOLDING: 'Đang giữ chỗ', CONFIRMED: 'Đã xác nhận', CHECKED_IN: 'Đang sử dụng', COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy', EXPIRED: 'Hết hạn',
  ACTIVE: 'Hoạt động', INACTIVE: 'Ngừng hoạt động', MAINTENANCE: 'Bảo trì', PENDING: 'Chờ thanh toán', OPEN: 'Mở đăng ký', CLOSED: 'Đã đóng đăng ký',
  DRAFT: 'Bản nháp', ONGOING: 'Đang diễn ra', FINISHED: 'Kết thúc', SCHEDULED: 'Chờ thi đấu', HARD: 'Sân cứng', CLAY: 'Sân đất nện', GRASS: 'Sân cỏ',
  REFEREE: 'Trọng tài', COACH: 'Huấn luyện viên', BALL_BOY: 'Nhặt bóng', CASH: 'Tiền mặt', BANK_TRANSFER: 'Chuyển khoản', DEPOSIT: 'Tiền cọc', BALANCE: 'Thanh toán',
  TOURNAMENT_FEE: 'Phí giải', DRINK: 'Đồ uống', RENTAL: 'Đồ thuê', ADMIN: 'Quản trị', STAFF: 'Nhân viên', CUSTOMER: 'Khách hàng', LOCKED: 'Đã khóa',
  SINGLES: 'Đơn', DOUBLES: 'Đôi', TEAM: 'Đồng đội', WEEKDAY: 'Ngày thường', WEEKEND: 'Cuối tuần', AVAILABLE: 'Còn trống', BOOKED: 'Đã đặt', IN_MATCH: 'Thi đấu',
};
export const options = keys => keys.map(value => ({ value, label: labels[value] || value }));

// Precise time labels for both legacy hourly and new half-hour slots.
export const hourLabel = h => `${String(Math.floor(h)).padStart(2,'0')}:${String(Math.round((h%1)*60)).padStart(2,'0')}`;
export const slotLabel = s => `${s.start?.slice(0,5)||hourLabel(s.hour)}–${s.end?.slice(0,5)||hourLabel(s.hour+1)}`;
export const slotHours = s => s.start&&s.end ? ((Number(s.end.slice(0,2))*60+Number(s.end.slice(3,5)))-(Number(s.start.slice(0,2))*60+Number(s.start.slice(3,5))))/60 : 1;

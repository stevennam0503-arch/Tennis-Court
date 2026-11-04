// Utility to calculate real-time timing and lifecycle state of an order
export function getOrderTiming(order, currentToday) {
  if (!order) return { state: 'UNKNOWN' };
  const slots = order.slots || [];
  if (!slots.length) return { state: 'UNKNOWN' };

  let maxEnd = '00:00';
  for (const s of slots) {
    const endStr = s.end ? s.end.slice(0, 5) : `${String(Math.floor(s.hour + (s.hours || 1))).padStart(2, '0')}:${String(Math.round(((s.hour + (s.hours || 1)) % 1) * 60)).padStart(2, '0')}`;
    if (endStr > maxEnd) maxEnd = endStr;
  }

  const orderDate = order.date;
  const isPastDay = orderDate < currentToday;
  const isFutureDay = orderDate > currentToday;

  if (isPastDay) {
    return {
      state: 'OVERDUE',
      endTime: maxEnd,
      isOverdue: true,
      diffMinutes: 9999,
      label: `Quá hạn từ ngày ${orderDate.split('-').reverse().join('/')}`
    };
  }

  if (isFutureDay) {
    return {
      state: 'FUTURE',
      endTime: maxEnd,
      isOverdue: false,
      diffMinutes: -9999,
      label: `Lịch ngày ${orderDate.split('-').reverse().join('/')}`
    };
  }

  // Today: Calculate exact difference in minutes between current time and booking end time
  const now = new Date();
  const [endH, endM] = maxEnd.split(':').map(Number);
  const endDateTime = new Date();
  endDateTime.setHours(endH, endM, 0, 0);

  const diffMs = now.getTime() - endDateTime.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < -15) {
    return {
      state: 'PLAYING',
      endTime: maxEnd,
      isOverdue: false,
      diffMinutes,
      label: `Đang chơi (kết thúc ${maxEnd})`
    };
  } else if (diffMinutes >= -15 && diffMinutes <= 0) {
    return {
      state: 'EXPIRING_SOON',
      endTime: maxEnd,
      isOverdue: false,
      diffMinutes,
      remainingMinutes: Math.abs(diffMinutes),
      label: `Sắp hết giờ (còn ${Math.abs(diffMinutes)}p · đến ${maxEnd})`
    };
  } else if (diffMinutes > 0 && diffMinutes <= 15) {
    return {
      state: 'GRACE_PERIOD',
      endTime: maxEnd,
      isOverdue: true,
      diffMinutes,
      graceLeft: 15 - diffMinutes,
      label: `Đến giờ trả sân! Thu tiền & Check-out trong 15p (còn ${15 - diffMinutes}p)`
    };
  } else {
    return {
      state: 'OVERDUE',
      endTime: maxEnd,
      isOverdue: true,
      diffMinutes,
      label: `Quá hạn check-out (+${diffMinutes}p)`
    };
  }
}

/**
 * Kiểm tra xem đơn hàng có phải là nợ quá hạn bị chặn đặt sân hay không.
 * Quy tắc nghiệp vụ (P1-a):
 * - total - paid > 0
 * - Không thuộc trạng thái CANCELLED, EXPIRED, HOLDING
 * - Thỏa một trong hai:
 *   1) status === 'COMPLETED' (đã hoàn tất mà còn thiếu tiền)
 *   2) Thời điểm kết thúc buổi chơi cuối cùng (date + end, giờ VN) đã qua quá 15 phút ân hạn.
 * Đơn CHECKED_IN hoặc CONFIRMED còn trong giờ chơi hoặc chưa tới giờ KHÔNG phải nợ quá hạn.
 */
export function isOverdueDebt(order, today, now) {
  if (!order) return false;
  const total = Number(order.total ?? order.totalAmount ?? 0);
  const paid = Number(order.paid ?? order.paidAmount ?? 0);
  if (total - paid <= 0) return false;

  const status = order.status;
  if (['CANCELLED', 'EXPIRED', 'HOLDING'].includes(status)) return false;
  if (status === 'COMPLETED') return true;

  // Thời điểm hiện tại (Việt Nam UTC+7)
  const currentNow = now ? (now instanceof Date ? now : new Date(now)) : new Date();
  const currentNowMs = currentNow.getTime();

  // Xác định thời điểm kết thúc buổi chơi cuối cùng theo slots
  const slots = order.slots || [];
  let maxSlotEndMs = -Infinity;

  if (slots.length > 0) {
    for (const s of slots) {
      const sDate = s.date || s.scheduleDate || order.date;
      if (!sDate) continue;
      const endStr = s.end
        ? s.end.slice(0, 5)
        : s.endTime
        ? s.endTime.slice(0, 5)
        : s.hour != null
        ? `${String(Math.floor(s.hour + (s.hours || 1))).padStart(2, '0')}:${String(Math.round(((s.hour + (s.hours || 1)) % 1) * 60)).padStart(2, '0')}`
        : '23:00';
      const endMs = new Date(`${sDate}T${endStr.slice(0, 5)}:00+07:00`).getTime();
      if (endMs > maxSlotEndMs) maxSlotEndMs = endMs;
    }
  }

  if (maxSlotEndMs === -Infinity) {
    const oDate = order.date;
    if (!oDate) return false;
    maxSlotEndMs = new Date(`${oDate}T23:00:00+07:00`).getTime();
  }

  // Quá hạn khi thời điểm hiện tại vượt qua thời điểm kết thúc + 15 phút ân hạn
  const graceEndMs = maxSlotEndMs + 15 * 60 * 1000;
  return currentNowMs > graceEndMs;
}

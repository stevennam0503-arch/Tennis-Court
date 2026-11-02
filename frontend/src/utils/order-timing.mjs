// Utility to calculate real-time timing and lifecycle state of an order
export function getOrderTiming(order, currentToday) {
  if (!order) return { state: 'UNKNOWN' };
  const slots = order.slots || [];
  if (!slots.length) return { state: 'UNKNOWN' };

  let maxEnd = '00:00';
  for (const s of slots) {
    const endStr = s.end ? s.end.slice(0, 5) : `${String(Math.floor(s.hour + (s.hours || 1))).padStart(2, '0')}:00`;
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

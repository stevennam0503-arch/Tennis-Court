const stamp = n => `${String(Math.floor(n)).padStart(2, '0')}:${String(Math.round((n % 1) * 60)).padStart(2, '0')}`;

// Segment both calendars at every tariff boundary; gaps use the court's base price.
// Mỗi ô còn mang khung giá thật của loại ngày đó (tier) để giao diện gộp các dòng cùng khung:
// khung 15:00–22:00 ngày thường không bị tách chỉ vì cuối tuần có mốc 17:00.
export function tariffRows(court, prices) {
  const rates = (prices || []).filter(p => p.court === court?.id);
  const boundaries = [...new Set([6, 23, ...rates.flatMap(p => [Number(p.start), Number(p.end)]).filter(n => n > 6 && n < 23)])].sort((a, b) => a - b);
  const rate = (day, start) => rates.find(p => p.dayType === day && Number(p.start) <= start && Number(p.end) > start);
  const tier = (day, start) => {
    const r = rate(day, start);
    if (r) return { key: `${day}-${r.start}-${r.end}`, start: stamp(Number(r.start)), end: stamp(Number(r.end)), price: r.price ?? court?.price };
    return { key: `${day}-base-${start}`, start: stamp(start), end: null, price: court?.price };
  };
  return boundaries.slice(0, -1).map((start, i) => {
    const weekdayTier = tier('WEEKDAY', start), weekendTier = tier('WEEKEND', start);
    if (!weekdayTier.end) weekdayTier.end = stamp(boundaries[i + 1]);
    if (!weekendTier.end) weekendTier.end = stamp(boundaries[i + 1]);
    return {
      start: stamp(start),
      end: stamp(boundaries[i + 1]),
      weekday: weekdayTier.price,
      weekend: weekendTier.price,
      weekdayTier,
      weekendTier
    };
  });
}

// Số dòng mỗi ô cần gộp theo cột ngày: 0 = ô bị gộp vào ô phía trên (không vẽ).
export function rowSpans(matrix, dayKey) {
  const spans = matrix.map(() => 1);
  for (let i = 0; i < matrix.length; i++) {
    if (!spans[i]) continue;
    let j = i + 1;
    while (j < matrix.length && matrix[j].days[dayKey]?.tierKey === matrix[i].days[dayKey]?.tierKey) { spans[i]++; spans[j] = 0; j++; }
  }
  return spans;
}

export const WEEK_DAYS = [
  { key: 'mon', dayNum: 1, label: 'Thứ 2', short: 'Mon', dayType: 'WEEKDAY' },
  { key: 'tue', dayNum: 2, label: 'Thứ 3', short: 'Tue', dayType: 'WEEKDAY' },
  { key: 'wed', dayNum: 3, label: 'Thứ 4', short: 'Wed', dayType: 'WEEKDAY' },
  { key: 'thu', dayNum: 4, label: 'Thứ 5', short: 'Thu', dayType: 'WEEKDAY' },
  { key: 'fri', dayNum: 5, label: 'Thứ 6', short: 'Fri', dayType: 'WEEKDAY' },
  { key: 'sat', dayNum: 6, label: 'Thứ 7', short: 'Sat', dayType: 'WEEKEND' },
  { key: 'sun', dayNum: 7, label: 'Chủ Nhật', short: 'Sun', dayType: 'WEEKEND' }
];

export const STANDARD_TIME_BLOCKS = [
  { start: 6, end: 9, time: '06:00 – 09:00', label: 'Sáng sớm', type: 'normal' },
  { start: 9, end: 13, time: '09:00 – 13:00', label: 'Buổi sáng / Trưa', type: 'normal' },
  { start: 13, end: 16, time: '13:00 – 16:00', label: 'Buổi chiều', type: 'normal' },
  { start: 16, end: 18, time: '16:00 – 18:00', label: 'Chiều mát', type: 'peak' },
  { start: 18, end: 21, time: '18:00 – 21:00', label: 'Cao điểm đèn', type: 'peak' },
  { start: 21, end: 23, time: '21:00 – 23:00', label: 'Đêm muộn', type: 'normal' }
];

export function getSlotPrice(court, prices, dayObj, startHour) {
  if (!court) return 140000;
  const isWeekend = typeof dayObj === 'string'
    ? dayObj === 'WEEKEND'
    : (dayObj?.dayType === 'WEEKEND' || dayObj?.dayNum === 6 || dayObj?.dayNum === 7);
  const dayType = isWeekend ? 'WEEKEND' : 'WEEKDAY';
  const hour = typeof startHour === 'string'
    ? parseFloat(startHour.split(':')[0]) + (parseFloat(startHour.split(':')[1] || 0) / 60)
    : Number(startHour);

  const rates = (prices || []).filter(p => p.court === court.id);
  const match = rates.find(p => p.dayType === dayType && Number(p.start) <= hour && Number(p.end) > hour);
  if (match && match.price != null) {
    return Number(match.price);
  }
  return Number(court.price || court.basePrice || 140000);
}

function getTimeBlockLabel(startH, endH) {
  if (startH < 9) return 'Sáng sớm';
  if (startH < 13) return 'Buổi sáng / Trưa';
  if (startH < 17) return 'Buổi chiều';
  if (startH < 21) return 'Cao điểm tối';
  return 'Đêm muộn';
}

export function getCourtMatrix(court, prices) {
  const rows = tariffRows(court, prices);
  return rows.map(r => {
    const [startH] = r.start.split(':').map(Number);
    const [endH] = r.end.split(':').map(Number);
    const label = getTimeBlockLabel(startH, endH);
    const days = {};
    WEEK_DAYS.forEach(d => {
      const isWeekend = d.dayType === 'WEEKEND';
      const p = isWeekend ? r.weekend : r.weekday;
      const tier = isWeekend ? r.weekendTier : r.weekdayTier;
      const tierStartH = Number(tier.start.slice(0, 2));
      const type = isWeekend ? 'weekend' : (tierStartH >= 17 ? 'peak' : 'normal');
      days[d.key] = {
        price: p,
        type,
        dayLabel: d.label,
        tierKey: tier.key,
        time: `${tier.start} – ${tier.end}`
      };
    });
    return {
      start: startH,
      end: endH,
      time: `${r.start} – ${r.end}`,
      label,
      days
    };
  });
}

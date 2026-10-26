const stamp=n=>`${String(Math.floor(n)).padStart(2,'0')}:${String(Math.round((n%1)*60)).padStart(2,'0')}`;
// Segment both calendars at every tariff boundary; gaps use the court's base price.
export function tariffRows(court,prices){
 const rates=prices.filter(p=>p.court===court.id);
 const boundaries=[...new Set([6,23,...rates.flatMap(p=>[Number(p.start),Number(p.end)]).filter(n=>n>6&&n<23)])].sort((a,b)=>a-b);
 const price=(day,start)=>rates.find(p=>p.dayType===day&&Number(p.start)<=start&&Number(p.end)>start)?.price??court.price;
 return boundaries.slice(0,-1).map((start,i)=>({start:stamp(start),end:stamp(boundaries[i+1]),weekday:price('WEEKDAY',start),weekend:price('WEEKEND',start)}));
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
  { start: 9, end: 13, time: '09:00 – 13:00', label: 'Giờ vàng trưa', type: 'flash', discountPercent: 25 },
  { start: 13, end: 16, time: '13:00 – 16:00', label: 'Giờ vàng chiều', type: 'flash', discountPercent: 25 },
  { start: 16, end: 18, time: '16:00 – 18:00', label: 'Chiều mát', type: 'peak' },
  { start: 18, end: 21, time: '18:00 – 21:00', label: 'Cao điểm đèn', type: 'peak' },
  { start: 21, end: 23, time: '21:00 – 23:00', label: 'Đêm muộn', type: 'normal' }
];

export function getSlotPrice(court, prices, dayObj, startHour) {
  if (!court) return 140000;
  const rates = (prices || []).filter(p => p.court === court.id);
  const matched = rates.find(p =>
    (p.dayType === dayObj.dayType || p.dayType === dayObj.key.toUpperCase()) &&
    Number(p.start) <= startHour && Number(p.end) > startHour
  );
  let basePrice = matched ? Number(matched.price) : Number(court.price || court.basePrice || 140000);

  // Apply automatic flash sale discount (-25%) for weekday off-peak slots (09:00 - 16:00)
  if (dayObj.dayType === 'WEEKDAY' && startHour >= 9 && startHour < 16 && !matched) {
    basePrice = Math.round((basePrice * 0.75) / 1000) * 1000;
  } else if (dayObj.key === 'fri' && startHour >= 18 && startHour < 21 && !matched) {
    // Friday peak session
    basePrice = Math.round((basePrice * 1.08) / 1000) * 1000;
  }
  return basePrice;
}

export function getCourtMatrix(court, prices) {
  return STANDARD_TIME_BLOCKS.map(block => {
    const days = {};
    WEEK_DAYS.forEach(d => {
      const p = getSlotPrice(court, prices, d, block.start);
      days[d.key] = {
        price: p,
        type: d.dayType === 'WEEKEND' ? 'weekend' : block.type,
        dayLabel: d.label
      };
    });
    return {
      ...block,
      days
    };
  });
}

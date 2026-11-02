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
  
  // Base price defined on court (e.g., 160.000đ for outdoor, 240.000đ for indoor, 400.000đ for VIP)
  const basePrice = Number(court.price || court.basePrice || 140000);
  const isWeekend = dayObj.dayType === 'WEEKEND';

  // 1. Weekend Pricing Rules (Thứ 7 & Chủ Nhật)
  if (isWeekend) {
    if (startHour >= 18 && startHour < 23) {
      // Weekend Night Peak (Đèn cao áp cuối tuần đông khách nhất): +50%
      return Math.round((basePrice * 1.5) / 1000) * 1000;
    }
    // Weekend Day (06:00 - 18:00): +25%
    return Math.round((basePrice * 1.25) / 1000) * 1000;
  }

  // 2. Weekday Pricing Rules (Thứ 2 - Thứ 6)
  if (startHour >= 9 && startHour < 16) {
    // Golden Hour Off-Peak (09:00 - 16:00): Flash sale -25% discount to boost utilization
    return Math.round((basePrice * 0.75) / 1000) * 1000;
  }
  
  if (startHour >= 16 && startHour < 18) {
    // Cool Afternoon Peak (16:00 - 18:00 tan tầm chiều mát): +25%
    return Math.round((basePrice * 1.25) / 1000) * 1000;
  }

  if (startHour >= 18 && startHour < 21) {
    // Night Prime Peak (18:00 - 21:00 giờ vàng tối bật dàn đèn LED 500 Lux): +40% (hoặc ~340k với sân 240k)
    return Math.round((basePrice * 1.4) / 1000) * 1000;
  }

  // Standard early morning (06:00 - 09:00) & Late night (21:00 - 23:00): Exactly 100% Base Price
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

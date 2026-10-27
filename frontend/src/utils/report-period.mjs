const day = (row, fallback) => String(row.date || fallback || '').slice(0, 10);
export function orderInPeriod(order, start, end) {
  const inside = value => value >= start && value <= end;
  const slots = (order.slots || []).filter(s => inside(day(s, order.date)));
  if (!slots.length) return null;
  const staff = (order.staff || []).filter(s => inside(day(s, order.date)));
  const firstDate = (order.slots || []).map(s => day(s, order.date)).sort()[0];
  const products = inside(firstDate) ? (order.products || []) : [];
  return {...order, slots, staff, products,
    periodValue: slots.reduce((n,s) => n + Number(s.price || 0), 0)
      + staff.reduce((n,s) => n + Number(s.rate || 0) * Number(s.hours || 0), 0)
      + products.reduce((n,p) => n + Number(p.lineTotal || 0), 0)};
}

export function consumedOrder(order) {
  if (!['CANCELLED', 'EXPIRED'].includes(order.status)) return order;
  const slots = order.slots.filter(s => s.completed);
  const staff = order.staff.filter(s => s.completed);
  return {...order, slots, staff, products: [], periodValue:
    slots.reduce((n,s) => n + Number(s.price || 0), 0)
    + staff.reduce((n,s) => n + Number(s.rate || 0) * Number(s.hours || 0), 0)};
}

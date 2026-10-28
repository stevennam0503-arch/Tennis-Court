const slotDay = (slot, order) => String(slot.date || order.date || '').slice(0, 10);

export function orderOnDay(order, date) {
  const slots = (order.slots || []).filter(slot => slotDay(slot, order) === date);
  if (!slots.length) return null;
  const visit = (order.visits || []).find(v => v.date === date);
  const status = visit?.status || (slots.every(s => s.completed) ? 'COMPLETED' : order.status);
  return {...order, date, status, visitDate: date, slots,
    staff: (order.staff || []).filter(s => String(s.date || order.date).slice(0, 10) === date)};
}

export function hasVisitInRange(order, start = '', end = '9999-12-31', remainingOnly = false) {
  return (order.slots || []).some(slot => (!remainingOnly || !slot.completed)
    && slotDay(slot, order) >= start && slotDay(slot, order) <= end);
}

// Editing a visit must not select completed allocations or historical referee assignments.
export function editableVisit(order, date = order.date) {
  return {...order, date,
    slots: (order.slots || []).filter(s => !s.completed && slotDay(s, order) === date),
    staff: (order.staff || []).filter(s => !s.completed && slotDay(s, order) === date)};
}

// Schedule boundaries, rather than fixed slot counts, also support older 60-minute slots.
export const toMinutes = value => {
  const [hour, minute] = String(value).split(':').map(Number);
  return hour * 60 + minute;
};
export const clock = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
export function rangeSlots(rows, start, end) {
  return rows.filter(row => toMinutes(row.start) >= start && toMinutes(row.end) <= end)
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}
export function canEndAt(rows, start, end, available) {
  if (start === null || end <= start) return false;
  const selected = rangeSlots(rows, start, end);
  return selected.length > 0 && toMinutes(selected[0].start) === start
    && toMinutes(selected.at(-1).end) === end
    && selected.every((row, i) => available(row) && (!i || toMinutes(selected[i - 1].end) === toMinutes(row.start)));
}
export function timePoints(rows) {
  return [...new Set(rows.flatMap(row => [toMinutes(row.start), toMinutes(row.end)]))].sort((a, b) => a - b);
}

// Sân đã ngừng khai thác không nằm trong data.courts (để không hiện ở lịch, bảng giá, form đặt sân),
// nhưng đơn cũ vẫn trỏ tới chúng. courts.find(...) rơi về danh sách sân đã ngừng để lịch sử, hóa đơn
// và báo cáo vẫn hiện đúng tên sân; map/filter/length vẫn chỉ thấy sân đang dùng.
export function withArchivedCourts(value) {
  if (!value?.courts || !value.archivedCourts?.length) return value;
  const archived = value.archivedCourts;
  const courts = [...value.courts];
  Object.defineProperty(courts, 'find', {
    value: (fn, self) => Array.prototype.find.call(courts, fn, self) ?? archived.find(fn, self),
  });
  return { ...value, courts };
}

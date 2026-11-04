import React, { useState, useMemo } from 'react';
import { UserCheck, CalendarDays, Plus, Search, ChevronLeft, ChevronRight, ChevronDown, Award } from 'lucide-react';
import { useCourtly } from '../context';
import { Title, Panel, Table, Chip, Button, Tabs, Stat } from '../components/UI';
import { money, labels, hourLabel } from '../utils/format';
import { StaffPhoto } from '../components/StaffPhoto';

export default function StaffPage() {
  const { data, mutate, notify, show } = useCourtly();
  const [expandedShiftId, setExpandedShiftId] = useState(null);
  const [tab, setTab] = useState('staff');
  const [staffTypeFilter, setStaffTypeFilter] = useState('ALL');
  const [staffQuery, setStaffQuery] = useState('');

  // Schedules filter & pagination
  const [scheduleStaffFilter, setScheduleStaffFilter] = useState('ALL');
  const [scheduleDateFilter, setScheduleDateFilter] = useState('');
  const [schedulePage, setSchedulePage] = useState(1);
  const schedulePageSize = 15;

  const staffCounts = useMemo(() => {
    const c = { all: data.staff.length, REFEREE: 0, COACH: 0, BALL_BOY: 0 };
    for (const p of data.staff) {
      if (c[p.type] !== undefined) c[p.type]++;
    }
    return c;
  }, [data.staff]);

  const filteredStaff = useMemo(() => {
    return data.staff.filter((p) => {
      if (staffTypeFilter !== 'ALL' && p.type !== staffTypeFilter) return false;
      if (staffQuery.trim()) {
        const q = staffQuery.toLowerCase();
        const match = `${p.name} ${p.phone || ''} ${p.level || ''}`.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [data.staff, staffTypeFilter, staffQuery]);

  // Group contiguous slots into shifts
  const allShifts = useMemo(() => {
    if (!data.staffSchedules || !data.staffSchedules.length) return [];
    const sorted = [...data.staffSchedules].sort((a, b) =>
      (a.staff || '').localeCompare(b.staff || '') ||
      (b.date || '').localeCompare(a.date || '') ||
      Number(a.start) - Number(b.start)
    );
    const shifts = [];
    let cur = null;
    for (const slot of sorted) {
      const isContiguous = cur &&
        cur.staff === slot.staff &&
        cur.date === slot.date &&
        Math.abs(cur.end - Number(slot.start)) < 0.01;
      if (isContiguous) {
        cur.end = Number(slot.end);
        cur.slots.push(slot);
        if (slot.status === 'AVAILABLE') cur.availableCount++;
        else cur.bookedCount++;
      } else {
        if (cur) shifts.push(cur);
        cur = {
          id: slot.id,
          staff: slot.staff,
          date: slot.date,
          start: Number(slot.start),
          end: Number(slot.end),
          slots: [slot],
          availableCount: slot.status === 'AVAILABLE' ? 1 : 0,
          bookedCount: slot.status !== 'AVAILABLE' ? 1 : 0
        };
      }
    }
    if (cur) shifts.push(cur);
    return shifts;
  }, [data.staffSchedules]);

  // Filtered shifts
  const filteredShifts = useMemo(() => {
    return allShifts.filter((s) => {
      if (scheduleStaffFilter !== 'ALL' && s.staff !== scheduleStaffFilter) return false;
      if (scheduleDateFilter && s.date !== scheduleDateFilter) return false;
      return true;
    }).sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.start - b.start);
  }, [allShifts, scheduleStaffFilter, scheduleDateFilter]);

  // Paginated shifts
  const totalSchedulePages = Math.max(1, Math.ceil(filteredShifts.length / schedulePageSize));
  const currentSchedulePage = Math.min(schedulePage, totalSchedulePages);
  const paginatedShifts = useMemo(() => {
    const start = (currentSchedulePage - 1) * schedulePageSize;
    return filteredShifts.slice(start, start + schedulePageSize);
  }, [filteredShifts, currentSchedulePage, schedulePageSize]);

  const handleDeleteShift = async (s) => {
    const available = s.slots.filter(sl => sl.status === 'AVAILABLE');
    const booked = s.slots.filter(sl => sl.status !== 'AVAILABLE');
    if (available.length === 0) {
      notify(`Toàn bộ ${booked.length} slot trong ca đều đã có đơn đặt, không thể xóa.`);
      return;
    }
    if (!window.confirm(`Xác nhận xóa ${available.length} slot trống trong ca này?${booked.length > 0 ? ` (${booked.length} slot đã có đơn sẽ được giữ lại)` : ''}`)) return;
    try {
      await Promise.all(available.map(sl => mutate(`/catalog/staff-schedules/${sl.id}`, {}, 'DELETE')));
      if (booked.length > 0) {
        notify(`Đã xóa ${available.length} slot trống trong ca. Giữ lại ${booked.length} slot đã có đơn đặt.`);
      } else {
        notify(`Đã xóa thành công ca làm việc (${available.length} slot).`);
      }
    } catch (err) {
      notify(err.message || 'Lỗi khi xóa ca');
    }
  };

  return (
    <>
      <Title
        subtitle="Hồ sơ nhân sự với ảnh mô phỏng trực quan, lịch làm việc và tổng hợp công."
        action={
          <Button className="primary" onClick={() => show({ type: 'entity', collection: 'staff' })}>
            <Plus size={16} style={{ marginRight: 4 }} /> Thêm nhân sự
          </Button>
        }
      >
        Nhân sự & trọng tài
      </Title>

      <Tabs
        options={[
          ['staff', `Đội ngũ nhân sự (${data.staff.length})`],
          ['schedules', `Lịch làm việc (${allShifts.length})`],
          ['payroll', 'Tổng hợp công'],
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'staff' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <div className="tabs" style={{ margin: 0 }}>
              {[
                ['ALL', `Tất cả (${staffCounts.all})`],
                ['REFEREE', `Trọng tài (${staffCounts.REFEREE})`],
                ['COACH', `HLV (${staffCounts.COACH})`],
                ['BALL_BOY', `Nhặt bóng (${staffCounts.BALL_BOY})`],
              ].map(([t, label]) => (
                <button
                  key={t}
                  className={staffTypeFilter === t ? 'on' : ''}
                  onClick={() => setStaffTypeFilter(t)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={15} style={{ position: 'absolute', left: 8, color: '#94a3b8' }} />
              <input
                className="search"
                style={{ paddingLeft: 28, width: 220 }}
                placeholder="Tìm tên, chuyên môn..."
                value={staffQuery}
                onChange={(e) => setStaffQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="grid-cards">
            {filteredStaff.map((p) => (
              <article className="item-card" key={p.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="card-body">
                  <div className="card-top" style={{ alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <StaffPhoto staff={p} size={64} showBadge={true} showCaption={true} />
                      <div>
                        <h2 style={{ fontSize: 17, margin: '0 0 4px 0' }}>{p.name}</h2>
                        <span className={`chip ${p.type === 'REFEREE' ? 'green' : 'blue'}`} style={{ fontSize: 11 }}>
                          {labels[p.type] || p.type}
                        </span>
                      </div>
                    </div>
                    <Chip status={p.status} />
                  </div>

                  {p.level && (
                    <div style={{ margin: '10px 0 6px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#047857', fontWeight: 600 }}>
                      <Award size={14} /> {p.level}
                    </div>
                  )}

                  <div className="metric">
                    <span className="muted">Liên hệ</span>
                    <span>{p.phone || 'Chưa có SĐT'}</span>
                  </div>
                  <div className="metric">
                    <span className="muted">Đơn giá / giờ</span>
                    <b style={{ color: '#0f172a' }}>{money(p.rate)}</b>
                  </div>

                  <div className="card-buttons" style={{ marginTop: 'auto', paddingTop: 14 }}>
                    <Button className="sm" onClick={() => show({ type: 'entity', collection: 'staff', row: p })}>
                      Chỉnh sửa
                    </Button>
                    <Button className="sm" onClick={() => show({ type: 'entity', collection: 'staff-schedules', row: { staff: p.id } })}>
                      Tạo lịch
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {tab === 'schedules' && (
        <Panel
          title={`Lịch làm việc nhân sự (${filteredShifts.length} ca)`}
          action={
            <div className="tools" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <select
                aria-label="Lọc theo nhân sự"
                value={scheduleStaffFilter}
                onChange={(e) => {
                  setScheduleStaffFilter(e.target.value);
                  setSchedulePage(1);
                }}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
              >
                <option value="ALL">Tất cả nhân sự</option>
                {data.staff.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({labels[p.type] || p.type})
                  </option>
                ))}
              </select>

              <input
                aria-label="Lọc theo ngày"
                type="date"
                value={scheduleDateFilter}
                onChange={(e) => {
                  setScheduleDateFilter(e.target.value);
                  setSchedulePage(1);
                }}
                style={{ width: 140 }}
              />

              {scheduleDateFilter && (
                <Button className="sm" onClick={() => { setScheduleDateFilter(''); setSchedulePage(1); }}>
                  Xem tất cả
                </Button>
              )}

              <Button className="primary sm" onClick={() => show({ type: 'entity', collection: 'staff-schedules' })}>
                <Plus size={14} style={{ marginRight: 2 }} /> Thêm lịch
              </Button>
            </div>
          }
        >
          <Table headings={['Nhân sự', 'Ngày', 'Khung giờ ca', 'Tình trạng slot', 'Thao tác']} empty={!paginatedShifts.length}>
            {paginatedShifts.map((s) => {
              const staffMember = data.staff.find((p) => p.id === s.staff);
              const isExpanded = expandedShiftId === s.id;
              return (
                <React.Fragment key={s.id}>
                  <tr
                    style={{ cursor: 'pointer', background: isExpanded ? '#f8fafc' : undefined }}
                    onClick={() => setExpandedShiftId(prev => prev === s.id ? null : s.id)}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ChevronDown size={16} color="#64748b" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        <StaffPhoto staff={staffMember} size={30} showBadge={false} />
                        <div>
                          <b>{staffMember?.name}</b>
                          <small style={{ color: '#64748b', display: 'block' }}>{labels[staffMember?.type] || ''}</small>
                        </div>
                      </div>
                    </td>
                    <td>{s.date}</td>
                    <td style={{ fontWeight: 600, color: '#173c32' }}>{hourLabel(s.start)} – {hourLabel(s.end)}</td>
                    <td>
                      {s.bookedCount === 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                          Còn trống {s.slots.length}/{s.slots.length} slot
                        </span>
                      ) : s.availableCount === 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', background: '#fee2e2', color: '#b91c1c', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                          Đã đặt kín ({s.slots.length} slot)
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                          Còn trống {s.availableCount}/{s.slots.length} slot ({s.bookedCount} đã đặt)
                        </span>
                      )}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Button
                          className="sm"
                          onClick={() => show({
                            type: 'entity',
                            collection: 'staff-schedules',
                            row: { id: s.id, staff: s.staff, date: s.date, start: s.start, end: s.end, _shift: s }
                          })}
                        >
                          Sửa ca
                        </Button>
                        <Button
                          className="sm"
                          disabled={s.availableCount === 0}
                          onClick={() => handleDeleteShift(s)}
                          style={{ color: '#dc2626' }}
                        >
                          Xóa ca
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr style={{ background: '#f8fafc' }}>
                      <td colSpan={5} style={{ padding: '12px 24px', borderTop: 'none', borderBottom: '2px solid #e2e8f0' }}>
                        <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 12 }}>
                          <h4 style={{ margin: '0 0 10px', fontSize: 13, color: '#334155', fontWeight: 700 }}>
                            Chi tiết {s.slots.length} slot 30 phút trong ca ({s.date} • {hourLabel(s.start)}–{hourLabel(s.end)}):
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
                            {s.slots.map(sl => {
                              const order = (data.orders || []).find(o =>
                                o.staff?.some(st =>
                                  st.staffScheduleId === sl.id ||
                                  (st.staffId === sl.staff && String(st.date || o.date).slice(0, 10) === sl.date && Math.abs(st.hour - sl.start) < 0.01)
                                )
                              );
                              const court = order?.slots?.[0]?.court ? data.courts.find(c => c.id === order.slots[0].court) : null;
                              return (
                                <div
                                  key={sl.id}
                                  style={{
                                    border: '1px solid ' + (sl.status === 'AVAILABLE' ? '#bbf7d0' : '#fecaca'),
                                    background: sl.status === 'AVAILABLE' ? '#f0fdf4' : '#fef2f2',
                                    borderRadius: 6,
                                    padding: '8px 10px',
                                    fontSize: 12
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: 2 }}>
                                    <span>{hourLabel(sl.start)} – {hourLabel(sl.end)}</span>
                                    <span style={{ color: sl.status === 'AVAILABLE' ? '#15803d' : '#b91c1c' }}>
                                      {sl.status === 'AVAILABLE' ? 'Còn trống' : 'Đã đặt'}
                                    </span>
                                  </div>
                                  {order ? (
                                    <div style={{ color: '#64748b', fontSize: 11 }}>
                                      <span>Đơn: <b>CT-{order.id.slice(0, 8).toUpperCase()}</b></span>
                                      <span style={{ display: 'block' }}>Khách: {order.name} {court ? `· ${court.name}` : ''}</span>
                                    </div>
                                  ) : (
                                    <div style={{ color: '#94a3b8', fontSize: 11 }}>Chưa có đơn đặt</div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </Table>

          {totalSchedulePages > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 18px',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
                fontSize: 13,
                color: '#64748b'
              }}
            >
              <span>
                Hiển thị <b>{(currentSchedulePage - 1) * schedulePageSize + 1}</b> – <b>{Math.min(currentSchedulePage * schedulePageSize, filteredSchedules.length)}</b> trong số <b>{filteredShifts.length}</b> ca làm việc
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Button
                  className="sm"
                  disabled={currentSchedulePage <= 1}
                  onClick={() => setSchedulePage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} style={{ marginRight: 2 }} /> Trước
                </Button>
                <span style={{ fontWeight: 600, color: '#1e293b', padding: '0 8px' }}>
                  Trang {currentSchedulePage} / {totalSchedulePages}
                </span>
                <Button
                  className="sm"
                  disabled={currentSchedulePage >= totalSchedulePages}
                  onClick={() => setSchedulePage((p) => Math.min(totalSchedulePages, p + 1))}
                >
                  Sau <ChevronRight size={14} style={{ marginLeft: 2 }} />
                </Button>
              </div>
            </div>
          )}
        </Panel>
      )}

      {tab === 'payroll' && (
        <Panel title="Tổng hợp công theo đơn đặt sân hoàn tất">
          <Table headings={['Nhân sự', 'Vị trí', 'Đơn giá / giờ', 'Tổng giờ làm', 'Tổng tiền công']}>
            {data.staff.map((p) => {
              const lines = data.orders.filter((o) => o.status === 'COMPLETED').flatMap((o) => o.staff).filter((s) => s.staffId === p.id);
              const totalHours = lines.reduce((a, s) => a + s.hours, 0);
              const totalPay = lines.reduce((a, s) => a + s.hours * s.rate, 0);
              return (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StaffPhoto staff={p} size={30} showBadge={false} />
                      <b>{p.name}</b>
                    </div>
                  </td>
                  <td><Chip status={p.type} /></td>
                  <td>{money(p.rate)}</td>
                  <td style={{ fontWeight: 600 }}>{totalHours} giờ</td>
                  <td className="name" style={{ color: '#047857' }}>{money(totalPay)}</td>
                </tr>
              );
            })}
          </Table>
          <div className="panel-body">
            <small style={{ color: '#64748b' }}>
              * Phân công trọng tài cho các trận đấu giải CLB không thu tiền khách theo điều lệ giải. Bảng tổng hợp công này dựa trên các đơn đặt sân đã hoàn tất (COMPLETED).
            </small>
          </div>
        </Panel>
      )}
    </>
  );
}

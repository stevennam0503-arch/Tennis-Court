import React, { useState, useMemo } from 'react';
import { UserCheck, CalendarDays, Plus, Search, ChevronLeft, ChevronRight, Award } from 'lucide-react';
import { useCourtly } from '../context';
import { Title, Panel, Table, Chip, Button, Tabs, Stat } from '../components/UI';
import { money, labels, hourLabel } from '../utils/format';
import { StaffPhoto } from '../components/StaffPhoto';

export default function StaffPage() {
  const { data, show } = useCourtly();
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

  // Filtered schedules
  const filteredSchedules = useMemo(() => {
    return data.staffSchedules.filter((s) => {
      if (scheduleStaffFilter !== 'ALL' && s.staff !== scheduleStaffFilter) return false;
      if (scheduleDateFilter && s.date !== scheduleDateFilter) return false;
      return true;
    }).sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.start - b.start);
  }, [data.staffSchedules, scheduleStaffFilter, scheduleDateFilter]);

  // Paginated schedules
  const totalSchedulePages = Math.max(1, Math.ceil(filteredSchedules.length / schedulePageSize));
  const currentSchedulePage = Math.min(schedulePage, totalSchedulePages);
  const paginatedSchedules = useMemo(() => {
    const start = (currentSchedulePage - 1) * schedulePageSize;
    return filteredSchedules.slice(start, start + schedulePageSize);
  }, [filteredSchedules, currentSchedulePage, schedulePageSize]);

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
          ['schedules', `Lịch làm việc (${data.staffSchedules.length})`],
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
          title={`Lịch làm việc nhân sự (${filteredSchedules.length})`}
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
          <Table headings={['Nhân sự', 'Ngày', 'Thời gian', 'Trạng thái', 'Thao tác']} empty={!paginatedSchedules.length}>
            {paginatedSchedules.map((s) => {
              const staffMember = data.staff.find((p) => p.id === s.staff);
              return (
                <tr key={s.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StaffPhoto staff={staffMember} size={30} showBadge={false} />
                      <div>
                        <b>{staffMember?.name}</b>
                        <small style={{ color: '#64748b' }}>{labels[staffMember?.type] || ''}</small>
                      </div>
                    </div>
                  </td>
                  <td>{s.date}</td>
                  <td style={{ fontWeight: 600 }}>{hourLabel(s.start)} – {hourLabel(s.end)}</td>
                  <td><Chip status={s.status} /></td>
                  <td>
                    <Button
                      className="sm"
                      disabled={s.status !== 'AVAILABLE'}
                      onClick={() => show({ type: 'entity', collection: 'staff-schedules', row: s })}
                    >
                      Sửa
                    </Button>
                  </td>
                </tr>
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
                Hiển thị <b>{(currentSchedulePage - 1) * schedulePageSize + 1}</b> – <b>{Math.min(currentSchedulePage * schedulePageSize, filteredSchedules.length)}</b> trong số <b>{filteredSchedules.length}</b> lịch làm việc
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

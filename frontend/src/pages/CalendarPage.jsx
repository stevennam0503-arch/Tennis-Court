import { hourLabel, slotHours } from '../utils/format';
import React, { useEffect, useState } from 'react';
import { Wallet, CalendarDays, Users, Grid2X2, Plus, RefreshCw, Wrench } from 'lucide-react';
import { useCourtly } from '../context';
import { Title, Stat, Panel, Button } from '../components/UI';
import OrderTable from '../components/OrderTable';
import { active, money, localDate, today, labels } from '../utils/format';
import { api } from '../services/api';

export default function CalendarPage() {
  const { data, date, setDate, show, refresh, notify } = useCourtly();
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => setSelected([]), [date]);

  const orders = data.orders.filter((o) => o.date === date);
  const occupied = data.schedules.filter((s) => s.status !== 'AVAILABLE' && s.status !== 'MAINTENANCE').length;
  const maintenanceCount = data.schedules.filter((s) => s.status === 'MAINTENANCE').length;
  const income =
    data.payments
      .filter((p) => p.orderId && localDate(p.createdAt) === date)
      .reduce((a, p) => a + p.amount, 0) -
    data.refunds
      .filter((r) => localDate(r.createdAt) === date && data.payments.find((p) => p.id === r.paymentId)?.orderId)
      .reduce((a, r) => a + r.amount, 0);

  const choose = (id) =>
    setSelected((previous) => (previous.includes(id) ? previous.filter((x) => x !== id) : [...previous, id]));

  const create = () => {
    if (!selected.length) return notify('Chọn các khung giờ trống trước.');
    const hasMaintenance = data.schedules.some((s) => selected.includes(s.id) && s.status === 'MAINTENANCE');
    if (hasMaintenance) return notify('Không thể đặt khung giờ đang bảo trì. Hãy bỏ chọn hoặc mở lại khung giờ.');
    show({ type: 'booking', scheduleIds: selected, onCreated: () => setSelected([]) });
  };

  const handleToggleMaintenance = async () => {
    if (!selected.length) return notify('Chọn ít nhất một khung giờ.');
    const selectedSchedules = data.schedules.filter((s) => selected.includes(s.id));
    const isCurrentlyMaintenance = selectedSchedules.some((s) => s.status === 'MAINTENANCE');
    setBusy(true);
    try {
      await api('/catalog/schedules/maintenance', 'POST', {
        slotIds: selected,
        maintenance: !isCurrentlyMaintenance,
        reason: !isCurrentlyMaintenance ? 'Bảo dưỡng định kỳ theo khung giờ' : 'Hoàn tất bảo trì',
      });
      notify(
        !isCurrentlyMaintenance
          ? 'Đã chuyển các khung giờ sang bảo trì.'
          : 'Đã mở lại các khung giờ hoạt động bình thường.'
      );
      setSelected([]);
      await refresh();
    } catch (err) {
      notify(err.message);
    } finally {
      setBusy(false);
    }
  };

  const selectedSchedules = data.schedules.filter((s) => selected.includes(s.id));
  const hasMaintenanceInSelected = selectedSchedules.some((s) => s.status === 'MAINTENANCE');

  return (
    <>
      <Title
        subtitle="Theo dõi lịch, bảo trì theo khung giờ và đặt sân trong một màn hình."
        action={
          <Button className="primary" onClick={create}>
            <Plus size={17} />
            Tạo đơn đặt sân
          </Button>
        }
      >
        Lịch sân
      </Title>
      <div className="stats">
        <Stat title="Tiền thu từ đơn sân" value={money(income)} note="Trong ngày · đã trừ hoàn" icon={Wallet} />
        <Stat title="Đơn đặt sân" value={orders.length} note="Ngày đang xem" icon={CalendarDays} />
        <Stat
          title="Công suất sân"
          value={`${Math.round(
            (occupied /
              Math.max(
                1,
                data.schedules.filter((s) => data.courts.some((c) => c.id === s.court && c.status === 'ACTIVE')).length
              )) *
              100
          )}%`}
          note={`${occupied} giờ đã đặt · ${maintenanceCount} giờ bảo trì`}
          icon={Grid2X2}
        />
        <Stat title="Khách đang chơi" value={orders.filter((o) => o.status === 'CHECKED_IN').length} note="Đơn đã check-in" icon={Users} />
      </div>

      <Panel
        title="Lịch sử dụng sân"
        action={
          <div className="tools">
            <Button className="sm" onClick={() => setDate(today())}>
              Hôm nay
            </Button>
            <input
              type="date"
              aria-label="Ngày xem lịch"
              value={date}
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value);
              }}
            />
            <Button className="sm" aria-label="Cập nhật" onClick={() => refresh().catch((e) => notify(e.message))}>
              <RefreshCw size={16} />
            </Button>
          </div>
        }
      >
        <div className="panel-body" style={{ paddingTop: 14, paddingBottom: 14 }}>
          <div className="legend">
            {[
              ['#d9e6da', 'Còn trống'],
              ['#83b599', 'Đã đặt'],
              ['#ebc66c', 'Giữ chỗ'],
              ['#b6a1d9', 'Thi đấu'],
              ['#cfd5cf', 'Bảo trì'],
            ].map(([color, text]) => (
              <span key={text}>
                <i style={{ background: color }} />
                {text}
              </span>
            ))}
          </div>
        </div>

        <div className="schedule-scroll" style={{ maxHeight: 620 }}>
          <div className="schedule" style={{ '--cols': Math.max(1, data.courts.length) }}>
            <div className="court-head">Giờ</div>
            {data.courts.map((c) => (
              <div className="court-head" key={c.id}>
                {c.name}
                <small>{labels[c.type]}</small>
              </div>
            ))}
            {[...new Set(data.schedules.map((s) => s.hour))].sort((a, b) => a - b).map((hour) => (
              <React.Fragment key={hour}>
                <div className="time-cell">{hourLabel(hour)}</div>
                {data.courts.map((c) => {
                  const slot = data.schedules.find((s) => s.court === c.id && s.hour === hour);
                  const order = orders.find((o) => active(o) && o.slots.some((s) => s.id === slot?.id));
                  const match = data.matches.find(
                    (m) => !['FINISHED', 'CANCELLED'].includes(m.status) && m.slots.some((s) => s.id === slot?.id)
                  );
                  const courtDisabled = c.status !== 'ACTIVE' || !slot;
                  const isMaintenance = slot?.status === 'MAINTENANCE';

                  const status = selected.includes(slot?.id)
                    ? 'selected'
                    : isMaintenance || courtDisabled
                    ? 'maintenance'
                    : slot?.status === 'LOCKED'
                    ? 'holding'
                    : slot?.status === 'BOOKED'
                    ? 'booked'
                    : slot?.status === 'IN_MATCH'
                    ? 'match'
                    : 'available';

                  return (
                    <div className="slot-wrap" key={c.id}>
                      <button
                        className={`slot ${status}`}
                        disabled={courtDisabled}
                        aria-pressed={!!slot && selected.includes(slot.id)}
                        aria-label={`${c.name} ${hour} giờ`}
                        onClick={() => {
                          if (order) return show({ type: 'order', id: order.id });
                          if (match) return show({ type: 'match', id: match.id });
                          if (slot && (slot.status === 'AVAILABLE' || slot.status === 'MAINTENANCE')) {
                            choose(slot.id);
                          } else {
                            refresh();
                          }
                        }}
                      >
                        <span>
                          {courtDisabled
                            ? labels[c.status]
                            : order?.name ||
                              match?.roundName ||
                              (selected.includes(slot?.id)
                                ? 'Đã chọn'
                                : isMaintenance
                                ? 'Bảo trì'
                                : labels[slot?.status])}
                        </span>
                        <small>
                          {courtDisabled
                            ? 'Tạm ngừng'
                            : isMaintenance
                            ? 'Tạm ngưng phục vụ'
                            : order
                            ? labels[order.status]
                            : match
                            ? 'Lịch thi đấu'
                            : money(slot?.price) + ' / ' + slotHours(slot) * 60 + ' phút'}
                        </small>
                      </button>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="schedule-foot">
          <span>
            {selected.length
              ? `${selected.length} khung giờ · ${money(
                  data.schedules.filter((s) => selected.includes(s.id)).reduce((a, s) => a + s.price, 0)
                )}`
              : 'Chọn một hoặc nhiều khung giờ để đặt sân hoặc chuyển bảo trì.'}
          </span>
          <div className="tools">
            {!!selected.length && (
              <Button className="sm" onClick={() => setSelected([])}>
                Bỏ chọn
              </Button>
            )}
            {!!selected.length && (
              <Button className="sm" onClick={handleToggleMaintenance} disabled={busy}>
                <Wrench size={14} style={{ marginRight: 4 }} />
                {hasMaintenanceInSelected ? 'Mở lại khung giờ' : 'Bảo trì khung giờ'}
              </Button>
            )}
            <Button className="primary sm" onClick={create} disabled={busy || hasMaintenanceInSelected}>
              Đặt khung giờ đã chọn
            </Button>
          </div>
        </div>
      </Panel>

      <div className="bottom-grid">
        <Panel title="Đơn trong ngày">
          <OrderTable orders={orders.slice(0, 5)} />
        </Panel>
        <Panel title="Cần chú ý">
          <div className="panel-body">
            <div className="activity">
              <div>
                <p>{data.orders.filter((o) => o.status === 'HOLDING').length} đơn đang giữ chỗ</p>
                <small>Tự nhả sau {data.settings.holdMinutes} phút nếu chưa đủ cọc.</small>
              </div>
            </div>
            <div className="activity">
              <div>
                <p>{data.tournaments.filter((t) => t.status === 'OPEN').length} giải mở đăng ký</p>
                <small>Phí giải được theo dõi riêng.</small>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}

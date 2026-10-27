import {orderInPeriod, consumedOrder} from '../utils/report-period.mjs';
import React, { useState, useMemo } from 'react';
import { Wallet, Trophy, Check, Clock, Calendar, TrendingUp, Download } from 'lucide-react';
import { useCourtly } from '../context';
import { Title, Stat, Panel, Button, Table, Chip } from '../components/UI';
import { money, labels, today, localDate, slotHours } from '../utils/format';

export default function ReportsPage() {
  const { data } = useCourtly();
  const currentToday = today(); // YYYY-MM-DD
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;

  // Period modes: 'day' | 'month' | 'quarter' | 'year' | 'all'
  const [periodType, setPeriodType] = useState('month');
  const [selectedDay, setSelectedDay] = useState(currentToday);
  const [selectedMonth, setSelectedMonth] = useState(`${currentYear}-${currentMonth}`);
  const [selectedQuarter, setSelectedQuarter] = useState(`Q${currentQuarter}`);
  const [selectedQuarterYear, setSelectedQuarterYear] = useState(currentYear);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [customStart, setCustomStart] = useState(currentToday);
  const [customEnd, setCustomEnd] = useState(currentToday);

  // Compute startDate and endDate based on periodType
  const { startDate, endDate, periodLabel } = useMemo(() => {
    if (periodType === 'day') {
      const parts = selectedDay.split('-');
      return {
        startDate: selectedDay,
        endDate: selectedDay,
        periodLabel: `Ngày ${parts[2]}/${parts[1]}/${parts[0]}`
      };
    }
    if (periodType === 'month') {
      const [y, m] = selectedMonth.split('-');
      const lastDay = new Date(Number(y), Number(m), 0).getDate();
      return {
        startDate: `${y}-${m}-01`,
        endDate: `${y}-${m}-${String(lastDay).padStart(2, '0')}`,
        periodLabel: `Tháng ${m}/${y}`
      };
    }
    if (periodType === 'quarter') {
      const q = Number(selectedQuarter.replace('Q', ''));
      const startM = String((q - 1) * 3 + 1).padStart(2, '0');
      const endM = String(q * 3).padStart(2, '0');
      const lastDay = new Date(selectedQuarterYear, q * 3, 0).getDate();
      return {
        startDate: `${selectedQuarterYear}-${startM}-01`,
        endDate: `${selectedQuarterYear}-${endM}-${String(lastDay).padStart(2, '0')}`,
        periodLabel: `Quý ${q}/${selectedQuarterYear} (${startM}/${selectedQuarterYear} – ${endM}/${selectedQuarterYear})`
      };
    }
    if (periodType === 'year') {
      return {
        startDate: `${selectedYear}-01-01`,
        endDate: `${selectedYear}-12-31`,
        periodLabel: `Năm ${selectedYear}`
      };
    }
    if (periodType === 'custom') {
      return {
        startDate: customStart,
        endDate: customEnd,
        periodLabel: `Từ ${customStart} đến ${customEnd}`
      };
    }
    return {
      startDate: '1970-01-01',
      endDate: '2099-12-31',
      periodLabel: 'Toàn bộ thời gian'
    };
  }, [periodType, selectedDay, selectedMonth, selectedQuarter, selectedQuarterYear, selectedYear, customStart, customEnd]);

  // Filter orders in period
  const ordersInPeriod = useMemo(() => {
    return data.orders.map(o => orderInPeriod(o, startDate, endDate)).filter(Boolean);
  }, [data.orders, startDate, endDate]);

  const validOrders = useMemo(() => {
    return ordersInPeriod.map(consumedOrder).filter(o => o.slots.length > 0);
  }, [ordersInPeriod]);

  // Filter payments & refunds in period
  const paymentsInPeriod = useMemo(() => {
    return data.payments.filter(p => {
      const d = localDate(p.createdAt || p.paidAt);
      return d >= startDate && d <= endDate;
    });
  }, [data.payments, startDate, endDate]);

  const refundsInPeriod = useMemo(() => {
    return data.refunds.filter(r => {
      const d = localDate(r.createdAt);
      return d >= startDate && d <= endDate;
    });
  }, [data.refunds, startDate, endDate]);

  // Cashflow
  const netOrderCash = useMemo(() => {
    const collected = paymentsInPeriod.filter(p => p.orderId).reduce((a, p) => a + p.amount, 0);
    const refunded = refundsInPeriod.filter(r => {
      const p = data.payments.find(x => x.id === r.paymentId);
      return p && p.orderId;
    }).reduce((a, r) => a + r.amount, 0);
    return collected - refunded;
  }, [paymentsInPeriod, refundsInPeriod, data.payments]);

  const netTournamentCash = useMemo(() => {
    const collected = paymentsInPeriod.filter(p => p.registrationId).reduce((a, p) => a + p.amount, 0);
    const refunded = refundsInPeriod.filter(r => {
      const p = data.payments.find(x => x.id === r.paymentId);
      return p && p.registrationId;
    }).reduce((a, r) => a + r.amount, 0);
    return collected - refunded;
  }, [paymentsInPeriod, refundsInPeriod, data.payments]);

  const membershipPaymentsInPeriod = useMemo(() => {
    return (data.membershipPayments || []).filter(p => {
      const d = localDate(p.createdAt);
      return d >= startDate && d <= endDate;
    });
  }, [data.membershipPayments, startDate, endDate]);

  const netMembershipCash = useMemo(() => {
    return membershipPaymentsInPeriod.reduce((a, p) => a + p.amount, 0);
  }, [membershipPaymentsInPeriod]);

  const totalNetCash = useMemo(() => {
    const totalOrderAndTournPaid = paymentsInPeriod.reduce((a, p) => a + p.amount, 0);
    const totalRefund = refundsInPeriod.reduce((a, r) => a + r.amount, 0);
    return totalOrderAndTournPaid + netMembershipCash - totalRefund;
  }, [paymentsInPeriod, netMembershipCash, refundsInPeriod]);

  // Value by categories on valid orders and club services
  const courtValue = validOrders.flatMap(o => o.slots).reduce((a, s) => a + (s.price || 0), 0);
  const legacyValue = validOrders.flatMap(o => o.products).reduce((a,p) => a + (p.lineTotal || 0), 0);
  const staffValue = validOrders.flatMap(o => o.staff).reduce((a, s) => a + (s.hours || 1) * (s.rate || 0), 0);
  const tournamentValue = Math.max(0, netTournamentCash);
  const membershipValue = Math.max(0, netMembershipCash);
  const totalValue = courtValue + legacyValue + staffValue + tournamentValue + membershipValue;

  const categories = [
    ['Tiền thuê sân', courtValue],
    ['Dịch vụ trọng tài', staffValue],
    ['Phí tham gia giải đấu', tournamentValue],
    ['Gói hội viên (Membership)', membershipValue],
    ...(legacyValue ? [['Khoản dịch vụ cũ (lịch sử)', legacyValue]] : [])
  ];
  const maxCategory = Math.max(1, ...categories.map(x => x[1]));

  // Number of calendar days in period for occupancy calculation
  const periodDays = useMemo(() => {
    const s = new Date(startDate), e = new Date(endDate);
    const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, Math.min(366, diff));
  }, [startDate, endDate]);

  // Occupancy per court (calculated by actual hours using slotHours)
  const courtOccupancy = useMemo(() => {
    const totalPossibleHours = 17 * periodDays;
    return data.courts.map(c => {
      const orderHours = validOrders
        .flatMap(o => o.slots)
        .filter(s => s.court === c.id)
        .reduce((sum, s) => sum + slotHours(s), 0);
      const matchHours = data.matches
        .filter(m => m.date >= startDate && m.date <= endDate && m.status !== 'CANCELLED')
        .flatMap(m => m.slots)
        .filter(s => s.court === c.id)
        .reduce((sum, s) => sum + slotHours(s), 0);
      const totalUsedHours = orderHours + matchHours;
      const percent = totalPossibleHours > 0 ? Math.round((totalUsedHours / totalPossibleHours) * 100) : 0;
      return {
        id: c.id,
        name: c.name,
        type: c.type,
        used: totalUsedHours,
        totalPossible: totalPossibleHours,
        percent
      };
    });
  }, [data.courts, validOrders, data.matches, startDate, endDate, periodDays]);

  const avgOccupancy = courtOccupancy.length
    ? Math.round(courtOccupancy.reduce((a, c) => a + c.percent, 0) / courtOccupancy.length)
    : 0;

  // Monthly sub-breakdown for Year or Quarter mode
  const monthlyBreakdown = useMemo(() => {
    if (periodType !== 'year' && periodType !== 'quarter') return [];
    const months = [];
    const startM = periodType === 'quarter' ? (Number(selectedQuarter.replace('Q', '')) - 1) * 3 + 1 : 1;
    const endM = periodType === 'quarter' ? Number(selectedQuarter.replace('Q', '')) * 3 : 12;
    const yr = periodType === 'quarter' ? selectedQuarterYear : selectedYear;

    for (let m = startM; m <= endM; m++) {
      const mStr = `${yr}-${String(m).padStart(2, '0')}`;
      const mOrders = data.orders.map(o => orderInPeriod(o, mStr + "-01", mStr + "-31")).filter(Boolean);
      const mValid = mOrders.map(consumedOrder).filter(o => o.slots.length > 0);
      const mRevenue = [...data.payments, ...(data.membershipPayments || [])].filter(p => localDate(p.createdAt || p.paidAt).startsWith(mStr)).reduce((a, p) => a + p.amount, 0)
        - data.refunds.filter(r => localDate(r.createdAt).startsWith(mStr)).reduce((a, r) => a + r.amount, 0);
      months.push({
        label: `Tháng ${m}/${yr}`,
        ordersCount: mOrders.length,
        completedCount: mOrders.filter(o => o.status === 'COMPLETED').length,
        revenue: mRevenue,
        orderValue: mValid.reduce((a, o) => a + o.periodValue, 0)
      });
    }
    return months;
  }, [periodType, selectedQuarter, selectedQuarterYear, selectedYear, data.orders, data.payments, data.refunds, data.membershipPayments]);

  // Export CSV
  const exportCsv = () => {
    const escape = v => '"' + String(v ?? '').replace(/^[=+@-]/, "'").replaceAll('"', '""') + '"';
    const rows = [
      ['BÁO CÁO DOANH THU & VẬN HÀNH COURTLY TENNIS CLUB'],
      ['Kỳ báo cáo', periodLabel],
      ['Từ ngày', startDate, 'Đến ngày', endDate],
      [''],
      ['I. 3 TRỤ CỘT DOANH THU & TÀI CHÍNH'],
      ['Trụ cột / Hạng mục', 'Số tiền (VNĐ)'],
      ['1. Doanh thu tiền thuê sân', courtValue],
      ['2. Dịch vụ trọng tài', staffValue],
      ['3. Phí giải đấu & Phí hội viên', netTournamentCash + netMembershipCash],
      ['Trừ: Khoản hoàn tiền', refundsInPeriod.reduce((a, r) => a + r.amount, 0)],
      ['TỔNG DOANH THU THUẦN (NET)', totalNetCash],
      [''],
      ['II. THỐNG KÊ ĐƠN HÀNG'],
      ['Tổng đơn trong kỳ', ordersInPeriod.length],
      ['Đơn hoàn tất', ordersInPeriod.filter(o => o.status === 'COMPLETED').length],
      ['Đơn đã hủy', ordersInPeriod.filter(o => o.status === 'CANCELLED').length],
      ['Đơn hết hạn giữ chỗ', ordersInPeriod.filter(o => o.status === 'EXPIRED').length],
      [''],
      ['III. CƠ CẤU DOANH THU DỊCH VỤ'],
      ['Hạng mục', 'Giá trị (VNĐ)'],
      ...categories.map(([name, val]) => [name, val]),
      [''],
      ['IV. CÔNG SUẤT SÂN'],
      ['Tên sân', 'Khung giờ sử dụng', 'Tổng khung giờ khả dụng', 'Tỷ lệ lấp đầy (%)'],
      ...courtOccupancy.map(c => [c.name, c.used, c.totalPossible, c.percent + '%']),
      [''],
      ['V. CHI TIẾT ĐƠN HÀNG TRONG KỲ'],
      ['Mã đơn', 'Khách hàng', 'Số điện thoại', 'Ngày chơi trong kỳ', 'Trạng thái đơn', 'Tổng cả đơn', 'Đã thu cả đơn'],
      ...ordersInPeriod.map(o => [
        o.id,
        o.name,
        o.phone || '',
        [...new Set(o.slots.map(s => s.date || o.date))].sort().join("; "),
        labels[o.status] || o.status,
        o.total,
        o.paid
      ])
    ];

    const csvContent = '\ufeff' + rows.map(r => r.map(escape).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bao-cao-courtly-${periodType}-${startDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Title
        subtitle={`Phân tích tài chính, cơ cấu dịch vụ và công suất sân (${periodLabel}).`}
        action={
          <Button className="primary" onClick={exportCsv}>
            <Download size={16} /> Xuất báo cáo CSV
          </Button>
        }
      >
        Báo cáo & Thống kê
      </Title>

      {/* Period Filter Bar */}
      <div className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-body" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={18} style={{ color: 'var(--green)' }} />
            <b>Kỳ báo cáo:</b>
          </div>

          <div className="time-filters" style={{ margin: 0 }}>
            {[
              ['day', 'Theo Ngày'],
              ['month', 'Theo Tháng'],
              ['quarter', 'Theo Quý'],
              ['year', 'Theo Năm'],
              ['custom', 'Khoảng ngày'],
              ['all', 'Tất cả']
            ].map(([mode, label]) => (
              <button
                key={mode}
                className={periodType === mode ? 'on' : ''}
                onClick={() => setPeriodType(mode)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Sub-pickers */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' }}>
            {periodType === 'day' && (
              <>
                <input
                  type="date"
                  aria-label="Chọn ngày"
                  value={selectedDay}
                  onChange={e => e.target.value && setSelectedDay(e.target.value)}
                  style={{ width: 170 }}
                />
                <Button className="sm" onClick={() => setSelectedDay(currentToday)}>Hôm nay</Button>
              </>
            )}

            {periodType === 'month' && (
              <input
                type="month"
                aria-label="Chọn tháng"
                value={selectedMonth}
                onChange={e => e.target.value && setSelectedMonth(e.target.value)}
                style={{ width: 170 }}
              />
            )}

            {periodType === 'quarter' && (
              <>
                <select
                  aria-label="Chọn quý"
                  value={selectedQuarter}
                  onChange={e => setSelectedQuarter(e.target.value)}
                  style={{ width: 130 }}
                >
                  <option value="Q1">Quý 1 (T1-T3)</option>
                  <option value="Q2">Quý 2 (T4-T6)</option>
                  <option value="Q3">Quý 3 (T7-T9)</option>
                  <option value="Q4">Quý 4 (T10-T12)</option>
                </select>
                <select
                  aria-label="Chọn năm"
                  value={selectedQuarterYear}
                  onChange={e => setSelectedQuarterYear(Number(e.target.value))}
                  style={{ width: 110 }}
                >
                  {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                    <option key={y} value={y}>Năm {y}</option>
                  ))}
                </select>
              </>
            )}

            {periodType === 'year' && (
              <select
                aria-label="Chọn năm"
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                style={{ width: 130 }}
              >
                {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                  <option key={y} value={y}>Năm {y}</option>
                ))}
              </select>
            )}

            {periodType === 'custom' && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Từ:</span>
                <input
                  type="date"
                  aria-label="Từ ngày"
                  value={customStart}
                  onChange={e => e.target.value && setCustomStart(e.target.value)}
                  style={{ width: 140 }}
                />
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Đến:</span>
                <input
                  type="date"
                  aria-label="Đến ngày"
                  value={customEnd}
                  onChange={e => e.target.value && setCustomEnd(e.target.value)}
                  style={{ width: 140 }}
                />
              </div>
            )}

            <span className="chip green" style={{ fontWeight: 600 }}>
              {periodLabel}
            </span>
          </div>
        </div>
      </div>

      {/* 3 Core Revenue Pillars */}
      <div style={{ marginBottom: 20, padding: 18, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: '#173c32' }}>
            🏛️ 3 Trụ Cột Doanh Thu ({periodLabel})
          </h3>
          <span style={{ fontSize: 13, color: '#64748b' }}>Doanh thu thuần = Tiền sân + Trọng tài + Giải & Hội viên − Hoàn tiền</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, borderLeft: '4px solid #10b981' }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>1. DOANH THU THUÊ SÂN</span>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '4px 0' }}>{money(courtValue)}</div>
            <small style={{ color: '#64748b' }}>Sân VIP, Sân trong nhà & Sân ngoài trời</small>
          </div>

          <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, borderLeft: '4px solid #f59e0b' }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>2. DỊCH VỤ TRỌNG TÀI</span>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '4px 0' }}>{money(staffValue)}</div>
            <small style={{ color: '#64748b' }}>Phí thuê trọng tài điều hành trận đấu</small>
          </div>

          <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, borderLeft: '4px solid #8b5cf6' }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>3. GIẢI ĐẤU & HỘI VIÊN</span>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '4px 0' }}>{money(netTournamentCash + netMembershipCash)}</div>
            <small style={{ color: '#64748b' }}>Giải đấu ({money(netTournamentCash)}) · Hội viên ({money(netMembershipCash)})</small>
          </div>
        </div>

        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 13, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Trừ hoàn tiền:</span>
            <b>−{money(refundsInPeriod.reduce((a, r) => a + r.amount, 0))}</b>
          </div>
          <div style={{ fontSize: 15 }}>
            <span>Doanh thu thuần (Net): </span>
            <b style={{ color: '#059669', fontSize: 18 }}>{money(totalNetCash)}</b>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="stats">
        <Stat
          title="Tổng thực thu ròng"
          value={money(totalNetCash)}
          note={`Thu trừ hoàn (${paymentsInPeriod.length} giao dịch)`}
          icon={Wallet}
        />
        <Stat
          title="Thu ròng đơn sân"
          value={money(netOrderCash)}
          note="Tiền sân & dịch vụ trên đơn"
          icon={TrendingUp}
        />
        <Stat
          title="Thu giải & Hội viên"
          value={money(netTournamentCash + netMembershipCash)}
          note={`Giải: ${money(netTournamentCash)} · HV: ${money(netMembershipCash)}`}
          icon={Trophy}
        />
        <Stat
          title="Đơn hoàn tất trong kỳ"
          value={`${ordersInPeriod.filter(o => o.status === 'COMPLETED').length} / ${ordersInPeriod.length}`}
          note={`Tỷ lệ hoàn tất: ${ordersInPeriod.length ? Math.round(ordersInPeriod.filter(o => o.status === 'COMPLETED').length / ordersInPeriod.length * 100) : 0}%`}
          icon={Check}
        />
      </div>

      {/* Split Panels: Category breakdown & Court Occupancy */}
      <div className="split">
        <Panel title={`Cơ cấu doanh thu dịch vụ (${periodLabel})`}>
          <div className="panel-body">
            {categories.map(([name, value]) => (
              <div className="bar-row" key={name}>
                <span style={{ width: 170 }}>{name}</span>
                <div className="bar">
                  <b style={{ width: `${(value / maxCategory) * 100}%` }} />
                </div>
                <b>{money(value)}</b>
              </div>
            ))}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Tổng giá trị dịch vụ:</span>
              <b style={{ color: 'var(--green)', fontSize: 16 }}>{money(totalValue)}</b>
            </div>
            <small style={{ marginTop: 8, display: 'block' }}>
              Cơ cấu doanh thu bao gồm tiền thuê sân, dịch vụ trọng tài, phí giải đấu và gói hội viên trong kỳ.
            </small>
          </div>
        </Panel>

        <Panel title={`Công suất sân (${periodLabel}) · Trung bình ${avgOccupancy}%`}>
          <div className="panel-body">
            {courtOccupancy.map(c => (
              <div className="bar-row" key={c.id}>
                <span style={{ width: 140 }}>
                  {c.name} <small style={{ display: 'inline', color: 'var(--muted)' }}>({labels[c.type] || c.type})</small>
                </span>
                <div className="bar">
                  <b
                    style={{
                      width: `${c.percent}%`,
                      backgroundColor: c.percent > 70 ? '#2e7d32' : c.percent > 40 ? '#589569' : '#81c784'
                    }}
                  />
                </div>
                <b>{c.percent}%</b>
              </div>
            ))}
            <small style={{ marginTop: 14, display: 'block' }}>
              Tính trên {periodDays} ngày vận hành ({periodDays * 17} giờ mở cửa mỗi sân, khung 06:00–23:00).
            </small>
          </div>
        </Panel>
      </div>

      {/* If Year or Quarter, display monthly breakdown */}
      {monthlyBreakdown.length > 0 && (
        <Panel title={`Chi tiết doanh thu theo tháng (${periodLabel})`} style={{ marginTop: 24 }}>
          <Table headings={['Tháng', 'Tổng số đơn', 'Đơn hoàn tất', 'Giá trị dịch vụ', 'Doanh thu thực thu']}>
            {monthlyBreakdown.map(m => (
              <tr key={m.label}>
                <td className="name">{m.label}</td>
                <td>{m.ordersCount} đơn</td>
                <td><Chip status={m.completedCount > 0 ? 'COMPLETED' : 'PENDING'} /> {m.completedCount} đơn</td>
                <td>{money(m.orderValue)}</td>
                <td className="name" style={{ color: 'var(--green)' }}>{money(m.revenue)}</td>
              </tr>
            ))}
          </Table>
        </Panel>
      )}

      {/* Orders summary table in period */}
      <Panel title={`Danh sách đơn hàng trong kỳ (${ordersInPeriod.length} đơn)`} style={{ marginTop: 24 }}>
        <Table headings={['Mã đơn', 'Khách hàng', 'Ngày chơi trong kỳ', 'Trạng thái đơn', 'Tổng cả đơn', 'Đã thu cả đơn']} empty={!ordersInPeriod.length}>
          {ordersInPeriod.slice(0, 15).map(o => (
            <tr key={o.id}>
              <td>
                <b>{o.id.slice(0, 8).toUpperCase()}</b>
                <small>{o.phone}</small>
              </td>
              <td className="name">{o.name}</td>
              <td>{[...new Set(o.slots.map(s=>s.date||o.date))].sort().join(", ")}</td>
              <td><Chip status={o.status} /></td>
              <td>{money(o.total)}</td>
              <td className="name">{money(o.paid)}</td>
            </tr>
          ))}
        </Table>
        {ordersInPeriod.length > 15 && (
          <div className="panel-body" style={{ textAlign: 'center', background: '#fcfdfc' }}>
            <small>Đang hiển thị 15 đơn tiêu biểu. Bấm <b>"Xuất báo cáo CSV"</b> ở góc trên để tải toàn bộ {ordersInPeriod.length} đơn hàng chi tiết trong kỳ.</small>
          </div>
        )}
      </Panel>
    </>
  );
}

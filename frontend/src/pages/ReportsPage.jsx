import { orderInPeriod, consumedOrder } from '../utils/report-period.mjs';

import { calculatePeriodRange, computeCashflow } from '../utils/period.mjs';

import PeriodFilterBar from '../components/PeriodFilterBar';

import React, { useState, useMemo, useEffect } from 'react';

import { Wallet, Trophy, Check, Calendar, TrendingUp, Download, PieChart, BarChart3, Clock, Sparkles, Printer } from 'lucide-react';

import { useCourtly } from '../context';
import { api } from '../services/api';

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

    return calculatePeriodRange({

      periodType,

      selectedDay,

      selectedMonth,

      selectedQuarter,

      selectedQuarterYear,

      selectedYear,

      customStart,

      customEnd

    });

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

  const legacyValue = validOrders.flatMap(o => o.products).reduce((a, p) => a + (p.lineTotal || 0), 0);

  const staffValue = validOrders.flatMap(o => o.staff).reduce((a, s) => a + (s.hours || 1) * (s.rate || 0), 0);

  const tournamentValue = Math.max(0, netTournamentCash);

  const membershipValue = Math.max(0, netMembershipCash);

  const totalValue = courtValue + legacyValue + staffValue + tournamentValue + membershipValue;



  const categories = [

    { name: 'Tiền thuê sân', value: courtValue, color: '#10b981' },

    { name: 'Dịch vụ trọng tài', value: staffValue, color: '#f59e0b' },

    { name: 'Phí giải đấu', value: tournamentValue, color: '#8b5cf6' },



    ...(legacyValue ? [{ name: 'Khoản dịch vụ cũ', value: legacyValue, color: '#94a3b8' }] : [])

  ];



  const [loyaltyReport, setLoyaltyReport] = useState(null);

  useEffect(() => {
    api(`/admin/loyalty/report?startDate=${startDate}&endDate=${endDate}`)
      .then(data => { if (data) setLoyaltyReport(data); })
      .catch(() => {});
  }, [startDate, endDate]);

  // Number of calendar days in period for occupancy calculation

  const periodDays = useMemo(() => {

    const s = new Date(startDate), e = new Date(endDate);

    const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;

    return Math.max(1, Math.min(366, diff));

  }, [startDate, endDate]);



  // Occupancy per court (calculated by actual hours using slotHours)

  const activeCourts = (data.courts || []).filter(c => c.status !== 'DELETED');
  const courtTotal = activeCourts.length;
  const zoneCount = type => activeCourts.filter(c => c.type === type).length;

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



  // Timeline points for Bar Chart

  const timelinePoints = useMemo(() => {

    if (periodType === 'month') {

      const [y, m] = selectedMonth.split('-').map(Number);

      const lastDay = new Date(y, m, 0).getDate();

      const weeks = [

        { label: 'Tuần 1 (01-07)', start: `${selectedMonth}-01`, end: `${selectedMonth}-07` },

        { label: 'Tuần 2 (08-14)', start: `${selectedMonth}-08`, end: `${selectedMonth}-14` },

        { label: 'Tuần 3 (15-21)', start: `${selectedMonth}-15`, end: `${selectedMonth}-21` },

        { label: `Tuần 4 (22-${lastDay})`, start: `${selectedMonth}-22`, end: `${selectedMonth}-${lastDay}` }

      ];

      return weeks.map(w => {

        const wOrders = data.orders.map(o => orderInPeriod(o, w.start, w.end)).filter(Boolean);

        const wRevenue = [...data.payments, ...(data.membershipPayments || [])]

          .filter(p => {

            const d = localDate(p.createdAt || p.paidAt);

            return d >= w.start && d <= w.end;

          })

          .reduce((a, p) => a + p.amount, 0) -

          data.refunds

            .filter(r => {

              const d = localDate(r.createdAt);

              return d >= w.start && d <= w.end;

            })

            .reduce((a, r) => a + r.amount, 0);

        return {

          label: w.label,

          revenue: Math.max(0, wRevenue),

          orders: wOrders.length

        };

      });

    }



    if (periodType === 'year' || periodType === 'quarter') {

      return monthlyBreakdown.map(m => ({

        label: m.label,

        revenue: Math.max(0, m.revenue),

        orders: m.ordersCount

      }));

    }



    if (periodType === 'day') {

      const parts = [

        { label: 'Sáng (06:00–12:00)', start: '06:00', end: '12:00' },

        { label: 'Chiều (12:00–17:00)', start: '12:00', end: '17:00' },

        { label: 'Tối (17:00–21:00)', start: '17:00', end: '21:00' },

        { label: 'Đêm (21:00–23:00)', start: '21:00', end: '23:00' }

      ];

      return parts.map(part => {

        const matchingSlots = validOrders.flatMap(o => o.slots).filter(s => {

          return (s.start || '06:00') >= part.start && (s.start || '06:00') < part.end;

        });

        const rev = matchingSlots.reduce((a, s) => a + (s.price || 0), 0);

        return {

          label: part.label,

          revenue: rev,

          orders: matchingSlots.length

        };

      });

    }



    // Khoảng ngày / Toàn bộ: chia thành các kỳ có ngày thật (không chia tỷ lệ giả).
    // Toàn bộ thời gian = từ ngày phát sinh giao dịch hoặc đơn sớm nhất đến hôm nay.
    // Độ dài ≤ 14 ngày → theo ngày; ≤ 92 ngày → theo tuần (7 ngày tính từ ngày bắt đầu); dài hơn → theo tháng.
    const payDate = p => localDate(p.paidAt || p.createdAt);
    const refundDate = r => localDate(r.refundedAt || r.createdAt);
    let rangeStart = startDate, rangeEnd = endDate;
    if (periodType !== 'custom') {
      const dates = [
        ...data.payments.map(payDate),
        ...(data.membershipPayments || []).map(payDate),
        ...data.refunds.map(refundDate),
        ...data.orders.map(o => o.date)
      ].filter(Boolean).sort();
      const now = today();
      rangeStart = dates[0] && dates[0] < now ? dates[0] : now;
      rangeEnd = dates.length && dates[dates.length - 1] > now ? dates[dates.length - 1] : now;
    }
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) return [];
    const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
    const dm = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
    const spanDays = Math.round((new Date(rangeEnd + 'T00:00:00Z') - new Date(rangeStart + 'T00:00:00Z')) / 86400000) + 1;
    const buckets = [];
    if (spanDays <= 14) {
      for (let d = rangeStart; d <= rangeEnd; d = addDays(d, 1)) buckets.push({ label: dm(d), start: d, end: d });
    } else if (spanDays <= 92) {
      for (let d = rangeStart; d <= rangeEnd; d = addDays(d, 7)) {
        const e = addDays(d, 6) < rangeEnd ? addDays(d, 6) : rangeEnd;
        buckets.push({ label: `${dm(d)}–${dm(e)}`, start: d, end: e });
      }
    } else {
      let [y, m] = rangeStart.slice(0, 7).split('-').map(Number);
      while (`${y}-${String(m).padStart(2, '0')}` <= rangeEnd.slice(0, 7)) {
        const mStr = `${y}-${String(m).padStart(2, '0')}`;
        const first = `${mStr}-01`, last = `${mStr}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
        buckets.push({ label: `Tháng ${m}/${y}`, start: first < rangeStart ? rangeStart : first, end: last > rangeEnd ? rangeEnd : last });
        m++; if (m > 12) { m = 1; y++; }
      }
      // Nhiều tháng thì rút gọn nhãn ("T11/2026") cho vừa trục
      if (buckets.length > 6) buckets.forEach(b => { b.label = b.label.replace('Tháng ', 'T'); });
    }
    return buckets.map(b => {
      const inB = d => d >= b.start && d <= b.end;
      const rev = [...data.payments, ...(data.membershipPayments || [])].filter(p => inB(payDate(p))).reduce((a, p) => a + Number(p.amount || 0), 0)
        - data.refunds.filter(r => inB(refundDate(r))).reduce((a, r) => a + Number(r.amount || 0), 0);
      return {
        label: b.label,
        revenue: Math.max(0, rev),
        orders: data.orders.map(o => orderInPeriod(o, b.start, b.end)).filter(Boolean).length
      };
    });

  }, [periodType, selectedMonth, monthlyBreakdown, data.orders, data.payments, data.refunds, data.membershipPayments, validOrders, startDate, endDate]);



  const maxTimelineRevenue = useMemo(() => {

    return Math.max(1, ...timelinePoints.map(p => p.revenue));

  }, [timelinePoints]);



  // Peak hours distribution (Sáng sớm, Giờ vàng trưa, Giờ cao điểm tối, Đêm muộn)

  const peakHoursDistribution = useMemo(() => {

    const slots = validOrders.flatMap(o => o.slots);

    const groups = [

      { key: 'morning', label: 'Sáng sớm (06:00–09:00)', count: 0, hours: 0, color: '#38bdf8' },

      { key: 'daytime', label: 'Giờ vàng ngày (09:00–16:00)', count: 0, hours: 0, color: '#22c55e' },

      { key: 'prime', label: 'Cao điểm tối (17:00–21:00)', count: 0, hours: 0, color: '#f59e0b' },

      { key: 'late', label: 'Đêm muộn (21:00–23:00)', count: 0, hours: 0, color: '#a855f7' }

    ];



    for (const s of slots) {

      const h = Number(String(s.start || '06:00').split(':')[0]);

      const dur = slotHours(s);

      if (h < 9) {

        groups[0].count++;

        groups[0].hours += dur;

      } else if (h < 17) {

        groups[1].count++;

        groups[1].hours += dur;

      } else if (h < 21) {

        groups[2].count++;

        groups[2].hours += dur;

      } else {

        groups[3].count++;

        groups[3].hours += dur;

      }

    }



    const totalHours = Math.max(1, groups.reduce((a, g) => a + g.hours, 0));

    return groups.map(g => ({

      ...g,

      percent: Math.round((g.hours / totalHours) * 100)

    }));

  }, [validOrders]);



  // Donut slices computation for SVG

  const donutData = useMemo(() => {

    const radius = 64;

    const circumference = 2 * Math.PI * radius; // ~402.12

    let currentOffset = 0;

    const slices = categories.map(cat => {

      const pct = totalValue > 0 ? cat.value / totalValue : 0;

      const strokeDasharray = `${pct * circumference} ${circumference}`;

      const strokeDashoffset = -currentOffset;

      currentOffset += pct * circumference;

      return {

        ...cat,

        pct: Math.round(pct * 100),

        strokeDasharray,

        strokeDashoffset

      };

    });

    return { circumference, slices };

  }, [categories, totalValue]);



  // Print / Export PDF Handler

  useEffect(() => {

    const cleanup = () => {

      document.body.classList.remove('printing-report');

    };

    window.addEventListener('afterprint', cleanup);

    return () => window.removeEventListener('afterprint', cleanup);

  }, []);



  const handlePrintReport = () => {

    document.body.classList.add('printing-report');

    window.print();

  };



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

      ['3. Phí giải đấu', netTournamentCash],

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

      ...categories.map(c => [c.name, c.value]),

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

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>

            <Button onClick={handlePrintReport}>

              <Printer size={16} /> In / Xuất PDF Báo Cáo

            </Button>

            <Button className="primary" onClick={exportCsv}>

              <Download size={16} /> Xuất báo cáo CSV

            </Button>

          </div>

        }

      >

        Báo cáo & Thống kê

      </Title>



      {/* Period Filter Bar */}

      <div className="panel no-print" style={{ marginBottom: 20 }}>

        <PeriodFilterBar

          title="Kỳ báo cáo:"

          periodType={periodType}

          setPeriodType={setPeriodType}

          selectedDay={selectedDay}

          setSelectedDay={setSelectedDay}

          currentToday={currentToday}

          selectedMonth={selectedMonth}

          setSelectedMonth={setSelectedMonth}

          selectedQuarter={selectedQuarter}

          setSelectedQuarter={setSelectedQuarter}

          selectedQuarterYear={selectedQuarterYear}

          setSelectedQuarterYear={setSelectedQuarterYear}

          selectedYear={selectedYear}

          setSelectedYear={setSelectedYear}

          currentYear={currentYear}

          customStart={customStart}

          setCustomStart={setCustomStart}

          customEnd={customEnd}

          setCustomEnd={setCustomEnd}

          periodLabel={periodLabel}

        />

      </div>



      {/* OFFICIAL PRINT-ONLY REPORT HEADER */}

      <div className="report-print-header">

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #173c32', paddingBottom: 14, marginBottom: 16 }}>

          <div>

            <div style={{ fontSize: 22, fontWeight: 800, color: '#173c32', letterSpacing: 0.5 }}>COURTLY TENNIS CLUB</div>

            <div style={{ fontSize: 13, color: '#475569', marginTop: 2, fontWeight: 600 }}>TỔ HỢP QUẦN VỢT TIÊU CHUẨN ATP {courtTotal} SÂN</div>

            <div style={{ fontSize: 12, color: '#64748b' }}>Đ/c: Sân Thể Thao Courtly · Hotline: 0988 123 456 · MST: 0109887766</div>

          </div>

          <div style={{ textAlign: 'right' }}>

            <div style={{ fontSize: 18, fontWeight: 800, color: '#173c32' }}>BÁO CÁO DOANH THU & HIỆU SUẤT VẬN HÀNH</div>

            <div style={{ fontSize: 13, fontWeight: 700, color: '#0284c7', marginTop: 2 }}>Kỳ báo cáo: {periodLabel}</div>

            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>Thời gian: Từ {startDate} đến {endDate} • Ngày xuất: {new Date().toLocaleString('vi-VN')}</div>

          </div>

        </div>

      </div>



      {/* KPI Stats Bar */}

      <div className="stats" style={{ marginBottom: 20 }}>

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

          title="Thu giải đấu"

          value={money(netTournamentCash)}

          note="Phí tham gia giải đấu"

          icon={Trophy}

        />

        <Stat

          title="Đơn hoàn tất trong kỳ"

          value={`${ordersInPeriod.filter(o => o.status === 'COMPLETED').length} / ${ordersInPeriod.length}`}

          note={`Tỷ lệ hoàn tất: ${ordersInPeriod.length ? Math.round(ordersInPeriod.filter(o => o.status === 'COMPLETED').length / ordersInPeriod.length * 100) : 0}%`}

          icon={Check}

        />

      </div>



      {/* BIỂU ĐỒ 1: XU HƯỚNG DOANH THU THEO MỐC THỜI GIAN (SVG BAR & TRENDLINE CHART) */}

      <div style={{

        background: '#ffffff',

        borderRadius: 14,

        padding: '22px 24px',

        marginBottom: 20,

        border: '1px solid #e2e8f0',

        boxShadow: '0 2px 10px rgba(0,0,0,0.04)'

      }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#ecfdf5', color: '#047857', display: 'grid', placeItems: 'center' }}>

              <BarChart3 size={18} />

            </div>

            <div>

              <h3 style={{ margin: 0, fontSize: 16, color: '#173c32', fontWeight: 700 }}>

                Biểu đồ Xu hướng Doanh thu ({periodLabel})

              </h3>

              <small style={{ color: '#64748b' }}>Phân tích dòng tiền thực thu qua các chặng thời gian</small>

            </div>

          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>

            <span style={{ fontSize: 12.5, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>

              <span style={{ width: 12, height: 12, borderRadius: 3, background: 'linear-gradient(180deg, #10b981 0%, #047857 100%)', display: 'inline-block' }} />

              Doanh thu thực thu (₫)

            </span>

            <span style={{ fontSize: 13, fontWeight: 700, color: '#047857', background: '#ecfdf5', padding: '4px 10px', borderRadius: 8 }}>

              Đỉnh: {money(maxTimelineRevenue)}

            </span>

          </div>

        </div>



        {/* SVG Bar Chart Canvas */}

        <div style={{ width: '100%', overflowX: 'auto' }}>

          <svg

            viewBox="0 0 800 248"

            style={{ width: '100%', minWidth: 600, height: 230, overflow: 'visible' }}

          >

            <defs>

              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">

                <stop offset="0%" stopColor="#10b981" />

                <stop offset="100%" stopColor="#047857" />

              </linearGradient>

            </defs>



            {/* Background Grid Lines */}

            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {

              const y = 190 - ratio * 150;

              const val = Math.round(maxTimelineRevenue * ratio);

              return (

                <g key={ratio}>

                  <line x1="60" y1={y} x2="780" y2={y} stroke="#f1f5f9" strokeWidth="1" strokeDasharray={ratio === 0 ? 'none' : '4 4'} />

                  <text x="52" y={y + 4} textAnchor="end" fontSize="11" fill="#94a3b8" fontWeight="500">

                    {val >= 1000000 ? `${(val / 1000000).toFixed(1)} tr` : val > 0 ? `${Math.round(val / 1000)}k` : '0đ'}

                  </text>

                </g>

              );

            })}



            {/* Bars and Labels */}

            {timelinePoints.map((p, idx) => {

              const count = timelinePoints.length;

              const slotWidth = (720 / count);

              const barWidth = Math.min(68, slotWidth * 0.55);

              const xCenter = 60 + (idx + 0.5) * slotWidth;

              const barX = xCenter - barWidth / 2;

              const barHeight = maxTimelineRevenue > 0 ? (p.revenue / maxTimelineRevenue) * 150 : 0;

              const barY = 190 - barHeight;



              return (

                <g key={idx}>

                  {/* The Bar */}

                  <rect

                    x={barX}

                    y={barY}

                    width={barWidth}

                    height={Math.max(4, barHeight)}

                    rx="6"

                    ry="6"

                    fill="url(#barGradient)"

                    style={{ transition: 'all 0.3s ease', cursor: 'pointer' }}

                  >

                    <title>{`${p.label}\nDoanh thu: ${money(p.revenue)}\nSố đơn: ${p.orders}`}</title>

                  </rect>



                  {/* Value on top of bar */}

                  {barHeight > 15 && (

                    <text

                      x={xCenter}

                      y={barY - 8}

                      textAnchor="middle"

                      fontSize="11"

                      fill="#047857"

                      fontWeight="700"

                    >

                      {p.revenue >= 1000000 ? `${(p.revenue / 1000000).toFixed(1)} tr` : `${Math.round(p.revenue / 1000)}k`}

                    </text>

                  )}



                  {/* X-Axis Label */}

                  <text

                    x={xCenter}

                    y="212"

                    textAnchor="middle"

                    fontSize={slotWidth < 60 ? '10' : '11.5'}

                    fill="#475569"

                    fontWeight="600"

                  >

                    {slotWidth < 90 && /^\d\d\/\d\d–\d\d\/\d\d$/.test(p.label)
                      ? p.label.split('–').map((part, i) => (
                          <tspan key={i} x={xCenter} dy={i ? 11 : 0}>{i ? `–${part}` : part}</tspan>
                        ))
                      : p.label}

                  </text>



                  {/* Order count note */}

                  <text

                    x={xCenter}

                    y={slotWidth < 90 && /^\d\d\/\d\d–/.test(p.label) ? 238 : 228}

                    textAnchor="middle"

                    fontSize="10"

                    fill="#94a3b8"

                  >

                    {p.orders} đơn

                  </text>

                </g>

              );

            })}

          </svg>

        </div>

      </div>



      {/* BIỂU ĐỒ 2 & 3: DONUT TỶ TRỌNG DOANH THU & BIỂU ĐỒ KHUNG GIỜ CAO ĐIỂM */}

      <div className="split" style={{ marginBottom: 20 }}>

        {/* DONUT CHART: CƠ CẤU DOANH THU */}

        <Panel title={`Biểu đồ Cơ cấu Doanh thu (${periodLabel})`}>

          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: 20 }}>

              {/* SVG Donut Circle */}

              <div style={{ position: 'relative', width: 170, height: 170, display: 'grid', placeItems: 'center' }}>

                <svg viewBox="0 0 200 200" width="170" height="170" style={{ transform: 'rotate(-90deg)' }}>

                  <circle cx="100" cy="100" r="64" fill="transparent" stroke="#f1f5f9" strokeWidth="24" />

                  {donutData.slices.map((slice, i) => (

                    <circle

                      key={i}

                      cx="100"

                      cy="100"

                      r="64"

                      fill="transparent"

                      stroke={slice.color}

                      strokeWidth="24"

                      strokeDasharray={slice.strokeDasharray}

                      strokeDashoffset={slice.strokeDashoffset}

                      style={{ transition: 'all 0.5s ease' }}

                    >

                      <title>{`${slice.name}: ${money(slice.value)} (${slice.pct}%)`}</title>

                    </circle>

                  ))}

                </svg>

                {/* Center text */}

                <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>

                  <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>

                    TỔNG THU

                  </span>

                  <strong style={{ fontSize: 14, color: '#173c32', display: 'block', marginTop: 2, whiteSpace: 'nowrap' }}>

                    {money(totalValue)}

                  </strong>

                </div>

              </div>



              {/* Legend with percent pills */}

              <div style={{ flex: '1 1 240px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>

                {donutData.slices.map(item => (

                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '6px 10px', background: '#f8fafc', borderRadius: 8 }}>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>

                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, display: 'inline-block', flexShrink: 0 }} />

                      <span style={{ fontSize: 13, color: '#334155', fontWeight: 500, lineHeight: 1.35 }}>{item.name}</span>

                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>

                      <b style={{ fontSize: 13, color: '#0f172a', whiteSpace: 'nowrap' }}>{money(item.value)}</b>

                      <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', background: '#e2e8f0', padding: '1px 6px', borderRadius: 6 }}>

                        {item.pct}%

                      </span>

                    </div>

                  </div>

                ))}

              </div>

            </div>



            <div style={{ paddingTop: 12, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 13 }}>

              <span style={{ color: '#64748b' }}>Trừ tiền hoàn cọc & hủy sân:</span>

              <b style={{ color: '#dc2626', whiteSpace: 'nowrap' }}>−{money(refundsInPeriod.reduce((a, r) => a + r.amount, 0))}</b>

            </div>

          </div>

        </Panel>



        {/* PEAK HOURS DISTRIBUTION CHART */}

        <Panel title="Phân bố Khung giờ Cao điểm">

          <div className="panel-body">

            <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#64748b', lineHeight: 1.5 }}>

              Thống kê mật độ giờ chơi thực tế trên toàn bộ {courtTotal} sân để tối ưu nhân sự lễ tân và thời gian bật đèn LED cao áp.

            </p>



            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {peakHoursDistribution.map(group => (

                <div key={group.key}>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 5 }}>

                    <span style={{ fontSize: 13, fontWeight: 600, color: '#334155', minWidth: 0 }}>{group.label}</span>

                    <span style={{ fontSize: 12.5, fontWeight: 700, color: group.color, whiteSpace: 'nowrap', flexShrink: 0 }}>

                      {group.hours} giờ chơi · <strong>{group.percent}%</strong>

                    </span>

                  </div>

                  <div style={{ width: '100%', height: 10, background: '#f1f5f9', borderRadius: 10, overflow: 'hidden' }}>

                    <div

                      style={{

                        width: `${group.percent}%`,

                        height: '100%',

                        background: group.color,

                        borderRadius: 10,

                        transition: 'width 0.4s ease'

                      }}

                    />

                  </div>

                </div>

              ))}

            </div>



            <div style={{ marginTop: 18, padding: '10px 14px', background: '#fef3c7', borderRadius: 8, border: '1px solid #fde68a', fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>

              <Sparkles size={16} />

              <span>Khung giờ <strong>17:00 – 21:00</strong> là khung giờ vàng đạt công suất cao nhất tại cả 3 phân khu.</span>

            </div>

          </div>

        </Panel>

      </div>



      {/* BIỂU ĐỒ 4: TRỰC QUAN CÔNG SUẤT CÁC SÂN THEO 3 PHÂN KHU */}

      <Panel title={`Biểu đồ Công suất Khai thác ${courtTotal} Sân (${periodLabel}) · Trung bình ${avgOccupancy}%`} style={{ marginBottom: 24 }}>

        <div className="panel-body">

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>

            {/* Phân khu A - Ngoài trời */}

            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid #cbd5e1', paddingBottom: 6 }}>

                <strong style={{ fontSize: 13.5, color: '#166534' }}>Khu A · Ngoài trời ({zoneCount('OUTDOOR')} sân)</strong>

                <span style={{ fontSize: 11.5, color: '#64748b' }}>Đèn LED 500 Lux</span>

              </div>

              {courtOccupancy.filter(c => c.type === 'OUTDOOR' || (!c.type && c.name.startsWith('A'))).map(c => (

                <div key={c.id} style={{ marginBottom: 10 }}>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>

                    <span style={{ fontWeight: 600, color: '#334155' }}>{c.name}</span>

                    <span style={{ fontWeight: 700, color: '#166534' }}>{c.used}h / {c.totalPossible}h ({c.percent}%)</span>

                  </div>

                  <div style={{ width: '100%', height: 8, background: '#e2e8f0', borderRadius: 6, overflow: 'hidden' }}>

                    <div style={{ width: `${c.percent}%`, height: '100%', background: '#22c55e', borderRadius: 6 }} />

                  </div>

                </div>

              ))}

            </div>



            {/* Phân khu B - Trong nhà */}

            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid #cbd5e1', paddingBottom: 6 }}>

                <strong style={{ fontSize: 13.5, color: '#0369a1' }}>Khu B · Trong nhà ({zoneCount('INDOOR')} sân)</strong>

                <span style={{ fontSize: 11.5, color: '#64748b' }}>Mái che vòm 12m</span>

              </div>

              {courtOccupancy.filter(c => c.type === 'INDOOR').map(c => (

                <div key={c.id} style={{ marginBottom: 10 }}>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>

                    <span style={{ fontWeight: 600, color: '#334155' }}>{c.name}</span>

                    <span style={{ fontWeight: 700, color: '#0369a1' }}>{c.used}h / {c.totalPossible}h ({c.percent}%)</span>

                  </div>

                  <div style={{ width: '100%', height: 8, background: '#e2e8f0', borderRadius: 6, overflow: 'hidden' }}>

                    <div style={{ width: `${c.percent}%`, height: '100%', background: '#0284c7', borderRadius: 6 }} />

                  </div>

                </div>

              ))}

            </div>



            {/* Phân khu V - VIP */}

            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid #cbd5e1', paddingBottom: 6 }}>

                <strong style={{ fontSize: 13.5, color: '#a16207' }}>Khu V · VIP Clubhouse ({zoneCount('VIP')} sân)</strong>

                <span style={{ fontSize: 11.5, color: '#64748b' }}>Lounge thương gia</span>

              </div>

              {courtOccupancy.filter(c => c.type === 'VIP').map(c => (

                <div key={c.id} style={{ marginBottom: 10 }}>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>

                    <span style={{ fontWeight: 600, color: '#334155' }}>{c.name}</span>

                    <span style={{ fontWeight: 700, color: '#a16207' }}>{c.used}h / {c.totalPossible}h ({c.percent}%)</span>

                  </div>

                  <div style={{ width: '100%', height: 8, background: '#e2e8f0', borderRadius: 6, overflow: 'hidden' }}>

                    <div style={{ width: `${c.percent}%`, height: '100%', background: '#eab308', borderRadius: 6 }} />

                  </div>

                </div>

              ))}

            </div>

          </div>

        </div>

      </Panel>



      {/* If Year or Quarter, display monthly breakdown */}

      {monthlyBreakdown.length > 0 && (

        <Panel title={`Bảng Thống kê chi tiết theo tháng (${periodLabel})`} style={{ marginBottom: 24 }}>

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

      <Panel title={`Danh sách đơn hàng trong kỳ (${ordersInPeriod.length} đơn)`}>

        <Table headings={['Mã đơn', 'Khách hàng', 'Ngày chơi trong kỳ', 'Trạng thái đơn', 'Tổng cả đơn', 'Đã thu cả đơn']} empty={!ordersInPeriod.length}>

          {ordersInPeriod.slice(0, 15).map(o => (

            <tr key={o.id}>

              <td>

                <b>{o.id.slice(0, 8).toUpperCase()}</b>

                <small>{o.phone}</small>

              </td>

              <td className="name">{o.name}</td>

              <td>{[...new Set(o.slots.map(s => s.date || o.date))].sort().join(", ")}</td>

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

      {/* LOYALTY REPORT PANEL */}
      <Panel title={`Báo cáo Thành viên & Điểm thưởng (${periodLabel})`}>
        <div className="panel-body" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>TỔNG THÀNH VIÊN THEO HẠNG</span>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, background: '#f1f5f9', padding: '2px 8px', borderRadius: 12 }}>🎾 Rookie: <b>{loyaltyReport?.tierCounts?.ROOKIE || 0}</b></span>
                <span style={{ fontSize: 12, background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 12 }}>⭐ Challenger: <b>{loyaltyReport?.tierCounts?.CHALLENGER || 0}</b></span>
                <span style={{ fontSize: 12, background: '#ede9fe', color: '#6d28d9', padding: '2px 8px', borderRadius: 12 }}>🏆 Masters: <b>{loyaltyReport?.tierCounts?.MASTERS || 0}</b></span>
                <span style={{ fontSize: 12, background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: 12 }}>👑 Grand Slam: <b>{loyaltyReport?.tierCounts?.GRAND_SLAM || 0}</b></span>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>ĐIỂM PHÁT RA TRONG KỲ</span>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>
                +{loyaltyReport?.pointsIssued || 0} <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>pts</span>
              </div>
              <small style={{ color: '#64748b' }}>Tích từ các đơn thu đủ & quà thăng hạng</small>
            </div>

            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>ĐIỂM ĐÃ SỬ DỤNG (ĐỔI THƯỞNG)</span>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#2563eb', marginTop: 4 }}>
                {loyaltyReport?.pointsRedeemed || 0} <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>pts</span>
              </div>
              <small style={{ color: '#2563eb', fontWeight: 600 }}>Quy đổi: {money(loyaltyReport?.pointsRedeemedValue || 0)}</small>
            </div>

            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>TỶ LỆ GIỮ HẠNG / HẾT HẠN</span>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                {loyaltyReport?.retentionRate != null ? `${loyaltyReport.retentionRate}%` : '—'}
              </div>
              <small style={{ color: '#94a3b8' }}>{loyaltyReport?.tierHolders ? `${loyaltyReport.tierKeeping}/${loyaltyReport.tierHolders} hội viên đủ chi tiêu giữ hạng · ` : ''}Điểm hết hạn: {loyaltyReport?.pointsExpired || 0} pts</small>
            </div>
          </div>
        </div>
      </Panel>




      {/* OFFICIAL PRINT-ONLY REPORT SIGNATURES FOOTER */}

      <div className="report-print-footer">

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', textAlign: 'center', marginTop: 32, paddingTop: 16, borderTop: '1px solid #cbd5e1' }}>

          <div>

            <b style={{ fontSize: 13, color: '#0f172a' }}>NGƯỜI LẬP BÁO CÁO</b>

            <div style={{ fontSize: 11.5, color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>(Ký, ghi rõ họ tên)</div>

            <div style={{ height: 64 }} />

            <span style={{ fontSize: 13, fontWeight: 600, color: '#173c32' }}>Ban Vận Hành CLB</span>

          </div>

          <div>

            <b style={{ fontSize: 13, color: '#0f172a' }}>KẾ TOÁN TRƯỞNG</b>

            <div style={{ fontSize: 11.5, color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>(Ký, ghi rõ họ tên)</div>

            <div style={{ height: 64 }} />

            <span style={{ fontSize: 13, fontWeight: 600, color: '#173c32' }}>Phòng Tài chính - Kế toán</span>

          </div>

          <div>

            <b style={{ fontSize: 13, color: '#0f172a' }}>GIÁM ĐỐC / CHỦ SÂN DUYỆT</b>

            <div style={{ fontSize: 11.5, color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>(Ký, đóng dấu)</div>

            <div style={{ height: 64 }} />

            <span style={{ fontSize: 13, fontWeight: 600, color: '#173c32' }}>Courtly Tennis Club</span>

          </div>

        </div>

      </div>

    </>

  );

}


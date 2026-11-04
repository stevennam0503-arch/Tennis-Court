export function calculatePeriodRange({
  periodType = 'month',
  selectedDay,
  selectedMonth,
  selectedQuarter,
  selectedQuarterYear,
  selectedYear,
  customStart,
  customEnd
}) {
  if (periodType === 'day') {
    const parts = (selectedDay || '').split('-');
    const label = parts.length === 3 ? `Ngày ${parts[2]}/${parts[1]}/${parts[0]}` : `Ngày ${selectedDay}`;
    return {
      startDate: selectedDay,
      endDate: selectedDay,
      periodLabel: label
    };
  }
  if (periodType === 'month') {
    const [y, m] = (selectedMonth || '').split('-');
    const lastDay = new Date(Number(y), Number(m), 0).getDate();
    return {
      startDate: `${y}-${m}-01`,
      endDate: `${y}-${m}-${String(lastDay).padStart(2, '0')}`,
      periodLabel: `Tháng ${m}/${y}`
    };
  }
  if (periodType === 'quarter') {
    const q = Number(String(selectedQuarter || 'Q1').replace('Q', ''));
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
}

export function computeCashflow({
  payments = [],
  refunds = [],
  membershipPayments = [],
  startDate,
  endDate,
  localDateFn = (d) => String(d || '').slice(0, 10)
}) {
  const paymentsInPeriod = payments.filter(p => {
    const d = localDateFn(p.paidAt || p.createdAt);
    return d >= startDate && d <= endDate;
  });

  const refundsInPeriod = refunds.filter(r => {
    const d = localDateFn(r.refundedAt || r.createdAt);
    return d >= startDate && d <= endDate;
  });

  const membershipPaymentsInPeriod = membershipPayments.filter(p => {
    const d = localDateFn(p.paidAt || p.createdAt);
    return d >= startDate && d <= endDate;
  });

  const orderAndTournIncome = paymentsInPeriod.reduce((a, p) => a + Number(p.amount || 0), 0);
  const memIncome = membershipPaymentsInPeriod.reduce((a, p) => a + Number(p.amount || 0), 0);
  const totalIncome = orderAndTournIncome + memIncome;
  const totalRefund = refundsInPeriod.reduce((a, r) => a + Number(r.amount || 0), 0);
  const netCash = totalIncome - totalRefund;

  return {
    paymentsInPeriod,
    refundsInPeriod,
    membershipPaymentsInPeriod,
    totalIncome,
    memIncome,
    totalRefund,
    netCash
  };
}

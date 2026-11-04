import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePeriodRange, computeCashflow } from '../frontend/src/utils/period.mjs';

test('calculatePeriodRange computes correct month range and label', () => {
  const res = calculatePeriodRange({
    periodType: 'month',
    selectedMonth: '2026-11'
  });
  assert.equal(res.startDate, '2026-11-01');
  assert.equal(res.endDate, '2026-11-30');
  assert.equal(res.periodLabel, 'Tháng 11/2026');
});

test('calculatePeriodRange computes all-time range and label', () => {
  const res = calculatePeriodRange({ periodType: 'all' });
  assert.equal(res.startDate, '1970-01-01');
  assert.equal(res.endDate, '2099-12-31');
  assert.equal(res.periodLabel, 'Toàn bộ thời gian');
});

test('computeCashflow filters correctly by period and calculates net cash', () => {
  const payments = [
    { id: 'p1', amount: 300000, paidAt: '2026-11-05T09:00:00Z' },
    { id: 'p2', amount: 200000, paidAt: '2026-10-25T09:00:00Z' }
  ];
  const refunds = [
    { id: 'r1', amount: 50000, refundedAt: '2026-11-10T10:00:00Z' },
    { id: 'r2', amount: 40000, refundedAt: '2026-10-28T10:00:00Z' }
  ];
  const membershipPayments = [
    { id: 'm1', amount: 150000, paidAt: '2026-11-02T08:00:00Z' }
  ];

  const nov = computeCashflow({
    payments,
    refunds,
    membershipPayments,
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    localDateFn: (d) => d.slice(0, 10)
  });

  assert.equal(nov.totalIncome, 450000); // 300k + 150k
  assert.equal(nov.totalRefund, 50000);
  assert.equal(nov.memIncome, 150000);
  assert.equal(nov.netCash, 400000); // 450k - 50k
});

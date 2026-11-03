import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOverdueDebt } from '../frontend/src/utils/order-timing.mjs';

test('isOverdueDebt: đơn đang chơi hôm nay còn thiếu tiền -> không nợ quá hạn', () => {
  // Giả sử hiện tại là 15:00 ngày 2026-11-03
  const now = new Date('2026-11-03T15:00:00+07:00');
  const today = '2026-11-03';

  const orderPlaying = {
    id: 'CT-11111111',
    status: 'CHECKED_IN',
    total: 300000,
    paid: 150000, // Đã cọc 50%, còn thiếu 50%
    date: today,
    slots: [
      { date: today, start: '14:00', end: '16:00' }
    ]
  };

  assert.equal(isOverdueDebt(orderPlaying, today, now), false, 'Đang chơi hôm nay chưa hết giờ không bị coi là nợ quá hạn');
});

test('isOverdueDebt: đơn hôm nay vừa hết giờ trong vòng 15 phút ân hạn -> không nợ quá hạn', () => {
  // Kết thúc lúc 16:00, hiện tại là 16:10 (còn trong 15p ân hạn)
  const now = new Date('2026-11-03T16:10:00+07:00');
  const today = '2026-11-03';

  const orderGrace = {
    id: 'CT-13131313',
    status: 'CHECKED_IN',
    total: 300000,
    paid: 150000,
    date: today,
    slots: [
      { date: today, start: '14:00', end: '16:00' }
    ]
  };

  assert.equal(isOverdueDebt(orderGrace, today, now), false, 'Trong thời gian ân hạn 15 phút chưa bị coi là nợ quá hạn');
});

test('isOverdueDebt: đơn hôm nay đã hết giờ quá 15 phút ân hạn -> nợ quá hạn', () => {
  // Kết thúc lúc 16:00, hiện tại là 16:20 (quá 15p ân hạn)
  const now = new Date('2026-11-03T16:20:00+07:00');
  const today = '2026-11-03';

  const orderOverdue = {
    id: 'CT-OVERDUE-1',
    status: 'CHECKED_IN',
    total: 300000,
    paid: 150000,
    date: today,
    slots: [
      { date: today, start: '14:00', end: '16:00' }
    ]
  };

  assert.equal(isOverdueDebt(orderOverdue, today, now), true, 'Quá 15 phút ân hạn mà chưa tất toán là nợ quá hạn');
});

test('isOverdueDebt: đơn hôm qua đã kết thúc còn thiếu tiền -> nợ quá hạn', () => {
  const now = new Date('2026-11-03T15:00:00+07:00');
  const today = '2026-11-03';

  const orderYesterday = {
    id: 'CT-82828282',
    status: 'CHECKED_IN',
    total: 1500000,
    paid: 500000,
    date: '2026-11-02',
    slots: [
      { date: '2026-11-02', start: '17:00', end: '19:00' }
    ]
  };

  assert.equal(isOverdueDebt(orderYesterday, today, now), true, 'Đơn ngày hôm qua còn thiếu tiền là nợ quá hạn');
});

test('isOverdueDebt: đơn 2 ngày trước (như Sân A03 Thảo Lê) còn thiếu tiền -> nợ quá hạn', () => {
  const now = new Date('2026-11-03T15:00:00+07:00');
  const today = '2026-11-03';

  const orderThaoLe = {
    id: 'CT-81818181',
    status: 'CHECKED_IN',
    total: 600000,
    paid: 300000,
    date: '2026-11-01',
    slots: [
      { date: '2026-11-01', start: '16:00', end: '18:00' }
    ]
  };

  assert.equal(isOverdueDebt(orderThaoLe, today, now), true, 'Đơn cũ 2 ngày trước còn thiếu tiền là nợ quá hạn');
});

test('isOverdueDebt: đơn COMPLETED còn thiếu tiền -> nợ quá hạn', () => {
  const now = new Date('2026-11-03T15:00:00+07:00');
  const today = '2026-11-03';

  const orderCompletedUnpaid = {
    id: 'CT-COMPLETED-UNPAID',
    status: 'COMPLETED',
    total: 400000,
    paid: 200000,
    date: today,
    slots: [
      { date: today, start: '18:00', end: '20:00' } // Kể cả giờ tương lai, COMPLETED mà thiếu là nợ
    ]
  };

  assert.equal(isOverdueDebt(orderCompletedUnpaid, today, now), true, 'Đơn COMPLETED mà còn thiếu tiền là nợ quá hạn');
});

test('isOverdueDebt: đơn đã thu đủ 100% tiền -> không nợ quá hạn', () => {
  const now = new Date('2026-11-03T15:00:00+07:00');
  const today = '2026-11-03';

  const orderPaid = {
    id: 'CT-PAID',
    status: 'CHECKED_IN',
    total: 300000,
    paid: 300000,
    date: '2026-11-01',
    slots: [
      { date: '2026-11-01', start: '14:00', end: '16:00' }
    ]
  };

  assert.equal(isOverdueDebt(orderPaid, today, now), false, 'Đã thu đủ 100% không bị nợ');
});

test('isOverdueDebt: đơn CANCELLED hoặc EXPIRED hoặc HOLDING -> không nợ quá hạn', () => {
  const now = new Date('2026-11-03T15:00:00+07:00');
  const today = '2026-11-03';

  assert.equal(isOverdueDebt({ status: 'CANCELLED', total: 500000, paid: 0 }, today, now), false);
  assert.equal(isOverdueDebt({ status: 'EXPIRED', total: 500000, paid: 0 }, today, now), false);
  assert.equal(isOverdueDebt({ status: 'HOLDING', total: 500000, paid: 0 }, today, now), false);
});

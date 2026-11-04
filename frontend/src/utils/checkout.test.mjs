import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCheckoutBreakdown } from './checkout.mjs';

test('buildCheckoutBreakdown correctly calculates all 5 line items and matches totalAmount', () => {
  const mockOrder = {
    subtotal: 300000,
    totalExtensionMinutes: 30,
    totalExtensionFee: 150000,
    tierDiscount: 15000,
    tierBenefit: { planName: 'Masters', discount: 15000 },
    voucherBenefit: { code: 'TEST50K', discount: 50000 },
    pointsDiscount: 50000,
    pointsRedeemed: 500,
    refereeFee: 200000,
    totalAmount: 535000,
    paidAmount: 200000
  };

  const b = buildCheckoutBreakdown(mockOrder);

  assert.equal(b.courtBase, 300000);
  assert.equal(b.extFee, 150000);
  assert.equal(b.extMinutes, 30);
  assert.equal(b.tierDiscount, 15000);
  assert.equal(b.tierPlanName, 'Masters');
  assert.equal(b.voucherDiscount, 50000);
  assert.equal(b.voucherCode, 'TEST50K');
  assert.equal(b.pointsDiscount, 50000);
  assert.equal(b.pointsRedeemed, 500);
  assert.equal(b.refereeFee, 200000);

  // Assert auditing equation: Tiền sân + Gia hạn - Hạng - Voucher - Điểm + Trọng tài = Tổng tiền
  const sumOfLines = b.courtBase + b.extFee - b.tierDiscount - b.voucherDiscount - b.pointsDiscount + b.refereeFee;
  assert.equal(sumOfLines, b.totalAmount, 'Tổng các dòng tính toán phải đúng khớp 100% với totalAmount');
  assert.equal(b.totalAmount, 535000);

  // Assert paid & remaining due
  assert.equal(b.paidAmount, 200000);
  assert.equal(b.remainingDue, 335000);
  assert.equal(b.excessRefund, 0);
});

test('buildCheckoutBreakdown handles order without extensions or referee and still balances', () => {
  const simpleOrder = {
    subtotal: 200000,
    totalAmount: 150000,
    voucherBenefit: { code: 'WELCOME-50K', discount: 50000 },
    paidAmount: 100000
  };

  const b = buildCheckoutBreakdown(simpleOrder);

  const sumOfLines = b.courtBase + b.extFee - b.tierDiscount - b.voucherDiscount - b.pointsDiscount + b.refereeFee;
  assert.equal(sumOfLines, b.totalAmount);
  assert.equal(b.remainingDue, 50000);
});

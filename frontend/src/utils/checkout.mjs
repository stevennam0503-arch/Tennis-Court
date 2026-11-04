/**
 * Utility to compute the exact checkout line-item breakdown matching the order's DB total.
 * Tiền sân + Gia hạn − Hạng − Voucher − Điểm + Trọng tài = Tổng tiền.
 */
export function buildCheckoutBreakdown(order) {
  if (!order) return null;

  // 1. Phí gia hạn sân (nếu có):
  const extMinutes = Number(
    order.totalExtensionMinutes ||
    (order.extensionHistory?.reduce((acc, h) => acc + (h.duration || 0), 0)) ||
    0
  );
  const extFee = Number(
    order.totalExtensionFee ||
    (order.extensionHistory?.reduce((acc, h) => acc + (h.fee || 0), 0)) ||
    0
  );

  // 2. Giảm theo hạng:
  const tierBenefit = order.tierBenefit || order.membershipBenefit;
  const tierDiscount = Number(order.tierDiscount || tierBenefit?.discount || 0);
  const tierPlanName = tierBenefit?.planName || tierBenefit?.tierName || 'Ưu đãi hạng thành viên';

  // 3. Voucher:
  const voucherBenefit = order.voucherBenefit;
  const voucherDiscount = Number(voucherBenefit?.discount || 0);
  const voucherCode = voucherBenefit?.code || '';

  // 4. Điểm thưởng:
  const pointsDiscount = Number(order.pointsDiscount || (order.pointsRedeemed ? order.pointsRedeemed * 100 : 0));
  const pointsRedeemed = Number(order.pointsRedeemed || (pointsDiscount ? Math.round(pointsDiscount / 100) : 0));

  // 5. Phí trọng tài:
  let refereeFee = Number(order.refereeFee || 0);
  if (refereeFee <= 0 && Array.isArray(order.staff)) {
    refereeFee = order.staff.reduce((sum, st) => sum + (Number(st.rate || 0) * Number(st.hours || 0)), 0);
  }

  // 6. Tổng tiền chuẩn từ đơn DB:
  const totalAmount = Number(
    order.totalAmount != null ? order.totalAmount : (order.total != null ? order.total : 0)
  );

  // Tiền sân ban đầu:
  // Nếu order có subtotal, ưu tiên dùng. Nếu không, tính từ các slot hoặc deduce từ totalAmount để đảm bảo khớp 100%.
  let courtBase = Number(order.subtotal || 0);
  if (courtBase <= 0 && Array.isArray(order.slots) && order.slots.length > 0) {
    courtBase = order.slots.reduce((sum, s) => sum + Number(s.price || 0), 0);
  }

  // Kiểm toán tổng các dòng:
  const calculatedTotal = courtBase + extFee - tierDiscount - voucherDiscount - pointsDiscount + refereeFee;
  if (courtBase <= 0 || Math.abs(calculatedTotal - totalAmount) >= 1) {
    // Đảm bảo Tiền sân ban đầu cân bằng chính xác với totalAmount
    courtBase = Math.max(0, totalAmount - extFee + tierDiscount + voucherDiscount + pointsDiscount - refereeFee);
  }

  const paidAmount = Number(order.paidAmount != null ? order.paidAmount : (order.paid != null ? order.paid : 0));
  const remainingDue = Math.max(0, totalAmount - paidAmount);
  const excessRefund = Math.max(0, paidAmount - totalAmount);

  return {
    courtBase,
    extMinutes,
    extFee,
    tierDiscount,
    tierPlanName,
    voucherDiscount,
    voucherCode,
    pointsDiscount,
    pointsRedeemed,
    refereeFee,
    totalAmount,
    paidAmount,
    remainingDue,
    excessRefund
  };
}

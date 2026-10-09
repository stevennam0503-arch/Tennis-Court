package com.courtly.service;

import com.courtly.dto.request.*;
import com.courtly.entity.*;
import com.courtly.exception.BusinessException;
import com.courtly.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.*;
import java.time.Instant;
import java.util.*;
import static com.courtly.util.Rules.*;

@Service
@RequiredArgsConstructor
public class PaymentService {
    private final PaymentRepository payments;
    private final RefundRepository refunds;
    private final CustomerOrderRepository orders;
    private final TournamentRegistrationRepository registrations;
    private final TournamentMatchRepository matches;
    private final BookingRepository bookings;
    private final BookingSlotRepository slots;
    private final OrderTotalsService totals;
    private final AuditService audit;

    public BigDecimal net(Payment payment) {
        return payment.getAmount().subtract(refunds.findByPaymentId(payment.getId()).stream()
                .map(Refund::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add));
    }
    public BigDecimal registrationPaid(UUID id) {
        return payments.findByRegistrationId(id).stream().map(this::net).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    @Transactional
    public UUID collect(PaymentRequest request) {
        require((request.orderId() == null) != (request.registrationId() == null), "Chỉ chọn một đơn hoặc đăng ký giải");
        var existing = payments.findByTransactionCode(request.transactionCode());
        if (existing.isPresent()) {
            Payment old = existing.get();
            require(Objects.equals(old.getOrder() == null ? null : old.getOrder().getId(), request.orderId())
                    && Objects.equals(old.getRegistration() == null ? null : old.getRegistration().getId(), request.registrationId())
                    && old.getAmount().compareTo(request.amount()) == 0 && old.getMethod().equals(request.method()), "Mã giao dịch đã dùng cho khoản thu khác");
            return old.getId();
        }
        Payment payment = new Payment();
        payment.setAmount(positive(request.amount()));
        payment.setMethod(oneOf(request.method(), "CASH", "BANK_TRANSFER"));
        payment.setTransactionCode(text(request.transactionCode(), "Mã giao dịch"));
        payment.setPaidAt(Instant.now());
        if (request.orderId() != null) {
            CustomerOrder order = orders.findForUpdate(request.orderId()).orElseThrow(() -> new BusinessException("Đơn không tồn tại"));
            require(active(order.getStatus()), "Đơn đã kết thúc");
            require(!"HOLDING".equals(order.getStatus()) || order.getHoldExpiresAt().isAfter(Instant.now()), "Đơn đã hết hạn giữ chỗ");
            require(payment.getAmount().compareTo(order.getTotalAmount().subtract(order.getPaidAmount())) <= 0, "Thu vượt số tiền còn thiếu");
            payment.setOrder(order);
            payment.setType(order.getPaidAmount().compareTo(order.getDepositRequired()) < 0 ? "DEPOSIT" : "BALANCE");
            order.setPaidAmount(order.getPaidAmount().add(payment.getAmount()));
            if ("HOLDING".equals(order.getStatus()) && order.getPaidAmount().compareTo(order.getDepositRequired()) >= 0) {
                order.setStatus("CONFIRMED");
                for (Booking b : bookings.findByOrderId(order.getId())) {
                    b.setStatus("CONFIRMED");
                    slots.findByBookingId(b.getId()).stream().filter(x -> x.getReleasedAt() == null).forEach(x -> x.getSchedule().setStatus("BOOKED"));
                }
            }
            totals.updatePaymentStatus(order);
        } else {
            var registration = registrations.findForUpdate(request.registrationId()).orElseThrow(() -> new BusinessException("Đăng ký không tồn tại"));
            require(!"CANCELLED".equals(registration.getStatus()) && !"CANCELLED".equals(registration.getTournament().getStatus()), "Đăng ký hoặc giải đã hủy");
            BigDecimal paid = registrationPaid(registration.getId());
            BigDecimal fee = registration.getTournament().getRegistrationFee();
            require(payment.getAmount().compareTo(fee.subtract(paid)) <= 0, "Thu vượt phí còn thiếu");
            payment.setRegistration(registration);
            payment.setType("TOURNAMENT_FEE");
            if (paid.add(payment.getAmount()).compareTo(fee) >= 0) registration.setStatus("CONFIRMED");
        }
        payments.save(payment);
        audit.log("THU TIỀN", payment.getId().toString());
        return payment.getId();
    }

    @Transactional
    public UUID refund(UUID id, RefundRequest request) {
        Payment original = payments.findById(id).orElseThrow(() -> new BusinessException("Không tìm thấy giao dịch"));
        CustomerOrder order = original.getOrder() == null ? null : orders.findForUpdate(original.getOrder().getId()).orElseThrow();
        TournamentRegistration reg = original.getRegistration() == null ? null : registrations.findForUpdate(original.getRegistration().getId()).orElseThrow();
        Payment payment = payments.findForUpdate(id).orElseThrow();
        BigDecimal amount = positive(request.amount());
        require(amount.compareTo(net(payment)) <= 0, "Tổng hoàn vượt số tiền đã thu còn lại");
        if (reg != null) require(matches.findByTournamentId(reg.getTournament().getId()).isEmpty()
                || "CANCELLED".equals(reg.getTournament().getStatus()), "Hủy giải trước khi hoàn phí của giải đã bốc thăm");
        Refund refund = new Refund();
        refund.setPayment(payment);
        refund.setAmount(amount);
        refund.setReason(text(request.reason(), "Lý do hoàn"));
        refund.setRefundedAt(Instant.now());
        refunds.save(refund);
        if (order != null) {
            order.setPaidAmount(order.getPaidAmount().subtract(amount));
            totals.updatePaymentStatus(order);
        }
        if (reg != null) reg.setStatus("PENDING");
        audit.log("HOÀN TIỀN", refund.getId().toString());
        return refund.getId();
    }
}

package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.dto.request.*;
import com.courtly.entity.*;
import com.courtly.exception.BusinessException;
import com.courtly.repository.*;
import java.math.*;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PaymentService {
  @org.springframework.beans.factory.annotation.Autowired private DocumentService documents;
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
    return payment
        .getAmount()
        .subtract(
            refunds.findByPaymentId(payment.getId()).stream()
                .map(Refund::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
  }

  public BigDecimal registrationPaid(UUID id) {
    return payments.findByRegistrationId(id).stream()
        .map(this::net)
        .reduce(BigDecimal.ZERO, BigDecimal::add);
  }

  @Transactional
  public UUID collect(PaymentRequest request) {
    return collect(request, null);
  }

  @Transactional
  public UUID collect(PaymentRequest request, Account cashier) {
    require(
        (request.orderId() == null) != (request.registrationId() == null),
        "Chỉ chọn một đơn hoặc đăng ký giải");
    if (documents != null)
      require(
          documents.list("membership-payment:").stream()
              .noneMatch(p -> request.transactionCode().equals(p.get("transactionCode"))),
          "Mã giao dịch đã dùng cho phí hội viên");
    var existing = payments.findByTransactionCode(request.transactionCode());
    if (existing.isPresent()) {
      Payment old = existing.get();
      require(
          Objects.equals(old.getOrder() == null ? null : old.getOrder().getId(), request.orderId())
              && Objects.equals(
                  old.getRegistration() == null ? null : old.getRegistration().getId(),
                  request.registrationId())
              && old.getAmount().compareTo(request.amount()) == 0
              && old.getMethod().equals(request.method()),
          "Mã giao dịch đã dùng cho khoản thu khác");
      return old.getId();
    }
    Payment payment = new Payment();
    payment.setAmount(positive(request.amount()));
    payment.setMethod(oneOf(request.method(), "CASH", "BANK_TRANSFER"));
    payment.setTransactionCode(text(request.transactionCode(), "Mã giao dịch"));
    payment.setPaidAt(Instant.now());
    payment.setReceivedByAccount(cashier);
    if (request.orderId() != null) {
      CustomerOrder order =
          orders
              .findForUpdate(request.orderId())
              .orElseThrow(() -> new BusinessException("Đơn không tồn tại"));
      if (Set.of("EXPIRED", "CANCELLED").contains(order.getStatus()))
        text(request.reason(), "Lý do ghi nhận tiền đến muộn");
      else
        require(
            active(order.getStatus()) || "COMPLETED".equals(order.getStatus()),
            "Đơn không nhận thanh toán");
      require(
          !"HOLDING".equals(order.getStatus()) || order.getHoldExpiresAt().isAfter(Instant.now()),
          "Đơn vừa hết hạn. Tải lại và ghi nhận đối soát");
      require(
          payment.getAmount().compareTo(order.getTotalAmount().subtract(order.getPaidAmount()))
              <= 0,
          "Thu vượt số tiền còn thiếu");
      payment.setOrder(order);
      payment.setType(
          order.getPaidAmount().compareTo(order.getDepositRequired()) < 0 ? "DEPOSIT" : "BALANCE");
      order.setPaidAmount(order.getPaidAmount().add(payment.getAmount()));
      if ("HOLDING".equals(order.getStatus())
          && order.getPaidAmount().compareTo(order.getDepositRequired()) >= 0) {
        order.setStatus("CONFIRMED");
        for (Booking b : bookings.findByOrderId(order.getId())) {
          b.setStatus("CONFIRMED");
          slots.findByBookingId(b.getId()).stream()
              .filter(x -> x.getReleasedAt() == null)
              .forEach(x -> x.getSchedule().setStatus("BOOKED"));
        }
      }
      totals.updatePaymentStatus(order);
    } else {
      var registration =
          registrations
              .findForUpdate(request.registrationId())
              .orElseThrow(() -> new BusinessException("Đăng ký không tồn tại"));
      require(
          !"CANCELLED".equals(registration.getStatus())
              && !"CANCELLED".equals(registration.getTournament().getStatus()),
          "Đăng ký hoặc giải đã hủy");
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
    Payment original =
        payments.findById(id).orElseThrow(() -> new BusinessException("Không tìm thấy giao dịch"));
    CustomerOrder order =
        original.getOrder() == null
            ? null
            : orders.findForUpdate(original.getOrder().getId()).orElseThrow();
    TournamentRegistration reg =
        original.getRegistration() == null
            ? null
            : registrations.findForUpdate(original.getRegistration().getId()).orElseThrow();
    Payment payment = payments.findForUpdate(id).orElseThrow();
    BigDecimal amount = positive(request.amount());
    require(amount.compareTo(net(payment)) <= 0, "Tổng hoàn vượt số tiền đã thu còn lại");
    if (reg != null)
      require(
          matches.findByTournamentId(reg.getTournament().getId()).isEmpty()
              || "CANCELLED".equals(reg.getTournament().getStatus()),
          "Hủy giải trước khi hoàn phí của giải đã bốc thăm");
    Refund refund = new Refund();
    refund.setPayment(payment);
    refund.setAmount(amount);
    refund.setReason(text(request.reason(), "Lý do hoàn"));
    refund.setRefundedAt(Instant.now());
    refunds.save(refund);
    if (order != null) {
      if (documents != null) {
        var extra = documents.decode(order.getMetadata());
        var pending = PresentationService.decimal(extra.get("refundPending"));
        if (pending.signum() > 0) {
          var remaining = pending.subtract(amount).max(BigDecimal.ZERO);
          extra.put("refundPending", remaining);
          if (remaining.signum() == 0 && "REFUND_PENDING".equals(extra.get("financialReview")))
            extra.put("financialReview", null);
        }
        order.setMetadata(documents.encode(extra));
      }
      order.setPaidAmount(order.getPaidAmount().subtract(amount));
      totals.updatePaymentStatus(order);
    }
    if (reg != null) reg.setStatus("PENDING");
    audit.log("HOÀN TIỀN", refund.getId().toString());
    return refund.getId();
  }

  public Map<String, Object> currentShift(Account cashier) {
    Instant startOfDay = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant();
    var all = payments.findAllWithOrderAndRegistration().stream()
        .filter(p -> p.getPaidAt().isAfter(startOfDay))
        .toList();

    var cashierCashPayments = all.stream()
        .filter(p -> "CASH".equals(p.getMethod()))
        .filter(p -> cashier == null || p.getReceivedByAccount() == null || cashier.getId().equals(p.getReceivedByAccount().getId()))
        .toList();

    BigDecimal cashCollected = cashierCashPayments.stream()
        .map(Payment::getAmount)
        .reduce(BigDecimal.ZERO, BigDecimal::add);

    BigDecimal bankCollected = all.stream()
        .filter(p -> "BANK_TRANSFER".equals(p.getMethod()))
        .map(Payment::getAmount)
        .reduce(BigDecimal.ZERO, BigDecimal::add);

    return map(
        "shiftDate", LocalDate.now().toString(),
        "cashier", cashier != null ? map("id", cashier.getId(), "name", cashier.getFullName(), "phone", cashier.getPhone()) : null,
        "cashCollected", cashCollected,
        "bankCollected", bankCollected,
        "transactionCount", cashierCashPayments.size(),
        "recentPayments", cashierCashPayments.stream().limit(10).map(p -> map(
            "id", p.getId(),
            "amount", p.getAmount(),
            "code", p.getTransactionCode(),
            "time", p.getPaidAt(),
            "type", p.getType()
        )).toList()
    );
  }

  @Transactional
  public Map<String, Object> closeShift(Map<String, Object> body, Account cashier) {
    Instant startOfDay = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant();
    var cashierCashPayments = payments.findAllWithOrderAndRegistration().stream()
        .filter(p -> p.getPaidAt().isAfter(startOfDay))
        .filter(p -> "CASH".equals(p.getMethod()))
        .filter(p -> cashier == null || p.getReceivedByAccount() == null || cashier.getId().equals(p.getReceivedByAccount().getId()))
        .toList();

    BigDecimal cashCollected = cashierCashPayments.stream()
        .map(Payment::getAmount)
        .reduce(BigDecimal.ZERO, BigDecimal::add);

    BigDecimal startingCash = PresentationService.decimal(body.get("startingCash"));
    BigDecimal actualCash = PresentationService.decimal(body.get("actualCash"));
    BigDecimal expectedCash = startingCash.add(cashCollected);
    BigDecimal difference = actualCash.subtract(expectedCash);
    String note = body.getOrDefault("note", "").toString();

    String reportId = UUID.randomUUID().toString();
    Map<String, Object> report = map(
        "id", reportId,
        "date", LocalDate.now().toString(),
        "closedAt", Instant.now().toString(),
        "cashierId", cashier != null ? cashier.getId().toString() : "SYSTEM",
        "cashierName", cashier != null ? cashier.getFullName() : "Hệ thống",
        "startingCash", startingCash,
        "cashCollected", cashCollected,
        "expectedCash", expectedCash,
        "actualCash", actualCash,
        "difference", difference,
        "txCount", cashierCashPayments.size(),
        "note", note
    );

    if (documents != null) {
      documents.put("shift-report:" + reportId, report);
    }
    audit.log("CHỐT CA", "Ca " + (cashier != null ? cashier.getFullName() : "Hệ thống") + ": Thực tế=" + actualCash + ", Lệch=" + difference);
    return report;
  }

  public Map<String, Object> reconciliation() {
    var allOrders = orders.findAllWithCustomerAccount();
    List<Map<String, Object>> overpayments = new ArrayList<>();
    List<Map<String, Object>> pendingRefunds = new ArrayList<>();
    List<Map<String, Object>> latePayments = new ArrayList<>();

    for (var o : allOrders) {
      Map<String, Object> meta = documents != null ? documents.decode(o.getMetadata()) : Map.of();
      BigDecimal paid = o.getPaidAmount() != null ? o.getPaidAmount() : BigDecimal.ZERO;
      BigDecimal total = o.getTotalAmount() != null ? o.getTotalAmount() : BigDecimal.ZERO;

      // Overpayment: paid > total
      if (paid.compareTo(total) > 0) {
        overpayments.add(map(
            "orderId", o.getId(),
            "customerName", o.getCustomerName(),
            "customerPhone", o.getCustomerPhone(),
            "total", total,
            "paid", paid,
            "excess", paid.subtract(total),
            "status", o.getStatus()
        ));
      }

      // Pending refund: financialReview == REFUND_PENDING or refundPending > 0
      Object review = meta.get("financialReview");
      BigDecimal refundPending = PresentationService.decimal(meta.get("refundPending"));
      if ("REFUND_PENDING".equals(review) || refundPending.signum() > 0) {
        pendingRefunds.add(map(
            "orderId", o.getId(),
            "customerName", o.getCustomerName(),
            "customerPhone", o.getCustomerPhone(),
            "total", total,
            "paid", paid,
            "refundPending", refundPending.signum() > 0 ? refundPending : paid,
            "reason", meta.getOrDefault("cancellationReason", "Yêu cầu hoàn tiền"),
            "status", o.getStatus()
        ));
      }

      // Late payments: EXPIRED or CANCELLED but paid > 0
      if (Set.of("EXPIRED", "CANCELLED").contains(o.getStatus()) && paid.signum() > 0) {
        latePayments.add(map(
            "orderId", o.getId(),
            "customerName", o.getCustomerName(),
            "customerPhone", o.getCustomerPhone(),
            "paid", paid,
            "status", o.getStatus(),
            "review", review
        ));
      }
    }

    return map(
        "overpayments", overpayments,
        "pendingRefunds", pendingRefunds,
        "latePayments", latePayments,
        "count", overpayments.size() + pendingRefunds.size() + latePayments.size()
    );
  }
}

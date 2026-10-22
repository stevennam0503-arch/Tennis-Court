package com.courtly.controller;

import static com.courtly.util.Rules.*;

import com.courtly.dto.request.*;
import com.courtly.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {
  private final PaymentService service;
  private final com.courtly.repository.CustomerOrderRepository orders;
  private final OrderService booking;
  private final RequestService requests;
  private final AuthService auth;
  private final ObjectMapper mapper;
  private final jakarta.validation.Validator validator;

  @GetMapping("/cash-desk")
  @org.springframework.transaction.annotation.Transactional
  public List<Map<String, Object>> cashDesk(HttpServletRequest r) {
    auth.cashier(auth.current(r));
    booking.expireHolds();
    return orders.findAllWithCustomerAccount().stream()
        .filter(o -> Set.of("HOLDING", "CONFIRMED", "CHECKED_IN", "COMPLETED").contains(o.getStatus())
            && o.getTotalAmount().compareTo(o.getPaidAmount()) > 0)
        .limit(100)
        .map(o -> map("id", o.getId(), "name", o.getCustomerName(), "status", o.getStatus(),
            "total", o.getTotalAmount(), "paid", o.getPaidAmount(), "deposit", o.getDepositRequired(),
            "due", o.getTotalAmount().subtract(o.getPaidAmount()), "holdUntil", o.getHoldExpiresAt()))
        .toList();
  }

  @PostMapping
  public Map<String, Object> collect(@RequestBody Map<String, Object> b, HttpServletRequest r) {
    var a = auth.current(r);
    auth.cashier(a);
    require("CASH".equals(b.get("method")), "Chuyển khoản chỉ được ghi nhận qua webhook ngân hàng");
    return requests.execute(
        a.getId(),
        "receipt:" + AuthService.hash(text((String) b.get("transactionCode"), "Mã giao dịch")),
        "payment",
        b,
        () -> map("id", service.collect(dto(b, PaymentRequest.class))));
  }

  @PostMapping("/{id}/refunds")
  public Map<String, Object> refund(
      @PathVariable UUID id, @RequestBody Map<String, Object> b, HttpServletRequest r) {
    var a = auth.current(r);
    auth.admin(a);
    require(b.get("requestId") instanceof String, "Thiếu mã yêu cầu hoàn tiền");
    return requests.execute(
        a.getId(),
        (String) b.get("requestId"),
        "refund:" + id,
        b,
        () -> map("id", service.refund(id, dto(b, RefundRequest.class))));
  }

  private <T> T dto(Object value, Class<T> type) {
    var result = mapper.convertValue(value, type);
    var errors = validator.validate(result);
    require(
        errors.isEmpty(),
        errors.stream()
            .map(e -> e.getPropertyPath() + ": " + e.getMessage())
            .findFirst()
            .orElse("Dữ liệu không hợp lệ"));
    return result;
  }
}

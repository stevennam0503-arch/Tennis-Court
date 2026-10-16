package com.courtly.dto.request;

public record PaymentRequest(
    java.util.UUID orderId,
    java.util.UUID registrationId,
    @jakarta.validation.constraints.NotNull @jakarta.validation.constraints.DecimalMin("0.01")
        java.math.BigDecimal amount,
    @jakarta.validation.constraints.NotBlank String method,
    @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 100)
        String transactionCode,
    String reason) {
  public PaymentRequest(
      java.util.UUID o, java.util.UUID r, java.math.BigDecimal n, String m, String code) {
    this(o, r, n, m, code, null);
  }
}

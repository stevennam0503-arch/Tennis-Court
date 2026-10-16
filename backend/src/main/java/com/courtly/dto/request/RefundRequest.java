package com.courtly.dto.request;

public record RefundRequest(
    @jakarta.validation.constraints.NotNull @jakarta.validation.constraints.DecimalMin("0.01")
        java.math.BigDecimal amount,
    @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 255)
        String reason) {}

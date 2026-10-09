package com.courtly.dto.request;

public record AddProductRequest(
        @jakarta.validation.constraints.NotNull java.util.UUID productId,
        @jakarta.validation.constraints.NotBlank String type,
        @jakarta.validation.constraints.Min(1) @jakarta.validation.constraints.Max(999) int quantity,
        @jakarta.validation.constraints.Min(1) @jakarta.validation.constraints.Max(17) int hours
) {}

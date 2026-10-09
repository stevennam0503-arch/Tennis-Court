package com.courtly.dto.request;

public record BookingRequest(
        @jakarta.validation.constraints.Size(max=255) String name,
        @jakarta.validation.constraints.Size(max=30) String phone,
        java.util.UUID accountId,
        @jakarta.validation.constraints.NotEmpty @jakarta.validation.constraints.Size(max=48) java.util.List<java.util.UUID> scheduleIds
) {}

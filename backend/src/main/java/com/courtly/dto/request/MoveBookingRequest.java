package com.courtly.dto.request;

public record MoveBookingRequest(
        @jakarta.validation.constraints.NotEmpty @jakarta.validation.constraints.Size(max=48) java.util.List<java.util.UUID> scheduleIds
) {}

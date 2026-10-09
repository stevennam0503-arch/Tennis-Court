package com.courtly.dto.request;

public record AssignStaffRequest(
        @jakarta.validation.constraints.NotNull java.util.UUID staffId
) {}

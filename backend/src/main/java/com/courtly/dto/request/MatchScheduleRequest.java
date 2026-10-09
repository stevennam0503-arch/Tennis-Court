package com.courtly.dto.request;

public record MatchScheduleRequest(
        @jakarta.validation.constraints.NotEmpty @jakarta.validation.constraints.Size(max=17) java.util.List<java.util.UUID> scheduleIds,
        java.util.UUID staffId
) {}

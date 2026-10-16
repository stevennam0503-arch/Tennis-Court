package com.courtly.dto.request;

public record MatchResultRequest(
    @jakarta.validation.constraints.NotNull java.util.UUID winnerId,
    @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 100)
        String score) {}

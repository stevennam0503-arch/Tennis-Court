package com.courtly.dto.request;

public record RegistrationRequest(
        @jakarta.validation.constraints.NotNull java.util.UUID accountId,
        @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=255) String name,
        @jakarta.validation.constraints.Size(max=30) java.util.List<@jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=255) String> members
) {}

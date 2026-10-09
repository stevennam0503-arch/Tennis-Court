package com.courtly.dto.request;

public record CatalogRequest(
        @jakarta.validation.constraints.Size(max=255) String name,
        String type, String status, java.math.BigDecimal price, Integer stock,
        @jakarta.validation.constraints.Email String email, String phone, String role,
        java.math.BigDecimal rate, java.util.UUID court, String dayType,
        Integer start, Integer end, java.util.UUID staff, java.time.LocalDate date,
        String format, java.time.LocalDate startDate, java.time.LocalDate endDate,
        java.time.LocalDate deadline, String location, java.math.BigDecimal fee, Integer max
) {}

package com.courtly.dto.response;
import java.time.Instant;
public record ApiError(String message, Instant timestamp) {}

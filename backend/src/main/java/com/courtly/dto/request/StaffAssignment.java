package com.courtly.dto.request;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record StaffAssignment(@NotNull UUID scheduleId, @NotNull UUID staffId) {}

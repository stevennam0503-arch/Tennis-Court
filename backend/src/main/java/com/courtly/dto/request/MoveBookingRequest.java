package com.courtly.dto.request;

import jakarta.validation.constraints.*;
import java.util.*;

public record MoveBookingRequest(
    @NotEmpty @Size(max = 48) List<UUID> scheduleIds,
    List<StaffAssignment> assignments,
    String reason,
    String requestId) {
  public MoveBookingRequest(List<UUID> ids) {
    this(ids, List.of(), null, null);
  }
}

package com.courtly.dto.request;

import jakarta.validation.constraints.*;
import java.util.*;

public record BookingRequest(
    @Size(max = 255) String name,
    @Size(max = 30) String phone,
    UUID accountId,
    @NotEmpty @Size(max = 48) List<UUID> scheduleIds,
    List<StaffAssignment> assignments,
    String requestId) {
  public BookingRequest(String name, String phone, UUID accountId, List<UUID> ids) {
    this(name, phone, accountId, ids, List.of(), null);
  }
}

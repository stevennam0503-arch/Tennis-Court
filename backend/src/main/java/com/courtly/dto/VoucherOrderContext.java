package com.courtly.dto;

import com.courtly.entity.CourtSchedule;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

public record VoucherOrderContext(
    BigDecimal totalAmount,
    UUID accountId,
    List<SlotItem> slots
) {
  public record SlotItem(
      LocalDate date,
      LocalTime startTime,
      LocalTime endTime,
      String zone
  ) {}

  public static VoucherOrderContext fromSchedules(List<CourtSchedule> schedules, UUID accountId, BigDecimal totalAmount) {
    if (schedules == null || schedules.isEmpty()) {
      return new VoucherOrderContext(totalAmount, accountId, List.of());
    }
    List<SlotItem> items = schedules.stream()
        .map(s -> new SlotItem(
            s.getScheduleDate(),
            s.getStartTime(),
            s.getEndTime(),
            s.getCourt() != null ? s.getCourt().getType() : null
        ))
        .toList();
    return new VoucherOrderContext(totalAmount, accountId, items);
  }

  public static VoucherOrderContext fromMap(Map<String, Object> body, UUID fallbackAccountId, BigDecimal fallbackAmount) {
    if (body == null) {
      return new VoucherOrderContext(fallbackAmount, fallbackAccountId, List.of());
    }
    UUID accId = fallbackAccountId;
    if (body.get("accountId") != null && !body.get("accountId").toString().isBlank()) {
      try {
        accId = UUID.fromString(body.get("accountId").toString());
      } catch (Exception ignored) {}
    }
    BigDecimal amt = fallbackAmount;
    if (body.get("amount") != null) {
      try {
        amt = new BigDecimal(body.get("amount").toString());
      } catch (Exception ignored) {}
    }
    List<SlotItem> items = new ArrayList<>();
    if (body.get("slots") instanceof List<?> list) {
      for (Object obj : list) {
        if (obj instanceof Map<?, ?> m) {
          LocalDate d = null;
          if (m.get("date") != null && !m.get("date").toString().isBlank()) {
            try { d = LocalDate.parse(m.get("date").toString()); } catch (Exception ignored) {}
          }
          LocalTime st = null;
          if (m.get("startTime") != null && !m.get("startTime").toString().isBlank()) {
            try { st = LocalTime.parse(m.get("startTime").toString()); } catch (Exception ignored) {}
          }
          LocalTime et = null;
          if (m.get("endTime") != null && !m.get("endTime").toString().isBlank()) {
            try { et = LocalTime.parse(m.get("endTime").toString()); } catch (Exception ignored) {}
          }
          String z = m.get("zone") != null ? m.get("zone").toString() : null;
          items.add(new SlotItem(d, st, et, z));
        }
      }
    } else {
      LocalDate d = null;
      if (body.get("date") != null && !body.get("date").toString().isBlank()) {
        try { d = LocalDate.parse(body.get("date").toString()); } catch (Exception ignored) {}
      }
      LocalTime st = null;
      if (body.get("startTime") != null && !body.get("startTime").toString().isBlank()) {
        try { st = LocalTime.parse(body.get("startTime").toString()); } catch (Exception ignored) {}
      }
      LocalTime et = null;
      if (body.get("endTime") != null && !body.get("endTime").toString().isBlank()) {
        try { et = LocalTime.parse(body.get("endTime").toString()); } catch (Exception ignored) {}
      }
      String z = body.get("zone") != null ? body.get("zone").toString() : null;
      if (d != null || st != null || et != null || z != null) {
        items.add(new SlotItem(d, st, et, z));
      }
    }
    return new VoucherOrderContext(amt, accId, items);
  }
}

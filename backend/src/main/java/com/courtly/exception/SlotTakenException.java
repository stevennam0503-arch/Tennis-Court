package com.courtly.exception;

import java.util.List;
import java.util.Map;

public class SlotTakenException extends BusinessException {
  private final List<Map<String, Object>> conflictingSlots;

  public SlotTakenException(String message, List<Map<String, Object>> conflictingSlots) {
    super(message);
    this.conflictingSlots = conflictingSlots;
  }

  public List<Map<String, Object>> getConflictingSlots() {
    return conflictingSlots;
  }
}

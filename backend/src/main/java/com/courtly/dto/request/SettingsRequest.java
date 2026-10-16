package com.courtly.dto.request;

public record SettingsRequest(
    @jakarta.validation.constraints.Min(1) @jakarta.validation.constraints.Max(60) int holdMinutes,
    @jakarta.validation.constraints.Min(1) @jakarta.validation.constraints.Max(100)
        int depositPercent,
    @jakarta.validation.constraints.Min(0) @jakarta.validation.constraints.Max(100)
        int cancelRefundPercent,
    java.util.Map<String, Object> policies) {
  public SettingsRequest(int hold, int deposit, int refund) {
    this(hold, deposit, refund, null);
  }
}

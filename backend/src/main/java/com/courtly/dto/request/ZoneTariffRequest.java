package com.courtly.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record ZoneTariffRequest(
    LocalDate effectiveFrom,
    @NotEmpty List<@Valid TariffRowRequest> rows
) {
  public record TariffRowRequest(
      @NotNull String dayType,
      @NotNull Object start,
      @NotNull Object end,
      @NotNull BigDecimal pricePerHour
  ) {}
}

package com.courtly.service;

import static org.junit.jupiter.api.Assertions.*;

import java.util.UUID;
import org.junit.jupiter.api.Test;

class DemoAccountsSeedStateTest {

  @Test
  void demoAccountIdsAreValidAndDistinct() {
    UUID hoivienId = UUID.fromString(DemoResetService.DEMO_HOIVIEN_ID);
    UUID khachId = UUID.fromString(DemoResetService.DEMO_KHACH_ID);
    UUID kietId = UUID.fromString(DemoResetService.KIET_ID);
    UUID maiId = UUID.fromString(DemoResetService.PHUONG_MAI_ID);
    assertNotNull(hoivienId);
    assertNotNull(khachId);
    assertNotNull(kietId);
    assertNotNull(maiId);
    assertNotEquals(hoivienId, khachId);
    assertNotEquals(kietId, maiId);
    assertNotEquals(kietId, hoivienId);
  }
}

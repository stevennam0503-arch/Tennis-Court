package com.courtly.service;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Set;
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

  @Test
  void demoFeedbackIdsAreValidAndDistinct() {
    UUID fb1 = UUID.fromString(DemoResetService.FB_NAM_ID);
    UUID fb2 = UUID.fromString(DemoResetService.FB_DUC_ID);
    UUID fb3 = UUID.fromString(DemoResetService.FB_HA_PENDING_ID);
    UUID fb4 = UUID.fromString(DemoResetService.FB_HA_LOW_ID);
    Set<UUID> ids = Set.of(fb1, fb2, fb3, fb4);
    assertEquals(4, ids.size());
  }
}

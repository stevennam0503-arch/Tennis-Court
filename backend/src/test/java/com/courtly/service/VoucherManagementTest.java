package com.courtly.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.courtly.entity.Account;
import com.courtly.entity.Voucher;
import com.courtly.exception.BusinessException;
import com.courtly.repository.CustomerOrderRepository;
import com.courtly.repository.VoucherRedemptionRepository;
import com.courtly.repository.VoucherRepository;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class VoucherManagementTest {

  @Mock
  private VoucherRepository vouchers;
  @Mock
  private VoucherRedemptionRepository redemptions;
  @Mock
  private CustomerOrderRepository orders;
  @Mock
  private TierPricingService memberships;
  @Mock
  private AuditService auditService;

  @InjectMocks
  private VoucherService voucherService;

  private Account admin;
  private Account staff;

  @BeforeEach
  void setUp() {
    admin = new Account();
    admin.setId(UUID.randomUUID());
    admin.setRole("ADMIN");
    admin.setFullName("Admin Courtly");

    staff = new Account();
    staff.setId(UUID.randomUUID());
    staff.setRole("STAFF");
    staff.setFullName("Staff Courtly");
  }

  @Test
  void staffCreatesVoucherWithinLimits_ShouldBeActive() {
    when(vouchers.findByCodeIgnoreCase(any())).thenReturn(Optional.empty());
    when(vouchers.save(any())).thenAnswer(inv -> inv.getArgument(0));

    Map<String, Object> body = new HashMap<>();
    body.put("code", "STAFF10");
    body.put("type", "PERCENT");
    body.put("value", 10);
    body.put("maxDiscount", 50000);
    body.put("usageLimit", 30);
    body.put("startsAt", Instant.now().toString());
    body.put("expiresAt", Instant.now().plus(Duration.ofDays(10)).toString());

    Voucher v = voucherService.createVoucher(body, staff);

    assertEquals("ACTIVE", v.getStatus());
    assertTrue(v.getEnabled());
    assertEquals(staff.getId(), v.getApprovedBy());
  }

  @Test
  void staffCreatesVoucherExceedingLimits_ShouldBePendingApproval() {
    when(vouchers.findByCodeIgnoreCase(any())).thenReturn(Optional.empty());
    when(vouchers.save(any())).thenAnswer(inv -> inv.getArgument(0));

    Map<String, Object> body = new HashMap<>();
    body.put("code", "STAFF30");
    body.put("type", "PERCENT");
    body.put("value", 30); // > 20% limit
    body.put("maxDiscount", 150000);
    body.put("usageLimit", 30);
    body.put("startsAt", Instant.now().toString());
    body.put("expiresAt", Instant.now().plus(Duration.ofDays(10)).toString());

    Voucher v = voucherService.createVoucher(body, staff);

    assertEquals("PENDING_APPROVAL", v.getStatus());
    assertFalse(v.getEnabled());
    assertNull(v.getApprovedBy());
  }

  @Test
  void adminApproveVoucher_ShouldBecomeActive() {
    UUID vId = UUID.randomUUID();
    Voucher pending = new Voucher();
    pending.setId(vId);
    pending.setCode("BIGDISCOUNT");
    pending.setStatus("PENDING_APPROVAL");
    pending.setEnabled(false);

    when(vouchers.findById(vId)).thenReturn(Optional.of(pending));
    when(vouchers.save(any())).thenAnswer(inv -> inv.getArgument(0));

    Voucher approved = voucherService.approveVoucher(vId, admin);

    assertEquals("ACTIVE", approved.getStatus());
    assertTrue(approved.getEnabled());
    assertEquals(admin.getId(), approved.getApprovedBy());
    assertNotNull(approved.getApprovedAt());
  }

  @Test
  void updateUsedVoucher_ModifyingValueShouldThrowException() {
    UUID vId = UUID.randomUUID();
    Voucher used = new Voucher();
    used.setId(vId);
    used.setCode("USED10");
    used.setUsedCount(5); // already used 5 times
    used.setValue(BigDecimal.valueOf(10));
    used.setType("PERCENT");

    when(vouchers.findById(vId)).thenReturn(Optional.of(used));

    Map<String, Object> body = Map.of("value", 20);

    assertThrows(BusinessException.class, () -> {
      voucherService.updateVoucher(vId, body, admin);
    });
  }
}

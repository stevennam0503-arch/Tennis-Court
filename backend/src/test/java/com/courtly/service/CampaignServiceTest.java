package com.courtly.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.courtly.entity.Account;
import com.courtly.entity.Campaign;
import com.courtly.exception.BusinessException;
import com.courtly.repository.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class CampaignServiceTest {

  private CampaignRepository campaigns;
  private AccountRepository accounts;
  private CustomerOrderRepository orders;
  private VoucherRepository vouchers;
  private VoucherRedemptionRepository redemptions;
  private NotificationService notificationService;
  private NotificationRepository notificationRepository;
  private AuditService auditService;
  private CampaignService campaignService;

  @BeforeEach
  void setUp() {
    campaigns = mock(CampaignRepository.class);
    accounts = mock(AccountRepository.class);
    orders = mock(CustomerOrderRepository.class);
    vouchers = mock(VoucherRepository.class);
    redemptions = mock(VoucherRedemptionRepository.class);
    notificationService = mock(NotificationService.class);
    notificationRepository = mock(NotificationRepository.class);
    auditService = mock(AuditService.class);

    campaignService = new CampaignService(
        campaigns,
        accounts,
        orders,
        vouchers,
        redemptions,
        notificationService,
        notificationRepository,
        auditService
    );
  }

  @Test
  void testStaffCreatesDraft() {
    Account staff = new Account();
    staff.setId(UUID.randomUUID());
    staff.setRole("STAFF");
    staff.setEmail("staff@courtly.com");

    when(campaigns.save(any(Campaign.class))).thenAnswer(i -> {
      Campaign c = i.getArgument(0);
      c.setId(UUID.randomUUID());
      return c;
    });

    Map<String, Object> body = Map.of(
        "name", "Khuyến mãi chào hè",
        "audience", "ALL",
        "channels", "EMAIL,SMS"
    );

    var res = campaignService.createCampaign(staff, body);
    assertEquals("DRAFT", res.get("status"));
    assertEquals("Khuyến mãi chào hè", res.get("name"));
  }

  @Test
  void testStaffSubmitForApproval() {
    Account staff = new Account();
    staff.setId(UUID.randomUUID());
    staff.setRole("STAFF");

    Campaign c = new Campaign();
    c.setId(UUID.randomUUID());
    c.setName("Campaign 1");
    c.setStatus("DRAFT");

    when(campaigns.findById(c.getId())).thenReturn(Optional.of(c));
    when(campaigns.save(any(Campaign.class))).thenAnswer(i -> i.getArgument(0));

    var res = campaignService.submitForApproval(staff, c.getId());
    assertEquals("PENDING_APPROVAL", res.get("status"));
  }

  @Test
  void testAdminApproveAndRunDispatchesOnlyConsentingCustomers() {
    Account admin = new Account();
    admin.setId(UUID.randomUUID());
    admin.setRole("ADMIN");

    Campaign c = new Campaign();
    c.setId(UUID.randomUUID());
    c.setName("Tri ân khách hàng");
    c.setStatus("PENDING_APPROVAL");
    c.setChannels("EMAIL,SMS");
    c.setAudience("ALL");

    // Khách A: đã đồng ý nhận tin
    Account userA = new Account();
    userA.setId(UUID.randomUUID());
    userA.setEmail("usera@gmail.com");
    userA.setPhone("0912345678");
    userA.setRole("CUSTOMER");
    userA.setStatus("ACTIVE");
    userA.setMarketingConsent(true);

    // Khách B: KHÔNG đồng ý nhận tin
    Account userB = new Account();
    userB.setId(UUID.randomUUID());
    userB.setEmail("userb@gmail.com");
    userB.setRole("CUSTOMER");
    userB.setStatus("ACTIVE");
    userB.setMarketingConsent(false);

    when(campaigns.findById(c.getId())).thenReturn(Optional.of(c));
    when(campaigns.save(any(Campaign.class))).thenAnswer(i -> i.getArgument(0));
    when(accounts.findAll()).thenReturn(List.of(userA, userB));

    var res = campaignService.approveAndRun(admin, c.getId());
    assertEquals("RUNNING", res.get("status"));

    // User A receives notification
    verify(notificationService, atLeastOnce()).enqueue(
        eq(userA.getId()), isNull(), isNull(),
        eq("PROMOTION"), eq("EMAIL"), eq(userA.getEmail()),
        anyString(), anyString(), any(Instant.class), anyString()
    );

    // User B NEVER receives notification (compliance with decree 13/2023)
    verify(notificationService, never()).enqueue(
        eq(userB.getId()), isNull(), isNull(),
        anyString(), anyString(), anyString(),
        any(), any(), any(), any()
    );
  }

  @Test
  void testUnsubscribeTurnsOffMarketingConsent() {
    Account acc = new Account();
    UUID accId = UUID.randomUUID();
    acc.setId(accId);
    acc.setEmail("subscriber@courtly.com");
    acc.setMarketingConsent(true);
    acc.setMarketingConsentAt(Instant.now());

    when(accounts.findById(accId)).thenReturn(Optional.of(acc));
    when(accounts.save(any(Account.class))).thenAnswer(i -> i.getArgument(0));

    var result = campaignService.unsubscribe("optout_" + accId);
    assertTrue((Boolean) result.get("success"));
    assertFalse(acc.getMarketingConsent());
    assertNull(acc.getMarketingConsentAt());
  }
}

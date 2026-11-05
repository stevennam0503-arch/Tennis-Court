package com.courtly.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.courtly.entity.Account;
import com.courtly.entity.CustomerOrder;
import com.courtly.entity.Voucher;
import com.courtly.exception.BusinessException;
import com.courtly.repository.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class FeedbackRecoveryTest {

  @Mock
  private DocumentService docs;
  @Mock
  private AuthService auth;
  @Mock
  private TournamentRepository tournaments;
  @Mock
  private RequestService requests;
  @Mock
  private CustomerOrderRepository orders;
  @Mock
  private BookingRepository bookings;
  @Mock
  private BookingSlotRepository bookingSlots;
  @Mock
  private AccountRepository accounts;
  @Mock
  private VoucherService vouchers;
  @Mock
  private VoucherRepository vouchersRepo;
  @Mock
  private NotificationService notificationService;
  @Mock
  private AuditService auditService;

  @InjectMocks
  private ContentService contentService;

  private Account customer;
  private Account staff;

  @BeforeEach
  void setUp() {
    customer = new Account();
    customer.setId(UUID.randomUUID());
    customer.setEmail("khach@gmail.com");
    customer.setPhone("+84988888888");
    customer.setFullName("Lê Thu Hà");
    customer.setRole("CUSTOMER");

    staff = new Account();
    staff.setId(UUID.randomUUID());
    staff.setFullName("Nhân Viên Quầy");
    staff.setRole("STAFF");
  }

  @Test
  void assignFeedback_StaffAssignsSelf_ShouldBecomeInProgress() {
    String fbId = UUID.randomUUID().toString();
    Map<String, Object> doc = new HashMap<>();
    doc.put("id", fbId);
    doc.put("handlingStatus", "NEW");

    when(docs.get("feedback:" + fbId)).thenReturn(doc);

    Map<String, Object> updated = contentService.assignFeedback(fbId, staff);

    assertEquals("IN_PROGRESS", updated.get("handlingStatus"));
    assertEquals(staff.getFullName(), updated.get("assignedTo"));
    verify(docs).put(eq("feedback:" + fbId), any());
    verify(auditService).log(eq("ASSIGN_FEEDBACK"), anyString());
  }

  @Test
  void compensateFeedback_ShouldCreateSorryVoucherAndRecordId() {
    String fbId = UUID.randomUUID().toString();
    Map<String, Object> doc = new HashMap<>();
    doc.put("id", fbId);
    doc.put("accountId", customer.getId().toString());
    doc.put("handlingStatus", "IN_PROGRESS");

    Voucher sorryVoucher = new Voucher();
    sorryVoucher.setId(UUID.randomUUID());
    sorryVoucher.setCode("SORRY-7K3Q");
    sorryVoucher.setStatus("ACTIVE");
    sorryVoucher.setValue(BigDecimal.valueOf(50000));
    sorryVoucher.setType("FIXED");

    com.courtly.entity.AppDocument appDoc = new com.courtly.entity.AppDocument();
    when(docs.lock("feedback:" + fbId)).thenReturn(appDoc);
    when(docs.read(appDoc)).thenReturn(doc);
    when(accounts.findById(customer.getId())).thenReturn(Optional.of(customer));
    when(vouchers.createCompensationVoucher(eq(customer.getId()), any(), eq(fbId), any(), eq(staff)))
        .thenReturn(sorryVoucher);

    Map<String, Object> template = Map.of("templateCode", "APOLOGY_50K");
    Map<String, Object> result = contentService.compensateFeedback(fbId, template, staff);

    assertEquals("SORRY-7K3Q", result.get("code"));
    assertEquals(sorryVoucher.getId().toString(), doc.get("compensationVoucherId"));
    assertEquals("SORRY-7K3Q", doc.get("compensationVoucherCode"));
    verify(docs).save(eq(appDoc), any());
    verify(notificationService, atLeastOnce()).enqueue(any(), any(), any(), eq("COMPENSATION_VOUCHER"), any(), any(), any(), any(), any(), any());
  }

  @Test
  void getCompensationTemplates_Staff_ShouldReturnOnlyStaffTemplates() {
    List<Map<String, Object>> templates = contentService.getCompensationTemplates(staff);
    assertEquals(2, templates.size());
    assertTrue(templates.stream().anyMatch(t -> "APOLOGY_50K".equals(t.get("code"))));
    assertTrue(templates.stream().anyMatch(t -> "SERVICE_20".equals(t.get("code"))));
    assertFalse(templates.stream().anyMatch(t -> "FREE_COURT_1H".equals(t.get("code"))));
  }

  @Test
  void getCompensationTemplates_Admin_ShouldReturnAllTemplates() {
    Account admin = new Account();
    admin.setRole("ADMIN");
    List<Map<String, Object>> templates = contentService.getCompensationTemplates(admin);
    assertEquals(3, templates.size());
    assertTrue(templates.stream().anyMatch(t -> "APOLOGY_50K".equals(t.get("code"))));
    assertTrue(templates.stream().anyMatch(t -> "SERVICE_20".equals(t.get("code"))));
    assertTrue(templates.stream().anyMatch(t -> "FREE_COURT_1H".equals(t.get("code"))));
  }

  @Test
  void compensateFeedback_StaffUsingFreeCourt_ShouldThrow403() {
    String fbId = UUID.randomUUID().toString();
    Map<String, Object> body = Map.of("templateCode", "FREE_COURT_1H");
    ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> contentService.compensateFeedback(fbId, body, staff));
    assertEquals(403, ex.getStatusCode().value());
    assertEquals("Mẫu này cần Manager", ex.getReason());
  }

  @Test
  void compensateFeedback_StaffWithTamperedValue_ShouldIgnoreTamperedValue() {
    String fbId = UUID.randomUUID().toString();
    Map<String, Object> doc = new HashMap<>();
    doc.put("id", fbId);
    doc.put("accountId", customer.getId().toString());

    Voucher sorryVoucher = new Voucher();
    sorryVoucher.setId(UUID.randomUUID());
    sorryVoucher.setCode("SORRY-SAFE");
    sorryVoucher.setStatus("ACTIVE");

    com.courtly.entity.AppDocument appDoc = new com.courtly.entity.AppDocument();
    when(docs.lock("feedback:" + fbId)).thenReturn(appDoc);
    when(docs.read(appDoc)).thenReturn(doc);
    when(accounts.findById(customer.getId())).thenReturn(Optional.of(customer));
    when(vouchers.createCompensationVoucher(eq(customer.getId()), any(), eq(fbId), any(), eq(staff)))
        .thenReturn(sorryVoucher);

    // Tampered value sent by staff
    Map<String, Object> body = Map.of("templateCode", "APOLOGY_50K", "value", 5000000, "type", "PERCENT");
    contentService.compensateFeedback(fbId, body, staff);

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Map<String, Object>> templateCaptor = ArgumentCaptor.forClass(Map.class);
    verify(vouchers).createCompensationVoucher(eq(customer.getId()), any(), eq(fbId), templateCaptor.capture(), eq(staff));

    Map<String, Object> usedTemplate = templateCaptor.getValue();
    assertEquals("FIXED", usedTemplate.get("type"));
    assertEquals(50000, usedTemplate.get("value"));
  }

  @Test
  void compensateFeedback_InvalidTemplateCode_ShouldThrowBadRequest() {
    String fbId = UUID.randomUUID().toString();
    assertThrows(BusinessException.class, () -> contentService.compensateFeedback(fbId, Map.of("templateCode", "UNKNOWN_TPL"), staff));
    assertThrows(BusinessException.class, () -> contentService.compensateFeedback(fbId, Map.of(), staff));
  }

  @Test
  void compensateFeedback_AdminCustomTemplate_ValidReason() {
    String fbId = UUID.randomUUID().toString();
    Map<String, Object> doc = new HashMap<>();
    doc.put("id", fbId);
    doc.put("accountId", customer.getId().toString());

    Voucher sorryVoucher = new Voucher();
    sorryVoucher.setId(UUID.randomUUID());
    sorryVoucher.setCode("SORRY-VIP");
    sorryVoucher.setStatus("ACTIVE");

    Account admin = new Account();
    admin.setFullName("Quản Trị Viên");
    admin.setRole("ADMIN");

    com.courtly.entity.AppDocument appDoc = new com.courtly.entity.AppDocument();
    when(docs.lock("feedback:" + fbId)).thenReturn(appDoc);
    when(docs.read(appDoc)).thenReturn(doc);
    when(accounts.findById(customer.getId())).thenReturn(Optional.of(customer));
    when(vouchers.createCompensationVoucher(eq(customer.getId()), any(), eq(fbId), any(), eq(admin)))
        .thenReturn(sorryVoucher);

    Map<String, Object> body = Map.of(
        "templateCode", "CUSTOM",
        "reason", "Khách VIP bị huỷ sân đột xuất do cúp điện",
        "type", "FIXED",
        "value", 200000
    );
    Map<String, Object> res = contentService.compensateFeedback(fbId, body, admin);
    assertEquals("SORRY-VIP", res.get("code"));
    verify(auditService).log(eq("CUSTOM_COMPENSATION"), anyString());
  }

  @Test
  void compensateFeedback_StaffCustomTemplate_ShouldThrow403() {
    String fbId = UUID.randomUUID().toString();
    Map<String, Object> body = Map.of(
        "templateCode", "CUSTOM",
        "reason", "Khách VIP bị huỷ sân đột xuất do cúp điện",
        "value", 200000
    );
    ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> contentService.compensateFeedback(fbId, body, staff));
    assertEquals(403, ex.getStatusCode().value());
  }

  @Test
  void compensateFeedback_WhenAlreadyCompensated_ShouldThrowExceptionForBothAdminAndStaff() {
    String fbId = UUID.randomUUID().toString();
    Map<String, Object> doc = new HashMap<>();
    doc.put("id", fbId);
    doc.put("accountId", customer.getId().toString());
    doc.put("compensationVoucherCode", "SORRY-3LPK");

    com.courtly.entity.AppDocument appDoc = new com.courtly.entity.AppDocument();
    when(docs.lock("feedback:" + fbId)).thenReturn(appDoc);
    when(docs.read(appDoc)).thenReturn(doc);

    Voucher existing = new Voucher();
    existing.setCode("SORRY-3LPK");
    existing.setStatus("ACTIVE");
    when(vouchersRepo.findByCodeIgnoreCase("SORRY-3LPK")).thenReturn(Optional.of(existing));

    Account admin = new Account();
    admin.setRole("ADMIN");

    // Staff cannot compensate again
    assertThrows(BusinessException.class, () -> contentService.compensateFeedback(fbId, Map.of("templateCode", "APOLOGY_50K"), staff));
    // Admin cannot compensate again without revoking
    assertThrows(BusinessException.class, () -> contentService.compensateFeedback(fbId, Map.of("templateCode", "APOLOGY_50K"), admin));
  }

  @Test
  void revokeCompensation_AdminCanRevokeUnusedVoucher() {
    String fbId = UUID.randomUUID().toString();
    Map<String, Object> doc = new HashMap<>();
    doc.put("id", fbId);
    doc.put("compensationVoucherCode", "SORRY-3LPK");

    com.courtly.entity.AppDocument appDoc = new com.courtly.entity.AppDocument();
    when(docs.lock("feedback:" + fbId)).thenReturn(appDoc);
    when(docs.read(appDoc)).thenReturn(doc);

    Voucher v = new Voucher();
    v.setCode("SORRY-3LPK");
    v.setStatus("ACTIVE");
    v.setUsedCount(0);
    when(vouchersRepo.findByCodeIgnoreCase("SORRY-3LPK")).thenReturn(Optional.of(v));

    Account admin = new Account();
    admin.setRole("ADMIN");

    var res = contentService.revokeCompensation(fbId, Map.of("reason", "Tặng nhầm mức bồi thường"), admin);
    assertEquals("SORRY-3LPK", res.get("revokedCode"));
    assertEquals("REVOKED", v.getStatus());
    assertNull(doc.get("compensationVoucherCode"));
  }

  @Test
  void resolveFeedback_StaffResolves_ShouldUpdateStatusAndResolution() {
    String fbId = UUID.randomUUID().toString();
    Map<String, Object> doc = new HashMap<>();
    doc.put("id", fbId);
    doc.put("accountId", customer.getId().toString());
    doc.put("handlingStatus", "IN_PROGRESS");

    when(docs.get("feedback:" + fbId)).thenReturn(doc);
    when(accounts.findById(customer.getId())).thenReturn(Optional.of(customer));

    Map<String, Object> body = Map.of(
        "status", "RESOLVED",
        "resolution", "Đã kiểm tra và chỉnh lại đèn sân B04",
        "reply", "Courtly rất xin lỗi quý khách và đã xử lý sự cố."
    );

    Map<String, Object> res = contentService.resolveFeedback(fbId, body, staff);

    assertEquals("RESOLVED", res.get("handlingStatus"));
    assertEquals(staff.getFullName(), res.get("resolvedBy"));
    assertEquals("Courtly rất xin lỗi quý khách và đã xử lý sự cố.", res.get("reply"));
    assertNotNull(res.get("resolvedAt"));
    verify(notificationService, atLeastOnce()).enqueue(any(), any(), any(), eq("FEEDBACK_REPLY"), any(), any(), any(), any(), any(), any());
  }
}

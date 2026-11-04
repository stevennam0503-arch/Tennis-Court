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
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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

    when(docs.get("feedback:" + fbId)).thenReturn(doc);
    when(accounts.findById(customer.getId())).thenReturn(Optional.of(customer));
    when(vouchers.createCompensationVoucher(eq(customer.getId()), any(), eq(fbId), any(), eq(staff)))
        .thenReturn(sorryVoucher);

    Map<String, Object> template = Map.of("type", "FIXED", "value", 50000);
    Map<String, Object> result = contentService.compensateFeedback(fbId, template, staff);

    assertEquals("SORRY-7K3Q", result.get("code"));
    assertEquals(sorryVoucher.getId().toString(), doc.get("compensationVoucherId"));
    assertEquals("SORRY-7K3Q", doc.get("compensationVoucherCode"));
    verify(notificationService, atLeastOnce()).enqueue(any(), any(), any(), eq("COMPENSATION_VOUCHER"), any(), any(), any(), any(), any(), any());
  }

  @Test
  void compensateFeedback_WhenAlreadyCompensatedByStaff_ShouldThrowException() {
    String fbId = UUID.randomUUID().toString();
    Map<String, Object> doc = new HashMap<>();
    doc.put("id", fbId);
    doc.put("accountId", customer.getId().toString());
    doc.put("compensationVoucherId", UUID.randomUUID().toString());

    when(docs.get("feedback:" + fbId)).thenReturn(doc);

    assertThrows(BusinessException.class, () -> {
      contentService.compensateFeedback(fbId, Map.of(), staff);
    });
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

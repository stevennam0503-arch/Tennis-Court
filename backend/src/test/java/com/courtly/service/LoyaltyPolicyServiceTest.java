package com.courtly.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.courtly.entity.Account;
import com.courtly.entity.AppDocument;
import com.courtly.exception.BusinessException;
import com.courtly.repository.AccountRepository;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LoyaltyPolicyServiceTest {

  private DocumentService docs;
  private LoyaltyPolicyService policy;
  private Account admin;
  private final Map<String, Object> stored = new LinkedHashMap<>();

  @BeforeEach
  void setUp() {
    docs = mock(DocumentService.class);
    AppDocument row = new AppDocument("loyalty:policy");
    when(docs.get("loyalty:policy")).thenAnswer(i -> new LinkedHashMap<>(stored));
    when(docs.lock("loyalty:policy")).thenReturn(row);
    when(docs.read(any())).thenAnswer(i -> new LinkedHashMap<>(stored));
    doAnswer(i -> { stored.clear(); stored.putAll(i.getArgument(1)); row.setData("{}"); return null; })
        .when(docs).save(any(), any());
    AccountRepository accounts = mock(AccountRepository.class);
    when(accounts.findAll()).thenReturn(List.of());
    policy = new LoyaltyPolicyService(docs, mock(AuditService.class), accounts, mock(NotificationService.class));
    admin = new Account();
    admin.setRole("ADMIN");
    admin.setFullName("Quản trị");
  }

  private Map<String, Object> body(String effectiveFrom, long challengerSpend, double gsDiscount) {
    Map<String, Object> tiers = new LinkedHashMap<>();
    for (var e : LoyaltyPolicyService.defaults().entrySet()) tiers.put(e.getKey(), new LinkedHashMap<>(e.getValue()));
    ((Map<String, Object>) tiers.get("CHALLENGER")).put("spend", challengerSpend);
    ((Map<String, Object>) tiers.get("GRAND_SLAM")).put("discount", gsDiscount);
    return Map.of("effectiveFrom", effectiveFrom, "tiers", tiers);
  }

  private String tomorrow() {
    return LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(1).toString();
  }

  @Test
  void defaultsMatchCurrentProgram() {
    assertEquals(8.0, policy.num("GRAND_SLAM", "discount"));
    assertEquals(3_000_000, policy.threshold("CHALLENGER").longValue());
    assertEquals(30_000, policy.num("ROOKIE", "birthday"));
  }

  @Test
  void scheduledChangeDoesNotApplyBeforeEffectiveDate() {
    policy.schedule(admin, body(tomorrow(), 2_500_000, 10));
    // Hôm nay vẫn theo chính sách cũ
    assertEquals(3_000_000, policy.threshold("CHALLENGER").longValue());
    assertEquals(8.0, policy.num("GRAND_SLAM", "discount"));
    var pub = policy.publicPolicy();
    assertNotNull(pub.get("pending"));
    assertEquals(1, ((List<?>) policy.adminView().get("history")).size());
  }

  @Test
  void rejectsRetroactiveAndInvalidValues() {
    String today = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).toString();
    assertThrows(BusinessException.class, () -> policy.schedule(admin, body(today, 2_500_000, 8)));
    // Ngưỡng Challenger cao hơn Masters
    assertThrows(BusinessException.class, () -> policy.schedule(admin, body(tomorrow(), 9_000_000, 8)));
    // Giảm giá vượt trần 15%
    assertThrows(BusinessException.class, () -> policy.schedule(admin, body(tomorrow(), 3_000_000, 20)));
    // Không có thay đổi
    assertThrows(BusinessException.class, () -> policy.schedule(admin, body(tomorrow(), 3_000_000, 8)));
  }

  @Test
  void onlyAdminCanSchedule() {
    Account staff = new Account();
    staff.setRole("STAFF");
    assertThrows(BusinessException.class, () -> policy.schedule(staff, body(tomorrow(), 2_500_000, 8)));
  }
}

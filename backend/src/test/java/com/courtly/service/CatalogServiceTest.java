package com.courtly.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.courtly.entity.Account;
import com.courtly.entity.CustomerOrder;
import com.courtly.exception.BusinessException;
import com.courtly.repository.*;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CatalogServiceTest {
  @Mock private CourtRepository courts;
  @Mock private CourtPriceRepository prices;
  @Mock private CourtScheduleRepository courtSchedules;
  @Mock private AccountRepository accounts;
  @Mock private StaffRepository staff;
  @Mock private StaffScheduleRepository staffSchedules;
  @Mock private TournamentRepository tournaments;
  @Mock private TournamentRegistrationRepository registrations;
  @Mock private TournamentMatchRepository matches;
  @Mock private TournamentService tournamentService;
  @Mock private CustomerOrderRepository orders;
  @Mock private PaymentRepository payments;
  @Mock private RefundRepository refunds;
  @Mock private AuthService auth;
  @Mock private AuditService audit;

  private CatalogService catalogService;
  private Account actor;
  private Account target;
  private UUID actorId;
  private UUID targetId;

  @BeforeEach
  void setUp() {
    catalogService =
        new CatalogService(
            courts,
            prices,
            courtSchedules,
            accounts,
            staff,
            staffSchedules,
            tournaments,
            registrations,
            matches,
            tournamentService,
            orders,
            payments,
            refunds,
            auth,
            audit);

    actorId = UUID.randomUUID();
    actor = new Account();
    actor.setId(actorId);
    actor.setEmail("admin@courtly.vn");
    actor.setFullName("Admin User");
    actor.setRole("ADMIN");

    targetId = UUID.randomUUID();
    target = new Account();
    target.setId(targetId);
    target.setEmail("customer@courtly.vn");
    target.setFullName("Customer User");
    target.setRole("CUSTOMER");
  }

  @Test
  @DisplayName("Không được tự xóa tài khoản của chính mình")
  void delete_selfAccount_throwsException() {
    when(accounts.findForUpdate(actorId)).thenReturn(Optional.of(actor));

    BusinessException ex =
        assertThrows(
            BusinessException.class, () -> catalogService.delete("accounts", actorId, actor));
    assertTrue(ex.getMessage().contains("Không thể tự xóa tài khoản của chính mình"));
    verify(accounts, never()).delete(any());
  }

  @Test
  @DisplayName("Không được xóa tài khoản chủ hệ thống (Owner)")
  void delete_ownerAccount_throwsException() {
    when(accounts.findForUpdate(targetId)).thenReturn(Optional.of(target));
    when(auth.owner(target)).thenReturn(true);

    BusinessException ex =
        assertThrows(
            BusinessException.class, () -> catalogService.delete("accounts", targetId, actor));
    assertTrue(ex.getMessage().contains("chủ hệ thống"));
    verify(accounts, never()).delete(any());
  }

  @Test
  @DisplayName("Chặn xóa tài khoản khi đã có đơn đặt sân")
  void delete_accountWithOrders_throwsException() {
    when(accounts.findForUpdate(targetId)).thenReturn(Optional.of(target));
    when(auth.owner(target)).thenReturn(false);

    CustomerOrder order = new CustomerOrder();
    order.setCustomerAccount(target);
    when(orders.findAll()).thenReturn(List.of(order));

    BusinessException ex =
        assertThrows(
            BusinessException.class, () -> catalogService.delete("accounts", targetId, actor));
    assertTrue(ex.getMessage().contains("đơn đặt sân hoặc dữ liệu giao dịch"));
    verify(accounts, never()).delete(any());
  }

  @Test
  @DisplayName("Xóa thành công tài khoản không có ràng buộc dữ liệu")
  void delete_cleanAccount_success() {
    when(accounts.findForUpdate(targetId)).thenReturn(Optional.of(target));
    when(auth.owner(target)).thenReturn(false);
    when(orders.findAll()).thenReturn(List.of());
    when(payments.findAll()).thenReturn(List.of());
    when(refunds.findAll()).thenReturn(List.of());
    when(registrations.findAll()).thenReturn(List.of());
    when(tournaments.findAll()).thenReturn(List.of());

    catalogService.delete("accounts", targetId, actor);

    verify(accounts).delete(target);
    verify(audit).log(eq("XÓA TÀI KHOẢN"), contains("customer@courtly.vn"));
  }
}

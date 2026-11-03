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
  @Mock private TeamMemberRepository teamMembers;
  @Mock private VoucherRedemptionRepository voucherRedemptions;
  @Mock private DocumentService docs;
  @Mock private AuthService auth;
  @Mock private AuditService audit;
  @Mock private org.springframework.jdbc.core.JdbcTemplate jdbc;

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
            teamMembers,
            voucherRedemptions,
            docs,
            auth,
            audit,
            jdbc);

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
  @DisplayName("Xóa thành công tài khoản dù đã có đơn đặt sân (gỡ liên kết để bảo toàn đơn và giải phóng email)")
  void delete_accountWithOrders_disassociatesAndDeletes() {
    when(accounts.findForUpdate(targetId)).thenReturn(Optional.of(target));
    when(auth.owner(target)).thenReturn(false);

    CustomerOrder order = new CustomerOrder();
    order.setCustomerAccount(target);
    when(orders.findAll()).thenReturn(List.of(order));
    when(payments.findAll()).thenReturn(List.of());
    when(refunds.findAll()).thenReturn(List.of());
    when(tournaments.findAll()).thenReturn(List.of());
    when(matches.findAll()).thenReturn(List.of());
    when(registrations.findAll()).thenReturn(List.of());
    when(teamMembers.findAll()).thenReturn(List.of());
    when(voucherRedemptions.findAll()).thenReturn(List.of());
    when(docs.list(anyString())).thenReturn(List.of());

    catalogService.delete("accounts", targetId, actor);

    assertNull(order.getCustomerAccount());
    verify(orders).save(order);
    verify(accounts).delete(target);
    verify(audit).log(eq("XÓA TÀI KHOẢN"), contains("customer@courtly.vn"));
  }

  @Test
  @DisplayName("Xóa thành công tài khoản không có ràng buộc dữ liệu")
  void delete_cleanAccount_success() {
    when(accounts.findForUpdate(targetId)).thenReturn(Optional.of(target));
    when(auth.owner(target)).thenReturn(false);
    when(orders.findAll()).thenReturn(List.of());
    when(payments.findAll()).thenReturn(List.of());
    when(refunds.findAll()).thenReturn(List.of());
    when(tournaments.findAll()).thenReturn(List.of());
    when(matches.findAll()).thenReturn(List.of());
    when(registrations.findAll()).thenReturn(List.of());
    when(teamMembers.findAll()).thenReturn(List.of());
    when(voucherRedemptions.findAll()).thenReturn(List.of());
    when(docs.list(anyString())).thenReturn(List.of());

    catalogService.delete("accounts", targetId, actor);

    verify(accounts).delete(target);
    verify(audit).log(eq("XÓA TÀI KHOẢN"), contains("customer@courtly.vn"));
  }

  @Test
  @DisplayName("Tạo sân tự động sinh tên tiếp theo với STT tăng dần khi để trống tên")
  void saveCourt_autoGeneratesNextName_whenBlank() {
    com.courtly.entity.Court c1 = new com.courtly.entity.Court();
    c1.setId(UUID.randomUUID()); c1.setName("Sân A01"); c1.setType("OUTDOOR");
    com.courtly.entity.Court c2 = new com.courtly.entity.Court();
    c2.setId(UUID.randomUUID()); c2.setName("Sân A02"); c2.setType("OUTDOOR");
    com.courtly.entity.Court c3 = new com.courtly.entity.Court();
    c3.setId(UUID.randomUUID()); c3.setName("Sân A03"); c3.setType("OUTDOOR");
    com.courtly.entity.Court c4 = new com.courtly.entity.Court();
    c4.setId(UUID.randomUUID()); c4.setName("Sân A04"); c4.setType("OUTDOOR");
    when(courts.findAll()).thenReturn(List.of(c1, c2, c3, c4));
    when(courts.save(any(com.courtly.entity.Court.class))).thenAnswer(inv -> {
      com.courtly.entity.Court c = inv.getArgument(0);
      c.setId(UUID.randomUUID());
      return c;
    });

    com.courtly.dto.request.CatalogRequest req = new com.courtly.dto.request.CatalogRequest(
        "", "OUTDOOR", "ACTIVE", java.math.BigDecimal.valueOf(200000), null, null, null, null, null,
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null
    );

    UUID newId = catalogService.save("courts", null, req);
    assertNotNull(newId);
    verify(courts).save(argThat(c -> "Sân A05".equals(c.getName()) && "OUTDOOR".equals(c.getType())));
  }

  @Test
  @DisplayName("Tự động lấp chỗ trống khi sân ở giữa bị xóa (gap-filling B03)")
  void saveCourt_fillsGapInSequence_whenMiddleCourtDeleted() {
    com.courtly.entity.Court c1 = new com.courtly.entity.Court();
    c1.setId(UUID.randomUUID()); c1.setName("Sân B01"); c1.setType("INDOOR");
    com.courtly.entity.Court c2 = new com.courtly.entity.Court();
    c2.setId(UUID.randomUUID()); c2.setName("Sân B02"); c2.setType("INDOOR");
    com.courtly.entity.Court c4 = new com.courtly.entity.Court();
    c4.setId(UUID.randomUUID()); c4.setName("Sân B04"); c4.setType("INDOOR");
    when(courts.findAll()).thenReturn(List.of(c1, c2, c4));
    when(courts.save(any(com.courtly.entity.Court.class))).thenAnswer(inv -> {
      com.courtly.entity.Court c = inv.getArgument(0);
      c.setId(UUID.randomUUID());
      return c;
    });

    com.courtly.dto.request.CatalogRequest req = new com.courtly.dto.request.CatalogRequest(
        "", "INDOOR", "ACTIVE", java.math.BigDecimal.valueOf(250000), null, null, null, null, null,
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null
    );

    UUID newId = catalogService.save("courts", null, req);
    assertNotNull(newId);
    verify(courts).save(argThat(c -> "Sân B03".equals(c.getName()) && "INDOOR".equals(c.getType())));
  }

  @Test
  @DisplayName("Từ chối tạo hoặc sửa sân khi tên sân bị trùng lặp")
  void saveCourt_rejectsDuplicateName() {
    com.courtly.entity.Court existingCourt = new com.courtly.entity.Court();
    existingCourt.setId(UUID.randomUUID());
    existingCourt.setName("Sân A01");
    existingCourt.setType("OUTDOOR");
    when(courts.findAll()).thenReturn(List.of(existingCourt));

    com.courtly.dto.request.CatalogRequest req = new com.courtly.dto.request.CatalogRequest(
        "sân a01", "OUTDOOR", "ACTIVE", java.math.BigDecimal.valueOf(200000), null, null, null, null, null,
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null
    );

    BusinessException ex = assertThrows(BusinessException.class, () -> catalogService.save("courts", null, req));
    assertTrue(ex.getMessage().contains("đã tồn tại"));
  }

  @Test
  @DisplayName("Xóa sân: Khi sân chưa có đơn đặt, xóa sạch khỏi hệ thống")
  void deleteCourt_hardDeletesWhenNoBookings() {
    UUID courtId = UUID.randomUUID();
    com.courtly.entity.Court court = new com.courtly.entity.Court();
    court.setId(courtId);
    court.setName("Sân A05");
    court.setType("OUTDOOR");
    court.setStatus("ACTIVE");

    when(courts.findForUpdate(courtId)).thenReturn(Optional.of(court));
    when(jdbc.queryForObject(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.eq(Integer.class), org.mockito.ArgumentMatchers.eq(courtId)))
        .thenReturn(0);

    assertEquals("DELETED", catalogService.delete("courts", courtId, actor));

    verify(courts).delete(court);
    verify(audit).log(org.mockito.ArgumentMatchers.eq("XÓA VĨNH VIỄN SÂN"), org.mockito.ArgumentMatchers.contains("Sân A05"));
  }

  @Test
  @DisplayName("Xóa sân: Khi sân đã có đơn đặt, soft delete và đổi trạng thái sang DELETED")
  void deleteCourt_softDeletesWhenHasBookings() {
    UUID courtId = UUID.randomUUID();
    com.courtly.entity.Court court = new com.courtly.entity.Court();
    court.setId(courtId);
    court.setName("Sân A01");
    court.setType("OUTDOOR");
    court.setStatus("ACTIVE");

    when(courts.findForUpdate(courtId)).thenReturn(Optional.of(court));
    when(jdbc.queryForObject(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.eq(Integer.class), org.mockito.ArgumentMatchers.eq(courtId)))
        .thenReturn(3);

    assertEquals("ARCHIVED", catalogService.delete("courts", courtId, actor));

    verify(courts).save(argThat(c -> "DELETED".equals(c.getStatus())));
    verify(courts, org.mockito.Mockito.never()).delete(court);
    verify(jdbc, org.mockito.Mockito.never()).update("DELETE FROM court_prices WHERE court_id = ?", courtId);
    verify(audit).log(org.mockito.ArgumentMatchers.eq("NGỪNG KHAI THÁC SÂN"), org.mockito.ArgumentMatchers.contains("Sân A01"));
  }

  @Test
  @DisplayName("Ngừng sân: bị chặn khi còn đơn sắp tới, sân giữ nguyên")
  void deleteCourt_blockedWhenUpcomingOrders() {
    UUID courtId = UUID.randomUUID();
    com.courtly.entity.Court court = new com.courtly.entity.Court();
    court.setId(courtId);
    court.setName("Sân A01");
    court.setType("OUTDOOR");
    court.setStatus("ACTIVE");

    when(courts.findForUpdate(courtId)).thenReturn(Optional.of(court));
    when(jdbc.queryForList(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.eq(courtId), org.mockito.ArgumentMatchers.any(java.time.LocalDate.class)))
        .thenReturn(List.of(Map.of("label", "CT-26262626 · Phạm Minh Đức · 04/11")));

    BusinessException e = assertThrows(BusinessException.class, () -> catalogService.delete("courts", courtId, actor));

    assertTrue(e.getMessage().contains("CT-26262626"));
    verify(courts, org.mockito.Mockito.never()).save(org.mockito.ArgumentMatchers.any());
    verify(courts, org.mockito.Mockito.never()).delete(org.mockito.ArgumentMatchers.any());
  }

  @Test
  @DisplayName("replaceZoneTariff: từ chối bảng giá khi khung giờ bị thiếu (gap)")
  void replaceZoneTariff_rejectsGapInTariff() {
    List<com.courtly.dto.request.ZoneTariffRequest.TariffRowRequest> rows = List.of(
        new com.courtly.dto.request.ZoneTariffRequest.TariffRowRequest("WEEKDAY", "06:00", "12:00", java.math.BigDecimal.valueOf(100000)),
        new com.courtly.dto.request.ZoneTariffRequest.TariffRowRequest("WEEKDAY", "14:00", "23:00", java.math.BigDecimal.valueOf(150000)),
        new com.courtly.dto.request.ZoneTariffRequest.TariffRowRequest("WEEKEND", "06:00", "23:00", java.math.BigDecimal.valueOf(200000))
    );
    com.courtly.dto.request.ZoneTariffRequest req = new com.courtly.dto.request.ZoneTariffRequest(java.time.LocalDate.now().plusDays(1), rows);

    BusinessException ex = assertThrows(BusinessException.class, () -> catalogService.replaceZoneTariff("OUTDOOR", req, actor));
    assertTrue(ex.getMessage().contains("không liên tục"));
  }

  @Test
  @DisplayName("replaceZoneTariff: từ chối bảng giá khi khung giờ không bắt đầu từ 06:00 hoặc không kết thúc lúc 23:00")
  void replaceZoneTariff_rejectsInvalidCoverage() {
    List<com.courtly.dto.request.ZoneTariffRequest.TariffRowRequest> rows = List.of(
        new com.courtly.dto.request.ZoneTariffRequest.TariffRowRequest("WEEKDAY", "07:00", "23:00", java.math.BigDecimal.valueOf(100000)),
        new com.courtly.dto.request.ZoneTariffRequest.TariffRowRequest("WEEKEND", "06:00", "23:00", java.math.BigDecimal.valueOf(200000))
    );
    com.courtly.dto.request.ZoneTariffRequest req = new com.courtly.dto.request.ZoneTariffRequest(java.time.LocalDate.now().plusDays(1), rows);

    BusinessException ex = assertThrows(BusinessException.class, () -> catalogService.replaceZoneTariff("OUTDOOR", req, actor));
    assertTrue(ex.getMessage().contains("Khung giờ đầu tiên phải bắt đầu từ 06:00"));
  }

  @Test
  @DisplayName("replaceZoneTariff: từ chối bảng giá khi các khung giờ bị chồng lấn")
  void replaceZoneTariff_rejectsOverlap() {
    List<com.courtly.dto.request.ZoneTariffRequest.TariffRowRequest> rows = List.of(
        new com.courtly.dto.request.ZoneTariffRequest.TariffRowRequest("WEEKDAY", "06:00", "14:00", java.math.BigDecimal.valueOf(100000)),
        new com.courtly.dto.request.ZoneTariffRequest.TariffRowRequest("WEEKDAY", "12:00", "23:00", java.math.BigDecimal.valueOf(150000)),
        new com.courtly.dto.request.ZoneTariffRequest.TariffRowRequest("WEEKEND", "06:00", "23:00", java.math.BigDecimal.valueOf(200000))
    );
    com.courtly.dto.request.ZoneTariffRequest req = new com.courtly.dto.request.ZoneTariffRequest(java.time.LocalDate.now().plusDays(1), rows);

    BusinessException ex = assertThrows(BusinessException.class, () -> catalogService.replaceZoneTariff("OUTDOOR", req, actor));
    assertTrue(ex.getMessage().contains("chồng lấn") || ex.getMessage().contains("không liên tục"));
  }

  @Test
  @DisplayName("replaceZoneTariff: từ chối khi ngày áp dụng trong quá khứ")
  void replaceZoneTariff_rejectsPastEffectiveDate() {
    List<com.courtly.dto.request.ZoneTariffRequest.TariffRowRequest> rows = List.of(
        new com.courtly.dto.request.ZoneTariffRequest.TariffRowRequest("WEEKDAY", "06:00", "23:00", java.math.BigDecimal.valueOf(100000)),
        new com.courtly.dto.request.ZoneTariffRequest.TariffRowRequest("WEEKEND", "06:00", "23:00", java.math.BigDecimal.valueOf(200000))
    );
    com.courtly.dto.request.ZoneTariffRequest req = new com.courtly.dto.request.ZoneTariffRequest(java.time.LocalDate.now().minusDays(1), rows);

    BusinessException ex = assertThrows(BusinessException.class, () -> catalogService.replaceZoneTariff("OUTDOOR", req, actor));
    assertTrue(ex.getMessage().contains("từ hôm nay trở đi"));
  }

  @Test
  @DisplayName("replaceZoneTariff: cập nhật thành công bảng giá cho khu và cập nhật slot tương ứng")
  void replaceZoneTariff_success() {
    com.courtly.entity.Court court1 = new com.courtly.entity.Court();
    court1.setId(UUID.randomUUID());
    court1.setName("Sân A01");
    court1.setType("OUTDOOR");
    court1.setStatus("ACTIVE");

    when(courts.findAll()).thenReturn(List.of(court1));
    org.mockito.Mockito.lenient().when(jdbc.update(org.mockito.ArgumentMatchers.contains("UPDATE court_schedules"), org.mockito.ArgumentMatchers.eq("OUTDOOR"), org.mockito.ArgumentMatchers.any(java.time.LocalDate.class)))
        .thenReturn(10);

    List<com.courtly.dto.request.ZoneTariffRequest.TariffRowRequest> rows = List.of(
        new com.courtly.dto.request.ZoneTariffRequest.TariffRowRequest("WEEKDAY", "06:00", "17:00", java.math.BigDecimal.valueOf(120000)),
        new com.courtly.dto.request.ZoneTariffRequest.TariffRowRequest("WEEKDAY", "17:00", "23:00", java.math.BigDecimal.valueOf(180000)),
        new com.courtly.dto.request.ZoneTariffRequest.TariffRowRequest("WEEKEND", "06:00", "23:00", java.math.BigDecimal.valueOf(220000))
    );
    java.time.LocalDate effDate = java.time.LocalDate.now().plusDays(2);
    com.courtly.dto.request.ZoneTariffRequest req = new com.courtly.dto.request.ZoneTariffRequest(effDate, rows);

    int updatedSlots = catalogService.replaceZoneTariff("OUTDOOR", req, actor);

    assertEquals(10, updatedSlots);
    verify(jdbc).update("DELETE FROM court_prices WHERE court_id = ?", court1.getId());
    verify(jdbc, times(3)).update(org.mockito.ArgumentMatchers.contains("INSERT INTO court_prices"), org.mockito.ArgumentMatchers.eq(court1.getId()), any(), any(), any(), any());
    verify(audit).log(org.mockito.ArgumentMatchers.eq("CẬP NHẬT BẢNG GIÁ"), org.mockito.ArgumentMatchers.contains("OUTDOOR"));
  }
}

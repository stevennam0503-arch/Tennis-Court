package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.dto.request.CatalogRequest;
import com.courtly.entity.*;
import com.courtly.exception.BusinessException;
import com.courtly.repository.*;
import com.courtly.util.PhoneUtils;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CatalogService {
  private final CourtRepository courts;
  private final CourtPriceRepository prices;
  private final CourtScheduleRepository courtSchedules;
  private final AccountRepository accounts;
  private final StaffRepository staff;
  private final StaffScheduleRepository staffSchedules;
  private final TournamentRepository tournaments;
  private final TournamentRegistrationRepository registrations;
  private final TournamentMatchRepository matches;
  private final TournamentService tournamentService;
  private final CustomerOrderRepository orders;
  private final PaymentRepository payments;
  private final RefundRepository refunds;
  private final TeamMemberRepository teamMembers;
  private final VoucherRedemptionRepository voucherRedemptions;
  private final DocumentService docs;
  private final AuthService auth;
  private final AuditService audit;
  private final JdbcTemplate jdbc;
  private final ScheduleService scheduleService;

  @Transactional
  public UUID save(String collection, UUID id, CatalogRequest r) {
    UUID result =
        switch (collection) {
          case "courts" -> court(id, r);
          case "prices" -> price(id, r);
          case "accounts" -> account(id, r);
          case "staff" -> staff(id, r);
          case "staff-schedules" -> staffSchedule(id, r);
          case "tournaments" -> tournament(id, r);
          default -> throw new BusinessException("Danh mục không được hỗ trợ");
        };
    audit.log("LƯU " + collection.toUpperCase(), result.toString());
    return result;
  }

  @Transactional
  /** Trả về "ARCHIVED" khi sân có lịch sử chỉ bị ngừng khai thác, "DELETED" khi bản ghi bị xóa hẳn. */
  public String delete(String collection, UUID id, Account actor) {
    switch (collection) {
      case "accounts" -> { deleteAccount(id, actor); return "DELETED"; }
      case "courts" -> { return deleteCourt(id, actor); }
      case "staff-schedules" -> { return deleteStaffSchedule(id, actor); }
      default -> throw new BusinessException("Danh mục không hỗ trợ xóa");
    }
  }

  /** Đơn còn hiệu lực (giữ chỗ, đã xác nhận, đang chơi) có buổi chơi từ hôm nay trở đi trên sân này. */
  private List<String> upcomingCourtOrders(UUID courtId) {
    if (jdbc == null) return List.of();
    return jdbc.queryForList(
        """
        SELECT DISTINCT 'CT-' || upper(left(replace(o.id::text, '-', ''), 8)) || ' · ' || o.customer_name
               || ' · ' || to_char(cs.schedule_date, 'DD/MM') AS label, cs.schedule_date
        FROM court_schedules cs
        JOIN booking_slots bs ON bs.schedule_id = cs.id AND bs.released_at IS NULL
        JOIN bookings b ON b.id = bs.booking_id
        JOIN orders o ON o.id = b.order_id
        WHERE cs.court_id = ? AND cs.schedule_date >= ?
          AND o.status IN ('HOLDING', 'CONFIRMED', 'CHECKED_IN')
        ORDER BY cs.schedule_date
        """,
        courtId, LocalDate.now(ZONE)).stream().map(r -> (String) r.get("label")).distinct().toList();
  }

  private void requireNoUpcomingOrders(UUID courtId, String action) {
    var upcoming = upcomingCourtOrders(courtId);
    require(
        upcoming.isEmpty(),
        "Không thể " + action + ": sân còn " + upcoming.size() + " đơn sắp tới ("
            + String.join("; ", upcoming.subList(0, Math.min(3, upcoming.size())))
            + (upcoming.size() > 3 ? "; …" : "")
            + "). Đổi lịch sang sân khác hoặc hủy và hoàn tiền trước.");
  }

  private String deleteStaffSchedule(UUID id, Account actor) {
    auth.admin(actor);
    StaffSchedule s = staffSchedules.findForUpdate(id)
        .orElseThrow(() -> new BusinessException("Lịch không tồn tại"));
    require("AVAILABLE".equals(s.getStatus()), "Không thể xóa slot đã được phân công hoặc đang có đơn đặt");
    staffSchedules.delete(s);
    return "DELETED";
  }

  private String deleteCourt(UUID id, Account actor) {
    auth.admin(actor);
    Court target =
        courts
            .findForUpdate(id)
            .orElseThrow(() -> new BusinessException("Sân không tồn tại"));
    requireNoUpcomingOrders(id, "ngừng khai thác " + target.getName());

    Integer bookedCount = 0;
    if (jdbc != null) {
      bookedCount =
          jdbc.queryForObject(
              """
              SELECT COUNT(*) FROM court_schedules cs
              WHERE cs.court_id = ?
                AND (
                  EXISTS (SELECT 1 FROM booking_slots bs WHERE bs.schedule_id = cs.id)
                  OR EXISTS (SELECT 1 FROM match_slots ms WHERE ms.schedule_id = cs.id)
                  OR EXISTS (SELECT 1 FROM booking_staff bst WHERE bst.court_schedule_id = cs.id)
                )
              """,
              Integer.class,
              id);
    }

    if (bookedCount != null && bookedCount > 0) {
      // Sân đã có lịch sử: ngừng khai thác (lưu trữ). Giữ bảng giá để có thể mở lại.
      target.setStatus("DELETED");
      courts.save(target);
      if (jdbc != null) {
        jdbc.update(
            """
            DELETE FROM court_schedules cs
            WHERE cs.court_id = ?
              AND NOT EXISTS (SELECT 1 FROM booking_slots bs WHERE bs.schedule_id = cs.id)
              AND NOT EXISTS (SELECT 1 FROM match_slots ms WHERE ms.schedule_id = cs.id)
              AND NOT EXISTS (SELECT 1 FROM booking_staff bst WHERE bst.court_schedule_id = cs.id)
            """,
            id);
      }
      audit.log("NGỪNG KHAI THÁC SÂN", target.getName() + " (" + target.getType() + ")");
      return "ARCHIVED";
    } else {
      if (jdbc != null) {
        jdbc.update("DELETE FROM court_schedules WHERE court_id = ?", id);
        jdbc.update("DELETE FROM court_prices WHERE court_id = ?", id);
      }
      courts.delete(target);
    }
    audit.log("XÓA VĨNH VIỄN SÂN", target.getName() + " (" + target.getType() + ")");
    return "DELETED";
  }

  private void deleteAccount(UUID id, Account actor) {
    Account target =
        accounts
            .findForUpdate(id)
            .orElseThrow(() -> new BusinessException("Tài khoản không tồn tại"));

    require(!id.equals(actor.getId()), "Không thể tự xóa tài khoản của chính mình");
    require(!auth.owner(target), "Không thể xóa tài khoản chủ hệ thống (Owner)");

    // 1. Gỡ liên kết tài khoản ở các đơn hàng (vẫn bảo toàn thông tin khách hàng, doanh thu và hóa đơn)
    for (CustomerOrder o : orders.findAll()) {
      boolean modified = false;
      if (o.getCustomerAccount() != null && id.equals(o.getCustomerAccount().getId())) {
        o.setCustomerAccount(null);
        modified = true;
      }
      if (o.getCreatedByAccount() != null && id.equals(o.getCreatedByAccount().getId())) {
        o.setCreatedByAccount(null);
        modified = true;
      }
      if (modified) {
        orders.save(o);
      }
    }

    // 2. Gỡ liên kết tài khoản thu ngân ở các giao dịch thu tiền
    for (Payment p : payments.findAll()) {
      if (p.getReceivedByAccount() != null && id.equals(p.getReceivedByAccount().getId())) {
        p.setReceivedByAccount(null);
        payments.save(p);
      }
    }

    // 3. Gỡ liên kết tài khoản xử lý hoàn tiền
    for (Refund r : refunds.findAll()) {
      if (r.getProcessedByAccount() != null && id.equals(r.getProcessedByAccount().getId())) {
        r.setProcessedByAccount(null);
        refunds.save(r);
      }
    }

    // 4. Gỡ liên kết tài khoản tổ chức giải đấu & cập nhật tỉ số
    for (Tournament t : tournaments.findAll()) {
      if (t.getOrganizerAccount() != null && id.equals(t.getOrganizerAccount().getId())) {
        t.setOrganizerAccount(null);
        tournaments.save(t);
      }
    }
    for (TournamentMatch m : matches.findAll()) {
      if (m.getUpdatedByAccount() != null && id.equals(m.getUpdatedByAccount().getId())) {
        m.setUpdatedByAccount(null);
        matches.save(m);
      }
    }

    // 5. Gỡ liên kết đăng ký thi đấu và thành viên đội giải đấu
    for (TournamentRegistration r : registrations.findAll()) {
      boolean modified = false;
      if (r.getRegisteredByAccount() != null && id.equals(r.getRegisteredByAccount().getId())) {
        r.setRegisteredByAccount(null);
        modified = true;
      }
      if (r.getAccount() != null && id.equals(r.getAccount().getId())) {
        r.setAccount(null);
        modified = true;
      }
      if (modified) {
        registrations.save(r);
      }
    }

    if (teamMembers != null) {
      for (TeamMember tm : teamMembers.findAll()) {
        if (tm.getAccount() != null && id.equals(tm.getAccount().getId())) {
          tm.setAccount(null);
          teamMembers.save(tm);
        }
      }
    }

    // 6. Gỡ liên kết lịch sử sử dụng voucher
    if (voucherRedemptions != null) {
      for (VoucherRedemption vr : voucherRedemptions.findAll()) {
        if (vr.getAccount() != null && id.equals(vr.getAccount().getId())) {
          vr.setAccount(null);
          voucherRedemptions.save(vr);
        }
      }
    }

    // 7. Xóa sạch OTP kích hoạt/reset và hồ sơ tạm của tài khoản
    if (docs != null) {
      if (target.getEmail() != null) {
        docs.delete("otp:activation:" + target.getEmail().toLowerCase(Locale.ROOT));
        docs.delete("otp:reset:" + target.getEmail().toLowerCase(Locale.ROOT));
      }
      for (var m : docs.list("membership:")) {
        if (id.toString().equals(m.get("accountId"))) {
          docs.delete("membership:" + m.get("id"));
        }
      }
      for (var mp : docs.list("membership-payment:")) {
        if (id.toString().equals(mp.get("accountId"))) {
          docs.delete("membership-payment:" + mp.get("id"));
        }
      }
      for (var tr : docs.list("transfer:")) {
        if (id.toString().equals(tr.get("accountId"))) {
          docs.delete("transfer:" + tr.get("id"));
        }
      }
    }

    // 8. Xóa vĩnh viễn tài khoản để giải phóng email cho phép đăng ký lại
    accounts.delete(target);
    audit.log("XÓA TÀI KHOẢN", target.getEmail() + " (" + target.getFullName() + ")");
  }

  private UUID court(UUID id, CatalogRequest r) {
    Court c =
        id == null
            ? new Court()
            : courts
                .findForUpdate(id)
                .orElseThrow(() -> new BusinessException("Sân không tồn tại"));
    String courtType = oneOf(r.type(), "VIP", "INDOOR", "OUTDOOR");
    String courtName = r.name() != null ? r.name().trim() : "";
    if (courtName.isEmpty()) {
      courtName = generateNextCourtName(courtType);
    }
    require(!isCourtNameDuplicate(id, courtName), "Tên sân '" + courtName + "' đã tồn tại. Vui lòng chọn tên khác.");
    boolean renamed = id == null || !courtName.equalsIgnoreCase(c.getName() == null ? "" : c.getName().trim());
    require(
        !renamed || !isArchivedCourtName(id, courtName),
        "Sân '" + courtName + "' đã ngừng khai thác. Hãy mở lại sân này trong mục \"Đã ngừng khai thác\" thay vì tạo sân mới cùng tên.");
    boolean reopening = id != null && "DELETED".equalsIgnoreCase(c.getStatus());
    c.setName(courtName);
    c.setType(courtType);
    c.setZoneNeedsReview(false);
    String status = oneOf(r.status(), "ACTIVE", "MAINTENANCE", "INACTIVE");
    if (!"ACTIVE".equals(status) && id != null && !reopening) {
      requireNoUpcomingOrders(id, "chuyển sân sang trạng thái tạm ngưng");
    }
    c.setStatus(status);
    c.setBasePrice(positive(r.price()));
    c.setDescription(r.description());
    c.setAddress(r.address());
    c.setAmenities(r.amenities());
    if (r.imageUrl() != null && !r.imageUrl().isBlank()) {
      var url = java.net.URI.create(r.imageUrl());
      require(
          ("https".equals(url.getScheme()) && url.getHost() != null && url.getUserInfo() == null)
              || r.imageUrl().matches("^/images/[a-zA-Z0-9_-]+\\.(webp|png|jpg|jpeg)$")
              || r.imageUrl().matches("^/guest/[a-zA-Z0-9_-]+\\.(webp|png|jpg|jpeg)$"),
          "URL ảnh phải dùng HTTPS hoặc /images/, /guest/");
    }
    c.setImageUrl(r.imageUrl());
    c.setImageIsIllustration(r.imageIsIllustration() == null || r.imageIsIllustration());
    UUID saved = courts.save(c).getId();
    if (reopening) {
      if (jdbc != null) {
        courts.flush();
        jdbc.update("DELETE FROM court_prices WHERE court_id = ?", saved);
        jdbc.update(
            """
            INSERT INTO court_prices (id, court_id, day_type, start_time, end_time, price_per_hour)
            SELECT gen_random_uuid(), ?, p.day_type, p.start_time, p.end_time, p.price_per_hour
            FROM court_prices p
            WHERE p.court_id = (
                SELECT c2.id FROM courts c2
                JOIN court_prices p2 ON p2.court_id = c2.id
                WHERE c2.type = ? AND c2.status <> 'DELETED' AND c2.id <> ?
                ORDER BY CASE WHEN c2.status = 'ACTIVE' THEN 0 ELSE 1 END, c2.name LIMIT 1
            )
            """,
            saved, courtType, saved);
        jdbc.update(
            """
            UPDATE court_schedules cs
            SET price = p.price_per_hour / 2
            FROM court_prices p
            WHERE cs.court_id = ?
              AND p.court_id = cs.court_id
              AND cs.schedule_date >= ?
              AND cs.status IN ('AVAILABLE', 'MAINTENANCE')
              AND p.day_type = CASE WHEN EXTRACT(isodow FROM cs.schedule_date) IN (6, 7) THEN 'WEEKEND' ELSE 'WEEKDAY' END
              AND cs.start_time >= p.start_time
              AND cs.start_time < p.end_time
            """,
            saved, LocalDate.now(ZONE));
      }
      audit.log("MỞ LẠI SÂN", courtName + " (" + courtType + ")");
    } else {
      copyZonePricesIfMissing(saved, courtType);
    }
    return saved;
  }

  private boolean isArchivedCourtName(UUID currentCourtId, String rawName) {
    String cleanName = rawName.trim().replaceAll("^(?i)(sân|san)\\s+", "");
    return courts.findAll().stream()
        .filter(c -> "DELETED".equalsIgnoreCase(c.getStatus()))
        .filter(c -> currentCourtId == null || !c.getId().equals(currentCourtId))
        .anyMatch(c -> c.getName() != null
            && c.getName().trim().replaceAll("^(?i)(sân|san)\\s+", "").equalsIgnoreCase(cleanName));
  }

  private UUID price(UUID id, CatalogRequest r) {
    times(r);
    CourtPrice p =
        id == null
            ? new CourtPrice()
            : prices
                .findForUpdate(id)
                .orElseThrow(() -> new BusinessException("Khung giá không tồn tại"));
    require(r.court() != null, "Chọn sân");
    p.setCourt(
        courts.findById(r.court()).orElseThrow(() -> new BusinessException("Sân không tồn tại")));
    p.setDayType(oneOf(r.dayType(), "WEEKDAY", "WEEKEND"));
    p.setStartTime(clock(r.start()));
    p.setEndTime(clock(r.end()));
    p.setPricePerHour(positive(r.price()));
    return prices.save(p).getId();
  }

  private UUID account(UUID id, CatalogRequest r) {
    Account a =
        id == null
            ? new Account()
            : accounts
                .findForUpdate(id)
                .orElseThrow(() -> new BusinessException("Tài khoản không tồn tại"));
    a.setFullName(text(r.name(), "Tên tài khoản"));
    String email = text(r.email(), "Email").toLowerCase(Locale.ROOT);
    require(email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+"), "Email không hợp lệ");
    require(
        accounts.findByEmailIgnoreCase(email).map(x -> x.getId().equals(id)).orElse(true),
        "Email đã tồn tại");
    a.setEmail(email);
    String rawPhone = r.phone() == null ? "" : r.phone().trim();
    String normPhone = rawPhone.isBlank() ? "" : PhoneUtils.normalizeE164(rawPhone);
    if (!normPhone.isBlank()) {
      require(
          accounts.findByPhone(normPhone).map(x -> x.getId().equals(id)).orElse(true),
          "Số điện thoại đã có tài khoản");
    }
    a.setPhone(normPhone);
    a.setRole(oneOf(r.role(), "ADMIN", "STAFF", "CUSTOMER"));
    a.setStatus(oneOf(r.status(), "ACTIVE", "LOCKED"));
    return accounts.save(a).getId();
  }

  private UUID staff(UUID id, CatalogRequest r) {
    Staff s =
        id == null
            ? new Staff()
            : staff
                .findForUpdate(id)
                .orElseThrow(() -> new BusinessException("Nhân sự không tồn tại"));
    s.setFullName(text(r.name(), "Tên nhân sự"));
    s.setType(oneOf(r.type(), "REFEREE", "BALL_BOY", "COACH"));
    String staffPhone = r.phone() == null ? "" : r.phone().trim();
    s.setPhone(staffPhone.isBlank() ? "" : (PhoneUtils.isValid(staffPhone) ? PhoneUtils.normalizeE164(staffPhone) : staffPhone));
    s.setHourlyRate(positive(r.rate()));
    String status = oneOf(r.status(), "ACTIVE", "INACTIVE");
    if (id != null && "INACTIVE".equals(status))
      require(
          staffSchedules.findAll().stream()
              .noneMatch(
                  x -> x.getStaff().getId().equals(id) && !"AVAILABLE".equals(x.getStatus())),
          "Nhân sự đang có lịch phân công");
    s.setStatus(status);
    return staff.save(s).getId();
  }

  private void times(CatalogRequest r) {
    require(
        r.start() != null
            && r.end() != null
            && r.start() >= 6
            && r.end() <= 23
            && r.start() < r.end() && r.start()*2 == Math.rint(r.start()*2) && r.end()*2 == Math.rint(r.end()*2),
        "Giờ làm việc từ 6 đến 23, giờ kết thúc sau giờ bắt đầu");
  }

  private LocalTime clock(double hour) {return LocalTime.of((int)hour, (int)Math.round((hour % 1)*60));}

  private UUID staffSchedule(UUID id, CatalogRequest r) {
    times(r);
    require(r.staff() != null && r.date() != null, "Chọn nhân sự và ngày");
    Staff person =
        staff
            .findForUpdate(r.staff())
            .orElseThrow(() -> new BusinessException("Nhân sự không tồn tại"));
    require("ACTIVE".equals(person.getStatus()), "Nhân sự không hoạt động");

    LocalDate today = LocalDate.now(ZONE);
    LocalTime now = LocalTime.now(ZONE);
    if (r.date().isBefore(today)) {
      throw new BusinessException("Không tạo được ca đã qua (hiện là " + now.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm")) + ")");
    }
    if (r.date().isEqual(today) && clock(r.start()).isBefore(now)) {
      throw new BusinessException("Không tạo được ca đã qua (hiện là " + now.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm")) + ")");
    }

    if (id != null) {
      StaffSchedule s =
          staffSchedules
              .findForUpdate(id)
              .orElseThrow(() -> new BusinessException("Lịch không tồn tại"));
      require("AVAILABLE".equals(s.getStatus()), "Không sửa lịch đang được phân công");
      require(r.end() - r.start() == 0.5 || r.end() - r.start() == 1, "Mỗi slot nhân sự dài 30 hoặc 60 phút");
      s.setStaff(person);
      s.setWorkDate(r.date());
      s.setStartTime(clock(r.start()));
      s.setEndTime(clock(r.end()));
      return s.getId();
    }

    List<StaffSchedule> existing = staffSchedules.findByStaffIdAndWorkDate(person.getId(), r.date());
    LocalTime reqStart = clock(r.start());
    LocalTime reqEnd = clock(r.end());
    List<StaffSchedule> overlapping = existing.stream().filter(ex ->
      reqStart.isBefore(ex.getEndTime()) && reqEnd.isAfter(ex.getStartTime())
    ).sorted(Comparator.comparing(StaffSchedule::getStartTime)).toList();

    if (!overlapping.isEmpty()) {
      if (Boolean.TRUE.equals(r.skipOverlaps())) {
        Set<LocalTime> existingStarts = existing.stream().map(StaffSchedule::getStartTime).collect(java.util.stream.Collectors.toSet());
        UUID firstCreated = null;
        for (int minute = (int)(r.start() * 60); minute < r.end() * 60; minute += 30) {
          LocalTime slotStart = LocalTime.of(minute / 60, minute % 60);
          if (existingStarts.contains(slotStart)) continue;
          StaffSchedule s = new StaffSchedule();
          s.setStaff(person);
          s.setWorkDate(r.date());
          s.setStartTime(slotStart);
          s.setEndTime(LocalTime.of((minute + 30) / 60, (minute + 30) % 60));
          staffSchedules.save(s);
          if (firstCreated == null) firstCreated = s.getId();
        }
        if (firstCreated == null) {
          throw new BusinessException("Toàn bộ khung giờ đã trùng với ca hiện có của nhân sự");
        }
        return firstCreated;
      }

      LocalTime overlapStart = overlapping.get(0).getStartTime();
      LocalTime overlapEnd = overlapping.get(overlapping.size() - 1).getEndTime();
      LocalTime shiftStart = existing.stream().map(StaffSchedule::getStartTime).min(Comparator.naturalOrder()).orElse(overlapStart);
      LocalTime shiftEnd = existing.stream().map(StaffSchedule::getEndTime).max(Comparator.naturalOrder()).orElse(overlapEnd);

      String dateStr = r.date().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM"));
      String msg = person.getFullName() + " đã có ca "
          + shiftStart.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm")) + "–" + shiftEnd.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm"))
          + " ngày " + dateStr + ", trùng "
          + overlapStart.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm")) + "–" + overlapEnd.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm"));
      throw new BusinessException(msg);
    }

    UUID first = null;
    for (int minute = (int)(r.start() * 60); minute < r.end() * 60; minute += 30) {
      StaffSchedule s = new StaffSchedule();
      s.setStaff(person);
      s.setWorkDate(r.date());
      s.setStartTime(LocalTime.of(minute / 60, minute % 60));
      s.setEndTime(LocalTime.of((minute + 30) / 60, (minute + 30) % 60));
      staffSchedules.save(s);
      if (first == null) first = s.getId();
    }
    return first;
  }

  private UUID tournament(UUID id, CatalogRequest r) {
    Tournament t =
        id == null
            ? new Tournament()
            : tournaments
                .findForUpdate(id)
                .orElseThrow(() -> new BusinessException("Giải không tồn tại"));
    require(
        r.startDate() != null
            && r.endDate() != null
            && r.deadline() != null
            && !r.endDate().isBefore(r.startDate())
            && !r.deadline().isAfter(r.startDate()),
        "Ngày giải không hợp lệ");
    require(r.max() != null && r.max() >= 2 && r.max() <= 1024, "Số đăng ký tối đa từ 2 đến 1024");
    require(r.fee() != null && r.fee().compareTo(BigDecimal.ZERO) >= 0, "Phí giải không hợp lệ");
    if (id != null && !registrations.findByTournamentId(id).isEmpty()) {
      require(
          t.getFormat().equals(r.format()) && t.getRegistrationFee().compareTo(r.fee()) == 0,
          "Không đổi thể thức hoặc phí khi đã có đăng ký");
      require(
          r.max() >= registrations.findByTournamentId(id).size(), "Sức chứa nhỏ hơn số đã đăng ký");
    }
    if (id != null && !matches.findByTournamentId(id).isEmpty())
      require(
          t.getStartDate().equals(r.startDate()) && t.getEndDate().equals(r.endDate()),
          "Không đổi thời gian giải sau khi bốc thăm");
    String status =
        oneOf(r.status(), "DRAFT", "OPEN", "CLOSED", "ONGOING", "FINISHED", "CANCELLED");
    if (id != null && "CANCELLED".equals(status))
      for (TournamentMatch m : matches.findByTournamentId(id)) {
        if (!"FINISHED".equals(m.getStatus())) {
          tournamentService.release(m);
          m.setStatus("CANCELLED");
        }
      }
    t.setName(text(r.name(), "Tên giải"));
    t.setFormat(oneOf(r.format(), "SINGLES", "DOUBLES", "TEAM"));
    t.setStatus(status);
    t.setStartDate(r.startDate());
    t.setEndDate(r.endDate());
    t.setRegistrationDeadline(r.deadline());
    t.setRegistrationFee(r.fee());
    t.setLocation(text(r.location(), "Địa điểm"));
    t.setMaxParticipants(r.max());
    return tournaments.save(t).getId();
  }

  public String generateNextCourtName(String type) {
    String zoneLetter = "VIP".equalsIgnoreCase(type) ? "V" : "INDOOR".equalsIgnoreCase(type) ? "B" : "A";
    java.util.regex.Pattern p = java.util.regex.Pattern.compile("^(?:Sân\\s+|San\\s+)?" + zoneLetter + "(\\d+)$", java.util.regex.Pattern.CASE_INSENSITIVE);
    java.util.Set<Integer> usedNumbers = new java.util.HashSet<>();
    // Tên của sân đã ngừng vẫn được coi là đã dùng: muốn dùng lại thì mở lại sân cũ để giữ lịch sử
    for (Court item : courts.findAll()) {
      if (item.getName() != null) {
        var m = p.matcher(item.getName().trim());
        if (m.matches()) {
          try {
            usedNumbers.add(Integer.parseInt(m.group(1)));
          } catch (NumberFormatException ignored) {}
        }
      }
    }
    int next = 1;
    while (usedNumbers.contains(next) || isCourtNameDuplicate(null, String.format("Sân %s%02d", zoneLetter, next))) {
      next++;
    }
    return String.format("Sân %s%02d", zoneLetter, next);
  }

  private boolean isCourtNameDuplicate(UUID currentCourtId, String rawName) {
    if (rawName == null || rawName.isBlank()) return false;
    String cleanName = rawName.trim().replaceAll("^(?i)(sân|san)\\s+", "");
    return courts.findAll().stream()
        .filter(c -> !"DELETED".equalsIgnoreCase(c.getStatus()))
        .filter(c -> currentCourtId == null || !c.getId().equals(currentCourtId))
        .anyMatch(c -> {
          if (c.getName() == null) return false;
          String existingRaw = c.getName().trim();
          if (existingRaw.equalsIgnoreCase(rawName.trim())) return true;
          String existingClean = existingRaw.replaceAll("^(?i)(sân|san)\\s+", "");
          return existingClean.equalsIgnoreCase(cleanName);
        });
  }

  private void copyZonePricesIfMissing(UUID courtId, String courtType) {
    if (jdbc != null && courtId != null) {
      courts.flush();
      jdbc.update(
          """
          INSERT INTO court_prices (id, court_id, day_type, start_time, end_time, price_per_hour)
          SELECT gen_random_uuid(), ?, p.day_type, p.start_time, p.end_time, p.price_per_hour
          FROM court_prices p
          WHERE p.court_id = (
              SELECT c2.id FROM courts c2
              JOIN court_prices p2 ON p2.court_id = c2.id
              WHERE c2.type = ? AND c2.status <> 'DELETED' AND c2.id <> ?
              ORDER BY CASE WHEN c2.status = 'ACTIVE' THEN 0 ELSE 1 END, c2.name LIMIT 1
          )
          AND NOT EXISTS (SELECT 1 FROM court_prices x WHERE x.court_id = ?)
          """,
          courtId, courtType, courtId, courtId);
    }
  }

  public record ParsedTariffRow(String dayType, LocalTime start, LocalTime end, BigDecimal pricePerHour) {}

  public static LocalTime parseTime(Object val) {
    if (val == null) {
      throw new BusinessException("Thời gian không được để trống");
    }
    if (val instanceof LocalTime lt) {
      return lt;
    }
    try {
      if (val instanceof Number n) {
        double d = n.doubleValue();
        int hour = (int) d;
        int minute = (int) Math.round((d - hour) * 60);
        return LocalTime.of(hour, minute);
      }
      String s = val.toString().trim();
      if (s.contains(":")) {
        String[] parts = s.split(":");
        if (parts.length == 0 || parts[0].trim().isEmpty()) {
          throw new BusinessException("Định dạng giờ không hợp lệ: " + val);
        }
        int hour = Integer.parseInt(parts[0].trim());
        int minute = parts.length > 1 ? Integer.parseInt(parts[1].trim()) : 0;
        return LocalTime.of(hour, minute);
      }
      double d = Double.parseDouble(s);
      int hour = (int) d;
      int minute = (int) Math.round((d - hour) * 60);
      return LocalTime.of(hour, minute);
    } catch (DateTimeException | NumberFormatException e) {
      throw new BusinessException("Định dạng giờ không hợp lệ: " + val);
    }
  }

  public List<ParsedTariffRow> validateAndParseTariffRows(List<com.courtly.dto.request.ZoneTariffRequest.TariffRowRequest> rawRows) {
    require(rawRows != null && !rawRows.isEmpty(), "Danh sách khung giờ không được rỗng");
    List<ParsedTariffRow> parsed = new ArrayList<>();
    for (var r : rawRows) {
      String dayType = oneOf(r.dayType(), "WEEKDAY", "WEEKEND");
      LocalTime start = parseTime(r.start());
      LocalTime end = parseTime(r.end());
      BigDecimal price = positive(r.pricePerHour());

      require(start.getSecond() == 0 && start.getMinute() % 30 == 0, "Giờ bắt đầu phải chia hết cho 30 phút (" + start + ")");
      require(end.getSecond() == 0 && end.getMinute() % 30 == 0, "Giờ kết thúc phải chia hết cho 30 phút (" + end + ")");
      require(end.isAfter(start), "Giờ kết thúc phải sau giờ bắt đầu (" + start + " -> " + end + ")");
      require(!start.isBefore(LocalTime.of(6, 0)), "Giờ bắt đầu sớm nhất là 06:00 (" + start + ")");
      require(!end.isAfter(LocalTime.of(23, 0)), "Giờ kết thúc muộn nhất là 23:00 (" + end + ")");

      parsed.add(new ParsedTariffRow(dayType, start, end, price));
    }

    // Kiểm tra từng dayType: WEEKDAY và WEEKEND phải phủ kín 06:00 - 23:00 không chồng lấn
    for (String dt : List.of("WEEKDAY", "WEEKEND")) {
      List<ParsedTariffRow> group = parsed.stream()
          .filter(r -> r.dayType().equals(dt))
          .sorted(Comparator.comparing(ParsedTariffRow::start))
          .toList();
      require(!group.isEmpty(), "Thiếu khung giờ cho " + (dt.equals("WEEKDAY") ? "ngày thường (WEEKDAY)" : "cuối tuần (WEEKEND)"));
      require(group.get(0).start().equals(LocalTime.of(6, 0)), dt + ": Khung giờ đầu tiên phải bắt đầu từ 06:00 (hiện là " + group.get(0).start() + ")");
      require(group.get(group.size() - 1).end().equals(LocalTime.of(23, 0)), dt + ": Khung giờ cuối cùng phải kết thúc lúc 23:00 (hiện là " + group.get(group.size() - 1).end() + ")");

      for (int i = 0; i < group.size() - 1; i++) {
        ParsedTariffRow curr = group.get(i);
        ParsedTariffRow next = group.get(i + 1);
        require(curr.end().equals(next.start()),
            dt + ": Khung giờ không liên tục hoặc bị chồng lấn giữa " + curr.start() + "-" + curr.end() + " và " + next.start() + "-" + next.end());
      }
    }

    return parsed;
  }

  @Transactional
  public int replaceZoneTariff(String zone, com.courtly.dto.request.ZoneTariffRequest request, Account actor) {
    auth.admin(actor);
    String cleanZone = oneOf(zone, "OUTDOOR", "INDOOR", "VIP");
    LocalDate today = LocalDate.now(ZONE);
    LocalDate effectiveFrom = request.effectiveFrom() != null ? request.effectiveFrom() : today;
    require(!effectiveFrom.isBefore(today), "Ngày áp dụng phải từ hôm nay trở đi");
    require(!effectiveFrom.isAfter(today.plusDays(90)), "Ngày áp dụng tối đa sau 90 ngày");

    List<ParsedTariffRow> rows = validateAndParseTariffRows(request.rows());

    List<Court> zoneCourts = courts.findAll().stream()
        .filter(c -> cleanZone.equalsIgnoreCase(c.getType()) && !"DELETED".equalsIgnoreCase(c.getStatus()))
        .toList();
    require(!zoneCourts.isEmpty(), "Không tìm thấy sân đang hoạt động trong khu " + cleanZone);

    if (effectiveFrom.isAfter(today)) {
      for (LocalDate d = today; d.isBefore(effectiveFrom); d = d.plusDays(1)) {
        scheduleService.generate(d);
      }
      courtSchedules.flush();
      courts.flush();
    }

    // 1. Xóa court_prices cũ của các sân trong khu (trừ DELETED)
    for (Court c : zoneCourts) {
      jdbc.update("DELETE FROM court_prices WHERE court_id = ?", c.getId());
    }

    // 2. Chèn court_prices mới
    for (Court c : zoneCourts) {
      for (ParsedTariffRow r : rows) {
        jdbc.update(
            "INSERT INTO court_prices (id, court_id, day_type, start_time, end_time, price_per_hour) VALUES (gen_random_uuid(), ?, ?, ?, ?, ?)",
            c.getId(), r.dayType(), r.start(), r.end(), r.pricePerHour());
      }
    }

    // 3. Cập nhật court_schedules.price cho các slot AVAILABLE hoặc MAINTENANCE từ ngày effectiveFrom trở đi
    int updatedSlots = jdbc.update(
        """
        UPDATE court_schedules cs
        SET price = p.price_per_hour / 2
        FROM court_prices p
        JOIN courts c ON c.id = p.court_id
        WHERE cs.court_id = c.id
          AND c.type = ?
          AND c.status <> 'DELETED'
          AND cs.schedule_date >= ?
          AND cs.status IN ('AVAILABLE', 'MAINTENANCE')
          AND p.day_type = CASE WHEN EXTRACT(isodow FROM cs.schedule_date) IN (6, 7) THEN 'WEEKEND' ELSE 'WEEKDAY' END
          AND cs.start_time >= p.start_time
          AND cs.start_time < p.end_time
        """,
        cleanZone, effectiveFrom);

    audit.log("CẬP NHẬT BẢNG GIÁ", cleanZone + " từ " + effectiveFrom + ": " + rows.size() + " khung, cập nhật " + updatedSlots + " slot");
    return updatedSlots;
  }
}

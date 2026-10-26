package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.dto.request.CatalogRequest;
import com.courtly.entity.*;
import com.courtly.exception.BusinessException;
import com.courtly.repository.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
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
  public void delete(String collection, UUID id, Account actor) {
    switch (collection) {
      case "accounts" -> deleteAccount(id, actor);
      default -> throw new BusinessException("Danh mục không hỗ trợ xóa");
    }
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
    c.setName(text(r.name(), "Tên sân"));
    c.setType(oneOf(r.type(), "VIP", "INDOOR", "OUTDOOR", "HARD", "CLAY", "GRASS"));
    String status = oneOf(r.status(), "ACTIVE", "MAINTENANCE", "INACTIVE");
    if (!"ACTIVE".equals(status) && id != null) {
      java.time.LocalDate today = java.time.LocalDate.now(ZONE);
      require(
          courtSchedules.findAll().stream()
              .filter(x -> x.getCourt().getId().equals(id))
              .filter(x -> !x.getScheduleDate().isBefore(today))
              .noneMatch(x -> !"AVAILABLE".equals(x.getStatus())),
          "Sân đang có lịch đặt sắp tới. Hủy hoặc đổi lịch trước khi chuyển trạng thái.");
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
    return courts.save(c).getId();
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
    a.setPhone(r.phone() == null ? "" : r.phone());
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
    s.setPhone(r.phone() == null ? "" : r.phone());
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
}

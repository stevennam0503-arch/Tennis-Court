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
  private final DrinkRepository drinks;
  private final RentalItemRepository rentals;
  private final OrderProductRepository products;
  private final StaffRepository staff;
  private final StaffScheduleRepository staffSchedules;
  private final TournamentRepository tournaments;
  private final TournamentRegistrationRepository registrations;
  private final TournamentMatchRepository matches;
  private final TournamentService tournamentService;
  private final AuditService audit;
  private final RentalAvailabilityService availability;

  @Transactional
  public UUID save(String collection, UUID id, CatalogRequest r) {
    UUID result =
        switch (collection) {
          case "courts" -> court(id, r);
          case "prices" -> price(id, r);
          case "accounts" -> account(id, r);
          case "drinks" -> drink(id, r);
          case "rentals" -> rental(id, r);
          case "staff" -> staff(id, r);
          case "staff-schedules" -> staffSchedule(id, r);
          case "tournaments" -> tournament(id, r);
          default -> throw new BusinessException("Danh mục không được hỗ trợ");
        };
    audit.log("LƯU " + collection.toUpperCase(), result.toString());
    return result;
  }

  private UUID court(UUID id, CatalogRequest r) {
    Court c =
        id == null
            ? new Court()
            : courts
                .findForUpdate(id)
                .orElseThrow(() -> new BusinessException("Sân không tồn tại"));
    c.setName(text(r.name(), "Tên sân"));
    c.setType(oneOf(r.type(), "HARD", "CLAY", "GRASS"));
    String status = oneOf(r.status(), "ACTIVE", "MAINTENANCE", "INACTIVE");
    if (!"ACTIVE".equals(status) && id != null)
      require(
          courtSchedules.findAll().stream()
              .noneMatch(
                  x -> x.getCourt().getId().equals(id) && !"AVAILABLE".equals(x.getStatus())),
          "Sân đang có lịch. Hủy hoặc đổi lịch trước");
    c.setStatus(status);
    c.setBasePrice(positive(r.price()));
    c.setDescription(r.description());
    c.setAddress(r.address());
    c.setAmenities(r.amenities());
    if (r.imageUrl() != null && !r.imageUrl().isBlank()) {
      var url = java.net.URI.create(r.imageUrl());
      require(
          ("https".equals(url.getScheme()) && url.getHost() != null && url.getUserInfo() == null)
              || r.imageUrl().matches("/images/[a-zA-Z0-9_-]+\\.(webp|png|jpg|jpeg)"),
          "URL ảnh phải dùng HTTPS hoặc /images/");
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

  private UUID drink(UUID id, CatalogRequest r) {
    Drink d =
        id == null
            ? new Drink()
            : drinks
                .findForUpdate(id)
                .orElseThrow(() -> new BusinessException("Đồ uống không tồn tại"));
    d.setName(text(r.name(), "Tên sản phẩm"));
    d.setUnitPrice(positive(r.price()));
    require(r.stock() != null && r.stock() >= 0, "Tồn kho không hợp lệ");
    d.setStockQuantity(r.stock());
    d.setStatus(oneOf(r.status(), "ACTIVE", "INACTIVE"));
    return drinks.save(d).getId();
  }

  private UUID rental(UUID id, CatalogRequest r) {
    RentalItem d =
        id == null
            ? new RentalItem()
            : rentals
                .findForUpdate(id)
                .orElseThrow(() -> new BusinessException("Đồ thuê không tồn tại"));
    d.setName(text(r.name(), "Tên đồ thuê"));
    d.setPricePerHour(positive(r.price()));
    require(r.stock() != null && r.stock() >= 0, "Tồn kho không hợp lệ");
    if (id != null) {
      var current =
          products.findAll().stream()
              .filter(
                  x ->
                      x.getRentalItem() != null
                          && x.getRentalItem().getId().equals(id)
                          && x.getReturnedAt() == null
                          && active(x.getOrder().getStatus()))
              .toList();
      for (var p : current)
        require(
            availability.peak(id, p.getRentStartAt(), p.getRentEndAt(), null) <= r.stock(),
            "Tồn mới ít hơn số thiết bị đã được đặt thuê đồng thời");
    }
    d.setStockQuantity(r.stock());
    d.setStatus(oneOf(r.status(), "ACTIVE", "INACTIVE"));
    return rentals.save(d).getId();
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

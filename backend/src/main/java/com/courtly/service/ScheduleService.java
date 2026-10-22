package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.entity.*;
import com.courtly.exception.BusinessException;
import com.courtly.repository.*;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ScheduleService {
  private final CourtRepository courts;
  private final CourtPriceRepository prices;
  private final CourtScheduleRepository schedules;
  private final StaffScheduleRepository staffSchedules;

  @Transactional
  public void generate(LocalDate date) {
    require(date != null, "Chọn ngày");
    String dayType = date.getDayOfWeek().getValue() >= 6 ? "WEEKEND" : "WEEKDAY";
    for (Court item :
        courts.findAll().stream().sorted(Comparator.comparing(Court::getId)).toList()) {
      Court court = courts.findForUpdate(item.getId()).orElseThrow();
      var existing = schedules.findByCourtIdAndScheduleDate(court.getId(), date);
      var tariff = prices.findByCourtId(court.getId());
      for (int minute = 360; minute < 1380; minute += 30) {
        LocalTime start = LocalTime.of(minute / 60, minute % 60);
        if (existing.stream().anyMatch(x -> !start.isBefore(x.getStartTime()) && start.isBefore(x.getEndTime()))) continue;
        CourtSchedule schedule = new CourtSchedule();
        schedule.setCourt(court);
        schedule.setScheduleDate(date);
        schedule.setStartTime(start);
        schedule.setEndTime(start.plusMinutes(30));
        schedule.setPrice(
            tariff.stream()
                .filter(
                    p ->
                        p.getDayType().equals(dayType)
                            && !start.isBefore(p.getStartTime())
                            && start.isBefore(p.getEndTime()))
                .findFirst()
                .map(CourtPrice::getPricePerHour)
                .orElse(court.getBasePrice()).divide(java.math.BigDecimal.valueOf(2)));
        schedules.save(schedule);
      }
    }
  }

  public List<CourtSchedule> lockSlots(List<UUID> ids) {
    require(ids != null && !ids.isEmpty() && ids.size() <= 48, "Chọn ít nhất một khung giờ");
    require(new HashSet<>(ids).size() == ids.size(), "Khung giờ bị lặp");
    List<CourtSchedule> result =
        ids.stream()
            .sorted()
            .map(
                id ->
                    schedules
                        .findForUpdate(id)
                        .orElseThrow(() -> new BusinessException("Không tìm thấy khung giờ")))
            .toList();
    require(
        result.stream().map(CourtSchedule::getScheduleDate).distinct().count() == 1,
        "Các slot cần cùng ngày");
    return result;
  }

  public void requireAvailable(List<CourtSchedule> slots) {
    for (CourtSchedule slot : slots) {
      require("ACTIVE".equals(slot.getCourt().getStatus()), "Sân không hoạt động");
      require("AVAILABLE".equals(slot.getStatus()), "Khung giờ vừa được đặt hoặc đang thi đấu");
    }
  }

  public List<StaffSchedule> lockStaffSlots(UUID staffId, List<CourtSchedule> courtSlots) {
    Set<LocalTime> starts = new HashSet<>();
    courtSlots.forEach(x -> starts.add(x.getStartTime()));
    List<StaffSchedule> options =
        staffSchedules.findByStaffIdAndWorkDate(staffId, courtSlots.get(0).getScheduleDate());
    List<UUID> ids = new ArrayList<>();
    for (LocalTime start : starts) {
      var slot =
          options.stream()
              .filter(
                  x -> x.getStartTime().equals(start) && courtSlots.stream().anyMatch(c -> c.getStartTime().equals(start) && c.getEndTime().equals(x.getEndTime())))
              .findFirst()
              .orElseThrow(() -> new BusinessException("Nhân sự chưa có lịch làm việc phù hợp"));
      ids.add(slot.getId());
    }
    List<StaffSchedule> result =
        ids.stream().sorted().map(id -> staffSchedules.findForUpdate(id).orElseThrow()).toList();
    for (var slot : result) {
      require("ACTIVE".equals(slot.getStaff().getStatus()), "Nhân sự không hoạt động");
      require("AVAILABLE".equals(slot.getStatus()), "Nhân sự đã được phân công trong giờ này");
    }
    return result;
  }
}

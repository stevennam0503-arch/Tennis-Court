package com.courtly.service;

import com.courtly.entity.*;
import com.courtly.repository.*;
import com.courtly.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;
import static com.courtly.util.Rules.*;

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
        for (Court item : courts.findAll().stream().sorted(Comparator.comparing(Court::getId)).toList()) {
            Court court = courts.findForUpdate(item.getId()).orElseThrow();
            var existing = schedules.findByCourtIdAndScheduleDate(court.getId(), date);
            var tariff = prices.findByCourtId(court.getId());
            for (int hour = 6; hour < 23; hour++) {
                LocalTime start = LocalTime.of(hour, 0);
                if (existing.stream().anyMatch(x -> x.getStartTime().equals(start))) continue;
                CourtSchedule schedule = new CourtSchedule();
                schedule.setCourt(court);
                schedule.setScheduleDate(date);
                schedule.setStartTime(start);
                schedule.setEndTime(start.plusHours(1));
                schedule.setPrice(tariff.stream().filter(p -> p.getDayType().equals(dayType)
                        && !start.isBefore(p.getStartTime()) && start.isBefore(p.getEndTime()))
                        .findFirst().map(CourtPrice::getPricePerHour).orElse(court.getBasePrice()));
                schedules.save(schedule);
            }
        }
    }

    public List<CourtSchedule> lockSlots(List<UUID> ids) {
        require(ids != null && !ids.isEmpty() && ids.size() <= 48, "Chọn ít nhất một khung giờ");
        require(new HashSet<>(ids).size() == ids.size(), "Khung giờ bị lặp");
        List<CourtSchedule> result = ids.stream().sorted().map(id -> schedules.findForUpdate(id)
                .orElseThrow(() -> new BusinessException("Không tìm thấy khung giờ"))).toList();
        require(result.stream().map(CourtSchedule::getScheduleDate).distinct().count() == 1, "Các slot cần cùng ngày");
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
        List<StaffSchedule> options = staffSchedules.findByStaffIdAndWorkDate(staffId, courtSlots.get(0).getScheduleDate());
        List<UUID> ids = new ArrayList<>();
        for (LocalTime start : starts) {
            var slot = options.stream().filter(x -> x.getStartTime().equals(start) && x.getEndTime().equals(start.plusHours(1)))
                    .findFirst().orElseThrow(() -> new BusinessException("Nhân sự chưa có lịch làm việc phù hợp"));
            ids.add(slot.getId());
        }
        List<StaffSchedule> result = ids.stream().sorted().map(id -> staffSchedules.findForUpdate(id).orElseThrow()).toList();
        for (var slot : result) {
            require("ACTIVE".equals(slot.getStaff().getStatus()), "Nhân sự không hoạt động");
            require("AVAILABLE".equals(slot.getStatus()), "Nhân sự đã được phân công trong giờ này");
        }
        return result;
    }
}

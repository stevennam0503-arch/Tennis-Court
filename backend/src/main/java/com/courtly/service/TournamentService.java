package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.dto.request.*;
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
public class TournamentService {
  private final TournamentRepository tournaments;
  private final TournamentRegistrationRepository registrations;
  private final TeamMemberRepository members;
  private final AccountRepository accounts;
  private final TournamentMatchRepository matches;
  private final MatchSlotRepository matchSlots;
  private final MatchStaffRepository matchStaff;
  private final CourtScheduleRepository schedules;
  private final StaffScheduleRepository staffSchedules;
  private final ScheduleService scheduling;
  private final AuditService audit;

  @Transactional
  public UUID register(UUID id, RegistrationRequest request) {
    Tournament t =
        tournaments
            .findForUpdate(id)
            .orElseThrow(() -> new BusinessException("Giải không tồn tại"));
    require(
        "OPEN".equals(t.getStatus()) && !LocalDate.now(ZONE).isAfter(t.getRegistrationDeadline()),
        "Giải đã đóng đăng ký");
    var current = registrations.findByTournamentId(id);
    require(current.size() < t.getMaxParticipants(), "Giải đã đủ người");
    require(
        current.stream().noneMatch(x -> x.getAccount() != null && x.getAccount().getId().equals(request.accountId())),
        "Tài khoản đã đăng ký giải");
    Account account =
        accounts
            .findById(request.accountId())
            .orElseThrow(() -> new BusinessException("Tài khoản không tồn tại"));
    require("ACTIVE".equals(account.getStatus()), "Tài khoản đã khóa");
    List<String> extra = request.members() == null ? List.of() : request.members();
    require(!"SINGLES".equals(t.getFormat()) || extra.isEmpty(), "Giải đơn chỉ có một người");
    require(!"DOUBLES".equals(t.getFormat()) || extra.size() == 1, "Giải đôi cần một đồng đội");
    require(!"TEAM".equals(t.getFormat()) || !extra.isEmpty(), "Thêm thành viên cho đội");
    TournamentRegistration registration = new TournamentRegistration();
    registration.setTournament(t);
    registration.setAccount(account);
    registration.setTeamName(text(request.name(), "Tên thi đấu"));
    registration.setStatus(t.getRegistrationFee().signum() == 0 ? "CONFIRMED" : "PENDING");
    registrations.save(registration);
    TeamMember leader = new TeamMember();
    leader.setTournament(t);
    leader.setRegistration(registration);
    leader.setAccount(account);
    leader.setMemberName(account.getFullName());
    members.save(leader);
    for (String name : extra) {
      TeamMember member = new TeamMember();
      member.setTournament(t);
      member.setRegistration(registration);
      member.setMemberName(text(name, "Thành viên"));
      members.save(member);
    }
    audit.log("ĐĂNG KÝ GIẢI", registration.getId().toString());
    return registration.getId();
  }

  @Transactional
  public void draw(UUID id) {
    Tournament t =
        tournaments
            .findForUpdate(id)
            .orElseThrow(() -> new BusinessException("Giải không tồn tại"));
    require(!Set.of("FINISHED", "CANCELLED").contains(t.getStatus()), "Giải đã kết thúc");
    require(matches.findByTournamentId(id).isEmpty(), "Giải đã có nhánh đấu");
    List<TournamentRegistration> confirmed =
        new ArrayList<>(
            registrations.findByTournamentId(id).stream()
                .filter(x -> "CONFIRMED".equals(x.getStatus()))
                .toList());
    int count = confirmed.size();
    require(count >= 2 && (count & (count - 1)) == 0, "Cần 2, 4, 8, 16… đăng ký đã xác nhận");
    Collections.shuffle(confirmed);
    for (int round = 1, games = count / 2; games > 0; round++, games /= 2) {
      for (int i = 0; i < games; i++) {
        TournamentMatch match = new TournamentMatch();
        match.setTournament(t);
        match.setRoundNumber(round);
        match.setBracketIndex(i);
        match.setRoundName(games == 1 ? "Chung kết" : games == 2 ? "Bán kết" : games == 4 ? "Tứ kết" : "Vòng " + round);
        if (round == 1) {
          match.setRegistration1(confirmed.get(i * 2));
          match.setRegistration2(confirmed.get(i * 2 + 1));
        }
        matches.save(match);
      }
    }
    t.setStatus("CLOSED");
    audit.log("BỐC THĂM", id.toString());
  }

  @Transactional
  public void resetDraw(UUID id) {
    Tournament t =
        tournaments
            .findForUpdate(id)
            .orElseThrow(() -> new BusinessException("Giải không tồn tại"));
    List<TournamentMatch> allMatches = matches.findByTournamentId(id);
    require(!allMatches.isEmpty(), "Giải chưa có nhánh đấu");
    for (TournamentMatch m : allMatches) {
      release(m);
      matchSlots.deleteAll(matchSlots.findByMatchId(m.getId()));
      matchStaff.deleteAll(matchStaff.findByMatchId(m.getId()));
      matches.delete(m);
    }
    t.setStatus("OPEN");
    audit.log("HỦY NHÁNH ĐẤU", id.toString());
  }

  public void release(TournamentMatch match) {
    Instant releasedAt = Instant.now();
    for (MatchSlot link :
        matchSlots.findByMatchId(match.getId()).stream()
            .sorted(Comparator.comparing(x -> x.getSchedule().getId()))
            .toList()) {
      if (link.getReleasedAt() != null) continue;
      schedules.findForUpdate(link.getSchedule().getId()).orElseThrow().setStatus("AVAILABLE");
      link.setReleasedAt(releasedAt);
    }
    for (MatchStaff link :
        matchStaff.findByMatchId(match.getId()).stream()
            .sorted(Comparator.comparing(x -> x.getStaffSchedule().getId()))
            .toList()) {
      if (link.getReleasedAt() != null) continue;
      staffSchedules
          .findForUpdate(link.getStaffSchedule().getId())
          .orElseThrow()
          .setStatus("AVAILABLE");
      link.setReleasedAt(releasedAt);
    }
  }

  private TournamentMatch lock(UUID id) {
    TournamentMatch candidate =
        matches.findById(id).orElseThrow(() -> new BusinessException("Trận không tồn tại"));
    // Serialize bracket updates on the tournament before locking a match.
    tournaments.findForUpdate(candidate.getTournament().getId()).orElseThrow();
    return matches.findForUpdate(id).orElseThrow();
  }

  @Transactional
  public void schedule(UUID id, MatchScheduleRequest request) {
    TournamentMatch match = lock(id);
    require("SCHEDULED".equals(match.getStatus()), "Trận đã kết thúc hoặc hủy");
    require(
        match.getRegistration1() != null && match.getRegistration2() != null,
        "Chờ kết quả vòng trước");
    require(
        "CONFIRMED".equals(match.getRegistration1().getStatus())
            && "CONFIRMED".equals(match.getRegistration2().getStatus()),
        "Hai bên phải được xác nhận");
    List<UUID> all = new ArrayList<>(request.scheduleIds());
    matchSlots.findByMatchId(id).stream()
        .filter(x -> x.getReleasedAt() == null)
        .forEach(x -> all.add(x.getSchedule().getId()));
    all.stream().distinct().sorted().forEach(x -> schedules.findForUpdate(x).orElseThrow());
    release(match);
    matchSlots.flush();
    matchStaff.flush();
    List<CourtSchedule> selected = scheduling.lockSlots(request.scheduleIds());
    scheduling.requireAvailable(selected);
    require(
        selected.stream().map(x -> x.getCourt().getId()).distinct().count() == 1,
        "Một trận chỉ dùng một sân");
    List<CourtSchedule> chronological =
        selected.stream().sorted(Comparator.comparing(CourtSchedule::getStartTime)).toList();
    for (int i = 1; i < chronological.size(); i++)
      require(
          chronological.get(i - 1).getEndTime().equals(chronological.get(i).getStartTime()),
          "Slot của trận phải liên tiếp");
    LocalDate date = selected.get(0).getScheduleDate();
    require(
        !date.isBefore(match.getTournament().getStartDate())
            && !date.isAfter(match.getTournament().getEndDate()),
        "Ngày trận phải nằm trong thời gian giải");
    for (CourtSchedule slot : selected) {
      slot.setStatus("IN_MATCH");
      MatchSlot link = new MatchSlot();
      link.setMatch(match);
      link.setSchedule(slot);
      matchSlots.save(link);
    }
    if (request.staffId() != null) {
      var staff = scheduling.lockStaffSlots(request.staffId(), selected);
      for (StaffSchedule slot : staff) {
        require("REFEREE".equals(slot.getStaff().getType()), "Chọn nhân sự trọng tài");
        slot.setStatus("IN_MATCH");
        MatchStaff link = new MatchStaff();
        link.setMatch(match);
        link.setStaffSchedule(slot);
        matchStaff.save(link);
      }
    }
    audit.log("XẾP TRẬN", id.toString());
  }

  @Transactional
  public void result(UUID id, MatchResultRequest request) {
    TournamentMatch match = lock(id);
    require(!"CANCELLED".equals(match.getStatus()), "Trận đã hủy");
    require(
        match.getRegistration1() != null && match.getRegistration2() != null,
        "Chưa đủ người thi đấu");
    require(
        Set.of(match.getRegistration1().getId(), match.getRegistration2().getId())
            .contains(request.winnerId()),
        "Đội thắng phải thuộc trận");
    TournamentRegistration prevWinner = match.getWinnerRegistration();
    TournamentRegistration newWinner =
        request.winnerId().equals(match.getRegistration1().getId())
            ? match.getRegistration1()
            : match.getRegistration2();
    String score = (request.score() == null || request.score().isBlank()) ? "Thắng" : request.score().trim();
    match.setWinnerRegistration(newWinner);
    match.setScore(score);
    match.setStatus("FINISHED");
    release(match);
    var next =
        matches.findByTournamentId(match.getTournament().getId()).stream()
            .filter(
                x ->
                    x.getRoundNumber() == match.getRoundNumber() + 1
                        && x.getBracketIndex() == match.getBracketIndex() / 2)
            .findFirst();
    if (next.isPresent()) {
      if (match.getBracketIndex() % 2 == 0)
        next.get().setRegistration1(newWinner);
      else next.get().setRegistration2(newWinner);
      if (prevWinner != null && !prevWinner.getId().equals(newWinner.getId())
          && prevWinner.equals(next.get().getWinnerRegistration())) {
        next.get().setWinnerRegistration(null);
        next.get().setStatus("SCHEDULED");
        next.get().setScore(null);
      }
    } else {
      match.getTournament().setStatus("FINISHED");
    }
    audit.log("KẾT QUẢ TRẬN", id.toString());
  }
}

package com.courtly.config;

import static com.courtly.util.Rules.ZONE;

import com.courtly.entity.*;
import com.courtly.repository.*;
import com.courtly.service.SettingsService;
import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class DemoDataInitializer implements ApplicationRunner {
  private final CourtRepository courts;
  private final AccountRepository accounts;
  private final StaffRepository staff;
  private final DrinkRepository drinks;
  private final RentalItemRepository rentals;
  private final TournamentRepository tournaments;
  private final SettingsService settings;
  private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

  @Value("${courtly.admin-email}")
  private String adminEmail;

  @Value("${courtly.admin-password:}")
  private String adminPassword;

  @Value("${courtly.seed-demo}")
  private boolean enabled;

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    settings.get();
    if (!adminPassword.isBlank() && accounts.findByEmailIgnoreCase(adminEmail).isEmpty()) {
      com.courtly.util.Rules.require(
          adminPassword.length() >= 12
              && adminPassword.getBytes(java.nio.charset.StandardCharsets.UTF_8).length <= 72,
          "ADMIN_PASSWORD cần ít nhất 12 ký tự, tối đa 72 byte");
      Account admin = new Account();
      admin.setFullName("Quản trị Courtly");
      admin.setEmail(adminEmail.toLowerCase());
      admin.setPhone("");
      admin.setRole("ADMIN");
      admin.setPasswordHash(passwordEncoder.encode(adminPassword));
      accounts.save(admin);
    }
    if (!enabled || courts.count() > 0) return;
    for (int i = 1; i <= 10; i++) {
      Court c = new Court();
      String zone = i <= 4 ? "A" : i <= 8 ? "B" : "V";
      int number = i <= 4 ? i : i <= 8 ? i - 4 : i - 8;
      c.setName(zone + "0" + number);
      c.setType("HARD");
      c.setStatus("ACTIVE");
      c.setBasePrice(BigDecimal.valueOf(i <= 4 ? 200000 : i <= 8 ? 300000 : 500000));
      c.setImageUrl("/guest/zone-" + zone.toLowerCase(java.util.Locale.ROOT)
          + (i <= 4 ? "-outdoor.webp" : i <= 8 ? "-indoor.webp" : "-lounge.webp"));
      courts.save(c);
    }
    String[] names = {"Nguyễn Minh Anh", "Trần Hoàng Nam", "Lê Thu Hà"};
    for (int i = 0; i < names.length; i++) {
      Account a = new Account();
      a.setFullName(names[i]);
      a.setEmail("demo" + (i + 1) + "@example.com");
      a.setPhone("090000000" + i);
      a.setRole("CUSTOMER");
      accounts.save(a);
    }
    String[] people = {"Phạm Quốc Huy", "Vũ Thanh Bình", "Ngô Đức Long"};
    String[] types = {"REFEREE", "COACH", "BALL_BOY"};
    for (int i = 0; i < people.length; i++) {
      Staff s = new Staff();
      s.setFullName(people[i]);
      s.setType(types[i]);
      s.setPhone("091000000" + i);
      s.setHourlyRate(BigDecimal.valueOf(i == 1 ? 250000 : i == 0 ? 120000 : 60000));
      staff.save(s);
    }
    Drink water = new Drink();
    water.setName("Nước suối 500ml");
    water.setUnitPrice(BigDecimal.valueOf(15000));
    water.setStockQuantity(48);
    drinks.save(water);
    Drink isotonic = new Drink();
    isotonic.setName("Nước điện giải");
    isotonic.setUnitPrice(BigDecimal.valueOf(25000));
    isotonic.setStockQuantity(6);
    drinks.save(isotonic);
    RentalItem racket = new RentalItem();
    racket.setName("Vợt Wilson");
    racket.setPricePerHour(BigDecimal.valueOf(50000));
    racket.setStockQuantity(8);
    rentals.save(racket);
    RentalItem ball = new RentalItem();
    ball.setName("Bóng tennis (bộ 3)");
    ball.setCategory("BALL");
    ball.setPricePerHour(BigDecimal.valueOf(30000));
    ball.setStockQuantity(12);
    rentals.save(ball);
    Tournament t = new Tournament();
    t.setName("Courtly Open");
    t.setLocation("CLB Courtly");
    t.setStatus("OPEN");
    t.setStartDate(LocalDate.now(ZONE).plusDays(7));
    t.setEndDate(t.getStartDate().plusDays(2));
    t.setRegistrationDeadline(t.getStartDate());
    t.setRegistrationFee(BigDecimal.valueOf(300000));
    t.setMaxParticipants(16);
    tournaments.save(t);
  }
}

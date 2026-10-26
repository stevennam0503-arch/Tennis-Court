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
    
    // 1. Khởi tạo tài khoản ADMIN nếu chưa tồn tại
    var adminOpt = accounts.findByEmailIgnoreCase(adminEmail);
    if (adminOpt.isEmpty()) {
      Account admin = new Account();
      admin.setFullName("Quản trị Courtly");
      admin.setEmail(adminEmail.toLowerCase());
      admin.setPhone("");
      admin.setRole("ADMIN");
      String initialPass = (!adminPassword.isBlank()) ? adminPassword : "12345";
      admin.setPasswordHash(passwordEncoder.encode(initialPass));
      accounts.save(admin);
    } else {
      Account admin = adminOpt.get();
      if (!"ADMIN".equals(admin.getRole())) {
        admin.setRole("ADMIN");
        accounts.save(admin);
      }
      // Chỉ khởi tạo mật khẩu nếu tài khoản chưa từng có mật khẩu
      if (admin.getPasswordHash() == null || admin.getPasswordHash().isBlank()) {
        String initialPass = (!adminPassword.isBlank()) ? adminPassword : "12345";
        admin.setPasswordHash(passwordEncoder.encode(initialPass));
        accounts.save(admin);
      }
    }

    // 2. Khởi tạo tài khoản STAFF mẫu nếu chưa tồn tại
    var staffOpt = accounts.findByEmailIgnoreCase("staff@gmail.com");
    if (staffOpt.isEmpty()) {
      Account staffAcc = new Account();
      staffAcc.setFullName("Nhân viên Staff");
      staffAcc.setEmail("staff@gmail.com");
      staffAcc.setPhone("0987654321");
      staffAcc.setRole("STAFF");
      staffAcc.setPasswordHash(passwordEncoder.encode("12345"));
      accounts.save(staffAcc);
    } else {
      Account staffAcc = staffOpt.get();
      if (!"STAFF".equals(staffAcc.getRole())) {
        staffAcc.setRole("STAFF");
        accounts.save(staffAcc);
      }
      // Chỉ khởi tạo mật khẩu nếu tài khoản chưa từng có mật khẩu
      if (staffAcc.getPasswordHash() == null || staffAcc.getPasswordHash().isBlank()) {
        staffAcc.setPasswordHash(passwordEncoder.encode("12345"));
        accounts.save(staffAcc);
      }
    }

    // 3. Đảm bảo duy nhất tài khoản chủ sân (adminEmail) mang quyền ADMIN, tất cả tài khoản vận hành khác chuyển về STAFF
    for (Account a : accounts.findAll()) {
      if ("ADMIN".equals(a.getRole()) && !adminEmail.equalsIgnoreCase(a.getEmail())) {
        a.setRole("STAFF");
        accounts.save(a);
      }
    }

    // 4. Khởi tạo mật khẩu mặc định 12345 cho tài khoản ADMIN/STAFF NẾU VÀ CHỈ NẾU chưa có mật khẩu
    // TUYỆT ĐỐI KHÔNG ghi đè mật khẩu của tài khoản đã có mật khẩu (khi người dùng đã đổi mật khẩu, bắt buộc giữ nguyên mật khẩu mới)
    String defaultPassHash = passwordEncoder.encode("12345");
    for (Account a : accounts.findAll()) {
      if (java.util.Set.of("ADMIN", "STAFF").contains(a.getRole())) {
        if (a.getPasswordHash() == null || a.getPasswordHash().isBlank()) {
          a.setPasswordHash(defaultPassHash);
          accounts.save(a);
        }
      }
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
    String[] types = {"REFEREE", "REFEREE", "REFEREE"};
    for (int i = 0; i < people.length; i++) {
      Staff s = new Staff();
      s.setFullName(people[i]);
      s.setType(types[i]);
      s.setPhone("091000000" + i);
      s.setHourlyRate(BigDecimal.valueOf(i == 1 ? 250000 : i == 0 ? 120000 : 60000));
      staff.save(s);
    }
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

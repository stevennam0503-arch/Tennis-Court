package com.courtly.config;

import static com.courtly.util.Rules.ZONE;

import com.courtly.entity.*;
import com.courtly.repository.*;
import com.courtly.service.SettingsService;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
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

    // 1. Tài khoản ADMIN
    if (adminPassword.isBlank()) {
      log.warn("ADMIN_PASSWORD chưa được cấu hình cho tài khoản: {}", adminEmail);
      // Chỉ trong môi trường demo/dev (enabled == true) và khi tài khoản admin chưa tồn tại:
      // cấp tài khoản admin mặc định với mật khẩu 12345 để phục vụ kiểm thử và phát triển local
      if (enabled && accounts.findByEmailIgnoreCase(adminEmail).isEmpty()) {
        Account admin = new Account();
        admin.setFullName("Quản trị Courtly");
        admin.setEmail(adminEmail.toLowerCase(java.util.Locale.ROOT));
        admin.setPhone("");
        admin.setRole("ADMIN");
        admin.setPasswordHash(passwordEncoder.encode("12345"));
        accounts.save(admin);
      }
    } else {
      // Khi CÓ cấu hình ADMIN_PASSWORD: bắt buộc kiểm tra độ an toàn (>= 10 ký tự, <= 72 byte chuẩn BCrypt)
      com.courtly.util.Rules.require(
          adminPassword.length() >= 10
              && adminPassword.getBytes(StandardCharsets.UTF_8).length <= 72,
          "ADMIN_PASSWORD cần ít nhất 10 ký tự, tối đa 72 byte UTF-8");
      var adminOpt = accounts.findByEmailIgnoreCase(adminEmail);
      if (adminOpt.isEmpty()) {
        Account admin = new Account();
        admin.setFullName("Quản trị Courtly");
        admin.setEmail(adminEmail.toLowerCase(java.util.Locale.ROOT));
        admin.setPhone("");
        admin.setRole("ADMIN");
        admin.setPasswordHash(passwordEncoder.encode(adminPassword));
        accounts.save(admin);
      } else {
        Account admin = adminOpt.get();
        if (!"ADMIN".equals(admin.getRole())) {
          log.warn(
              "Tài khoản {} đã tồn tại với vai trò '{}' (không phải ADMIN). Bỏ qua khởi tạo để tránh nâng quyền trái phép.",
              adminEmail,
              admin.getRole());
        } else {
          // Chỉ khởi tạo mật khẩu nếu admin chưa từng có mật khẩu (tuyệt đối không ghi đè nếu đã đổi)
          if (admin.getPasswordHash() == null || admin.getPasswordHash().isBlank()) {
            admin.setPasswordHash(passwordEncoder.encode(adminPassword));
            accounts.save(admin);
          }
        }
      }
    }

    // 2. Phân định quyền duy nhất: CHỈ hạ quyền các tài khoản ADMIN khác NẾU VÀ CHỈ NẾU
    // tài khoản chủ sân (adminEmail) thực sự tồn tại và đang mang quyền ADMIN!
    // Tránh tình trạng: cấu hình sai hoặc thiếu ADMIN_PASSWORD dẫn đến hạ quyền admin cũ làm mất sạch admin.
    accounts.findByEmailIgnoreCase(adminEmail).ifPresent(adminAcc -> {
      if ("ADMIN".equals(adminAcc.getRole())) {
        for (Account a : accounts.findAll()) {
          if ("ADMIN".equals(a.getRole()) && !adminEmail.equalsIgnoreCase(a.getEmail())) {
            a.setRole("STAFF");
            accounts.save(a);
          }
        }
      }
    });

    // 3. BẢO VỆ MÔI TRƯỜNG THỰC: Toàn bộ dữ liệu mẫu (staff mẫu, sân mẫu, tài khoản demo...) PHẢI NẰM SAU DÒNG NÀY!
    // Khi SEED_DEMO=false, hàm kết thúc ngay tại đây -> Không tạo staff@gmail.com, không seed sân hay demo users!
    if (!enabled) return;

    // 4. Khởi tạo tài khoản STAFF mẫu (chỉ chạy khi enabled == true)
    // TUYỆT ĐỐI KHÔNG tự động nâng quyền tài khoản đã tồn tại (tránh nâng quyền nhầm nếu khách hàng đã đăng ký với email này)
    var staffOpt = accounts.findByEmailIgnoreCase("staff@gmail.com");
    if (staffOpt.isEmpty()) {
      Account staffAcc = new Account();
      staffAcc.setFullName("Nhân viên Staff");
      staffAcc.setEmail("staff@gmail.com");
      staffAcc.setPhone("0987654321");
      staffAcc.setRole("STAFF");
      staffAcc.setPasswordHash(passwordEncoder.encode("12345"));
      accounts.save(staffAcc);
    }

    // 5. Kiểm tra nếu đã có dữ liệu sân thì không seed lại
    if (courts.count() > 0) return;

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


package com.courtly.config;

import com.courtly.entity.*;
import com.courtly.repository.*;
import com.courtly.service.SettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDate;
import static com.courtly.util.Rules.ZONE;

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
    @Value("${courtly.seed-demo}") private boolean enabled;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        settings.get();
        if (!enabled || courts.count() > 0) return;
        for (int i = 1; i <= 4; i++) {
            Court c = new Court();
            c.setName("Sân 0" + i);
            c.setType(i == 3 ? "CLAY" : i == 4 ? "GRASS" : "HARD");
            c.setStatus(i == 4 ? "MAINTENANCE" : "ACTIVE");
            c.setBasePrice(BigDecimal.valueOf(i >= 3 ? 220000 : 180000));
            courts.save(c);
        }
        String[] names = {"Nguyễn Minh Anh", "Trần Hoàng Nam", "Lê Thu Hà"};
        for (int i = 0; i < names.length; i++) {
            Account a = new Account();
            a.setFullName(names[i]); a.setEmail("demo"+(i+1)+"@example.com");
            a.setPhone("090000000"+i); a.setRole(i==2?"STAFF":"CUSTOMER");
            accounts.save(a);
        }
        String[] people = {"Phạm Quốc Huy", "Vũ Thanh Bình", "Ngô Đức Long"};
        String[] types = {"REFEREE", "COACH", "BALL_BOY"};
        for (int i = 0; i < people.length; i++) {
            Staff s = new Staff(); s.setFullName(people[i]); s.setType(types[i]);
            s.setPhone("091000000"+i); s.setHourlyRate(BigDecimal.valueOf(i==1?250000:i==0?120000:60000));
            staff.save(s);
        }
        Drink water = new Drink(); water.setName("Nước suối 500ml"); water.setUnitPrice(BigDecimal.valueOf(15000)); water.setStockQuantity(48); drinks.save(water);
        Drink isotonic = new Drink(); isotonic.setName("Nước điện giải"); isotonic.setUnitPrice(BigDecimal.valueOf(25000)); isotonic.setStockQuantity(6); drinks.save(isotonic);
        RentalItem racket = new RentalItem(); racket.setName("Vợt Wilson"); racket.setPricePerHour(BigDecimal.valueOf(50000)); racket.setStockQuantity(8); rentals.save(racket);
        RentalItem ball = new RentalItem(); ball.setName("Bóng tennis (bộ 3)"); ball.setCategory("BALL"); ball.setPricePerHour(BigDecimal.valueOf(30000)); ball.setStockQuantity(12); rentals.save(ball);
        Tournament t = new Tournament(); t.setName("Courtly Open"); t.setLocation("CLB Courtly");
        t.setStartDate(LocalDate.now(ZONE).plusDays(7)); t.setEndDate(t.getStartDate().plusDays(2));
        t.setRegistrationDeadline(t.getStartDate()); t.setRegistrationFee(BigDecimal.valueOf(300000)); t.setMaxParticipants(16);
        tournaments.save(t);
    }
}

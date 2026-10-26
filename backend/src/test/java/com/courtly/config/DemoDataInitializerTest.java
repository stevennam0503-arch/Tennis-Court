package com.courtly.config;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.courtly.entity.Account;
import com.courtly.repository.*;
import com.courtly.service.SettingsService;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

class DemoDataInitializerTest {
  private CourtRepository courts;
  private AccountRepository accounts;
  private StaffRepository staff;
  private TournamentRepository tournaments;
  private SettingsService settings;
  private PasswordEncoder encoder;
  private DemoDataInitializer initializer;

  @BeforeEach
  void setUp() {
    courts = mock(CourtRepository.class);
    accounts = mock(AccountRepository.class);
    staff = mock(StaffRepository.class);
    tournaments = mock(TournamentRepository.class);
    settings = mock(SettingsService.class);
    encoder = new BCryptPasswordEncoder();

    initializer = new DemoDataInitializer(courts, accounts, staff, tournaments, settings, encoder);
    ReflectionTestUtils.setField(initializer, "adminEmail", "admin@gmail.com");
    ReflectionTestUtils.setField(initializer, "adminPassword", "");
    ReflectionTestUtils.setField(initializer, "enabled", false);
  }

  @Test
  void doesNotOverwriteExistingPasswordOnRestart() {
    Account existingAdmin = new Account();
    existingAdmin.setEmail("admin@gmail.com");
    existingAdmin.setRole("ADMIN");
    String changedPasswordHash = encoder.encode("CustomSecretPass2026!");
    existingAdmin.setPasswordHash(changedPasswordHash);

    Account existingStaff = new Account();
    existingStaff.setEmail("staff@gmail.com");
    existingStaff.setRole("STAFF");
    String staffChangedPasswordHash = encoder.encode("StaffChangedPass2026!");
    existingStaff.setPasswordHash(staffChangedPasswordHash);

    when(accounts.findByEmailIgnoreCase("admin@gmail.com")).thenReturn(Optional.of(existingAdmin));
    when(accounts.findByEmailIgnoreCase("staff@gmail.com")).thenReturn(Optional.of(existingStaff));
    when(accounts.findAll()).thenReturn(List.of(existingAdmin, existingStaff));

    initializer.run(new DefaultApplicationArguments());

    // Password hashes must NOT be modified or reset to 12345
    assertEquals(changedPasswordHash, existingAdmin.getPasswordHash());
    assertTrue(encoder.matches("CustomSecretPass2026!", existingAdmin.getPasswordHash()));
    assertFalse(encoder.matches("12345", existingAdmin.getPasswordHash()));

    assertEquals(staffChangedPasswordHash, existingStaff.getPasswordHash());
    assertTrue(encoder.matches("StaffChangedPass2026!", existingStaff.getPasswordHash()));
    assertFalse(encoder.matches("12345", existingStaff.getPasswordHash()));
  }

  @Test
  void initializesPasswordWhenEmpty() {
    Account uninitializedAdmin = new Account();
    uninitializedAdmin.setEmail("admin@gmail.com");
    uninitializedAdmin.setRole("ADMIN");
    uninitializedAdmin.setPasswordHash(null);

    when(accounts.findByEmailIgnoreCase("admin@gmail.com")).thenReturn(Optional.of(uninitializedAdmin));
    when(accounts.findByEmailIgnoreCase("staff@gmail.com")).thenReturn(Optional.empty());
    when(accounts.findAll()).thenReturn(List.of(uninitializedAdmin));

    initializer.run(new DefaultApplicationArguments());

    assertNotNull(uninitializedAdmin.getPasswordHash());
    assertTrue(encoder.matches("12345", uninitializedAdmin.getPasswordHash()));
  }
}

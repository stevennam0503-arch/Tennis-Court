package com.courtly.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

/**
 * Fail-fast security invariant validator for production environments.
 * Prevents the application from starting if insecure default credentials,
 * unencrypted cookies, demo modes, or placeholder secrets are configured.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ProductionSecurityValidator implements ApplicationRunner {

  private final Environment environment;

  @Override
  public void run(ApplicationArguments args) {
    if (!environment.acceptsProfiles(Profiles.of("prod", "production"))) {
      log.debug("Non-production profile active. Skipping strict production security validation.");
      return;
    }

    log.info("Validating production security invariants...");

    String dbPassword = environment.getProperty("spring.datasource.password", "");
    if (dbPassword.isBlank() || "courtly_local".equalsIgnoreCase(dbPassword)) {
      throw new IllegalStateException(
          "FATAL: Insecure default database password ('courtly_local') detected in production profile! "
              + "Please configure a secure DB_PASSWORD via environment variables.");
    }

    boolean cookieSecure = Boolean.parseBoolean(
        environment.getProperty("server.servlet.session.cookie.secure", "false"));
    if (!cookieSecure) {
      throw new IllegalStateException(
          "FATAL: server.servlet.session.cookie.secure must be true in production profile! "
              + "Please set COOKIE_SECURE=true.");
    }

    boolean demoMode = Boolean.parseBoolean(
        environment.getProperty("courtly.demo-mode", "false"));
    if (demoMode) {
      throw new IllegalStateException(
          "FATAL: courtly.demo-mode must be false in production profile! "
              + "Please set DEMO_MODE=false.");
    }

    boolean seedDemo = Boolean.parseBoolean(
        environment.getProperty("courtly.seed-demo", "false"));
    if (seedDemo) {
      throw new IllegalStateException(
          "FATAL: courtly.seed-demo must be false in production profile! "
              + "Please set SEED_DEMO=false.");
    }

    String otpSecret = environment.getProperty("courtly.security.otp-secret", "");
    if (otpSecret.isBlank() || "CourtlySecureHmacSecretKey2026!".equals(otpSecret)) {
      throw new IllegalStateException(
          "FATAL: Insecure default or blank courtly.security.otp-secret detected in production profile! "
              + "Please configure a cryptographically random OTP_SECRET.");
    }

    String adminPassword = environment.getProperty("courtly.admin-password", "");
    if (adminPassword.isBlank() || "12345".equals(adminPassword)) {
      throw new IllegalStateException(
          "FATAL: ADMIN_PASSWORD is missing or set to default '12345' in production profile! "
              + "Please configure a strong ADMIN_PASSWORD.");
    }

    log.info("All production security invariants validated successfully.");
  }
}

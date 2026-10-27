package com.courtly.service;

import lombok.RequiredArgsConstructor;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
@RequiredArgsConstructor
public class DemoAccessPolicy {
  private final Environment environment;

  public boolean enabled() {
    return environment.getProperty("courtly.demo-mode", Boolean.class, false)
        && !environment.acceptsProfiles(Profiles.of("prod", "production"));
  }

  public void requireEnabled() {
    if (!enabled()) throw new ResponseStatusException(HttpStatus.FORBIDDEN,
        "Chức năng này chỉ khả dụng trong môi trường demo riêng");
  }
}

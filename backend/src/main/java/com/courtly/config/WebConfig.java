package com.courtly.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.*;

@Configuration
public class WebConfig implements WebMvcConfigurer {
  @org.springframework.beans.factory.annotation.Autowired private ApiAccessInterceptor access;

  @Override
  public void addInterceptors(InterceptorRegistry registry) {
    registry.addInterceptor(access).addPathPatterns("/api/**");
  }

  @Value("${courtly.allowed-origin}")
  private String allowedOrigin;

  @Override
  public void addCorsMappings(CorsRegistry registry) {
    registry
        .addMapping("/api/**")
        .allowedOrigins(allowedOrigin)
        .allowedMethods("GET", "POST", "PUT", "PATCH", "OPTIONS")
        .allowCredentials(true)
        .allowedHeaders("Content-Type", "Idempotency-Key", "X-CSRF-TOKEN");
  }
}

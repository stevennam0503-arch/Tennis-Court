package com.courtly;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class CourtlyApplication {
  public static void main(String[] args) {
    SpringApplication.run(CourtlyApplication.class, args);
  }
}

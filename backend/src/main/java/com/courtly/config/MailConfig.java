package com.courtly.config;

import java.util.Properties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

@Configuration
public class MailConfig {

  @Value("${courtly.mail.host:}")
  private String host;

  @Value("${courtly.mail.port:587}")
  private int port;

  @Value("${courtly.mail.username:}")
  private String username;

  @Value("${courtly.mail.password:}")
  private String password;

  @Bean
  public JavaMailSender javaMailSender() {
    JavaMailSenderImpl sender = new JavaMailSenderImpl();
    if (host != null && !host.isBlank()) {
      sender.setHost(host);
      sender.setPort(port);
      if (username != null && !username.isBlank()) {
        sender.setUsername(username.trim());
      }
      if (password != null && !password.isBlank()) {
        String cleanPassword = host.contains("gmail") ? password.trim().replace(" ", "") : password.trim();
        sender.setPassword(cleanPassword);
      }
      Properties props = sender.getJavaMailProperties();
      props.put("mail.transport.protocol", "smtp");
      props.put("mail.smtp.auth", "true");
      props.put("mail.smtp.starttls.enable", "true");
      props.put("mail.smtp.starttls.required", "true");
      props.put("mail.smtp.connectiontimeout", "5000");
      props.put("mail.smtp.timeout", "5000");
      props.put("mail.smtp.writetimeout", "5000");
    }
    return sender;
  }
}

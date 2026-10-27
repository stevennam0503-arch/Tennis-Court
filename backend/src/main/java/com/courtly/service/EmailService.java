package com.courtly.service;

import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {
  private final DocumentService documents;
  private final JavaMailSender mailSender;
  private final DemoAccessPolicy demo;

  @Value("${courtly.mail.host:}")
  private String host;

  @Value("${courtly.mail.port:587}")
  private int port;

  @Value("${courtly.mail.username:}")
  private String username;

  @Value("${courtly.mail.password:}")
  private String password;

  @Value("${courtly.mail.from:no-reply@courtly.vn}")
  private String fromAddress;

  @Value("${courtly.mail.from-name:Courtly Tennis Club}")
  private String fromName;

  public boolean isConfigured() {
    return host != null && !host.isBlank() && password != null && !password.isBlank();
  }

  @Async
  public CompletableFuture<Boolean> sendPasswordResetEmail(String toEmail, String fullName, String code) {
    String subject = "[Courtly Tennis Club] Mã xác nhận đặt lại mật khẩu của bạn";
    String plain = String.format("""
        Xin chào %s,

        Bạn vừa gửi yêu cầu đặt lại mật khẩu cho tài khoản Courtly (%s).

        Mã xác nhận OTP của bạn là: %s

        Mã này có hiệu lực trong 15 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.
        Nếu bạn không thực hiện yêu cầu này, xin vui lòng bỏ qua email này.

        Trân trọng,
        CLB Tennis Courtly
        """, fullName != null && !fullName.isBlank() ? fullName : "Quý khách", toEmail, code);

    String html = String.format("""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"/></head>
        <body style="font-family:'Segoe UI',Arial,sans-serif;background-color:#f4f7f5;margin:0;padding:24px;color:#21342e;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%%" style="max-width:540px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dce3df;box-shadow:0 4px 16px rgba(0,0,0,0.05);">
            <tr>
              <td style="background-color:#173c32;padding:28px 32px;text-align:center;">
                <h1 style="color:#ffffff;margin:0;font-size:24px;letter-spacing:1px;">COURTLY <span style="color:#def46a;font-size:14px;display:block;margin-top:4px;">TENNIS CLUB</span></h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 24px;">
                <h2 style="font-size:20px;margin-top:0;color:#173c32;">Yêu cầu đặt lại mật khẩu</h2>
                <p style="font-size:15px;line-height:1.6;color:#52655a;">Xin chào <strong>%s</strong>,</p>
                <p style="font-size:15px;line-height:1.6;color:#52655a;">Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong>%s</strong> trên hệ thống Courtly Tennis Club.</p>
                
                <div style="background:#f0f5e8;border:2px dashed #9bc89a;border-radius:10px;padding:20px;text-align:center;margin:28px 0;">
                  <span style="display:block;font-size:12px;color:#4a6250;letter-spacing:1px;margin-bottom:8px;font-weight:600;text-transform:uppercase;">Mã xác nhận của bạn</span>
                  <span style="font-size:34px;font-weight:700;color:#173c32;letter-spacing:8px;font-family:monospace;">%s</span>
                  <span style="display:block;font-size:12px;color:#708477;margin-top:8px;">Hiệu lực trong 15 phút</span>
                </div>

                <p style="font-size:14px;line-height:1.6;color:#52655a;">Vui lòng nhập mã này vào màn hình xác nhận trên website để hoàn tất việc đổi mật khẩu mới.</p>
                <p style="font-size:13px;line-height:1.5;color:#85968b;margin-top:24px;padding-top:16px;border-top:1px solid #eef2ef;">Nếu bạn không gửi yêu cầu này, xin vui lòng bỏ qua thư này hoặc thông báo cho quầy lễ tân. Mật khẩu của bạn sẽ không bị thay đổi nếu chưa nhập mã xác nhận.</p>
              </td>
            </tr>
            <tr>
              <td style="background:#f9fbf9;padding:16px 32px;text-align:center;font-size:12px;color:#85968b;border-top:1px solid #eef2ef;">
                © 2026 Courtly Tennis Club · Hệ thống quản lý đặt sân & giải đấu chuyên nghiệp
              </td>
            </tr>
          </table>
        </body>
        </html>
        """, fullName != null && !fullName.isBlank() ? fullName : "Quý khách", toEmail, code);

    boolean sent = send(toEmail, subject, plain, html);
    return CompletableFuture.completedFuture(sent);
  }

  @Async
  public CompletableFuture<Boolean> sendActivationEmail(String toEmail, String fullName, String code) {
    String subject = "[Courtly Tennis Club] Mã kích hoạt tài khoản của bạn";
    String plain = String.format("""
        Xin chào %s,

        Cảm ơn bạn đã đăng ký tài khoản tại Courtly Tennis Club (%s).

        Mã kích hoạt OTP 6 số của bạn là: %s

        Mã này có hiệu lực trong 15 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.

        Trân trọng,
        CLB Tennis Courtly
        """, fullName != null && !fullName.isBlank() ? fullName : "Quý khách", toEmail, code);

    String html = String.format("""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"/></head>
        <body style="font-family:'Segoe UI',Arial,sans-serif;background-color:#f4f7f5;margin:0;padding:24px;color:#21342e;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%%" style="max-width:540px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dce3df;box-shadow:0 4px 16px rgba(0,0,0,0.05);">
            <tr>
              <td style="background-color:#173c32;padding:28px 32px;text-align:center;">
                <h1 style="color:#ffffff;margin:0;font-size:24px;letter-spacing:1px;">COURTLY <span style="color:#def46a;font-size:14px;display:block;margin-top:4px;">TENNIS CLUB</span></h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 24px;">
                <h2 style="font-size:20px;margin-top:0;color:#173c32;">Kích hoạt tài khoản mới</h2>
                <p style="font-size:15px;line-height:1.6;color:#52655a;">Xin chào <strong>%s</strong>,</p>
                <p style="font-size:15px;line-height:1.6;color:#52655a;">Cảm ơn bạn đã đăng ký tài khoản tại hệ thống đặt sân <strong>Courtly Tennis Club</strong> (%s).</p>
                
                <div style="background:#f0f5e8;border:2px dashed #9bc89a;border-radius:10px;padding:20px;text-align:center;margin:28px 0;">
                  <span style="display:block;font-size:12px;color:#4a6250;letter-spacing:1px;margin-bottom:8px;font-weight:600;text-transform:uppercase;">Mã kích hoạt OTP của bạn</span>
                  <span style="font-size:34px;font-weight:700;color:#173c32;letter-spacing:8px;font-family:monospace;">%s</span>
                  <span style="display:block;font-size:12px;color:#708477;margin-top:8px;">Hiệu lực trong 15 phút</span>
                </div>

                <p style="font-size:14px;line-height:1.6;color:#52655a;">Vui lòng nhập mã này vào màn hình kích hoạt trên website để hoàn tất đăng ký tài khoản.</p>
                <p style="font-size:13px;line-height:1.5;color:#85968b;margin-top:24px;padding-top:16px;border-top:1px solid #eef2ef;">Nếu bạn không thực hiện đăng ký tài khoản này, xin vui lòng bỏ qua thư này.</p>
              </td>
            </tr>
            <tr>
              <td style="background:#f9fbf9;padding:16px 32px;text-align:center;font-size:12px;color:#85968b;border-top:1px solid #eef2ef;">
                © 2026 Courtly Tennis Club · Hệ thống quản lý đặt sân & giải đấu chuyên nghiệp
              </td>
            </tr>
          </table>
        </body>
        </html>
        """, fullName != null && !fullName.isBlank() ? fullName : "Quý khách", toEmail, code);

    boolean sent = send(toEmail, subject, plain, html);
    return CompletableFuture.completedFuture(sent);
  }

  public boolean send(String to, String subject, String textBody, String htmlBody) {
    if (!isConfigured()) {
      logEmailMetadata(to, subject, demo.enabled() ? "DEMO" : "NOT_CONFIGURED");
      return demo.enabled();
    }

    try {
      MimeMessage mimeMessage = mailSender.createMimeMessage();
      MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, StandardCharsets.UTF_8.name());

      String effectiveFrom = (fromAddress != null && !fromAddress.isBlank())
          ? fromAddress
          : (username != null && !username.isBlank() ? username : "no-reply@courtly.vn");
      String effectiveName = (fromName != null && !fromName.isBlank()) ? fromName : "Courtly Tennis Club";

      helper.setFrom(new InternetAddress(effectiveFrom, effectiveName, StandardCharsets.UTF_8.name()));
      helper.setTo(to);
      helper.setSubject(subject);
      helper.setText(textBody, htmlBody != null && !htmlBody.isBlank() ? htmlBody : textBody);

      mailSender.send(mimeMessage);
      log.info("Email successfully sent via SMTP ({}:{}) to {}", host, port, to);
      logEmailMetadata(to, subject, "SENT");
      return true;
    } catch (Exception e) {
      log.error("Failed to send email via SMTP ({}:{}): {}", host, port, e.getMessage(), e);
      logEmailMetadata(to, subject, "FAILED");
      return false;
    }
  }

  private void logEmailMetadata(String to, String subject, String status) {
    try {
      documents.put("email:log:" + UUID.randomUUID(), Map.of(
          "to", to,
          "subject", subject,
          "status", status,
          "sentAt", Instant.now().toString(),
          "hasSmtp", isConfigured()
      ));
    } catch (Exception e) {
      log.warn("Failed to store email log metadata: {}", e.getMessage());
    }
  }

  @Scheduled(cron = "0 0 3 * * *")
  public void cleanupOldEmailLogs() {
    try {
      var entities = documents.listEntities("email:log:");
      Instant cutoff = Instant.now().minus(Duration.ofDays(7));
      for (var doc : entities) {
        var data = documents.read(doc);
        String sentAtStr = (String) data.get("sentAt");
        if (sentAtStr != null) {
          try {
            if (Instant.parse(sentAtStr).isBefore(cutoff)) {
              documents.delete(doc.getKey());
            }
          } catch (Exception ignored) {}
        }
      }
    } catch (Exception e) {
      log.warn("Failed to clean up old email logs: {}", e.getMessage());
    }
  }
}

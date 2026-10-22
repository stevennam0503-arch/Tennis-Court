package com.courtly.service;

import java.io.*;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import javax.net.ssl.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {
  private final DocumentService documents;

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

  public boolean sendPasswordResetEmail(String toEmail, String fullName, String code) {
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

    return send(toEmail, subject, plain, html);
  }

  public boolean send(String to, String subject, String textBody, String htmlBody) {
    try {
      documents.put("email:log:" + UUID.randomUUID(), Map.of(
          "to", to,
          "subject", subject,
          "body", textBody,
          "sentAt", Instant.now().toString(),
          "hasSmtp", host != null && !host.isBlank()
      ));
    } catch (Exception e) {
      log.warn("Failed to store email log: {}", e.getMessage());
    }

    if (host == null || host.isBlank()) {
      log.info("\n======================================================\n" +
               "[COURTLY EMAIL - DEMO MODE (No SMTP server configured)]\n" +
               "To: {}\nSubject: {}\n" +
               "------------------------------------------------------\n" +
               "{}\n" +
               "======================================================", to, subject, textBody);
      return true;
    }

    try {
      sendSmtp(to, subject, textBody, htmlBody);
      log.info("Email successfully sent via SMTP ({}:{}) to {}", host, port, to);
      return true;
    } catch (Exception e) {
      log.error("Failed to send email via SMTP ({}:{}): {}", host, port, e.getMessage(), e);
      return false;
    }
  }

  private void sendSmtp(String to, String subject, String textBody, String htmlBody) throws Exception {
    boolean isSsl = port == 465;
    Socket rawSocket = isSsl ? SSLSocketFactory.getDefault().createSocket(host, port) : new Socket(host, port);
    rawSocket.setSoTimeout(15000);

    try (var in = new BufferedReader(new InputStreamReader(rawSocket.getInputStream(), StandardCharsets.UTF_8));
         var out = new BufferedWriter(new OutputStreamWriter(rawSocket.getOutputStream(), StandardCharsets.UTF_8))) {

      expect(in, "220");
      sendLine(out, "EHLO courtly.vn");
      readResponse(in);

      Socket socket = rawSocket;
      BufferedReader reader = in;
      BufferedWriter writer = out;

      if (!isSsl && (port == 587 || port == 25)) {
        sendLine(writer, "STARTTLS");
        String resp = in.readLine();
        if (resp != null && resp.startsWith("220")) {
          SSLSocket sslSocket = (SSLSocket) ((SSLSocketFactory) SSLSocketFactory.getDefault())
              .createSocket(rawSocket, host, port, true);
          sslSocket.startHandshake();
          socket = sslSocket;
          reader = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
          writer = new BufferedWriter(new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.UTF_8));
          sendLine(writer, "EHLO courtly.vn");
          readResponse(reader);
        }
      }

      if (username != null && !username.isBlank() && password != null && !password.isBlank()) {
        sendLine(writer, "AUTH LOGIN");
        expect(reader, "334");
        sendLine(writer, Base64.getEncoder().encodeToString(username.getBytes(StandardCharsets.UTF_8)));
        expect(reader, "334");
        sendLine(writer, Base64.getEncoder().encodeToString(password.getBytes(StandardCharsets.UTF_8)));
        expect(reader, "235");
      }

      sendLine(writer, "MAIL FROM:<" + fromAddress + ">");
      expect(reader, "250");
      sendLine(writer, "RCPT TO:<" + to + ">");
      expect(reader, "250");
      sendLine(writer, "DATA");
      expect(reader, "354");

      String boundary = "----=_Part_" + System.currentTimeMillis();
      String rawSubject = "=?UTF-8?B?" + Base64.getEncoder().encodeToString(subject.getBytes(StandardCharsets.UTF_8)) + "?=";
      String fromHeader = fromName != null && !fromName.isBlank()
          ? "=?UTF-8?B?" + Base64.getEncoder().encodeToString(fromName.getBytes(StandardCharsets.UTF_8)) + "?= <" + fromAddress + ">"
          : fromAddress;

      writer.write("From: " + fromHeader + "\r\n");
      writer.write("To: <" + to + ">\r\n");
      writer.write("Subject: " + rawSubject + "\r\n");
      writer.write("MIME-Version: 1.0\r\n");
      writer.write("Content-Type: multipart/alternative; boundary=\"" + boundary + "\"\r\n");
      writer.write("\r\n");

      writer.write("--" + boundary + "\r\n");
      writer.write("Content-Type: text/plain; charset=UTF-8\r\n");
      writer.write("Content-Transfer-Encoding: base64\r\n\r\n");
      writer.write(Base64.getEncoder().encodeToString(textBody.getBytes(StandardCharsets.UTF_8)) + "\r\n\r\n");

      if (htmlBody != null && !htmlBody.isBlank()) {
        writer.write("--" + boundary + "\r\n");
        writer.write("Content-Type: text/html; charset=UTF-8\r\n");
        writer.write("Content-Transfer-Encoding: base64\r\n\r\n");
        writer.write(Base64.getEncoder().encodeToString(htmlBody.getBytes(StandardCharsets.UTF_8)) + "\r\n\r\n");
      }

      writer.write("--" + boundary + "--\r\n");
      writer.write(".\r\n");
      writer.flush();
      expect(reader, "250");

      sendLine(writer, "QUIT");
    }
  }

  private void sendLine(BufferedWriter writer, String line) throws IOException {
    writer.write(line + "\r\n");
    writer.flush();
  }

  private String readResponse(BufferedReader reader) throws IOException {
    StringBuilder sb = new StringBuilder();
    String line;
    while ((line = reader.readLine()) != null) {
      sb.append(line).append("\n");
      if (line.length() >= 4 && line.charAt(3) == ' ') break;
    }
    return sb.toString();
  }

  private void expect(BufferedReader reader, String prefix) throws IOException {
    String resp = readResponse(reader);
    if (!resp.startsWith(prefix)) {
      throw new IOException("Unexpected SMTP response: " + resp);
    }
  }
}

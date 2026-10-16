package com.courtly.config;

import com.courtly.repository.CustomerOrderRepository;
import com.courtly.service.AuthService;
import jakarta.servlet.http.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
@RequiredArgsConstructor
public class ApiAccessInterceptor implements HandlerInterceptor {
  private final AuthService auth;
  private final CustomerOrderRepository orders;

  @Override
  public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) {
    String p = req.getRequestURI();
    if (req.getMethod().equals("OPTIONS")
        || p.startsWith("/api/public/")
        || p.startsWith("/api/auth/")
        || p.equals("/api/csrf")) return true;
    var a = auth.current(req);
    req.setAttribute("actor", a);
    boolean admin = "ADMIN".equals(a.getRole());
    if (p.startsWith("/api/catalog/")
        || p.startsWith("/api/payments")
        || p.equals("/api/settings")
        || p.startsWith("/api/matches/")
        || p.matches("/api/tournaments/[^/]+/draw")
        || p.startsWith("/api/content")) auth.admin(a);
    if (!admin && p.matches("/api/orders/[^/]+.*")) {
      String[] parts = p.split("/");
      var o =
          orders
              .findById(UUID.fromString(parts[3]))
              .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
      if (o.getCustomerAccount() == null || !o.getCustomerAccount().getId().equals(a.getId()))
        throw new ResponseStatusException(
            HttpStatus.FORBIDDEN, "Bạn chỉ được xem và sửa đơn của mình");
      if (parts.length < 5 || !Set.of("cancel", "schedule", "preview").contains(parts[4]))
        throw new ResponseStatusException(
            HttpStatus.FORBIDDEN, "Dịch vụ và vận hành đơn chỉ xử lý tại quầy");
    }
    return true;
  }
}

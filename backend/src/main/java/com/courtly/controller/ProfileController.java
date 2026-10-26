package com.courtly.controller;

import static com.courtly.util.Rules.*;

import com.courtly.repository.AccountRepository;
import com.courtly.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class ProfileController {
  private final AuthService auth;
  private final AccountRepository accounts;

  @RequestMapping(
      value = "/api/profile",
      method = {RequestMethod.PATCH, RequestMethod.PUT, RequestMethod.POST})
  @Transactional
  public Map<String, Object> profile(@RequestBody Map<String, Object> b, HttpServletRequest r) {
    var a = auth.current(r);
    require(
        b.keySet().stream().allMatch(k -> Set.of("name", "phone").contains(k)),
        "Chỉ được sửa họ tên và điện thoại");
    a.setFullName(text((String) b.get("name"), "Họ tên"));
    String phone = String.valueOf(b.getOrDefault("phone", ""));
    require(phone.length() <= 30 && phone.matches("[+\\d\\s().-]*"), "Số điện thoại không hợp lệ");
    a.setPhone(phone);
    accounts.save(a);
    return map("id", a.getId());
  }
}

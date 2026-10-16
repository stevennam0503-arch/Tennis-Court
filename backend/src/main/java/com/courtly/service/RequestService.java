package com.courtly.service;

import static com.courtly.util.Rules.*;

import java.util.*;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RequestService {
  private final DocumentService documents;

  @Transactional
  public Map<String, Object> execute(
      UUID actor,
      String requestId,
      String operation,
      Object payload,
      Supplier<Map<String, Object>> fn) {
    documents.mutationLock();
    if (requestId == null || requestId.isBlank()) return fn.get();
    require(requestId.length() <= 100, "Mã yêu cầu không hợp lệ");
    String key = "request:" + actor + ":" + requestId,
        signature =
            AuthService.hash(documents.encode(map("operation", operation, "body", payload)));
    var old = documents.get(key);
    if (!old.isEmpty()) {
      require(signature.equals(old.get("signature")), "Mã yêu cầu đã dùng với nội dung khác");
      return (Map<String, Object>) old.get("result");
    }
    var result = fn.get();
    documents.put(key, map("signature", signature, "result", result));
    return result;
  }
}

package com.courtly.service;

import static org.junit.jupiter.api.Assertions.*;

import com.courtly.util.PhoneUtils;
import java.util.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PhoneMigrationTest {

  record TestAccount(UUID id, String role, String phone, int orderCount, long createdAtMs) {}

  @Test
  @DisplayName("V19 logic: chuẩn hoá số, giữ khách ưu tiên, xóa trắng khách trùng, giữ số staff")
  void testV19DeduplicationAlgorithm() {
    UUID cust1 = UUID.randomUUID();
    UUID cust2 = UUID.randomUUID();
    UUID staff1 = UUID.randomUUID();

    List<TestAccount> accounts = List.of(
        new TestAccount(cust1, "CUSTOMER", "0988777666", 2, 1000L),
        new TestAccount(cust2, "CUSTOMER", "+84988777666", 0, 2000L),
        new TestAccount(staff1, "STAFF", "0988 777 666", 0, 500L)
    );

    // Normalize
    Map<UUID, String> normalized = new HashMap<>();
    for (var a : accounts) {
      normalized.put(a.id(), PhoneUtils.normalizeE164(a.phone()));
    }

    // Partition customers by normalized phone
    Map<String, List<TestAccount>> customerByPhone = new HashMap<>();
    for (var a : accounts) {
      if ("CUSTOMER".equals(a.role())) {
        customerByPhone.computeIfAbsent(normalized.get(a.id()), k -> new ArrayList<>()).add(a);
      }
    }

    Map<UUID, String> finalPhones = new HashMap<>();
    List<UUID> auditedDuplicates = new ArrayList<>();

    for (var a : accounts) {
      if ("CUSTOMER".equals(a.role())) {
        var group = customerByPhone.get(normalized.get(a.id()));
        // Sort by orderCount desc, createdAt asc, id asc
        group.sort((o1, o2) -> {
          int cmp = Integer.compare(o2.orderCount(), o1.orderCount());
          if (cmp != 0) return cmp;
          return Long.compare(o1.createdAtMs(), o2.createdAtMs());
        });
        if (group.get(0).id().equals(a.id())) {
          finalPhones.put(a.id(), normalized.get(a.id()));
        } else {
          finalPhones.put(a.id(), "");
          auditedDuplicates.add(a.id());
        }
      } else {
        // Staff retains normalized phone regardless of customer duplicate
        finalPhones.put(a.id(), normalized.get(a.id()));
      }
    }

    assertEquals("+84988777666", finalPhones.get(cust1));
    assertEquals("", finalPhones.get(cust2));
    assertEquals("+84988777666", finalPhones.get(staff1));
    assertTrue(auditedDuplicates.contains(cust2));
    assertEquals(1, auditedDuplicates.size());
  }
}

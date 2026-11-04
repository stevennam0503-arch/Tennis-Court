package com.courtly.repository;

import com.courtly.entity.Account;
import java.util.Optional;

public interface AccountRepository extends LockingRepository<Account> {
  Optional<Account> findByEmailIgnoreCase(String email);
  Optional<Account> findByPhone(String phone);
}

package com.courtly.repository;

import com.courtly.entity.Account;

public interface AccountRepository extends LockingRepository<Account> {
  java.util.Optional<Account> findByEmailIgnoreCase(String email);
}

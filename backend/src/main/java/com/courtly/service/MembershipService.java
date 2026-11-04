package com.courtly.service;

import com.courtly.repository.AccountRepository;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

@Service
@Primary
public class MembershipService extends TierPricingService {
  public MembershipService(AccountRepository accounts) {
    super(accounts);
  }
}

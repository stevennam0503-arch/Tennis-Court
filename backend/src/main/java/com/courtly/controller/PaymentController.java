package com.courtly.controller;

import com.courtly.dto.request.*;
import com.courtly.service.PaymentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {
    private final PaymentService service;
    @PostMapping public Map<String,UUID> collect(@Valid @RequestBody PaymentRequest request) { return Map.of("id",service.collect(request)); }
    @PostMapping("/{id}/refunds") public Map<String,UUID> refund(@PathVariable UUID id, @Valid @RequestBody RefundRequest request) { return Map.of("id",service.refund(id,request)); }
}

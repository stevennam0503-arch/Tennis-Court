package com.courtly.controller;

import com.courtly.dto.request.*;
import com.courtly.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {
    private final OrderService service;
    @PostMapping public Map<String,UUID> create(@Valid @RequestBody BookingRequest request) { return Map.of("id",service.create(request)); }
    @PostMapping("/{id}/cancel") public void cancel(@PathVariable UUID id) { service.cancel(id); }
    @PostMapping("/{id}/check-in") public void checkIn(@PathVariable UUID id) { service.checkIn(id); }
    @PostMapping("/{id}/check-out") public void checkOut(@PathVariable UUID id) { service.checkOut(id); }
    @PatchMapping("/{id}/schedule") public void move(@PathVariable UUID id, @Valid @RequestBody MoveBookingRequest request) { service.move(id,request); }
    @PostMapping("/{id}/products") public void product(@PathVariable UUID id, @Valid @RequestBody AddProductRequest request) { service.addProduct(id,request); }
    @PostMapping("/{id}/products/{lineId}/return") public void returnProduct(@PathVariable UUID id, @PathVariable UUID lineId) { service.returnProduct(id,lineId); }
    @PostMapping("/{id}/staff") public void staff(@PathVariable UUID id, @Valid @RequestBody AssignStaffRequest request) { service.assignStaff(id,request); }
    @PostMapping("/{id}/invoice") public void invoice(@PathVariable UUID id) { service.invoice(id); }
}

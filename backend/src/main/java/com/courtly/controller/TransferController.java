package com.courtly.controller;
import com.courtly.service.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
@RestController @RequiredArgsConstructor
public class TransferController {
 private final TransferService transfers;private final AuthService auth;
 @GetMapping("/api/public/payment-config") public Map<String,Object> config(){return transfers.config();}
 @GetMapping("/api/transfers") public List<Map<String,Object>> mine(HttpServletRequest r){return transfers.mine(auth.current(r));}
 @PostMapping("/api/transfers") public Map<String,Object> create(@RequestBody Map<String,Object>b,HttpServletRequest r){return transfers.create(auth.current(r),b);}
 @PostMapping("/api/transfers/{id}/declared") public Map<String,Object> declared(@PathVariable String id,HttpServletRequest r){return transfers.declared(auth.current(r),id);}
 @PostMapping("/api/transfers/{id}/sandbox") public Map<String,Object> sandbox(@PathVariable String id,@RequestBody Map<String,Object>b,HttpServletRequest r){return transfers.sandbox(auth.current(r),id,b);}
 @PostMapping("/api/webhooks/sepay") public Map<String,Object> webhook(@RequestHeader(value="Authorization",required=false)String key,@RequestBody Map<String,Object>b){return transfers.webhook(key,b);}
}

package com.courtly.controller;

import com.courtly.dto.request.CatalogRequest;
import com.courtly.service.CatalogService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/catalog")
@RequiredArgsConstructor
public class CatalogController {
    private final CatalogService service;
    @PostMapping("/{collection}")
    public Map<String,UUID> create(@PathVariable String collection, @Valid @RequestBody CatalogRequest request) {
        return Map.of("id",service.save(collection,null,request));
    }
    @PutMapping("/{collection}/{id}")
    public Map<String,UUID> update(@PathVariable String collection, @PathVariable UUID id, @Valid @RequestBody CatalogRequest request) {
        return Map.of("id",service.save(collection,id,request));
    }
}

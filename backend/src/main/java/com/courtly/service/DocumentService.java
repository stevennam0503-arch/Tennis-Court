package com.courtly.service;

import com.courtly.entity.AppDocument;
import com.courtly.repository.AppDocumentRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class DocumentService {
  private final AppDocumentRepository repository;
  private final ObjectMapper mapper;
  private final JdbcTemplate jdbc;

  public void mutationLock() {
    jdbc.execute("SELECT pg_advisory_xact_lock(1576841131)");
  }

  public Map<String, Object> decode(String text) {
    try {
      return mapper.readValue(text, new TypeReference<LinkedHashMap<String, Object>>() {});
    } catch (Exception e) {
      throw new IllegalStateException("Invalid stored JSON", e);
    }
  }

  public String encode(Object value) {
    try {
      return mapper
          .writer()
          .with(com.fasterxml.jackson.databind.SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS)
          .writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalArgumentException("Invalid JSON", e);
    }
  }

  public Map<String, Object> get(String key) {
    return repository.findById(key).map(this::read).orElseGet(LinkedHashMap::new);
  }

  public AppDocument lock(String key) {
    return repository.lock(key).orElseGet(() -> new AppDocument(key));
  }

  public Map<String, Object> read(AppDocument row) {
    return decode(row.getData());
  }

  public void save(AppDocument row, Map<String, Object> data) {
    row.setData(encode(data));
    repository.save(row);
  }

  public void put(String key, Map<String, Object> data) {
    save(lock(key), data);
  }

  public List<Map<String, Object>> list(String prefix) {
    return repository.findByKeyStartingWith(prefix).stream().map(this::read).toList();
  }
}

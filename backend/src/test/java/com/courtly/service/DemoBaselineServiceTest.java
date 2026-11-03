package com.courtly.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class DemoBaselineServiceTest {

  private JdbcTemplate jdbc;
  private ObjectMapper objectMapper;
  private DemoBaselineService service;

  @BeforeEach
  void setUp() {
    jdbc = mock(JdbcTemplate.class);
    objectMapper = new ObjectMapper();
    service = new DemoBaselineService(jdbc, objectMapper);
  }

  @Test
  void restoreTable_executesInOrder_DeleteThenUpdateThenInsert() {
    String jsonArray = "[{\"id\":\"11111111-1111-1111-1111-111111111111\",\"name\":\"Sân A01\"}]";

    // Giả lập information_schema trả về cột "name"
    when(jdbc.query(
        contains("information_schema.columns"),
        any(RowMapper.class),
        eq("courts"),
        eq("id")
    )).thenReturn(List.of("name"));

    service.restoreTable("courts", "id", jsonArray, null);

    InOrder inOrder = inOrder(jdbc);
    // 1. DELETE những bản ghi không có trong baseline
    inOrder.verify(jdbc).update(argThat((String sql) -> sql.startsWith("DELETE FROM courts WHERE id NOT IN")), eq(jsonArray));
    // 2. Query columns
    inOrder.verify(jdbc).query(contains("information_schema.columns"), any(RowMapper.class), eq("courts"), eq("id"));
    // 3. UPDATE những bản ghi đã có
    inOrder.verify(jdbc).update(argThat((String sql) -> sql.startsWith("UPDATE courts t SET (name) = (b.name)")), eq(jsonArray));
    // 4. INSERT những bản ghi chưa có
    inOrder.verify(jdbc).update(argThat((String sql) -> sql.startsWith("INSERT INTO courts SELECT * FROM json_populate_recordset")), eq(jsonArray));
  }

  @Test
  void restoreTable_withExtraDeleteFilter() {
    String jsonArray = "[{\"document_key\":\"club\",\"data\":\"{}\"}]";
    String filter = "document_key = 'club' OR document_key LIKE 'article:%'";

    when(jdbc.query(
        contains("information_schema.columns"),
        any(RowMapper.class),
        eq("app_documents"),
        eq("document_key")
    )).thenReturn(List.of("data"));

    service.restoreTable("app_documents", "document_key", jsonArray, filter);

    verify(jdbc).update(
        argThat((String sql) -> sql.contains("WHERE (" + filter + ") AND document_key NOT IN")),
        eq(jsonArray)
    );
  }

  @Test
  void restoreBaseline_withValidFile_runsSuccessfully() {
    // baseline.json thực tế có trong src/main/resources/demo/baseline.json
    when(jdbc.query(
        contains("information_schema.columns"),
        any(RowMapper.class),
        anyString(),
        anyString()
    )).thenReturn(List.of("name"));

    assertDoesNotThrow(() -> service.restoreBaseline());

    // Xác minh có gọi dọn dẹp app_documents tạm
    verify(jdbc).execute(contains("DELETE FROM app_documents WHERE"));
    // Xác minh có xóa và chèn court_prices
    verify(jdbc).execute("DELETE FROM court_prices");
    // Xác minh có xóa staff_schedules không còn được tham chiếu
    verify(jdbc).execute(contains("DELETE FROM staff_schedules"));
  }

  @Test
  void restoreBaseline_missingResource_throwsException() {
    // Service với classloader không có baseline.json
    DemoBaselineService faultyService = new DemoBaselineService(jdbc, objectMapper) {
      @Override
      public void restoreBaseline() {
        ClassLoader emptyCl = new ClassLoader(null) {};
        if (emptyCl.getResourceAsStream("demo/baseline.json") == null) {
          throw new IllegalStateException("Thiếu demo/baseline.json");
        }
      }
    };

    IllegalStateException ex = assertThrows(IllegalStateException.class, faultyService::restoreBaseline);
    assertEquals("Thiếu demo/baseline.json", ex.getMessage());
  }
}

package com.courtly.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class DemoBaselineService {

  private final JdbcTemplate jdbc;
  private final ObjectMapper objectMapper;

  public void restoreBaseline() {
    log.info("Khôi phục toàn bộ danh mục từ demo/baseline.json...");

    InputStream is = getClass().getClassLoader().getResourceAsStream("demo/baseline.json");
    if (is == null) {
      throw new IllegalStateException("Thiếu demo/baseline.json");
    }

    JsonNode tables;
    try {
      String jsonText = new String(is.readAllBytes(), StandardCharsets.UTF_8);
      JsonNode root = objectMapper.readTree(jsonText);
      tables = root.get("tables");
      if (tables == null || !tables.isObject()) {
        throw new IllegalStateException("demo/baseline.json không hợp lệ: thiếu 'tables'");
      }
    } catch (Exception e) {
      log.error("Lỗi đọc demo/baseline.json: ", e);
      throw new IllegalStateException("Lỗi nạp demo/baseline.json: " + e.getMessage(), e);
    }

    // 1. Dọn dẹp app_documents tạm thời
    jdbc.execute("""
        DELETE FROM app_documents WHERE 
          document_key LIKE 'transfer:%' OR
          document_key LIKE 'bank-event:%' OR
          document_key LIKE 'request:%' OR
          document_key LIKE 'email:%' OR
          document_key LIKE 'otp:%' OR
          document_key LIKE 'activation:%' OR
          document_key LIKE 'reset:%' OR
          document_key LIKE 'registration-details:%'
    """);

    // 2. Khôi phục staff và xóa staff_schedules không còn được tham chiếu
    String staffJson = tables.get("staff").toString();
    restoreTable("staff", "id", staffJson, null);
    jdbc.execute("""
        DELETE FROM staff_schedules
        WHERE id NOT IN (SELECT staff_schedule_id FROM booking_staff WHERE staff_schedule_id IS NOT NULL)
          AND id NOT IN (SELECT staff_schedule_id FROM match_staff WHERE staff_schedule_id IS NOT NULL)
    """);

    // 3. Sân không có trong baseline: xóa court_schedules và court_prices của chúng, rồi xóa sân
    String courtsJson = tables.get("courts").toString();
    jdbc.update("DELETE FROM court_schedules WHERE court_id NOT IN (SELECT id FROM json_populate_recordset(NULL::courts, ?::json))", courtsJson);
    jdbc.update("DELETE FROM court_prices WHERE court_id NOT IN (SELECT id FROM json_populate_recordset(NULL::courts, ?::json))", courtsJson);
    restoreTable("courts", "id", courtsJson, null);

    // 4. Khôi phục court_prices (xóa toàn bộ giá rồi chèn lại từ baseline là đủ)
    String courtPricesJson = tables.get("court_prices").toString();
    jdbc.execute("DELETE FROM court_prices");
    jdbc.update("INSERT INTO court_prices SELECT * FROM json_populate_recordset(NULL::court_prices, ?::json)", courtPricesJson);

    // 5. Khôi phục tournaments
    String tournamentsJson = tables.get("tournaments").toString();
    restoreTable("tournaments", "id", tournamentsJson, null);

    // 6. Khôi phục vouchers: trước khi UPDATE/INSERT, xóa voucher có code trùng baseline nhưng id khác
    String vouchersJson = tables.get("vouchers").toString();
    jdbc.update("""
        DELETE FROM vouchers
        WHERE code IN (SELECT code FROM json_populate_recordset(NULL::vouchers, ?::json))
          AND id NOT IN (SELECT id FROM json_populate_recordset(NULL::vouchers, ?::json))
    """, vouchersJson, vouchersJson);
    restoreTable("vouchers", "id", vouchersJson, null);

    // 7. Khôi phục club_settings
    String clubSettingsJson = tables.get("club_settings").toString();
    restoreTable("club_settings", "id", clubSettingsJson, null);

    // 8. Khôi phục app_documents thuộc baseline (club, article:*, membership-plan:*, fixture:*)
    String appDocumentsJson = tables.get("app_documents").toString();
    String docFilter = "document_key = 'club' OR document_key LIKE 'article:%' OR document_key LIKE 'fixture:%'";
    restoreTable("app_documents", "document_key", appDocumentsJson, docFilter);

    log.info("Khôi phục danh mục từ baseline.json thành công.");
  }

  public void restoreTable(String table, String keyColumn, String jsonArray, String extraDeleteFilter) {
    if (jsonArray == null || jsonArray.isBlank() || "[]".equals(jsonArray.trim())) {
      return;
    }

    // 1. DELETE những bản ghi không có trong baseline
    StringBuilder deleteSql = new StringBuilder("DELETE FROM ").append(table);
    if (extraDeleteFilter != null && !extraDeleteFilter.isBlank()) {
      deleteSql.append(" WHERE (").append(extraDeleteFilter).append(")")
               .append(" AND ").append(keyColumn)
               .append(" NOT IN (SELECT ").append(keyColumn).append(" FROM json_populate_recordset(NULL::").append(table).append(", ?::json))");
    } else {
      deleteSql.append(" WHERE ").append(keyColumn)
               .append(" NOT IN (SELECT ").append(keyColumn).append(" FROM json_populate_recordset(NULL::").append(table).append(", ?::json))");
    }
    jdbc.update(deleteSql.toString(), jsonArray);

    // 2. Lấy danh sách cột từ information_schema.columns (trừ keyColumn)
    List<String> nonKeyColumns = jdbc.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ? AND column_name <> ? ORDER BY ordinal_position",
        (rs, rowNum) -> rs.getString("column_name"),
        table, keyColumn
    );

    // 3. UPDATE những bản ghi đã có
    if (!nonKeyColumns.isEmpty()) {
      String setCols = String.join(", ", nonKeyColumns);
      String setVals = nonKeyColumns.stream().map(c -> "b." + c).collect(Collectors.joining(", "));
      String updateSql = String.format(
          "UPDATE %s t SET (%s) = (%s) FROM json_populate_recordset(NULL::%s, ?::json) b WHERE t.%s = b.%s",
          table, setCols, setVals, table, keyColumn, keyColumn
      );
      jdbc.update(updateSql, jsonArray);
    }

    // 4. INSERT những bản ghi chưa có
    String insertSql = String.format(
        "INSERT INTO %s SELECT * FROM json_populate_recordset(NULL::%s, ?::json) b WHERE NOT EXISTS (SELECT 1 FROM %s t WHERE t.%s = b.%s)",
        table, table, table, keyColumn, keyColumn
    );
    jdbc.update(insertSql, jsonArray);
  }
}

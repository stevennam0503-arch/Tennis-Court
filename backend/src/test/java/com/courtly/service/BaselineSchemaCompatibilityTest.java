package com.courtly.service;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.*;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class BaselineSchemaCompatibilityTest {

  @Test
  @DisplayName("Tất cả bảng trong baseline.json phải chứa đầy đủ mọi cột NOT NULL không có default")
  void baselineTablesContainAllNotNullColumnsWithoutDefault() throws Exception {
    ObjectMapper mapper = new ObjectMapper();
    JsonNode root;
    try (InputStream in = getClass().getClassLoader().getResourceAsStream("demo/baseline.json")) {
      assertNotNull(in, "demo/baseline.json must exist in classpath");
      root = mapper.readTree(in);
    }
    JsonNode tablesNode = root.path("tables");
    assertTrue(tablesNode.isObject(), "tables field must be an object");

    Connection conn = null;
    for (String url : List.of("jdbc:postgresql://localhost:5433/courtly", "jdbc:postgresql://localhost:5432/courtly")) {
      for (String pwd : List.of("courtly_local", "courtly")) {
        try {
          conn = DriverManager.getConnection(url, "courtly", pwd);
          break;
        } catch (Exception ignored) {
        }
      }
      if (conn != null) break;
    }

    Assumptions.assumeTrue(conn != null, "PostgreSQL not reachable on localhost:5433 or 5432; skipping live schema check");

    final Connection finalConn = conn;
    try (finalConn) {
      Map<String, Set<String>> requiredColumnsByTable = new HashMap<>();
      try (Statement stmt = conn.createStatement();
           ResultSet rs = stmt.executeQuery(
               "SELECT table_name, column_name FROM information_schema.columns " +
               "WHERE table_schema = 'public' AND is_nullable = 'NO' AND column_default IS NULL")) {
        while (rs.next()) {
          String table = rs.getString("table_name");
          String column = rs.getString("column_name");
          requiredColumnsByTable.computeIfAbsent(table, k -> new HashSet<>()).add(column);
        }
      }

      Iterator<String> tableNames = tablesNode.fieldNames();
      while (tableNames.hasNext()) {
        String table = tableNames.next();
        Set<String> requiredCols = requiredColumnsByTable.getOrDefault(table, Set.of());
        JsonNode rowsNode = tablesNode.get(table);
        if (rowsNode.isArray()) {
          for (int i = 0; i < rowsNode.size(); i++) {
            JsonNode row = rowsNode.get(i);
            Set<String> presentKeys = new HashSet<>();
            row.fieldNames().forEachRemaining(presentKeys::add);
            for (String reqCol : requiredCols) {
              assertTrue(
                  presentKeys.contains(reqCol),
                  String.format(
                      "Table '%s' row %d in baseline.json is missing NOT NULL non-default column '%s'",
                      table, i, reqCol));
            }
          }
        }
      }
    }
  }
}

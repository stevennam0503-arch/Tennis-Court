#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script chụp ảnh chuẩn (Baseline Snapshot) của các bảng danh mục hệ thống Courtly Tennis.
Xuất dữ liệu sạch ra backend/src/main/resources/demo/baseline.json
"""

import json
import os
import subprocess
import sys
import urllib.request
import urllib.error
import http.cookiejar
from datetime import datetime, timezone

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE_URL = os.environ.get("COURTLY_API_URL", "http://localhost:8081/api")
DOCKER_CONTAINER = os.environ.get("POSTGRES_CONTAINER", "tennis-court-git-postgres-1")
OUTPUT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "backend", "src", "main", "resources", "demo", "baseline.json"
)

def reset_demo_via_api():
    print(f"🔄 Đang gọi API demo-reset tại {BASE_URL} để đảm bảo dữ liệu demo sạch...")
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

    try:
        # 1. CSRF
        req = urllib.request.Request(f"{BASE_URL}/csrf")
        with opener.open(req) as resp:
            csrf = json.loads(resp.read().decode())
        csrf_header = csrf.get("headerName", "X-CSRF-TOKEN")
        csrf_token = csrf.get("token")

        # 2. Login Admin
        login_data = json.dumps({"email": "admin@gmail.com", "password": "123456"}).encode("utf-8")
        req = urllib.request.Request(
            f"{BASE_URL}/auth/login",
            data=login_data,
            headers={"Content-Type": "application/json", csrf_header: csrf_token}
        )
        try:
            with opener.open(req) as resp:
                pass
        except urllib.error.HTTPError:
            # Fallback password if needed
            login_data = json.dumps({"email": "admin@gmail.com", "password": "12345"}).encode("utf-8")
            req = urllib.request.Request(
                f"{BASE_URL}/auth/login",
                data=login_data,
                headers={"Content-Type": "application/json", csrf_header: csrf_token}
            )
            with opener.open(req) as resp:
                pass

        # 3. New CSRF after login
        req = urllib.request.Request(f"{BASE_URL}/csrf")
        with opener.open(req) as resp:
            csrf = json.loads(resp.read().decode())
        csrf_header = csrf.get("headerName", "X-CSRF-TOKEN")
        csrf_token = csrf.get("token")

        # 4. Trigger demo-reset
        req = urllib.request.Request(
            f"{BASE_URL}/catalog/demo-reset",
            data=b"{}",
            headers={"Content-Type": "application/json", csrf_header: csrf_token}
        )
        with opener.open(req) as resp:
            res = json.loads(resp.read().decode())
            print(f"✅ Demo reset phản hồi: {res.get('message', 'Thành công')}")
    except Exception as e:
        print(f"⚠️ Không thể gọi API demo-reset ({e}). Sẽ chụp trạng thái hiện tại của Postgres.")

def run_sql_json(sql):
    cmd = [
        "docker", "exec", "-i", DOCKER_CONTAINER,
        "psql", "-U", "courtly", "-d", "courtly", "-t", "-A", "-c", sql
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    if proc.returncode != 0:
        print(f"❌ Lỗi SQL: {proc.stderr}")
        raise RuntimeError(proc.stderr)
    out = proc.stdout.strip()
    if not out:
        return []
    return json.loads(out)

def main():
    print("=" * 70)
    print("📸 XUẤT ẢNH CHỤP CHUẨN DEMO (EXPORT DEMO BASELINE SNAPSHOT)")
    print("=" * 70)

    # 1. Gọi reset demo qua API
    reset_demo_via_api()

    # 2. Định nghĩa các bảng và query xuất
    queries = {
        "courts": """
            SELECT coalesce(json_agg(t ORDER BY id), '[]') FROM (
              SELECT * FROM courts
              WHERE status = 'ACTIVE' AND name IN (
                'Sân A01', 'Sân A02', 'Sân A03', 'Sân A04',
                'Sân B01', 'Sân B02', 'Sân B03', 'Sân B04',
                'Sân V01', 'Sân V02'
              )
            ) t;
        """,
        "court_prices": """
            SELECT coalesce(json_agg(t ORDER BY id), '[]') FROM (
              SELECT * FROM court_prices
              WHERE court_id IN (
                SELECT id FROM courts
                WHERE status = 'ACTIVE' AND name IN (
                  'Sân A01', 'Sân A02', 'Sân A03', 'Sân A04',
                  'Sân B01', 'Sân B02', 'Sân B03', 'Sân B04',
                  'Sân V01', 'Sân V02'
                )
              )
            ) t;
        """,
        "staff": """
            SELECT coalesce(json_agg(t ORDER BY id), '[]') FROM (
              SELECT * FROM staff
            ) t;
        """,
        "staff_schedules": """
            SELECT coalesce(json_agg(t ORDER BY id), '[]') FROM (
              SELECT * FROM staff_schedules
              WHERE staff_id IN (SELECT id FROM staff)
            ) t;
        """,
        "tournaments": """
            SELECT coalesce(json_agg(t ORDER BY id), '[]') FROM (
              SELECT * FROM tournaments
            ) t;
        """,
        "vouchers": """
            SELECT coalesce(json_agg(t ORDER BY id), '[]') FROM (
              SELECT id, code, type, value, min_order, max_discount, starts_at, expires_at,
                     usage_limit, 0 AS used_count, per_user_limit, member_only, new_user_only,
                     enabled, description, created_at
              FROM vouchers
            ) t;
        """,
        "club_settings": """
            SELECT coalesce(json_agg(t ORDER BY id), '[]') FROM (
              SELECT * FROM club_settings
            ) t;
        """,
        "app_documents": """
            SELECT coalesce(json_agg(t ORDER BY document_key), '[]') FROM (
              SELECT document_key, data, version
              FROM app_documents
              WHERE document_key = 'club'
                 OR document_key LIKE 'article:%'
                 OR document_key LIKE 'membership-plan:%'
                 OR document_key LIKE 'fixture:%'
            ) t;
        """
    }

    tables = {}
    for table_name, sql in queries.items():
        print(f"📥 Đang xuất bảng '{table_name}'...")
        data = run_sql_json(sql)
        tables[table_name] = data
        print(f"   -> {len(data)} bản ghi.")

    baseline = {
        "version": 1,
        "capturedAt": datetime.now(timezone.utc).isoformat(),
        "tables": tables
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(baseline, f, ensure_ascii=False, indent=2)

    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print("-" * 70)
    print(f"✅ Đã ghi thành công baseline vào: {OUTPUT_PATH} ({size_kb:.1f} KB)")
    print("=" * 70)

if __name__ == "__main__":
    main()

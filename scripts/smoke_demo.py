#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Smoke test kịch bản demo Courtly Tennis Club (A3).
Gọi trực tiếp API backend http://localhost:8081 bằng thư viện chuẩn Python (urllib).
Kiểm tra 10 kịch bản nghiệp vụ trọng yếu và in PASS/FAIL từng dòng.
"""

import sys
import time
import argparse
import json
import urllib.request
import urllib.error
import urllib.parse
import http.cookiejar
from datetime import datetime, timedelta

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE_URL = "http://localhost:8081/api"

class Client:
    def __init__(self, base_url=BASE_URL):
        self.base_url = base_url
        self.cj = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cj))
        self.csrf_token = None
        self.refresh_csrf()

    def refresh_csrf(self):
        req = urllib.request.Request(f"{self.base_url}/csrf")
        try:
            with self.opener.open(req) as resp:
                data = json.loads(resp.read().decode())
                self.csrf_token = data.get("token")
        except Exception as e:
            pass

    def request(self, method, path, body=None, expected_status=None):
        url = f"{self.base_url}{path}" if path.startswith("/") else f"{self.base_url}/{path}"
        data = None
        headers = {}
        if self.csrf_token:
            headers["X-CSRF-TOKEN"] = self.csrf_token

        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"

        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with self.opener.open(req, timeout=15) as resp:
                status = resp.status
                raw = resp.read().decode("utf-8")
                try:
                    payload = json.loads(raw) if raw else {}
                except json.JSONDecodeError:
                    payload = {"raw": raw}
                if expected_status and status != expected_status:
                    raise AssertionError(f"Expected status {expected_status}, got {status}: {payload}")
                return status, payload
        except urllib.error.HTTPError as e:
            status = e.code
            raw = e.read().decode("utf-8")
            try:
                payload = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                payload = {"error": raw}
            if expected_status and status != expected_status:
                raise AssertionError(f"Expected status {expected_status}, got {status}: {payload}")
            return status, payload

    def get(self, path, expected_status=200):
        return self.request("GET", path, expected_status=expected_status)

    def post(self, path, body=None, expected_status=200):
        return self.request("POST", path, body, expected_status=expected_status)

def run_smoke():
    parser = argparse.ArgumentParser(description="Courtly Smoke Test")
    parser.add_argument("--no-reset", action="store_true", help="Bo qua buoc reset")
    parser.add_argument("--url", default=BASE_URL, help="Base API URL")
    args = parser.parse_args()

    print("=" * 65)
    print("🎾 BẮT ĐẦU SMOKE TEST KỊCH BẢN DEMO COURTLY")
    print("=" * 65)

    client = Client(args.url)

    # 1. Reset Demo (mặc định bật)
    step1_pass = False
    try:
        if not args.no_reset:
            # Login as admin to reset
            for pwd in ["123456", "12345"]:
                st, res = client.post("/auth/login", {"username": "admin@gmail.com", "password": pwd})
                if st == 200:
                    break
            st, res = client.post("/demo/reset", {})
            assert st == 200 and res.get("status") == "SUCCESS", f"Reset failed: {res}"
        print("[PASS] 1. Khởi tạo/Reset môi trường demo sạch sẽ")
        step1_pass = True
    except Exception as e:
        print(f"[FAIL] 1. Khởi tạo/Reset môi trường: {e}")

    # 2. Đăng nhập Admin & CSRF
    step2_pass = False
    try:
        admin_client = Client(args.url)
        st, res = admin_client.post("/auth/login", {"username": "admin@gmail.com", "password": "password123"}, expected_status=None)
        if st != 200:
            st, res = admin_client.post("/auth/login", {"username": "admin@gmail.com", "password": "password"}, expected_status=None)
        if st != 200:
            st, res = admin_client.post("/auth/login", {"username": "admin@gmail.com", "password": "123456"}, expected_status=200)
        assert res.get("role") == "ADMIN", "Not an admin account"
        print("[PASS] 2. CSRF Token & Đăng nhập Admin thành công")
        step2_pass = True
    except Exception as e:
        print(f"[FAIL] 2. Đăng nhập Admin: {e}")

    # 3. Khách mới đăng ký bằng SĐT & Nhận voucher chào mừng
    step3_pass = False
    new_phone = "0909123456"
    new_client = Client(args.url)
    welcome_code = None
    try:
        # Send OTP
        st, res = new_client.post("/auth/phone/send-otp", {"phone": new_phone, "purpose": "REGISTER"}, expected_status=200)
        dev_code = res.get("devCode")
        assert dev_code, "devCode not found in OTP response"

        # Verify OTP
        st, res = new_client.post("/auth/phone/verify", {"phone": new_phone, "code": dev_code}, expected_status=200)
        vtoken = res.get("verificationToken")
        assert vtoken, "verificationToken missing"

        # Register
        st, res = new_client.post("/auth/register", {
            "phone": new_phone,
            "name": "Khách Mới Demo",
            "email": "khachmoi@demo.vn",
            "password": "password123",
            "verificationToken": vtoken
        }, expected_status=200)

        # Check voucher
        st, vouchers = new_client.get("/vouchers/my", expected_status=200)
        welcome_vouchers = [v for v in vouchers if v.get("code", "").startswith("WELCOME-")]
        assert len(welcome_vouchers) == 1, f"Expected 1 personal welcome voucher, found {len(welcome_vouchers)}"
        assert welcome_vouchers[0].get("value") == 50000, "Voucher value should be 50,000 VND"
        welcome_code = welcome_vouchers[0]["code"]
        print(f"[PASS] 3. Khách mới đăng ký OTP nhận đúng 1 voucher cá nhân: {welcome_code}")
        step3_pass = True
    except Exception as e:
        print(f"[FAIL] 3. Khách mới đăng ký: {e}")

    # 4. Khách mới đặt sân A01 ngày mai áp voucher chào mừng
    step4_pass = False
    order_id = None
    deposit_amount = 0
    try:
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        st, overview = new_client.get(f"/overview?date={tomorrow}", expected_status=200)
        a01 = next(c for c in overview["courts"] if c["name"] == "Sân A01")
        
        # Find 2 slots from 18:00 to 19:00 (18:00-18:30, 18:30-19:00)
        slots = [s for s in overview["schedules"] if s["court"] == a01["id"] and 18.0 <= s["hour"] < 19.0]
        assert len(slots) >= 2, f"Could not find 2 slots for 18:00-19:00, found {len(slots)}"
        slot_ids = [slots[0]["id"], slots[1]["id"]]
        gross_total = slots[0]["price"] + slots[1]["price"]

        st, order_res = new_client.post("/orders", {
            "scheduleIds": slot_ids,
            "voucherCode": welcome_code,
            "requestId": f"req-smoke-4-{int(time.time())}"
        }, expected_status=200)

        order_id = order_res.get("id")
        assert order_id, "Order creation failed"
        expected_total = gross_total - 50000
        assert order_res.get("total") == expected_total or order_res.get("totalAmount") == expected_total, f"Total mismatch: {order_res}"
        deposit_amount = order_res.get("deposit") or order_res.get("depositRequired")
        expected_deposit = expected_total * 0.5
        assert deposit_amount == expected_deposit, f"Deposit mismatch: expected {expected_deposit}, got {deposit_amount}"
        print(f"[PASS] 4. Khách mới đặt A01 áp {welcome_code}: Tổng {expected_total:,.0f}₫, Cọc {deposit_amount:,.0f}₫")
        step4_pass = True
    except Exception as e:
        print(f"[FAIL] 4. Khách mới đặt sân: {e}")

    # 5. Lễ tân thu cọc tại quầy (CASH)
    step5_pass = False
    staff_client = Client(args.url)
    try:
        for pwd in ["123456", "12345"]:
            st, res = staff_client.post("/auth/login", {"username": "staff@gmail.com", "password": pwd})
            if st == 200:
                break
        assert st == 200, "Staff login failed"

        st, pay_res = staff_client.post("/payments", {
            "orderId": order_id,
            "type": "DEPOSIT",
            "method": "CASH",
            "amount": deposit_amount,
            "transactionCode": f"TX-SMOKE-DEP-{int(time.time())}"
        }, expected_status=200)

        # Check order status is now CONFIRMED
        st, ord_check = staff_client.get(f"/orders/{order_id}", expected_status=200)
        assert ord_check.get("status") == "CONFIRMED", f"Expected CONFIRMED, got {ord_check.get('status')}"
        print(f"[PASS] 5. Lễ tân thu cọc {deposit_amount:,.0f}₫ tiền mặt -> Đơn chuyển CONFIRMED")
        step5_pass = True
    except Exception as e:
        print(f"[FAIL] 5. Lễ tân thu cọc: {e}")

    # 6. demo.hoivien đặt sân A02 + dùng 500 điểm + trọng tài
    step6_pass = False
    hv_client = Client(args.url)
    hv_order_id = None
    hv_total = 0
    try:
        for pwd in ["123456", "12345"]:
            st, res = hv_client.post("/auth/login", {"username": "demo.hoivien@gmail.com", "password": pwd})
            if st == 200:
                break
        assert st == 200, "demo.hoivien login failed"
        
        # Check initial loyalty status
        st, loyalty_info = hv_client.get("/loyalty/my", expected_status=200)
        initial_points = loyalty_info.get("pointsBalance", 0)
        assert loyalty_info.get("tier") == "MASTERS", f"Expected Masters tier, got {loyalty_info.get('tier')}"

        today_str = datetime.now().strftime("%Y-%m-%d")
        st, overview = hv_client.get(f"/overview?date={today_str}", expected_status=200)
        a02 = next(c for c in overview["courts"] if c["name"] == "Sân A02")
        
        # Find 2 slots in evening on A02 (or next day if full)
        target_date = today_str
        slots = [s for s in overview["schedules"] if s["court"] == a02["id"] and 18.0 <= s["hour"] < 19.0 and s.get("status") == "AVAILABLE"]
        if len(slots) < 2:
            target_date = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
            st, overview = hv_client.get(f"/overview?date={target_date}", expected_status=200)
            slots = [s for s in overview["schedules"] if s["court"] == a02["id"] and 18.0 <= s["hour"] < 19.0]

        assert len(slots) >= 2, f"Could not find 2 available slots on A02: {slots}"
        slot_ids = [slots[0]["id"], slots[1]["id"]]
        
        # Referee
        st, ref_rates = hv_client.get("/referees", expected_status=200)
        ref_id = ref_rates[0]["id"] if ref_rates else None
        assignments = [{"scheduleId": slot_ids[0], "staffId": ref_id}] if ref_id else []

        st, hv_order = hv_client.post("/orders", {
            "scheduleIds": slot_ids,
            "pointsToUse": 500,
            "assignments": assignments,
            "requestId": f"req-smoke-6-{int(time.time())}"
        }, expected_status=200)

        hv_order_id = hv_order.get("id")
        assert hv_order.get("pointsRedeemed") == 500 or hv_order.get("pointsDiscount") == 50000, f"Points discount mismatch: {hv_order}"
        
        # Verify points balance deducted by 500
        st, loyalty_after = hv_client.get("/loyalty/my", expected_status=200)
        assert loyalty_after.get("pointsBalance") == initial_points - 500, f"Expected {initial_points - 500} pts, got {loyalty_after.get('pointsBalance')}"
        hv_total = hv_order.get("total") or hv_order.get("totalAmount")
        print(f"[PASS] 6. demo.hoivien đặt đơn dùng 500 điểm (-50.000₫): Số dư điểm trừ đúng 500")
        step6_pass = True
    except Exception as e:
        print(f"[FAIL] 6. demo.hoivien đặt đơn dùng điểm: {e}")

    # 7. Admin tất toán, check-in, check-out -> Thăng hạng GRAND_SLAM
    step7_pass = False
    vip_card_code = None
    try:
        # Collect 100% total
        st, pay_full = admin_client.post("/payments", {
            "orderId": hv_order_id,
            "type": "BALANCE",
            "method": "CASH",
            "amount": hv_total,
            "transactionCode": f"TX-SMOKE-FULL-{int(time.time())}"
        }, expected_status=200)

        # Check-in
        st, ci = admin_client.post(f"/orders/{hv_order_id}/check-in", {"reason": "Check-in demo smoke test"}, expected_status=200)

        # Check-out
        st, co = admin_client.post(f"/orders/{hv_order_id}/check-out", {}, expected_status=200)

        # Verify demo.hoivien upgraded to GRAND_SLAM
        st, hv_loyalty = hv_client.get("/loyalty/my", expected_status=200)
        assert hv_loyalty.get("tier") == "GRAND_SLAM", f"Expected GRAND_SLAM tier, got {hv_loyalty.get('tier')}"

        # Verify VIP card created
        vip_card_code = hv_loyalty.get("vipCardCode")
        assert vip_card_code and vip_card_code.startswith("VIP-"), f"VIP card missing: {hv_loyalty}"

        # Verify Grand Slam upgrade voucher received
        st, hv_vouchers = hv_client.get("/vouchers/my", expected_status=200)
        gs_vouchers = [v for v in hv_vouchers if v.get("code", "").startswith("GS-") or v.get("source") == "TIER_UPGRADE"]
        assert len(gs_vouchers) >= 1, "Upgrade voucher GS- missing"
        print(f"[PASS] 7. Tất toán & Checkout -> Thăng hạng GRAND_SLAM, cấp thẻ {vip_card_code} & Voucher 300k")
        step7_pass = True
    except Exception as e:
        print(f"[FAIL] 7. Check-in/Check-out thăng hạng: {e}")

    # 8. Lễ tân quét thẻ VIP Lounge
    step8_pass = False
    try:
        st, scan_res = staff_client.post("/loyalty/vip-lounge/scan", {"code": vip_card_code}, expected_status=200)
        assert scan_res.get("success") == True or scan_res.get("valid") == True, f"Scan VIP failed: {scan_res}"
        print(f"[PASS] 8. Lễ tân quét thẻ VIP Lounge {vip_card_code} -> 200 OK hợp lệ")
        step8_pass = True
    except Exception as e:
        print(f"[FAIL] 8. Quét thẻ VIP Lounge: {e}")

    # 9. Admin tạo chiến dịch truyền thông (BANNER)
    step9_pass = False
    try:
        camp_name = f"Chiến dịch Smoke Banner {int(time.time())}"
        st, camp_res = admin_client.post("/admin/campaigns", {
            "name": camp_name,
            "description": "Chiến dịch kiểm thử tự động",
            "audience": "NEAR_NEXT_TIER",
            "channels": "BANNER",
            "bannerText": "Ưu đãi chào đón hội viên Grand Slam!",
            "status": "RUNNING"
        }, expected_status=200)
        assert camp_res.get("id"), "Campaign creation failed"
        print(f"[PASS] 9. Admin tạo chiến dịch kênh BANNER thành công: {camp_name}")
        step9_pass = True
    except Exception as e:
        print(f"[FAIL] 9. Tạo chiến dịch BANNER: {e}")

    # 10. Voucher có điều kiện khung giờ bị từ chối khi đặt ngoài giờ
    step10_pass = False
    try:
        # Create a voucher valid only from 10:00 to 15:00
        v_code = f"GOLDEN{int(time.time()) % 10000}"
        st, v_res = admin_client.post("/admin/vouchers", {
            "code": v_code,
            "type": "FIXED",
            "value": 30000,
            "validFromTime": "10:00:00",
            "validToTime": "15:00:00",
            "startsAt": datetime.now().isoformat(),
            "expiresAt": (datetime.now() + timedelta(days=10)).isoformat(),
            "usageLimit": 100
        }, expected_status=200)

        # Try to apply this golden voucher to an 18:00 slot (outside 10:00-15:00)
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        st, overview = admin_client.get(f"/overview?date={tomorrow}", expected_status=200)
        evening_slot = next(s for s in overview["schedules"] if s["hour"] >= 18.0)
        
        st, err_order = new_client.post("/orders", {
            "scheduleIds": [evening_slot["id"]],
            "voucherCode": v_code,
            "requestId": f"req-smoke-10-{int(time.time())}"
        }, expected_status=None)
        
        # Must be rejected (e.g. 400 or business error)
        assert st in [400, 422] or (st == 200 and "error" in err_order), f"Golden voucher was unexpectedly accepted for evening slot: status {st}"
        print(f"[PASS] 10. Voucher giới hạn khung giờ (10:00–15:00) bị từ chối chuẩn khi đặt buổi tối (18:00)")
        step10_pass = True
    except Exception as e:
        print(f"[FAIL] 10. Voucher giới hạn khung giờ: {e}")

    print("=" * 65)
    results = [step1_pass, step2_pass, step3_pass, step4_pass, step5_pass, step6_pass, step7_pass, step8_pass, step9_pass, step10_pass]
    pass_count = sum(1 for r in results if r)
    print(f"KẾT QUẢ TỔNG HỢP: {pass_count}/10 BƯỚC ĐẠT (PASS)")
    if pass_count == 10:
        print("🎉 TẤT CẢ KỊCH BẢN DEMO ĐỀU VƯỢT QUA (ALL PASS)")
        sys.exit(0)
    else:
        print("❌ CÓ BƯỚC THẤT BẠI, KIỂM TRA LẠI DỮ LIỆU")
        sys.exit(1)

if __name__ == "__main__":
    run_smoke()

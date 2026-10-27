@echo off
chcp 65001 > nul
echo ==========================================================
echo 🌱 COURTLY TENNIS CLUB - RESET DỮ LIỆU SHOWCASE HỘI ĐỒNG
echo ==========================================================
python "%~dp0seed_showcase.py"
echo.
echo ✅ Đã hoàn tất! Nhấn phím bất kỳ để đóng...
pause > nul

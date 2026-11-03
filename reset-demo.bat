@echo off
chcp 65001 > nul
title Courtly - Khoi Phuc Du Lieu Demo Ban Dau

echo ====================================================================
echo  Courtly Tennis Club - Script Khoi Phuc Du Lieu Demo Ban Dau
echo ====================================================================
echo.

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Python tren may! Vui long cai dat Python de chay script.
    echo.
    pause
    exit /b 1
)

python "%~dp0scripts\seed_showcase.py"

if %errorlevel% equ 0 (
    echo.
    echo [THANH CONG] Da khoi phuc toan bo du lieu demo ban dau!
    echo Ban hay mo trinh duyet va tai lai trang (F5) de xem ket qua.
) else (
    echo.
    echo [THAT BAI] Co loi xay ra trong qua trinh khoi phuc du lieu.
)

echo.
pause

# ==============================================================
# Courtly Tennis Club - Script Reset Dữ Liệu Trình Diễn Hội Đồng
# ==============================================================
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "🌱 COURTLÝ TENNIS CLUB - RESET DỮ LIỆU SHOWCASE HỘI ĐỒNG" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    Write-Host "❌ Không tìm thấy Python trên máy. Vui lòng cài đặt Python." -ForegroundColor Red
    exit 1
}

$scriptPath = Join-Path $PSScriptRoot "seed_showcase.py"
python $scriptPath

Write-Host "`n✅ Đã reset thành công! Hãy tải lại trang web (F5) để kiểm tra." -ForegroundColor Green

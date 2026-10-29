# Courtly Tennis Club - Script Khoi Phuc Du Lieu Demo Ban Dau
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  COURTLY TENNIS CLUB - KHOI PHUC DU LIEU DEMO BAN DAU" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""

$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    Write-Host "[LOI] Khong tim thay Python tren he thong. Vui long cai dat Python." -ForegroundColor Red
    exit 1
}

$scriptPath = Join-Path $PSScriptRoot "scripts\seed_showcase.py"
python $scriptPath

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[THANH CONG] Da khoi phuc toan bo du lieu demo ban dau!" -ForegroundColor Green
    Write-Host "Hay tai lai trang web (F5) tai http://localhost:3000 de kiem tra." -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "[THAT BAI] Co loi xay ra trong qua trinh khoi phuc du lieu." -ForegroundColor Red
    Write-Host ""
}

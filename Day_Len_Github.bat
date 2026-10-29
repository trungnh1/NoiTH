@echo off
chcp 65001 >nul
title Đẩy mã nguồn lên GitHub - NoiTH
cd /d "%~dp0"
echo ============================================================
echo   ĐANG ĐẨY MÃ NGUỒN DỰ ÁN NoiTH LÊN GITHUB...
echo   Repository: https://github.com/trungnh1/NoiTH
echo ============================================================
echo.
"C:\Program Files\Git\cmd\git.exe" push origin main
echo.
echo ============================================================
echo   Hoàn tất! Nếu thành công, mã nguồn đã lên GitHub.
echo ============================================================
pause

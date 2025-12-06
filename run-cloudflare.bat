@echo off
REM Запуск Cloudflare Tunnel для Web App

echo.
echo ========================================
echo   🌐 DANISA SHOP - Cloudflare Tunnel
echo ========================================
echo.

REM Проверяем, установлен ли cloudflared
where cloudflared >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ cloudflared не найден
    echo.
    echo Способы установки:
    echo 1. Скачайте отсюда: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
    echo 2. Распакуйте cloudflared.exe в C:\Program Files или добавьте в PATH
    echo 3. Или скопируйте cloudflared.exe в текущую папку
    echo.
    pause
    exit /b 1
)

echo ✅ Запускаю Cloudflare Tunnel...
echo.
echo 📝 Когда увидите URL:
echo    1. Скопируйте его (например: https://abc123.trycloudflare.com)
echo    2. Обновите файл .env: SERVER_URL=https://abc123.trycloudflare.com
echo    3. Перезагрузите сервер Node.js
echo.

cloudflared tunnel --url http://localhost:3000

pause

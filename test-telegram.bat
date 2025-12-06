@echo off
REM Скрипт для тестирования Telegram бота

setlocal enabledelayedexpansion

set TOKEN=8232572053:AAF5zxkQ-EpEAAkQPw_FUYQnO45PdfkrwB8
set CHAT_ID=7855745005

echo.
echo ========================================
echo   🧪 Тест Telegram Бота
echo ========================================
echo.

echo 1️⃣  Проверка getMe (информация о боте):
curl "https://api.telegram.org/bot%TOKEN%/getMe"

echo.
echo 2️⃣  Проверка getUpdates (последние сообщения):
curl "https://api.telegram.org/bot%TOKEN%/getUpdates"

echo.
echo 3️⃣  Отправка тестового сообщения:
curl "https://api.telegram.org/bot%TOKEN%/sendMessage?chat_id=%CHAT_ID%&text=Test%%20Message%%20from%%20Server"

echo.
echo ========================================
echo   ✅ Тест завершен
echo ========================================
echo.
echo Если видите результаты в JSON - бот работает!
echo.

pause

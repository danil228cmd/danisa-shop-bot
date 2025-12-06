@echo off
REM Скрипт для быстрой отправки на GitHub

echo.
echo ========================================
echo   📤 Отправка проекта на GitHub
echo ========================================
echo.

echo 1️⃣  Проверяю наличие git...
where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Git не установлен
    echo Скачайте отсюда: https://git-scm.com/download/win
    pause
    exit /b 1
)

echo ✅ Git найден

echo.
echo 2️⃣  Инициализирую репозиторий...
git init

echo.
echo 3️⃣  Добавляю файлы...
git add .

echo.
echo 4️⃣  Создаю коммит...
git commit -m "Initial commit: DANISA SHOP Telegram Bot"

echo.
echo ========================================
echo   ⚙️  Следующие шаги:
echo ========================================
echo.
echo 1. Создайте репозиторий на GitHub: https://github.com/new
echo.
echo 2. Скопируйте команду ниже и выполните в PowerShell:
echo.
echo    git remote add origin https://github.com/ВАШ_ЛОГИН/danisa-shop-bot.git
echo    git branch -M main
echo    git push -u origin main
echo.
echo 3. Замените "ВАШ_ЛОГИН" на ваш GitHub логин
echo.

pause

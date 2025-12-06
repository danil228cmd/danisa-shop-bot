@echo off
REM Запуск ngrok для создания публичного URL
REM Убедитесь, что ngrok.exe находится в PATH или в текущей папке

echo.
echo ========================================
echo   🌐 DANISA SHOP - Запуск ngrok
echo ========================================
echo.

REM Проверяем, установлен ли ngrok в PATH
where ngrok >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ ngrok не найден в PATH
    echo.
    echo Способы установки:
    echo 1. Скачайте ngrok с https://ngrok.com/download
    echo 2. Распакуйте в C:\ngrok или добавьте в PATH
    echo 3. Или скопируйте ngrok.exe в эту папку
    echo.
    pause
    exit /b 1
)

echo ✅ Запускаю ngrok на порту 3000...
echo.
echo Скопируйте URL из вывода ниже и вставьте в setup-telegram.ps1
echo.

ngrok http 3000

pause

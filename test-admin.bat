@echo off
echo ========================================
echo Тест админ панели
echo ========================================
echo.
echo Запускаю сервер...
echo.
start http://localhost:3000/admin/
node server.js

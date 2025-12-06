# Telegram Bot Webhook Setup Script
# Это скрипт для установки Webhook'а бота в Telegram

# Переменные
$TOKEN = "8232572053:AAF5zxkQ-EpEAAkQPw_FUYQnO45PdfkrwB8"
$WEBHOOK_URL = Read-Host "Введите публичный URL из ngrok (например: https://abc123.ngrok.io)"
$WEBHOOK_PATH = "/telegram"

# Полный Webhook URL
$FULL_WEBHOOK = "$WEBHOOK_URL$WEBHOOK_PATH"

Write-Host "🔧 Устанавливаю Webhook для бота..." -ForegroundColor Cyan
Write-Host "Webhook URL: $FULL_WEBHOOK" -ForegroundColor Yellow

# API запрос для установки Webhook
$setWebhookUrl = "https://api.telegram.org/bot$TOKEN/setWebhook?url=$([System.Uri]::EscapeDataString($FULL_WEBHOOK))"

try {
    $response = Invoke-RestMethod -Uri $setWebhookUrl -Method Get
    
    if ($response.ok) {
        Write-Host "✅ Webhook успешно установлен!" -ForegroundColor Green
        Write-Host "Webhook URL: $FULL_WEBHOOK" -ForegroundColor Green
        Write-Host ""
        Write-Host "Теперь вы можете тестировать бота в Telegram:" -ForegroundColor Cyan
        Write-Host "- /start - открыть магазин" -ForegroundColor White
        Write-Host "- /admin - админ-панель (только для админа)" -ForegroundColor White
    } else {
        Write-Host "❌ Ошибка установки Webhook:" -ForegroundColor Red
        Write-Host $response.description -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Ошибка при установке Webhook: $_" -ForegroundColor Red
}

# Информация о ngrok
Write-Host ""
Write-Host "ℹ️  Как запустить ngrok:" -ForegroundColor Cyan
Write-Host "1. Скачайте ngrok с https://ngrok.com/download" -ForegroundColor White
Write-Host "2. Распакуйте в любую папку" -ForegroundColor White
Write-Host "3. Откройте PowerShell в папке с ngrok.exe" -ForegroundColor White
Write-Host "4. Запустите: .\ngrok http 3000" -ForegroundColor Yellow
Write-Host "5. Скопируйте URL из вывода (например: https://abc123.ngrok.io)" -ForegroundColor White

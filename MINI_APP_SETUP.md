# Telegram Mini App Setup with Cloudflare Tunnel

## Что нужно сделать для настройки Web App в Telegram

### Способ 1: Cloudflare Tunnel (РЕКОМЕНДУЕТСЯ - Бесплатно и просто)

1. **Скачайте Cloudflare Tunnel:**
   - Перейдите на: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
   - Скачайте для Windows (cloudflared.exe)
   - Положите в папку c:\shop

2. **Запустите туннель:**
   ```powershell
   cd c:\shop
   .\cloudflared tunnel --url http://localhost:3000
   ```

3. **Скопируйте URL** из вывода (будет выглядеть как `https://something.trycloudflare.com`)

4. **Установите Webhook для бота** (замените URL):
   ```powershell
   $URL = "https://something.trycloudflare.com"
   curl "https://api.telegram.org/bot8232572053:AAF5zxkQ-EpEAAkQPw_FUYQnO45PdfkrwB8/setWebhook?url=$URL/telegram"
   ```

5. **Обновите `.env` файл:**
   ```
   SERVER_URL=https://something.trycloudflare.com
   ```

6. **Перезагрузите сервер** и тестируйте!

---

### Способ 2: Локальный SSL (для полной локальной разработки)

Если у вас установлен OpenSSL:

```powershell
# Сгенерируйте сертификат
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"

# Сервер будет использовать HTTPS на localhost:3000
# Но Telegram все равно требует публичный HTTPS
```

---

## Как это работает

```
Ты в Telegram
    ↓
Жмешь кнопку "Открыть магазин"
    ↓
Откроется Mini App (Web App внутри Telegram)
    ↓
Это будет наш магазин (http://localhost:3000/miniapp)
    ↓
Через Cloudflare это доступно как https://xxx.trycloudflare.com/miniapp
```

---

## Быстрый старт (3 шага)

1. Скачайте cloudflared.exe
2. Запустите: `.\cloudflared tunnel --url http://localhost:3000`
3. Скопируйте URL и вставьте в `.env` как `SERVER_URL`

Готово! 🚀

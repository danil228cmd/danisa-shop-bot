const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Используйте этот файл для локального тестирования бота
// Для production — интегрируйте с server.js

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN не установлен в .env файле');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

console.log('🤖 Telegram Bot запущен (polling mode)');

// Команда /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const keyboard = {
    reply_markup: {
      keyboard: [
        [{
          text: '🛍️ Открыть магазин',
          web_app: { url: `${SERVER_URL}/miniapp/index.html` }
        }],
        [{
          text: '⚙️ Админ панель',
          web_app: { url: `${SERVER_URL}/admin/index.html` }
        }]
      ],
      resize_keyboard: true
    }
  };

  bot.sendMessage(chatId, 'Добро пожаловать в DANISA SHOP! 👕👔\n\nВыберите действие:', keyboard);
});

// Команда /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpText = `
📱 <b>DANISA SHOP BOT</b>

Доступные команды:
/start - Начать работу с ботом
/help - Показать эту справку

Функции:
🛍️ <b>Магазин</b> - Смотрите каталог товаров, добавляйте в корзину, оформляйте заказы
⚙️ <b>Админ панель</b> - Управление категориями, товарами и просмотр заказов

📞 <b>Контакты:</b>
Для вопросов обращайтесь к администратору
  `;

  bot.sendMessage(chatId, helpText, { parse_mode: 'HTML' });
});

// Обработка ошибок
bot.on('polling_error', (error) => {
  console.error('🔴 Ошибка polling:', error);
});

bot.on('error', (error) => {
  console.error('🔴 Ошибка бота:', error);
});

console.log('✅ Бот готов к работе');

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Load .env file
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=');
      if (key) {
        process.env[key.trim()] = value.trim();
      }
    }
  });
}

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '';
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID || '';
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;
const USE_POLLING = process.env.USE_POLLING !== 'false'; // Включить polling по умолчанию

// === DATA STORAGE (JSON FILES) ===
const DATA_DIR = path.join(__dirname, 'data');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const SUBCATEGORIES_FILE = path.join(DATA_DIR, 'subcategories.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const CARTS_FILE = path.join(DATA_DIR, 'carts.json');

// Initialize data directory
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
}

// Helper functions to read/write JSON
const readJSON = (file, defaultValue = []) => {
  try {
    if (!fs.existsSync(file)) {
      return defaultValue;
    }
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return defaultValue;
  }
};

const writeJSON = (file, data) => {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
};

// Load all data
let categories = readJSON(CATEGORIES_FILE, []);
let subcategories = readJSON(SUBCATEGORIES_FILE, []);
let products = readJSON(PRODUCTS_FILE, []);
let orders = readJSON(ORDERS_FILE, []);
let carts = readJSON(CARTS_FILE, {});

// Auto-save after changes
const saveAll = () => {
  writeJSON(CATEGORIES_FILE, categories);
  writeJSON(SUBCATEGORIES_FILE, subcategories);
  writeJSON(PRODUCTS_FILE, products);
  writeJSON(ORDERS_FILE, orders);
  writeJSON(CARTS_FILE, carts);
};

// === HELPERS ===

const serveFile = (res, filePath, contentType = 'text/html') => {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
};

const sendJSON = (res, statusCode, data) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};

const parseBody = (req, callback) => {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  req.on('end', () => {
    try {
      const data = body ? JSON.parse(body) : {};
      callback(null, data);
    } catch (e) {
      callback(e);
    }
  });
};

const getNextId = (arr) => {
  return arr.length === 0 ? 1 : Math.max(...arr.map(item => item.id)) + 1;
};

// === TELEGRAM BOT NOTIFICATION ===

const sendTelegramMessage = (text) => {
  if (!TELEGRAM_TOKEN || !ADMIN_CHAT_ID) return;

  const message = {
    chat_id: ADMIN_CHAT_ID,
    text: text,
    parse_mode: 'HTML'
  };

  sendTelegramRequest('/sendMessage', message);
};

const sendTelegramRequest = (method, data) => {
  if (!TELEGRAM_TOKEN) return;

  const postData = JSON.stringify(data);

  const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${TELEGRAM_TOKEN}${method}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = https.request(options, (res) => {
    let responseData = '';
    res.on('data', chunk => { responseData += chunk; });
    res.on('end', () => {
      try {
        const parsed = JSON.parse(responseData);
        if (!parsed.ok) {
          console.error(`[Telegram] Ошибка ${method}:`, parsed.description);
        }
      } catch (e) {
        // Silent fail
      }
    });
  });

  req.on('error', (e) => {
    console.error('[Telegram] Ошибка соединения:', e.message);
  });

  req.write(postData);
  req.end();
};

// === TELEGRAM MESSAGE HANDLER ===

const handleTelegramMessage = (msg) => {
  if (!msg) return;

  const chatId = msg.chat.id;
  const text = msg.text;
  const userId = msg.from.id;
  const firstName = msg.from.first_name || 'User';

  // /start command
  if (text === '/start') {
    const message = {
      chat_id: chatId,
      text: `👋 Привет, ${firstName}!\n\nДобро пожаловать в DANISA SHOP! 🛍️\n\nОткройте магазин по ссылке ниже:\n${SERVER_URL}/miniapp/`,
      parse_mode: 'HTML'
    };

    sendTelegramRequest('/sendMessage', message);
  }

  // /admin command - shows admin menu only for admin user
  if (text === '/admin') {
    if (userId.toString() === ADMIN_TELEGRAM_ID.toString()) {
      const message = {
        chat_id: chatId,
        text: `🔐 Добро пожаловать, администратор!\n\nАдмин-панель: ${SERVER_URL}/admin/\n\nВойдите с паролем: <b>admin123</b>`,
        parse_mode: 'HTML'
      };

      sendTelegramRequest('/sendMessage', message);
    } else {
      const message = {
        chat_id: chatId,
        text: '❌ У вас нет доступа к админ-панели.'
      };

      sendTelegramRequest('/sendMessage', message);
    }
  }
};

// === TELEGRAM POLLING ===

let lastUpdateId = 0;

const telegramPolling = () => {
  if (!TELEGRAM_TOKEN) return;

  const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${TELEGRAM_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`,
    method: 'GET'
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        if (result.ok && result.result && result.result.length > 0) {
          result.result.forEach(update => {
            lastUpdateId = Math.max(lastUpdateId, update.update_id);
            if (update.message) {
              handleTelegramMessage(update.message);
            }
          });
        }
      } catch (e) {
        console.error('[Telegram Polling] Ошибка парсинга:', e.message);
      }
      
      // Continue polling
      setTimeout(telegramPolling, 1000);
    });
  });

  req.on('error', (e) => {
    console.error('[Telegram Polling] Ошибка:', e.message);
    setTimeout(telegramPolling, 5000);
  });

  req.end();
};

// === REQUEST HANDLER ===

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  console.log(`${req.method} ${pathname}`);

  // === STATIC FILES ===
  if (pathname === '/' || pathname === '/miniapp/' || pathname === '/miniapp/index.html') {
    serveFile(res, path.join(__dirname, 'public', 'miniapp', 'index.html'));
    return;
  }

  if (pathname === '/admin/' || pathname === '/admin/index.html') {
    serveFile(res, path.join(__dirname, 'public', 'admin', 'index.html'));
    return;
  }

  if (pathname.startsWith('/uploads/')) {
    const filePath = path.join(__dirname, 'uploads', pathname.substring(9));
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif'
      }[ext] || 'image/jpeg';

      serveFile(res, filePath, contentType);
      return;
    }
  }

  // === API ROUTES ===

  // GET /api/categories
  if (pathname === '/api/categories' && req.method === 'GET') {
    sendJSON(res, 200, categories);
    return;
  }

  // POST /api/categories
  if (pathname === '/api/categories' && req.method === 'POST') {
    parseBody(req, (err, data) => {
      if (data.password !== ADMIN_PASSWORD) {
        sendJSON(res, 401, { error: 'Неверный пароль' });
        return;
      }

      const category = {
        id: getNextId(categories),
        name: data.name,
        created_at: new Date().toISOString()
      };

      categories.push(category);
      saveAll();
      sendJSON(res, 200, { id: category.id, name: category.name });
    });
    return;
  }

  // DELETE /api/categories/:id
  if (pathname.match(/^\/api\/categories\/\d+$/) && req.method === 'DELETE') {
    const id = parseInt(pathname.split('/')[3]);
    parseBody(req, (err, data) => {
      if (data.password !== ADMIN_PASSWORD) {
        sendJSON(res, 401, { error: 'Неверный пароль' });
        return;
      }

      categories = categories.filter(c => c.id !== id);
      subcategories = subcategories.filter(s => s.category_id !== id);
      saveAll();
      sendJSON(res, 200, { success: true });
    });
    return;
  }

  // GET /api/subcategories (все подкатегории)
  if (pathname === '/api/subcategories' && req.method === 'GET') {
    sendJSON(res, 200, subcategories);
    return;
  }

  // GET /api/subcategories/:categoryId
  if (pathname.match(/^\/api\/subcategories\/\d+$/) && req.method === 'GET') {
    const categoryId = parseInt(pathname.split('/')[3]);
    const filtered = subcategories.filter(s => s.category_id === categoryId);
    sendJSON(res, 200, filtered);
    return;
  }

  // POST /api/subcategories
  if (pathname === '/api/subcategories' && req.method === 'POST') {
    parseBody(req, (err, data) => {
      if (data.password !== ADMIN_PASSWORD) {
        sendJSON(res, 401, { error: 'Неверный пароль' });
        return;
      }

      const subcategory = {
        id: getNextId(subcategories),
        category_id: data.categoryId,
        name: data.name,
        created_at: new Date().toISOString()
      };

      subcategories.push(subcategory);
      saveAll();
      sendJSON(res, 200, { id: subcategory.id, name: subcategory.name });
    });
    return;
  }

  // DELETE /api/subcategories/:id
  if (pathname.match(/^\/api\/subcategories\/\d+$/) && req.method === 'DELETE') {
    const id = parseInt(pathname.split('/')[3]);
    parseBody(req, (err, data) => {
      if (data.password !== ADMIN_PASSWORD) {
        sendJSON(res, 401, { error: 'Неверный пароль' });
        return;
      }

      subcategories = subcategories.filter(s => s.id !== id);
      saveAll();
      sendJSON(res, 200, { success: true });
    });
    return;
  }

  // GET /api/products
  if (pathname === '/api/products' && req.method === 'GET') {
    let filtered = [...products];

    if (query.subcategoryId) {
      const subcategoryId = parseInt(query.subcategoryId);
      filtered = filtered.filter(p => p.subcategory_id === subcategoryId);
    }

    sendJSON(res, 200, filtered);
    return;
  }

  // GET /api/products/:id
  if (pathname.match(/^\/api\/products\/\d+$/) && req.method === 'GET') {
    const id = parseInt(pathname.split('/')[3]);
    const product = products.find(p => p.id === id);

    if (!product) {
      sendJSON(res, 404, { error: 'Товар не найден' });
      return;
    }

    sendJSON(res, 200, product);
    return;
  }

  // POST /api/products
  if (pathname === '/api/products' && req.method === 'POST') {
    parseBody(req, (err, data) => {
      if (data.password !== ADMIN_PASSWORD) {
        sendJSON(res, 401, { error: 'Неверный пароль' });
        return;
      }

      const product = {
        id: getNextId(products),
        subcategory_id: data.subcategoryId,
        name: data.name,
        description: data.description || '',
        price: parseFloat(data.price),
        images: [],
        created_at: new Date().toISOString()
      };

      products.push(product);
      saveAll();
      sendJSON(res, 200, { id: product.id, name: product.name });
    });
    return;
  }

  // PUT /api/products/:id
  if (pathname.match(/^\/api\/products\/\d+$/) && req.method === 'PUT') {
    const id = parseInt(pathname.split('/')[3]);
    parseBody(req, (err, data) => {
      if (data.password !== ADMIN_PASSWORD) {
        sendJSON(res, 401, { error: 'Неверный пароль' });
        return;
      }

      const product = products.find(p => p.id === id);
      if (!product) {
        sendJSON(res, 404, { error: 'Товар не найден' });
        return;
      }

      product.name = data.name || product.name;
      product.description = data.description || product.description;
      product.price = parseFloat(data.price) || product.price;

      saveAll();
      sendJSON(res, 200, { success: true });
    });
    return;
  }

  // DELETE /api/products/:id
  if (pathname.match(/^\/api\/products\/\d+$/) && req.method === 'DELETE') {
    const id = parseInt(pathname.split('/')[3]);
    parseBody(req, (err, data) => {
      if (data.password !== ADMIN_PASSWORD) {
        sendJSON(res, 401, { error: 'Неверный пароль' });
        return;
      }

      products = products.filter(p => p.id !== id);
      saveAll();
      sendJSON(res, 200, { success: true });
    });
    return;
  }

  // GET /api/cart/:userId
  if (pathname.match(/^\/api\/cart\/\d+$/) && req.method === 'GET') {
    const userId = pathname.split('/')[3];
    const cart = carts[userId] || { items: [] };
    sendJSON(res, 200, cart);
    return;
  }

  // POST /api/cart/:userId
  if (pathname.match(/^\/api\/cart\/\d+$/) && req.method === 'POST') {
    const userId = pathname.split('/')[3];
    parseBody(req, (err, data) => {
      carts[userId] = { items: data.items || [] };
      saveAll();
      sendJSON(res, 200, { success: true });
    });
    return;
  }

  // GET /api/orders
  if (pathname === '/api/orders' && req.method === 'GET') {
    if (query.password !== ADMIN_PASSWORD) {
      sendJSON(res, 401, { error: 'Неверный пароль' });
      return;
    }

    sendJSON(res, 200, orders);
    return;
  }

  // GET /api/orders/:id
  if (pathname.match(/^\/api\/orders\/\d+$/) && req.method === 'GET') {
    if (query.password !== ADMIN_PASSWORD) {
      sendJSON(res, 401, { error: 'Неверный пароль' });
      return;
    }

    const id = parseInt(pathname.split('/')[3]);
    const order = orders.find(o => o.id === id);

    if (!order) {
      sendJSON(res, 404, { error: 'Заказ не найден' });
      return;
    }

    sendJSON(res, 200, order);
    return;
  }

  // POST /api/orders
  if (pathname === '/api/orders' && req.method === 'POST') {
    parseBody(req, (err, data) => {
      const order = {
        id: getNextId(orders),
        telegram_user_id: data.telegramUserId,
        username: data.username,
        contact: data.contact,
        total_price: data.totalPrice,
        items: data.items || [],
        status: 'new',
        created_at: new Date().toISOString()
      };

      orders.push(order);
      saveAll();

      // Send Telegram notification
      let orderText = `📦 <b>Новый заказ #${order.id}</b>\n\n`;
      orderText += `👤 <b>Пользователь:</b> @${order.username}\n`;
      orderText += `📞 <b>Контакт:</b> ${order.contact}\n`;
      orderText += `💰 <b>Сумма:</b> ${order.total_price}₽\n\n`;
      orderText += `<b>Товары:</b>\n`;

      order.items.forEach((item, idx) => {
        orderText += `${idx + 1}. ${item.name} x${item.quantity} = ${item.price * item.quantity}₽\n`;
      });

      sendTelegramMessage(orderText);

      sendJSON(res, 200, { id: order.id, status: 'success' });
    });
    return;
  }

  // POST /telegram - Webhook for Telegram Bot
  if (pathname === '/telegram' && req.method === 'POST') {
    parseBody(req, (err, update) => {
      if (update.message) {
        handleTelegramMessage(update.message);
      }

      sendJSON(res, 200, { ok: true });
    });
    return;
  }

  // 404
  sendJSON(res, 404, { error: 'Route not found' });
});

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║       🚀 DANISA SHOP БЕЗ npm          ║
╚════════════════════════════════════════╝

✅ Сервер запущен на PORT ${PORT}

📱 Магазин (Mini App):
   http://localhost:${PORT}/miniapp/

⚙️  Админ панель:
   http://localhost:${PORT}/admin/

📊 Данные хранятся в папке: ./data/

🔐 Пароль администратора: ${ADMIN_PASSWORD}

Нажмите Ctrl+C для остановки
  `);
});

console.log('📋 Конфигурация:');
console.log(`  TELEGRAM_BOT_TOKEN: ${TELEGRAM_TOKEN ? '✓ установлен' : '✗ не установлен'}`);
console.log(`  ADMIN_CHAT_ID: ${ADMIN_CHAT_ID || '✗ не установлен'}`);
console.log(`  ADMIN_TELEGRAM_ID: ${ADMIN_TELEGRAM_ID || '✗ не установлен'}`);
console.log(`  SERVER_URL: ${SERVER_URL}`);

// Start Telegram bot polling if enabled
if (USE_POLLING && TELEGRAM_TOKEN) {
  console.log('\n🤖 Запуск Telegram бота (polling)...');
  console.log('   ✓ Бот готов принимать сообщения');
  console.log('   Команды: /start, /admin');
  setTimeout(telegramPolling, 1000);
}

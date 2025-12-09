// ГИБРИДНАЯ ВЕРСИЯ: работает с PostgreSQL (если есть) или JSON файлами
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Загрузка .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=');
      if (key) process.env[key.trim()] = value.trim();
    }
  });
}

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '';
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID || '';
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;

// Проверяем наличие PostgreSQL (DATABASE_PUBLIC_URL или DATABASE_URL)
const DATABASE_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const USE_POSTGRES = !!DATABASE_URL;
let dbModule = null;

if (USE_POSTGRES) {
  try {
    dbModule = require('./db/postgres');
    console.log('✅ Используется PostgreSQL');
  } catch (e) {
    console.error('❌ Ошибка загрузки PostgreSQL модуля:', e.message);
    process.exit(1);
  }
}

// JSON хранилище (fallback)
const DATA_DIR = path.join(__dirname, 'data');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const SUBCATEGORIES_FILE = path.join(DATA_DIR, 'subcategories.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const CARTS_FILE = path.join(DATA_DIR, 'carts.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
}

const readJSON = (file, defaultValue = []) => {
  try {
    if (!fs.existsSync(file)) return defaultValue;
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return defaultValue;
  }
};

const writeJSON = (file, data) => {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
};

// JSON данные
let categories = [];
let subcategories = [];
let products = [];
let orders = [];
let carts = {};

// Загрузка данных
const loadData = async () => {
  if (USE_POSTGRES) {
    await dbModule.initDatabase();
  } else {
    categories = readJSON(CATEGORIES_FILE, []);
    subcategories = readJSON(SUBCATEGORIES_FILE, []);
    products = readJSON(PRODUCTS_FILE, []);
    orders = readJSON(ORDERS_FILE, []);
    carts = readJSON(CARTS_FILE, {});
  }
};

const saveAll = () => {
  if (!USE_POSTGRES) {
    writeJSON(CATEGORIES_FILE, categories);
    writeJSON(SUBCATEGORIES_FILE, subcategories);
    writeJSON(PRODUCTS_FILE, products);
    writeJSON(ORDERS_FILE, orders);
    writeJSON(CARTS_FILE, carts);
  }
};

const saveBase64Image = (imageData) => {
  try {
    if (!imageData || !imageData.startsWith('data:image')) return '';
    // Просто возвращаем base64 - будем хранить в базе данных
    // Это решает проблему с пропаданием изображений на Railway
    return imageData;
  } catch (e) {
    console.error('Ошибка обработки изображения:', e.message);
    return '';
  }
};

const getNextId = (arr) => {
  return arr.length === 0 ? 1 : Math.max(...arr.map(item => item.id)) + 1;
};

// Валидация данных
const validateProduct = (data) => {
  const errors = [];
  if (!data.name || data.name.trim().length === 0) errors.push('Название обязательно');
  if (data.name && data.name.length > 200) errors.push('Название слишком длинное (макс 200 символов)');
  if (!data.price || isNaN(data.price) || data.price <= 0) errors.push('Цена должна быть больше 0');
  if (data.price > 1000000) errors.push('Цена слишком большая');
  if (data.description && data.description.length > 1000) errors.push('Описание слишком длинное (макс 1000 символов)');
  return errors;
};

const validateCategory = (data) => {
  const errors = [];
  if (!data.name || data.name.trim().length === 0) errors.push('Название обязательно');
  if (data.name && data.name.length > 100) errors.push('Название слишком длинное (макс 100 символов)');
  return errors;
};

const validateOrder = (data) => {
  const errors = [];
  if (!data.contact || data.contact.trim().length === 0) errors.push('Контакт обязателен');
  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) errors.push('Корзина пуста');
  if (!data.totalPrice || data.totalPrice <= 0) errors.push('Неверная сумма заказа');
  return errors;
};

// === API WRAPPER ===
const API = {
  async getCategories() {
    if (USE_POSTGRES) return await dbModule.db.getCategories();
    return categories;
  },
  
  async createCategory(name) {
    if (USE_POSTGRES) return await dbModule.db.createCategory(name);
    const cat = { id: getNextId(categories), name, created_at: new Date().toISOString() };
    categories.push(cat);
    saveAll();
    return cat;
  },
  
  async deleteCategory(id) {
    if (USE_POSTGRES) return await dbModule.db.deleteCategory(id);
    categories = categories.filter(c => c.id !== id);
    subcategories = subcategories.filter(s => s.category_id !== id);
    saveAll();
  },
  
  async getSubcategories(categoryId = null) {
    if (USE_POSTGRES) return await dbModule.db.getSubcategories(categoryId);
    if (categoryId) return subcategories.filter(s => parseInt(s.category_id) === parseInt(categoryId));
    return subcategories;
  },
  
  async createSubcategory(categoryId, name) {
    if (USE_POSTGRES) return await dbModule.db.createSubcategory(categoryId, name);
    const sub = { id: getNextId(subcategories), category_id: parseInt(categoryId), name, created_at: new Date().toISOString() };
    subcategories.push(sub);
    saveAll();
    return sub;
  },
  
  async deleteSubcategory(id) {
    if (USE_POSTGRES) return await dbModule.db.deleteSubcategory(id);
    subcategories = subcategories.filter(s => s.id !== id);
    saveAll();
  },
  
  async getProducts(subcategoryId = null) {
    if (USE_POSTGRES) return await dbModule.db.getProducts(subcategoryId);
    if (subcategoryId) return products.filter(p => parseInt(p.subcategory_id) === parseInt(subcategoryId));
    return products;
  },
  
  async getProduct(id) {
    if (USE_POSTGRES) return await dbModule.db.getProduct(id);
    return products.find(p => p.id === id);
  },
  
  async createProduct(subcategoryId, name, description, price, imageData) {
    const mainImage = saveBase64Image(imageData);
    if (USE_POSTGRES) return await dbModule.db.createProduct(subcategoryId, name, description, price, mainImage);
    const prod = {
      id: getNextId(products),
      subcategory_id: parseInt(subcategoryId),
      name,
      description: description || '',
      price: parseFloat(price),
      main_image: mainImage || '',
      images: mainImage ? [mainImage] : [],
      created_at: new Date().toISOString()
    };
    products.push(prod);
    saveAll();
    return prod;
  },
  
  async updateProduct(id, name, description, price) {
    if (USE_POSTGRES) return await dbModule.db.updateProduct(id, name, description, price);
    const product = products.find(p => p.id === id);
    if (product) {
      product.name = name || product.name;
      product.description = description || product.description;
      product.price = parseFloat(price) || product.price;
      saveAll();
    }
  },
  
  async deleteProduct(id) {
    if (USE_POSTGRES) {
      await dbModule.db.deleteProduct(id);
      // Очищаем товар из всех корзин
      await dbModule.db.removeProductFromCarts(id);
      return;
    }
    products = products.filter(p => p.id !== id);
    // Очищаем из JSON корзин
    Object.keys(carts).forEach(userId => {
      if (carts[userId] && carts[userId].items) {
        carts[userId].items = carts[userId].items.filter(item => item.id !== id);
      }
    });
    saveAll();
  },
  
  async getOrders() {
    if (USE_POSTGRES) return await dbModule.db.getOrders();
    return orders;
  },
  
  async getOrder(id) {
    if (USE_POSTGRES) return await dbModule.db.getOrder(id);
    return orders.find(o => o.id === id);
  },
  
  async createOrder(telegramUserId, username, contact, totalPrice, items) {
    if (USE_POSTGRES) return await dbModule.db.createOrder(telegramUserId, username, contact, totalPrice, items);
    const order = {
      id: getNextId(orders),
      telegram_user_id: telegramUserId,
      username,
      contact,
      total_price: totalPrice,
      items,
      status: 'new',
      created_at: new Date().toISOString()
    };
    orders.push(order);
    saveAll();
    return order;
  },
  
  async deleteOrder(id) {
    if (USE_POSTGRES) return await dbModule.db.deleteOrder(id);
    const index = orders.findIndex(o => o.id === id);
    if (index !== -1) {
      orders.splice(index, 1);
      saveAll();
    }
  },

  async completeOrder(id) {
    if (USE_POSTGRES) return await dbModule.db.completeOrder(id);
    const order = orders.find(o => o.id === id);
    if (order) {
      order.status = 'completed';
      order.completed_at = new Date().toISOString();
      saveAll();
    }
  },
  
  async getCart(userId) {
    if (USE_POSTGRES) return await dbModule.db.getCart(userId);
    return carts[userId] || { items: [] };
  },
  
  async saveCart(userId, items) {
    if (USE_POSTGRES) return await dbModule.db.saveCart(userId, items);
    carts[userId] = { items };
    saveAll();
  }
};

// Остальной код server.js без изменений...
// (Telegram, HTTP handlers и т.д.)

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
  req.on('data', chunk => { body += chunk.toString(); });
  req.on('end', () => {
    try {
      const data = body ? JSON.parse(body) : {};
      callback(null, data);
    } catch (e) {
      callback(e);
    }
  });
};

const sendTelegramMessage = (text) => {
  if (!TELEGRAM_TOKEN || !ADMIN_CHAT_ID) return;
  const message = { chat_id: ADMIN_CHAT_ID, text, parse_mode: 'HTML' };
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
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
  };
  const req = https.request(options, (res) => {
    let responseData = '';
    res.on('data', chunk => { responseData += chunk; });
    res.on('end', () => {
      try {
        const parsed = JSON.parse(responseData);
        if (!parsed.ok) console.error(`[Telegram] Ошибка ${method}:`, parsed.description);
      } catch (e) {}
    });
  });
  req.on('error', (e) => { console.error('[Telegram] Ошибка:', e.message); });
  req.write(postData);
  req.end();
};

const handleTelegramMessage = (msg) => {
  if (!msg) return;
  const chatId = msg.chat.id;
  const text = msg.text;
  const userId = msg.from.id;
  const firstName = msg.from.first_name || 'User';

  if (text && text.startsWith('/start')) {
    const keyboard = [[{ text: '🛍️ Открыть магазин', web_app: { url: `${SERVER_URL}/miniapp/` } }]];
    if (userId.toString() === ADMIN_TELEGRAM_ID.toString()) {
      keyboard.push([{ text: '⚙️ Админ-панель', web_app: { url: `${SERVER_URL}/admin/` } }]);
    }
    sendTelegramRequest('/sendMessage', {
      chat_id: chatId,
      text: `👋 Привет, ${firstName}!\n\n🛍️ Добро пожаловать в <b>DANISA SHOP</b>!\n\nВыберите действие:`,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
  }

  if (text === '/shop' || text === '/магазин') {
    sendTelegramRequest('/sendMessage', {
      chat_id: chatId,
      text: '🛍️ Открывайте магазин!',
      reply_markup: { inline_keyboard: [[{ text: '🛍️ Открыть магазин', web_app: { url: `${SERVER_URL}/miniapp/` } }]] }
    });
  }

  if (text && text.startsWith('/admin')) {
    if (userId.toString() === ADMIN_TELEGRAM_ID.toString()) {
      sendTelegramRequest('/sendMessage', {
        chat_id: chatId,
        text: `🔐 <b>Админ-панель</b>\n\nВойдите с паролем: <code>${ADMIN_PASSWORD}</code>`,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '⚙️ Открыть админ-панель', web_app: { url: `${SERVER_URL}/admin/` } }]] }
      });
    } else {
      sendTelegramRequest('/sendMessage', { chat_id: chatId, text: '❌ У вас нет доступа к админ-панели.' });
    }
  }

  if (text === '/help') {
    sendTelegramRequest('/sendMessage', {
      chat_id: chatId,
      text: `📱 <b>DANISA SHOP BOT</b>\n\nДоступные команды:\n/start - Главное меню\n/shop - Открыть магазин\n/admin - Админ-панель\n/help - Помощь`,
      parse_mode: 'HTML'
    });
  }
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname || '/';
  pathname = pathname.replace(/\/+/g, '/');
  const query = parsedUrl.query;

  console.log(`${req.method} ${pathname}`);

  // STATIC FILES
  // Тестовая страница для отладки
  if (pathname === '/test' || pathname === '/test/') {
    serveFile(res, path.join(__dirname, 'public', 'test.html'));
    return;
  }

  if (pathname === '/admin' || pathname === '/admin/' || pathname === '/admin/index.html') {
    serveFile(res, path.join(__dirname, 'public', 'admin', 'index.html'));
    return;
  }

  if (pathname === '/' || pathname === '/miniapp' || pathname === '/miniapp/' || pathname.startsWith('/miniapp')) {
    serveFile(res, path.join(__dirname, 'public', 'miniapp', 'index.html'));
    return;
  }

  // Изображения теперь хранятся как base64 в базе данных
  // Роут /uploads/ больше не нужен

  // API ROUTES
  if (pathname === '/api/categories' && req.method === 'GET') {
    const cats = await API.getCategories();
    sendJSON(res, 200, cats);
    return;
  }

  if (pathname === '/api/categories' && req.method === 'POST') {
    parseBody(req, async (err, data) => {
      if (data.password !== ADMIN_PASSWORD) {
        sendJSON(res, 401, { error: 'Неверный пароль' });
        return;
      }
      
      // Валидация
      const errors = validateCategory(data);
      if (errors.length > 0) {
        sendJSON(res, 400, { error: errors.join(', ') });
        return;
      }
      
      try {
        const cat = await API.createCategory(data.name);
        sendJSON(res, 200, { id: cat.id, name: cat.name });
      } catch (error) {
        console.error('Ошибка создания категории:', error);
        sendJSON(res, 500, { error: 'Ошибка создания категории' });
      }
    });
    return;
  }

  if (pathname.match(/^\/api\/categories\/\d+$/) && req.method === 'DELETE') {
    const id = parseInt(pathname.split('/')[3]);
    parseBody(req, async (err, data) => {
      if (data.password !== ADMIN_PASSWORD) {
        sendJSON(res, 401, { error: 'Неверный пароль' });
        return;
      }
      await API.deleteCategory(id);
      sendJSON(res, 200, { success: true });
    });
    return;
  }

  if (pathname === '/api/subcategories' && req.method === 'GET') {
    const subs = await API.getSubcategories();
    sendJSON(res, 200, subs);
    return;
  }

  if (pathname.match(/^\/api\/subcategories\/\d+$/) && req.method === 'GET') {
    const categoryId = parseInt(pathname.split('/')[3]);
    const subs = await API.getSubcategories(categoryId);
    sendJSON(res, 200, subs);
    return;
  }

  if (pathname === '/api/subcategories' && req.method === 'POST') {
    parseBody(req, async (err, data) => {
      if (data.password !== ADMIN_PASSWORD) {
        sendJSON(res, 401, { error: 'Неверный пароль' });
        return;
      }
      const sub = await API.createSubcategory(data.categoryId, data.name);
      sendJSON(res, 200, { id: sub.id, name: sub.name });
    });
    return;
  }

  if (pathname.match(/^\/api\/subcategories\/\d+$/) && req.method === 'DELETE') {
    const id = parseInt(pathname.split('/')[3]);
    parseBody(req, async (err, data) => {
      if (data.password !== ADMIN_PASSWORD) {
        sendJSON(res, 401, { error: 'Неверный пароль' });
        return;
      }
      await API.deleteSubcategory(id);
      sendJSON(res, 200, { success: true });
    });
    return;
  }

  if (pathname === '/api/products' && req.method === 'GET') {
    const subcategoryId = query.subcategoryId ? parseInt(query.subcategoryId) : null;
    const prods = await API.getProducts(subcategoryId);
    sendJSON(res, 200, prods);
    return;
  }

  if (pathname.match(/^\/api\/products\/\d+$/) && req.method === 'GET') {
    const id = parseInt(pathname.split('/')[3]);
    const product = await API.getProduct(id);
    if (!product) {
      sendJSON(res, 404, { error: 'Товар не найден' });
      return;
    }
    sendJSON(res, 200, product);
    return;
  }

  if (pathname === '/api/products' && req.method === 'POST') {
    parseBody(req, async (err, data) => {
      if (data.password !== ADMIN_PASSWORD) {
        sendJSON(res, 401, { error: 'Неверный пароль' });
        return;
      }
      
      // Валидация
      const errors = validateProduct(data);
      if (errors.length > 0) {
        sendJSON(res, 400, { error: errors.join(', ') });
        return;
      }
      
      try {
        const prod = await API.createProduct(data.subcategoryId, data.name, data.description, data.price, data.imageData);
        sendJSON(res, 200, { id: prod.id, name: prod.name });
      } catch (error) {
        console.error('Ошибка создания товара:', error);
        sendJSON(res, 500, { error: 'Ошибка создания товара' });
      }
    });
    return;
  }

  if (pathname.match(/^\/api\/products\/\d+$/) && req.method === 'PUT') {
    const id = parseInt(pathname.split('/')[3]);
    parseBody(req, async (err, data) => {
      if (data.password !== ADMIN_PASSWORD) {
        sendJSON(res, 401, { error: 'Неверный пароль' });
        return;
      }
      await API.updateProduct(id, data.name, data.description, data.price);
      sendJSON(res, 200, { success: true });
    });
    return;
  }

  if (pathname.match(/^\/api\/products\/\d+$/) && req.method === 'DELETE') {
    const id = parseInt(pathname.split('/')[3]);
    parseBody(req, async (err, data) => {
      if (data.password !== ADMIN_PASSWORD) {
        sendJSON(res, 401, { error: 'Неверный пароль' });
        return;
      }
      await API.deleteProduct(id);
      sendJSON(res, 200, { success: true });
    });
    return;
  }

  if (pathname.match(/^\/api\/cart\/\d+$/) && req.method === 'GET') {
    const userId = pathname.split('/')[3];
    const cart = await API.getCart(userId);
    sendJSON(res, 200, cart);
    return;
  }

  if (pathname.match(/^\/api\/cart\/\d+$/) && req.method === 'POST') {
    const userId = pathname.split('/')[3];
    parseBody(req, async (err, data) => {
      await API.saveCart(userId, data.items || []);
      sendJSON(res, 200, { success: true });
    });
    return;
  }

  if (pathname === '/api/orders' && req.method === 'GET') {
    if (query.password !== ADMIN_PASSWORD) {
      sendJSON(res, 401, { error: 'Неверный пароль' });
      return;
    }
    const ords = await API.getOrders();
    sendJSON(res, 200, ords);
    return;
  }

  if (pathname.match(/^\/api\/orders\/\d+$/) && req.method === 'GET') {
    if (query.password !== ADMIN_PASSWORD) {
      sendJSON(res, 401, { error: 'Неверный пароль' });
      return;
    }
    const id = parseInt(pathname.split('/')[3]);
    const order = await API.getOrder(id);
    if (!order) {
      sendJSON(res, 404, { error: 'Заказ не найден' });
      return;
    }
    sendJSON(res, 200, order);
    return;
  }

  if (pathname === '/api/orders' && req.method === 'POST') {
    parseBody(req, async (err, data) => {
      // Валидация
      const errors = validateOrder(data);
      if (errors.length > 0) {
        sendJSON(res, 400, { error: errors.join(', ') });
        return;
      }
      
      try {
        const order = await API.createOrder(data.telegramUserId, data.username, data.contact, data.totalPrice, data.items || []);
        
        // Парсим items если это строка
        const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        
        let orderText = `📦 <b>Новый заказ #${order.id}</b>\n\n`;
        orderText += `👤 <b>Пользователь:</b> @${order.username}\n`;
        orderText += `📞 <b>Контакт:</b> ${order.contact}\n`;
        orderText += `💰 <b>Сумма:</b> ${order.total_price}₽\n\n`;
        orderText += `<b>Товары:</b>\n`;
        items.forEach((item, idx) => {
          orderText += `${idx + 1}. ${item.name} x${item.quantity} = ${item.price * item.quantity}₽\n`;
        });
        sendTelegramMessage(orderText);

        sendJSON(res, 200, { id: order.id, status: 'success' });
      } catch (error) {
        console.error('Ошибка создания заказа:', error);
        sendJSON(res, 500, { error: 'Ошибка создания заказа' });
      }
    });
    return;
  }

  if (pathname.match(/^\/api\/orders\/\d+\/complete$/) && req.method === 'POST') {
    const id = parseInt(pathname.split('/')[3]);
    parseBody(req, async (err, data) => {
      if (data.password !== ADMIN_PASSWORD) {
        sendJSON(res, 401, { error: 'Неверный пароль' });
        return;
      }
      
      try {
        const order = await API.getOrder(id);
        if (!order) {
          sendJSON(res, 404, { error: 'Заказ не найден' });
          return;
        }
        
        // Меняем статус на completed вместо удаления
        await API.completeOrder(id);
        
        sendTelegramMessage(`✅ Заказ #${order.id} завершён и перемещен в архив.`);
        sendJSON(res, 200, { success: true });
      } catch (error) {
        console.error('Ошибка завершения заказа:', error);
        sendJSON(res, 500, { error: 'Ошибка завершения заказа' });
      }
    });
    return;
  }

  if (pathname === '/telegram' && req.method === 'POST') {
    parseBody(req, (err, update) => {
      if (err) {
        console.error('[Telegram] parse error:', err.message);
        sendJSON(res, 400, { ok: false });
        return;
      }
      try {
        if (update.message) handleTelegramMessage(update.message);
        else if (update.callback_query && update.callback_query.message) handleTelegramMessage(update.callback_query.message);
      } catch (e) {
        console.error('[Telegram] handler error:', e);
      }
      sendJSON(res, 200, { ok: true });
    });
    return;
  }

  sendJSON(res, 404, { error: 'Route not found' });
});

// Запуск сервера
loadData().then(() => {
  server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║       🚀 DANISA SHOP - WEB APP        ║
╚════════════════════════════════════════╝

✅ Сервер запущен на PORT ${PORT}

${USE_POSTGRES ? '🗄️  База данных: PostgreSQL' : '📁 База данных: JSON файлы'}

📱 Магазин: ${SERVER_URL}/miniapp/
⚙️  Админ: ${SERVER_URL}/admin/
🔐 Пароль: ${ADMIN_PASSWORD}

Нажмите Ctrl+C для остановки
    `);
  });
});

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'shop.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Таблица категорий
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Таблица подкатегорий
  db.run(`
    CREATE TABLE IF NOT EXISTS subcategories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE,
      UNIQUE(category_id, name)
    )
  `);

  // Таблица товаров
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subcategory_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      stock INTEGER DEFAULT 100,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(subcategory_id) REFERENCES subcategories(id) ON DELETE CASCADE
    )
  `);

  // Таблица изображений товаров
  db.run(`
    CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      is_main BOOLEAN DEFAULT 0,
      upload_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  // Таблица заказов
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_user_id INTEGER,
      username TEXT,
      contact TEXT,
      total_price REAL NOT NULL,
      items_json TEXT NOT NULL,
      status TEXT DEFAULT 'new',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Таблица корзин пользователей (для сохранения корзины)
  db.run(`
    CREATE TABLE IF NOT EXISTS user_carts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_user_id INTEGER UNIQUE,
      items_json TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Database initialized successfully');
});

db.close();

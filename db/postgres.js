const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Проверяем наличие DATABASE_URL (PostgreSQL)
const DATABASE_URL = process.env.DATABASE_URL;
const USE_POSTGRES = !!DATABASE_URL;

let pool = null;

if (USE_POSTGRES) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false
  });

  console.log('✅ Используется PostgreSQL база данных');
} else {
  console.log('⚠️  DATABASE_URL не найден, используются JSON файлы');
}

// Инициализация таблиц
async function initDatabase() {
  if (!USE_POSTGRES) return;

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS subcategories (
        id SERIAL PRIMARY KEY,
        category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(category_id, name)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        subcategory_id INTEGER NOT NULL REFERENCES subcategories(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        main_image TEXT,
        images TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        telegram_user_id BIGINT,
        username TEXT,
        contact TEXT,
        total_price DECIMAL(10,2) NOT NULL,
        items TEXT NOT NULL,
        status TEXT DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS carts (
        telegram_user_id TEXT PRIMARY KEY,
        items TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Таблицы PostgreSQL инициализированы');
  } catch (error) {
    console.error('❌ Ошибка инициализации БД:', error.message);
  }
}

// Универсальные функции для работы с данными
const db = {
  // Категории
  async getCategories() {
    if (!USE_POSTGRES) return [];
    const result = await pool.query('SELECT * FROM categories ORDER BY id');
    return result.rows;
  },

  async createCategory(name) {
    if (!USE_POSTGRES) return null;
    const result = await pool.query(
      'INSERT INTO categories (name) VALUES ($1) RETURNING *',
      [name]
    );
    return result.rows[0];
  },

  async deleteCategory(id) {
    if (!USE_POSTGRES) return;
    await pool.query('DELETE FROM categories WHERE id = $1', [id]);
  },

  // Подкатегории
  async getSubcategories(categoryId = null) {
    if (!USE_POSTGRES) return [];
    if (categoryId) {
      const result = await pool.query(
        'SELECT * FROM subcategories WHERE category_id = $1 ORDER BY id',
        [categoryId]
      );
      return result.rows;
    }
    const result = await pool.query('SELECT * FROM subcategories ORDER BY id');
    return result.rows;
  },

  async createSubcategory(categoryId, name) {
    if (!USE_POSTGRES) return null;
    const result = await pool.query(
      'INSERT INTO subcategories (category_id, name) VALUES ($1, $2) RETURNING *',
      [categoryId, name]
    );
    return result.rows[0];
  },

  async deleteSubcategory(id) {
    if (!USE_POSTGRES) return;
    await pool.query('DELETE FROM subcategories WHERE id = $1', [id]);
  },

  // Товары
  async getProducts(subcategoryId = null) {
    if (!USE_POSTGRES) return [];
    if (subcategoryId) {
      const result = await pool.query(
        'SELECT * FROM products WHERE subcategory_id = $1 ORDER BY id',
        [subcategoryId]
      );
      return result.rows.map(p => ({
        ...p,
        images: p.images ? JSON.parse(p.images) : []
      }));
    }
    const result = await pool.query('SELECT * FROM products ORDER BY id');
    return result.rows.map(p => ({
      ...p,
      images: p.images ? JSON.parse(p.images) : []
    }));
  },

  async getProduct(id) {
    if (!USE_POSTGRES) return null;
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    const product = result.rows[0];
    return {
      ...product,
      images: product.images ? JSON.parse(product.images) : []
    };
  },

  async createProduct(subcategoryId, name, description, price, mainImage) {
    if (!USE_POSTGRES) return null;
    const images = mainImage ? [mainImage] : [];
    const result = await pool.query(
      'INSERT INTO products (subcategory_id, name, description, price, main_image, images) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [subcategoryId, name, description, price, mainImage, JSON.stringify(images)]
    );
    return result.rows[0];
  },

  async updateProduct(id, name, description, price) {
    if (!USE_POSTGRES) return;
    await pool.query(
      'UPDATE products SET name = $1, description = $2, price = $3 WHERE id = $4',
      [name, description, price, id]
    );
  },

  async deleteProduct(id) {
    if (!USE_POSTGRES) return;
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
  },

  // Заказы
  async getOrders() {
    if (!USE_POSTGRES) return [];
    const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    return result.rows.map(o => ({
      ...o,
      items: typeof o.items === 'string' ? JSON.parse(o.items) : o.items
    }));
  },

  async getOrder(id) {
    if (!USE_POSTGRES) return null;
    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    const order = result.rows[0];
    return {
      ...order,
      items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items
    };
  },

  async createOrder(telegramUserId, username, contact, totalPrice, items) {
    if (!USE_POSTGRES) return null;
    const result = await pool.query(
      'INSERT INTO orders (telegram_user_id, username, contact, total_price, items, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [telegramUserId, username, contact, totalPrice, JSON.stringify(items), 'new']
    );
    return result.rows[0];
  },

  async deleteOrder(id) {
    if (!USE_POSTGRES) return;
    await pool.query('DELETE FROM orders WHERE id = $1', [id]);
  },

  // Корзины
  async getCart(userId) {
    if (!USE_POSTGRES) return { items: [] };
    const result = await pool.query('SELECT * FROM carts WHERE telegram_user_id = $1', [userId]);
    if (result.rows.length === 0) return { items: [] };
    const cart = result.rows[0];
    return {
      items: cart.items ? JSON.parse(cart.items) : []
    };
  },

  async saveCart(userId, items) {
    if (!USE_POSTGRES) return;
    await pool.query(
      `INSERT INTO carts (telegram_user_id, items, updated_at) 
       VALUES ($1, $2, CURRENT_TIMESTAMP) 
       ON CONFLICT (telegram_user_id) 
       DO UPDATE SET items = $2, updated_at = CURRENT_TIMESTAMP`,
      [userId, JSON.stringify(items)]
    );
  }
};

module.exports = {
  USE_POSTGRES,
  initDatabase,
  db,
  pool
};

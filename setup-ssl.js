const https = require('https');
const fs = require('fs');
const path = require('path');

// Генерируем самоподписанный сертификат для локальной разработки
const { execSync } = require('child_process');

const certDir = path.join(__dirname, 'certs');
const certFile = path.join(certDir, 'cert.pem');
const keyFile = path.join(certDir, 'key.pem');

// Создаем папку для сертификатов
if (!fs.existsSync(certDir)) {
  fs.mkdirSync(certDir, { recursive: true });
}

// Проверяем, есть ли уже сертификаты
if (!fs.existsSync(certFile) || !fs.existsSync(keyFile)) {
  console.log('🔒 Генерирую самоподписанный SSL сертификат...');
  
  try {
    // OpenSSL команда для генерации сертификата
    execSync(`openssl req -x509 -newkey rsa:2048 -keyout "${keyFile}" -out "${certFile}" -days 365 -nodes -subj "/CN=localhost"`, {
      stdio: 'pipe'
    });
    
    console.log('✅ Сертификат создан');
  } catch (e) {
    console.log('⚠️  OpenSSL не найден. Используем встроенный способ...');
    
    // Если OpenSSL не установлен, используем встроенный модуль Node.js
    const { spawnSync } = require('child_process');
    
    // Попытаемся использовать встроенный инструмент
    console.log('💡 Совет: установите OpenSSL для автоматической генерации сертификата');
    console.log('   Скачайте отсюда: https://slproweb.com/products/Win32OpenSSL.html');
  }
}

module.exports = {
  certFile,
  keyFile,
  certDir
};

# Примеры API запросов для тестирования

## Используйте Postman или PowerShell

### Категории

#### Получить все категории
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/categories" -Method GET
```

#### Добавить категорию
```powershell
$body = @{
    name = "Куртки"
    password = "admin123"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/categories" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
```

#### Удалить категорию
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/categories/1" `
  -Method DELETE `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"password":"admin123"}'
```

---

### Подкатегории

#### Получить подкатегории по категории
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/subcategories/1" -Method GET
```

#### Добавить подкатегорию
```powershell
$body = @{
    categoryId = 1
    name = "Stone Island"
    password = "admin123"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/subcategories" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
```

---

### Товары

#### Получить все товары
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method GET
```

#### Получить товары по подкатегории
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/products?subcategoryId=1" -Method GET
```

#### Получить деталь товара
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/products/1" -Method GET
```

#### Добавить товар
```powershell
$body = @{
    subcategoryId = 1
    name = "Puffer Jacket Stone Island"
    description = "Качественная пуховая куртка от Stone Island"
    price = 29990
    password = "admin123"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/products" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
```

#### Обновить товар
```powershell
$body = @{
    name = "Puffer Jacket Stone Island Updated"
    description = "Обновленное описание"
    price = 25990
    password = "admin123"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/products/1" `
  -Method PUT `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
```

#### Удалить товар
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/products/1" `
  -Method DELETE `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"password":"admin123"}'
```

---

### Изображения товаров

#### Загрузить изображение (используя файл)
```powershell
$filePath = "C:\path\to\image.jpg"
$productId = 1

$form = @{
    image = Get-Item -Path $filePath
    password = "admin123"
    isMain = "true"
}

Invoke-RestMethod -Uri "http://localhost:3000/api/products/$productId/upload-image" `
  -Method POST `
  -Form $form
```

#### Удалить изображение
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/product-images/1" `
  -Method DELETE `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"password":"admin123"}'
```

---

### Корзина

#### Получить корзину пользователя
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/cart/123456" -Method GET
```

#### Сохранить/обновить корзину
```powershell
$body = @{
    items = @(
        @{
            id = 1
            name = "Puffer Jacket"
            price = 29990
            image = "/uploads/image.jpg"
            quantity = 2
        },
        @{
            id = 2
            name = "Another Item"
            price = 15000
            image = "/uploads/image2.jpg"
            quantity = 1
        }
    )
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "http://localhost:3000/api/cart/123456" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
```

---

### Заказы

#### Получить все заказы (админ)
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/orders?password=admin123" -Method GET
```

#### Получить деталь заказа (админ)
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/orders/1?password=admin123" -Method GET
```

#### Создать заказ (оформление)
```powershell
$body = @{
    telegramUserId = 123456789
    username = "testuser"
    contact = "+79991234567"
    items = @(
        @{
            id = 1
            name = "Puffer Jacket"
            price = 29990
            quantity = 1
        },
        @{
            id = 2
            name = "T-Shirt"
            price = 5000
            quantity = 2
        }
    )
    totalPrice = 39990
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "http://localhost:3000/api/orders" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
```

---

## Полезные команды PowerShell

### Получить красиво отформатированный ответ:
```powershell
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/categories" -Method GET
$response | ConvertTo-Json | Write-Host
```

### Сохранить ответ в файл:
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/categories" -Method GET | `
  ConvertTo-Json | `
  Out-File -FilePath "response.json"
```

### Тестирование с задержкой:
```powershell
for ($i = 1; $i -le 5; $i++) {
    Write-Host "Запрос $i..."
    Invoke-RestMethod -Uri "http://localhost:3000/api/categories" | Out-Null
    Start-Sleep -Seconds 1
}
```

---

## Примеры для разработчиков (JavaScript/Node.js)

### Получить категории:
```javascript
const response = await fetch('/api/categories');
const categories = await response.json();
console.log(categories);
```

### Создать категорию:
```javascript
const response = await fetch('/api/categories', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Куртки',
    password: 'admin123'
  })
});
const data = await response.json();
console.log(data);
```

### Загрузить изображение:
```javascript
const formData = new FormData();
const fileInput = document.getElementById('imageInput');
formData.append('image', fileInput.files[0]);
formData.append('password', 'admin123');
formData.append('isMain', 'true');

const response = await fetch('/api/products/1/upload-image', {
  method: 'POST',
  body: formData
});
const data = await response.json();
console.log(data);
```

### Создать заказ:
```javascript
const response = await fetch('/api/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    telegramUserId: 123456789,
    username: 'user',
    contact: '+79991234567',
    items: [
      { id: 1, name: 'Item', price: 1000, quantity: 1 }
    ],
    totalPrice: 1000
  })
});
const order = await response.json();
console.log('Order ID:', order.id);
```

---

## Для использования в Postman

Импортируйте эту коллекцию JSON:

```json
{
  "info": {
    "name": "DANISA SHOP API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Categories",
      "item": [
        {
          "name": "Get All",
          "request": {
            "method": "GET",
            "url": "{{baseUrl}}/api/categories"
          }
        },
        {
          "name": "Create",
          "request": {
            "method": "POST",
            "url": "{{baseUrl}}/api/categories",
            "body": {
              "mode": "raw",
              "raw": "{\"name\":\"Куртки\",\"password\":\"admin123\"}"
            }
          }
        }
      ]
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    }
  ]
}
```

---

**Наслаждайтесь тестированием! 🚀**

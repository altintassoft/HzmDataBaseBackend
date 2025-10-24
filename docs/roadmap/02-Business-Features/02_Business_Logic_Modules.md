# 🧩 Business Logic Modules

> **Industry-specific business logic - npm packages olarak**

[◀️ Geri: Template System](05_Template_System.md) | [Ana Sayfa](README.md) | [İleri: i18n & Localization ▶️](07_i18n_Localization.md)

---

## 📋 İçindekiler

1. [Business Logic Nedir?](#business-logic-nedir)
2. [Module Yapısı](#module-yapısı)
3. [E-Commerce Logic](#e-commerce-logic)
4. [MLM Logic](#mlm-logic)
5. [Logistics Logic](#logistics-logic)
6. [Custom Module Oluşturma](#custom-module-oluşturma)

---

## Business Logic Nedir?

**Business Logic**, template'lerden bağımsız, industry-specific hesaplamalar ve kuralları içeren modüllerdir.

### Template vs Business Logic

| Özellik | Template | Business Logic |
|---------|----------|----------------|
| **Ne** | Database schema | Calculations & rules |
| **Örnek** | `products` table | Stock calculation |
| **Format** | JSON | npm package |
| **Kurulum** | Database migration | `npm install` |
| **Değişiklik** | Zor (migration) | Kolay (code update) |

### Örnek

```javascript
// Template: products tablosunu oluşturur
CREATE TABLE products (id, name, stock, price);

// Business Logic: Stok yönetimi
class StockManager {
  async checkStock(productId, quantity) {
    // Stok var mı kontrol et
    // Reserved stock'u hesapla
    // Min stock alert
  }
}
```

---

## Module Yapısı

### npm Package Format

```
@hzm/ecommerce-logic/
├── package.json
├── README.md
├── src/
│   ├── index.js
│   ├── stock.js
│   ├── pricing.js
│   ├── shipping.js
│   └── payment.js
└── tests/
    └── stock.test.js
```

### package.json

```json
{
  "name": "@hzm/ecommerce-logic",
  "version": "1.0.0",
  "description": "E-commerce business logic module",
  "main": "src/index.js",
  "dependencies": {
    "decimal.js": "^10.4.0"
  },
  "peerDependencies": {
    "pg": "^8.0.0"
  }
}
```

### Kullanım

```javascript
// Install
npm install @hzm/ecommerce-logic

// Import
const { StockManager, PricingEngine } = require('@hzm/ecommerce-logic');

// Use
const stockManager = new StockManager(pool);
const available = await stockManager.checkStock(productId, 5);
```

---

## E-Commerce Logic

### Stock Management

```javascript
// @hzm/ecommerce-logic/src/stock.js
class StockManager {
  constructor(pool) {
    this.pool = pool;
  }
  
  /**
   * Stok kontrolü (available - reserved)
   */
  async checkStock(tenantId, productId, quantity) {
    const result = await this.pool.query(`
      SELECT 
        stock,
        (
          SELECT COALESCE(SUM(quantity), 0) 
          FROM cart_items 
          WHERE product_id = $2 AND tenant_id = $1
        ) AS reserved
      FROM products 
      WHERE id = $2 AND tenant_id = $1
    `, [tenantId, productId]);
    
    const { stock, reserved } = result.rows[0];
    const available = stock - reserved;
    
    return {
      available,
      reserved,
      total: stock,
      can_order: available >= quantity
    };
  }
  
  /**
   * Stok rezerve et (sepete ekle)
   */
  async reserveStock(tenantId, productId, quantity) {
    const { can_order } = await this.checkStock(tenantId, productId, quantity);
    
    if (!can_order) {
      throw new Error('Insufficient stock');
    }
    
    // Sepete ekle (otomatik reserve)
    // ...
  }
  
  /**
   * Sipariş sonrası stok düş
   */
  async decreaseStock(tenantId, productId, quantity) {
    await this.pool.query(`
      UPDATE products 
      SET stock = stock - $3 
      WHERE id = $2 AND tenant_id = $1 AND stock >= $3
    `, [tenantId, productId, quantity]);
  }
}

module.exports = { StockManager };
```

### Pricing Engine

```javascript
// @hzm/ecommerce-logic/src/pricing.js
const Decimal = require('decimal.js');

class PricingEngine {
  /**
   * Sipariş toplamını hesapla
   */
  calculateOrderTotal(items, discountCode = null, shippingCost = 0) {
    // Subtotal
    const subtotal = items.reduce((sum, item) => {
      return sum.plus(new Decimal(item.price).times(item.quantity));
    }, new Decimal(0));
    
    // Discount
    let discount = new Decimal(0);
    if (discountCode) {
      discount = this.calculateDiscount(subtotal, discountCode);
    }
    
    // Shipping
    const shipping = new Decimal(shippingCost);
    
    // Tax (KDV %20)
    const taxableAmount = subtotal.minus(discount).plus(shipping);
    const tax = taxableAmount.times(0.20);
    
    // Total
    const total = taxableAmount.plus(tax);
    
    return {
      subtotal: subtotal.toFixed(2),
      discount: discount.toFixed(2),
      shipping: shipping.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2)
    };
  }
  
  /**
   * İndirim hesapla
   */
  calculateDiscount(subtotal, discountCode) {
    if (discountCode.type === 'percentage') {
      return subtotal.times(discountCode.value / 100);
    } else if (discountCode.type === 'fixed') {
      return new Decimal(discountCode.value);
    }
    return new Decimal(0);
  }
}

module.exports = { PricingEngine };
```

### Shipping Calculator

```javascript
// @hzm/ecommerce-logic/src/shipping.js
class ShippingCalculator {
  /**
   * Kargo ücreti hesapla (mesafe + ağırlık bazlı)
   */
  calculateShippingCost(fromZip, toZip, weightKg) {
    const distance = this.calculateDistance(fromZip, toZip);
    
    let cost = 0;
    
    // Mesafe bazlı
    if (distance < 100) {
      cost += 20; // TRY
    } else if (distance < 500) {
      cost += 40;
    } else {
      cost += 60;
    }
    
    // Ağırlık bazlı
    if (weightKg > 5) {
      cost += (weightKg - 5) * 5; // Her fazla kg için 5 TRY
    }
    
    return cost;
  }
  
  /**
   * Tahmini teslimat süresi
   */
  estimateDeliveryTime(fromZip, toZip) {
    const distance = this.calculateDistance(fromZip, toZip);
    
    if (distance < 100) {
      return { min: 1, max: 2, unit: 'days' };
    } else if (distance < 500) {
      return { min: 2, max: 4, unit: 'days' };
    } else {
      return { min: 4, max: 7, unit: 'days' };
    }
  }
}

module.exports = { ShippingCalculator };
```

---

## MLM Logic

### Commission Calculator

```javascript
// @hzm/mlm-logic/src/commission.js
class CommissionCalculator {
  /**
   * Multi-level komisyon hesapla
   */
  async calculateCommissions(tenantId, saleId, amount) {
    const sale = await this.getSale(tenantId, saleId);
    const distributor = await this.getDistributor(tenantId, sale.distributor_id);
    
    const commissions = [];
    let currentLevel = 1;
    let uplineId = distributor.upline_id;
    
    // 5 seviye yukarı çık
    while (uplineId && currentLevel <= 5) {
      const upline = await this.getDistributor(tenantId, uplineId);
      const rate = this.getCommissionRate(currentLevel, upline.rank);
      const commission = amount * rate;
      
      commissions.push({
        distributor_id: uplineId,
        level: currentLevel,
        rate,
        amount: commission,
        sale_id: saleId
      });
      
      uplineId = upline.upline_id;
      currentLevel++;
    }
    
    return commissions;
  }
  
  /**
   * Seviye ve rank'e göre komisyon oranı
   */
  getCommissionRate(level, rank) {
    const rates = {
      bronze: [0.10, 0.05, 0.03, 0.02, 0.01],
      silver: [0.12, 0.06, 0.04, 0.02, 0.01],
      gold: [0.15, 0.08, 0.05, 0.03, 0.02],
      platinum: [0.20, 0.10, 0.06, 0.04, 0.02]
    };
    
    return rates[rank]?.[level - 1] || 0;
  }
  
  /**
   * Aylık team performans
   */
  async calculateTeamPerformance(tenantId, distributorId, month) {
    const team = await this.getTeamMembers(tenantId, distributorId);
    
    let totalSales = 0;
    let totalCommissions = 0;
    let activeMembers = 0;
    
    for (const member of team) {
      const sales = await this.getMonthlySales(tenantId, member.id, month);
      totalSales += sales.amount;
      totalCommissions += sales.commissions;
      if (sales.amount > 0) activeMembers++;
    }
    
    return {
      total_sales: totalSales,
      total_commissions: totalCommissions,
      team_size: team.length,
      active_members: activeMembers,
      average_per_member: totalSales / team.length
    };
  }
}

module.exports = { CommissionCalculator };
```

---

## Logistics Logic

### Route Optimizer

```javascript
// @hzm/logistics-logic/src/route.js
class RouteOptimizer {
  /**
   * Optimum teslimat rotası
   */
  optimizeRoute(warehouse, deliveries) {
    // Traveling Salesman Problem (TSP)
    // Greedy algorithm (nearest neighbor)
    
    const route = [warehouse];
    let remaining = [...deliveries];
    let current = warehouse;
    
    while (remaining.length > 0) {
      const nearest = this.findNearest(current, remaining);
      route.push(nearest);
      remaining = remaining.filter(d => d.id !== nearest.id);
      current = nearest;
    }
    
    return route;
  }
  
  /**
   * En yakın noktayı bul
   */
  findNearest(from, points) {
    let nearest = points[0];
    let minDistance = this.calculateDistance(from, nearest);
    
    for (const point of points) {
      const distance = this.calculateDistance(from, point);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = point;
      }
    }
    
    return nearest;
  }
  
  /**
   * Rota toplamı (mesafe + süre + maliyet)
   */
  calculateRouteSummary(route) {
    let totalDistance = 0;
    let totalTime = 0;
    let totalCost = 0;
    
    for (let i = 0; i < route.length - 1; i++) {
      const from = route[i];
      const to = route[i + 1];
      
      const distance = this.calculateDistance(from, to);
      const time = this.estimateTime(distance);
      const cost = this.calculateCost(distance);
      
      totalDistance += distance;
      totalTime += time;
      totalCost += cost;
    }
    
    return {
      total_distance_km: totalDistance,
      total_time_minutes: totalTime,
      total_cost: totalCost,
      stops: route.length - 1
    };
  }
}

module.exports = { RouteOptimizer };
```

---

## Custom Module Oluşturma

### 1. npm Package Oluştur

```bash
mkdir my-custom-logic
cd my-custom-logic
npm init -y
```

### 2. src/index.js

```javascript
class MyBusinessLogic {
  constructor(pool) {
    this.pool = pool;
  }
  
  async myCalculation(tenantId, data) {
    // Your logic here
    return result;
  }
}

module.exports = { MyBusinessLogic };
```

### 3. Test

```javascript
// tests/logic.test.js
const { MyBusinessLogic } = require('../src');

test('calculation works', () => {
  const logic = new MyBusinessLogic(mockPool);
  const result = logic.myCalculation(1, { foo: 'bar' });
  expect(result).toBe(expected);
});
```

### 4. Publish

```bash
npm publish --access public
```

### 5. Kullan

```bash
npm install @yourname/my-custom-logic
```

```javascript
const { MyBusinessLogic } = require('@yourname/my-custom-logic');
const logic = new MyBusinessLogic(pool);
```

---

## Best Practices

### ✅ DO

1. **Pure functions** - Side effect'siz fonksiyonlar
2. **Unit tests** - Her fonksiyon için test
3. **Decimal.js** - Para hesaplamalarında
4. **Error handling** - Proper error messages
5. **Documentation** - JSDoc comments

### ❌ DON'T

1. **Floating point** - `0.1 + 0.2 === 0.30000000000000004`
2. **Hardcode** - Config values hardcode etme
3. **Database logic** - Business logic'te SQL yazma (ORM kullan)
4. **Tight coupling** - Template'e bağımlı olma

---

## 🔗 İlgili Dökümanlar

- [05_Template_System.md](05_Template_System.md) - Templates
- [02_Core_Database_Schema.md](02_Core_Database_Schema.md) - Database schema

---

**[◀️ Geri: Template System](05_Template_System.md) | [Ana Sayfa](README.md) | [İleri: i18n & Localization ▶️](07_i18n_Localization.md)**


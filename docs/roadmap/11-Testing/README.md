# 🧪 Testing Strategy

> **Test otomasyonu: Unit, Integration, E2E ve CI/CD pipeline**

[Ana Sayfa](../README.md)

---

## 📋 İçindekiler

1. [Testing Pyramid](#testing-pyramid)
2. [Unit Testing (Jest)](#unit-testing-jest)
3. [Integration Testing](#integration-testing)
4. [E2E Testing (Playwright)](#e2e-testing-playwright)
5. [Test Coverage](#test-coverage)
6. [CI/CD Pipeline](#cicd-pipeline)

---

## Testing Pyramid

```
      /\
     /E2E\        10% - Slow, expensive
    /------\
   /  INT   \     30% - Medium speed
  /----------\
 /    UNIT    \   60% - Fast, cheap
/--------------\
```

### Test Dağılımı

| Test Type | Coverage | Speed | Cost | Örnekler |
|-----------|----------|-------|------|----------|
| **Unit** | 60% | ⚡ Çok hızlı | $ | Functions, utilities, services |
| **Integration** | 30% | ⚡ Orta | $$ | API endpoints, database queries |
| **E2E** | 10% | 🐢 Yavaş | $$$ | User flows, critical paths |

---

## Unit Testing (Jest)

### Setup

```bash
npm install --save-dev jest @types/jest ts-jest
npm install --save-dev @testing-library/react @testing-library/jest-dom
```

**jest.config.js:**
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.test.{ts,js}',
    '!src/**/*.spec.{ts,js}'
  ],
  coverageThresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

### Örnek: Utility Function Test

```typescript
// src/utils/validators.ts
export const validateEmail = (email: string): boolean => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

export const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  if (password.length < 8) errors.push('Minimum 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter');
  if (!/[0-9]/.test(password)) errors.push('At least one number');
  return { valid: errors.length === 0, errors };
};
```

```typescript
// src/utils/validators.test.ts
import { validateEmail, validatePassword } from './validators';

describe('validateEmail', () => {
  it('should return true for valid email', () => {
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('user+tag@domain.co.uk')).toBe(true);
  });

  it('should return false for invalid email', () => {
    expect(validateEmail('invalid')).toBe(false);
    expect(validateEmail('@example.com')).toBe(false);
    expect(validateEmail('test@')).toBe(false);
  });
});

describe('validatePassword', () => {
  it('should pass for strong password', () => {
    const result = validatePassword('StrongPass123');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail for weak password', () => {
    const result = validatePassword('weak');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Minimum 8 characters');
    expect(result.errors).toContain('At least one uppercase letter');
    expect(result.errors).toContain('At least one number');
  });
});
```

### Örnek: Service Test (Mocking)

```typescript
// src/services/auth.service.test.ts
import { authService } from './auth.service';
import api from './api';

jest.mock('./api');
const mockedApi = api as jest.Mocked<typeof api>;

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should return token on successful login', async () => {
      const mockResponse = {
        data: {
          token: 'fake-jwt-token',
          user: { id: 1, email: 'test@example.com' }
        }
      };
      mockedApi.post.mockResolvedValue(mockResponse);

      const result = await authService.login('test@example.com', 'password');

      expect(mockedApi.post).toHaveBeenCalledWith('/api/auth/login', {
        email: 'test@example.com',
        password: 'password'
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should throw error on invalid credentials', async () => {
      mockedApi.post.mockRejectedValue(new Error('Invalid credentials'));

      await expect(
        authService.login('test@example.com', 'wrong-password')
      ).rejects.toThrow('Invalid credentials');
    });
  });
});
```

### Çalıştırma

```bash
# Tüm testleri çalıştır
npm test

# Watch mode
npm test -- --watch

# Coverage raporu
npm test -- --coverage

# Tek dosya test et
npm test -- validators.test.ts
```

---

## Integration Testing

### Backend API Testing

```typescript
// tests/integration/auth.test.ts
import request from 'supertest';
import app from '../../src/app';
import { pool } from '../../src/config/database';

describe('Auth API', () => {
  let testUserId: number;

  afterAll(async () => {
    // Cleanup
    if (testUserId) {
      await pool.query('DELETE FROM core.users WHERE id = $1', [testUserId]);
    }
    await pool.end();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'StrongPass123',
          name: 'Test User'
        })
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.email).toBe('test@example.com');

      testUserId = response.body.user.id;
    });

    it('should fail with duplicate email', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',  // Duplicate
          password: 'AnotherPass123',
          name: 'Another User'
        })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'StrongPass123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
    });

    it('should fail with invalid password', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword'
        })
        .expect(401);
    });
  });
});
```

### Database Testing (RLS)

```typescript
// tests/integration/rls.test.ts
import { pool } from '../../src/config/database';

describe('Row Level Security (RLS)', () => {
  let tenant1Id: number;
  let tenant2Id: number;
  let user1Id: number;
  let user2Id: number;

  beforeAll(async () => {
    // Setup test tenants
    const tenant1 = await pool.query(
      'INSERT INTO core.tenants (name, slug) VALUES ($1, $2) RETURNING id',
      ['Tenant 1', 'tenant-1']
    );
    tenant1Id = tenant1.rows[0].id;

    const tenant2 = await pool.query(
      'INSERT INTO core.tenants (name, slug) VALUES ($1, $2) RETURNING id',
      ['Tenant 2', 'tenant-2']
    );
    tenant2Id = tenant2.rows[0].id;

    // Setup test users
    const user1 = await pool.query(
      'INSERT INTO core.users (tenant_id, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [tenant1Id, 'user1@t1.com', 'hash']
    );
    user1Id = user1.rows[0].id;

    const user2 = await pool.query(
      'INSERT INTO core.users (tenant_id, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [tenant2Id, 'user2@t2.com', 'hash']
    );
    user2Id = user2.rows[0].id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM core.users WHERE id IN ($1, $2)', [user1Id, user2Id]);
    await pool.query('DELETE FROM core.tenants WHERE id IN ($1, $2)', [tenant1Id, tenant2Id]);
    await pool.end();
  });

  it('should only see own tenant data', async () => {
    // Set context to tenant 1
    await pool.query('SELECT app.set_context($1, $2)', [tenant1Id, user1Id]);

    // Query users
    const result = await pool.query('SELECT * FROM core.users');

    // Should only see tenant 1 users
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe(user1Id);
  });

  it('should not see other tenant data', async () => {
    await pool.query('SELECT app.set_context($1, $2)', [tenant1Id, user1Id]);

    const result = await pool.query('SELECT * FROM core.users WHERE id = $1', [user2Id]);

    // Should NOT see tenant 2 user (RLS blocks it)
    expect(result.rows).toHaveLength(0);
  });
});
```

---

## E2E Testing (Playwright)

### Setup

```bash
npm install --save-dev @playwright/test
npx playwright install
```

**playwright.config.ts:**
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } }
  ]
});
```

### Örnek: User Registration Flow

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('User Registration', () => {
  test('should register a new user successfully', async ({ page }) => {
    // Navigate to register page
    await page.goto('/register');

    // Fill form
    await page.fill('input[name="email"]', 'newuser@example.com');
    await page.fill('input[name="password"]', 'StrongPass123');
    await page.fill('input[name="name"]', 'New User');

    // Submit
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard');

    // Check welcome message
    await expect(page.locator('text=Welcome, New User')).toBeVisible();
  });

  test('should show error for invalid email', async ({ page }) => {
    await page.goto('/register');

    await page.fill('input[name="email"]', 'invalid-email');
    await page.fill('input[name="password"]', 'StrongPass123');
    await page.click('button[type="submit"]');

    // Check error message
    await expect(page.locator('text=Invalid email')).toBeVisible();
  });
});
```

### Örnek: Create Project Flow

```typescript
// e2e/projects.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Project Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestPass123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should create a new project', async ({ page }) => {
    // Navigate to projects
    await page.click('text=Projects');
    await page.click('text=New Project');

    // Fill form
    await page.fill('input[name="name"]', 'Test Project');
    await page.fill('textarea[name="description"]', 'Test Description');
    await page.click('button:has-text("Create")');

    // Check success
    await expect(page.locator('text=Project created successfully')).toBeVisible();
    await expect(page.locator('text=Test Project')).toBeVisible();
  });
});
```

### Çalıştırma

```bash
# Tüm E2E testleri
npx playwright test

# Headless olmadan (browser görünür)
npx playwright test --headed

# Tek dosya
npx playwright test e2e/auth.spec.ts

# Debug mode
npx playwright test --debug
```

---

## Test Coverage

### Coverage Hedefleri

| Metric | Target | Critical |
|--------|--------|----------|
| **Lines** | 80% | 90% |
| **Functions** | 80% | 85% |
| **Branches** | 75% | 80% |
| **Statements** | 80% | 90% |

### Coverage Raporu

```bash
# Generate coverage report
npm test -- --coverage

# HTML report
npm test -- --coverage --coverageReporters=html

# Open report
open coverage/index.html
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm test -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Run migrations
        run: npm run migrate
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Run E2E tests
        run: npx playwright test
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 🔗 İlgili Dökümanlar

- [12-Deployment/README.md](../12-Deployment/README.md) - Deployment guide
- [04-Infrastructure/07_Monitoring_Dashboards.md](../04-Infrastructure/07_Monitoring_Dashboards.md) - Monitoring

---

**[Ana Sayfa](../README.md)**



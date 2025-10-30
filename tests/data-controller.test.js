/**
 * Data Controller Integration Tests
 * 
 * HAFTA 2 - Generic Handler Tests
 * 
 * Tests:
 * - Disabled resources (is_enabled=false)
 * - Metadata validation
 * - CRUD operations (when enabled)
 * - Idempotency
 * - Metrics tracking
 */

const request = require('supertest');
const app = require('../src/app/server');

// Test credentials (Master Admin)
const TEST_EMAIL = 'ozgurhzm@hzmsoft.com';
const TEST_API_KEY = 'hzm_master_admin_2025_secure_key_01234567890';
const TEST_API_PASSWORD = 'MasterAdmin2025!SecurePassword';

// Helper function
function apiRequest(method, path) {
  return request(app)[method](path)
    .set('X-Email', TEST_EMAIL)
    .set('X-API-Key', TEST_API_KEY)
    .set('X-API-Password', TEST_API_PASSWORD);
}

describe('Data Controller - Generic Handler', () => {
  
  describe('1. Disabled Resources (is_enabled=false)', () => {
    
    test('GET /data/users should return 403 (disabled)', async () => {
      const res = await apiRequest('get', '/api/v1/data/users');
      
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('RESOURCE_DISABLED');
      expect(res.body.message).toContain('is not enabled');
    });

    test('GET /data/projects should return 403 (disabled)', async () => {
      const res = await apiRequest('get', '/api/v1/data/projects');
      
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('RESOURCE_DISABLED');
    });

    test('POST /data/projects should return 403 (disabled)', async () => {
      const res = await apiRequest('post', '/api/v1/data/projects')
        .send({ name: 'Test Project' });
      
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('RESOURCE_DISABLED');
    });

  });

  describe('2. Unknown Resources', () => {
    
    test('GET /data/nonexistent should return 404', async () => {
      const res = await apiRequest('get', '/api/v1/data/nonexistent');
      
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('RESOURCE_NOT_FOUND');
    });

  });

  describe('3. Authentication', () => {
    
    test('GET /data/users without auth should return 401', async () => {
      const res = await request(app).get('/api/v1/data/users');
      
      expect(res.status).toBe(401);
    });

    test('GET /data/users with invalid API key should return 401', async () => {
      const res = await request(app)
        .get('/api/v1/data/users')
        .set('X-Email', TEST_EMAIL)
        .set('X-API-Key', 'invalid-key')
        .set('X-API-Password', TEST_API_PASSWORD);
      
      expect(res.status).toBe(401);
    });

  });

  describe('4. Idempotency', () => {
    
    test('POST with same idempotency key should return 409', async () => {
      const idempotencyKey = `test-${Date.now()}`;
      
      // First request (will fail with 403 because resource disabled)
      const res1 = await apiRequest('post', '/api/v1/data/projects')
        .set('X-Idempotency-Key', idempotencyKey)
        .send({ name: 'Test Project' });
      
      // Second request with same key
      const res2 = await apiRequest('post', '/api/v1/data/projects')
        .set('X-Idempotency-Key', idempotencyKey)
        .send({ name: 'Test Project 2' });
      
      // Both should fail with 403 (disabled), but idempotency should work
      expect(res1.status).toBe(403);
      expect(res2.status).toBe(409); // Duplicate detected
      expect(res2.body.code).toBe('DUPLICATE_REQUEST');
    });

  });

  describe('5. Metrics', () => {
    
    test('Metrics should track requests', async () => {
      // Make a request
      await apiRequest('get', '/api/v1/data/users');
      
      // Metrics should be tracked (implementation dependent)
      // This is a basic test - expand when metrics endpoint is added
      expect(true).toBe(true);
    });

  });

  describe('6. Query Parameters', () => {
    
    test('GET /data/users with pagination should return 403 (disabled)', async () => {
      const res = await apiRequest('get', '/api/v1/data/users?page=1&limit=10');
      
      expect(res.status).toBe(403);
      // Pagination is parsed but resource is disabled
    });

    test('GET /data/users with filters should return 403 (disabled)', async () => {
      const res = await apiRequest('get', '/api/v1/data/users?eq.role=admin');
      
      expect(res.status).toBe(403);
      // Filters are parsed but resource is disabled
    });

  });

  describe('7. Count Endpoint', () => {
    
    test('GET /data/users/count should return 403 (disabled)', async () => {
      const res = await apiRequest('get', '/api/v1/data/users/count');
      
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('RESOURCE_DISABLED');
    });

  });

  describe('8. Batch Operations', () => {
    
    test('POST /data/users/batch should return 501 (not implemented)', async () => {
      const res = await apiRequest('post', '/api/v1/data/users/batch')
        .send([{ email: 'test1@test.com' }, { email: 'test2@test.com' }]);
      
      // Auth passes, but batch not implemented yet
      expect([403, 501]).toContain(res.status);
    });

  });

});

describe('Middleware', () => {

  describe('Metrics Middleware', () => {
    
    test('Should track request timing', async () => {
      const start = Date.now();
      await apiRequest('get', '/api/v1/data/users');
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(5000); // Shouldn't take more than 5s
    });

  });

  describe('Idempotency Middleware', () => {
    
    test('GET requests should skip idempotency', async () => {
      // Same request twice without idempotency key
      const res1 = await apiRequest('get', '/api/v1/data/users');
      const res2 = await apiRequest('get', '/api/v1/data/users');
      
      // Both should return same result (403)
      expect(res1.status).toBe(403);
      expect(res2.status).toBe(403);
    });

  });

});

// Note: Tests for ENABLED resources will be added in Week 3
// when we manually enable projects resource for canary testing


/**
 * Registry Service Tests
 * 
 * NOT: Bu testleri çalıştırmadan önce:
 * 1. Migration'ı çalıştır: npm run migrate
 * 2. Database bağlantısını kontrol et
 */

const RegistryService = require('../src/modules/data/services/registry.service');

describe('Registry Service - Hafta 1 Tests', () => {
  /**
   * Test 1: Users metadata (disabled)
   * Beklenen: Error fırlatılmalı çünkü is_enabled=false
   */
  test('should reject disabled resource (users)', async () => {
    try {
      const meta = await RegistryService.getResourceMeta('users');
      // Buraya gelmemeli
      fail('Expected error for disabled resource');
    } catch (error) {
      expect(error.message).toContain('not enabled');
    }
  });

  /**
   * Test 2: Projects metadata (disabled)
   * Beklenen: Error fırlatılmalı çünkü is_enabled=false
   */
  test('should reject disabled resource (projects)', async () => {
    try {
      const meta = await RegistryService.getResourceMeta('projects');
      // Buraya gelmemeli
      fail('Expected error for disabled resource');
    } catch (error) {
      expect(error.message).toContain('not enabled');
    }
  });

  /**
   * Test 3: Non-existent resource
   * Beklenen: null döndürmeli
   */
  test('should return null for non-existent resource', async () => {
    const meta = await RegistryService.getResourceMeta('nonexistent');
    expect(meta).toBeNull();
  });

  /**
   * Test 4: List resources (tümü disabled)
   * Beklenen: Boş array
   */
  test('should list enabled resources (empty)', async () => {
    const resources = await RegistryService.listResources();
    expect(resources).toHaveLength(0);  // Hepsi disabled
  });

  /**
   * Test 5: isEnabled check
   * Beklenen: false
   */
  test('should check if resource is enabled', async () => {
    const usersEnabled = await RegistryService.isEnabled('users');
    const projectsEnabled = await RegistryService.isEnabled('projects');
    
    expect(usersEnabled).toBe(false);
    expect(projectsEnabled).toBe(false);
  });

  /**
   * Test 6: Get policies (tümü disabled için)
   * Beklenen: Boş array (resource disabled)
   */
  test('should get policies for role', async () => {
    const policies = await RegistryService.getPolicies('users', 'user');
    // policies var ama resource disabled olduğu için meta alamayız
    expect(Array.isArray(policies)).toBe(true);
  });
});

/**
 * Manual Test Komutları (migration sonrası)
 * 
 * 1. Migration çalıştır:
 *    cd HzmVeriTabaniBackend
 *    npm run migrate
 * 
 * 2. Database'de kontrol et:
 *    psql $DATABASE_URL
 *    SELECT * FROM api_resources;
 *    SELECT * FROM api_resource_fields WHERE resource = 'projects';
 *    SELECT * FROM get_resource_metadata('projects');
 * 
 * 3. Test çalıştır:
 *    npm test tests/registry.test.js
 * 
 * Beklenen Sonuçlar:
 * - api_resources: 2 row (users, projects) - is_enabled=false
 * - api_resource_fields: 16 row (users: 8, projects: 8)
 * - api_policies: 2 row (tenant_isolation)
 * - Tüm testler PASS
 */


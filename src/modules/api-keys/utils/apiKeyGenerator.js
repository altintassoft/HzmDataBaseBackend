/**
 * API Key Generator Utility
 * Generates secure API keys for projects
 * 
 * ⚠️ SECURITY: This file should ONLY be used on backend!
 */

const crypto = require('crypto');

class ApiKeyGenerator {
  static PREFIX = 'hzm_';
  static KEY_LENGTH = 32;
  static CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  /**
   * Generate a secure API key using crypto
   */
  static generateApiKey() {
    // Use crypto.randomBytes for better security
    const randomBytes = crypto.randomBytes(24);
    const randomString = randomBytes.toString('base64')
      .replace(/\+/g, '')
      .replace(/\//g, '')
      .replace(/=/g, '')
      .substring(0, this.KEY_LENGTH);
    
    // Add timestamp component (base36)
    const timestamp = Date.now().toString(36);
    
    return `${this.PREFIX}${timestamp}_${randomString}`;
  }

  /**
   * Generate a project-specific API key
   */
  static generateProjectApiKey(projectId, projectName) {
    const baseKey = this.generateApiKey();
    
    // Add project identifier using crypto hash
    const projectHash = crypto
      .createHash('sha256')
      .update(projectId + projectName)
      .digest('hex')
      .substring(0, 8);
    
    return `${baseKey}_${projectHash}`;
  }

  /**
   * Validate API key format
   */
  static validateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') return false;
    
    // Check prefix
    if (!apiKey.startsWith(this.PREFIX)) return false;
    
    // Check minimum length
    if (apiKey.length < 40) return false;
    
    // Check format (prefix + timestamp + underscore + random + optional project hash)
    const pattern = /^hzm_[a-z0-9]+_[A-Za-z0-9+/]+(_[a-f0-9]{8})?$/;
    return pattern.test(apiKey);
  }

  /**
   * Extract metadata from API key
   */
  static extractMetadata(apiKey) {
    if (!this.validateApiKey(apiKey)) return null;
    
    try {
      const parts = apiKey.split('_');
      const timestamp = parseInt(parts[1], 36);
      const isProjectKey = parts.length > 3;
      
      return { timestamp, isProjectKey };
    } catch {
      return null;
    }
  }

  /**
   * Generate API password (separate from key)
   */
  static generateApiPassword() {
    // Generate 32-character password
    return crypto.randomBytes(24).toString('base64').substring(0, 32);
  }

  /**
   * Hash API password for storage
   */
  static async hashApiPassword(password) {
    const crypto = require('crypto');
    return new Promise((resolve, reject) => {
      const salt = crypto.randomBytes(16).toString('hex');
      crypto.pbkdf2(password, salt, 10000, 64, 'sha512', (err, derivedKey) => {
        if (err) reject(err);
        resolve(salt + ':' + derivedKey.toString('hex'));
      });
    });
  }

  /**
   * Verify API password
   */
  static async verifyApiPassword(password, hash) {
    return new Promise((resolve, reject) => {
      const [salt, key] = hash.split(':');
      crypto.pbkdf2(password, salt, 10000, 64, 'sha512', (err, derivedKey) => {
        if (err) reject(err);
        resolve(key === derivedKey.toString('hex'));
      });
    });
  }

  /**
   * Mask API key for display (show only first and last few characters)
   */
  static maskApiKey(apiKey) {
    if (!apiKey || apiKey.length < 10) return '***';
    
    const start = apiKey.substring(0, 8);
    const end = apiKey.substring(apiKey.length - 4);
    const middle = '*'.repeat(Math.min(apiKey.length - 12, 20));
    
    return `${start}${middle}${end}`;
  }

  /**
   * Generate complete API key data
   */
  static generateKeyData(userId, tenantId, name = 'Default Key') {
    const apiKey = this.generateApiKey();
    const apiPassword = this.generateApiPassword();
    
    return {
      api_key: apiKey,
      api_password: apiPassword, // Plain text - will be hashed before storage
      name,
      user_id: userId,
      tenant_id: tenantId,
      is_active: true,
      created_at: new Date(),
      last_used_at: null,
      usage_count: 0
    };
  }
}

module.exports = ApiKeyGenerator;



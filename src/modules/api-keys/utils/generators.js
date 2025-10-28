const crypto = require('crypto');

/**
 * API Key & Password Generators
 * Secure random generation utilities
 */

/**
 * Generate a secure random API key
 * Format: hzm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (52 chars total)
 * @returns {string} API key in format hzm_<48 hex chars>
 */
function generateApiKey() {
  // 24 bytes = 48 hex chars
  const randomBytes = crypto.randomBytes(24).toString('hex');
  return `hzm_${randomBytes}`;
}

/**
 * Generate a secure random API password
 * 24 character random password with mixed case, numbers, and symbols
 * @returns {string} 24-character password
 */
function generateApiPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  const randomBytes = crypto.randomBytes(24);
  for (let i = 0; i < 24; i++) {
    password += chars[randomBytes[i] % chars.length];
  }
  return password;
}

module.exports = {
  generateApiKey,
  generateApiPassword
};


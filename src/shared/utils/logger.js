/**
 * Logger Utility
 * Centralized logging for all modules
 */

const logger = {
  info: (...args) => {
    console.log('[INFO]', new Date().toISOString(), ...args);
  },

  warn: (...args) => {
    console.warn('[WARN]', new Date().toISOString(), ...args);
  },

  error: (...args) => {
    console.error('[ERROR]', new Date().toISOString(), ...args);
  },

  debug: (...args) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[DEBUG]', new Date().toISOString(), ...args);
    }
  }
};

// TODO: Upgrade to Winston or Pino for production
// - Log levels (trace, debug, info, warn, error, fatal)
// - Log rotation
// - File output
// - JSON format for structured logging
// - Integration with monitoring services

module.exports = logger;



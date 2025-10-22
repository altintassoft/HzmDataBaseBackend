const express = require('express');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Check tables
router.get('/tables', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT schemaname, tablename 
      FROM pg_tables 
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schemaname, tablename;
    `);

    res.json({
      count: result.rows.length,
      tables: result.rows
    });
  } catch (error) {
    logger.error('Check tables error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check schemas
router.get('/schemas', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schema_name;
    `);

    res.json({
      count: result.rows.length,
      schemas: result.rows
    });
  } catch (error) {
    logger.error('Check schemas error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


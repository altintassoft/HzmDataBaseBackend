# 🔍 Search System

> **PostgreSQL full-text search with pg_trgm**

[Ana Sayfa](../README.md) | [APIs](01_Math_APIs.md)

---

## PostgreSQL Full-Text Search

### Enable pg_trgm Extension

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### Add Search Column (app.generic_data)

```sql
-- Already exists in generic_data table
ALTER TABLE app.generic_data 
ADD COLUMN search_text TEXT GENERATED ALWAYS AS (jsonb_to_text(data)) STORED;

CREATE INDEX idx_generic_data_search 
  ON app.generic_data USING GIN(to_tsvector('english', search_text));
```

## Search API

```javascript
// src/routes/search.js
router.get('/search', authenticate, async (req, res) => {
  const { q, table_id, limit = 20, offset = 0 } = req.query;
  const tenantId = req.user.tenant_id;

  // Full-text search
  const result = await pool.query(`
    SELECT 
      id,
      table_id,
      data,
      ts_rank(to_tsvector('english', search_text), plainto_tsquery('english', $1)) AS rank
    FROM app.generic_data
    WHERE tenant_id = $2
      AND ($3::int IS NULL OR table_id = $3)
      AND to_tsvector('english', search_text) @@ plainto_tsquery('english', $1)
      AND is_deleted = FALSE
    ORDER BY rank DESC
    LIMIT $4 OFFSET $5
  `, [q, tenantId, table_id, limit, offset]);

  res.json({
    results: result.rows,
    total: result.rowCount
  });
});
```

## Fuzzy Search (pg_trgm)

```sql
-- Similarity search
SELECT 
  id,
  data,
  similarity(data->>'name', 'iphone') AS similarity_score
FROM app.generic_data
WHERE tenant_id = 1
  AND table_id = 34
  AND data->>'name' % 'iphone'  -- % operator (fuzzy match)
ORDER BY similarity_score DESC
LIMIT 10;
```

## Autocomplete

```javascript
router.get('/autocomplete', authenticate, async (req, res) => {
  const { q, field = 'name', table_id } = req.query;
  
  const result = await pool.query(`
    SELECT DISTINCT data->>$1 AS value
    FROM app.generic_data
    WHERE tenant_id = $2
      AND table_id = $3
      AND data->>$1 ILIKE $4
      AND is_deleted = FALSE
    LIMIT 10
  `, [field, req.user.tenant_id, table_id, `${q}%`]);

  res.json(result.rows.map(r => r.value));
});
```

**[Ana Sayfa](../README.md) | [APIs](01_Math_APIs.md)**



# 📊 Reports & Analytics

> **Materialized Views, Dashboard, Business Intelligence - Scale-ready reporting**

[◀️ Geri: Redis Architecture](13_Redis_Architecture.md) | [Ana Sayfa](README.md) | [İleri: Widget System ▶️](15_Widget_System.md)

---

## 📋 İçindekiler

1. [Report System Architecture](#report-system-architecture)
2. [Materialized Views](#materialized-views)
3. [Report Tables](#report-tables)
4. [Dashboard Design](#dashboard-design)
5. [Export System](#export-system)
6. [Scheduled Reports](#scheduled-reports)
7. [Performance Optimization](#performance-optimization)

---

## Report System Architecture

### 3-Tier Reporting

```
┌─────────────────────────────────────────┐
│  1. Real-time Queries (< 100ms)        │
│     - Simple aggregations               │
│     - Small datasets                    │
│     - Cached results                    │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  2. Materialized Views (< 1s)           │
│     - Pre-aggregated data               │
│     - Periodic refresh (5-60 min)       │
│     - Medium complexity                 │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  3. Batch Reports (minutes)             │
│     - Complex calculations              │
│     - Large datasets                    │
│     - Background jobs                   │
└─────────────────────────────────────────┘
```

---

## Materialized Views

### Why Materialized Views?

| Scenario | Normal Query | Materialized View |
|----------|--------------|-------------------|
| **Sales summary (1M orders)** | 5-10s | 50-100ms ⚡ |
| **Product analytics** | 2-5s | 20-50ms ⚡ |
| **User activity report** | 3-8s | 30-100ms ⚡ |

### Core Materialized Views

#### 1. Sales Summary (Daily)

```sql
-- Create MV
CREATE MATERIALIZED VIEW analytics.tenant_sales_daily AS
SELECT 
  tenant_id,
  DATE_TRUNC('day', created_at) AS date,
  COUNT(*) AS order_count,
  COUNT(DISTINCT customer_id) AS unique_customers,
  SUM(total) AS revenue,
  SUM(tax) AS tax_collected,
  AVG(total) AS avg_order_value,
  MIN(total) AS min_order,
  MAX(total) AS max_order
FROM orders
WHERE is_deleted = FALSE
GROUP BY tenant_id, DATE_TRUNC('day', created_at);

-- Indexes
CREATE UNIQUE INDEX idx_tenant_sales_daily_pk 
  ON analytics.tenant_sales_daily (tenant_id, date);
CREATE INDEX idx_tenant_sales_daily_date 
  ON analytics.tenant_sales_daily (date);

-- Refresh function
CREATE OR REPLACE FUNCTION analytics.refresh_tenant_sales_daily()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.tenant_sales_daily;
END;
$$ LANGUAGE plpgsql;
```

#### 2. Product Performance

```sql
CREATE MATERIALIZED VIEW analytics.product_performance AS
SELECT 
  p.tenant_id,
  p.id AS product_id,
  p.name AS product_name,
  p.sku,
  COUNT(oi.id) AS times_ordered,
  SUM(oi.quantity) AS units_sold,
  SUM(oi.subtotal) AS revenue,
  AVG(oi.price) AS avg_price,
  COUNT(DISTINCT o.customer_id) AS unique_buyers,
  MAX(o.created_at) AS last_order_date
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.id
WHERE p.is_deleted = FALSE
GROUP BY p.tenant_id, p.id, p.name, p.sku;

CREATE UNIQUE INDEX idx_product_perf_pk 
  ON analytics.product_performance (tenant_id, product_id);
CREATE INDEX idx_product_perf_revenue 
  ON analytics.product_performance (tenant_id, revenue DESC);
```

#### 3. Customer Lifetime Value (CLV)

```sql
CREATE MATERIALIZED VIEW analytics.customer_ltv AS
SELECT 
  c.tenant_id,
  c.id AS customer_id,
  c.email,
  c.created_at AS first_purchase_date,
  COUNT(o.id) AS total_orders,
  SUM(o.total) AS lifetime_value,
  AVG(o.total) AS avg_order_value,
  MAX(o.created_at) AS last_order_date,
  EXTRACT(EPOCH FROM (MAX(o.created_at) - MIN(o.created_at))) / 86400 AS customer_age_days
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
WHERE c.is_deleted = FALSE
GROUP BY c.tenant_id, c.id, c.email, c.created_at;

CREATE UNIQUE INDEX idx_customer_ltv_pk 
  ON analytics.customer_ltv (tenant_id, customer_id);
CREATE INDEX idx_customer_ltv_value 
  ON analytics.customer_ltv (tenant_id, lifetime_value DESC);
```

#### 4. User Activity Summary

```sql
CREATE MATERIALIZED VIEW analytics.user_activity_summary AS
SELECT 
  tenant_id,
  user_id,
  DATE_TRUNC('day', created_at) AS date,
  COUNT(*) AS total_actions,
  COUNT(DISTINCT activity_type) AS unique_action_types,
  jsonb_object_agg(activity_type, action_count) AS actions_breakdown
FROM (
  SELECT 
    tenant_id,
    user_id,
    created_at,
    activity_type,
    COUNT(*) AS action_count
  FROM ops.user_activities
  GROUP BY tenant_id, user_id, created_at, activity_type
) sub
GROUP BY tenant_id, user_id, DATE_TRUNC('day', created_at);

CREATE UNIQUE INDEX idx_user_activity_pk 
  ON analytics.user_activity_summary (tenant_id, user_id, date);
```

### Refresh Strategy

#### Incremental Refresh

```sql
-- Incremental refresh (last 7 days)
CREATE OR REPLACE FUNCTION analytics.refresh_sales_incremental()
RETURNS void AS $$
BEGIN
  -- Delete recent data
  DELETE FROM analytics.tenant_sales_daily
  WHERE date >= CURRENT_DATE - INTERVAL '7 days';
  
  -- Insert fresh data
  INSERT INTO analytics.tenant_sales_daily
  SELECT 
    tenant_id,
    DATE_TRUNC('day', created_at) AS date,
    COUNT(*) AS order_count,
    COUNT(DISTINCT customer_id) AS unique_customers,
    SUM(total) AS revenue,
    SUM(tax) AS tax_collected,
    AVG(total) AS avg_order_value,
    MIN(total) AS min_order,
    MAX(total) AS max_order
  FROM orders
  WHERE is_deleted = FALSE
    AND created_at >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY tenant_id, DATE_TRUNC('day', created_at);
END;
$$ LANGUAGE plpgsql;
```

#### Scheduled Refresh (Cron)

```javascript
// workers/mvRefreshWorker.js
const cron = require('node-cron');

// Refresh every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  console.log('Refreshing materialized views...');
  
  await pool.query('SELECT analytics.refresh_tenant_sales_daily()');
  await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.product_performance');
  await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.customer_ltv');
  
  console.log('Materialized views refreshed!');
});

// Heavy refresh (hourly)
cron.schedule('0 * * * *', async () => {
  await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.user_activity_summary');
});
```

---

## Report Tables

### Pre-aggregated Report Tables

```sql
-- Monthly sales rollup
CREATE TABLE analytics.monthly_sales_rollup (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  
  -- Metrics
  order_count INTEGER,
  revenue NUMERIC(15,2),
  tax NUMERIC(15,2),
  shipping NUMERIC(15,2),
  discounts NUMERIC(15,2),
  unique_customers INTEGER,
  avg_order_value NUMERIC(10,2),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE (tenant_id, year, month)
);

CREATE INDEX idx_monthly_sales_tenant ON analytics.monthly_sales_rollup(tenant_id);
CREATE INDEX idx_monthly_sales_date ON analytics.monthly_sales_rollup(year, month);

-- Populate monthly rollup (background job)
CREATE OR REPLACE FUNCTION analytics.populate_monthly_rollup(p_year INT, p_month INT)
RETURNS void AS $$
BEGIN
  INSERT INTO analytics.monthly_sales_rollup (
    tenant_id, year, month,
    order_count, revenue, tax, shipping, discounts,
    unique_customers, avg_order_value
  )
  SELECT 
    tenant_id,
    p_year,
    p_month,
    COUNT(*),
    SUM(total),
    SUM(tax),
    SUM(shipping),
    SUM(discount),
    COUNT(DISTINCT customer_id),
    AVG(total)
  FROM orders
  WHERE EXTRACT(YEAR FROM created_at) = p_year
    AND EXTRACT(MONTH FROM created_at) = p_month
    AND is_deleted = FALSE
  GROUP BY tenant_id
  ON CONFLICT (tenant_id, year, month)
  DO UPDATE SET
    order_count = EXCLUDED.order_count,
    revenue = EXCLUDED.revenue,
    updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;
```

---

## Dashboard Design

### Dashboard Configuration

```sql
CREATE TABLE dashboards (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  user_id INTEGER REFERENCES users(id),
  
  name VARCHAR(200) NOT NULL,
  description TEXT,
  layout JSONB NOT NULL,  -- Grid layout config
  
  is_default BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_dashboard_name UNIQUE (tenant_id, user_id, name)
);

-- Layout example
/*
{
  "grid": {
    "cols": 12,
    "rows": "auto"
  },
  "widgets": [
    {
      "id": "widget-1",
      "type": "metric",
      "title": "Total Revenue",
      "position": { "x": 0, "y": 0, "w": 3, "h": 2 },
      "config": {
        "query": "SELECT SUM(total) FROM orders WHERE ..."
      }
    },
    {
      "id": "widget-2",
      "type": "chart",
      "title": "Sales Trend",
      "position": { "x": 3, "y": 0, "w": 6, "h": 4 },
      "config": {
        "chartType": "line",
        "dataSource": "analytics.tenant_sales_daily"
      }
    }
  ]
}
*/
```

### Dashboard API

```javascript
// routes/dashboards.js
router.get('/dashboards/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  
  // Get dashboard config
  const dashboard = await getDashboard(req.tenant_id, id);
  
  // Load widget data (parallel)
  const widgetData = await Promise.all(
    dashboard.layout.widgets.map(async (widget) => {
      const data = await loadWidgetData(req.tenant_id, widget);
      return { id: widget.id, data };
    })
  );
  
  res.json({
    success: true,
    dashboard,
    widgets: widgetData
  });
});

async function loadWidgetData(tenantId, widget) {
  const cacheKey = `widget:${widget.id}:${tenantId}`;
  
  // Try cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Execute query
  const data = await executeWidgetQuery(tenantId, widget.config);
  
  // Cache result (5 minutes)
  await redis.setex(cacheKey, 300, JSON.stringify(data));
  
  return data;
}
```

---

## Export System

### Export to CSV

```javascript
// services/exportService.js
const { Parser } = require('json2csv');

class ExportService {
  /**
   * Export query results to CSV
   */
  async exportToCSV(query, params, filename) {
    const result = await pool.query(query, params);
    
    const parser = new Parser();
    const csv = parser.parse(result.rows);
    
    return {
      content: csv,
      filename,
      mimetype: 'text/csv'
    };
  }
  
  /**
   * Export report (background job)
   */
  async exportReport(tenantId, reportType, params) {
    const jobId = await reportQueue.add('export-report', {
      tenant_id: tenantId,
      report_type: reportType,
      params,
      format: params.format || 'csv'
    });
    
    return { job_id: jobId };
  }
}
```

### Export Worker

```javascript
// workers/exportWorker.js
new Worker('report', async (job) => {
  const { tenant_id, report_type, params, format } = job.data;
  
  // Generate report
  const data = await generateReport(tenant_id, report_type, params);
  
  // Export to file
  let file;
  if (format === 'csv') {
    file = await exportToCSV(data);
  } else if (format === 'excel') {
    file = await exportToExcel(data);
  } else if (format === 'pdf') {
    file = await exportToPDF(data);
  }
  
  // Upload to S3
  const fileUrl = await uploadToS3(file, `reports/${tenant_id}/${job.id}.${format}`);
  
  // Notify user
  await sendNotification(tenant_id, {
    type: 'report_ready',
    message: `Your ${report_type} report is ready!`,
    download_url: fileUrl
  });
  
  return { file_url: fileUrl };
}, {
  concurrency: 2  // Max 2 reports at once
});
```

---

## Scheduled Reports

### Scheduled Report Configuration

```sql
CREATE TABLE scheduled_reports (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  
  name VARCHAR(200) NOT NULL,
  report_type VARCHAR(100) NOT NULL,
  params JSONB,
  
  schedule VARCHAR(100) NOT NULL,  -- Cron expression: '0 9 * * 1' (Mon 9am)
  timezone VARCHAR(50) DEFAULT 'UTC',
  format VARCHAR(10) DEFAULT 'csv',  -- csv, excel, pdf
  
  recipients TEXT[] NOT NULL,  -- Email addresses
  
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scheduled_reports_next_run 
  ON scheduled_reports(next_run_at) 
  WHERE is_active = TRUE;
```

### Scheduler Worker

```javascript
// workers/reportScheduler.js
setInterval(async () => {
  // Find due reports
  const dueReports = await pool.query(`
    SELECT * FROM scheduled_reports
    WHERE is_active = TRUE
      AND next_run_at <= CURRENT_TIMESTAMP
    ORDER BY next_run_at
    LIMIT 100
  `);
  
  for (const report of dueReports.rows) {
    // Queue report generation
    await reportQueue.add('scheduled-report', {
      report_id: report.id,
      tenant_id: report.tenant_id,
      report_type: report.report_type,
      params: report.params,
      format: report.format,
      recipients: report.recipients
    });
    
    // Calculate next run
    const nextRun = calculateNextRun(report.schedule, report.timezone);
    
    // Update schedule
    await pool.query(`
      UPDATE scheduled_reports
      SET last_run_at = CURRENT_TIMESTAMP,
          next_run_at = $1
      WHERE id = $2
    `, [nextRun, report.id]);
  }
}, 60000);  // Check every minute
```

---

## Performance Optimization

### Query Optimization

```sql
-- Bad: Full table scan
SELECT * FROM orders WHERE tenant_id = 10;  -- 5s

-- Good: Use MV
SELECT * FROM analytics.tenant_sales_daily 
WHERE tenant_id = 10;  -- 50ms

-- Better: Use report table
SELECT * FROM analytics.monthly_sales_rollup 
WHERE tenant_id = 10;  -- 10ms
```

### Partitioning (Large Tables)

```sql
-- Partition audit_logs by month
CREATE TABLE ops.audit_logs (
  id BIGSERIAL NOT NULL,
  tenant_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  ...
) PARTITION BY RANGE (created_at);

-- Create partitions
CREATE TABLE ops.audit_logs_2025_01 
  PARTITION OF ops.audit_logs
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE ops.audit_logs_2025_02 
  PARTITION OF ops.audit_logs
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- Auto-create partitions (function)
CREATE OR REPLACE FUNCTION ops.create_audit_log_partition(p_date DATE)
RETURNS void AS $$
DECLARE
  partition_name TEXT;
  start_date DATE;
  end_date DATE;
BEGIN
  partition_name := 'audit_logs_' || TO_CHAR(p_date, 'YYYY_MM');
  start_date := DATE_TRUNC('month', p_date);
  end_date := start_date + INTERVAL '1 month';
  
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS ops.%I PARTITION OF ops.audit_logs FOR VALUES FROM (%L) TO (%L)',
    partition_name, start_date, end_date
  );
END;
$$ LANGUAGE plpgsql;

-- Cron job: create next month partition
cron.schedule('0 0 1 * *', async () => {
  await pool.query('SELECT ops.create_audit_log_partition(CURRENT_DATE + INTERVAL ''1 month'')');
});
```

---

## Best Practices

### ✅ DO

1. **Use MV for repeated queries** - 10x-100x faster
2. **Refresh incrementally** - Only recent data
3. **Cache results** - Redis 5 minutes
4. **Partition large tables** - Audit logs, usage records
5. **Export via background jobs** - Don't block API
6. **Set query timeout** - Max 30s for reports
7. **Monitor MV size** - Alert if > 10GB

### ❌ DON'T

1. **Don't query raw tables** - Use MV!
2. **Don't refresh too often** - Max every 5 minutes
3. **Don't block API** - Queue heavy reports
4. **Don't forget indexes** - MV needs indexes too
5. **Don't ignore cache** - Redis saves DB load

---

## 🔗 İlgili Dökümanlar

- [13_Redis_Architecture.md](13_Redis_Architecture.md) - Cache strategy
- [15_Widget_System.md](15_Widget_System.md) - Dashboard widgets
- [16_Job_Queue_System.md](16_Job_Queue_System.md) - Background reports

---

**Versiyon:** 1.0.0  
**Tarih:** Ekim 2025  
**Yazar:** HZM Development Team

---

**[◀️ Geri: Redis Architecture](13_Redis_Architecture.md) | [Ana Sayfa](README.md) | [İleri: Widget System ▶️](15_Widget_System.md)**


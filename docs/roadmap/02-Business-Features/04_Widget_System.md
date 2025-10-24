# 🎛️ Widget System

> **Dashboard widget architecture - Configurable, reusable, cacheable**

[◀️ Geri: Reports & Analytics](14_Reports_Analytics.md) | [Ana Sayfa](README.md) | [İleri: Job Queue System ▶️](16_Job_Queue_System.md)

---

## 📋 İçindekiler

1. [Widget Architecture](#widget-architecture)
2. [Widget Types](#widget-types)
3. [Widget Registry](#widget-registry)
4. [Data Sources](#data-sources)
5. [Widget Configuration](#widget-configuration)
6. [Frontend Integration](#frontend-integration)
7. [Custom Widgets](#custom-widgets)

---

## Widget Architecture

### Widget Lifecycle

```
┌─────────────────────────────────────────┐
│  1. Widget Definition (Registry)        │
│     - Type, config schema               │
│     - Data source template              │
│     - Refresh interval                  │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  2. Widget Instance (Dashboard)         │
│     - User config (filters, params)     │
│     - Position & size                   │
│     - Permissions                       │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  3. Data Fetching (Cache + Query)       │
│     - Check Redis cache                 │
│     - Execute query if miss             │
│     - Transform & return                │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  4. Rendering (Frontend)                │
│     - Apply config                      │
│     - Render chart/table/metric         │
│     - Handle interactions               │
└─────────────────────────────────────────┘
```

---

## Widget Types

### 1. Metric Widget

```typescript
interface MetricWidget {
  type: 'metric';
  config: {
    title: string;
    value: number;
    format: 'number' | 'currency' | 'percentage';
    currency?: string;
    trend?: {
      value: number;  // -5.2
      direction: 'up' | 'down';
    };
    icon?: string;
    color?: string;
  };
}
```

**Example:**
```json
{
  "type": "metric",
  "title": "Total Revenue",
  "value": 45230.50,
  "format": "currency",
  "currency": "USD",
  "trend": {
    "value": 12.3,
    "direction": "up"
  },
  "icon": "dollar-sign",
  "color": "green"
}
```

### 2. Chart Widget

```typescript
interface ChartWidget {
  type: 'chart';
  config: {
    title: string;
    chartType: 'line' | 'bar' | 'pie' | 'area' | 'donut';
    data: {
      labels: string[];
      datasets: {
        label: string;
        data: number[];
        backgroundColor?: string;
        borderColor?: string;
      }[];
    };
    options?: {
      responsive: boolean;
      maintainAspectRatio: boolean;
      legend?: { display: boolean; position: string };
      tooltip?: { enabled: boolean };
    };
  };
}
```

**Example:**
```json
{
  "type": "chart",
  "title": "Sales Trend (Last 30 Days)",
  "chartType": "line",
  "data": {
    "labels": ["Jan 1", "Jan 2", "Jan 3", ...],
    "datasets": [{
      "label": "Revenue",
      "data": [1200, 1900, 1500, ...],
      "borderColor": "#3b82f6"
    }]
  }
}
```

### 3. Table Widget

```typescript
interface TableWidget {
  type: 'table';
  config: {
    title: string;
    columns: {
      key: string;
      label: string;
      sortable?: boolean;
      format?: 'text' | 'number' | 'currency' | 'date';
    }[];
    data: Record<string, any>[];
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
    };
    actions?: {
      label: string;
      action: string;
      icon?: string;
    }[];
  };
}
```

### 4. List Widget

```typescript
interface ListWidget {
  type: 'list';
  config: {
    title: string;
    items: {
      id: string;
      title: string;
      subtitle?: string;
      value?: string | number;
      icon?: string;
      link?: string;
    }[];
    maxItems?: number;
    showMore?: boolean;
  };
}
```

### 5. Map Widget

```typescript
interface MapWidget {
  type: 'map';
  config: {
    title: string;
    center: { lat: number; lng: number };
    zoom: number;
    markers: {
      id: string;
      position: { lat: number; lng: number };
      title: string;
      description?: string;
      icon?: string;
    }[];
  };
}
```

---

## Widget Registry

### Database Schema

```sql
CREATE TABLE widget_types (
  id SERIAL PRIMARY KEY,
  
  -- Basic info
  type VARCHAR(50) UNIQUE NOT NULL,  -- 'metric', 'chart', 'table'
  name VARCHAR(200) NOT NULL,
  description TEXT,
  icon VARCHAR(100),
  category VARCHAR(50),  -- 'sales', 'users', 'inventory'
  
  -- Config
  config_schema JSONB NOT NULL,  -- JSON Schema
  data_source_template TEXT NOT NULL,  -- SQL template
  default_config JSONB,
  
  -- Behavior
  refresh_interval INTEGER DEFAULT 300,  -- 5 minutes
  cache_ttl INTEGER DEFAULT 300,
  requires_permissions TEXT[],
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  is_system BOOLEAN DEFAULT FALSE,  -- System vs custom
  version VARCHAR(20) DEFAULT '1.0.0',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Widget instances
CREATE TABLE widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  dashboard_id INTEGER REFERENCES dashboards(id),
  
  -- Widget config
  widget_type VARCHAR(50) NOT NULL REFERENCES widget_types(type),
  title VARCHAR(200),
  config JSONB NOT NULL,
  
  -- Layout
  position JSONB,  -- { x, y, w, h }
  
  -- Data source
  data_source TEXT,  -- Custom SQL (optional)
  filters JSONB,     -- Runtime filters
  
  -- Behavior
  refresh_interval INTEGER,
  auto_refresh BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id)
);

CREATE INDEX idx_widgets_tenant ON widgets(tenant_id);
CREATE INDEX idx_widgets_dashboard ON widgets(dashboard_id);
CREATE INDEX idx_widgets_type ON widgets(widget_type);
```

### Seed Widget Types

```sql
-- 1. Revenue Metric
INSERT INTO widget_types (type, name, description, category, config_schema, data_source_template) VALUES
('revenue-metric', 'Revenue Metric', 'Total revenue with trend', 'sales', 
'{
  "type": "object",
  "properties": {
    "period": { "type": "string", "enum": ["today", "week", "month", "year"] },
    "currency": { "type": "string", "default": "USD" }
  }
}',
'SELECT 
  SUM(total) AS value,
  COUNT(*) AS count,
  ROUND((SUM(total) - LAG(SUM(total)) OVER (ORDER BY period)) / LAG(SUM(total)) OVER (ORDER BY period) * 100, 2) AS trend
FROM orders
WHERE tenant_id = {{tenant_id}}
  AND created_at >= {{start_date}}
  AND created_at < {{end_date}}');

-- 2. Sales Chart
INSERT INTO widget_types (type, name, description, category, config_schema, data_source_template) VALUES
('sales-chart', 'Sales Chart', 'Sales trend over time', 'sales',
'{
  "type": "object",
  "properties": {
    "chartType": { "type": "string", "enum": ["line", "bar", "area"], "default": "line" },
    "period": { "type": "string", "enum": ["day", "week", "month"], "default": "day" },
    "days": { "type": "integer", "minimum": 7, "maximum": 365, "default": 30 }
  }
}',
'SELECT 
  DATE_TRUNC(''{{period}}'', created_at) AS date,
  SUM(total) AS revenue,
  COUNT(*) AS orders
FROM orders
WHERE tenant_id = {{tenant_id}}
  AND created_at >= CURRENT_DATE - INTERVAL ''{{days}} days''
  AND is_deleted = FALSE
GROUP BY DATE_TRUNC(''{{period}}'', created_at)
ORDER BY date');

-- 3. Top Products Table
INSERT INTO widget_types (type, name, description, category, config_schema, data_source_template) VALUES
('top-products', 'Top Products', 'Best selling products', 'products',
'{
  "type": "object",
  "properties": {
    "limit": { "type": "integer", "minimum": 5, "maximum": 100, "default": 10 },
    "orderBy": { "type": "string", "enum": ["revenue", "quantity", "orders"], "default": "revenue" }
  }
}',
'SELECT 
  p.id,
  p.name,
  p.sku,
  SUM(oi.quantity) AS units_sold,
  SUM(oi.subtotal) AS revenue,
  COUNT(DISTINCT oi.order_id) AS order_count
FROM products p
JOIN order_items oi ON p.id = oi.product_id
WHERE p.tenant_id = {{tenant_id}}
  AND p.is_deleted = FALSE
GROUP BY p.id, p.name, p.sku
ORDER BY {{orderBy}} DESC
LIMIT {{limit}}');
```

---

## Data Sources

### Query Template Engine

```javascript
// services/widgetDataService.js
class WidgetDataService {
  /**
   * Execute widget query with parameters
   */
  async executeWidgetQuery(tenantId, userId, widget) {
    const widgetType = await getWidgetType(widget.widget_type);
    
    // Build query from template
    const query = this.buildQuery(widgetType.data_source_template, {
      tenant_id: tenantId,
      user_id: userId,
      ...widget.config,
      ...widget.filters
    });
    
    // Check cache
    const cacheKey = this.getCacheKey(tenantId, widget.id, widget.config);
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Execute query
    const result = await pool.query(query);
    
    // Transform data
    const data = this.transformData(result.rows, widget.widget_type);
    
    // Cache result
    const ttl = widget.refresh_interval || widgetType.cache_ttl || 300;
    await redis.setex(cacheKey, ttl, JSON.stringify(data));
    
    return data;
  }
  
  /**
   * Build query from template
   */
  buildQuery(template, params) {
    let query = template;
    
    // Replace placeholders
    for (const [key, value] of Object.entries(params)) {
      const placeholder = `{{${key}}}`;
      query = query.replace(new RegExp(placeholder, 'g'), value);
    }
    
    // Add date calculations
    if (params.period === 'today') {
      query = query.replace('{{start_date}}', 'CURRENT_DATE');
      query = query.replace('{{end_date}}', 'CURRENT_DATE + INTERVAL ''1 day''');
    } else if (params.period === 'week') {
      query = query.replace('{{start_date}}', 'CURRENT_DATE - INTERVAL ''7 days''');
      query = query.replace('{{end_date}}', 'CURRENT_DATE');
    }
    
    return query;
  }
  
  /**
   * Transform query results to widget format
   */
  transformData(rows, widgetType) {
    switch (widgetType) {
      case 'revenue-metric':
        return {
          value: rows[0]?.value || 0,
          trend: rows[0]?.trend || 0
        };
        
      case 'sales-chart':
        return {
          labels: rows.map(r => r.date),
          datasets: [{
            label: 'Revenue',
            data: rows.map(r => r.revenue)
          }]
        };
        
      case 'top-products':
        return {
          columns: ['name', 'sku', 'units_sold', 'revenue'],
          data: rows
        };
        
      default:
        return rows;
    }
  }
  
  /**
   * Get cache key
   */
  getCacheKey(tenantId, widgetId, config) {
    const configHash = crypto
      .createHash('md5')
      .update(JSON.stringify(config))
      .digest('hex');
    
    return `hzm:${process.env.NODE_ENV}:tenant:${tenantId}:widget:${widgetId}:${configHash}`;
  }
}
```

---

## Widget Configuration

### Widget Config UI Schema

```typescript
// Widget configuration form schema
interface WidgetConfigSchema {
  title: string;
  description?: string;
  fields: {
    name: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'checkbox' | 'date' | 'color';
    options?: { label: string; value: any }[];
    default?: any;
    required?: boolean;
    validation?: {
      min?: number;
      max?: number;
      pattern?: string;
    };
  }[];
}
```

### Example Config Forms

```javascript
// Revenue Metric Config
const revenueMetricConfig = {
  title: 'Revenue Metric Configuration',
  fields: [
    {
      name: 'period',
      label: 'Time Period',
      type: 'select',
      options: [
        { label: 'Today', value: 'today' },
        { label: 'This Week', value: 'week' },
        { label: 'This Month', value: 'month' },
        { label: 'This Year', value: 'year' }
      ],
      default: 'month',
      required: true
    },
    {
      name: 'currency',
      label: 'Currency',
      type: 'select',
      options: [
        { label: 'USD ($)', value: 'USD' },
        { label: 'EUR (€)', value: 'EUR' },
        { label: 'TRY (₺)', value: 'TRY' }
      ],
      default: 'USD'
    },
    {
      name: 'showTrend',
      label: 'Show Trend',
      type: 'checkbox',
      default: true
    }
  ]
};

// Sales Chart Config
const salesChartConfig = {
  title: 'Sales Chart Configuration',
  fields: [
    {
      name: 'chartType',
      label: 'Chart Type',
      type: 'select',
      options: [
        { label: 'Line', value: 'line' },
        { label: 'Bar', value: 'bar' },
        { label: 'Area', value: 'area' }
      ],
      default: 'line'
    },
    {
      name: 'days',
      label: 'Days to Show',
      type: 'number',
      default: 30,
      validation: { min: 7, max: 365 }
    },
    {
      name: 'color',
      label: 'Line Color',
      type: 'color',
      default: '#3b82f6'
    }
  ]
};
```

---

## Frontend Integration

### React Widget Component

```typescript
// components/Widget.tsx
interface WidgetProps {
  widget: Widget;
  onRefresh?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const Widget: React.FC<WidgetProps> = ({ widget, onRefresh, onEdit, onDelete }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadWidgetData();
    
    // Auto-refresh
    if (widget.auto_refresh && widget.refresh_interval) {
      const interval = setInterval(loadWidgetData, widget.refresh_interval * 1000);
      return () => clearInterval(interval);
    }
  }, [widget.id, widget.config]);
  
  async function loadWidgetData() {
    setLoading(true);
    try {
      const response = await api.get(`/widgets/${widget.id}/data`);
      setData(response.data);
    } catch (error) {
      console.error('Failed to load widget data:', error);
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <div className="widget-container">
      <div className="widget-header">
        <h3>{widget.title}</h3>
        <div className="widget-actions">
          <button onClick={loadWidgetData}>
            <RefreshIcon />
          </button>
          <button onClick={onEdit}>
            <EditIcon />
          </button>
          <button onClick={onDelete}>
            <DeleteIcon />
          </button>
        </div>
      </div>
      
      <div className="widget-body">
        {loading ? (
          <Loader />
        ) : (
          <WidgetRenderer type={widget.widget_type} data={data} config={widget.config} />
        )}
      </div>
    </div>
  );
};
```

### Widget Renderer

```typescript
// components/WidgetRenderer.tsx
const WidgetRenderer: React.FC<{ type: string; data: any; config: any }> = ({ type, data, config }) => {
  switch (type) {
    case 'metric':
    case 'revenue-metric':
      return <MetricWidget data={data} config={config} />;
      
    case 'chart':
    case 'sales-chart':
      return <ChartWidget data={data} config={config} />;
      
    case 'table':
    case 'top-products':
      return <TableWidget data={data} config={config} />;
      
    case 'list':
      return <ListWidget data={data} config={config} />;
      
    case 'map':
      return <MapWidget data={data} config={config} />;
      
    default:
      return <div>Unknown widget type: {type}</div>;
  }
};
```

---

## Custom Widgets

### Creating Custom Widget Type

```javascript
// POST /api/v1/admin/widget-types
{
  "type": "custom-kpi",
  "name": "Custom KPI",
  "description": "Custom KPI metric",
  "category": "custom",
  "config_schema": {
    "type": "object",
    "properties": {
      "metric": { "type": "string" },
      "target": { "type": "number" }
    }
  },
  "data_source_template": "SELECT {{metric}} AS value FROM {{table}} WHERE tenant_id = {{tenant_id}}",
  "refresh_interval": 600
}
```

### Widget Marketplace (Future)

```typescript
interface WidgetMarketplace {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  price: number;  // 0 = free
  downloads: number;
  rating: number;
  screenshots: string[];
  tags: string[];
}
```

---

## Best Practices

### ✅ DO

1. **Cache aggressively** - 5-10 minute TTL
2. **Use MV for data** - Don't query raw tables
3. **Limit result size** - Max 1000 rows
4. **Set query timeout** - Max 10s
5. **Validate config** - JSON Schema validation
6. **Auto-refresh wisely** - Min 60s interval
7. **Permissions check** - Widget-level permissions

### ❌ DON'T

1. **Don't query without cache** - Always check Redis first
2. **Don't allow arbitrary SQL** - Use templates only
3. **Don't refresh too fast** - Min 60s
4. **Don't return huge datasets** - Pagination!
5. **Don't forget indexes** - Widget queries need indexes

---

## 🔗 İlgili Dökümanlar

- [13_Redis_Architecture.md](13_Redis_Architecture.md) - Widget state cache
- [14_Reports_Analytics.md](14_Reports_Analytics.md) - Data sources
- [02_Core_Database_Schema.md](02_Core_Database_Schema.md) - Widget tables

---

**Versiyon:** 1.0.0  
**Tarih:** Ekim 2025  
**Yazar:** HZM Development Team

---

**[◀️ Geri: Reports & Analytics](14_Reports_Analytics.md) | [Ana Sayfa](README.md) | [İleri: Job Queue System ▶️](16_Job_Queue_System.md)**


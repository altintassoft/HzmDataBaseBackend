# 🔍 Backend Log Viewer - Production Log Monitoring System

**Tarih:** 29 Ekim 2025  
**Durum:** 📋 Planlandı (Gelecek Sprint)  
**Öncelik:** P2 (Nice-to-have)  
**Tahmini Süre:** 2-3 gün

---

## 🎯 AMAÇ

Railway deployment log'larını **frontend'de** görüntüleyebilmek:
- ✅ Yazılımcılar için deployment takibi
- ✅ Hata ayıklama (error logs)
- ✅ Performans izleme (slow queries)
- ✅ Migration tracking
- ✅ API request monitoring

**Neden gerekli:**
- ❌ Railway Dashboard'a girmek zahmetli
- ❌ Log'lar dağınık, filtreleme zor
- ✅ Frontend'de hızlı erişim
- ✅ Takım üyeleri kolayca görebilir

---

## 🗃️ VERİTABANI ŞEMASI

### **Migration: 017_create_deployment_logs.sql**

```sql
-- ============================================================================
-- DEPLOYMENT LOGS TABLE
-- Purpose: Store backend logs for frontend monitoring
-- ============================================================================

CREATE TABLE IF NOT EXISTS ops.deployment_logs (
  -- Primary Key
  id BIGSERIAL PRIMARY KEY,
  
  -- Deployment Info
  deployment_id VARCHAR(50),                    -- Railway deployment ID
  deployment_env VARCHAR(20) DEFAULT 'production', -- production, staging, development
  
  -- Log Details
  log_level VARCHAR(20) NOT NULL,              -- debug, info, warn, error
  category VARCHAR(50),                         -- migration, api, auth, database, github, compliance
  message TEXT NOT NULL,                        -- Log mesajı
  
  -- Error Details
  error_code VARCHAR(50),                       -- HTTP status code, SQL error code
  stack_trace TEXT,                             -- Full stack trace (error ise)
  
  -- Request Context (API logs için)
  request_method VARCHAR(10),                   -- GET, POST, PUT, DELETE
  request_path VARCHAR(255),                    -- /api/v1/admin/database
  request_duration INTEGER,                     -- Milliseconds
  
  -- User Context
  user_id INTEGER REFERENCES core.users(id),
  user_email VARCHAR(255),
  user_role VARCHAR(50),
  tenant_id INTEGER,
  
  -- Metadata (JSONB for flexibility)
  metadata JSONB,                               -- { query, params, response_size, etc }
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Index Hints
  CONSTRAINT chk_log_level CHECK (log_level IN ('debug', 'info', 'warn', 'error'))
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Performance indexes
CREATE INDEX idx_deployment_logs_created ON ops.deployment_logs(created_at DESC);
CREATE INDEX idx_deployment_logs_level ON ops.deployment_logs(log_level);
CREATE INDEX idx_deployment_logs_category ON ops.deployment_logs(category);
CREATE INDEX idx_deployment_logs_deployment ON ops.deployment_logs(deployment_id);
CREATE INDEX idx_deployment_logs_user ON ops.deployment_logs(user_id);

-- Composite indexes for common queries
CREATE INDEX idx_deployment_logs_level_created ON ops.deployment_logs(log_level, created_at DESC);
CREATE INDEX idx_deployment_logs_category_created ON ops.deployment_logs(category, created_at DESC);

-- Full-text search
CREATE INDEX idx_deployment_logs_message ON ops.deployment_logs USING GIN(to_tsvector('english', message));

-- ============================================================================
-- LOG RETENTION POLICY (Auto-cleanup)
-- ============================================================================

-- Function to delete old logs (keep last 30 days)
CREATE OR REPLACE FUNCTION ops.cleanup_old_deployment_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM ops.deployment_logs
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule: Run daily (Railway cron job or manual trigger)
-- Alternatively: Use pg_cron extension if available
```

---

## 🔧 BACKEND İMPLEMENTASYON

### **1. Winston PostgreSQL Transport**

```javascript
// src/core/logger/postgres-transport.js

const { pool } = require('../config/database');

class PostgresTransport {
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.tableName = options.tableName || 'ops.deployment_logs';
  }

  async log(info, callback) {
    const { level, message, ...metadata } = info;
    
    try {
      // Don't log DB writes to avoid infinite loop
      if (message.includes('INSERT INTO ops.deployment_logs')) {
        return callback();
      }

      // Extract metadata
      const category = metadata.category || 'general';
      const errorCode = metadata.error?.code || metadata.statusCode || null;
      const stackTrace = metadata.error?.stack || null;
      const requestMethod = metadata.method || null;
      const requestPath = metadata.path || null;
      const requestDuration = metadata.duration || null;
      const userId = metadata.user?.id || null;
      const userEmail = metadata.user?.email || null;
      const userRole = metadata.user?.role || null;
      const tenantId = metadata.user?.tenant_id || null;
      
      // Clean metadata (remove already extracted fields)
      const cleanMetadata = { ...metadata };
      delete cleanMetadata.category;
      delete cleanMetadata.error;
      delete cleanMetadata.method;
      delete cleanMetadata.path;
      delete cleanMetadata.duration;
      delete cleanMetadata.user;
      delete cleanMetadata.statusCode;
      
      await pool.query(`
        INSERT INTO ops.deployment_logs (
          log_level, category, message, error_code, stack_trace,
          request_method, request_path, request_duration,
          user_id, user_email, user_role, tenant_id, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        level,
        category,
        message,
        errorCode,
        stackTrace,
        requestMethod,
        requestPath,
        requestDuration,
        userId,
        userEmail,
        userRole,
        tenantId,
        JSON.stringify(cleanMetadata)
      ]);

    } catch (error) {
      // Silent fail - don't crash on logging errors
      console.error('Failed to write log to database:', error);
    }

    callback();
  }
}

module.exports = PostgresTransport;
```

### **2. Logger Integration**

```javascript
// src/core/logger/index.js

const winston = require('winston');
const PostgresTransport = require('./postgres-transport');

const logger = winston.createLogger({
  level: 'info',
  transports: [
    new winston.transports.Console(),
    
    // PostgreSQL transport (production only)
    ...(process.env.NODE_ENV === 'production' ? [
      new PostgresTransport({
        level: 'info',  // info, warn, error
        tableName: 'ops.deployment_logs'
      })
    ] : [])
  ]
});

module.exports = logger;
```

### **3. Backend API Endpoints**

```javascript
// admin.controller.js

/**
 * GET /api/v1/admin/deployment-logs
 * Get deployment logs with filters
 */
static async getDeploymentLogs(req, res) {
  try {
    const {
      level,      // error, warn, info
      category,   // migration, api, auth
      limit = 100,
      offset = 0,
      startDate,
      endDate,
      search
    } = req.query;
    
    let whereClause = '1=1';
    const params = [];
    
    if (level) {
      params.push(level);
      whereClause += ` AND log_level = $${params.length}`;
    }
    
    if (category) {
      params.push(category);
      whereClause += ` AND category = $${params.length}`;
    }
    
    if (startDate) {
      params.push(startDate);
      whereClause += ` AND created_at >= $${params.length}`;
    }
    
    if (endDate) {
      params.push(endDate);
      whereClause += ` AND created_at <= $${params.length}`;
    }
    
    if (search) {
      params.push(search);
      whereClause += ` AND message ILIKE $${params.length}`;
    }
    
    const query = `
      SELECT 
        id, log_level, category, message, error_code,
        request_method, request_path, request_duration,
        user_email, user_role, created_at
      FROM ops.deployment_logs
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    const result = await pool.query(query, params);
    
    // Get total count
    const countQuery = `SELECT COUNT(*) FROM ops.deployment_logs WHERE ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    
    res.json({
      success: true,
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset
    });
    
  } catch (error) {
    logger.error('Failed to get deployment logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/v1/admin/deployment-logs/:id
 * Get single log with full details (stack trace)
 */
static async getDeploymentLogDetail(req, res) {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT * FROM ops.deployment_logs WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Log not found'
      });
    }
    
    res.json({
      success: true,
      log: result.rows[0]
    });
    
  } catch (error) {
    logger.error('Failed to get log detail:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * DELETE /api/v1/admin/deployment-logs/cleanup
 * Manually trigger log cleanup (delete logs older than 30 days)
 */
static async cleanupDeploymentLogs(req, res) {
  try {
    const result = await pool.query(`
      DELETE FROM ops.deployment_logs
      WHERE created_at < NOW() - INTERVAL '30 days'
      RETURNING id
    `);
    
    res.json({
      success: true,
      message: `${result.rowCount} old logs deleted`
    });
    
  } catch (error) {
    logger.error('Failed to cleanup logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
```

---

## 🎨 FRONTEND COMPONENT

### **DeploymentLogsTab.tsx**

```typescript
import { useState, useEffect } from 'react';
import { AlertCircle, Search, Filter, Eye, RefreshCw } from 'lucide-react';
import api from '../../../../services/api';

interface Log {
  id: string;
  log_level: 'debug' | 'info' | 'warn' | 'error';
  category: string;
  message: string;
  error_code: string | null;
  request_method: string | null;
  request_path: string | null;
  request_duration: number | null;
  user_email: string | null;
  user_role: string | null;
  created_at: string;
}

export default function DeploymentLogsTab() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [filterLevel, filterCategory]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params: any = { limit: 100, offset: 0 };
      
      if (filterLevel !== 'all') params.level = filterLevel;
      if (filterCategory !== 'all') params.category = filterCategory;
      if (searchTerm) params.search = searchTerm;
      
      const response = await api.get('/admin/deployment-logs', { params });
      
      if (response.success) {
        setLogs(response.logs);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const viewLogDetail = async (logId: string) => {
    try {
      const response = await api.get(`/admin/deployment-logs/${logId}`);
      if (response.success) {
        setSelectedLog(response.log);
        setModalOpen(true);
      }
    } catch (error) {
      console.error('Failed to fetch log detail:', error);
    }
  };

  const getLevelBadge = (level: string) => {
    const configs = {
      error: { bg: 'bg-red-100', text: 'text-red-700', icon: '❌' },
      warn: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: '⚠️' },
      info: { bg: 'bg-blue-100', text: 'text-blue-700', icon: 'ℹ️' },
      debug: { bg: 'bg-gray-100', text: 'text-gray-700', icon: '🔍' }
    };
    const config = configs[level as keyof typeof configs] || configs.info;
    return (
      <span className={`${config.bg} ${config.text} px-2 py-1 rounded text-xs font-medium`}>
        {config.icon} {level.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-700 to-gray-900 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-3 rounded-lg backdrop-blur-sm">
              <AlertCircle size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">🔍 Backend Log Viewer</h2>
              <p className="text-gray-300 mt-1">Deployment & Error Tracking</p>
            </div>
          </div>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[300px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Search size={16} className="inline mr-2" />
              Arama
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
              placeholder="Log mesajında ara..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter size={16} className="inline mr-2" />
              Log Level
            </label>
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tümü</option>
              <option value="error">❌ Error</option>
              <option value="warn">⚠️ Warning</option>
              <option value="info">ℹ️ Info</option>
              <option value="debug">🔍 Debug</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Kategori</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tümü</option>
              <option value="migration">Migration</option>
              <option value="api">API</option>
              <option value="auth">Authentication</option>
              <option value="database">Database</option>
              <option value="github">GitHub Scanner</option>
              <option value="compliance">Compliance</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Zaman</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Level</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Kategori</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Mesaj</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Kullanıcı</th>
              <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Detay</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm text-gray-600">
                  {new Date(log.created_at).toLocaleString('tr-TR')}
                </td>
                <td className="px-4 py-3">
                  {getLevelBadge(log.log_level)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 font-medium">
                  {log.category}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 max-w-md truncate">
                  {log.message}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {log.user_email || '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => viewLogDetail(log.id)}
                    className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Eye size={16} className="text-blue-600" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {modalOpen && selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-[90vw] max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="bg-gray-700 p-6 text-white">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Log Detayları</h3>
                <button
                  onClick={() => setModalOpen(false)}
                  className="text-white hover:text-gray-300"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Mesaj:</label>
                  <p className="text-gray-900 mt-1">{selectedLog.message}</p>
                </div>
                
                {selectedLog.stack_trace && (
                  <div>
                    <label className="text-sm font-semibold text-gray-700">Stack Trace:</label>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg mt-1 overflow-x-auto text-sm">
                      {selectedLog.stack_trace}
                    </pre>
                  </div>
                )}
                
                {selectedLog.metadata && (
                  <div>
                    <label className="text-sm font-semibold text-gray-700">Metadata:</label>
                    <pre className="bg-gray-50 text-gray-800 p-4 rounded-lg mt-1 overflow-x-auto text-sm">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 📊 KULLANIM SENARYOLARI

### **Senaryo 1: Migration Hatası**
```
Deployment sırasında migration hata verdi.
→ Log Viewer'a git
→ Filtre: Error + Migration
→ Hatayı gör:
   "❌ ERROR | Migration | syntax error at or near $1"
→ Detay'a tıkla
→ Stack trace gör
→ Hangi migration, hangi satır → Anında tespit!
```

### **Senaryo 2: Slow Query**
```
API yavaş.
→ Log Viewer'a git
→ Filtre: Warning + Database
→ Gör:
   "⚠️ WARN | Database | Slow query: 2.5s"
→ Metadata'da hangi query olduğunu gör
→ Optimize et!
```

### **Senaryo 3: GitHub Token Süresi Doldu**
```
Compliance taraması çalışmıyor.
→ Log Viewer'a git
→ Filtre: Error + GitHub
→ Gör:
   "❌ ERROR | GitHub | Bad credentials (401)"
→ Railway'de token'ı yenile!
```

---

## ⏱️ IMPLEMENTATION TAHMİNİ

```
Migration: 1 saat
PostgresTransport: 2 saat
Logger Integration: 1 saat
Backend API: 3 saat
Frontend Component: 4 saat
Testing: 2 saat
──────────────────────
TOPLAM: ~2 gün
```

---

## ⚠️ RISKLER VE ÇÖZÜMLER

### **Risk 1: Sonsuz Döngü**
```
✅ ÇÖZÜM: Log insert'leri loglama!
if (message.includes('INSERT INTO ops.deployment_logs')) {
  return; // Skip
}
```

### **Risk 2: DB Performansı**
```
✅ ÇÖZÜM: 
- Sadece info ve üstü logla (debug hariç)
- 30 gün retention policy
- Index'ler ile hızlı query
- Pagination (100 log/sayfa)
```

### **Risk 3: Log Taşması**
```
✅ ÇÖZÜM:
- Otomatik cleanup (30 gün)
- Manuel cleanup butonu
- Log level filtresi (sadece error/warn)
```

---

## 📌 GELECEK SPRINT'TE EKLENBİLİR

**Öncelik:** P2 (Nice-to-have)  
**Bağımlılık:** Yok (bağımsız feature)  
**Fayda:** Yüksek (debugging için çok kullanışlı)

---

**Bu plan kabul edilebilir mi? Gelecek sprint'e ekleyelim mi?** 📋


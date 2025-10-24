# 📜 Audit Trail UI

> **Audit log viewer with filtering, diff view, and export**

[Ana Sayfa](../README.md) | [Advanced Features](01_Advanced_Features.md)

---

## Backend API

```javascript
// src/routes/audit.js
router.get('/audit-logs', authenticate, async (req, res) => {
  const { 
    entity_type, 
    entity_id, 
    action, 
    user_id, 
    start_date, 
    end_date, 
    limit = 50, 
    offset = 0 
  } = req.query;
  
  const tenantId = req.user.tenant_id;

  let query = `
    SELECT 
      al.*,
      u.name AS user_name,
      u.email AS user_email
    FROM ops.audit_logs al
    LEFT JOIN core.users u ON al.user_id = u.id
    WHERE al.tenant_id = $1
  `;
  
  const params = [tenantId];
  let paramCount = 1;

  if (entity_type) {
    query += ` AND al.entity_type = $${++paramCount}`;
    params.push(entity_type);
  }
  
  if (entity_id) {
    query += ` AND al.entity_id = $${++paramCount}`;
    params.push(entity_id);
  }
  
  if (action) {
    query += ` AND al.action = $${++paramCount}`;
    params.push(action);
  }
  
  if (user_id) {
    query += ` AND al.user_id = $${++paramCount}`;
    params.push(user_id);
  }
  
  if (start_date) {
    query += ` AND al.created_at >= $${++paramCount}`;
    params.push(start_date);
  }
  
  if (end_date) {
    query += ` AND al.created_at <= $${++paramCount}`;
    params.push(end_date);
  }

  query += ` ORDER BY al.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  
  res.json({
    logs: result.rows,
    total: result.rowCount
  });
});
```

## Frontend Component (React)

```typescript
// AuditLogViewer.tsx
import React, { useState, useEffect } from 'react';

const AuditLogViewer = () => {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({
    entity_type: '',
    action: '',
    start_date: '',
    end_date: ''
  });

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const fetchLogs = async () => {
    const response = await api.get('/api/audit-logs', { params: filters });
    setLogs(response.data.logs);
  };

  return (
    <div className="audit-log-viewer">
      <div className="filters">
        <select onChange={e => setFilters({...filters, entity_type: e.target.value})}>
          <option value="">All Entities</option>
          <option value="users">Users</option>
          <option value="projects">Projects</option>
        </select>
        
        <select onChange={e => setFilters({...filters, action: e.target.value})}>
          <option value="">All Actions</option>
          <option value="INSERT">Created</option>
          <option value="UPDATE">Updated</option>
          <option value="DELETE">Deleted</option>
        </select>
      </div>

      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>User</th>
            <th>Action</th>
            <th>Entity</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id}>
              <td>{new Date(log.created_at).toLocaleString()}</td>
              <td>{log.user_name}</td>
              <td>
                <span className={`badge ${log.action.toLowerCase()}`}>
                  {log.action}
                </span>
              </td>
              <td>{log.entity_type} #{log.entity_id}</td>
              <td>
                <button onClick={() => showDiff(log)}>View Changes</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

## Diff View

```javascript
// Show old vs new values
const showDiff = (log) => {
  const oldValues = log.old_values || {};
  const newValues = log.new_values || {};
  
  const changedFields = Object.keys(newValues).filter(
    key => JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])
  );

  return (
    <div className="diff-view">
      {changedFields.map(field => (
        <div key={field} className="diff-field">
          <strong>{field}:</strong>
          <div className="old-value">{JSON.stringify(oldValues[field])}</div>
          <div className="new-value">{JSON.stringify(newValues[field])}</div>
        </div>
      ))}
    </div>
  );
};
```

**[Ana Sayfa](../README.md) | [Advanced Features](01_Advanced_Features.md)**



# ⚡ Real-time / WebSocket System

> **Socket.io integration for real-time notifications and live updates**

[Ana Sayfa](../README.md) | [Infrastructure](01_Roadmap_TechStack.md)

---

## Socket.io Setup

```bash
npm install socket.io socket.io-redis
```

```javascript
// server.js
const http = require('http');
const socketIO = require('socket.io');
const redisAdapter = require('socket.io-redis');

const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST']
  }
});

// Redis adapter (for multi-server)
io.adapter(redisAdapter({ host: 'localhost', port: 6379 }));

// Authentication middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    const user = await verifyJWT(token);
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
});

// Tenant-based rooms
io.on('connection', (socket) => {
  const tenantId = socket.user.tenant_id;
  socket.join(`tenant:${tenantId}`);
  
  console.log(`User ${socket.user.id} connected to tenant:${tenantId}`);
  
  socket.on('disconnect', () => {
    console.log(`User ${socket.user.id} disconnected`);
  });
});

// Emit to tenant
const notifyTenant = (tenantId, event, data) => {
  io.to(`tenant:${tenantId}`).emit(event, data);
};

module.exports = { io, notifyTenant };
```

## Use Cases

### 1. Real-time Notifications
```javascript
// When new record created
notifyTenant(tenantId, 'record:created', {
  table_id: 123,
  record_id: 456,
  data: { ... }
});
```

### 2. Live Dashboard Updates
```javascript
// Emit metrics every 5 seconds
setInterval(() => {
  notifyTenant(tenantId, 'dashboard:update', {
    active_users: 42,
    api_requests: 1234,
    database_queries: 567
  });
}, 5000);
```

### 3. Presence System
```javascript
io.on('connection', (socket) => {
  socket.on('user:online', () => {
    socket.broadcast.to(`tenant:${socket.user.tenant_id}`).emit('user:status', {
      user_id: socket.user.id,
      status: 'online'
    });
  });
});
```

**[Ana Sayfa](../README.md) | [Infrastructure](01_Roadmap_TechStack.md)**



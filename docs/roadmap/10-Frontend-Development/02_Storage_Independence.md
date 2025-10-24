# 🔓 Frontend Storage Bağımsızlığı

> **LocalStorage'a esir olmadan, alternatif storage mekanizmaları destekleyen frontend**

[Ana Sayfa](../README.md) | [Frontend Development](./README.md)

---

## ⚠️ SORUN: LocalStorage Bağımlılığı

### Kötü Mimari (❌)

```typescript
// ❌ KÖTÜ: LocalStorage'a direkt bağımlı
const saveUser = (user: User) => {
  localStorage.setItem('user', JSON.stringify(user));
};

const getUser = (): User | null => {
  const data = localStorage.getItem('user');
  return data ? JSON.parse(data) : null;
};

// ❌ IndexedDB'ye geçmek istersen? TÜM KODU DEĞİŞTİR!
// ❌ Server-side rendering? localStorage yok!
// ❌ React Native? localStorage yok!
```

---

## ✅ ÇÖZÜM: Storage Adapter Pattern

### İyi Mimari (✅)

```typescript
// ✅ İYİ: Storage abstraction
const storage = StorageAdapter.create(); // localStorage, IndexedDB, or API

storage.set('user', user);
const user = storage.get('user');

// IndexedDB'ye geçmek istersen? Sadece .env değiştir!
// STORAGE_TYPE=indexeddb
```

---

## 🏗️ Storage Adapter Implementation

### 1. Base Interface

```typescript
// src/adapters/storage/types.ts

export interface IStorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
  keys(): Promise<string[]>;
}

export type StorageType = 'localStorage' | 'sessionStorage' | 'indexedDB' | 'memory' | 'api';

export interface StorageConfig {
  type: StorageType;
  prefix?: string;  // Key prefix: 'hzm:user' vs 'myapp:user'
  ttl?: number;     // Default TTL (seconds)
  encryption?: boolean;  // Encrypt sensitive data
}
```

---

### 2. LocalStorage Adapter

```typescript
// src/adapters/storage/LocalStorageAdapter.ts

import { IStorageAdapter, StorageConfig } from './types';

export class LocalStorageAdapter implements IStorageAdapter {
  private prefix: string;
  private ttl?: number;

  constructor(config: StorageConfig) {
    this.prefix = config.prefix || 'hzm:';
    this.ttl = config.ttl;
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const item = localStorage.getItem(this.getKey(key));
      if (!item) return null;

      const parsed = JSON.parse(item);

      // Check TTL
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        await this.remove(key);
        return null;
      }

      return parsed.value as T;
    } catch (error) {
      console.error('LocalStorage get error:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const finalTtl = ttl || this.ttl;
      const item = {
        value,
        expiresAt: finalTtl ? Date.now() + finalTtl * 1000 : null
      };
      localStorage.setItem(this.getKey(key), JSON.stringify(item));
    } catch (error) {
      console.error('LocalStorage set error:', error);
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    localStorage.removeItem(this.getKey(key));
  }

  async clear(): Promise<void> {
    // Clear only keys with our prefix
    const keys = await this.keys();
    keys.forEach(key => localStorage.removeItem(key));
  }

  async has(key: string): Promise<boolean> {
    return localStorage.getItem(this.getKey(key)) !== null;
  }

  async keys(): Promise<string[]> {
    const allKeys = Object.keys(localStorage);
    return allKeys.filter(key => key.startsWith(this.prefix));
  }
}
```

---

### 3. SessionStorage Adapter

```typescript
// src/adapters/storage/SessionStorageAdapter.ts

export class SessionStorageAdapter implements IStorageAdapter {
  // LocalStorageAdapter ile aynı implementasyon
  // Sadece localStorage yerine sessionStorage kullan
  
  async get<T>(key: string): Promise<T | null> {
    // sessionStorage.getItem(...)
  }
  
  async set<T>(key: string, value: T): Promise<void> {
    // sessionStorage.setItem(...)
  }
  
  // ... diğerleri aynı
}
```

---

### 4. IndexedDB Adapter (Büyük Data İçin)

```typescript
// src/adapters/storage/IndexedDBAdapter.ts

export class IndexedDBAdapter implements IStorageAdapter {
  private dbName: string;
  private storeName: string;
  private db: IDBDatabase | null = null;

  constructor(config: StorageConfig) {
    this.dbName = config.prefix || 'hzm_db';
    this.storeName = 'storage';
    this.init();
  }

  private async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' });
        }
      };
    });
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        if (!result) return resolve(null);

        // Check TTL
        if (result.expiresAt && Date.now() > result.expiresAt) {
          this.remove(key);
          return resolve(null);
        }

        resolve(result.value as T);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const item = {
        key,
        value,
        expiresAt: ttl ? Date.now() + ttl * 1000 : null,
        createdAt: Date.now()
      };

      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async remove(key: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async keys(): Promise<string[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAllKeys();

      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(request.error);
    });
  }
}
```

---

### 5. Memory Adapter (SSR, Testing)

```typescript
// src/adapters/storage/MemoryAdapter.ts

export class MemoryAdapter implements IStorageAdapter {
  private storage: Map<string, { value: any; expiresAt: number | null }> = new Map();

  async get<T>(key: string): Promise<T | null> {
    const item = this.storage.get(key);
    if (!item) return null;

    // Check TTL
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.storage.delete(key);
      return null;
    }

    return item.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.storage.set(key, {
      value,
      expiresAt: ttl ? Date.now() + ttl * 1000 : null
    });
  }

  async remove(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }

  async has(key: string): Promise<boolean> {
    return this.storage.has(key);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }
}
```

---

### 6. API Adapter (Server-Side Storage)

```typescript
// src/adapters/storage/APIAdapter.ts

export class APIAdapter implements IStorageAdapter {
  private baseUrl: string;
  private token?: string;

  constructor(config: StorageConfig & { apiUrl: string; token?: string }) {
    this.baseUrl = config.apiUrl;
    this.token = config.token;
  }

  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      ...(this.token && { 'Authorization': `Bearer ${this.token}` })
    };
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const response = await fetch(`${this.baseUrl}/storage/${key}`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.value as T;
    } catch (error) {
      console.error('API storage get error:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const response = await fetch(`${this.baseUrl}/storage/${key}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ value, ttl })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  }

  async remove(key: string): Promise<void> {
    await fetch(`${this.baseUrl}/storage/${key}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
  }

  async clear(): Promise<void> {
    await fetch(`${this.baseUrl}/storage`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
  }

  async has(key: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/storage/${key}/exists`, {
      headers: this.getHeaders()
    });
    const data = await response.json();
    return data.exists;
  }

  async keys(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/storage/keys`, {
      headers: this.getHeaders()
    });
    const data = await response.json();
    return data.keys;
  }
}
```

---

### 7. Storage Factory

```typescript
// src/adapters/storage/StorageAdapter.ts

import { IStorageAdapter, StorageConfig, StorageType } from './types';
import { LocalStorageAdapter } from './LocalStorageAdapter';
import { SessionStorageAdapter } from './SessionStorageAdapter';
import { IndexedDBAdapter } from './IndexedDBAdapter';
import { MemoryAdapter } from './MemoryAdapter';
import { APIAdapter } from './APIAdapter';

export class StorageAdapter {
  private static instance: IStorageAdapter | null = null;

  static create(config?: Partial<StorageConfig>): IStorageAdapter {
    // Singleton pattern
    if (this.instance) return this.instance;

    const type: StorageType = 
      (import.meta.env.VITE_STORAGE_TYPE as StorageType) || 
      config?.type || 
      'localStorage';

    const finalConfig: StorageConfig = {
      type,
      prefix: import.meta.env.VITE_STORAGE_PREFIX || config?.prefix || 'hzm:',
      ttl: import.meta.env.VITE_STORAGE_TTL || config?.ttl,
      encryption: import.meta.env.VITE_STORAGE_ENCRYPTION === 'true' || config?.encryption
    };

    switch (type) {
      case 'localStorage':
        this.instance = new LocalStorageAdapter(finalConfig);
        break;

      case 'sessionStorage':
        this.instance = new SessionStorageAdapter(finalConfig);
        break;

      case 'indexedDB':
        this.instance = new IndexedDBAdapter(finalConfig);
        break;

      case 'memory':
        this.instance = new MemoryAdapter(finalConfig);
        break;

      case 'api':
        this.instance = new APIAdapter({
          ...finalConfig,
          apiUrl: import.meta.env.VITE_API_URL || '',
          token: undefined  // Token dinamik olarak set edilecek
        });
        break;

      default:
        throw new Error(`Unsupported storage type: ${type}`);
    }

    return this.instance;
  }

  static reset(): void {
    this.instance = null;
  }
}

// Export singleton
export const storage = StorageAdapter.create();
```

---

## 🎯 Kullanım

### Environment Variables

```bash
# .env.development (Local)
VITE_STORAGE_TYPE=localStorage
VITE_STORAGE_PREFIX=hzm:
VITE_STORAGE_TTL=3600

# .env.production (Production)
VITE_STORAGE_TYPE=indexedDB
VITE_STORAGE_PREFIX=hzm:
VITE_STORAGE_TTL=86400

# .env.test (Testing)
VITE_STORAGE_TYPE=memory
VITE_STORAGE_PREFIX=test:

# .env.ssr (Server-Side Rendering)
VITE_STORAGE_TYPE=api
VITE_API_URL=https://api.example.com
```

---

### React Context ile Kullanım

```typescript
// src/contexts/StorageContext.tsx

import React, { createContext, useContext } from 'react';
import { IStorageAdapter, storage } from '../adapters/storage';

const StorageContext = createContext<IStorageAdapter>(storage);

export const StorageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <StorageContext.Provider value={storage}>
      {children}
    </StorageContext.Provider>
  );
};

export const useStorage = () => {
  const context = useContext(StorageContext);
  if (!context) {
    throw new Error('useStorage must be used within StorageProvider');
  }
  return context;
};
```

---

### Component'te Kullanım

```typescript
// src/components/Login.tsx

import { useStorage } from '../contexts/StorageContext';

const Login: React.FC = () => {
  const storage = useStorage();

  const handleLogin = async (user: User) => {
    // Storage type'a bakmaksızın çalışır!
    await storage.set('user', user, 86400); // 24 saat TTL
    await storage.set('token', user.token, 86400);
  };

  const handleLogout = async () => {
    await storage.remove('user');
    await storage.remove('token');
  };

  return (
    // JSX...
  );
};
```

---

### Service'te Kullanım

```typescript
// src/services/auth.service.ts

import { storage } from '../adapters/storage';

export class AuthService {
  async login(email: string, password: string) {
    const response = await api.post('/auth/login', { email, password });
    const { user, token } = response.data;

    // Storage adapter kullan (type'a bakmaksızın)
    await storage.set('user', user, 86400);
    await storage.set('token', token, 86400);

    return user;
  }

  async logout() {
    await storage.remove('user');
    await storage.remove('token');
  }

  async getCurrentUser(): Promise<User | null> {
    return await storage.get<User>('user');
  }

  async isAuthenticated(): Promise<boolean> {
    return await storage.has('token');
  }
}
```

---

## 🔄 Migration Stratejisi

### LocalStorage → IndexedDB (Smooth Transition)

```typescript
// src/utils/storageMigration.ts

export async function migrateStorage() {
  const oldType = localStorage.getItem('hzm:storage_version');
  
  if (oldType === 'v1') return; // Already migrated

  console.log('Migrating storage from localStorage to IndexedDB...');

  // 1. Read all data from localStorage
  const oldData: Record<string, any> = {};
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('hzm:')) {
      const value = localStorage.getItem(key);
      if (value) {
        try {
          oldData[key] = JSON.parse(value);
        } catch {
          oldData[key] = value;
        }
      }
    }
  });

  // 2. Write to new storage
  const newStorage = new IndexedDBAdapter({ type: 'indexedDB', prefix: 'hzm:' });
  
  for (const [key, value] of Object.entries(oldData)) {
    const cleanKey = key.replace('hzm:', '');
    await newStorage.set(cleanKey, value);
  }

  // 3. Mark as migrated
  localStorage.setItem('hzm:storage_version', 'v1');

  console.log('Storage migration complete!');
}

// App.tsx'te çağır
useEffect(() => {
  migrateStorage();
}, []);
```

---

## 📊 Storage Type Karşılaştırması

| Storage Type | Max Size | Sync/Async | SSR Support | Persistent | Use Case |
|--------------|----------|------------|-------------|------------|----------|
| **localStorage** | ~5-10MB | Sync | ❌ | ✅ | Küçük data, basit |
| **sessionStorage** | ~5-10MB | Sync | ❌ | ❌ | Geçici data |
| **IndexedDB** | ~500MB+ | Async | ❌ | ✅ | Büyük data, offline |
| **Memory** | RAM limit | Sync | ✅ | ❌ | Testing, SSR |
| **API** | Unlimited | Async | ✅ | ✅ | Multi-device sync |

---

## 🔒 Encryption (Opsiyonel)

```typescript
// src/adapters/storage/EncryptedStorageAdapter.ts

import CryptoJS from 'crypto-js';
import { IStorageAdapter } from './types';

export class EncryptedStorageAdapter implements IStorageAdapter {
  private adapter: IStorageAdapter;
  private key: string;

  constructor(adapter: IStorageAdapter, encryptionKey: string) {
    this.adapter = adapter;
    this.key = encryptionKey;
  }

  async get<T>(key: string): Promise<T | null> {
    const encrypted = await this.adapter.get<string>(key);
    if (!encrypted) return null;

    try {
      const decrypted = CryptoJS.AES.decrypt(encrypted, this.key).toString(CryptoJS.enc.Utf8);
      return JSON.parse(decrypted) as T;
    } catch (error) {
      console.error('Decryption error:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(value), this.key).toString();
    await this.adapter.set(key, encrypted, ttl);
  }

  // ... diğer methodlar aynı, adapter'a delegate et
}

// Kullanım
const baseAdapter = new LocalStorageAdapter({ type: 'localStorage' });
const encryptedStorage = new EncryptedStorageAdapter(baseAdapter, 'secret-key');
```

---

## ✅ Avantajlar

1. ✅ **Platform Bağımsız**: localStorage, IndexedDB, API - hepsi aynı interface
2. ✅ **Test Edilebilir**: Memory adapter ile test kolay
3. ✅ **SSR Ready**: Memory veya API adapter ile SSR çalışır
4. ✅ **React Native Ready**: AsyncStorage adapter eklenebilir
5. ✅ **Type Safe**: TypeScript ile tam tip güvenliği
6. ✅ **TTL Support**: Otomatik expiration
7. ✅ **Encryption Ready**: Sensitive data şifrelenebilir
8. ✅ **Migration Ready**: Storage type değiştirilebilir

---

## 🔗 İlgili Dökümanlar

- [16-Platform-Independence/README.md](../16-Platform-Independence/README.md) - Backend platform bağımsızlığı
- [README.md](./README.md) - Frontend geliştirme ana sayfa

---

**[Ana Sayfa](../README.md)**


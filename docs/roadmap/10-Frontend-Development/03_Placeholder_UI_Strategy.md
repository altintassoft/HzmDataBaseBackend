# 🚧 Frontend Placeholder UI Stratejisi

> **Henüz hazır olmayan özellikler için kullanıcı dostu placeholder'lar**

[Ana Sayfa](../README.md) | [Frontend Development](./README.md)

---

## 🎯 Amaç

Backend veya bazı özellikler henüz hazır değilken, kullanıcıya **net bilgi vermek** ve **profesyonel görünmek**.

---

## 📐 Placeholder UI Prensipleri

### ✅ İYİ Placeholder

```tsx
<button 
  className="opacity-50 cursor-not-allowed"
  disabled
  title="Bu özellik yakında eklenecek"
>
  <span>📊 Raporlar</span>
  <span className="text-xs">(Yakında)</span>
</button>
```

### ❌ KÖTÜ Placeholder

```tsx
<button onClick={() => alert('TODO')}>
  Raporlar
</button>
```

**Neden kötü?**
- Kullanıcı tıklayıp bekliyor, sonra "TODO" görüyor → Kötü UX
- Profesyonel değil

---

## 🎨 Placeholder Component

### 1. FeatureComingSoon Component

```tsx
// src/components/common/FeatureComingSoon.tsx

import React from 'react';

interface FeatureComingSoonProps {
  featureName: string;
  description?: string;
  estimatedDate?: string;
  icon?: React.ReactNode;
}

export const FeatureComingSoon: React.FC<FeatureComingSoonProps> = ({
  featureName,
  description,
  estimatedDate,
  icon
}) => {
  return (
    <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
      {/* Icon */}
      <div className="text-6xl mb-4">
        {icon || '🚧'}
      </div>

      {/* Feature Name */}
      <h3 className="text-xl font-semibold text-gray-700 mb-2">
        {featureName}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-gray-600 mb-4 max-w-md mx-auto">
          {description}
        </p>
      )}

      {/* Estimated Date */}
      {estimatedDate && (
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Tahmini: {estimatedDate}
        </div>
      )}

      {/* Status Badge */}
      <div className="mt-4">
        <span className="inline-block bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-semibold">
          Geliştirme Aşamasında
        </span>
      </div>
    </div>
  );
};
```

### Kullanım

```tsx
// src/pages/ReportsPage.tsx

import { FeatureComingSoon } from '../components/common/FeatureComingSoon';

export const ReportsPage = () => {
  return (
    <div className="p-6">
      <FeatureComingSoon
        featureName="Gelişmiş Raporlama"
        description="Grafikler, pivot tablolar ve özel raporlar yakında burada olacak!"
        estimatedDate="Mart 2025"
        icon="📊"
      />
    </div>
  );
};
```

---

### 2. PlaceholderButton Component

```tsx
// src/components/common/PlaceholderButton.tsx

import React from 'react';

interface PlaceholderButtonProps {
  label: string;
  subLabel?: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  onClick?: () => void;
}

export const PlaceholderButton: React.FC<PlaceholderButtonProps> = ({
  label,
  subLabel = 'Yakında',
  icon,
  variant = 'secondary',
  onClick
}) => {
  const baseStyles = 'inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all cursor-not-allowed opacity-60';
  
  const variantStyles = {
    primary: 'bg-blue-100 text-blue-600',
    secondary: 'bg-gray-100 text-gray-600',
    ghost: 'bg-transparent text-gray-500 border border-gray-300'
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]}`}
      disabled
      onClick={onClick}
      title={`${label} - ${subLabel}`}
    >
      {icon && <span className="text-lg">{icon}</span>}
      <span className="flex flex-col items-start">
        <span className="font-medium">{label}</span>
        <span className="text-xs opacity-75">{subLabel}</span>
      </span>
    </button>
  );
};
```

### Kullanım

```tsx
<PlaceholderButton
  label="Raporları Dışa Aktar"
  subLabel="Q1 2025"
  icon="📥"
  variant="primary"
/>
```

---

### 3. PlaceholderCard Component

```tsx
// src/components/common/PlaceholderCard.tsx

import React from 'react';

interface PlaceholderCardProps {
  title: string;
  description?: string;
  features?: string[];
  progress?: number; // 0-100
  status?: 'planned' | 'in-progress' | 'coming-soon';
}

export const PlaceholderCard: React.FC<PlaceholderCardProps> = ({
  title,
  description,
  features,
  progress = 0,
  status = 'planned'
}) => {
  const statusConfig = {
    planned: { color: 'gray', icon: '📝', text: 'Planlandı' },
    'in-progress': { color: 'blue', icon: '🔨', text: 'Geliştiriliyor' },
    'coming-soon': { color: 'yellow', icon: '🚀', text: 'Yakında' }
  };

  const config = statusConfig[status];

  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <span className={`px-3 py-1 rounded-full text-xs font-medium bg-${config.color}-100 text-${config.color}-700`}>
          {config.icon} {config.text}
        </span>
      </div>

      {/* Description */}
      {description && (
        <p className="text-gray-600 text-sm mb-4">{description}</p>
      )}

      {/* Features */}
      {features && features.length > 0 && (
        <ul className="space-y-2 mb-4">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {feature}
            </li>
          ))}
        </ul>
      )}

      {/* Progress Bar */}
      {progress > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-600">
            <span>İlerleme</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
```

### Kullanım

```tsx
<PlaceholderCard
  title="Gelişmiş Filtreleme"
  description="Çoklu koşullar, kaydetme, paylaşma"
  features={[
    'AND/OR mantığı',
    'Kayıtlı filtreler',
    'Takımla paylaş'
  ]}
  progress={35}
  status="in-progress"
/>
```

---

## 🎯 Gerçek Dünya Örnekleri

### 1. Dashboard'da Placeholder Widget

```tsx
// src/pages/DashboardPage.tsx

const DashboardPage = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
      {/* Hazır widget */}
      <ActiveUsersWidget />
      
      {/* Placeholder widget */}
      <PlaceholderCard
        title="Gelir Grafiği"
        description="Aylık gelir trendi ve tahminler"
        status="coming-soon"
      />
      
      {/* In-progress widget */}
      <PlaceholderCard
        title="Performans Metrikleri"
        description="API response times, success rates"
        progress={60}
        status="in-progress"
      />
    </div>
  );
};
```

---

### 2. Sidebar'da Placeholder Menu Items

```tsx
// src/components/Sidebar.tsx

const Sidebar = () => {
  const menuItems = [
    { label: 'Dashboard', icon: '📊', href: '/dashboard', ready: true },
    { label: 'Projeler', icon: '📁', href: '/projects', ready: true },
    { label: 'Raporlar', icon: '📈', href: '/reports', ready: false, comingSoon: 'Q1 2025' },
    { label: 'API Dokümantasyon', icon: '📚', href: '/api-docs', ready: false, comingSoon: 'Q2 2025' },
    { label: 'Webhooks', icon: '🔗', href: '/webhooks', ready: true }
  ];

  return (
    <nav className="space-y-1">
      {menuItems.map(item => (
        item.ready ? (
          <Link
            key={item.href}
            to={item.href}
            className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 rounded-lg"
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ) : (
          <div
            key={item.href}
            className="flex items-center gap-3 px-4 py-2 opacity-50 cursor-not-allowed"
            title={`${item.label} - ${item.comingSoon}`}
          >
            <span>{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
              {item.comingSoon}
            </span>
          </div>
        )
      ))}
    </nav>
  );
};
```

---

### 3. Settings Page'de Feature Toggles

```tsx
// src/pages/SettingsPage.tsx

const SettingsPage = () => {
  const features = [
    {
      id: 'email-notifications',
      name: 'Email Bildirimleri',
      description: 'Önemli olaylar için email al',
      enabled: true,
      ready: true
    },
    {
      id: 'two-factor-auth',
      name: 'İki Faktörlü Doğrulama',
      description: 'Hesabını daha güvenli hale getir',
      enabled: false,
      ready: false,
      comingSoon: 'Mart 2025'
    },
    {
      id: 'api-rate-limiting',
      name: 'API Rate Limiting',
      description: 'API kullanım limitleri',
      enabled: false,
      ready: false,
      comingSoon: 'Nisan 2025'
    }
  ];

  return (
    <div className="space-y-4 p-6">
      {features.map(feature => (
        <div
          key={feature.id}
          className={`border rounded-lg p-4 ${!feature.ready && 'opacity-60 bg-gray-50'}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-medium flex items-center gap-2">
                {feature.name}
                {!feature.ready && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                    {feature.comingSoon}
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-600">{feature.description}</p>
            </div>
            
            {feature.ready ? (
              <input
                type="checkbox"
                checked={feature.enabled}
                onChange={() => {}}
                className="w-5 h-5"
              />
            ) : (
              <div className="text-gray-400" title="Henüz hazır değil">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
```

---

## 📊 Placeholder States

### Feature Status System

```typescript
// src/types/features.ts

export type FeatureStatus = 
  | 'planned'        // Planlandı (0%)
  | 'in-design'      // Tasarımda (10%)
  | 'in-development' // Geliştiriliyor (30-70%)
  | 'in-testing'     // Test ediliyor (80-90%)
  | 'coming-soon'    // Yakında (95%)
  | 'ready'          // Hazır (100%)
  | 'deprecated';    // Kullanımdan kaldırıldı

export interface Feature {
  id: string;
  name: string;
  description: string;
  status: FeatureStatus;
  progress: number; // 0-100
  estimatedDate?: string;
  dependencies?: string[];
  icon?: string;
}
```

### Feature Registry

```typescript
// src/config/features.ts

import { Feature, FeatureStatus } from '../types/features';

export const FEATURES: Record<string, Feature> = {
  'dashboard': {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Ana kontrol paneli',
    status: 'ready',
    progress: 100,
    icon: '📊'
  },
  
  'projects': {
    id: 'projects',
    name: 'Proje Yönetimi',
    description: 'Proje oluştur ve yönet',
    status: 'ready',
    progress: 100,
    icon: '📁'
  },
  
  'generic-data': {
    id: 'generic-data',
    name: 'Generic Data Pattern',
    description: 'JSONB tabanlı veri yönetimi',
    status: 'in-development',
    progress: 45,
    estimatedDate: 'Şubat 2025',
    icon: '🗄️',
    dependencies: ['projects']
  },
  
  'reports': {
    id: 'reports',
    name: 'Gelişmiş Raporlama',
    description: 'Grafikler ve analizler',
    status: 'planned',
    progress: 0,
    estimatedDate: 'Mart 2025',
    icon: '📈',
    dependencies: ['generic-data']
  },
  
  'webhooks': {
    id: 'webhooks',
    name: 'Webhooks',
    description: 'Event subscription',
    status: 'coming-soon',
    progress: 90,
    estimatedDate: 'Şubat 2025',
    icon: '🔗'
  },
  
  '2fa': {
    id: '2fa',
    name: 'İki Faktörlü Doğrulama',
    description: 'TOTP ile ekstra güvenlik',
    status: 'in-testing',
    progress: 85,
    estimatedDate: 'Mart 2025',
    icon: '🔐'
  }
};
```

### useFeature Hook

```typescript
// src/hooks/useFeature.ts

import { FEATURES } from '../config/features';
import { Feature, FeatureStatus } from '../types/features';

export const useFeature = (featureId: string) => {
  const feature = FEATURES[featureId];

  if (!feature) {
    console.warn(`Feature not found: ${featureId}`);
    return {
      isReady: false,
      isEnabled: false,
      feature: null
    };
  }

  const isReady = feature.status === 'ready';
  const isEnabled = isReady; // İleride feature flags eklenebilir

  return {
    isReady,
    isEnabled,
    feature,
    status: feature.status,
    progress: feature.progress
  };
};
```

### Kullanım

```tsx
// Herhangi bir component'te

import { useFeature } from '../hooks/useFeature';
import { FeatureComingSoon } from '../components/common/FeatureComingSoon';

const ReportsPage = () => {
  const { isReady, feature } = useFeature('reports');

  if (!isReady) {
    return (
      <FeatureComingSoon
        featureName={feature?.name || 'Reports'}
        description={feature?.description}
        estimatedDate={feature?.estimatedDate}
        icon={feature?.icon}
      />
    );
  }

  return (
    <div>
      {/* Normal reports UI */}
    </div>
  );
};
```

---

## 🎨 Design System

### TailwindCSS Utility Classes

```css
/* tailwind.config.js - custom utilities */
module.exports = {
  theme: {
    extend: {
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    }
  },
  plugins: [
    // Custom plugin for placeholder styles
    function({ addComponents }) {
      addComponents({
        '.placeholder-container': {
          '@apply bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center': {},
        },
        '.placeholder-badge': {
          '@apply inline-block bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-semibold': {},
        },
        '.placeholder-button': {
          '@apply opacity-50 cursor-not-allowed': {},
        }
      })
    }
  ]
}
```

---

## ✅ Best Practices

### 1. ✅ Net Bilgilendirme

```tsx
// ✅ İYİ
<PlaceholderButton
  label="Excel'e Aktar"
  subLabel="Mart 2025'te"
  icon="📥"
/>

// ❌ KÖTÜ
<button disabled>Excel'e Aktar</button>
```

### 2. ✅ Tahmini Tarih Ver

```tsx
// ✅ İYİ
<FeatureComingSoon
  featureName="Webhooks"
  estimatedDate="Şubat 2025"
/>

// ❌ KÖTÜ
<FeatureComingSoon
  featureName="Webhooks"
  estimatedDate="Yakında"  // Belirsiz!
/>
```

### 3. ✅ İlerlemeyi Göster

```tsx
// ✅ İYİ
<PlaceholderCard
  title="Generic Data Pattern"
  progress={45}
  status="in-progress"
/>

// ❌ KÖTÜ
<PlaceholderCard
  title="Generic Data Pattern"
  status="coming-soon"  // İlerleme yok!
/>
```

### 4. ✅ Bağımlılıkları Belirt

```tsx
// ✅ İYİ
<FeatureComingSoon
  featureName="Raporlar"
  description="Generic Data Pattern tamamlandıktan sonra geliştirilecek"
/>

// ❌ KÖTÜ
<FeatureComingSoon
  featureName="Raporlar"
  description="Yakında"
/>
```

---

## 🔗 İlgili Dökümanlar

- [README.md](./README.md) - Frontend geliştirme ana sayfa
- [02_Storage_Independence.md](./02_Storage_Independence.md) - Storage bağımsızlığı

---

**[Ana Sayfa](../README.md)**



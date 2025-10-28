# 📊 HZM Veri Tabanı - Dosya Analiz Raporu

Son Güncelleme: 2025-10-28 02:57:04 (Otomatik)
Commit: N/A

> **Eşik Değerleri:**
> - ✅ **OLUMLU** (0-300 satır): İdeal boyut
> - ⚠️ **DİKKAT** (301-450 satır): Gözden geçir
> - 🔴 **BÖLÜNMELI** (451-700 satır): Refactor gerekli
> - 🔴🔴 **ACİL** (701-900 satır): Hemen bölünmeli
> - 🔴🔴🔴 **KÖTÜ DURUM** (900+ satır): Kritik - Acil müdahale

---

## 🎨 FRONTEND DOSYA ANALİZİ

### 📈 Genel İstatistikler

| Metrik | Değer |
|--------|-------|
| Toplam Dosya | 66 |
| Toplam Satır | 18,957 |
| Ortalama Dosya Boyutu | 287 satır |
| En Büyük Dosya | 1342 satır 🔴🔴🔴 |
| En Küçük Dosya | 2 satır |

### 📊 Dosya Boyutu Dağılımı

| Kategori | Dosya Sayısı | Yüzde | Durum |
|----------|--------------|-------|-------|
| ✅ Olumlu (0-300) | 40 | 61% | İyi |
| ⚠️ Dikkat (301-450) | 14 | 21% | Çok fazla! |
| 🔴 Bölünmeli (451-700) | 6 | 9% | Refactor gerekli |
| 🔴🔴 Acil (701-900) | 3 | 5% | Acil! |
| 🔴🔴🔴 Kötü (900+) | 3 | 5% | **KRİTİK!** |

---

### 🔴🔴🔴 KÖTÜ DURUM (900+ satır) - **KRİTİK!**

| # | Dosya | Satır | Yol | Durum |
|---|-------|-------|-----|-------|
| 1 | `DatabaseContext.tsx` | 1342 | `Frontend/src/context/DatabaseContext.tsx` | 🚨 **ACİL MÜDAHALE GEREKLİ** |
| 2 | `FieldPanel.tsx` | 1218 | `Frontend/src/components/layout/panels/FieldPanel.tsx` | 🚨 **ACİL MÜDAHALE GEREKLİ** |
| 3 | `DatabasePricing.tsx` | 1132 | `Frontend/src/pages/customer/pricing/DatabasePricing.tsx` | 🚨 **ACİL MÜDAHALE GEREKLİ** |

### 🔴🔴 ACİL (701-900 satır)

| # | Dosya | Satır | Yol | Durum |
|---|-------|-------|-----|-------|
| 1 | `BackendTablesPage.tsx` | 789 | `Frontend/src/pages/admin/reports/tabs/BackendTablesPage.tsx` | Hemen bölünmeli |
| 2 | `BackendTablesTab.tsx` | 749 | `Frontend/src/pages/admin/reports/tabs/BackendTablesTab.tsx` | Hemen bölünmeli |
| 3 | `DatabaseState.tsx` | 729 | `Frontend/src/pages/admin/database-state/DatabaseState.tsx` | Hemen bölünmeli |

### 🔴 BÖLÜNMELI (451-700 satır)

| # | Dosya | Satır | Yol | Öneri |
|---|-------|-------|-----|-------|
| 1 | `DatabaseUsers.tsx` | 697 | `Frontend/src/pages/admin/database-users/DatabaseUsers.tsx` | Component'lere/modüllere bölünmeli |
| 2 | `UpgradePlanPage.tsx` | 684 | `Frontend/src/pages/admin/upgrade-plan/UpgradePlanPage.tsx` | Component'lere/modüllere bölünmeli |
| 3 | `ProjectDataPage.tsx` | 543 | `Frontend/src/pages/projects/data/ProjectDataPage.tsx` | Component'lere/modüllere bölünmeli |
| 4 | `ArchitectureComplianceTab.tsx` | 511 | `Frontend/src/pages/admin/reports/tabs/ArchitectureComplianceTab.tsx` | Component'lere/modüllere bölünmeli |
| 5 | `AdLinkModal.tsx` | 496 | `Frontend/src/pages/cio/dashboard/components/AdLinkModal.tsx` | Component'lere/modüllere bölünmeli |
| 6 | `EndpointComplianceTab.tsx` | 472 | `Frontend/src/pages/admin/reports/tabs/EndpointComplianceTab.tsx` | Component'lere/modüllere bölünmeli |

**Toplam: 6 dosya refactor edilmeli**

### ⚠️ DİKKAT (301-450 satır)

**14 dosya var - İlk 10 gösteriliyor:**

| # | Dosya | Satır | Yol | Durum |
|---|-------|-------|-----|-------|
| 1 | `ApiKeyDisplay.tsx` | 448 | `Frontend/src/components/shared/ApiKeyDisplay.tsx` | İzlenmeli |
| 2 | `ProjectsListPage.tsx` | 429 | `Frontend/src/pages/projects/list/ProjectsListPage.tsx` | İzlenmeli |
| 3 | `UserSettingsPage.tsx` | 424 | `Frontend/src/pages/customer/settings/UserSettingsPage.tsx` | İzlenmeli |
| 4 | `MigrationSchemaTab.tsx` | 419 | `Frontend/src/pages/admin/reports/tabs/MigrationSchemaTab.tsx` | İzlenmeli |
| 5 | `CIODashboard.tsx` | 416 | `Frontend/src/pages/cio/dashboard/CIODashboard.tsx` | İzlenmeli |
| 6 | `SystemSettingsPage.tsx` | 393 | `Frontend/src/pages/master-admin/system-settings/SystemSettingsPage.tsx` | İzlenmeli |
| 7 | `BackendStructureTab.tsx` | 376 | `Frontend/src/pages/admin/reports/tabs/BackendStructureTab.tsx` | İzlenmeli |
| 8 | `FrontendStructureTab.tsx` | 376 | `Frontend/src/pages/admin/reports/tabs/FrontendStructureTab.tsx` | İzlenmeli |
| 9 | `PhaseProgressTab.tsx` | 363 | `Frontend/src/pages/admin/reports/tabs/PhaseProgressTab.tsx` | İzlenmeli |
| 10 | `WrongProgressTab.tsx` | 345 | `Frontend/src/pages/admin/reports/tabs/WrongProgressTab.tsx` | İzlenmeli |

**Toplam: 14 dosya gözden geçirilmeli**

### ✅ OLUMLU (0-300 satır)

**40 dosya (61%)** - İyi!

| # | Dosya | Satır | Yol | Durum |
|---|-------|-------|-----|-------|
| 1 | `vite-env.d.ts` | 2 | `Frontend/src/vite-env.d.ts` | ✅ İyi |
| 2 | `index.ts` | 5 | `Frontend/src/components/layout/index.ts` | ✅ İyi |
| 3 | `index.ts` | 5 | `Frontend/src/utils/index.ts` | ✅ İyi |
| 4 | `index.ts` | 6 | `Frontend/src/components/layout/panels/index.ts` | ✅ İyi |
| 5 | `index.ts` | 7 | `Frontend/src/pages/cio/dashboard/index.ts` | ✅ İyi |
| 6 | `index.ts` | 8 | `Frontend/src/components/shared/index.ts` | ✅ İyi |
| 7 | `main.tsx` | 11 | `Frontend/src/main.tsx` | ✅ İyi |
| 8 | `Layout.tsx` | 16 | `Frontend/src/components/layout/Layout.tsx` | ✅ İyi |
| 9 | `user.ts` | 16 | `Frontend/src/types/user.ts` | ✅ İyi |
| 10 | `ProtectedRoute.tsx` | 19 | `Frontend/src/components/shared/ProtectedRoute.tsx` | ✅ İyi |
| 11 | `index.ts` | 22 | `Frontend/src/types/index.ts` | ✅ İyi |
| 12 | `AdminRoute.tsx` | 23 | `Frontend/src/components/shared/AdminRoute.tsx` | ✅ İyi |
| 13 | `campaignUtils.ts` | 35 | `Frontend/src/pages/cio/dashboard/utils/campaignUtils.ts` | ✅ İyi |
| 14 | `database.ts` | 47 | `Frontend/src/types/database.ts` | ✅ İyi |
| 15 | `ProjectPanel.tsx` | 60 | `Frontend/src/components/layout/panels/ProjectPanel.tsx` | ✅ İyi |
| 16 | `pricing.ts` | 60 | `Frontend/src/types/pricing.ts` | ✅ İyi |
| 17 | `index.ts` | 68 | `Frontend/src/pages/cio/dashboard/types/index.ts` | ✅ İyi |
| 18 | `adPlatforms.ts` | 69 | `Frontend/src/pages/cio/dashboard/utils/adPlatforms.ts` | ✅ İyi |
| 19 | `SocialMediaDisplay.tsx` | 70 | `Frontend/src/components/layout/SocialMediaDisplay.tsx` | ✅ İyi |
| 20 | `SEOHead.tsx` | 74 | `Frontend/src/components/shared/SEOHead.tsx` | ✅ İyi |
| 21 | `socialPlatforms.ts` | 75 | `Frontend/src/pages/cio/dashboard/utils/socialPlatforms.ts` | ✅ İyi |
| 22 | `PlanComplianceTab.tsx` | 82 | `Frontend/src/pages/admin/reports/tabs/PlanComplianceTab.tsx` | ✅ İyi |
| 23 | `project.ts` | 97 | `Frontend/src/types/project.ts` | ✅ İyi |
| 24 | `ConfirmModal.tsx` | 102 | `Frontend/src/components/shared/ConfirmModal.tsx` | ✅ İyi |
| 25 | `AdDisplay.tsx` | 134 | `Frontend/src/pages/cio/dashboard/components/AdDisplay.tsx` | ✅ İyi |
| 26 | `CampaignCard.tsx` | 136 | `Frontend/src/pages/cio/dashboard/components/CampaignCard.tsx` | ✅ İyi |
| 27 | `LoginPage.tsx` | 151 | `Frontend/src/pages/common/login/LoginPage.tsx` | ✅ İyi |
| 28 | `AdCard.tsx` | 161 | `Frontend/src/pages/cio/dashboard/components/AdCard.tsx` | ✅ İyi |
| 29 | `HomePage.tsx` | 165 | `Frontend/src/pages/common/home/HomePage.tsx` | ✅ İyi |
| 30 | `index.tsx` | 170 | `Frontend/src/pages/admin/reports/index.tsx` | ✅ İyi |
| 31 | `RegisterPage.tsx` | 208 | `Frontend/src/pages/common/register/RegisterPage.tsx` | ✅ İyi |
| 32 | `TablePanel.tsx` | 217 | `Frontend/src/components/layout/panels/TablePanel.tsx` | ✅ İyi |
| 33 | `apiKeyGenerator.ts` | 221 | `Frontend/src/utils/apiKeyGenerator.ts` | ✅ İyi |
| 34 | `App.tsx` | 224 | `Frontend/src/App.tsx` | ✅ İyi |
| 35 | `api.ts` | 235 | `Frontend/src/services/api.ts` | ✅ İyi |
| 36 | `ProjectStructureReportTab.tsx` | 250 | `Frontend/src/pages/admin/reports/tabs/ProjectStructureReportTab.tsx` | ✅ İyi |
| 37 | `DashboardPage.tsx` | 251 | `Frontend/src/pages/customer/dashboard/DashboardPage.tsx` | ✅ İyi |
| 38 | `CampaignModal.tsx` | 273 | `Frontend/src/pages/cio/dashboard/components/CampaignModal.tsx` | ✅ İyi |
| 39 | `SEOManager.tsx` | 280 | `Frontend/src/pages/cio/dashboard/components/SEOManager.tsx` | ✅ İyi |
| 40 | `AdminDashboardPage.tsx` | 282 | `Frontend/src/pages/admin/dashboard/AdminDashboardPage.tsx` | ✅ İyi |

---

## ⚙️ BACKEND DOSYA ANALİZİ

### 📈 Genel İstatistikler

| Metrik | Değer |
|--------|-------|
| Toplam Dosya | 66 |
| Toplam Satır | 9,937 |
| Ortalama Dosya Boyutu | 151 satır |
| En Büyük Dosya | 2414 satır 🔴🔴🔴 |
| En Küçük Dosya | 13 satır |

### 📊 Dosya Boyutu Dağılımı

| Kategori | Dosya Sayısı | Yüzde | Durum |
|----------|--------------|-------|-------|
| ✅ Olumlu (0-300) | 59 | 89% | İyi |
| ⚠️ Dikkat (301-450) | 4 | 6% | Gözden geçir |
| 🔴 Bölünmeli (451-700) | 2 | 3% | Refactor gerekli |
| 🔴🔴 Acil (701-900) | 0 | 0% | Yok |
| 🔴🔴🔴 Kötü (900+) | 1 | 2% | **KRİTİK!** |

---

### 🔴🔴🔴 KÖTÜ DURUM (900+ satır) - **KRİTİK!**

| # | Dosya | Satır | Yol | Durum |
|---|-------|-------|-----|-------|
| 1 | `admin.js` | 2414 | `Backend/src/routes/admin.js` | 🚨 **ACİL MÜDAHALE GEREKLİ** |

### 🔴🔴 ACİL (701-900 satır)

*Yok - İyi durum!* ✅

### 🔴 BÖLÜNMELI (451-700 satır)

| # | Dosya | Satır | Yol | Öneri |
|---|-------|-------|-----|-------|
| 1 | `analyze-files.js` | 564 | `Backend/src/scripts/analyze-files.js` | Modüllere bölünmeli |
| 2 | `api-keys.js` | 494 | `Backend/src/routes/api-keys.js` | Modüllere bölünmeli |

**Toplam: 2 dosya refactor edilmeli**

### ⚠️ DİKKAT (301-450 satır)

| # | Dosya | Satır | Yol | Durum |
|---|-------|-------|-----|-------|
| 1 | `migrationComparator.js` | 444 | `Backend/src/utils/migrationComparator.js` | İzlenmeli |
| 2 | `auth.js` | 412 | `Backend/src/middleware/auth.js` | İzlenmeli |
| 3 | `generic-data.js` | 361 | `Backend/src/routes/generic-data.js` | İzlenmeli |
| 4 | `migrationParser.js` | 343 | `Backend/src/utils/migrationParser.js` | İzlenmeli |

**Toplam: 4 dosya gözden geçirilmeli**

### ✅ OLUMLU (0-300 satır)

**59 dosya (89%)** - İyi!

| # | Dosya | Satır | Yol | Durum |
|---|-------|-------|-----|-------|
| 1 | `003_add_api_keys.sql` | 13 | `Backend/migrations/003_add_api_keys.sql` | ✅ İyi |
| 2 | `architecture-compliance.service.js` | 17 | `Backend/src/modules/admin/services/architecture-compliance.service.js` | ✅ İyi |
| 3 | `endpoint-compliance.service.js` | 17 | `Backend/src/modules/admin/services/endpoint-compliance.service.js` | ✅ İyi |
| 4 | `phase-progress.service.js` | 17 | `Backend/src/modules/admin/services/phase-progress.service.js` | ✅ İyi |
| 5 | `plan-compliance.service.js` | 17 | `Backend/src/modules/admin/services/plan-compliance.service.js` | ✅ İyi |
| 6 | `project-structure.service.js` | 17 | `Backend/src/modules/admin/services/project-structure.service.js` | ✅ İyi |
| 7 | `table-comparison.service.js` | 17 | `Backend/src/modules/admin/services/table-comparison.service.js` | ✅ İyi |
| 8 | `wrong-progress.service.js` | 17 | `Backend/src/modules/admin/services/wrong-progress.service.js` | ✅ İyi |
| 9 | `tables-info.service.js` | 20 | `Backend/src/modules/admin/services/tables-info.service.js` | ✅ İyi |
| 10 | `health.routes.js` | 20 | `Backend/src/modules/health/health.routes.js` | ✅ İyi |
| 11 | `database-stats.service.js` | 21 | `Backend/src/modules/admin/services/database-stats.service.js` | ✅ İyi |
| 12 | `migration-report.service.js` | 21 | `Backend/src/modules/admin/services/migration-report.service.js` | ✅ İyi |
| 13 | `api-key.routes.js` | 24 | `Backend/src/modules/api-keys/api-key.routes.js` | ✅ İyi |
| 14 | `auth.routes.js` | 25 | `Backend/src/modules/auth/auth.routes.js` | ✅ İyi |
| 15 | `002_seed_data.sql` | 25 | `Backend/migrations/002_seed_data.sql` | ✅ İyi |
| 16 | `004_add_migration_checksum.sql` | 25 | `Backend/migrations/004_add_migration_checksum.sql` | ✅ İyi |
| 17 | `user.routes.js` | 31 | `Backend/src/modules/users/user.routes.js` | ✅ İyi |
| 18 | `data.routes.js` | 35 | `Backend/src/modules/data/data.routes.js` | ✅ İyi |
| 19 | `logger.js` | 36 | `Backend/src/shared/utils/logger.js` | ✅ İyi |
| 20 | `admin.routes.js` | 39 | `Backend/src/modules/admin/admin.routes.js` | ✅ İyi |
| 21 | `migration-tracker.model.js` | 40 | `Backend/src/modules/admin/models/migration-tracker.model.js` | ✅ İyi |
| 22 | `database.js` | 41 | `Backend/src/shared/config/database.js` | ✅ İyi |
| 23 | `validator.js` | 42 | `Backend/src/modules/data/utils/validator.js` | ✅ İyi |
| 24 | `index.js` | 47 | `Backend/src/config/index.js` | ✅ İyi |
| 25 | `health.js` | 50 | `Backend/src/routes/health.js` | ✅ İyi |
| 26 | `query-builder.js` | 51 | `Backend/src/modules/data/utils/query-builder.js` | ✅ İyi |
| 27 | `index.js` | 55 | `Backend/src/shared/config/index.js` | ✅ İyi |
| 28 | `database-inspector.model.js` | 58 | `Backend/src/modules/admin/models/database-inspector.model.js` | ✅ İyi |
| 29 | `api-key.controller.js` | 58 | `Backend/src/modules/api-keys/api-key.controller.js` | ✅ İyi |
| 30 | `logger.js` | 60 | `Backend/src/utils/logger.js` | ✅ İyi |
| 31 | `005_create_projects_table.sql` | 64 | `Backend/migrations/005_create_projects_table.sql` | ✅ İyi |
| 32 | `database.js` | 66 | `Backend/src/config/database.js` | ✅ İyi |
| 33 | `api-key.service.js` | 67 | `Backend/src/modules/api-keys/api-key.service.js` | ✅ İyi |
| 34 | `health.controller.js` | 76 | `Backend/src/modules/health/health.controller.js` | ✅ İyi |
| 35 | `api-key.model.js` | 85 | `Backend/src/modules/api-keys/api-key.model.js` | ✅ İyi |
| 36 | `data.model.js` | 86 | `Backend/src/modules/data/data.model.js` | ✅ İyi |
| 37 | `006_cleanup_and_create_master_admin.sql` | 86 | `Backend/migrations/006_cleanup_and_create_master_admin.sql` | ✅ İyi |
| 38 | `project.routes.js` | 90 | `Backend/src/modules/projects/project.routes.js` | ✅ İyi |
| 39 | `auth.service.js` | 91 | `Backend/src/modules/auth/auth.service.js` | ✅ İyi |
| 40 | `user.model.js` | 94 | `Backend/src/modules/users/user.model.js` | ✅ İyi |
| 41 | `user.service.js` | 94 | `Backend/src/modules/users/user.service.js` | ✅ İyi |
| 42 | `data.service.js` | 95 | `Backend/src/modules/data/data.service.js` | ✅ İyi |
| 43 | `user.controller.js` | 96 | `Backend/src/modules/users/user.controller.js` | ✅ İyi |
| 44 | `redis.js` | 104 | `Backend/src/config/redis.js` | ✅ İyi |
| 45 | `admin.controller.js` | 108 | `Backend/src/modules/admin/admin.controller.js` | ✅ İyi |
| 46 | `data.controller.js` | 114 | `Backend/src/modules/data/data.controller.js` | ✅ İyi |
| 47 | `auth.model.js` | 116 | `Backend/src/modules/auth/auth.model.js` | ✅ İyi |
| 48 | `server.js` | 121 | `Backend/src/server.js` | ✅ İyi |
| 49 | `auth.js` | 121 | `Backend/src/shared/middleware/auth.js` | ✅ İyi |
| 50 | `001_initial_schema.sql` | 124 | `Backend/migrations/001_initial_schema.sql` | ✅ İyi |
| 51 | `auth.controller.js` | 132 | `Backend/src/modules/auth/auth.controller.js` | ✅ İyi |
| 52 | `apiKeyGenerator.js` | 155 | `Backend/src/modules/api-keys/utils/apiKeyGenerator.js` | ✅ İyi |
| 53 | `project.controller.js` | 209 | `Backend/src/modules/projects/project.controller.js` | ✅ İyi |
| 54 | `auth.js` | 233 | `Backend/src/routes/auth.js` | ✅ İyi |
| 55 | `project.model.js` | 245 | `Backend/src/modules/projects/project.model.js` | ✅ İyi |
| 56 | `project.service.js` | 249 | `Backend/src/modules/projects/project.service.js` | ✅ İyi |
| 57 | `projects.js` | 257 | `Backend/src/routes/projects.js` | ✅ İyi |
| 58 | `migrate.js` | 276 | `Backend/src/scripts/migrate.js` | ✅ İyi |
| 59 | `schemaInspector.js` | 295 | `Backend/src/utils/schemaInspector.js` | ✅ İyi |

---

## 🎯 ÖNCELİKLİ REFACTORING LİSTESİ

### 🚨 KRİTİK ÖNCELİK (Bugün yapılmalı)

1. **🔴🔴🔴 admin.js (2414 satır)** - Backend
   - Yol: `Backend/src/routes/admin.js`
   - Durum: KÖTÜ - 900+ satır
   - Önemi: **Kritik** - Bakım imkansız

2. **🔴🔴🔴 DatabaseContext.tsx (1342 satır)** - Frontend
   - Yol: `Frontend/src/context/DatabaseContext.tsx`
   - Durum: KÖTÜ - 900+ satır
   - Önemi: **Kritik** - Bakım imkansız

3. **🔴🔴🔴 FieldPanel.tsx (1218 satır)** - Frontend
   - Yol: `Frontend/src/components/layout/panels/FieldPanel.tsx`
   - Durum: KÖTÜ - 900+ satır
   - Önemi: **Kritik** - Bakım imkansız

4. **🔴🔴🔴 DatabasePricing.tsx (1132 satır)** - Frontend
   - Yol: `Frontend/src/pages/customer/pricing/DatabasePricing.tsx`
   - Durum: KÖTÜ - 900+ satır
   - Önemi: **Kritik** - Bakım imkansız

### 🔴 YÜKSEK ÖNCELİK (Bu hafta)

1. **🔴🔴 BackendTablesPage.tsx (789 satır)** - Frontend
   - Yol: `Frontend/src/pages/admin/reports/tabs/BackendTablesPage.tsx`
   - Durum: ACİL - 701-900 satır

2. **🔴🔴 BackendTablesTab.tsx (749 satır)** - Frontend
   - Yol: `Frontend/src/pages/admin/reports/tabs/BackendTablesTab.tsx`
   - Durum: ACİL - 701-900 satır

3. **🔴🔴 DatabaseState.tsx (729 satır)** - Frontend
   - Yol: `Frontend/src/pages/admin/database-state/DatabaseState.tsx`
   - Durum: ACİL - 701-900 satır

### ⚠️ ORTA ÖNCELİK (Bu ay)

1. **🔴 DatabaseUsers.tsx (697 satır)** - Frontend
2. **🔴 UpgradePlanPage.tsx (684 satır)** - Frontend
3. **🔴 analyze-files.js (564 satır)** - Backend
4. **🔴 ProjectDataPage.tsx (543 satır)** - Frontend
5. **🔴 ArchitectureComplianceTab.tsx (511 satır)** - Frontend
6. **🔴 AdLinkModal.tsx (496 satır)** - Frontend
7. **🔴 api-keys.js (494 satır)** - Backend
8. **🔴 EndpointComplianceTab.tsx (472 satır)** - Frontend

---

## 📈 HEDEF METRİKLER & İLERLEME

| Metrik | Şu An | Hedef | İlerleme | Durum |
|--------|-------|-------|----------|-------|
| **900+ satır dosya** | 4 | 0 | 🔴 0% | Kritik |
| **451+ satır dosya** | 11 | 0 | 🔴 0% | Kötü |
| **301+ satır dosya** | 18 | <5 | 🔴 0% | Kötü |
| **Ortalama (Frontend)** | 287 satır | <100 | ⚠️ 0% | Yüksek |
| **Ortalama (Backend)** | 151 satır | <150 | ⚠️ 0% | Yüksek |

---

## 🤖 OTOMATIK KONTROL KURALLARI

### ❌ PR Reddedilir:
- 🔴🔴🔴 900+ satır yeni dosya eklenirse
- 🔴🔴 701+ satır yeni dosya eklenirse

### ⚠️ Review Gerektirir:
- 🔴 451-700 satır yeni dosya eklenirse
- ⚠️ 301-450 satır dosyaya 50+ satır eklenirse

### ✅ Otomatik Onay:
- 0-300 satır yeni dosya
- Mevcut dosyalara <50 satır ekleme

---

## 💡 ÖNERİLER

1. 🚨 **4 kritik dosya için acil eylem planı oluştur**
2. 🔴 **11 dosya için refactoring sprint planla**
3. ⚠️ **301-450 satırlık 18 dosyayı haftalık gözden geçir**
- ✅ **Yeni dosya ekleme kuralı koy: Max 300 satır**
- 🤖 **Otomatik linter kuralı ekle (ESLint/TSLint)**
- 📊 **Bu raporu haftalık gözden geçir**

---

*Bu rapor otomatik olarak `scripts/analyze-files.js` tarafından oluşturulmuştur.*

# 🔍 GitHub Backend Scanner Setup

Backend compliance taraması için GitHub entegrasyonu kurulumu.

## 📋 Gereksinimler

Backend kod taraması iki modda çalışır:

### 1️⃣ **Local Mode** (Development)
- Local dosya sisteminden tarama
- Hızlı ve kolay
- Environment variable gerekmez

### 2️⃣ **GitHub Mode** (Production/Railway)
- GitHub API'den tarama
- Path sorunları yok
- Tutarlı sonuçlar
- Deployed kod yerine source code taraması

---

## 🔑 GitHub Token Oluşturma

### Adım 1: GitHub Settings
1. https://github.com/settings/tokens
2. **"Generate new token"** → **"Generate new token (classic)"**

### Adım 2: Token Ayarları
```
Note: HZM Database Compliance Scanner
Expiration: 90 days (veya No expiration)

Permissions (Scopes):
✅ repo (Full control of private repositories)
   ├─ repo:status
   ├─ repo_deployment
   ├─ public_repo
   └─ repo:invite
```

### Adım 3: Token'ı Kopyala
- ⚠️ **Token sadece 1 kere gösterilir!**
- Format: `ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXX`
- Hemen bir yere kaydet

---

## 🚂 Railway Environment Variables

### Railway Dashboard'a Git
1. https://railway.app/project/YOUR_PROJECT
2. Backend Service'i seç
3. **Variables** sekmesine tıkla

### Environment Variables Ekle

```bash
# GitHub Token (zorunlu)
GITHUB_TOKEN=ghp_YOUR_GITHUB_TOKEN_HERE

# Backend Repository (GitHub mode için gerekli)
GITHUB_BACKEND_REPO=altintassoft/HzmDataBaseBackend

# Frontend Repository (zaten mevcut)
GITHUB_FRONTEND_REPO=altintassoft/HzmDatabaseFrontend
```

### ⚠️ Önemli Notlar:
- `GITHUB_BACKEND_REPO` **YOK** ise → Local mode (Railway'de çalışmaz!)
- `GITHUB_BACKEND_REPO` **VAR** ise → GitHub mode (Her yerde çalışır!)

---

## 🎯 Nasıl Çalışır?

### Backend Analyzer Logic:
```javascript
if (process.env.GITHUB_BACKEND_REPO) {
  // GitHub'dan tara (Production)
  analyzeGitHub('altintassoft/HzmDataBaseBackend');
} else {
  // Local file system'den tara (Development)
  analyzeLocal('/app/src');
}
```

### Avantajlar:
- ✅ **Path sorunları yok** - Railway/Local farklılıkları ortadan kalkar
- ✅ **Tutarlı sonuçlar** - Her deploy'da aynı kaynak (GitHub)
- ✅ **Best Practice** - Deployed code değil, source code taraması
- ✅ **Tek kaynak** - GitHub = Single Source of Truth

---

## 🧪 Test Etme

### Railway Logs'ta Kontrol:
```
📂 Backend root path (cwd): /app
📂 Source directory: /app/src
🔍 Backend analyzing (GITHUB mode)         ← BUNU GÖRMEK İSTİYORUZ!
📡 Analyzing backend from GitHub: altintassoft/HzmDataBaseBackend
[Rule-01 GITHUB] Found 145 JS/TS files in src/
[Rule-01 GITHUB] Scanned 145 files, found 80 violations in 28 files
✅ GitHub backend analysis completed
```

### Local'de Test:
```bash
# Terminal'de:
cd HzmVeriTabaniBackend

# GitHub mode test (env var ile):
GITHUB_TOKEN=ghp_xxx GITHUB_BACKEND_REPO=altintassoft/HzmDataBaseBackend npm start

# Local mode test (env var olmadan):
npm start
```

---

## 🔧 Sorun Giderme

### Backend GitHub Mode Çalışmıyor
```bash
# Logs'ta bunu görüyorsan:
🔍 Backend analyzing (LOCAL mode)  ← YANLIŞ!

# Nedeni:
❌ GITHUB_BACKEND_REPO environment variable eksik

# Çözüm:
1. Railway → Variables
2. GITHUB_BACKEND_REPO=altintassoft/HzmDataBaseBackend ekle
3. Deploy'u bekle
```

### Token Geçersiz
```bash
# Logs'ta:
❌ GitHub taraması başarısız: Bad credentials

# Çözüm:
1. GitHub Token'ı yenile
2. Railway'de GITHUB_TOKEN'ı güncelle
```

### Dosya Bulunamadı
```bash
# Logs'ta:
[Rule-01 GITHUB] Found 0 JS/TS files in src/

# Nedeni:
❌ Repository adı yanlış veya private repo'ya erişim yok

# Çözüm:
1. GITHUB_BACKEND_REPO doğru mu kontrol et
2. Token'ın repo permission'ı var mı kontrol et
```

---

## 📊 Beklenen Sonuçlar

### Production (Railway + GitHub):
```
🔧 BACKEND KONFIGURASYON UYUMU RAPORU
• Genel Compliance: 25-30%
• Hard-Code Yasağı: ❌ UYUMSUZ (~15-20%)
  - 80+ hard-code bulundu (28 dosyada tarandı: 145 GitHub)
  - 42 deep relative path: require('../../../')
  - 22 ENV fallback: process.env.X || default
  - 16 hard-coded path: 'docs/roadmap/'
```

### Development (Local):
```
• Hard-Code Yasağı: ❌ UYUMSUZ (~15-20%)
  - 80+ hard-code bulundu (28 dosyada tarandı: 145)
```

---

## ✅ Checklist

Backend GitHub taraması için:

- [ ] GitHub Token oluşturuldu (`ghp_...`)
- [ ] Token `repo` permission'ına sahip
- [ ] Railway'de `GITHUB_TOKEN` eklendi
- [ ] Railway'de `GITHUB_BACKEND_REPO` eklendi
- [ ] Deploy tamamlandı
- [ ] Logs'ta "GITHUB mode" görünüyor
- [ ] Rapor 80+ hard-code gösteriyor

---

## 📚 Daha Fazla Bilgi

- [GitHub Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [Railway Environment Variables](https://docs.railway.app/develop/variables)
- [Backend Compliance Rules](./docs/roadmap/8-KonfigurasyonVeSurdurulebilirlik.md)

---

**✨ GitHub Backend Scanner ile tutarlı ve güvenilir kod analizi!**


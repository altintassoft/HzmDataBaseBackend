# GitHub Scanner - Frontend Compliance Analysis

## 🎯 Amaç

Railway gibi remote ortamlarda frontend kodunu taramak için GitHub API kullanır.

---

## 🔧 Kurulum

### 1. GitHub Personal Access Token Oluştur

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. "Generate new token" → "Generate new token (classic)"
3. İsim: `HZM-Backend-Compliance-Scanner`
4. Scopes:
   - ✅ `repo` (private repo için)
   - ✅ `public_repo` (sadece public repo için yeterli)
5. Token'ı kopyala: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 2. Railway Environment Variables Ekle

Railway Dashboard → Project → Variables:

```bash
GITHUB_TOKEN=ghp_your_token_here
GITHUB_FRONTEND_REPO=altintassoft/HzmDatabaseFrontend
```

### 3. Netlify/Vercel için de ekle (opsiyonel)

Eğer frontend'i de Railway'e deploy ediyorsan:

```bash
GITHUB_FRONTEND_REPO=your-org/your-frontend-repo
```

---

## 📊 Nasıl Çalışır?

### **Local Development**
```javascript
// Frontend kodu local'de var:
/Users/.../HzmVeriTabani/HzmVeriTabaniFrontend/

// ✅ Dosya sisteminden tarar (hızlı)
```

### **Railway Production**
```javascript
// Frontend kodu yok, sadece backend var

// ✅ GitHub API ile tarar:
// 1. Repository tree çeker (dosya listesi)
// 2. package.json okur
// 3. Config dosyalarını kontrol eder
// 4. 10 dosya sample alıp hard-code tarar
```

---

## 🔐 Güvenlik

### Token Permissions (Minimum)

**Public Repo:**
```
scope: public_repo
```

**Private Repo:**
```
scope: repo
```

### Rate Limits

- **Without Token:** 60 request/hour
- **With Token:** 5000 request/hour

Frontend analizi ~3-5 request kullanır:
- 1× repo exists
- 1× get tree
- 1× get package.json
- 2-10× get file content (hard-code scan)

---

## 🧪 Test

### Local Test (Token olmadan)
```bash
cd HzmVeriTabaniBackend
npm start

# Log'da göreceksin:
# 🔍 Frontend analyzing (LOCAL mode)
# ✅ Backend rules loaded: 19
```

### Railway Test (Token ile)
```bash
# Railway Variables'a ekle:
GITHUB_TOKEN=ghp_...
GITHUB_FRONTEND_REPO=altintassoft/HzmDatabaseFrontend

# Deploy sonrası log'da:
# 🔍 Frontend analyzing (GITHUB mode)
# 📡 Analyzing frontend from GitHub: altintassoft/HzmDatabaseFrontend
# ✅ Frontend rules loaded: 14
```

---

## 🐛 Troubleshooting

### "Frontend repository not found"
```
❌ Kontrol:
1. Repo name doğru mu? (owner/repo)
2. Token permission var mı?
3. Repo public mi/private mi?
```

### "GitHub API rate limit exceeded"
```
❌ Çözüm:
1. GITHUB_TOKEN ekle
2. 1 saat bekle
3. Token'ın expire olmadığından emin ol
```

### "Failed to fetch GitHub tree"
```
❌ Kontrol:
1. İnternet bağlantısı var mı?
2. GitHub API status: https://www.githubstatus.com/
3. Token valid mi? (test et: curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user)
```

---

## 📈 Performance

| Mod | Dosya Sayısı | Süre | API Call |
|-----|-------------|------|----------|
| Local | ~200 | 50ms | 0 |
| GitHub (full) | ~200 | 2-3s | 5-10 |
| GitHub (sample) | ~10 | 1s | 3-5 |

**Not:** GitHub mode'da sample alınarak hız artırılmış (10 dosya).

---

## 🔄 Fallback Stratejisi

```javascript
1. Local path var mı? → ✅ Local scan
2. GitHub token var mı? → ✅ GitHub scan
3. Hiçbiri yok → ⚠️ Boş array (frontend skip)
```

---

## 📝 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITHUB_TOKEN` | No* | - | GitHub personal access token |
| `GITHUB_FRONTEND_REPO` | No | `altintassoft/HzmDatabaseFrontend` | Format: `owner/repo` |

\* Public repo için opsiyonel ama rate limit düşük (60/hour)

---

## 🎯 Örnek Kullanım

### Railway Variables
```bash
GITHUB_TOKEN=ghp_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0
GITHUB_FRONTEND_REPO=altintassoft/HzmDatabaseFrontend
```

### Log Output
```
2025-10-28 21:48:49 [info]: 🔍 Starting configuration compliance analysis...
2025-10-28 21:48:49 [info]: 🔍 Frontend analyzing (GITHUB mode)
2025-10-28 21:48:49 [info]: 📡 Analyzing frontend from GitHub: altintassoft/HzmDatabaseFrontend
2025-10-28 21:48:49 [info]: 📡 Fetching GitHub tree: altintassoft/HzmDatabaseFrontend@main
2025-10-28 21:48:50 [info]: ✅ Fetched 187 files from GitHub
2025-10-28 21:48:51 [info]: ✅ GitHub frontend analysis completed
2025-10-28 21:48:51 [info]: ✅ Configuration compliance analysis completed
```

---

## 🚀 Deploy Checklist

- [ ] GitHub token oluşturuldu
- [ ] Railway'e `GITHUB_TOKEN` eklendi
- [ ] Railway'e `GITHUB_FRONTEND_REPO` eklendi
- [ ] Deploy edildi
- [ ] Log'da "GITHUB mode" görünüyor
- [ ] Frontend compliance %'si görünüyor

---

## 📚 Kaynaklar

- [GitHub REST API](https://docs.github.com/en/rest)
- [Creating a personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [Railway Environment Variables](https://docs.railway.app/guides/variables)


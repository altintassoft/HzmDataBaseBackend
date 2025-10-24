# GÜVENLİK KURALLARI

📌 **Cursor AI'ın güvenlik kuralları ve sistem koruması. Bu kurallar, API dokümantasyon koruması, hassas bilgi güvenliği ve kapsamlı güvenlik önlemlerini içerir.**

---

## 1. API Dokümantasyon Koruma ve Sistem Bütünlük Kuralı

**Amaç:** API dokümantasyonu korunmalı, test edilmiş endpoint'ler değiştirilmemeli ve mevcut kimlik doğrulama sistemi bozulmamalıdır.

### 🔒 Korunması Gereken Kritik Bileşenler:

#### 1. API Dokümantasyon İçeriği:
* **44KB büyüklüğündeki API_KEY_DOKUMANTASYON.md dosyası**
* **Test edilmiş 50+ curl komutu**
* **3-katmanlı kimlik doğrulama sistemi açıklaması**
* **JavaScript SDK kullanım örnekleri**

#### 2. Çalışan Test Kullanıcı Bilgileri:
```javascript
// ✅ KORUNMASI GEREKEN - Test kullanıcı bilgileri
const testUser = {
  email: "test2@example.com",
  password: "test123456"
};
```

#### 3. Doğrulanmış API Endpoint'leri:
* **Authentication endpoints** (/api/v1/auth/login, /register)
* **Project management endpoints** (/api/v1/projects/*)
* **Data operations endpoints** (/api/v1/data/*)
* **Admin endpoints** (/api/v1/admin/*)

### 🚫 Kesinlikle Değiştirilmemelidir:

#### 1. Test Edilmiş Kimlik Doğrulama:
* **Mevcut login/register sistemi**
* **JWT token yapısı ve süreleri**
* **API key üretim algoritması**
* **Rol bazlı yetkilendirme sistemi**

#### 2. Çalışan API Endpoint'leri:
* **URL pattern'leri (/api/v1/...)**
* **HTTP method'ları (GET, POST, PUT, DELETE)**  
* **Request/Response formatları**
* **Status kod'ları ve hata mesajları**

#### 3. Test Database Bağlantısı:
* **PostgreSQL bağlantı ayarları**
* **Test data seeding**
* **Tablo yapıları ve ilişkileri**

### ⚠️ Sadece Eklenebilir (Değiştirilemez):

#### 1. Yeni Özellikler:
```markdown
✅ İzin Verilen:
- Yeni endpoint'ler ekleme
- Yeni field'lar ekleme
- Yeni kimlik doğrulama yöntemleri ekleme
- Performans iyileştirmeleri
```

### 📋 Kontrol Listesi:

#### Her Değişiklik Öncesi:
- [ ] API dokümantasyonu mevcut mu?
- [ ] Test edilmiş endpoint'ler var mı?
- [ ] Çalışan kimlik doğrulama sistemi var mı?
- [ ] Bu değişiklik mevcut sistemi bozar mı?

#### Her Değişiklik Sonrası:
- [ ] Mevcut API endpoint'leri hala çalışıyor mu?
- [ ] Test kullanıcısı hala giriş yapabiliyor mu?
- [ ] Dokümantasyondaki örnekler hala geçerli mi?
- [ ] Curl komutları hala çalışıyor mu?

### 🚨 Acil Durum Protokolü:

Eğer yanlışlıkla kritik bir bileşen bozulursa:

1. **DURDUR:** Tüm geliştirme işlemlerini durdur
2. **GERİ AL:** Son çalışan versiyona geri dön
3. **TEST ET:** API dokümantasyonundaki tüm örnekleri test et
4. **DOĞRULA:** Çalışan duruma geri döndüğünü konfirm et
5. **DEVAM ET:** Güvenli geliştirme ile devam et

---

## 2. Kapsamlı Güvenlik ve Kendini Koruma Kuralı (Security & Self-Protection)

**Amaç:** Cursor, sistemin güvenlik açıklarını otomatik olarak tespit etmeli, kapatmalı ve gelecekte oluşabilecek güvenlik risklerini proaktif olarak engellemeli.

### 🔒 Hassas Bilgi ve Credential Güvenliği

#### 1. Hardcoded Credentials Tespiti ve Temizleme:
**Cursor, kodda hardcoded olarak bulunan tüm hassas bilgileri otomatik tespit etmeli:**
* **API anahtarları** (API_KEY, SECRET_KEY, ACCESS_TOKEN)
* **Şifreler** (password, pwd, pass)
* **Email adresleri** (production'da kullanılan gerçek emailler)
* **Database bağlantı stringleri**
* **JWT secret'ları**
* **OAuth client secret'ları**
* **Webhook URL'leri**
* **Admin panel erişim bilgileri**

#### 2. Environment Variable Zorunluluğu:
```javascript
// ❌ YASAK - Hardcoded credential
const API_KEY = "hzm_1ce98c92189d4a109cd604b22bfd86b7";

// ✅ DOĞRU - Environment variable
const API_KEY = process.env.VITE_HZM_API_KEY;
```

#### 3. Fallback Değer Yasağı:
```javascript
// ❌ YASAK - Fallback ile hardcoded credential
const API_KEY = process.env.VITE_HZM_API_KEY || "hzm_1ce98c92189d4a109cd604b22bfd86b7";

// ✅ DOĞRU - Fallback yok, undefined kalır
const API_KEY = process.env.VITE_HZM_API_KEY;
```

#### 4. Otomatik .env.example Oluşturma:
* **Cursor, environment variable kullanımı tespit ettiğinde otomatik olarak `.env.example` dosyası oluşturmalı**
* **Gerçek değerler yerine placeholder'lar kullanmalı:**
```env
# ✅ DOĞRU .env.example formatı
VITE_HZM_API_KEY=your_api_key_here
VITE_HZM_USER_EMAIL=your_email_here
VITE_HZM_PROJECT_PASSWORD=your_password_here
```

### 🛡️ Frontend Güvenlik Önlemleri

#### 1. XSS (Cross-Site Scripting) Koruması:
* **Tüm kullanıcı girdileri sanitize edilmeli**
* **`dangerouslySetInnerHTML` kullanımı yasaklanmalı**
* **User input'lar escape edilmeli:**
```javascript
// ❌ YASAK - XSS riski
<div dangerouslySetInnerHTML={{__html: userInput}} />

// ✅ DOĞRU - Güvenli rendering
<div>{userInput}</div>
```

#### 2. SQL Injection Koruması:
* **Direkt SQL query'leri yasaklanmalı**
* **Parametreli query'ler zorunlu:**
```javascript
// ❌ YASAK - SQL Injection riski
const query = `SELECT * FROM users WHERE email = '${email}'`;

// ✅ DOĞRU - Parametreli query
const query = "SELECT * FROM users WHERE email = ?";
```

#### 3. Local Storage Güvenlik Kuralları:
* **Hassas bilgiler localStorage/sessionStorage'da saklanmamalı**
* **JWT token'lar memory'de tutulmalı**
* **Otomatik temizleme mekanizması olmalı:**
```javascript
// ❌ YASAK - Hassas bilgi storage'da
localStorage.setItem('apiKey', API_KEY);

// ✅ DOĞRU - Memory'de tutma
let apiKey = null; // sadece memory'de
```

### 🔐 API Güvenlik Önlemleri

#### 1. CORS Yapılandırması:
* **Wildcard (*) CORS ayarları yasaklanmalı**
* **Spesifik domain'ler belirtilmeli:**
```javascript
// ❌ YASAK - Wildcard CORS
'Access-Control-Allow-Origin': '*'

// ✅ DOĞRU - Spesifik domain
'Access-Control-Allow-Origin': 'https://vardiyaasistani.netlify.app'
```

#### 2. Rate Limiting ve Timeout:
* **Tüm API isteklerinde timeout olmalı**
* **Aşırı istek koruması:**
```javascript
// ✅ ZORUNLU - Timeout ve abort controller
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 15000);
```

#### 3. API Response Validation:
* **Tüm API response'ları validate edilmeli**
* **Unexpected data'ya karşı korunmalı:**
```javascript
// ✅ DOĞRU - Response validation
if (!response.ok || !response.data) {
  throw new Error('Invalid API response');
}
```

### 🚫 Yasaklı Kod Kalıpları ve Otomatik Temizleme

#### 1. Console.log Temizleme:
* **Production'da console.log'lar otomatik temizlenmeli**
* **Debug bilgileri production'a çıkmamalı:**
```javascript
// ❌ YASAK - Production'da debug log
console.log('API Key:', API_KEY);

// ✅ DOĞRU - Sadece error log
console.error('API Error:', error.message);
```

#### 2. Geliştirici Yorumları Temizleme:
* **TODO, FIXME, HACK yorumları production'da temizlenmeli**
* **Geliştirici notları kaldırılmalı:**
```javascript
// ❌ YASAK - Production'da kişisel not
// TODO: Bu kısmı düzelt - Ahmet

// ✅ DOĞRU - Temiz kod
// User authentication logic
```

#### 3. Test ve Mock Data Temizleme:
* **Test kullanıcıları, mock data'lar production'da olmamalı**
* **Geçici endpoint'ler kaldırılmalı**

### 🔍 Otomatik Güvenlik Taraması

#### 1. Dependency Vulnerability Kontrolü:
* **package.json'daki dependency'ler güvenlik açısından kontrol edilmeli**
* **Güncel olmayan paketler tespit edilmeli**
* **Bilinen güvenlik açığı olan paketler uyarılmalı**

#### 2. Code Pattern Analysis:
**Cursor, aşağıdaki tehlikeli kod kalıplarını otomatik tespit etmeli:**
* **`eval()` kullanımı**
* **`document.write()` kullanımı**
* **`innerHTML` ile user input**
* **Unvalidated redirects**
* **File upload without validation**

#### 3. Network Security Check:
* **HTTP bağlantıları tespit edilip HTTPS'e çevrilmeli:**
```javascript
// ❌ YASAK - HTTP bağlantı
const API_URL = "http://api.example.com";

// ✅ DOĞRU - HTTPS bağlantı
const API_URL = "https://api.example.com";
```

### 🛠️ Proaktif Güvenlik Önlemleri

#### 1. Input Validation Framework:
* **Tüm form input'ları için otomatik validation**
* **Type checking ve sanitization:**
```javascript
// ✅ ZORUNLU - Input validation
const validateEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email) && email.length < 255;
};
```

#### 2. Error Handling Security:
* **Error mesajlarında hassas bilgi sızmamalı**
* **Generic error mesajları kullanılmalı:**
```javascript
// ❌ YASAK - Hassas bilgi sızan error
throw new Error(`Database connection failed: ${DB_PASSWORD}`);

// ✅ DOĞRU - Generic error
throw new Error('Database connection failed');
```

#### 3. Authentication State Management:
* **Authentication state güvenli şekilde yönetilmeli**
* **Token expiry kontrolü otomatik olmalı**
* **Session hijacking koruması olmalı**

### 🚨 Kritik Güvenlik Kuralları

#### 1. Zero Trust Principle:
* **Hiçbir user input'a güvenilmemeli**
* **Tüm data server-side validate edilmeli**
* **Client-side validation sadece UX için kullanılmalı**

#### 2. Principle of Least Privilege:
* **Minimum gerekli yetki verilmeli**
* **Admin yetkiler sınırlandırılmalı**
* **Role-based access control uygulanmalı**

#### 3. Defense in Depth:
* **Çoklu güvenlik katmanları olmalı**
* **Tek nokta güvenlik açığı sistemi çökertemeli**
* **Backup güvenlik mekanizmaları bulunmalı**

### 🔧 Otomatik Güvenlik İyileştirmeleri

#### 1. Security Headers:
```javascript
// ✅ ZORUNLU - Güvenlik header'ları
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000',
  'Content-Security-Policy': "default-src 'self'"
};
```

#### 2. Automated Security Updates:
* **Cursor, güvenlik açığı tespit ettiğinde otomatik düzeltme yapmalı**
* **Security patch'ler otomatik uygulanmalı**
* **Kullanıcıya güvenlik iyileştirmeleri rapor edilmeli**

#### 3. Continuous Security Monitoring:
* **Her kod değişikliğinde güvenlik kontrolü yapılmalı**
* **Regression güvenlik testleri otomatik çalışmalı**
* **Security metrics takip edilmeli**

### 📊 Güvenlik Raporlama ve Monitoring

#### 1. Security Audit Log:
* **Tüm güvenlik değişiklikleri loglanmalı**
* **Audit trail oluşturulmalı**
* **Güvenlik olayları takip edilmeli**

#### 2. Vulnerability Assessment Report:
* **Düzenli güvenlik değerlendirmesi yapılmalı**
* **Risk seviyesi belirlenmeli**
* **İyileştirme önerileri sunulmalı**

#### 3. Compliance Check:
* **GDPR, KVKK gibi veri koruma düzenlemelerine uygunluk**
* **Security best practices kontrolü**
* **Industry standards compliance**

### 🎯 Uygulama ve Zorunluluk

#### 1. Otomatik Uygulama:
* **Bu güvenlik kuralları otomatik olarak uygulanmalı**
* **Kullanıcıdan onay beklenmemeli**
* **Güvenlik açığı tespit edildiğinde anında düzeltilmeli**

#### 2. Geri Alınamaz Kurallar:
* **Güvenlik düzeltmeleri geri alınamaz**
* **Hardcoded credential temizleme işlemleri kalıcı**
* **Security header'lar zorunlu**

#### 3. Sürekli İyileştirme:
* **Yeni güvenlik tehditleri sürekli takip edilmeli**
* **Güvenlik kuralları güncel tutulmalı**
* **Zero-day vulnerability'lere karşı proaktif koruma**

### 🚫 Kesinlikle Yasaklanan Davranışlar

#### 1. Güvenlik Atlatma:
* **Güvenlik kontrollerini bypass etme girişimi**
* **Security warning'leri görmezden gelme**
* **Geçici güvenlik açığı oluşturma**

#### 2. Hassas Bilgi Exposure:
* **API key'leri log'lama**
* **Error mesajlarında credential gösterme**
* **Debug mode'da production'a çıkma**

#### 3. Güvensiz Kod Kalıpları:
* **Deprecated security functions kullanma**
* **Weak encryption algorithms**
* **Insecure random number generation**

### ✅ Başarı Kriterleri

Bu kural başarılı sayılır eğer:

1. **Sıfır hardcoded credential** sistemde bulunursa
2. **Tüm API istekleri** güvenli şekilde yapılırsa
3. **Hiçbir XSS/SQL injection** açığı bulunmazsa
4. **Tüm user input'lar** validate edilirse
5. **Production ortamı** tamamen güvenli hale gelirse

### 🔄 Sürekli Güvenlik Döngüsü

1. **Detect** → Güvenlik açığı tespit et
2. **Analyze** → Risk seviyesini değerlendir
3. **Fix** → Otomatik düzeltme uygula
4. **Verify** → Düzeltmeyi doğrula
5. **Monitor** → Sürekli izleme yap
6. **Improve** → Güvenlik önlemlerini geliştir

---

## 🎯 GÜVENLİK PRENSİPLERİ

### ✅ Yapılması Gerekenler:
- **Otomatik güvenlik taraması yapılmalı**
- **Hardcoded credential'lar temizlenmeli**
- **API dokümantasyonu korunmalı**
- **Production güvenliği sağlanmalı**
- **Sürekli monitoring yapılmalı**

### ❌ Yapılmaması Gerekenler:
- **Güvenlik kontrollerini atlamamalı**
- **Hassas bilgi expose edilmemeli**
- **Test data production'da olmamalı**
- **Deprecated security functions kullanılmamalı**
- **Güvenlik uyarıları görmezden gelinmemeli**

### 🔄 Sürekli İyileştirme:
- **Güvenlik tehditleri takip edilmeli**
- **Security metrics monitör edilmeli**
- **Vulnerability assessment düzenli yapılmalı**
- **Security training güncel tutulmalı**

---

## 📊 BAŞARI METRİKLERİ

### 🔒 Güvenlik:
- **Zero hardcoded credentials: 100%**
- **XSS vulnerability: 0**
- **SQL injection risk: 0**
- **Security score: >95%**

### 🛡️ Koruma:
- **API documentation integrity: 100%**
- **Test endpoint availability: 100%**
- **Authentication system uptime: >99.9%**
- **Security incident count: 0**

### 📈 Monitoring:
- **Security scan frequency: Daily**
- **Vulnerability detection time: <5 minutes**
- **Fix deployment time: <30 minutes**
- **False positive rate: <5%**

---

## 🔐 BAĞLAYICI GÜVENLİK KURALLARI

**Bu kurallar tüm güvenlik operasyonlarında zorunludur ve ihlal edilemez!**

**Sistem güvenliği ve API dokümantasyon koruması her zaman en yüksek öncelik olmalıdır.**

Bu kurallar, sistemin **kendini koruması** ve **sürekli güvenli kalması** için yaşayan dokümanlardır ve sürekli güncellenmelidir.

---

**📅 Son Güncelleme:** 29 Temmuz 2025  
**📝 Kategori:** Güvenlik Kuralları  
**🔄 Versiyon:** 1.0.0 - Kategorilere Ayrılmış Versiyon 
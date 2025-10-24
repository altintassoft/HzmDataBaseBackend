# HZM VERİTABANI TEMEL KURAL SETİ

📌 **HZM Veritabanı projesi için özel olarak tanımlanmış, proje yapısını koruyan ve sistem bütünlüğünü sağlayan temel kurallardır. Bu kurallar, diğer tüm kurallardan önce uygulanmalı ve hiçbir durumda ihlal edilmemelidir.**

---

## 1. Program Akışı ve Mimari Uyumluluk Kuralı

**Amaç:** Cursor'un her işlem öncesinde sistem mimarisini kontrol etmesi ve mevcut yapıyı koruması.

### 📋 PROGRAM_AKISI_VE_YAPISI.md Zorunluluğu:
* **Cursor, her işlem öncesinde `PROGRAM_AKISI_VE_YAPISI.md` dosyasını kontrol etmelidir**
* **Tüm kod değişiklikleri bu dokümandaki yapıya uygun olmalıdır**
* **Mevcut mimariyi bozan hiçbir değişiklik yapılmamalıdır**

### 🔍 Mimari Uyumluluk Kontrolü:
```markdown
# ✅ ZORUNLU KONTROL LİSTESİ - Her işlem öncesi
1. Program akışı dokümantasyonu okundu mu?
2. Mevcut klasör yapısı korunuyor mu?
3. Backend/Frontend ayrımı bozuluyor mu?
4. Database şeması değişikliği var mı?
5. API endpoint'leri etkileniyor mu?
```

### 🛡️ Sistem Bütünlüğü Koruması:
* **Mevcut çalışan sistemin hiçbir parçası bozulmamalıdır**
* **Yeni özellik eklenirken eski özellikler korunmalıdır**
* **Geriye uyumluluk (backward compatibility) her zaman sağlanmalıdır**

---

## 2. Klasör Yapısı ve Dosya Organizasyonu Kuralı

**Amaç:** Proje klasör yapısının korunması ve yanlış `src/` klasörü oluşturulmasının engellenmesi.

### 📁 Ana Klasör Yapısı Koruması:
```
HzmVeriTabani/                    ← ANA KLASÖR (ROOT)
├── HzmVeriTabaniBackend/         ← BACKEND ANA KLASÖRÜ
│   ├── src/                      ← BACKEND SRC KLASÖRÜ (İZİNLİ)
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── config/
│   │   └── utils/
│   ├── server.js
│   └── package.json
├── HzmVeriTabaniFrontend/        ← FRONTEND ANA KLASÖRÜ  
│   ├── src/                      ← FRONTEND SRC KLASÖRÜ (İZİNLİ)
│   │   ├── components/
│   │   ├── pages/
│   │   ├── context/
│   │   └── utils/
│   ├── index.html
│   └── package.json
└── [Dokümantasyon dosyaları]
```

### 🚫 KRİTİK YASAK: Ana Klasörde SRC Oluşturma
```bash
# ❌ KESINLIKLE YASAK - Ana klasörde src oluşturma
HzmVeriTabani/
├── src/                          ← BU YASAKLI!
│   └── [herhangi bir dosya]
```

**Neden Yasak:**
- Zaten 2 adet ana klasör (Backend + Frontend) var
- Her birinin kendi `src/` klasörü mevcut
- Üçüncü bir `src/` klasörü sistem karışıklığına neden olur
- Deployment ve build süreçlerini bozar

### 🔧 Yanlış SRC Klasörü Oluşturulursa - Otomatik Düzeltme Protokolü:

**Cursor, ana klasörde `src/` tespit ederse:**

```bash
# ADIM 1: Tespit ve Kullanıcıya Bildir
echo "🚨 KURAL İHLALİ TESPİT EDİLDİ!"
echo "📍 Konum: /HzmVeriTabani/src/"
echo "❌ Durum: Ana klasörde yasak src klasörü oluşturulmuş"

# ADIM 2: İçeriği Analiz Et ve Taşıma Planı Yap
ls -la HzmVeriTabani/src/
echo "📋 İçerik analizi tamamlandı"

# ADIM 3: Dosyaları Doğru Konuma Taşı
if [[ -f "src/routes/"* ]]; then
  echo "🔄 Backend dosyaları tespit edildi"
  echo "📦 Taşınacak konum: HzmVeriTabaniBackend/src/"
  mv src/* HzmVeriTabaniBackend/src/
elif [[ -f "src/components/"* ]]; then
  echo "🔄 Frontend dosyaları tespit edildi"  
  echo "📦 Taşınacak konum: HzmVeriTabaniFrontend/src/"
  mv src/* HzmVeriTabaniFrontend/src/
fi

# ADIM 4: Boş src Klasörünü Güvenli Sil
echo "🗑️ Boş src klasörü siliniyor..."
echo "📍 Silinecek konum: $(pwd)/src/"
rmdir src/
echo "✅ Temizlik tamamlandı"

# ADIM 5: Sistem Bütünlüğü Kontrolü
echo "🔍 Sistem bütünlüğü kontrol ediliyor..."
ls -la HzmVeriTabaniBackend/src/
ls -la HzmVeriTabaniFrontend/src/
echo "✅ Sistem yapısı geri yüklendi"
```

### 📂 Dosya Taşıma Kuralları:

**Backend Dosyaları İçin:**
```bash
# ✅ DOĞRU KONUM
HzmVeriTabaniBackend/src/routes/     ← API route'ları
HzmVeriTabaniBackend/src/middleware/ ← Auth, error handling
HzmVeriTabaniBackend/src/config/     ← Database config
HzmVeriTabaniBackend/src/utils/      ← Yardımcı fonksiyonlar
```

**Frontend Dosyaları İçin:**
```bash
# ✅ DOĞRU KONUM  
HzmVeriTabaniFrontend/src/components/ ← React bileşenleri
HzmVeriTabaniFrontend/src/pages/      ← Sayfa bileşenleri
HzmVeriTabaniFrontend/src/context/    ← State management
HzmVeriTabaniFrontend/src/utils/      ← Frontend utilities
```

---

## 3. Otomatik Koruma ve Önleme Sistemleri

**Amaç:** Yanlış dosya yerleştirmelerinin proaktif olarak engellenmesi.

### 🛡️ Proaktif Koruma:
* **Cursor, dosya oluşturmadan önce konumu kontrol etmelidir**
* **Ana klasörde `src/` oluşturma girişimi otomatik engellenmelidir**
* **Yanlış konuma dosya yazma girişimi durdurulmalıdır**

### 📊 Gerçek Zamanlı Monitoring:
```javascript
// ✅ CURSOR İÇİN OTOMATİK KONTROL
const checkProjectStructure = () => {
  const rootPath = process.cwd();
  const forbiddenSrc = path.join(rootPath, 'src');
  
  if (fs.existsSync(forbiddenSrc)) {
    console.error('🚨 KURAL İHLALİ: Ana klasörde src/ tespit edildi!');
    console.error('📍 Konum:', forbiddenSrc);
    console.error('🔧 Otomatik düzeltme başlatılıyor...');
    
    // Otomatik düzeltme protokolünü başlat
    autoFixProjectStructure();
  }
};

// Her dosya işlemi öncesi çalıştır
checkProjectStructure();
```

### 🔄 Import/Export Path Düzeltmeleri:
```javascript
// ❌ YANLIŞ - Ana klasör src kullanımı
import { apiUtils } from '../../../src/utils/api';

// ✅ DOĞRU - Doğru klasör yapısı
import { apiUtils } from '../../../HzmVeriTabaniBackend/src/utils/api';
// veya
import { apiUtils } from '../../../HzmVeriTabaniFrontend/src/utils/api';
```

---

## 4. Sistem Entegrasyonu ve Bağımlılık Yönetimi

**Amaç:** Package.json, build süreçleri ve environment variable'ların doğru yönetimi.

### 📦 Package.json Kontrolü:
* **Her ana klasörün kendi `package.json`'ı olmalıdır**
* **Root seviyede genel `package.json` olabilir ama `src/` içermemelidir**
* **Dependency'ler doğru klasörlerde yönetilmelidir**

### 🏗️ Build ve Deployment Uyumluluğu:
```bash
# ✅ DOĞRU BUILD YAPILANDIRMASI
# Backend build
cd HzmVeriTabaniBackend && npm run build

# Frontend build  
cd HzmVeriTabaniFrontend && npm run build

# ❌ YANLIŞ - Root src build
cd HzmVeriTabani && npm run build  # src/ olmadığı için çalışmaz
```

### 🌍 Environment Variables Yönetimi:
```bash
# ✅ DOĞRU ENV DOSYA YERLEŞİMİ
HzmVeriTabaniBackend/.env          ← Backend env
HzmVeriTabaniFrontend/.env         ← Frontend env

# ❌ YANLIŞ
HzmVeriTabani/src/.env             ← Bu klasör var olmamalı
```

---

## 5. Performans ve Optimizasyon Kuralları

**Amaç:** Sistem performansının optimize edilmesi ve gereksiz kaynak kullanımının engellenmesi.

### 🔍 Dosya Arama Optimizasyonu:
* **Cursor, dosya ararken doğru klasörlere odaklanmalıdır**
* **Ana klasörde gereksiz `src/` araması yapmamalıdır**
* **Backend/Frontend ayrımını koruyarak arama yapmalıdır**

### ⚡ Memory ve CPU Kullanımı:
* **Yanlış klasör yapısı CPU'yu gereksiz yorar**
* **Doğru yapı ile arama süreleri optimize edilir**
* **Build süreçleri hızlanır**

---

## 6. Kritik Uyarı ve Acil Durum Protokolleri

**Amaç:** Sistem bozulması durumunda hızlı müdahale ve düzeltme.

### 🚨 Sistem Bozulması Durumunda:
```bash
# ACİL DURUM PROTOKOLÜ
1. 🛑 TÜM İŞLEMLERİ DURDUR
2. 📋 Mevcut klasör yapısını listele
3. 🔍 Yanlış src/ klasörünü tespit et
4. 📦 İçeriği analiz et ve kategorize et
5. 🚚 Dosyaları doğru konumlara taşı
6. 🗑️ Boş src/ klasörünü sil
7. ✅ Sistem bütünlüğünü doğrula
8. 🔄 Normal işlemlere devam et
```

### ⚠️ Geri Alamama Durumu:
* **Bu kural ihlali geri alınamaz şekilde düzeltilmelidir**
* **Yanlış yapı sistem genelinde sorunlara neden olur**
* **Manuel müdahale gerekirse kullanıcı bilgilendirilmelidir**

---

## 7. Başarı Kriterleri ve Doğrulama

**Amaç:** Sistem sağlığının sürekli kontrolü ve doğrulanması.

### ✅ Sistem Sağlık Kontrolü:
```bash
# ✅ SAĞLIKLI SİSTEM KONTROLLERİ
test -d "HzmVeriTabaniBackend/src" && echo "✅ Backend src OK"
test -d "HzmVeriTabaniFrontend/src" && echo "✅ Frontend src OK"  
test ! -d "src" && echo "✅ Root src temiz"
```

### 🎯 Başarı Kriterleri:
- **Ana klasörde `src/` klasörü bulunmaması**
- **Backend dosyalarının doğru konumda olması**
- **Frontend dosyalarının doğru konumda olması**
- **Import/export path'lerinin doğru çalışması**
- **Build süreçlerinin sorunsuz işlemesi**

---

## 8. Sürekli İyileştirme ve Monitoring

**Amaç:** Sistem yapısının sürekli izlenmesi ve iyileştirilmesi.

### 📊 Otomatik İzleme:
* **Her commit öncesi yapı kontrolü**
* **Dosya oluşturma öncesi konum doğrulama**
* **Import path'leri otomatik düzeltme**

### 👨‍🏫 Kullanıcı Eğitimi:
* **Kural ihlali durumunda açıklayıcı mesajlar**
* **Doğru kullanım örnekleri gösterme**
* **Sistem yapısının neden önemli olduğunu açıklama**

---

## 9. Hızlı Referans ve Kısayollar

**Amaç:** Hızlı kontrol ve düzeltme komutları.

### ⚡ Hızlı Kontrol Komutları:
```bash
# Sistem yapısı kontrolü
ls -la | grep -E "(HzmVeriTabaniBackend|HzmVeriTabaniFrontend|src)"

# Yanlış src tespit
[[ -d "src" ]] && echo "⚠️ UYARI: Ana klasörde src var!"

# Dosya sayısı kontrolü
find . -name "src" -type d | wc -l  # Sonuç: 2 olmalı
```

### 🔧 Acil Düzeltme Komutları:
```bash
# Hızlı taşıma (backend)
[[ -d "src/routes" ]] && mv src/* HzmVeriTabaniBackend/src/

# Hızlı taşıma (frontend)  
[[ -d "src/components" ]] && mv src/* HzmVeriTabaniFrontend/src/

# Temizlik
rmdir src/ 2>/dev/null && echo "✅ Temizlendi"
```

---

## 🔐 BAĞLAYICI KURAL SETİ

**Bu kural seti bağlayıcıdır ve hiçbir durumda ihlal edilemez!**

**Cursor, bu kuralları otomatik olarak uygular ve hiçbir istisnaya izin vermez. Sistem bütünlüğü ve proje yapısının korunması için bu kurallar yaşamsaldır.**

---

**📅 Son Güncelleme:** 29 Temmuz 2025  
**📝 Kategori:** HZM Veritabanı Temel Kuralları  
**🔄 Versiyon:** 1.0.0 - Kategorilere Ayrılmış Versiyon 
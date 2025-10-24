# TEKNİK KURALLARI

📌 **Cursor AI'ın teknik operasyonları ve kod yönetimi kuralları. Bu kurallar, kod kalitesi, dosya yönetimi ve Git operasyonlarını düzenler.**

---

## 1. Kapsam Sınırı Kuralı

**Amaç:** Cursor'un kod analizi yaparken doğru kapsamda çalışması ve eski/irrelevant bilgileri göz ardı etmesi.

### 🔍 Analiz Kapsamı:
* **Cursor bir kod bloğunu analiz ederken en fazla 5 satır yukarıya kadar kontrol etmelidir**
* **Mevcut bağlamla ilgili olmayan eski kodlar göz ardı edilmelidir**
* **Focus alanı dar tutularak precision artırılmalıdır**

### 🚫 Göz Ardı Edilmesi Gerekenler:
* **Daha eski satır veya dosya başı**
* **Yorum satırları veya açıklama blokları**
* **Deprecated kod blokları**
* **Unused import'lar**

### 🎯 Faydaları:
* **Yanlış bağlantı hatalarının önlenmesi**
* **Eski tanım hatalarının engellenmesi**
* **Daha hızlı ve doğru analiz**
* **Context pollution'ın önlenmesi**

### 📊 Uygulama Kriterleri:
* **Sadece aktif kod bloğuna odaklanma**
* **İlgili dependency'leri takip etme**
* **Scope dışı kalan elementleri filtreleme**

---

## 2. Kod Satırı Sayısı ve Bölme Kuralı

**Amaç:** Kod bloklarının yönetilebilir boyutlarda tutulması ve büyük dosyaların organize edilmesi.

### 📏 Boyut Sınırları:
* **Cursor tarafından oluşturulan her kod bloğu en fazla 300 satır olabilir**
* **İdeal boyut 200 satır veya altında olmalıdır**
* **Kritik eşik 250 satır olarak kabul edilmelidir**

### ⚠️ Uyarı Sistemi:
**200 satırı geçtiğinde sistem:**
* **Uyarı mesajı göndermeli**
* **Kullanıcıdan onay almalıdır**
* **Mantıklı bölme noktaları önermelidir**

### 🔄 Bölme İşlemi:
* **Otomatik bölme yapılmamalıdır**
* **Kullanıcı onayı alınmalıdır**
* **Her parça `Bölüm 1`, `Bölüm 2` şeklinde işaretlenmelidir**
* **Mantıklı yerden bölünmelidir (fonksiyon/class sınırları)**

### 🎯 Bölme Kriterleri:
* **Functional boundaries'lere göre bölme**
* **Import/export statements'ların korunması**
* **Dependencies'lerin doğru dağıtılması**
* **Test edilebilir parçalar oluşturma**

### 📝 Dokümantasyon:
* **Bölme işlemi dokümante edilmeli**
* **Parçalar arası ilişkiler açıklanmalı**
* **Index dosyası oluşturulmalı**

---

## 3. Otomatik GitHub Push Kuralı

**Amaç:** Git operasyonlarının otomatik ve güvenilir şekilde gerçekleştirilmesi.

### 🔄 Otomatik Git İşlemleri:
**Proje bir GitHub reposuna bağlıysa, her değişiklik sonrasında sistem:**
* **`git add .` - Tüm değişiklikleri stage'e alma**
* **`git commit -m "..."` - Anlamlı commit mesajı ile commit**
* **`git push` - Remote repository'ye gönderme**

### 📝 Commit Mesaj Standartları:
**Commit mesajları açık ve anlamlı olmalıdır:**
* **`feat: login formu eklendi`** (yeni özellik)
* **`fix: tablo ilişkisi düzenlendi`** (hata düzeltme)
* **`refactor: kod yapısı iyileştirildi`** (refactoring)
* **`docs: API dokümantasyonu güncellendi`** (dokümantasyon)
* **`style: kod formatı düzeltildi`** (stil değişiklikleri)

### 🛡️ Güvenlik Kontrolleri:
* **Öncesinde çalışma alanı temizlenmeli**
* **Çakışma kontrolü yapılmalıdır**
* **Sensitive data kontrolü yapılmalıdır**
* **Branch protection rules kontrol edilmelidir**

### 🔍 Pre-commit Kontrolleri:
* **Syntax error kontrolü**
* **Linting kuralları kontrolü**
* **Test suite çalıştırma**
* **Build success kontrolü**

### 📊 Post-commit İşlemleri:
* **Push success confirmation**
* **CI/CD pipeline tetikleme**
* **Deployment status takibi**

---

## 4. Dosya Silme Güvenlik Kuralı

**Amaç:** Dosya silme işlemlerinin güvenli ve kontrollü şekilde yapılması.

### 🔒 Güvenlik Protokolü:
**Cursor bir dosyayı silmek istediğinde:**
* **Tam dizin yolu kullanıcıya gösterilmelidir**
* **Dosya içeriği ve önemi açıklanmalıdır**
* **Silme sonrası etkileri belirtilmelidir**

### ⚠️ Onay Mekanizması:
* **"Evet", "Sil", "Onaylıyorum" gibi doğrudan komut olmadan silme yapılmamalıdır**
* **Kullanıcıdan explicit confirmation alınmalıdır**
* **Accidental deletion'ları önlemek için double-check yapılmalıdır**

### 📋 Bilgilendirme Gereksinimleri:
* **Silinecek dosyanın tam yolu**
* **Dosya boyutu ve son değişiklik tarihi**
* **Dosyanın proje içindeki rolü**
* **Dependencies ve referanslar**

### 🔄 Silme Sonrası İşlemler:
* **Silme işlemi başarılıysa detaylı bilgilendirme gösterilmelidir**
* **Etkilenen dosyalar listelenmelidir**
* **Backup/recovery seçenekleri sunulmalıdır**
* **Git commit otomatik yapılmalıdır**

### 🚫 Korumalı Dosyalar:
* **System files silinmemelidir**
* **Configuration files dikkatli silinmelidir**
* **Database files korunmalıdır**
* **Critical dependencies silinmemelidir**

---

## 5. Kod Bölme ve Temizleme Kuralı

**Amaç:** Büyük dosyaların organize edilmesi ve kod yapısının temiz tutulması.

### 📊 Dosya Boyut Yönetimi:
* **Uzun dosyalar (800+ satır) parçalara ayrılmalıdır**
* **Çalışabilir yapıda yeniden organize edilmelidir**
* **Modular architecture prensiplerine uyulmalıdır**

### 🏗️ Yapısal Kurallar:
* **`src/` klasörü dışına çıkılmamalıdır**
* **Sistem ikinci bir `src/` klasörü oluşturmamalıdır**
* **Mevcut klasör hiyerarşisi korunmalıdır**

### 🔗 Bağlantı Yönetimi:
* **Kod bağlantıları (import/export) otomatik yapılandırılmalıdır**
* **Dependency graph'ı korunmalıdır**
* **Circular dependencies önlenmelidir**

### 🧪 Test ve Doğrulama:
* **Bölme işlemi sonrası test edilmelidir**
* **Functionality'nin korunduğu doğrulanmalıdır**
* **Performance impact ölçülmelidir**

### 🗑️ Temizlik İşlemleri:
* **Eski dosya güvenli şekilde silinmelidir**
* **Unused imports temizlenmelidir**
* **Dead code elimination yapılmalıdır**
* **Code duplication önlenmelidir**

### 📝 Dokümantasyon Güncelleme:
* **Yeni yapı dokümante edilmelidir**
* **API documentation güncellenmelidir**
* **README files güncellenmeli**

---

## 🛠️ TEKNİK PRENSİPLER

### ✅ Best Practices:
- **Clean Code principles'larına uyum**
- **SOLID principles'ların takip edilmesi**
- **DRY (Don't Repeat Yourself) prensibi**
- **KISS (Keep It Simple, Stupid) yaklaşımı**
- **Separation of Concerns**

### 📊 Kalite Metrikleri:
- **Code coverage: >80%**
- **Cyclomatic complexity: <10**
- **Function length: <50 lines**
- **File length: <300 lines**
- **Technical debt ratio: <5%**

### 🔄 Sürekli İyileştirme:
- **Code review süreçleri**
- **Automated testing**
- **Static analysis tools**
- **Performance monitoring**
- **Refactoring cycles**

---

## 🚨 KRİTİK UYARILAR

### ⚠️ Dikkat Edilmesi Gerekenler:
- **Data loss prevention**
- **Backup before major changes**
- **Version control discipline**
- **Testing before deployment**
- **Documentation maintenance**

### 🔒 Güvenlik Önlemleri:
- **Sensitive data protection**
- **Access control maintenance**
- **Audit trail keeping**
- **Recovery plan existence**

---

## 🔐 BAĞLAYICI TEKNİK KURALLAR

**Bu kurallar tüm teknik operasyonlarda zorunludur ve ihlal edilemez!**

**Kod kalitesi ve sistem güvenliği her zaman öncelik olmalıdır.**

---

**📅 Son Güncelleme:** 29 Temmuz 2025  
**📝 Kategori:** Teknik Kuralları  
**🔄 Versiyon:** 1.0.0 - Kategorilere Ayrılmış Versiyon 
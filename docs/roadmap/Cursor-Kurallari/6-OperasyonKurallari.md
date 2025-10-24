# OPERASYON KURALLARI

📌 **Cursor AI'ın operasyonel süreçleri ve problem çözme kuralları. Bu kurallar, hata yönetimi, kullanıcı etkileşimi ve production ortamı operasyonlarını düzenler.**

---

## 1. Hata Bulma ve Düzeltme Kuralı (Debug / Fix)

**Amaç:** Cursor, tespit ettiği hataları minimum kullanıcı müdahalesiyle, yapıyı bozmadan ve otomatik olarak düzeltmelidir.

### 🔍 Kök Neden Analizi:
* **Cursor bir hata algıladığında sadece dosya içine bakmakla kalmamalıdır**
* **İlgili bileşen, API, context, prop zincirini de incelemelidir**
* **Hata sadece semptom olarak değil, kök nedenine (root cause) kadar analiz edilmelidir**
* **Düzenleme yapıldıysa, hangi satırda, ne değişikliğin yapıldığı kullanıcıya özet olarak bildirilmelidir**

### 📊 Hata Tespit ve Raporlama:
**Hata tespit edildiğinde:**
* **Hata satırı ve etkilenen dosya net şekilde kullanıcıya gösterilmelidir**
  - Örnek: `src/pages/Home.tsx dosyasında, 42. satırda hata.`
* **Terminal hataları sadeleştirilerek anlamlı mesajlara dönüştürülmelidir**
  - `TypeError: Cannot read property 'name' of undefined`
  - ✅ **Açıklama:** "Veri henüz yüklenmeden kullanılmış olabilir."

### 🔧 Otomatik Çözüm:
* **Cursor, hatayı tespit ettiğinde kullanıcıya otomatik çözüm önerisi sunmalı veya doğrudan uygulayabilmelidir**
  - "Bu alana `?.` operatörü eklenerek hata önlenebilir."
* **Düzeltme sadece hatalı kısımda yapılmalı, kodun geri kalanı değiştirilmemelidir**
  - ❌ Dosya yeniden yazılmamalı
  - ✅ Hatalı blok hedeflenmelidir
* **Düzeltme sonrası sistem otomatik olarak yeniden başlatılabilir hâle gelmelidir**
  - Kullanıcıdan `npm start`, `pnpm dev` gibi manuel müdahale istenmemelidir

### 🏗️ Sistem Bütünlüğü:
* **Dosya modüler ise, tüm bağlı parçalar kontrol edilmeli ve zincir hatalar engellenmelidir**
* **Hatalar geçici olarak gizlenmemeli, yapısal olarak çözülmelidir**
  - ❌ `try/catch` ile bastırma
  - ✅ Veri kontrolü ve koşullu akış uygulanmalıdır

### 📂 Hata Kategorileri:
**API Hataları:**
* **Bağlantı mı yoksa veri mi bozuk net belirtilmelidir**
* **HTTP status kodları analiz edilmelidir**
* **Network timeout'ları ayrı ele alınmalıdır**

**Backend vs Frontend Hataları:**
* **Backend:** veri tutarsızlığı, bağlantı hatası, database issues
* **Frontend:** undefined, null, import, DOM manipulation errors

### 🛡️ Koruma ve Güvenlik:
* **Daha önce yapılan değişiklikler dikkate alınmalı, çakışmalar engellenmelidir**
* **Elle yazılmış özel bloklara Cursor dokunmamalıdır**
  - `// #manuel` gibi işaretlerle korunmuş alanlar varsa atlanmalıdır

### 🧪 Test ve Doğrulama:
* **Test dosyası varsa (`test.ts`, `*.spec.ts`), hata düzeltmeden sonra otomatik test yapılmalı**
* **Sonuç kullanıcıya gösterilmelidir**
* **Düzeltme sonrası kullanıcıya değişiklik özeti sunulmalıdır**
  - "3 dosyada şu değişiklikler yapıldı."

### 🔄 Geri Alma ve Güvenlik:
* **Geri alma (undo) özelliği her hata düzeltmesinden sonra aktif olmalıdır**
* **Kullanıcı tek tıklamayla eski hâline dönebilmelidir**
* **Hata düzeltme işlemleri hızlı değil, doğru ve zincir hatasız olmalıdır**
* **Kod çalışıyor gibi görünse bile arkada bozukluk yaratmamalıdır**

---

## 2. Müdahale ve Onay Kuralı

**Amaç:** Cursor'un ne zaman otomatik hareket edeceği, ne zaman kullanıcı onayı bekleyeceğinin belirlenmesi.

### ✅ Otomatik Müdahale Durumları:
* **Cursor belirgin hatalarda doğrudan düzenleme yapabilir**
* **Syntax error'lar otomatik düzeltilebilir**
* **Import eksiklikleri otomatik tamamlanabilir**
* **Linting hatalar otomatik düzeltilebilir**

### ⚠️ Onay Gerektiren Durumlar:
**Kullanıcı bir öneri sorusu sorduğunda:**
* **"Bölünmeli mi?"**
* **"Silinsin mi?"**
* **"Refactor edilsin mi?"**
* **"Yeni feature eklensin mi?"**

**Bu durumlarda:**
* **Sistem hiçbir işlem yapmamalıdır**
* **Net onay (evet, uygundur, yap) almadan adım atılmamalıdır**
* **Belirsiz yanıtlar kabul edilmemelidir**

### 🎯 Karar Verme Kriterleri:
**Otomatik Yapılabilir:**
- Açık hata düzeltmeleri
- Kod formatı iyileştirmeleri
- Performans optimizasyonları (minor)
- Security patch'leri

**Onay Gerektirir:**
- Yapısal değişiklikler
- API değişiklikleri
- Database schema değişiklikleri
- Major refactoring

### 📝 Onay Alma Protokolü:
* **Açık ve net soru sorulmalı**
* **Değişikliğin etkisi açıklanmalı**
* **Risk analizi paylaşılmalı**
* **Geri dönüş seçenekleri belirtilmeli**

### 🔄 Onay Sonrası İşlemler:
* **Onay alındıktan sonra hızla uygulanmalı**
* **Progress feedback verilmeli**
* **Tamamlandığında sonuç raporlanmalı**

---

## 3. Yayın Ortamı (Production) Zorunluluğu ve Local Bağlantı Yasağı

**Amaç:** Production ortamına geçiş sonrası tüm işlemlerin canlı ortam üzerinden yapılması.

### 🚫 Yasaklanan Tüm Davranışlar:

#### 🗣️ Yerel Test İfadeleri:
**Cursor aşağıdaki gibi ifadeler kullanmamalı:**
* **"Localde çalışıyor olabilir"**
* **"Yerelde test ettim, sorun görünmüyor"**
* **"Localden veri geldi ama canlıda bozulmuş"**
* **"Yerel log alarak kontrol eder misin?"**

#### 🔗 Yerel Bağlantı Önerileri:
**Kesinlikle kullanılmamalı:**
* **`localhost:3000`, `127.0.0.1` bağlantıları**
* **`vite`, `npm run dev` komutları**
* **Local development server önerileri**
* **File:// protocol kullanımı**

#### 🧪 Local Kaynaklı Düzeltme Girişimleri:
* **Her türlü hata kontrolü yayın ortamında yapılmalı**
* **Bileşen analizi production'da gerçekleştirilmeli**
* **API testi canlı endpoint'ler üzerinden yapılmalı**
* **Veri akışı analizi production data ile yapılmalı**

### 🧹 Temizlik Zorunluluğu:

**Sistemde tespit edilirse otomatik temizlenecekler:**
* **`localhost`, `127.0.0.1`, `vite`, `file://` gibi yerel bağlantılar**
* **`console.log("localde test ettim")` gibi açıklamalar**
* **Geçici mock dosyalar, sahte veriler**
* **Development-only kod blokları**

#### 🔧 Temizlik İşlemi:
* **Yerel bağlantılar canlı bağlantı adresiyle değiştirilmelidir**
* **Geçici mock veri dosyaları sistemden kaldırılmalıdır**
* **Development artifacts temizlenmelidir**

**Kullanıcı Bilgilendirmesi:**
```
❗ Sayfa içinde local bağlantılar tespit edildi. 
Bunlar sistemden kaldırıldı ve canlı bağlantılarla değiştirildi.
```

### ✅ Uygulanacak Sistem Davranışı:

#### 🎯 Production-Only Yaklaşım:
* **Tüm testler yayın ortamı üzerinde gerçekleştirilmelidir**
* **Hata düzeltmeleri production environment'ta yapılmalı**
* **Veri kontrolleri canlı sistemde gerçekleştirilmeli**

#### 🌐 Sadece Production URL'leri:
* **Frontend:** `https://vardiyaasistani.netlify.app`
* **Backend:** `https://rare-courage-production.up.railway.app`
* **Database:** Production database connections only**

#### 📊 Monitoring ve Analytics:
* **Production logs takip edilmeli**
* **Real user data analiz edilmeli**
* **Performance metrics production'dan alınmalı**

### 🚨 Kritik Uyarı:
**Bu kural aktif olduktan sonra:**
* **Cursor'un herhangi bir yerel geliştirme ortamı önerisi kesinlikle yasaktır**
* **Sistem tamamen production odaklı çalışmalıdır**
* **Local development references kabul edilmez**

---

## 🎯 OPERASYONEL PRENSİPLER

### ✅ Best Practices:
- **Root cause analysis önceliği**
- **Minimal invasive fixes**
- **User consent for major changes**
- **Production-first mentality**
- **Comprehensive testing**

### 📊 Kalite Metrikleri:
- **Mean Time To Resolution (MTTR): <30 dakika**
- **Fix success rate: >95%**
- **User satisfaction with fixes: >90%**
- **Production uptime: >99.9%**

### 🔄 Sürekli İyileştirme:
- **Error pattern analysis**
- **Fix effectiveness tracking**
- **User feedback integration**
- **Process optimization**

---

## 🚨 KRİTİK OPERASYON KURALLARI

### ⚠️ Acil Durum Protokolü:
1. **Hata tespiti ve kategorilendirme**
2. **Impact assessment**
3. **Immediate containment**
4. **Root cause analysis**
5. **Fix implementation**
6. **Verification and monitoring**

### 🔒 Güvenlik Önlemleri:
- **Backup before major fixes**
- **Rollback capability maintenance**
- **Change audit trail**
- **Access control compliance**

---

## 🔐 BAĞLAYICI OPERASYON KURALLARI

**Bu kurallar tüm operasyonel süreçlerde zorunludur ve ihlal edilemez!**

**Sistem güvenilirliği ve kullanıcı deneyimi her zaman öncelik olmalıdır.**

---

**📅 Son Güncelleme:** 29 Temmuz 2025  
**📝 Kategori:** Operasyon Kuralları  
**🔄 Versiyon:** 1.0.0 - Kategorilere Ayrılmış Versiyon 
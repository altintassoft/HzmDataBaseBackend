# UI/UX KURALLARI

📌 **Kullanıcı arayüzü ve kullanıcı deneyimi kuralları. Bu kurallar, tüm frontend bileşenlerinin nasıl tasarlanacağını ve davranacağını belirler.**

---

## 1. Arayüz Kuralları

**Amaç:** Tüm UI bileşenlerinin mobil uyumlu, erişilebilir ve sezgisel olması.

### 📱 Mobil Uyumluluk Zorunluluğu:
* **Tüm sayfalar mobil uyumlu (responsive) olmalıdır**
* **Tablet, telefon ve desktop'ta sorunsuz çalışmalıdır**
* **Breakpoint'ler doğru şekilde tanımlanmalıdır**

### 🎯 Etkileşim Öğeleri:
* **Hover, scroll, collapse gibi tüm görsel öğeler her cihazda çalışmalıdır**
* **Touch event'ler mobil cihazlarda desteklenmelidir**
* **Gesture'lar (swipe, pinch, zoom) uygun yerlerde kullanılmalıdır**

### 🎨 Tasarım Prensipleri:
* **UI öğeleri sade, sezgisel ve dokunmatik uyumlu tasarlanmalıdır**
* **Minimum dokunma alanı 44px x 44px olmalıdır**
* **Kontrast oranları WCAG standartlarına uygun olmalıdır**

### 🔧 Teknik Gereksinimler:
* **CSS Grid ve Flexbox kullanılmalıdır**
* **Media queries doğru şekilde uygulanmalıdır**
* **Viewport meta tag'i eklenmelidir**

### 📊 Test Kriterleri:
* **Farklı ekran boyutlarında test edilmelidir**
* **Touch cihazlarda etkileşim testi yapılmalıdır**
* **Performans optimizasyonu sağlanmalıdır**

---

## 2. Uygulama Genel Hedefi

**Amaç:** Uygulamanın tüm platformlarda mükemmel çalışması ve kullanıcı deneyiminin optimize edilmesi.

### 🌐 Çapraz Platform Uyumluluğu:
* **Uygulamanın tüm ekranları mobil tarayıcılarda sorunsuz çalışmalıdır**
* **iOS Safari, Android Chrome, Desktop browserlar desteklenmelidir**
* **PWA (Progressive Web App) özellikleri eklenmelidir**

### 🚫 Hata Önleme:
* **Kullanıcı herhangi bir hata veya görüntü bozulması ile karşılaşmamalıdır**
* **Loading states her yerde tanımlanmalıdır**
* **Error boundary'ler kullanılmalıdır**

### 📐 Responsive Grid Sistemi:
* **Sayfalar dar ekran için yeniden boyutlanmalı**
* **Responsive grid yapısı kullanılmalıdır**
* **Content hierarchy mobilde korunmalıdır**

### ⚡ Performans Optimizasyonu:
* **Lazy loading uygulanmalıdır**
* **Image optimization yapılmalıdır**
* **Bundle size minimize edilmelidir**

### 🎯 Kullanıcı Deneyimi:
* **Navigation mobilde kolay erişilebilir olmalıdır**
* **Form doldurma mobilde optimize edilmelidir**
* **Feedback mekanizmaları eklenmelidir**

---

## 3. Otomatik Büyük Harf Kuralı

**Amaç:** Form alanlarında tutarlı veri girişi sağlanması ve büyük harf standardizasyonu.

### 🔤 Büyük Harf Dönüşümü:
* **Tüm `input` ve `textarea` alanlarında yazılan metinler otomatik olarak büyük harfe çevrilmelidir**
* **Dönüşüm gerçek zamanlı olarak yapılmalıdır**
* **Kullanıcı deneyimi bozulmamalıdır**

### 🚫 İstisnalar:
**Aşağıdaki alanlar büyük harfe çevrilmemelidir:**
* **E-posta adresleri** (örn: user@example.com)
* **T.C. Kimlik No** (11 haneli sayı)
* **Telefon numarası** (sayısal veri)
* **URL adresleri** (http://, https://)
* **Şifreler** (güvenlik nedeniyle)

### 🛠️ Teknik Uygulama:
* **`useCapitalization` hook'u kullanılmalıdır**
* **`CustomInput` bileşeni tercih edilmelidir**
* **CSS `text-transform` ile desteklenmelidir**

### 📝 Veri İşleme:
* **Kullanıcı küçük harf yazsa bile, form görselinde büyük harf görünmelidir**
* **Veri tabanına kayıt büyük harf olarak yapılmalıdır (istisnalar hariç)**
* **API gönderiminde format korunmalıdır**

### 🔍 Validation Kuralları:
* **İstisna alanlar için özel validation yazılmalıdır**
* **Email formatı kontrol edilmelidir**
* **TC Kimlik No algoritması uygulanmalıdır**

### 💡 Kullanıcı Bilgilendirmesi:
* **Otomatik dönüşüm hakkında tooltip gösterilebilir**
* **İstisna alanlar için açıklama metni eklenmelidir**
* **Kullanıcı rehberi hazırlanmalıdır**

---

## 🎯 UI/UX PRENSİPLERİ

### ✅ Yapılması Gerekenler:
- **Mobile-first yaklaşımı benimsenmelidir**
- **Accessibility standartlarına uyulmalıdır**
- **Consistent design system kullanılmalıdır**
- **User feedback alınmalı ve uygulanmalıdır**
- **A/B testleri yapılmalıdır**

### ❌ Yapılmaması Gerekenler:
- **Desktop-only tasarım yapılmamalıdır**
- **Küçük dokunma alanları bırakılmamalıdır**
- **Karmaşık navigation yapıları kurulmamalıdır**
- **Uzun loading süreleri kabul edilmemelidir**
- **Inconsistent UI patterns kullanılmamalıdır**

### 🔄 Sürekli İyileştirme:
- **User analytics takip edilmelidir**
- **Heatmap analizleri yapılmalıdır**
- **Conversion rates optimize edilmelidir**
- **User journey mapping güncellenmelidir**

---

## 📊 BAŞARI METRİKLERİ

### 🎯 Kullanıcı Deneyimi:
- **Task completion rate: >95%**
- **User satisfaction score: >4.5/5**
- **Mobile usability score: >90%**
- **Accessibility score: >95%**

### ⚡ Performans:
- **Page load time: <3 saniye**
- **First contentful paint: <2 saniye**
- **Lighthouse score: >90**
- **Mobile page speed: >85**

### 🔧 Teknik Kalite:
- **Cross-browser compatibility: 100%**
- **Responsive design coverage: 100%**
- **Error rate: <1%**
- **Uptime: >99.9%**

---

## 🔐 BAĞLAYICI UI/UX KURALLARI

**Bu kurallar tüm frontend geliştirmelerinde zorunludur ve ihlal edilemez!**

**Kullanıcı deneyimi her zaman öncelik olmalı ve sürekli optimize edilmelidir.**

---

**📅 Son Güncelleme:** 29 Temmuz 2025  
**📝 Kategori:** UI/UX Kuralları  
**🔄 Versiyon:** 1.0.0 - Kategorilere Ayrılmış Versiyon 
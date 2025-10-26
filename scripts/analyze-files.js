#!/usr/bin/env node

/**
 * HZM Veri Tabanı - Dosya Analiz Scripti
 * 
 * Tüm .tsx, .ts, .js, .sql dosyalarını tarar
 * Satır sayılarını analiz eder ve rapor oluşturur
 * 
 * Eşik Değerleri:
 * - 0-300: ✅ OLUMLU
 * - 301-450: ⚠️ DİKKAT
 * - 451-700: 🔴 BÖLÜNMELI
 * - 701-900: 🔴🔴 ACİL
 * - 900+: 🔴🔴🔴 KÖTÜ DURUM
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const ROOT_DIR = path.join(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT_DIR, 'HzmVeriTabaniFrontend');
const BACKEND_DIR = path.join(ROOT_DIR, 'HzmVeriTabaniBackend');
const OUTPUT_FILE = path.join(BACKEND_DIR, 'docs/roadmap/DOSYA_ANALIZI.md');

const EXTENSIONS = ['.tsx', '.ts', '.js', '.jsx', '.sql'];
const IGNORE_DIRS = ['node_modules', 'dist', 'build', '.git', 'coverage', '.next'];

// ============================================================================
// FILE STATUS HELPER
// ============================================================================

function getStatus(lines) {
  if (lines >= 900) return { emoji: '🔴🔴🔴', text: 'KÖTÜ DURUM', priority: 5, category: 'critical' };
  if (lines >= 701) return { emoji: '🔴🔴', text: 'ACİL', priority: 4, category: 'urgent' };
  if (lines >= 451) return { emoji: '🔴', text: 'BÖLÜNMELI', priority: 3, category: 'refactor' };
  if (lines >= 301) return { emoji: '⚠️', text: 'DİKKAT', priority: 2, category: 'warning' };
  return { emoji: '✅', text: 'OLUMLU', priority: 1, category: 'good' };
}

// ============================================================================
// DIRECTORY SCANNER
// ============================================================================

function analyzeDirectory(dir, basePath = '') {
  const files = [];
  
  function scan(currentPath, relativePath = '') {
    try {
      const items = fs.readdirSync(currentPath);
      
      for (const item of items) {
        // Ignore hidden files and specific directories
        if (item.startsWith('.') && item !== '.env.example') continue;
        if (IGNORE_DIRS.includes(item)) continue;
        
        const fullPath = path.join(currentPath, item);
        const relPath = path.join(relativePath, item);
        
        try {
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            scan(fullPath, relPath);
          } else if (stat.isFile()) {
            const ext = path.extname(item);
            if (EXTENSIONS.includes(ext)) {
              const content = fs.readFileSync(fullPath, 'utf8');
              const lines = content.split('\n').length;
              const status = getStatus(lines);
              
              files.push({
                name: item,
                path: relPath,
                fullPath: fullPath,
                lines: lines,
                size: stat.size,
                ext: ext,
                modified: stat.mtime,
                status: status
              });
            }
          }
        } catch (err) {
          // Skip files that can't be read
          console.warn(`⚠️  Skipping ${relPath}: ${err.message}`);
        }
      }
    } catch (err) {
      console.warn(`⚠️  Cannot read directory ${currentPath}: ${err.message}`);
    }
  }
  
  scan(dir, basePath);
  return files;
}

// ============================================================================
// FILE CATEGORIZATION
// ============================================================================

function categorizeFiles(files) {
  return {
    critical: files.filter(f => f.status.category === 'critical').sort((a, b) => b.lines - a.lines),
    urgent: files.filter(f => f.status.category === 'urgent').sort((a, b) => b.lines - a.lines),
    refactor: files.filter(f => f.status.category === 'refactor').sort((a, b) => b.lines - a.lines),
    warning: files.filter(f => f.status.category === 'warning').sort((a, b) => b.lines - a.lines),
    good: files.filter(f => f.status.category === 'good')
  };
}

// ============================================================================
// STATISTICS CALCULATOR
// ============================================================================

function calculateStats(files) {
  if (files.length === 0) return { total: 0, avg: 0, max: 0, min: 0 };
  
  const total = files.reduce((sum, f) => sum + f.lines, 0);
  const avg = Math.round(total / files.length);
  const max = Math.max(...files.map(f => f.lines));
  const min = Math.min(...files.map(f => f.lines));
  
  return { total, avg, max, min };
}

// ============================================================================
// MARKDOWN REPORT GENERATOR
// ============================================================================

function generateMarkdown(frontendFiles, backendFiles) {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  // Get latest commit
  let commit = 'N/A';
  try {
    const { execSync } = require('child_process');
    commit = execSync('git rev-parse --short HEAD', { cwd: ROOT_DIR }).toString().trim();
  } catch (err) {
    // Ignore
  }
  
  const frontendCategorized = categorizeFiles(frontendFiles);
  const backendCategorized = categorizeFiles(backendFiles);
  
  const frontendStats = calculateStats(frontendFiles);
  const backendStats = calculateStats(backendFiles);
  
  let md = `# 📊 HZM Veri Tabanı - Dosya Analiz Raporu

Son Güncelleme: ${now} (Otomatik)
Commit: ${commit}

> **Eşik Değerleri:**
> - ✅ **OLUMLU** (0-300 satır): İdeal boyut
> - ⚠️ **DİKKAT** (301-450 satır): Gözden geçir
> - 🔴 **BÖLÜNMELI** (451-700 satır): Refactor gerekli
> - 🔴🔴 **ACİL** (701-900 satır): Hemen bölünmeli
> - 🔴🔴🔴 **KÖTÜ DURUM** (900+ satır): Kritik - Acil müdahale

---

`;

  // ============================================================================
  // FRONTEND SECTION
  // ============================================================================
  
  md += `## 🎨 FRONTEND DOSYA ANALİZİ

### 📈 Genel İstatistikler

| Metrik | Değer |
|--------|-------|
| Toplam Dosya | ${frontendFiles.length} |
| Toplam Satır | ${frontendStats.total.toLocaleString()} |
| Ortalama Dosya Boyutu | ${frontendStats.avg} satır |
| En Büyük Dosya | ${frontendStats.max} satır ${getStatus(frontendStats.max).emoji} |
| En Küçük Dosya | ${frontendStats.min} satır |

### 📊 Dosya Boyutu Dağılımı

| Kategori | Dosya Sayısı | Yüzde | Durum |
|----------|--------------|-------|-------|
| ✅ Olumlu (0-300) | ${frontendCategorized.good.length} | ${Math.round(frontendCategorized.good.length / frontendFiles.length * 100)}% | ${frontendCategorized.good.length > frontendFiles.length * 0.9 ? 'Harika!' : 'İyi'} |
| ⚠️ Dikkat (301-450) | ${frontendCategorized.warning.length} | ${Math.round(frontendCategorized.warning.length / frontendFiles.length * 100)}% | ${frontendCategorized.warning.length > 10 ? 'Çok fazla!' : 'Gözden geçir'} |
| 🔴 Bölünmeli (451-700) | ${frontendCategorized.refactor.length} | ${Math.round(frontendCategorized.refactor.length / frontendFiles.length * 100)}% | ${frontendCategorized.refactor.length > 0 ? 'Refactor gerekli' : 'Yok'} |
| 🔴🔴 Acil (701-900) | ${frontendCategorized.urgent.length} | ${Math.round(frontendCategorized.urgent.length / frontendFiles.length * 100)}% | ${frontendCategorized.urgent.length > 0 ? 'Acil!' : 'Yok'} |
| 🔴🔴🔴 Kötü (900+) | ${frontendCategorized.critical.length} | ${Math.round(frontendCategorized.critical.length / frontendFiles.length * 100)}% | ${frontendCategorized.critical.length > 0 ? '**KRİTİK!**' : 'Yok'} |

---

`;

  // Critical files (900+)
  if (frontendCategorized.critical.length > 0) {
    md += `### 🔴🔴🔴 KÖTÜ DURUM (900+ satır) - **KRİTİK!**

| # | Dosya | Satır | Yol | Durum |
|---|-------|-------|-----|-------|
`;
    frontendCategorized.critical.forEach((f, i) => {
      md += `| ${i + 1} | \`${f.name}\` | ${f.lines} | \`${f.path}\` | 🚨 **ACİL MÜDAHALE GEREKLİ** |\n`;
    });
    md += '\n';
  } else {
    md += `### 🔴🔴🔴 KÖTÜ DURUM (900+ satır)\n\n*Yok - Harika!* ✅\n\n`;
  }

  // Urgent files (701-900)
  if (frontendCategorized.urgent.length > 0) {
    md += `### 🔴🔴 ACİL (701-900 satır)\n\n| # | Dosya | Satır | Yol | Durum |\n|---|-------|-------|-----|-------|\n`;
    frontendCategorized.urgent.forEach((f, i) => {
      md += `| ${i + 1} | \`${f.name}\` | ${f.lines} | \`${f.path}\` | Hemen bölünmeli |\n`;
    });
    md += '\n';
  } else {
    md += `### 🔴🔴 ACİL (701-900 satır)\n\n*Yok - İyi durum!* ✅\n\n`;
  }

  // Refactor files (451-700)
  if (frontendCategorized.refactor.length > 0) {
    md += `### 🔴 BÖLÜNMELI (451-700 satır)\n\n| # | Dosya | Satır | Yol | Öneri |\n|---|-------|-------|-----|-------|\n`;
    frontendCategorized.refactor.forEach((f, i) => {
      md += `| ${i + 1} | \`${f.name}\` | ${f.lines} | \`${f.path}\` | Component'lere/modüllere bölünmeli |\n`;
    });
    md += `\n**Toplam: ${frontendCategorized.refactor.length} dosya refactor edilmeli**\n\n`;
  } else {
    md += `### 🔴 BÖLÜNMELI (451-700 satır)\n\n*Yok - Mükemmel!* ✅\n\n`;
  }

  // Warning files (301-450)
  if (frontendCategorized.warning.length > 0) {
    md += `### ⚠️ DİKKAT (301-450 satır)\n\n`;
    if (frontendCategorized.warning.length > 10) {
      md += `**${frontendCategorized.warning.length} dosya var - İlk 10 gösteriliyor:**\n\n`;
      md += `| # | Dosya | Satır | Yol | Durum |\n|---|-------|-------|-----|-------|\n`;
      frontendCategorized.warning.slice(0, 10).forEach((f, i) => {
        md += `| ${i + 1} | \`${f.name}\` | ${f.lines} | \`${f.path}\` | İzlenmeli |\n`;
      });
    } else {
      md += `| # | Dosya | Satır | Yol | Durum |\n|---|-------|-------|-----|-------|\n`;
      frontendCategorized.warning.forEach((f, i) => {
        md += `| ${i + 1} | \`${f.name}\` | ${f.lines} | \`${f.path}\` | İzlenmeli |\n`;
      });
    }
    md += `\n**Toplam: ${frontendCategorized.warning.length} dosya gözden geçirilmeli**\n\n`;
  } else {
    md += `### ⚠️ DİKKAT (301-450 satır)\n\n*Yok - Harika!* ✅\n\n`;
  }

  // Good files summary
  md += `### ✅ OLUMLU (0-300 satır)\n\n**${frontendCategorized.good.length} dosya (${Math.round(frontendCategorized.good.length / frontendFiles.length * 100)}%)** - ${frontendCategorized.good.length > frontendFiles.length * 0.9 ? 'Mükemmel! 🎉' : 'İyi!'}\n\n`;
  
  const topGood = frontendCategorized.good.sort((a, b) => a.lines - b.lines).slice(0, 5);
  if (topGood.length > 0) {
    md += `En kompakt örnekler:\n`;
    topGood.forEach(f => {
      md += `- \`${f.name}\`: ${f.lines} satır\n`;
    });
    md += '\n';
  }

  // ============================================================================
  // BACKEND SECTION
  // ============================================================================
  
  md += `---

## ⚙️ BACKEND DOSYA ANALİZİ

### 📈 Genel İstatistikler

| Metrik | Değer |
|--------|-------|
| Toplam Dosya | ${backendFiles.length} |
| Toplam Satır | ${backendStats.total.toLocaleString()} |
| Ortalama Dosya Boyutu | ${backendStats.avg} satır |
| En Büyük Dosya | ${backendStats.max} satır ${getStatus(backendStats.max).emoji} |
| En Küçük Dosya | ${backendStats.min} satır |

### 📊 Dosya Boyutu Dağılımı

| Kategori | Dosya Sayısı | Yüzde | Durum |
|----------|--------------|-------|-------|
| ✅ Olumlu (0-300) | ${backendCategorized.good.length} | ${Math.round(backendCategorized.good.length / backendFiles.length * 100)}% | ${backendCategorized.good.length > backendFiles.length * 0.9 ? 'Harika!' : 'İyi'} |
| ⚠️ Dikkat (301-450) | ${backendCategorized.warning.length} | ${Math.round(backendCategorized.warning.length / backendFiles.length * 100)}% | ${backendCategorized.warning.length > 10 ? 'Çok fazla!' : 'Gözden geçir'} |
| 🔴 Bölünmeli (451-700) | ${backendCategorized.refactor.length} | ${Math.round(backendCategorized.refactor.length / backendFiles.length * 100)}% | ${backendCategorized.refactor.length > 0 ? 'Refactor gerekli' : 'Yok'} |
| 🔴🔴 Acil (701-900) | ${backendCategorized.urgent.length} | ${Math.round(backendCategorized.urgent.length / backendFiles.length * 100)}% | ${backendCategorized.urgent.length > 0 ? 'Acil!' : 'Yok'} |
| 🔴🔴🔴 Kötü (900+) | ${backendCategorized.critical.length} | ${Math.round(backendCategorized.critical.length / backendFiles.length * 100)}% | ${backendCategorized.critical.length > 0 ? '**KRİTİK!**' : 'Yok'} |

---

`;

  // Backend critical/urgent/refactor/warning sections (same structure as frontend)
  if (backendCategorized.critical.length > 0) {
    md += `### 🔴🔴🔴 KÖTÜ DURUM (900+ satır) - **KRİTİK!**\n\n| # | Dosya | Satır | Yol | Durum |\n|---|-------|-------|-----|-------|\n`;
    backendCategorized.critical.forEach((f, i) => {
      md += `| ${i + 1} | \`${f.name}\` | ${f.lines} | \`${f.path}\` | 🚨 **ACİL MÜDAHALE GEREKLİ** |\n`;
    });
    md += '\n';
  } else {
    md += `### 🔴🔴🔴 KÖTÜ DURUM (900+ satır)\n\n*Yok - Harika!* ✅\n\n`;
  }

  if (backendCategorized.urgent.length > 0) {
    md += `### 🔴🔴 ACİL (701-900 satır)\n\n| # | Dosya | Satır | Yol | Durum |\n|---|-------|-------|-----|-------|\n`;
    backendCategorized.urgent.forEach((f, i) => {
      md += `| ${i + 1} | \`${f.name}\` | ${f.lines} | \`${f.path}\` | Hemen bölünmeli |\n`;
    });
    md += '\n';
  } else {
    md += `### 🔴🔴 ACİL (701-900 satır)\n\n*Yok - İyi durum!* ✅\n\n`;
  }

  if (backendCategorized.refactor.length > 0) {
    md += `### 🔴 BÖLÜNMELI (451-700 satır)\n\n| # | Dosya | Satır | Yol | Öneri |\n|---|-------|-------|-----|-------|\n`;
    backendCategorized.refactor.forEach((f, i) => {
      md += `| ${i + 1} | \`${f.name}\` | ${f.lines} | \`${f.path}\` | Modüllere bölünmeli |\n`;
    });
    md += `\n**Toplam: ${backendCategorized.refactor.length} dosya refactor edilmeli**\n\n`;
  } else {
    md += `### 🔴 BÖLÜNMELI (451-700 satır)\n\n*Yok - Mükemmel!* ✅\n\n`;
  }

  if (backendCategorized.warning.length > 0) {
    md += `### ⚠️ DİKKAT (301-450 satır)\n\n`;
    if (backendCategorized.warning.length > 10) {
      md += `**${backendCategorized.warning.length} dosya var - İlk 10 gösteriliyor:**\n\n`;
      md += `| # | Dosya | Satır | Yol | Durum |\n|---|-------|-------|-----|-------|\n`;
      backendCategorized.warning.slice(0, 10).forEach((f, i) => {
        md += `| ${i + 1} | \`${f.name}\` | ${f.lines} | \`${f.path}\` | İzlenmeli |\n`;
      });
    } else {
      md += `| # | Dosya | Satır | Yol | Durum |\n|---|-------|-------|-----|-------|\n`;
      backendCategorized.warning.forEach((f, i) => {
        md += `| ${i + 1} | \`${f.name}\` | ${f.lines} | \`${f.path}\` | İzlenmeli |\n`;
      });
    }
    md += `\n**Toplam: ${backendCategorized.warning.length} dosya gözden geçirilmeli**\n\n`;
  } else {
    md += `### ⚠️ DİKKAT (301-450 satır)\n\n*Yok - Harika!* ✅\n\n`;
  }

  md += `### ✅ OLUMLU (0-300 satır)\n\n**${backendCategorized.good.length} dosya (${Math.round(backendCategorized.good.length / backendFiles.length * 100)}%)** - ${backendCategorized.good.length > backendFiles.length * 0.9 ? 'Mükemmel! 🎉' : 'İyi!'}\n\n`;

  // ============================================================================
  // PRIORITY LIST
  // ============================================================================
  
  const allProblems = [
    ...frontendCategorized.critical.map(f => ({ ...f, project: 'Frontend', priority: 5 })),
    ...backendCategorized.critical.map(f => ({ ...f, project: 'Backend', priority: 5 })),
    ...frontendCategorized.urgent.map(f => ({ ...f, project: 'Frontend', priority: 4 })),
    ...backendCategorized.urgent.map(f => ({ ...f, project: 'Backend', priority: 4 })),
    ...frontendCategorized.refactor.map(f => ({ ...f, project: 'Frontend', priority: 3 })),
    ...backendCategorized.refactor.map(f => ({ ...f, project: 'Backend', priority: 3 }))
  ].sort((a, b) => b.priority - a.priority || b.lines - a.lines);

  if (allProblems.length > 0) {
    md += `---

## 🎯 ÖNCELİKLİ REFACTORING LİSTESİ

`;

    const criticalProblems = allProblems.filter(f => f.priority === 5);
    const urgentProblems = allProblems.filter(f => f.priority === 4);
    const refactorProblems = allProblems.filter(f => f.priority === 3);

    if (criticalProblems.length > 0) {
      md += `### 🚨 KRİTİK ÖNCELİK (Bugün yapılmalı)\n\n`;
      criticalProblems.forEach((f, i) => {
        md += `${i + 1}. **🔴🔴🔴 ${f.name} (${f.lines} satır)** - ${f.project}\n`;
        md += `   - Yol: \`${f.path}\`\n`;
        md += `   - Durum: KÖTÜ - 900+ satır\n`;
        md += `   - Önemi: **Kritik** - Bakım imkansız\n\n`;
      });
    }

    if (urgentProblems.length > 0) {
      md += `### 🔴 YÜKSEK ÖNCELİK (Bu hafta)\n\n`;
      urgentProblems.forEach((f, i) => {
        md += `${i + 1}. **🔴🔴 ${f.name} (${f.lines} satır)** - ${f.project}\n`;
        md += `   - Yol: \`${f.path}\`\n`;
        md += `   - Durum: ACİL - 701-900 satır\n\n`;
      });
    }

    if (refactorProblems.length > 0) {
      md += `### ⚠️ ORTA ÖNCELİK (Bu ay)\n\n`;
      refactorProblems.slice(0, 10).forEach((f, i) => {
        md += `${i + 1}. **🔴 ${f.name} (${f.lines} satır)** - ${f.project}\n`;
      });
      if (refactorProblems.length > 10) {
        md += `\n*...ve ${refactorProblems.length - 10} dosya daha*\n`;
      }
      md += '\n';
    }
  } else {
    md += `---

## 🎯 ÖNCELİKLİ REFACTORING LİSTESİ

**✅ Tüm dosyalar iyi durumda! Refactoring gerekmiyor.** 🎉

`;
  }

  // ============================================================================
  // TARGET METRICS
  // ============================================================================
  
  const totalCritical = frontendCategorized.critical.length + backendCategorized.critical.length;
  const totalRefactor = frontendCategorized.refactor.length + backendCategorized.refactor.length + frontendCategorized.urgent.length + backendCategorized.urgent.length;
  const totalWarning = frontendCategorized.warning.length + backendCategorized.warning.length;

  md += `---

## 📈 HEDEF METRİKLER & İLERLEME

| Metrik | Şu An | Hedef | İlerleme | Durum |
|--------|-------|-------|----------|-------|
| **900+ satır dosya** | ${totalCritical} | 0 | ${totalCritical === 0 ? '✅ 100%' : '🔴 0%'} | ${totalCritical === 0 ? 'Başarılı' : 'Kritik'} |
| **451+ satır dosya** | ${totalRefactor} | 0 | ${totalRefactor === 0 ? '✅ 100%' : totalRefactor < 5 ? '⚠️ 50%' : '🔴 0%'} | ${totalRefactor === 0 ? 'Başarılı' : totalRefactor < 5 ? 'Orta' : 'Kötü'} |
| **301+ satır dosya** | ${totalWarning} | <5 | ${totalWarning < 5 ? '✅ 100%' : totalWarning < 10 ? '⚠️ 50%' : '🔴 0%'} | ${totalWarning < 5 ? 'Başarılı' : totalWarning < 10 ? 'Orta' : 'Kötü'} |
| **Ortalama (Frontend)** | ${frontendStats.avg} satır | <100 | ${frontendStats.avg < 100 ? '✅' : '⚠️'} ${Math.round((100 - Math.min(frontendStats.avg, 100)) / 100 * 100)}% | ${frontendStats.avg < 100 ? 'İyi' : 'Yüksek'} |
| **Ortalama (Backend)** | ${backendStats.avg} satır | <150 | ${backendStats.avg < 150 ? '✅' : '⚠️'} ${Math.round((150 - Math.min(backendStats.avg, 150)) / 150 * 100)}% | ${backendStats.avg < 150 ? 'İyi' : 'Yüksek'} |

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

`;

  if (totalCritical > 0) {
    md += `1. 🚨 **${totalCritical} kritik dosya için acil eylem planı oluştur**\n`;
  }
  if (totalRefactor > 0) {
    md += `${totalCritical > 0 ? '2' : '1'}. 🔴 **${totalRefactor} dosya için refactoring sprint planla**\n`;
  }
  if (totalWarning > 5) {
    md += `${(totalCritical > 0 ? 1 : 0) + (totalRefactor > 0 ? 1 : 0) + 1}. ⚠️ **301-450 satırlık ${totalWarning} dosyayı haftalık gözden geçir**\n`;
  }
  
  md += `- ✅ **Yeni dosya ekleme kuralı koy: Max 300 satır**\n`;
  md += `- 🤖 **Otomatik linter kuralı ekle (ESLint/TSLint)**\n`;
  md += `- 📊 **Bu raporu haftalık gözden geçir**\n`;

  md += `\n---\n\n*Bu rapor otomatik olarak \`scripts/analyze-files.js\` tarafından oluşturulmuştur.*\n`;

  return md;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

function main() {
  console.log('📊 HZM Dosya Analiz Scripti Başlatılıyor...\n');
  
  // Analyze Frontend
  console.log('🎨 Frontend analiz ediliyor...');
  const frontendFiles = analyzeDirectory(path.join(FRONTEND_DIR, 'src'), 'Frontend/src');
  const frontendCategorized = categorizeFiles(frontendFiles);
  const frontendStats = calculateStats(frontendFiles);
  
  console.log(`   ✅ ${frontendFiles.length} dosya tarandı`);
  console.log(`   📊 Toplam: ${frontendStats.total.toLocaleString()} satır`);
  console.log(`   🔴🔴🔴 Kritik: ${frontendCategorized.critical.length} dosya`);
  console.log(`   🔴 Refactor: ${frontendCategorized.refactor.length + frontendCategorized.urgent.length} dosya`);
  
  // Analyze Backend
  console.log('\n⚙️  Backend analiz ediliyor...');
  const backendFiles = analyzeDirectory(path.join(BACKEND_DIR, 'src'), 'Backend/src');
  const backendMigrations = analyzeDirectory(path.join(BACKEND_DIR, 'migrations'), 'Backend/migrations');
  const allBackendFiles = [...backendFiles, ...backendMigrations];
  const backendCategorized = categorizeFiles(allBackendFiles);
  const backendStats = calculateStats(allBackendFiles);
  
  console.log(`   ✅ ${allBackendFiles.length} dosya tarandı`);
  console.log(`   📊 Toplam: ${backendStats.total.toLocaleString()} satır`);
  console.log(`   🔴🔴🔴 Kritik: ${backendCategorized.critical.length} dosya`);
  console.log(`   🔴 Refactor: ${backendCategorized.refactor.length + backendCategorized.urgent.length} dosya`);
  
  // Generate Markdown Report
  console.log('\n📝 Markdown rapor oluşturuluyor...');
  const markdown = generateMarkdown(frontendFiles, allBackendFiles);
  
  // Write to file
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(OUTPUT_FILE, markdown, 'utf8');
  console.log(`   ✅ Rapor kaydedildi: ${OUTPUT_FILE}`);
  
  // Summary
  const totalCritical = frontendCategorized.critical.length + backendCategorized.critical.length;
  const totalProblems = frontendCategorized.refactor.length + backendCategorized.refactor.length + 
                       frontendCategorized.urgent.length + backendCategorized.urgent.length + totalCritical;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 ÖZET:');
  console.log('='.repeat(60));
  console.log(`✅ Toplam dosya: ${frontendFiles.length + allBackendFiles.length}`);
  console.log(`🔴🔴🔴 Kritik sorun: ${totalCritical} dosya`);
  console.log(`🔴 Toplam problem: ${totalProblems} dosya`);
  
  if (totalCritical > 0) {
    console.log('\n🚨 ACİL: ' + totalCritical + ' dosya kritik durumda!');
  } else if (totalProblems > 0) {
    console.log('\n⚠️  DİKKAT: ' + totalProblems + ' dosya refactor edilmeli');
  } else {
    console.log('\n🎉 Tebrikler! Tüm dosyalar iyi durumda!');
  }
  
  console.log('\n📄 Detaylı rapor: docs/roadmap/DOSYA_ANALIZI.md');
}

// Run
if (require.main === module) {
  main();
}

module.exports = { analyzeDirectory, categorizeFiles, calculateStats };


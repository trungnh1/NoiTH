import { Patient, LabResult, ClinicalTag, SeverityLevel, AdmissionDischargeStatus } from '../types/patient';

export interface EvaluatedLabItem {
  key: string;            // 'dengue', 'plt', 'crp', 'glucose', 'ast', 'alt', 'k', 'na', etc.
  shortName: string;      // 'Test Dengue NS1Ag', 'Tiểu cầu', 'CRP', etc.
  value: string;          // '137', '17.6', 'DƯƠNG TÍNH'
  unit?: string;          // 'G/L', 'mg/L', ''
  severity: 'CRITICAL' | 'WARNING';
  badgeLabel: string;     // '🚨 Test Dengue NS1Ag: DƯƠNG TÍNH', '⚠️ Tiểu cầu: 137 G/L', '⚠️ CRP: 17.6 mg/L'
}

/**
 * Đánh giá chuyên sâu từng chỉ số cận lâm sàng dựa trên ngưỡng nguy hiểm / quá bất thường thực tế.
 * Không cảnh báo các chỉ số bất thường nhẹ, dao động biên (như Glucose 7.54, AST 41.2, ALT 77.1).
 */
export function evaluateLabMetric(
  testName: string,
  rawVal: string | number,
  unit: string = '',
  isPanicInput: boolean = false
): EvaluatedLabItem | null {
  const nameLower = testName.toLowerCase().trim();
  const valStr = String(rawVal).trim();
  const numVal = parseFloat(valStr.replace(/[^0-9.]/g, ''));

  // 1. DENGUE / NS1Ag: Đã được gắn nhãn Tag lâm sàng Sốt xuất huyết, không đưa vào danh sách cảnh báo báo động đỏ
  if (nameLower.includes('dengue') || nameLower.includes('ns1')) {
    return null;
  }

  // 2. TIỂU CẦU (PLT / Platelets)
  if (nameLower.includes('plt') || nameLower.includes('tiểu cầu') || nameLower.includes('platelet')) {
    if (!isNaN(numVal)) {
      if (numVal < 50) {
        return {
          key: 'plt',
          shortName: 'Tiểu cầu',
          value: String(numVal),
          unit: 'G/L',
          severity: 'CRITICAL',
          badgeLabel: `🚨 Tiểu cầu: ${numVal} G/L (Giảm nặng < 50)`,
        };
      }
      if (numVal < 150) {
        return {
          key: 'plt',
          shortName: 'Tiểu cầu',
          value: String(numVal),
          unit: 'G/L',
          severity: 'WARNING',
          badgeLabel: `⚠️ Tiểu cầu: ${numVal} G/L`,
        };
      }
      if (numVal > 1000) {
        return {
          key: 'plt',
          shortName: 'Tiểu cầu',
          value: String(numVal),
          unit: 'G/L',
          severity: 'CRITICAL',
          badgeLabel: `🚨 Tiểu cầu: ${numVal} G/L (Tăng rất cao)`,
        };
      }
    }
    return null;
  }

  // 3. CRP (Protein phản ứng C) - Chỉ báo động khi lớn hơn 100 mg/L theo yêu cầu lâm sàng
  if (nameLower.includes('crp') && !nameLower.includes('troponin')) {
    if (!isNaN(numVal)) {
      if (numVal >= 100) {
        return {
          key: 'crp',
          shortName: 'CRP',
          value: String(numVal),
          unit: 'mg/L',
          severity: 'CRITICAL',
          badgeLabel: `🚨 CRP: ${numVal} mg/L (Nhiễm trùng nặng > 100)`,
        };
      }
    }
    return null;
  }

  // 4. PROCALCITONIN (PCT)
  if (nameLower.includes('procalcitonin') || nameLower.includes('pct')) {
    if (!isNaN(numVal)) {
      if (numVal >= 2.0) {
        return {
          key: 'pct',
          shortName: 'PCT',
          value: String(numVal),
          unit: 'ng/mL',
          severity: 'CRITICAL',
          badgeLabel: `🚨 PCT: ${numVal} ng/mL (Nguy cơ NT huyết)`,
        };
      }
      if (numVal >= 0.5) {
        return {
          key: 'pct',
          shortName: 'PCT',
          value: String(numVal),
          unit: 'ng/mL',
          severity: 'WARNING',
          badgeLabel: `⚠️ PCT: ${numVal} ng/mL`,
        };
      }
    }
    return null;
  }

  // 5. GLUCOSE (ĐƯỜNG HUYẾT) - Chỉ cảnh báo khi quá cao (> 14) hoặc quá thấp (< 3.5)
  if (nameLower.includes('glucose') || nameLower.includes('đường huyết')) {
    if (!isNaN(numVal)) {
      if (numVal < 3.5) {
        return {
          key: 'glucose',
          shortName: 'Glucose',
          value: String(numVal),
          unit: 'mmol/L',
          severity: 'CRITICAL',
          badgeLabel: `🚨 Hạ đường huyết: ${numVal} mmol/L`,
        };
      }
      if (numVal > 18.0) {
        return {
          key: 'glucose',
          shortName: 'Glucose',
          value: String(numVal),
          unit: 'mmol/L',
          severity: 'CRITICAL',
          badgeLabel: `🚨 Glucose: ${numVal} mmol/L (Tăng cấp > 18)`,
        };
      }
      if (numVal >= 14.0) {
        return {
          key: 'glucose',
          shortName: 'Glucose',
          value: String(numVal),
          unit: 'mmol/L',
          severity: 'WARNING',
          badgeLabel: `⚠️ Glucose: ${numVal} mmol/L`,
        };
      }
    }
    return null;
  }

  // 6. MEN GAN AST & ALT - Chỉ cảnh báo khi tăng cao (>= 150 U/L)
  if (nameLower.includes('ast') || nameLower.includes('got')) {
    if (!isNaN(numVal)) {
      if (numVal >= 500) {
        return {
          key: 'ast',
          shortName: 'AST',
          value: String(numVal),
          unit: 'U/L',
          severity: 'CRITICAL',
          badgeLabel: `🚨 AST: ${numVal} U/L (Tổn thương gan cấp)`,
        };
      }
      if (numVal >= 150) {
        return {
          key: 'ast',
          shortName: 'AST',
          value: String(numVal),
          unit: 'U/L',
          severity: 'WARNING',
          badgeLabel: `⚠️ AST: ${numVal} U/L`,
        };
      }
    }
    return null;
  }

  if (nameLower.includes('alt') || nameLower.includes('gpt')) {
    if (!isNaN(numVal)) {
      if (numVal >= 500) {
        return {
          key: 'alt',
          shortName: 'ALT',
          value: String(numVal),
          unit: 'U/L',
          severity: 'CRITICAL',
          badgeLabel: `🚨 ALT: ${numVal} U/L (Tổn thương gan cấp)`,
        };
      }
      if (numVal >= 150) {
        return {
          key: 'alt',
          shortName: 'ALT',
          value: String(numVal),
          unit: 'U/L',
          severity: 'WARNING',
          badgeLabel: `⚠️ ALT: ${numVal} U/L`,
        };
      }
    }
    return null;
  }

  // 7. KALI MÁU (K+)
  if (nameLower.includes('k+') || nameLower.includes('kali')) {
    if (!isNaN(numVal)) {
      if (numVal < 3.0) {
        return {
          key: 'k',
          shortName: 'Kali (K+)',
          value: String(numVal),
          unit: 'mmol/L',
          severity: 'CRITICAL',
          badgeLabel: `🚨 Hạ Kali máu: K+ = ${numVal} mmol/L`,
        };
      }
      if (numVal < 3.5) {
        return {
          key: 'k',
          shortName: 'Kali (K+)',
          value: String(numVal),
          unit: 'mmol/L',
          severity: 'WARNING',
          badgeLabel: `⚠️ Hạ Kali: K+ = ${numVal} mmol/L`,
        };
      }
      if (numVal > 5.5) {
        return {
          key: 'k',
          shortName: 'Kali (K+)',
          value: String(numVal),
          unit: 'mmol/L',
          severity: 'CRITICAL',
          badgeLabel: `🚨 Tăng Kali máu nguy hiểm: K+ = ${numVal} mmol/L`,
        };
      }
      if (numVal > 5.0) {
        return {
          key: 'k',
          shortName: 'Kali (K+)',
          value: String(numVal),
          unit: 'mmol/L',
          severity: 'WARNING',
          badgeLabel: `⚠️ Tăng Kali: K+ = ${numVal} mmol/L`,
        };
      }
    }
    return null;
  }

  // 8. NATRI MÁU (Na+)
  if (nameLower.includes('na+') || nameLower.includes('natri')) {
    if (!isNaN(numVal)) {
      if (numVal < 125) {
        return {
          key: 'na',
          shortName: 'Natri (Na+)',
          value: String(numVal),
          unit: 'mmol/L',
          severity: 'CRITICAL',
          badgeLabel: `🚨 Hạ Natri máu nặng: Na+ = ${numVal} mmol/L`,
        };
      }
      if (numVal < 130) {
        return {
          key: 'na',
          shortName: 'Natri (Na+)',
          value: String(numVal),
          unit: 'mmol/L',
          severity: 'WARNING',
          badgeLabel: `⚠️ Hạ Natri: Na+ = ${numVal} mmol/L`,
        };
      }
      if (numVal > 155) {
        return {
          key: 'na',
          shortName: 'Natri (Na+)',
          value: String(numVal),
          unit: 'mmol/L',
          severity: 'CRITICAL',
          badgeLabel: `🚨 Tăng Natri máu nặng: Na+ = ${numVal} mmol/L`,
        };
      }
      if (numVal > 150) {
        return {
          key: 'na',
          shortName: 'Natri (Na+)',
          value: String(numVal),
          unit: 'mmol/L',
          severity: 'WARNING',
          badgeLabel: `⚠️ Tăng Natri: Na+ = ${numVal} mmol/L`,
        };
      }
    }
    return null;
  }

  // 9. CREATININE (Tổn thương thận)
  if (nameLower.includes('creatinine') || nameLower.includes('cre')) {
    if (!isNaN(numVal)) {
      if (numVal > 250) {
        return {
          key: 'creatinine',
          shortName: 'Creatinine',
          value: String(numVal),
          unit: 'µmol/L',
          severity: 'CRITICAL',
          badgeLabel: `🚨 Creatinine: ${numVal} µmol/L (Suy thận nặng)`,
        };
      }
      if (numVal > 150) {
        return {
          key: 'creatinine',
          shortName: 'Creatinine',
          value: String(numVal),
          unit: 'µmol/L',
          severity: 'WARNING',
          badgeLabel: `⚠️ Creatinine: ${numVal} µmol/L`,
        };
      }
    }
    return null;
  }

  // 10. BẠCH CẦU (WBC - Tổng số lượng bạch cầu)
  // Loại trừ các chỉ số thành phần bạch cầu (Neu%, Lym%, Mono%, Eos%, Baso%, v.v.)
  const isSubWbc =
    nameLower.includes('đa nhân') ||
    nameLower.includes('trung tính') ||
    nameLower.includes('neu') ||
    nameLower.includes('lym') ||
    nameLower.includes('mono') ||
    nameLower.includes('eos') ||
    nameLower.includes('baso') ||
    nameLower.includes('hạt') ||
    nameLower.includes('đoạn') ||
    nameLower.includes('%') ||
    unit === '%';

  const isTotalWbc =
    !isSubWbc &&
    (
      nameLower === 'wbc' ||
      nameLower.includes('wbc') ||
      nameLower === 'bạch cầu' ||
      nameLower.includes('số lượng bạch cầu') ||
      nameLower.includes('tổng số bạch cầu') ||
      /^bạch\s*cầu(\s*\(wbc\))?$/i.test(nameLower)
    );

  if (isTotalWbc) {
    if (!isNaN(numVal)) {
      if (numVal < 2.5) {
        return {
          key: 'wbc',
          shortName: 'Bạch cầu',
          value: String(numVal),
          unit: 'G/L',
          severity: 'CRITICAL',
          badgeLabel: `🚨 Giảm bạch cầu nặng: WBC = ${numVal} G/L`,
        };
      }
      if (numVal < 3.5) {
        return {
          key: 'wbc',
          shortName: 'Bạch cầu',
          value: String(numVal),
          unit: 'G/L',
          severity: 'WARNING',
          badgeLabel: `⚠️ Giảm bạch cầu: WBC = ${numVal} G/L`,
        };
      }
      if (numVal > 20.0) {
        return {
          key: 'wbc',
          shortName: 'Bạch cầu',
          value: String(numVal),
          unit: 'G/L',
          severity: 'CRITICAL',
          badgeLabel: `🚨 Bạch cầu rất cao: WBC = ${numVal} G/L`,
        };
      }
      if (numVal > 15.0) {
        return {
          key: 'wbc',
          shortName: 'Bạch cầu',
          value: String(numVal),
          unit: 'G/L',
          severity: 'WARNING',
          badgeLabel: `⚠️ Bạch cầu tăng: WBC = ${numVal} G/L`,
        };
      }
    }
    return null;
  }

  // 11. HUYẾT SẮC TỐ (HGB / Hb)
  if (nameLower.includes('huyết sắc tố') || nameLower.includes('hgb') || nameLower === 'hb') {
    if (!isNaN(numVal)) {
      if (numVal < 70) {
        return {
          key: 'hgb',
          shortName: 'HGB',
          value: String(numVal),
          unit: 'g/L',
          severity: 'CRITICAL',
          badgeLabel: `🚨 HGB: ${numVal} g/L (Thiếu máu nặng cần truyền)`,
        };
      }
      if (numVal < 90) {
        return {
          key: 'hgb',
          shortName: 'HGB',
          value: String(numVal),
          unit: 'g/L',
          severity: 'WARNING',
          badgeLabel: `⚠️ HGB: ${numVal} g/L (Thiếu máu)`,
        };
      }
    }
    return null;
  }

  // 12. MEN TIM (Troponin, CK-MB) & NT-proBNP
  if (nameLower.includes('troponin')) {
    if (!isNaN(numVal) && numVal > 14) {
      return {
        key: 'troponin',
        shortName: 'Troponin',
        value: String(numVal),
        unit: 'ng/L',
        severity: 'CRITICAL',
        badgeLabel: `🚨 Troponin tăng: ${numVal} ng/L (Nghi ngờ NMCT)`,
      };
    }
    if (/dương|pos|\+/i.test(valStr) || isPanicInput) {
      return {
        key: 'troponin',
        shortName: 'Troponin',
        value: valStr,
        severity: 'CRITICAL',
        badgeLabel: `🚨 Troponin: DƯƠNG TÍNH (Nghi ngờ NMCT)`,
      };
    }
    return null;
  }

  if (nameLower.includes('ck-mb') || nameLower.includes('ckmb')) {
    if (!isNaN(numVal) && numVal > 25) {
      return {
        key: 'ckmb',
        shortName: 'CK-MB',
        value: String(numVal),
        unit: 'U/L',
        severity: 'CRITICAL',
        badgeLabel: `🚨 CK-MB tăng: ${numVal} U/L`,
      };
    }
    return null;
  }

  if (nameLower.includes('bnp') || nameLower.includes('nt-probnp')) {
    if (!isNaN(numVal) && numVal > 1000) {
      return {
        key: 'bnp',
        shortName: 'NT-proBNP',
        value: String(numVal),
        unit: 'pg/mL',
        severity: numVal > 5000 ? 'CRITICAL' : 'WARNING',
        badgeLabel: `${numVal > 5000 ? '🚨' : '⚠️'} NT-proBNP: ${numVal} pg/mL`,
      };
    }
    return null;
  }

  // 13. ĐÔNG MÁU (INR)
  if (nameLower.includes('inr')) {
    if (!isNaN(numVal) && numVal > 2.0) {
      return {
        key: 'inr',
        shortName: 'INR',
        value: String(numVal),
        severity: numVal > 4.0 ? 'CRITICAL' : 'WARNING',
        badgeLabel: `${numVal > 4.0 ? '🚨' : '⚠️'} Rối loạn đông máu (INR: ${numVal})`,
      };
    }
    return null;
  }

  // Nếu là panic value chung chưa được phân loại
  if (isPanicInput) {
    return {
      key: nameLower,
      shortName: testName,
      value: valStr,
      unit,
      severity: 'CRITICAL',
      badgeLabel: `🚨 ${testName}: ${valStr} ${unit || ''}`.trim(),
    };
  }

  return null;
}

/**
 * Đánh giá và lọc toàn bộ các xét nghiệm quá bất thường hoặc nguy hiểm của bệnh nhân.
 * Tự động loại bỏ trùng lặp và loại bỏ các chỉ số bất thường nhẹ không cần cảnh báo.
 */
export function getAllEvaluatedLabAlerts(patient: Patient): EvaluatedLabItem[] {
  const alertMap = new Map<string, EvaluatedLabItem>();

  const addAlert = (item: EvaluatedLabItem) => {
    const existing = alertMap.get(item.key);
    if (!existing) {
      alertMap.set(item.key, item);
    } else if (existing.severity === 'WARNING' && item.severity === 'CRITICAL') {
      alertMap.set(item.key, item);
    }
  };

  // 1. Quét từ mảng patient.labs
  if (patient.labs && patient.labs.length > 0) {
    patient.labs.forEach((lab) => {
      const evaluated = evaluateLabMetric(lab.testName, lab.value, lab.unit, lab.isPanicValue);
      if (evaluated) {
        addAlert(evaluated);
      }
    });
  }

  // 2. Quét từ văn bản initialLabsText
  if (patient.initialLabsText) {
    const text = patient.initialLabsText;

    // a) Huyết khối mạch máu
    if (/huyết khối/i.test(text)) {
      addAlert({
        key: 'thrombus',
        shortName: 'Huyết khối',
        value: 'Phát hiện',
        severity: 'CRITICAL',
        badgeLabel: '🚨 CĐHA: Phát hiện Huyết Khối Mạch Máu',
      });
    }

    // c) Hẹp lòng động mạch nặng
    if (/hẹp\s*(khoảng\s*)?4\d%|hẹp\s*(khoảng\s*)?[5-9]\d%|hẹp nặng|hẹp\s*khảo\s*sát\s*đm/i.test(text)) {
      const matchHep = text.match(/hẹp\s*[^;\.\n]+/i);
      addAlert({
        key: 'stenosis',
        shortName: 'Hẹp ĐM',
        value: matchHep ? matchHep[0].trim() : 'Hẹp lòng ĐM',
        severity: 'WARNING',
        badgeLabel: `⚠️ ${matchHep ? matchHep[0].trim() : 'Hẹp lòng động mạch đáng kể'}`,
      });
    }

    // d) Tự động phân tích các chỉ số số học từ văn bản
    const autoParsed = parseRawLabsText(text);
    autoParsed.forEach((lab) => {
      const evaluated = evaluateLabMetric(lab.testName, lab.value, lab.unit, lab.isPanicValue);
      if (evaluated) {
        addAlert(evaluated);
      }
    });

    // e) ECG đặc biệt
    const ecgMatch = text.match(/(?:ecg|điện tâm đồ)[^:\n]*:([^\n;.]+)/i);
    if (ecgMatch && ecgMatch[1]) {
      const desc = ecgMatch[1].trim();
      if (/rung nhĩ|st chênh lên|nhanh thất|rung thất|block nhĩ thất độ 3/i.test(desc)) {
        addAlert({
          key: 'ecg',
          shortName: 'ECG',
          value: desc,
          severity: 'CRITICAL',
          badgeLabel: `🚨 ECG: ${desc}`,
        });
      } else if (/thiếu máu|st chênh xuống|sóng t âm/i.test(desc)) {
        addAlert({
          key: 'ecg',
          shortName: 'ECG',
          value: desc,
          severity: 'WARNING',
          badgeLabel: `⚠️ ECG: ${desc}`,
        });
      }
    }

    // X-Quang tràn dịch / tràn khí
    const xqMatch = text.match(/(?:x-?quang|xquang)[^:\n]*:([^\n;.]+)/i);
    if (xqMatch && xqMatch[1]) {
      const desc = xqMatch[1].trim();
      if (/tràn khí|tràn dịch nhiều|phù phổi cấp/i.test(desc)) {
        addAlert({
          key: 'xquang',
          shortName: 'X-Quang',
          value: desc,
          severity: 'CRITICAL',
          badgeLabel: `🚨 X-Quang: ${desc}`,
        });
      }
    }
  }

  // 3. AI critical alerts (nếu có)
  if (patient.aiAnalysis?.clinicalAlerts) {
    patient.aiAnalysis.clinicalAlerts
      .filter((a) => a.type === 'critical')
      .forEach((a, idx) => {
        addAlert({
          key: `ai_alert_${idx}`,
          shortName: 'Cảnh báo AI',
          value: a.message,
          severity: 'CRITICAL',
          badgeLabel: a.message.startsWith('🚨') || a.message.startsWith('⚠️') ? a.message : `🚨 ${a.message}`,
        });
      });
  }

  return Array.from(alertMap.values());
}

/**
 * Trích xuất các cảnh báo cận lâm sàng bất thường nặng, nguy hiểm (Panic Values)
 * để cảnh báo ngay phía dưới Hướng xử trí / Kế hoạch điều trị.
 */
export function getCriticalLabAlerts(patient: Patient): string[] {
  const evaluated = getAllEvaluatedLabAlerts(patient);
  return evaluated.map((item) => item.badgeLabel);
}

export interface ImportantLabItem {
  id: string;
  name: string;
  value: string;
  unit?: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  badgeLabel: string;
}

/**
 * Trích xuất CHỈ các xét nghiệm bất thường nhiều hoặc cận lâm sàng quan trọng
 * phục vụ hiển thị trên Bảng Kardex Lâm Sàng 1 Trang.
 */
export function getImportantOrAbnormalLabs(patient: Patient): ImportantLabItem[] {
  const evaluated = getAllEvaluatedLabAlerts(patient);
  return evaluated.map((item, idx) => ({
    id: `lab-eval-${item.key}-${idx}`,
    name: item.shortName,
    value: item.value,
    unit: item.unit,
    severity: item.severity,
    badgeLabel: item.badgeLabel,
  }));
}

/**
 * Tự động phân tích văn bản kết quả Cận Lâm Sàng sao chép từ HIS / Bệnh án
 * và chuyển đổi thành danh sách đối tượng xét nghiệm chuẩn hóa (LabResult).
 * Tự động nhận diện nhiều lần xét nghiệm khác nhau và sắp xếp theo trình tự thời gian.
 */
export function parseRawLabsText(text: string, defaultTimestamp?: string): LabResult[] {
  if (!text || !text.trim()) return [];

  // Tách văn bản nếu có các mốc thời gian / header xét nghiệm mới
  // Ví dụ: "--- [Cận Lâm Sàng Mới: 14:30 01/11/2026] ---"
  const sectionSplitRegex = /(?:^|\n)\s*---\s*\[(?:Cận Lâm Sàng Mới|CLS Mới|Xét Nghiệm Mới|CLS|Xét Nghiệm)[\s:]*([^\]\n]+)\]\s*---\s*(?:\n|$)/i;

  if (sectionSplitRegex.test(text)) {
    const parts = text.split(/(?:^|\n)\s*---\s*\[(?:Cận Lâm Sàng Mới|CLS Mới|Xét Nghiệm Mới|CLS|Xét Nghiệm)[\s:]*([^\]\n]+)\]\s*---\s*(?:\n|$)/i);
    const allResults: LabResult[] = [];

    // Phân đoạn ban đầu (trước header mốc thời gian đầu tiên)
    if (parts[0] && parts[0].trim()) {
      allResults.push(...parseSingleLabBatch(parts[0], defaultTimestamp));
    }

    // Các phân đoạn tiếp theo đi theo cặp [mốc thời gian, nội dung CLS]
    for (let i = 1; i < parts.length; i += 2) {
      const timeHeader = parts[i]?.trim();
      const sectionContent = parts[i + 1]?.trim();
      if (sectionContent) {
        allResults.push(...parseSingleLabBatch(sectionContent, timeHeader || defaultTimestamp));
      }
    }

    return allResults.length > 0 ? allResults : parseSingleLabBatch(text, defaultTimestamp);
  }

  return parseSingleLabBatch(text, defaultTimestamp);
}

/**
 * Phân tích một đợt cận lâm sàng cụ thể
 */
export function parseSingleLabBatch(text: string, batchTimestamp?: string): LabResult[] {
  if (!text || !text.trim()) return [];

  const now = new Date();
  const timeStr = batchTimestamp || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const results: LabResult[] = [];

  // Từ điển các xét nghiệm phổ biến trong Khoa Nội
  interface LabDefinition {
    pattern: RegExp;
    name: string;
    category: LabResult['category'];
    unit: string;
    normalRange: string;
    minNormal?: number;
    maxNormal?: number;
    panicLow?: number;
    panicHigh?: number;
    isStringResult?: boolean;
  }

  const LAB_DEFINITIONS: LabDefinition[] = [
    // Huyết học
    { pattern: /\b(?:wbc|(?:tổng\s*số\s*)?bạch\s*cầu(?!\s*(?:đa\s*nhân|trung\s*tính|lympho|mono|ái\s*toan|ái\s*kiềm|hạt|đoạn)))\b[^\d]*?([\d.]+)/i, name: 'Bạch cầu (WBC)', category: 'Huyết học', unit: 'G/L', normalRange: '4.0 - 10.0', minNormal: 4.0, maxNormal: 10.0, panicLow: 2.5, panicHigh: 20.0 },
    { pattern: /\b(?:rbc|hồng\s*cầu)\b[^\d]*?([\d.]+)/i, name: 'Hồng cầu (RBC)', category: 'Huyết học', unit: 'T/L', normalRange: '3.8 - 5.5', minNormal: 3.8, maxNormal: 5.5, panicLow: 2.5, panicHigh: 6.5 },
    { pattern: /\b(?:hgb|hb|huyết\s*sắc\s*tố)\b[^\d]*?([\d.]+)/i, name: 'Huyết sắc tố (HGB)', category: 'Huyết học', unit: 'g/L', normalRange: '120 - 160', minNormal: 120, maxNormal: 160, panicLow: 70, panicHigh: 200 },
    { pattern: /\b(?:hct|hematocrit)\b[^\d]*?([\d.]+)/i, name: 'Hematocrit (HCT)', category: 'Huyết học', unit: '%', normalRange: '35 - 47', minNormal: 35, maxNormal: 47, panicLow: 20, panicHigh: 55 },
    { pattern: /\b(?:plt|tiểu\s*cầu|platelets?)\b[^\d]*?([\d.]+)/i, name: 'Tiểu cầu (PLT)', category: 'Huyết học', unit: 'G/L', normalRange: '150 - 450', minNormal: 150, maxNormal: 450, panicLow: 50, panicHigh: 1000 },
    { pattern: /\b(?:neu%?|neutrophil%?)\b[^\d]*?([\d.]+)/i, name: 'Neutrophil (NEU%)', category: 'Huyết học', unit: '%', normalRange: '43 - 75', minNormal: 43, maxNormal: 75 },
    { pattern: /\b(?:lym%?|lymphocyte%?)\b[^\d]*?([\d.]+)/i, name: 'Lympho (LYM%)', category: 'Huyết học', unit: '%', normalRange: '17 - 48', minNormal: 17, maxNormal: 48 },
    { pattern: /\b(?:inr)\b[^\d]*?([\d.]+)/i, name: 'Đông máu (INR)', category: 'Huyết học', unit: '', normalRange: '0.8 - 1.2', minNormal: 0.8, maxNormal: 1.2, panicHigh: 4.5 },
    
    // Sinh hóa
    { pattern: /\b(?:glucose|đường\s*huyết)\b[^\d]*?([\d.]+)/i, name: 'Glucose máu', category: 'Sinh hóa', unit: 'mmol/L', normalRange: '3.9 - 6.4', minNormal: 3.9, maxNormal: 6.4, panicLow: 2.8, panicHigh: 18.0 },
    { pattern: /\b(?:hba1c)\b[^\d]*?([\d.]+)/i, name: 'HbA1c', category: 'Sinh hóa', unit: '%', normalRange: '4.0 - 6.0', maxNormal: 6.0, panicHigh: 10.0 },
    { pattern: /\b(?:ure|urea)\b[^\d]*?([\d.]+)/i, name: 'Ure máu', category: 'Sinh hóa', unit: 'mmol/L', normalRange: '2.5 - 7.5', minNormal: 2.5, maxNormal: 7.5, panicHigh: 25.0 },
    { pattern: /\b(?:creatinine|cre)\b[^\d]*?([\d.]+)/i, name: 'Creatinine máu', category: 'Sinh hóa', unit: 'µmol/L', normalRange: '53 - 106', minNormal: 53, maxNormal: 106, panicHigh: 250.0 },
    { pattern: /\b(?:ast|got)\b[^\d]*?([\d.]+)/i, name: 'Men gan AST (GOT)', category: 'Sinh hóa', unit: 'U/L', normalRange: '< 37', maxNormal: 37, panicHigh: 500 },
    { pattern: /\b(?:alt|gpt)\b[^\d]*?([\d.]+)/i, name: 'Men gan ALT (GPT)', category: 'Sinh hóa', unit: 'U/L', normalRange: '< 40', maxNormal: 40, panicHigh: 500 },
    { pattern: /\b(?:ggt)\b[^\d]*?([\d.]+)/i, name: 'Men gan GGT', category: 'Sinh hóa', unit: 'U/L', normalRange: '9 - 48', minNormal: 9, maxNormal: 48 },
    { pattern: /\b(?:bilirubin\s*(?:tp|toàn\s*phần)|bili\s*tp)\b[^\d]*?([\d.]+)/i, name: 'Bilirubin toàn phần', category: 'Sinh hóa', unit: 'µmol/L', normalRange: '< 21', maxNormal: 21, panicHigh: 85 },
    { pattern: /\b(?:albumin|alb)\b[^\d]*?([\d.]+)/i, name: 'Albumin máu', category: 'Sinh hóa', unit: 'g/L', normalRange: '35 - 52', minNormal: 35, maxNormal: 52, panicLow: 25 },
    { pattern: /\b(?:acid\s*uric|uric)\b[^\d]*?([\d.]+)/i, name: 'Acid Uric máu', category: 'Sinh hóa', unit: 'µmol/L', normalRange: '200 - 420', minNormal: 200, maxNormal: 420 },
    { pattern: /\b(?:crp|crp-hs)\b[^\d]*?([\d.]+)/i, name: 'Protein phản ứng C (CRP)', category: 'Sinh hóa', unit: 'mg/L', normalRange: '< 5.0', maxNormal: 5.0, panicHigh: 100 },
    { pattern: /\b(?:procalcitonin|pct)\b[^\d]*?([\d.]+)/i, name: 'Procalcitonin (PCT)', category: 'Sinh hóa', unit: 'ng/mL', normalRange: '< 0.05', maxNormal: 0.05, panicHigh: 2.0 },
    { pattern: /\b(?:troponin(?:\s*t|\s*i|\s*hs)?)\b[^\d]*?([\d.]+)/i, name: 'Men tim Troponin hs', category: 'Sinh hóa', unit: 'ng/L', normalRange: '< 14', maxNormal: 14, panicHigh: 50 },
    { pattern: /\b(?:ck-mb|ckmb)\b[^\d]*?([\d.]+)/i, name: 'Men tim CK-MB', category: 'Sinh hóa', unit: 'U/L', normalRange: '< 25', maxNormal: 25, panicHigh: 80 },
    { pattern: /\b(?:bnp|nt-probnp)\b[^\d]*?([\d.]+)/i, name: 'NT-proBNP / BNP', category: 'Sinh hóa', unit: 'pg/mL', normalRange: '< 125', maxNormal: 125, panicHigh: 1000 },

    // Điện giải
    { pattern: /\b(?:k\+|kali)\b[^\d]*?([\d.]+)/i, name: 'Kali máu (K+)', category: 'Điện giải', unit: 'mmol/L', normalRange: '3.5 - 5.0', minNormal: 3.5, maxNormal: 5.0, panicLow: 3.0, panicHigh: 5.5 },
    { pattern: /\b(?:na\+|natri)\b[^\d]*?([\d.]+)/i, name: 'Natri máu (Na+)', category: 'Điện giải', unit: 'mmol/L', normalRange: '135 - 145', minNormal: 135, maxNormal: 145, panicLow: 125, panicHigh: 155 },
    { pattern: /\b(?:cl-|clo|chloride)\b[^\d]*?([\d.]+)/i, name: 'Clo máu (Cl-)', category: 'Điện giải', unit: 'mmol/L', normalRange: '98 - 106', minNormal: 98, maxNormal: 106 },
    { pattern: /\b(?:ca(?:\+\+|2\+|[\s_]tp|[\s_]toàn\s*phần))\b[^\d]*?([\d.]+)/i, name: 'Canxi toàn phần', category: 'Điện giải', unit: 'mmol/L', normalRange: '2.15 - 2.55', minNormal: 2.15, maxNormal: 2.55, panicLow: 1.6, panicHigh: 3.0 },

    // Khí máu động mạch
    { pattern: /\b(?:ph\s*máu|khí\s*máu\s*ph)\b[^\d]*?([\d.]+)/i, name: 'pH máu (Khí máu)', category: 'Khí máu', unit: '', normalRange: '7.35 - 7.45', minNormal: 7.35, maxNormal: 7.45, panicLow: 7.20, panicHigh: 7.60 },
    { pattern: /\b(?:pco2)\b[^\d]*?([\d.]+)/i, name: 'pCO2 (Khí máu)', category: 'Khí máu', unit: 'mmHg', normalRange: '35 - 45', minNormal: 35, maxNormal: 45, panicLow: 20, panicHigh: 70 },
    { pattern: /\b(?:po2)\b[^\d]*?([\d.]+)/i, name: 'pO2 (Khí máu)', category: 'Khí máu', unit: 'mmHg', normalRange: '80 - 100', minNormal: 80, panicLow: 60 },
    { pattern: /\b(?:hco3-?)\b[^\d]*?([\d.]+)/i, name: 'HCO3- (Khí máu)', category: 'Khí máu', unit: 'mmol/L', normalRange: '22 - 26', minNormal: 22, maxNormal: 26, panicLow: 15, panicHigh: 40 },
  ];

  // 1. Quét theo các chỉ số số học đã định nghĩa
  LAB_DEFINITIONS.forEach((def, idx) => {
    const match = text.match(def.pattern);
    if (match && match[1]) {
      const valNum = parseFloat(match[1]);
      if (!isNaN(valNum)) {
        let isAbnormal = false;
        let isPanic = false;

        if (def.panicLow !== undefined && valNum < def.panicLow) {
          isPanic = true;
          isAbnormal = true;
        } else if (def.panicHigh !== undefined && valNum > def.panicHigh) {
          isPanic = true;
          isAbnormal = true;
        } else if (def.minNormal !== undefined && valNum < def.minNormal) {
          isAbnormal = true;
        } else if (def.maxNormal !== undefined && valNum > def.maxNormal) {
          isAbnormal = true;
        }

        results.push({
          id: `lab-parsed-${idx}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          timestamp: timeStr,
          category: def.category,
          testName: def.name,
          value: match[1],
          unit: def.unit,
          normalRange: def.normalRange,
          isAbnormal,
          isPanicValue: isPanic,
        });
      }
    }
  });

  // 2. Quét các xét nghiệm định tính / Test nhanh vi sinh
  if (/dengue|ns1/i.test(text)) {
    const isPos = /dương|pos|\(\+\)/i.test(text);
    results.push({
      id: `lab-dengue-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: timeStr,
      category: 'Huyết học',
      testName: 'Test nhanh Dengue NS1Ag',
      value: isPos ? 'DƯƠNG TÍNH (+)' : 'ÂM TÍNH (-)',
      unit: '',
      normalRange: 'Âm tính (-)',
      isAbnormal: isPos,
      isPanicValue: false, // Không phải panic value báo động đỏ
    });
  }

  // 3. Quét CĐHA: X-Quang, Siêu âm, ECG, CT-Scanner
  const xquangMatch = text.match(/(?:x-?quang|xquang)[^:\n]*:([^\n;.]+)/i);
  if (xquangMatch && xquangMatch[1]) {
    const desc = xquangMatch[1].trim();
    const isAbn = /dày|ứ huyết|bóng tim|thâm nhiễm|tràn dịch|gãy|tổn thương/i.test(desc);
    results.push({
      id: `lab-xq-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: timeStr,
      category: 'CĐHA',
      testName: 'X-Quang ngực thẳng',
      value: desc,
      unit: '',
      normalRange: 'Bình thường',
      isAbnormal: isAbn,
      isPanicValue: /tràn khí|phù phổi cấp/i.test(desc),
    });
  }

  const ecgMatch = text.match(/(?:ecg|điện\s*tâm\s*đồ)[^:\n]*:([^\n;.]+)/i);
  if (ecgMatch && ecgMatch[1]) {
    const desc = ecgMatch[1].trim();
    const isAbn = /rung nhĩ|st chênh|thiếu máu|ngoại tâm thu|nhanh xoang|block/i.test(desc);
    results.push({
      id: `lab-ecg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: timeStr,
      category: 'CĐHA',
      testName: 'Điện tâm đồ (ECG)',
      value: desc,
      unit: '',
      normalRange: 'Nhịp xoang đều',
      isAbnormal: isAbn,
      isPanicValue: /st chênh lên|rung thất|nhanh thất|block nhĩ thất độ 3/i.test(desc),
    });
  }

  const saMatch = text.match(/(?:siêu\s*âm|sa\s*tim|sa\s*ổ\s*bụng)[^:\n]*:([^\n;.]+)/i);
  if (saMatch && saMatch[1]) {
    const desc = saMatch[1].trim();
    results.push({
      id: `lab-sa-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: timeStr,
      category: 'CĐHA',
      testName: 'Siêu âm',
      value: desc,
      unit: '',
      normalRange: 'Không ghi nhận bất thường',
      isAbnormal: /huyết khối|dịch|sỏi|giãn|hẹp/i.test(desc),
      isPanicValue: /huyết khối/i.test(desc),
    });
  }

  const ctMatch = text.match(/(?:ct-?scanner|chụp\s*ct|cắt\s*lớp)[^:\n]*:([^\n;.]+)/i);
  if (ctMatch && ctMatch[1]) {
    const desc = ctMatch[1].trim();
    results.push({
      id: `lab-ct-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: timeStr,
      category: 'CĐHA',
      testName: 'Chụp CT-Scanner',
      value: desc,
      unit: '',
      normalRange: 'Bình thường',
      isAbnormal: /xuất huyết|nhồi máu|u|gãy|dịch|tổn thương/i.test(desc),
      isPanicValue: /xuất huyết não|nhồi máu não diện rộng|chèn ép/i.test(desc),
    });
  }

  return results;
}

/**
 * TÍNH NĂNG 'PHÂN LOẠI BỆNH ÁN AI' (Auto Triage & Clinical Auto-Tagging)
 * Tự động phân tích toàn diện diễn tiến lâm sàng, sinh hiệu và cận lâm sàng
 * để tự động phân tầng mức độ (NẶNG, TRUNG BÌNH, ỔN ĐỊNH) và tự động gắn nhãn
 * (Thở Oxy, Vận Mạch, Theo Dõi Sát, Dị Ứng, Nguy Cơ Xuất Huyết, Nguy Cơ Ngã, Nhịn Ăn NPO, Mới Vào Viện).
 */
export function autoClassifyAndTagPatient(patient: Patient): {
  severity: SeverityLevel;
  tags: ClinicalTag[];
  admissionStatus?: AdmissionDischargeStatus;
  reasons: string[];
} {
  const reasons: string[] = [];
  const tagsSet = new Set<ClinicalTag>(patient.tags || []);
  let suggestedSeverity: SeverityLevel = patient.severity || 'STABLE';

  // Gom toàn bộ văn bản lâm sàng để phân tích ngữ nghĩa
  const allText = [
    patient.primaryDiagnosis || '',
    patient.secondaryDiagnosis || '',
    patient.medicalHistory || '',
    patient.allergies || '',
    patient.importantNotes || '',
    patient.treatmentPlan || '',
    patient.initialLabsText || '',
    ...(patient.evolutions || []).map((e) => `${e.clinicalNote} ${e.treatmentAction}`),
  ].join(' ').toLowerCase();

  // 1. Phân tích Dị ứng thuốc
  if (
    patient.allergies &&
    !/không|chưa ghi nhận|chưa rõ/i.test(patient.allergies.trim()) &&
    patient.allergies.trim().length > 2
  ) {
    tagsSet.add('ALLERGY');
    reasons.push(`Gắn nhãn [Dị Ứng]: Tiền sử dị ứng ghi nhận "${patient.allergies}"`);
  }

  // 2. Phân tích Thở Oxy (Canula, Mask, HFNC, BiPAP)
  if (/mask|thở\s*mask|oxy\s*mask/i.test(allText)) {
    tagsSet.add('O2_MASK');
    tagsSet.delete('O2_CANULA');
    reasons.push('Gắn nhãn [Thở Mask]: Diễn tiến ghi nhận bệnh nhân cần hỗ trợ thở Oxy qua Mask');
  } else if (/canula|kính|thở\s*oxy|o2|oxy\s*gọng/i.test(allText)) {
    tagsSet.add('O2_CANULA');
    reasons.push('Gắn nhãn [Thở Canula]: Bệnh nhân đang được hỗ trợ thở Oxy kính/gọng');
  }

  // 3. Phân tích Thuốc Vận Mạch (Noradrenalin, Adrenalin, Dopamin, Dobutamin...)
  if (/vận\s*mạch|noradrenalin|adrenalin|dopamin|dobutamin|vasopressor/i.test(allText)) {
    tagsSet.add('VASOPRESSOR');
    tagsSet.add('CLOSE_MONITORING');
    suggestedSeverity = 'CRITICAL';
    reasons.push('Gắn nhãn [Vận Mạch] & Nâng mức [NẶNG]: Đang sử dụng thuốc trợ tim/vận mạch');
  }

  // 4. Phân tích Nguy Cơ Xuất Huyết / Chảy Máu
  const lowPlt = (patient.labs || []).some((l) => {
    const num = parseFloat(String(l.value).replace(/[^0-9.]/g, ''));
    return l.testName.toLowerCase().includes('tiểu cầu') && !isNaN(num) && num < 50;
  });
  if (/xuất\s*huyết|chảy\s*máu|tiêu\s*phân\s*đen|nôn\s*ra\s*máu|loét\s*dạ\s*dày/i.test(allText) || lowPlt) {
    tagsSet.add('BLEEDING_RISK');
    reasons.push('Gắn nhãn [Nguy Cơ Xuất Huyết]: Có triệu chứng chảy máu hoặc tiểu cầu giảm sâu < 50 G/L');
  }

  // 5. Phân tích Nhịn Ăn (NPO)
  if (/nhịn\s*ăn|npo|nội\s*soi|can\s*thiệp|viêm\s*tụy\s*cấp/i.test(allText)) {
    tagsSet.add('FASTING_NPO');
    reasons.push('Gắn nhãn [Nhịn Ăn NPO]: Chỉ định nhịn ăn chuẩn bị thủ thuật hoặc viêm tụy');
  }

  // 6. Phân tích Nguy Cơ Ngã
  if (patient.age >= 75 || /tai\s*biến|yếu\s*nửa\s*người|chóng\s*mặt|ngã|sa\s*sút/i.test(allText)) {
    tagsSet.add('FALL_RISK');
    reasons.push('Gắn nhãn [Nguy Cơ Ngã]: Bệnh nhân cao tuổi (≥75t) hoặc có rối loạn thăng bằng/tai biến');
  }

  // 7. Phân tích Sinh Hiệu & Diễn Tiến Nguy Kịch (Độ nặng)
  const latestVital = patient.vitals?.[0];
  let isVitalsCritical = false;
  if (latestVital) {
    if (latestVital.bpSystolic > 0 && latestVital.bpSystolic < 90) {
      isVitalsCritical = true;
      reasons.push(`Cảnh báo tụt huyết áp: HA tâm thu ${latestVital.bpSystolic} mmHg < 90`);
    }
    if (latestVital.spO2 > 0 && latestVital.spO2 < 90) {
      isVitalsCritical = true;
      reasons.push(`Cảnh báo thiếu oxy máu: SpO2 ${latestVital.spO2}% < 90%`);
    }
    if (latestVital.heartRate > 0 && (latestVital.heartRate > 130 || latestVital.heartRate < 45)) {
      isVitalsCritical = true;
      reasons.push(`Cảnh báo rối loạn nhịp tim: Mạch ${latestVital.heartRate} l/p`);
    }
  }

  // Cận lâm sàng Panic values
  const hasPanicLabs = (patient.labs || []).some((l) => l.isPanicValue) ||
    /troponin.*tăng|k\+:?\s*[1256789]\.\d|hạ kali nặng|tăng kali nặng/i.test(patient.initialLabsText || '');

  if (isVitalsCritical || hasPanicLabs || /nguy\s*kịch|hôn\s*mê|sốc|phù\s*phổi\s*cấp|suy\s*hô\s*hấp\s*nặng/i.test(allText)) {
    suggestedSeverity = 'CRITICAL';
    tagsSet.add('CLOSE_MONITORING');
    reasons.push('Phân loại mức độ: [NẶNG / NGUY KỊCH] do có chỉ số báo động đỏ hoặc huyết động bất thường');
  } else if (tagsSet.has('O2_CANULA') || /trung\s*bình|theo\s*dõi\s*sát|sốt\s*cao|nhiễm\s*trùng/i.test(allText)) {
    if (suggestedSeverity !== 'CRITICAL') {
      suggestedSeverity = 'MODERATE';
      reasons.push('Phân loại mức độ: [TRUNG BÌNH] do cần hỗ trợ oxy hoặc theo dõi tích cực');
    }
  } else {
    if (suggestedSeverity !== 'CRITICAL' && suggestedSeverity !== 'MODERATE') {
      suggestedSeverity = 'STABLE';
    }
  }

  // 8. Trạng thái vào viện / ra viện
  let suggestedStatus = patient.admissionStatus;
  const today = new Date().toISOString().split('T')[0];
  if (patient.admissionDate && patient.admissionDate.startsWith(today)) {
    suggestedStatus = 'ADMITTED_TODAY';
    reasons.push('Gắn trạng thái: [Mới Vào Hôm Nay]');
  } else if (/ra\s*viện\s*hôm\s*nay|xuất\s*viện\s*hôm\s*nay/i.test(allText)) {
    suggestedStatus = 'DISCHARGE_TODAY';
    reasons.push('Gắn trạng thái: [Ra Viện Hôm Nay]');
  }

  return {
    severity: suggestedSeverity,
    tags: Array.from(tagsSet),
    admissionStatus: suggestedStatus,
    reasons,
  };
}

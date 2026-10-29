import { Patient, LabResult, ClinicalTag, SeverityLevel, AdmissionDischargeStatus } from '../types/patient';

/**
 * Trích xuất các cảnh báo cận lâm sàng bất thường nặng, nguy hiểm (Panic Values)
 * để cảnh báo ngay phía dưới Hướng xử trí / Kế hoạch điều trị.
 */
export function getCriticalLabAlerts(patient: Patient): string[] {
  const alerts: string[] = [];

  // 1. Kiểm tra mảng kết quả xét nghiệm (labs)
  if (patient.labs && patient.labs.length > 0) {
    patient.labs.forEach((lab) => {
      if (lab.isPanicValue) {
        alerts.push(`${lab.testName}: ${lab.value} ${lab.unit || ''} (Ngưỡng báo động đỏ)`);
      } else if (lab.isAbnormal) {
        const numVal = parseFloat(String(lab.value).replace(/[^0-9.]/g, ''));
        const nameLower = lab.testName.toLowerCase();

        if (nameLower.includes('k+') || nameLower.includes('kali')) {
          if (!isNaN(numVal) && (numVal < 3.0 || numVal > 5.5)) {
            alerts.push(`Kali máu (K+): ${lab.value} ${lab.unit || 'mmol/L'} (${numVal < 3.0 ? 'Hạ Kali máu nguy hiểm < 3.0' : 'Tăng Kali máu nguy hiểm > 5.5'})`);
          }
        } else if (nameLower.includes('na+') || nameLower.includes('natri')) {
          if (!isNaN(numVal) && (numVal < 125 || numVal > 155)) {
            alerts.push(`Natri máu (Na+): ${lab.value} ${lab.unit || 'mmol/L'} (Rối loạn điện giải nặng)`);
          }
        } else if (nameLower.includes('plt') || nameLower.includes('tiểu cầu') || nameLower.includes('platelet')) {
          if (!isNaN(numVal) && numVal < 50) {
            alerts.push(`Tiểu cầu (PLT): ${lab.value} G/L (Giảm tiểu cầu nặng < 50)`);
          }
        } else if (nameLower.includes('glucose') || nameLower.includes('đường huyết')) {
          if (!isNaN(numVal) && (numVal < 3.0 || numVal > 18)) {
            alerts.push(`Đường huyết: ${lab.value} mmol/L (${numVal < 3.0 ? 'Hạ đường huyết cấp < 3.0' : 'Tăng đường huyết cấp > 18'})`);
          }
        } else if (nameLower.includes('troponin') || nameLower.includes('ck-mb')) {
          alerts.push(`${lab.testName}: ${lab.value} (Tăng men tim - Nghi ngờ Hội chứng mạch vành cấp/NMCT)`);
        } else if (nameLower.includes('ns1') || nameLower.includes('dengue')) {
          if (/dương|pos|\+/i.test(lab.value)) {
            alerts.push(`Test NS1Ag / Dengue: DƯƠNG TÍNH (Sốt xuất huyết Dengue)`);
          }
        } else if (nameLower.includes('creatinine')) {
          if (!isNaN(numVal) && numVal > 200) {
            alerts.push(`Creatinine máu: ${lab.value} µmol/L (Tăng cao - Tổn thương thận cấp/Tăng Ure huyết)`);
          }
        } else if (nameLower.includes('wbc') || nameLower.includes('bạch cầu')) {
          if (!isNaN(numVal) && (numVal > 20 || numVal < 2.5)) {
            alerts.push(`Bạch cầu (WBC): ${lab.value} G/L (${numVal > 20 ? 'Tăng bạch cầu rất cao > 20 (Nhiễm trùng nặng)' : 'Giảm bạch cầu < 2.5'})`);
          }
        }
      }
    });
  }

  // 2. Kiểm tra văn bản CLS ban đầu (initialLabsText)
  if (patient.initialLabsText) {
    const text = patient.initialLabsText;

    if (/dengue.*dương tính|ns1.*dương tính|ns1ag.*\(\+\)|dengue.*\(\+\)/i.test(text)) {
      if (!alerts.some((a) => a.includes('Dengue') || a.includes('NS1'))) {
        alerts.push('Test Dengue NS1Ag: DƯƠNG TÍNH (Sốt xuất huyết Dengue)');
      }
    }
    if (/huyết khối/i.test(text)) {
      if (!alerts.some((a) => a.includes('huyết khối'))) {
        alerts.push('Hình ảnh siêu âm/CĐHA: Phát hiện Huyết Khối Mạch Máu');
      }
    }
    if (/hẹp\s*(khoảng\s*)?4\d%|hẹp\s*(khoảng\s*)?[5-9]\d%|hẹp nặng|hẹp\s*khảo\s*sát\s*đm/i.test(text)) {
      const matchHep = text.match(/hẹp\s*[^;\.\n]+/i);
      if (!alerts.some((a) => a.includes('Hẹp'))) {
        alerts.push(matchHep ? matchHep[0].trim() : 'Hẹp lòng động mạch đáng kể');
      }
    }
    if (/platelets[^:]*:\s*([1-4]\d)\b|tiểu cầu[^:]*:\s*([1-4]\d)\b/i.test(text)) {
      const matchPlt = text.match(/(?:platelets|tiểu cầu)[^:]*:\s*([1-4]\d)\b/i);
      if (matchPlt && !alerts.some((a) => a.includes('Tiểu cầu'))) {
        alerts.push(`Tiểu cầu (PLT) giảm thấp nguy hiểm: ${matchPlt[1]} G/L`);
      }
    }
    if (/k\+:\s*([12]\.\d+)\b|kali:\s*([12]\.\d+)\b/i.test(text)) {
      const matchK = text.match(/(?:k\+|kali):\s*([12]\.\d+)\b/i);
      if (matchK && !alerts.some((a) => a.includes('Kali'))) {
        alerts.push(`Hạ Kali máu nguy hiểm: K+ = ${matchK[1]} mmol/L`);
      }
    }
    if (/k\+:\s*([5-9]\.\d+)\b|kali:\s*([5-9]\.\d+)\b/i.test(text)) {
      const matchK = text.match(/(?:k\+|kali):\s*([5-9]\.\d+)\b/i);
      if (matchK && !alerts.some((a) => a.includes('Kali'))) {
        alerts.push(`Tăng Kali máu nguy hiểm: K+ = ${matchK[1]} mmol/L`);
      }
    }
    if (/troponin.*dương tính|troponin.*tăng/i.test(text)) {
      if (!alerts.some((a) => a.includes('Troponin'))) {
        alerts.push('Men tim Troponin tăng - Cảnh báo Nhồi máu cơ tim / Hội chứng mạch vành cấp');
      }
    }
  }

  // 3. Cảnh báo mức độ nghiêm trọng từ AI Analysis (nếu có)
  if (patient.aiAnalysis?.clinicalAlerts) {
    patient.aiAnalysis.clinicalAlerts
      .filter((a) => a.type === 'critical')
      .forEach((a) => {
        if (!alerts.includes(a.message)) {
          alerts.push(a.message);
        }
      });
  }

  return Array.from(new Set(alerts));
}

/**
 * Tự động phân tích văn bản kết quả Cận Lâm Sàng sao chép từ HIS / Bệnh án
 * và chuyển đổi thành danh sách đối tượng xét nghiệm chuẩn hóa (LabResult)
 */
export function parseRawLabsText(text: string, defaultTimestamp?: string): LabResult[] {
  if (!text || !text.trim()) return [];

  const now = new Date();
  const timeStr = defaultTimestamp || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
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
    { pattern: /\b(?:wbc|bạch\s*cầu)\b[^\d]*?([\d.]+)/i, name: 'Bạch cầu (WBC)', category: 'Huyết học', unit: 'G/L', normalRange: '4.0 - 10.0', minNormal: 4.0, maxNormal: 10.0, panicLow: 2.5, panicHigh: 20.0 },
    { pattern: /\b(?:rbc|hồng\s*cầu)\b[^\d]*?([\d.]+)/i, name: 'Hồng cầu (RBC)', category: 'Huyết học', unit: 'T/L', normalRange: '3.8 - 5.5', minNormal: 3.8, maxNormal: 5.5, panicLow: 2.5, panicHigh: 6.5 },
    { pattern: /\b(?:hgb|hb|huyết\s*sắc\s*tố)\b[^\d]*?([\d.]+)/i, name: 'Huyết sắc tố (HGB)', category: 'Huyết học', unit: 'g/L', normalRange: '120 - 160', minNormal: 120, maxNormal: 160, panicLow: 70, panicHigh: 200 },
    { pattern: /\b(?:hct|hematocrit)\b[^\d]*?([\d.]+)/i, name: 'Hematocrit (HCT)', category: 'Huyết học', unit: '%', normalRange: '35 - 47', minNormal: 35, maxNormal: 47, panicLow: 20, panicHigh: 55 },
    { pattern: /\b(?:plt|tiểu\s*cầu|platelets?)\b[^\d]*?([\d.]+)/i, name: 'Tiểu cầu (PLT)', category: 'Huyết học', unit: 'G/L', normalRange: '150 - 450', minNormal: 150, maxNormal: 450, panicLow: 50, panicHigh: 1000 },
    { pattern: /\b(?:neu%?|neutrophil%?)\b[^\d]*?([\d.]+)/i, name: 'Bạch cầu đa nhân trung tính (NEU%)', category: 'Huyết học', unit: '%', normalRange: '43 - 75', minNormal: 43, maxNormal: 75 },
    { pattern: /\b(?:lym%?|lymphocyte%?)\b[^\d]*?([\d.]+)/i, name: 'Bạch cầu Lympho (LYM%)', category: 'Huyết học', unit: '%', normalRange: '17 - 48', minNormal: 17, maxNormal: 48 },
    { pattern: /\b(?:inr)\b[^\d]*?([\d.]+)/i, name: 'Đông máu (INR)', category: 'Huyết học', unit: '', normalRange: '0.8 - 1.2', minNormal: 0.8, maxNormal: 1.2, panicHigh: 4.5 },
    
    // Sinh hóa
    { pattern: /\b(?:glucose|đường\s*huyết)\b[^\d]*?([\d.]+)/i, name: 'Glucose máu', category: 'Sinh hóa', unit: 'mmol/L', normalRange: '3.9 - 6.4', minNormal: 3.9, maxNormal: 6.4, panicLow: 2.8, panicHigh: 18.0 },
    { pattern: /\b(?:ure|urea)\b[^\d]*?([\d.]+)/i, name: 'Ure máu', category: 'Sinh hóa', unit: 'mmol/L', normalRange: '2.5 - 7.5', minNormal: 2.5, maxNormal: 7.5, panicHigh: 25.0 },
    { pattern: /\b(?:creatinine|cre)\b[^\d]*?([\d.]+)/i, name: 'Creatinine máu', category: 'Sinh hóa', unit: 'µmol/L', normalRange: '53 - 106', minNormal: 53, maxNormal: 106, panicHigh: 250.0 },
    { pattern: /\b(?:ast|got)\b[^\d]*?([\d.]+)/i, name: 'Men gan AST (GOT)', category: 'Sinh hóa', unit: 'U/L', normalRange: '< 37', maxNormal: 37, panicHigh: 500 },
    { pattern: /\b(?:alt|gpt)\b[^\d]*?([\d.]+)/i, name: 'Men gan ALT (GPT)', category: 'Sinh hóa', unit: 'U/L', normalRange: '< 40', maxNormal: 40, panicHigh: 500 },
    { pattern: /\b(?:ggt)\b[^\d]*?([\d.]+)/i, name: 'Men gan GGT', category: 'Sinh hóa', unit: 'U/L', normalRange: '9 - 48', minNormal: 9, maxNormal: 48 },
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
          id: `lab-parsed-${idx}-${Date.now()}`,
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
      id: `lab-dengue-${Date.now()}`,
      timestamp: timeStr,
      category: 'Huyết học',
      testName: 'Test nhanh Dengue NS1Ag',
      value: isPos ? 'DƯƠNG TÍNH (+)' : 'ÂM TÍNH (-)',
      unit: '',
      normalRange: 'Âm tính (-)',
      isAbnormal: isPos,
      isPanicValue: isPos,
    });
  }

  // 3. Quét CĐHA: X-Quang, Siêu âm, ECG
  const xquangMatch = text.match(/(?:x-?quang|xquang)[^:\n]*:([^\n;.]+)/i);
  if (xquangMatch && xquangMatch[1]) {
    const desc = xquangMatch[1].trim();
    const isAbn = /dày|ứ huyết|bóng tim|thâm nhiễm|tràn dịch|gãy|tổn thương/i.test(desc);
    results.push({
      id: `lab-xq-${Date.now()}`,
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
      id: `lab-ecg-${Date.now()}`,
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
      id: `lab-sa-${Date.now()}`,
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

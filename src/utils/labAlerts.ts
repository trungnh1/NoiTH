import { Patient } from '../types/patient';

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
        const numVal = parseFloat(lab.value.replace(/[^0-9.]/g, ''));
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

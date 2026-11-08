import { Patient, SeverityLevel, ClinicalTag, VitalSign, ClinicalEvolution } from '../types/patient';

/**
 * Kiểm tra xem chuỗi thông tin dị ứng có thực sự ghi nhận dị ứng hay không.
 * Trả về false nếu là các cụm từ phủ định thường gặp trong bệnh án (VD: "Không ghi nhận", "Chưa rõ", "Không có tiền sử dị ứng").
 */
export function isRealAllergy(allergyText?: string | null): boolean {
  if (!allergyText) return false;
  const clean = allergyText.trim().toLowerCase();
  if (!clean) return false;
  if (/^(không|chưa|k|ko|none|no|chưa ghi nhận|không ghi nhận|chưa rõ|không có|không rõ|chưa phát hiện|bình thường|không dị ứng|chưa thấy|chưa phát hiện thấy|thuốc|thức ăn)$/i.test(clean)) {
    return false;
  }
  if (/^(không|chưa|k|ko)\s+(có\s+)?(ghi\s+nhận\s+)?(tiền\s+sử\s+)?(bị\s+)?dị\s+ứng/i.test(clean)) {
    return false;
  }
  if (/^(không|chưa)\s+(phát\s+hiện|thấy|rõ)\s+(dị\s+ứng|tiền\s+sử)/i.test(clean)) {
    return false;
  }
  if (/không\s+(có\s+)?tiền\s+sử/i.test(clean) && !/dị\s+ứng\s+với/i.test(clean)) {
    return false;
  }
  return true;
}

export interface ParsedClinicalNote {
  fullName: string;
  age: number;
  gender: 'Nam' | 'Nữ';
  diagnosis: string;
  treatmentPlan: string;
  medicalHistory?: string;
  clinicalNote?: string;
  labFindings?: string;
  severity: SeverityLevel;
  suggestedTags: ClinicalTag[];
  initialVitals?: Partial<VitalSign>;
  rawText: string;
  confidence: number;
}

/**
 * Phân tích chuyên sâu văn bản bệnh án lâm sàng tiếng Việt
 * Khớp chính xác các định dạng bệnh án tiếp nhận tại BV Hùng Vương Gia Lai và các BV Việt Nam
 */
export function parseClinicalNoteRegex(text: string): ParsedClinicalNote {
  const clean = text.trim();
  const lower = clean.toLowerCase();

  // 1. Họ và tên
  let fullName = '';
  const nameRegex1 = /(?:họ\s*(?:và\s*)?tên|tên\s*bệnh\s*nhân|bệnh\s*nhân)\s*:\s*([^\n,;]+)/i;
  const nameMatch1 = clean.match(nameRegex1);
  if (nameMatch1 && nameMatch1[1]) {
    const rawName = nameMatch1[1].trim();
    // Bỏ qua nếu trúng phải "nam 61 tuổi" hay "nữ"
    if (!/^(?:nam|nữ|\d+)/i.test(rawName)) {
      fullName = rawName.toUpperCase();
    }
  }

  // 2. Tuổi và Giới tính
  let age = 50;
  let gender: 'Nam' | 'Nữ' = 'Nam';

  // Dạng 1: "Bệnh nhân nam 61 tuổi" hoặc "Bệnh nhân nam, 57 tuổi" hoặc "Bệnh nhân nữ 51 tuổi"
  const ageGenderRegex1 = /bệnh\s*nhân\s+(nam|nữ)[,\s]+(\d{1,3})\s*tuổi/i;
  const matchAG1 = clean.match(ageGenderRegex1);
  if (matchAG1) {
    gender = matchAG1[1].toLowerCase() === 'nữ' ? 'Nữ' : 'Nam';
    age = parseInt(matchAG1[2], 10);
  } else {
    // Dạng 2: "61 tuổi, nam" hoặc "nam, 61 tuổi"
    const ageGenderRegex2 = /(\d{1,3})\s*tuổi[,\s]+(nam|nữ)/i;
    const matchAG2 = clean.match(ageGenderRegex2);
    if (matchAG2) {
      age = parseInt(matchAG2[1], 10);
      gender = matchAG2[2].toLowerCase() === 'nữ' ? 'Nữ' : 'Nam';
    } else {
      const genderRegex = /(?:giới\s*tính|phái)\s*:\s*(nam|nữ)/i;
      const matchG = clean.match(genderRegex);
      if (matchG) gender = matchG[1].toLowerCase() === 'nữ' ? 'Nữ' : 'Nam';

      const ageRegex = /(\d{1,3})\s*tuổi/i;
      const matchA = clean.match(ageRegex);
      if (matchA) age = parseInt(matchA[1], 10);
    }
  }

  if (!fullName) {
    fullName = `BỆNH NHÂN (${age}T - ${gender.toUpperCase()})`;
  }

  // 3. Vấn Đề / Chẩn Đoán (Clinical Diagnosis)
  // Các mẫu: "* Vấn đề:", "** Vấn đề:", "Vấn đề:", "* Chẩn đoán:", "Chẩn đoán:"
  let diagnosis = '';
  const diagRegex = /(?:(?:\*{1,2}\s*)?(?:vấn đề|chẩn đoán|chẩn đoán sơ bộ|chẩn đoán vào viện|kết luận)\s*:)\s*([^\n*]+(?:\n(?!\s*(?:\*{1,2}|kế hoạch|hướng xử trí|tiền sử|bệnh sử|hiện|khám|cls|\+))[^\n*]+)*)/i;
  const diagMatch = clean.match(diagRegex);
  if (diagMatch && diagMatch[1]) {
    diagnosis = diagMatch[1]
      .replace(/^[-–—:\s]+/, '')
      .replace(/[\n\r]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  // 4. Kế Hoạch Điều Trị / Hướng Xử Trí (Treatment Plan)
  // Các mẫu: "* Kế hoạch:", "* Kế hoạch điều trị:", "** Hướng xử trí:", "Hướng xử trí:", "* Y lệnh:"
  let treatmentPlan = '';
  const planRegex = /(?:(?:\*{1,2}\s*)?(?:kế hoạch điều trị|kế hoạch|hướng xử trí|y lệnh|xử trí)\s*:)\s*([^\n*]+(?:\n(?!\s*(?:\*{1,2}|vấn đề|tiền sử|bệnh sử|hiện|khám|cls|\+))[^\n*]+)*)/i;
  const planMatch = clean.match(planRegex);
  if (planMatch && planMatch[1]) {
    treatmentPlan = planMatch[1]
      .replace(/^[-–—:\s]+/, '')
      .replace(/[\n\r]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  // 5. Tiền Sử (Medical History)
  // Các mẫu: "Tiền sử:", "TS:", "Tiền căn:"
  let medicalHistory = '';
  const historyRegex = /(?:(?:tiền sử|ts|tiền căn)\s*:)\s*([^\n]+(?:\n(?!\s*(?:bệnh sử|ldvv|lý do|hiện|khám|\*{1,2}|vấn đề|kế hoạch|\+))[^\n]+)*)/i;
  const historyMatch = clean.match(historyRegex);
  if (historyMatch && historyMatch[1]) {
    medicalHistory = historyMatch[1]
      .replace(/^[-–—:\s]+/, '')
      .replace(/[\n\r]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  // 6. Cận Lâm Sàng (CLS / Xét nghiệm / Hình ảnh học)
  const labLines: string[] = [];
  const lines = clean.split('\n');
  let inClsSection = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (/^(?:\*{1,2}\s*)?(?:cls|cận lâm sàng)\s*:/i.test(trimmedLine)) {
      inClsSection = true;
      continue;
    }
    if (inClsSection && /^(?:\*{1,2}\s*)?(?:vấn đề|kế hoạch|hướng xử trí)/i.test(trimmedLine)) {
      inClsSection = false;
    }

    if (inClsSection && trimmedLine) {
      labLines.push(trimmedLine);
    } else if (trimmedLine.startsWith('+') || trimmedLine.startsWith('- +')) {
      // Dòng kết quả CLS như: "+ Siêu âm Doppler...", "+ Chụp X-quang..."
      labLines.push(trimmedLine.replace(/^[-+\s]+/, '• '));
    }
  }

  const labFindings = labLines.join('\n');

  // 7. Diễn biến khám hiện tại (Clinical Course / Physical Exam)
  let clinicalNote = '';
  const examRegex = /(?:(?:hiện tại|hiện|khám hiện tại|khám)\s*:?)\s*([^\n]+(?:\n(?!\s*(?:cận lâm sàng|cls|\*{1,2}|vấn đề|kế hoạch|\+))[^\n]+)*)/i;
  const examMatch = clean.match(examRegex);
  if (examMatch && examMatch[1]) {
    clinicalNote = examMatch[1].trim();
  } else {
    // Tìm lý do vào viện / Bệnh sử
    const ldvvRegex = /(?:(?:ldvv|lý do vào viện|vào viện vì|vào vì)\s*:?)\s*([^\n]+)/i;
    const ldvvMatch = clean.match(ldvvRegex);
    if (ldvvMatch) {
      clinicalNote = `Lý do vào viện: ${ldvvMatch[1].trim()}`;
    }
  }

  // 8. Đánh giá mức độ nặng (Severity)
  let severity: SeverityLevel = 'STABLE';
  if (
    /cấp cứu|suy hô hấp|sốc|hôn mê|tụt huyết áp|huyết khối|nhồi máu|phù phổi|plt\s*<?\s*50|tiểu cầu\s*<?\s*50/i.test(clean)
  ) {
    severity = 'CRITICAL';
  } else if (
    /sốt cao|sốt xuất huyết|dengue|quặn cơn|sưng tím|hẹp \d+%/i.test(clean) ||
    /plt\s*<?\s*100|tiểu cầu\s*<?\s*100/i.test(clean)
  ) {
    severity = 'MODERATE';
  }

  // 9. Gợi ý gắn nhãn theo dõi (Suggested Tags)
  const suggestedTags: ClinicalTag[] = [];
  if (/thở oxy|spo2\s*<?\s*95|mask|canula/i.test(clean)) {
    suggestedTags.push('O2_CANULA');
  }
  if (/vận mạch|noradrenalin|adrenalin/i.test(clean)) {
    suggestedTags.push('VASOPRESSOR');
  }
  // Dị ứng: Chỉ gợi ý thẻ ALLERGY nếu có dị ứng thực tế, không gắn thẻ nếu ghi nhận "không dị ứng", "chưa ghi nhận"
  const allergyMatch = clean.match(/(?:tiền sử dị ứng|dị ứng thuốc|dị ứng)[:\s]*([^\n.,;]+)/i);
  if (allergyMatch && allergyMatch[1]) {
    const val = allergyMatch[1].trim();
    const hasNegative = /(?:không|chưa|k|ko)\s+(?:có\s+)?(?:tiền\s+sử\s+)?(?:ghi\s+nhận\s+)?(?:bị\s+)?dị\s+ứng|không\s+dị\s+ứng|chưa\s+ghi\s+nhận|không\s+ghi\s+nhận|chưa\s+rõ/i.test(clean);
    if (!hasNegative && isRealAllergy(val)) {
      suggestedTags.push('ALLERGY');
    }
  } else if (
    /dị ứng|allergy/i.test(clean) &&
    !/(?:không|chưa|k|ko)\s+(?:có\s+)?(?:tiền\s+sử\s+)?(?:ghi\s+nhận\s+)?(?:bị\s+)?dị\s+ứng|không\s+dị\s+ứng|chưa\s+ghi\s+nhận|không\s+ghi\s+nhận|chưa\s+rõ/i.test(clean)
  ) {
    suggestedTags.push('ALLERGY');
  }
  if (/té ngã|nguy cơ ngã/i.test(clean)) {
    suggestedTags.push('FALL_RISK');
  }
  if (/theo dõi sát|dấu hiệu cảnh báo|dhcb/i.test(clean)) {
    suggestedTags.push('CLOSE_MONITORING');
  }
  if (/sonde dạ dày/i.test(clean)) {
    suggestedTags.push('NG_TUBE');
  }
  if (/sonde tiểu|foley/i.test(clean)) {
    suggestedTags.push('FOLEY');
  }

  return {
    fullName,
    age,
    gender,
    diagnosis: diagnosis || 'Theo dõi bệnh nội khoa (Cần bổ sung)',
    treatmentPlan: treatmentPlan || 'Theo dõi sinh hiệu, cận lâm sàng và phác đồ nội khoa.',
    medicalHistory: medicalHistory || undefined,
    clinicalNote: clinicalNote || undefined,
    labFindings: labFindings || undefined,
    severity,
    suggestedTags,
    rawText: text,
    confidence: diagnosis && treatmentPlan ? 0.95 : diagnosis ? 0.8 : 0.6,
  };
}

/**
 * Prompt chuẩn mực tối ưu cho Gemini & DeepSeek khi phân tích bệnh án
 */
export const CLINICAL_EXTRACTION_SYSTEM_PROMPT = `Bạn là một bác sĩ nội khoa cao cấp chuyên phân tích và bóc tách dữ liệu bệnh án tiếp nhận vào viện tại Việt Nam.
Nhiệm vụ của bạn là đọc nội dung tóm tắt bệnh án tiếng Việt và trích xuất thành đối tượng JSON chính xác với cấu trúc sau:
{
  "fullName": "Họ và tên bệnh nhân viết hoa (nếu không có thì để rỗng hoặc BỆNH NHÂN)",
  "age": 60 (số nguyên tuổi),
  "gender": "Nam" hoặc "Nữ",
  "diagnosis": "Chẩn đoán bệnh / Vấn đề lâm sàng đầy đủ nhất (lấy từ mục Vấn đề hoặc Chẩn đoán)",
  "treatmentPlan": "Kế hoạch điều trị / Hướng xử trí / Y lệnh thuốc",
  "medicalHistory": "Tiền sử bệnh lý",
  "clinicalNote": "Tóm tắt diễn biến khám hiện tại và lý do vào viện",
  "labFindings": "Tóm tắt kết quả cận lâm sàng, X-quang, siêu âm, xét nghiệm máu nổi bật",
  "severity": "CRITICAL" (Nặng/Nguy kịch) hoặc "MODERATE" (Trung bình) hoặc "STABLE" (Ổn định),
  "suggestedTags": ["O2_CANULA", "VASOPRESSOR", "CLOSE_MONITORING", "ALLERGY", "FALL_RISK"]
}
Chỉ trả về JSON thuần túy, không bọc trong markdown hay text giải thích thừa.`;

export interface QuickVitalsResult {
  bpSys: string;
  bpDia: string;
  pulse: string;
  temperature: string;
  spO2: string;
}

/**
 * Phân tích chuỗi sinh hiệu nhập nhanh một dòng của bác sĩ lâm sàng
 * Ví dụ: '130/80 82 98 37' hoặc 'HA 140/90, M 85, SpO2 96%, T 37.2'
 */
export function parseQuickVitals(rawText: string): QuickVitalsResult {
  const result: QuickVitalsResult = {
    bpSys: '',
    bpDia: '',
    pulse: '',
    temperature: '',
    spO2: '',
  };
  if (!rawText || !rawText.trim()) return result;
  let text = rawText.trim();

  // 1. Nhận diện Huyết Áp (120/80, 120-80, HA: 130/80, 140/90)
  const bpMatch = text.match(/(?:ha|bp)?\s*[:=]?\s*(\d{2,3})\s*[/\\-]\s*(\d{2,3})/i);
  if (bpMatch) {
    result.bpSys = bpMatch[1];
    result.bpDia = bpMatch[2];
    text = text.replace(bpMatch[0], ' ');
  }

  // 2. Nhận diện Nhiệt Độ (T: 37, Nhiệt 37.5, 37.2°C, 36.8)
  const tempExplicitMatch = text.match(/(?:t|temp|nhi[eệ]t(?: độ)?)\s*[:=]?\s*(\d{2}(?:[.,]\d+)?)\s*(?:°?c|độ)?/i);
  if (tempExplicitMatch) {
    result.temperature = tempExplicitMatch[1].replace(',', '.');
    text = text.replace(tempExplicitMatch[0], ' ');
  } else {
    const tempUnitMatch = text.match(/(\d{2}(?:[.,]\d+)?)\s*(?:°c|°|độ)/i);
    if (tempUnitMatch) {
      result.temperature = tempUnitMatch[1].replace(',', '.');
      text = text.replace(tempUnitMatch[0], ' ');
    } else {
      const tempDecimalMatch = text.match(/\b(3[4-9](?:[.,]\d+)|4[0-2](?:[.,]\d+))\b/);
      if (tempDecimalMatch) {
        result.temperature = tempDecimalMatch[1].replace(',', '.');
        text = text.replace(tempDecimalMatch[0], ' ');
      }
    }
  }

  // 3. Nhận diện SpO2 (SpO2 98%, 98%, O2 96)
  const spo2ExplicitMatch = text.match(/(?:spo2|sp02|o2|oxy)\s*[:=]?\s*(\d{2,3})\s*%?/i);
  if (spo2ExplicitMatch) {
    result.spO2 = spo2ExplicitMatch[1];
    text = text.replace(spo2ExplicitMatch[0], ' ');
  } else {
    const spo2PercentMatch = text.match(/\b(\d{2,3})\s*%/);
    if (spo2PercentMatch) {
      result.spO2 = spo2PercentMatch[1];
      text = text.replace(spo2PercentMatch[0], ' ');
    }
  }

  // 4. Nhận diện Mạch (Mạch 80, M 80, P 80, HR 80)
  const pulseExplicitMatch = text.match(/(?:m[aạ]ch|pulse|hr|m|p)\s*[:=]?\s*(\d{2,3})\s*(?:l\/p|l\/ph|bpm)?/i);
  if (pulseExplicitMatch) {
    result.pulse = pulseExplicitMatch[1];
    text = text.replace(pulseExplicitMatch[0], ' ');
  }

  // 5. Phân tích các số còn lại theo dải sinh lý nội khoa
  const remainingNumbers = (text.match(/\b\d+(?:[.,]\d+)?\b/g) || []).map((n) => n.replace(',', '.'));

  for (const numStr of remainingNumbers) {
    const num = parseFloat(numStr);
    if (isNaN(num)) continue;

    // Số thập phân trong khoảng nhiệt độ 35.0 - 42.0
    if (!result.temperature && num >= 35.0 && num <= 42.0 && numStr.includes('.')) {
      result.temperature = String(num);
      continue;
    }

    // Nếu chưa có HA
    if (!result.bpSys && num >= 80 && num <= 240) {
      result.bpSys = String(Math.round(num));
      continue;
    }
    if (result.bpSys && !result.bpDia && num >= 40 && num <= 140) {
      result.bpDia = String(Math.round(num));
      continue;
    }

    // Mạch thông thường 45 - 180
    if (!result.pulse && num >= 45 && num <= 180) {
      result.pulse = String(Math.round(num));
      continue;
    }

    // SpO2 thông thường 80 - 100
    if (!result.spO2 && num >= 80 && num <= 100) {
      result.spO2 = String(Math.round(num));
      continue;
    }

    // Nhiệt độ nguyên 35 - 42 (VD: 37, 38)
    if (!result.temperature && num >= 35 && num <= 42) {
      result.temperature = String(num);
      continue;
    }
  }

  return result;
}

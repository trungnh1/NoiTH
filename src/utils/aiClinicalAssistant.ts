import { Patient, SeverityLevel, AdmissionDischargeStatus, LabResult } from '../types/patient';
import { parseRawLabsText } from './labAlerts';
import { isRealAllergy } from './clinicalTextParser';
import { loadAIConfig } from '../services/aiClinicalService';

export interface LabTrendItem {
  id: string;
  name: string;
  category: 'Huyết học' | 'Sinh hóa' | 'Điện giải' | 'Khí máu' | 'Khác';
  unit: string;
  normalRange: string;
  prevValue?: number;
  prevTimestamp?: string;
  currentValue: number;
  currentTimestamp?: string;
  trend: 'UP' | 'DOWN' | 'STABLE' | 'SINGLE';
  trendLabel: string;
  status: 'NORMAL' | 'WARNING' | 'CRITICAL';
  clinicalInterpretation: string;
}

export interface AIAnalysisOutput {
  // Điền đúng mục form
  fullName?: string;
  age?: number;
  gender?: 'Nam' | 'Nữ';
  roomNumber?: string;
  primaryDiagnosis?: string;
  treatmentPlan?: string;
  importantNotes?: string;
  handoverNotes?: string;
  severity?: SeverityLevel;
  admissionStatus?: AdmissionDischargeStatus;
  clinicalNote?: string;
  labsText?: string;
  
  // Tóm tắt bệnh án
  caseSummary: string;
  
  // Biểu dẫn thay đổi cận lâm sàng
  labTrends: LabTrendItem[];
  labSummaryText: string;
}

/**
 * Phân tích và sinh biểu dẫn thay đổi cận lâm sàng từ văn bản dán vào và dữ liệu bệnh nhân cũ (nếu có)
 */
export function extractLabTrends(
  pastedText: string,
  existingPatient?: Patient
): { trends: LabTrendItem[]; summaryText: string } {
  const currentBatchLabs = parseRawLabsText(pastedText);
  if (currentBatchLabs.length === 0 && (!existingPatient?.labs || existingPatient.labs.length === 0)) {
    return { trends: [], summaryText: '' };
  }

  // Tập hợp các kết quả xét nghiệm cũ của bệnh nhân (nếu có)
  const previousLabs = existingPatient?.labs || [];

  // Gom nhóm theo tên xét nghiệm để so sánh
  const labMap = new Map<string, { current?: LabResult; previous?: LabResult }>();

  // 1. Nếu văn bản dán vào có nhiều mốc thời gian (ví dụ Ngày 1 vs Ngày 2)
  // Sắp xếp các lab từ văn bản theo thời gian tăng dần
  const sortedCurrentLabs = [...currentBatchLabs].sort((a, b) => 
    (a.timestamp || '').localeCompare(b.timestamp || '')
  );

  sortedCurrentLabs.forEach((lab) => {
    const key = lab.testName.toLowerCase().trim();
    const existing = labMap.get(key);
    if (!existing) {
      labMap.set(key, { current: lab });
    } else {
      // Đã có 1 bản ghi trước đó trong văn bản -> bản ghi cũ thành previous, bản ghi mới thành current
      labMap.set(key, { previous: existing.current, current: lab });
    }
  });

  // 2. Với những lab chỉ có 1 kết quả trong văn bản dán vào, tìm xem bệnh nhân đã có kết quả cũ trước đó chưa
  labMap.forEach((entry, key) => {
    if (!entry.previous && previousLabs.length > 0) {
      const prev = previousLabs.find((p) => p.testName.toLowerCase().trim() === key);
      if (prev && prev.value !== entry.current?.value) {
        entry.previous = prev;
      }
    }
  });

  const trends: LabTrendItem[] = [];

  labMap.forEach((entry, _key) => {
    const cur = entry.current;
    if (!cur) return;

    const curNum = parseFloat(cur.value.replace(/[^0-9.]/g, ''));
    if (isNaN(curNum)) return;

    const prevNum = entry.previous ? parseFloat(entry.previous.value.replace(/[^0-9.]/g, '')) : undefined;
    const hasPrev = prevNum !== undefined && !isNaN(prevNum);

    let trend: 'UP' | 'DOWN' | 'STABLE' | 'SINGLE' = 'SINGLE';
    let trendLabel = 'Mới đo';

    if (hasPrev) {
      const delta = curNum - prevNum!;
      const percent = prevNum !== 0 ? Math.abs((delta / prevNum!) * 100) : 0;
      if (percent >= 4) {
        if (delta > 0) {
          trend = 'UP';
          trendLabel = `↗ Tăng (+${delta > 10 ? Math.round(delta) : delta.toFixed(1)})`;
        } else {
          trend = 'DOWN';
          trendLabel = `↘ Giảm (${delta < -10 ? Math.round(delta) : delta.toFixed(1)})`;
        }
      } else {
        trend = 'STABLE';
        trendLabel = '➡️ Ổn định';
      }
    }

    // Đánh giá trạng thái
    const status: 'NORMAL' | 'WARNING' | 'CRITICAL' = cur.isPanicValue 
      ? 'CRITICAL' 
      : cur.isAbnormal 
      ? 'WARNING' 
      : 'NORMAL';

    // Đánh giá ý nghĩa lâm sàng
    const interp = evaluateClinicalInterpretation(cur.testName, curNum, prevNum, cur.unit, trend);

    trends.push({
      id: cur.id,
      name: cur.testName,
      category: cur.category,
      unit: cur.unit,
      normalRange: cur.normalRange,
      prevValue: hasPrev ? prevNum : undefined,
      prevTimestamp: entry.previous?.timestamp,
      currentValue: curNum,
      currentTimestamp: cur.timestamp,
      trend,
      trendLabel,
      status,
      clinicalInterpretation: interp,
    });
  });

  // Tạo chuỗi tóm tắt thay đổi cận lâm sàng ngắn gọn
  const summaryLines: string[] = [];
  trends.forEach((t) => {
    if (t.prevValue !== undefined) {
      summaryLines.push(`• ${t.name}: ${t.prevValue} ➔ ${t.currentValue} ${t.unit} (${t.trendLabel} - ${t.clinicalInterpretation})`);
    } else if (t.status !== 'NORMAL') {
      summaryLines.push(`• ${t.name}: ${t.currentValue} ${t.unit} (${t.clinicalInterpretation})`);
    }
  });

  const summaryText = summaryLines.join('\n');
  return { trends, summaryText };
}

/**
 * Đưa ra nhận định lâm sàng cho sự thay đổi hoặc giá trị chỉ số xét nghiệm
 */
function evaluateClinicalInterpretation(
  testName: string,
  cur: number,
  prev: number | undefined,
  unit: string,
  trend: 'UP' | 'DOWN' | 'STABLE' | 'SINGLE'
): string {
  const name = testName.toLowerCase();

  // 1. Bạch cầu (WBC)
  if (name.includes('bạch cầu') || name.includes('wbc')) {
    if (prev !== undefined) {
      if (trend === 'DOWN' && cur <= 10.0) return 'Bạch cầu hạ về bình thường, đáp ứng kháng sinh tốt';
      if (trend === 'DOWN') return 'Bạch cầu đang giảm dần';
      if (trend === 'UP') return 'Bạch cầu tăng, phản ứng viêm / nhiễm khuẩn tiến triển';
    }
    if (cur > 15.0) return 'Bạch cầu tăng cao, nhiễm khuẩn cấp';
    if (cur > 10.0) return 'Bạch cầu tăng nhẹ';
    if (cur < 4.0) return 'Bạch cầu giảm';
    return 'Bạch cầu trong giới hạn bình thường';
  }

  // 2. CRP (Protein phản ứng C)
  if (name.includes('crp')) {
    if (prev !== undefined) {
      if (trend === 'DOWN') return 'CRP giảm, phản ứng viêm hạ rõ rệt';
      if (trend === 'UP') return 'CRP tăng thêm, dấu hiệu viêm/nhiễm trùng tăng';
    }
    if (cur >= 100) return 'Nhiễm trùng nặng (CRP > 100 mg/L)';
    if (cur > 10) return 'Phản ứng viêm tăng';
    return 'CRP bình thường';
  }

  // 3. Tiểu cầu (PLT)
  if (name.includes('tiểu cầu') || name.includes('plt')) {
    if (prev !== undefined) {
      if (trend === 'UP' && prev < 150) return 'Tiểu cầu đang hồi phục tốt (giảm nguy cơ xuất huyết)';
      if (trend === 'DOWN' && cur < 100) return 'Tiểu cầu giảm, chú ý theo dõi xuất huyết';
    }
    if (cur < 50) return 'Tiểu cầu giảm nặng (< 50 G/L), báo động xuất huyết';
    if (cur < 150) return 'Tiểu cầu giảm';
    return 'Tiểu cầu bình thường';
  }

  // 4. Creatinine máu
  if (name.includes('creatinine') || name.includes('cre')) {
    if (prev !== undefined) {
      if (trend === 'DOWN') return 'Creatinine hạ, chức năng thận cải thiện';
      if (trend === 'UP') return 'Creatinine tăng, nguy cơ tổn thương thận cấp';
    }
    if (cur > 150) return 'Tăng Creatinine máu, giảm chức năng lọc cầu thận';
    if (cur > 110) return 'Creatinine tăng nhẹ';
    return 'Chức năng thận ổn định';
  }

  // 5. Glucose máu
  if (name.includes('glucose') || name.includes('đường')) {
    if (cur < 3.9) return 'Hạ đường huyết nguy hiểm, cần bù Glucose ngay';
    if (cur > 15.0) return 'Đường huyết tăng rất cao, cần chỉnh liều Insulin';
    if (cur > 7.8) return 'Đường huyết cao';
    return 'Đường huyết ổn định';
  }

  // 6. Kali máu (K+)
  if (name.includes('kali') || name.includes('k+')) {
    if (cur < 3.5) return 'Hạ kali máu, cần bù điện giải';
    if (cur > 5.2) return 'Tăng kali máu, nguy cơ loạn nhịp tim';
    return 'Điện giải Kali ổn định';
  }

  // 7. Natri máu (Na+)
  if (name.includes('natri') || name.includes('na+')) {
    if (cur < 130) return 'Hạ natri máu';
    if (cur > 150) return 'Tăng natri máu';
    return 'Điện giải Natri ổn định';
  }

  // 8. Men gan (AST / ALT)
  if (name.includes('ast') || name.includes('alt') || name.includes('men gan')) {
    if (prev !== undefined && trend === 'DOWN') return 'Men gan giảm dần, tế bào gan hồi phục';
    if (cur > 200) return 'Men gan tăng cao, tổn thương tế bào gan';
    if (cur > 50) return 'Men gan tăng nhẹ';
    return 'Men gan bình thường';
  }

  // 9. Men tim (Troponin / CK-MB / BNP)
  if (name.includes('troponin') || name.includes('ck-mb') || name.includes('bnp')) {
    if (cur > 50) return 'Men tim/Dấu ấn suy tim tăng, cần theo dõi sát tim mạch';
    return 'Chỉ số tim mạch ổn định';
  }

  if (trend === 'UP') return `Tăng so với trước (${cur} ${unit})`;
  if (trend === 'DOWN') return `Giảm so với trước (${cur} ${unit})`;
  return `Giá trị hiện tại: ${cur} ${unit}`;
}

/**
 * Phân tích chuyên sâu toàn bộ văn bản bệnh án dán vào bằng AI / Regex
 * và trích xuất đúng các trường thông tin, tóm tắt bệnh án, và biểu dẫn cận lâm sàng
 */
export async function analyzeFullClinicalNote(
  rawText: string,
  existingPatient?: Patient
): Promise<AIAnalysisOutput> {
  const clean = rawText.trim();
  const lower = clean.toLowerCase();

  // 1. Phân tích bóc tách các trường cơ bản bằng regex chuyên sâu
  // 1.1 Họ và tên
  let fullName = existingPatient?.fullName || '';
  const nameMatch = clean.match(/(?:họ\s*(?:và\s*)?tên|tên\s*bệnh\s*nhân|bệnh\s*nhân|bn)\s*:\s*([^\n,;]+)/i);
  if (nameMatch && nameMatch[1]) {
    const rawName = nameMatch[1].trim();
    if (!/^(?:nam|nữ|\d+)/i.test(rawName)) {
      fullName = rawName.toUpperCase();
    }
  }

  // 1.2 Tuổi & Giới tính
  let age = existingPatient?.age || 60;
  let gender: 'Nam' | 'Nữ' = existingPatient?.gender || 'Nam';
  const ageGenderMatch = clean.match(/bệnh\s*nhân\s+(nam|nữ)[,\s]+(\d{1,3})\s*tuổi/i) ||
                         clean.match(/(?:bn|bệnh\s*nhân)\s*:\s*[^\n,;]+,\s*(nam|nữ)[,\s]+(\d{1,3})\s*tuổi/i) ||
                         clean.match(/(\d{1,3})\s*tuổi[,\s]+(nam|nữ)/i);
  if (ageGenderMatch) {
    if (/\d/.test(ageGenderMatch[1])) {
      age = parseInt(ageGenderMatch[1], 10);
      gender = ageGenderMatch[2].toLowerCase() === 'nữ' ? 'Nữ' : 'Nam';
    } else {
      gender = ageGenderMatch[1].toLowerCase() === 'nữ' ? 'Nữ' : 'Nam';
      age = parseInt(ageGenderMatch[2], 10);
    }
  } else {
    const gMatch = clean.match(/(?:giới\s*tính|phái)\s*:\s*(nam|nữ)/i);
    if (gMatch) gender = gMatch[1].toLowerCase() === 'nữ' ? 'Nữ' : 'Nam';
    const aMatch = clean.match(/(\d{1,3})\s*tuổi/i);
    if (aMatch) age = parseInt(aMatch[1], 10);
  }

  // 1.3 Buồng / Phòng
  let roomNumber = existingPatient?.roomNumber || '';
  const roomMatch = clean.match(/(?:buồng|phòng|p\.?)\s*:?\s*(\d{2,4}[a-zA-Z]?)/i);
  if (roomMatch && roomMatch[1]) {
    roomNumber = roomMatch[1].trim();
  }

  // 1.4 Chẩn đoán hiện tại (Diagnosis)
  let primaryDiagnosis = existingPatient?.primaryDiagnosis || '';
  const diagMatch = clean.match(/(?:(?:\*{1,2}\s*)?(?:chẩn đoán hiện tại|chẩn đoán|chẩn đoán sơ bộ|vấn đề|kết luận|bệnh chính)\s*:)\s*([^\n*]+(?:\n(?!\s*(?:\*{1,2}|kế hoạch|hướng xử trí|tiền sử|bệnh sử|hiện|khám|cls|\+))[^\n*]+)*)/i);
  if (diagMatch && diagMatch[1]) {
    primaryDiagnosis = diagMatch[1]
      .replace(/^[-–—:\s]+/, '')
      .replace(/[\n\r]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  // 1.5 Hướng xử trí / Y lệnh điều trị (Treatment plan)
  let treatmentPlan = existingPatient?.treatmentPlan || '';
  const planMatch = clean.match(/(?:(?:\*{1,2}\s*)?(?:kế hoạch điều trị|kế hoạch|hướng xử trí|y lệnh|xử trí|điều trị)\s*:)\s*([^\n*]+(?:\n(?!\s*(?:\*{1,2}|vấn đề|chẩn đoán|tiền sử|bệnh sử|hiện|khám|cls|\+))[^\n*]+)*)/i);
  if (planMatch && planMatch[1]) {
    treatmentPlan = planMatch[1]
      .replace(/^[-–—:\s]+/, '')
      .replace(/[\n\r]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  // 1.6 Bàn giao ca trực (Handover notes)
  let handoverNotes = existingPatient?.handoverNotes || '';
  const handoverMatch = clean.match(/(?:(?:\*{1,2}\s*)?(?:bàn giao ca trực|bàn giao|dặn dò ca trực|dặn dò trực|ca trực|trực đêm)\s*:)\s*([^\n*]+(?:\n(?!\s*(?:\*{1,2}|vấn đề|chẩn đoán|kế hoạch|ghi chú))[^\n*]+)*)/i);
  if (handoverMatch && handoverMatch[1]) {
    handoverNotes = handoverMatch[1].replace(/[\n\r]+/g, ' ').trim();
  }

  // 1.7 Ghi chú bác sĩ (Important notes)
  let importantNotes = existingPatient?.importantNotes || '';
  const notesMatch = clean.match(/(?:(?:\*{1,2}\s*)?(?:ghi chú bác sĩ|ghi chú|lưu ý|chú ý|nhắc nhở)\s*:)\s*([^\n*]+(?:\n(?!\s*(?:\*{1,2}|vấn đề|chẩn đoán|kế hoạch|bàn giao))[^\n*]+)*)/i);
  if (notesMatch && notesMatch[1]) {
    importantNotes = notesMatch[1].replace(/[\n\r]+/g, ' ').trim();
  }

  // 1.8 Diễn tiến / Diễn biến lâm sàng
  let clinicalNote = '';
  const examMatch = clean.match(/(?:(?:\*{1,2}\s*)?(?:diễn tiến|diễn biến|hiện tại|hiện|khám hiện tại|khám|triệu chứng)\s*:?)\s*([^\n]+(?:\n(?!\s*(?:cận lâm sàng|cls|\*{1,2}|vấn đề|chẩn đoán|kế hoạch|bàn giao|\+))[^\n]+)*)/i);
  if (examMatch && examMatch[1]) {
    clinicalNote = examMatch[1].trim();
  } else {
    const ldvvMatch = clean.match(/(?:(?:lý do vào viện|vào viện vì|vào vì|ldvv)\s*:?)\s*([^\n]+)/i);
    if (ldvvMatch) {
      clinicalNote = `Lý do vào viện: ${ldvvMatch[1].trim()}`;
    }
  }

  // 1.9 Trích xuất phần Cận Lâm Sàng văn bản
  const labLines: string[] = [];
  const lines = clean.split('\n');
  let inClsSection = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(?:\*{1,2}\s*)?(?:cls|cận lâm sàng|xét nghiệm|kết quả xét nghiệm)\s*:/i.test(trimmed)) {
      inClsSection = true;
      continue;
    }
    if (inClsSection && /^(?:\*{1,2}\s*)?(?:vấn đề|chẩn đoán|kế hoạch|hướng xử trí|bàn giao|ghi chú)/i.test(trimmed)) {
      inClsSection = false;
    }
    if (inClsSection && trimmed) {
      labLines.push(trimmed);
    } else if (trimmed.startsWith('+') || trimmed.startsWith('- +') || /^(?:wbc|rbc|plt|crp|glu|cre|ast|alt|k\+|na\+)/i.test(trimmed)) {
      labLines.push(trimmed.replace(/^[-+\s]+/, '• '));
    }
  }
  const labsText = labLines.join('\n');

  // 1.10 Mức độ (Severity)
  let severity: SeverityLevel = existingPatient?.severity || 'STABLE';
  if (/cấp cứu|suy hô hấp|sốc|hôn mê|tụt huyết áp|vận mạch|nhồi máu|phù phổi|plt\s*<?\s*50|tiểu cầu\s*<?\s*50/i.test(clean)) {
    severity = 'CRITICAL';
  } else if (/sốt cao|sốt xuất huyết|dengue|cần theo dõi|quặn cơn|sưng tím|plt\s*<?\s*100|tiểu cầu\s*<?\s*100/i.test(clean)) {
    severity = 'MODERATE';
  }

  // 1.11 Nhãn ra viện
  let admissionStatus: AdmissionDischargeStatus | undefined = existingPatient?.admissionStatus;
  if (/dự kiến ra viện ngày mai|rv ngày mai|mai ra viện|mai xuất viện|dự kiến xuất viện ngày mai/i.test(clean)) {
    admissionStatus = 'DISCHARGE_TOMORROW';
  } else if (/ra viện hôm nay|xuất viện hôm nay|ra viện|xuất viện/i.test(clean) && !/dự kiến ra viện ngày mai|rv ngày mai/i.test(clean)) {
    admissionStatus = 'DISCHARGE_TODAY';
  }

  // 2. Trích xuất Biểu Dẫn Thay Đổi Cận Lâm Sàng
  const { trends: labTrends, summaryText: labSummaryText } = extractLabTrends(clean, existingPatient);

  // 3. Tạo Tóm Tắt Bệnh Án chuyên sâu (Case Summary)
  const severityLabel = severity === 'CRITICAL' ? '🔴 Nặng / Nguy kịch' : severity === 'MODERATE' ? '🟡 Cần theo dõi' : '🟢 Ổn định';
  const dischargeLabel = admissionStatus === 'DISCHARGE_TOMORROW' ? ' • 🔵 Dự kiến ra viện ngày mai' : admissionStatus === 'DISCHARGE_TODAY' ? ' • 🟣 Ra viện hôm nay' : '';

  const summaryParts: string[] = [
    `🏥 TÓM TẮT BỆNH ÁN (${severityLabel}${dischargeLabel}):`,
    `• Bệnh nhân: ${fullName || 'Chưa rõ họ tên'} (${age} tuổi, ${gender})${roomNumber ? ` - Buồng/Phòng: ${roomNumber}` : ''}`,
    `• Chẩn đoán hiện tại: ${primaryDiagnosis || 'Theo dõi nội khoa'}`,
  ];

  if (clinicalNote) {
    summaryParts.push(`• Diễn biến lâm sàng: ${clinicalNote}`);
  }

  if (labSummaryText) {
    summaryParts.push(`• Cận lâm sàng & Biến động:\n${labSummaryText}`);
  } else if (labsText) {
    summaryParts.push(`• Cận lâm sàng: ${labsText}`);
  }

  if (treatmentPlan) {
    summaryParts.push(`• Hướng xử trí: ${treatmentPlan}`);
  }

  if (handoverNotes) {
    summaryParts.push(`• Bàn giao ca trực: ${handoverNotes}`);
  }

  if (importantNotes) {
    summaryParts.push(`• Ghi chú lưu ý: ${importantNotes}`);
  }

  const caseSummary = summaryParts.join('\n');

  // Thử gọi proxy Vercel hoặc Gemini API nếu có cấu hình nâng cao
  const aiConfig = loadAIConfig();
  if (aiConfig.provider === 'gemini' && aiConfig.geminiApiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${aiConfig.geminiApiKey}`;
      const prompt = `Phân tích bệnh án sau và trả về JSON thuần túy (không markdown):\n${clean}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      if (res.ok) {
        const data = await res.json();
        const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawJson) {
          const geminiParsed = JSON.parse(rawJson);
          if (geminiParsed.fullName) fullName = geminiParsed.fullName.toUpperCase();
          if (geminiParsed.diagnosis) primaryDiagnosis = geminiParsed.diagnosis;
          if (geminiParsed.treatmentPlan) treatmentPlan = geminiParsed.treatmentPlan;
        }
      }
    } catch {
      // Fallback seamlessly to our robust regex & clinical extractor
    }
  }

  return {
    fullName,
    age,
    gender,
    roomNumber,
    primaryDiagnosis,
    treatmentPlan,
    importantNotes,
    handoverNotes,
    severity,
    admissionStatus,
    clinicalNote,
    labsText,
    caseSummary,
    labTrends,
    labSummaryText,
  };
}

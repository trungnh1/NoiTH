import React, { useState, useEffect, useMemo } from 'react';
import { 
  Patient, 
  Doctor, 
  SeverityLevel, 
  ClinicalEvolution, 
  VitalSign,
  ClinicalTag,
  CLINICAL_TAGS_META
} from '../types/patient';
import { isRealAllergy, parseQuickVitals } from '../utils/clinicalTextParser';
import { 
  X, 
  Activity, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Stethoscope, 
  FileText, 
  HeartPulse, 
  History,
  Copy,
  Clock,
  ArrowRightLeft,
  ChevronRight,
  Tags,
  Tag,
  Sun,
  Sunset,
  Moon,
  Sparkles,
  RotateCcw,
  Search,
  Filter,
  Check,
  Plus,
  Pill,
  Send,
  Zap,
  CheckCheck,
  TestTube,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { calculateTreatmentDays, formatDoctorShortName } from './DetailedPatientListView';
import { formatPatientDisplayName } from '../utils/storage';
import { getSavedDoctorSession } from '../utils/auth';
import { getCriticalLabAlerts, parseRawLabsText } from '../utils/labAlerts';

// Ngưỡng sinh hiệu tiêu chuẩn lâm sàng
export type VitalStatus = 'normal' | 'warning' | 'critical' | 'empty';

export function getBpSysStatus(valStr: string): VitalStatus {
  if (!valStr.trim()) return 'empty';
  const val = Number(valStr);
  if (isNaN(val)) return 'empty';
  if (val > 180 || (val < 85 && val > 0)) return 'critical'; // Đỏ: Tăng huyết áp khẩn cấp > 180 hoặc tụt HA nặng
  if (val >= 140 || val < 90) return 'warning'; // Vàng: THA theo dõi hoặc HA thấp
  return 'normal';
}

export function getBpDiaStatus(valStr: string): VitalStatus {
  if (!valStr.trim()) return 'empty';
  const val = Number(valStr);
  if (isNaN(val)) return 'empty';
  if (val >= 100 || val < 55) return 'critical'; // Đỏ
  if (val >= 90 || val < 60) return 'warning'; // Vàng
  return 'normal';
}

export function getPulseStatus(valStr: string): VitalStatus {
  if (!valStr.trim()) return 'empty';
  const val = Number(valStr);
  if (isNaN(val)) return 'empty';
  if (val > 120 || val < 50) return 'critical'; // Đỏ: Mạch > 120 l/p hoặc quá chậm < 50
  if (val >= 100 || val < 60) return 'warning'; // Vàng: Mạch nhanh 100-120 hoặc chậm nhẹ
  return 'normal';
}

export function getSpO2Status(valStr: string): VitalStatus {
  if (!valStr.trim()) return 'empty';
  const val = Number(valStr);
  if (isNaN(val)) return 'empty';
  if (val < 94) return 'critical'; // Đỏ: SpO2 < 94%
  if (val === 94) return 'warning'; // Vàng: SpO2 = 94% ranh giới
  return 'normal';
}

export function getTempStatus(valStr: string): VitalStatus {
  if (!valStr.trim()) return 'empty';
  const val = Number(valStr);
  if (isNaN(val)) return 'empty';
  if (val < 35.5 && val > 0) return 'critical'; // Đỏ: Hạ thân nhiệt < 35.5°C
  if (val >= 38.0 || (val < 36.0 && val >= 35.5)) return 'warning'; // Vàng: Sốt theo dõi, không báo động đỏ
  return 'normal';
}

export function getVitalInputClass(status: VitalStatus, base = ''): string {
  if (status === 'critical') {
    return `${base} bg-rose-50 text-rose-700 border-rose-500 ring-2 ring-rose-400 font-black shadow-xs`;
  }
  if (status === 'warning') {
    return `${base} bg-amber-50 text-amber-900 border-amber-400 ring-2 ring-amber-300 font-black shadow-xs`;
  }
  return `${base} bg-white border-slate-300 text-slate-800 font-bold`;
}

// Cụm từ nhanh lâm sàng thường dùng (Smart Quick Chips)
const QUICK_CLINICAL_SYMPTOMS = [
  'Tỉnh táo, tiếp xúc tốt',
  'Đỡ đau ngực, không khó thở',
  'SpO2 khí trời ổn định',
  'Tim đều, T1 T2 rõ',
  'Phổi thông khí đều 2 bên, không rales',
  'Bụng mềm, không chướng, gan lách không to',
  'Ăn ngủ khá, đại tiểu tiện bình thường',
  'Sốt hạ, còn ho ít đờm trắng',
  'Phù 2 chi dưới giảm',
  'Huyết áp kiểm soát ổn định',
];

const QUICK_TREATMENT_PLANS = [
  'Duy trì y lệnh thuốc hiện tại',
  'Chỉnh liều thuốc hạ áp theo HA mục tiêu',
  'Khí dung giãn phế quản theo cữ',
  'Theo dõi sát SpO2 & sinh hiệu mỗi 4h',
  'Làm lại XN kiểm tra sáng mai',
  'Mời hội chẩn chuyên khoa khi có diễn biến mới',
  'Giải thích tình trạng bệnh & tư vấn chế độ ăn cho người nhà',
  'Tập vận động phục hồi chức năng tại giường',
];

export interface QuickEvolutionModalProps {
  patient: Patient;
  doctors: Doctor[];
  currentUser?: Doctor | null;
  onClose: () => void;
  onSaveEvolution: (updatedPatient: Patient) => void;
}

export const QuickEvolutionModal: React.FC<QuickEvolutionModalProps> = ({
  patient,
  doctors,
  currentUser,
  onClose,
  onSaveEvolution,
}) => {
  const treatmentInfo = calculateTreatmentDays(patient.admissionDate);
  const now = new Date();
  const defaultDateTimeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Form states
  const [evolutionDateTime, setEvolutionDateTime] = useState(defaultDateTimeStr);
  const [shift, setShift] = useState<'Sáng' | 'Chiều' | 'Đêm / Trực'>(() => {
    const h = new Date().getHours();
    if (h >= 7 && h < 14) return 'Sáng';
    if (h >= 14 && h < 21) return 'Chiều';
    return 'Đêm / Trực';
  });

  useEffect(() => {
    try {
      const d = new Date(evolutionDateTime);
      const h = d.getHours();
      if (!isNaN(h)) {
        if (h >= 7 && h < 14) setShift('Sáng');
        else if (h >= 14 && h < 21) setShift('Chiều');
        else setShift('Đêm / Trực');
      }
    } catch {
      // ignore
    }
  }, [evolutionDateTime]);
  
  // Bác sĩ phụ trách: Bác sĩ đang đăng nhập hoặc bác sĩ điều trị của BN
  const loggedInDoctor = currentUser || getSavedDoctorSession(doctors);
  const currentDoc = doctors.find((d) => d.id === patient.attendingDoctorId);
  const defaultDoctorName = loggedInDoctor?.name || currentDoc?.name || doctors[0]?.name || 'BS Điều trị';
  const [doctorName] = useState(defaultDoctorName);
  const [severity, setSeverity] = useState<SeverityLevel>(patient.severity || 'STABLE');
  const [admissionStatus, setAdmissionStatus] = useState<Patient['admissionStatus']>(patient.admissionStatus || 'STABLE_INPATIENT');

  // Chẩn đoán & Thẻ theo dõi lâm sàng
  const initialDiagnosis = patient.primaryDiagnosis + (patient.secondaryDiagnosis ? ` - ${patient.secondaryDiagnosis}` : '');
  const [diagnosis, setDiagnosis] = useState<string>(initialDiagnosis);
  const [selectedTags, setSelectedTags] = useState<ClinicalTag[]>(patient.tags || []);

  // Nội dung lâm sàng
  const [clinicalNote, setClinicalNote] = useState('');
  const [treatmentAction, setTreatmentAction] = useState(
    patient.treatmentPlan || patient.evolutions?.[0]?.treatmentAction || ''
  );
  const [labTests, setLabTests] = useState('');
  const [newClsText, setNewClsText] = useState('');

  // Chuẩn hóa tên xét nghiệm để so sánh với ngày trước
  const normalizeLabName = (name: string): string => {
    const clean = name.toLowerCase().replace(/[^a-z0-9+]/g, '');
    if (/wbc|bachcau/.test(clean)) return 'wbc';
    if (/rbc|hongcau/.test(clean)) return 'rbc';
    if (/hgb|hemoglobin|hb/.test(clean)) return 'hgb';
    if (/plt|tieucau|platelet/.test(clean)) return 'plt';
    if (/k\+|kali/.test(clean)) return 'kali';
    if (/na\+|natri/.test(clean)) return 'natri';
    if (/cl-|clo/.test(clean)) return 'clo';
    if (/glucose|duong/.test(clean)) return 'glucose';
    if (/creatinine|crea/.test(clean)) return 'creatinine';
    if (/ure|urea/.test(clean)) return 'ure';
    if (/ast|got/.test(clean)) return 'ast';
    if (/alt|gpt/.test(clean)) return 'alt';
    if (/crp/.test(clean)) return 'crp';
    if (/pct|procalcitonin/.test(clean)) return 'pct';
    if (/troponin/.test(clean)) return 'troponin';
    return clean;
  };

  // Tự động phân tích văn bản CLS mới nhập và so sánh với dữ liệu ngày trước
  const parsedClsComparison = useMemo(() => {
    if (!newClsText.trim()) return [];

    const now = new Date();
    const timeDisplay = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    const parsedNew = parseRawLabsText(newClsText, timeDisplay);
    const existingLabs = patient.labs || [];

    return parsedNew.map((curr) => {
      const currKey = normalizeLabName(curr.testName);
      const currNum = parseFloat(String(curr.value).replace(/[^0-9.]/g, ''));

      // Tìm kết quả xét nghiệm trước đó gần nhất có cùng tên
      let prevMatch: LabResult | null = null;
      for (let i = existingLabs.length - 1; i >= 0; i--) {
        if (normalizeLabName(existingLabs[i].testName) === currKey) {
          prevMatch = existingLabs[i];
          break;
        }
      }

      let changeTrend: 'INCREASED' | 'DECREASED' | 'UNCHANGED' | undefined;
      let diffText: string | undefined;

      if (prevMatch) {
        const prevNum = parseFloat(String(prevMatch.value).replace(/[^0-9.]/g, ''));
        if (!isNaN(currNum) && !isNaN(prevNum)) {
          const diff = currNum - prevNum;
          const diffAbs = Math.abs(diff);
          const diffStr = diffAbs >= 1 ? diffAbs.toFixed(1) : diffAbs.toFixed(2);
          if (diff > 0.05) {
            changeTrend = 'INCREASED';
            diffText = `↑ Tăng ${diffStr} (trước: ${prevMatch.value} ${prevMatch.unit || ''})`;
          } else if (diff < -0.05) {
            changeTrend = 'DECREASED';
            diffText = `↓ Giảm ${diffStr} (trước: ${prevMatch.value} ${prevMatch.unit || ''})`;
          } else {
            changeTrend = 'UNCHANGED';
            diffText = `↔ Không đổi (${prevMatch.value} ${prevMatch.unit || ''})`;
          }
        } else {
          diffText = `kết quả trước: ${prevMatch.value}`;
        }
      }

      return {
        ...curr,
        changeTrend,
        diffText,
      };
    });
  }, [newClsText, patient.labs]);

  const clsPanicCount = parsedClsComparison.filter((p) => p.isPanicValue).length;
  const clsAbnormalCount = parsedClsComparison.filter((p) => p.isAbnormal && !p.isPanicValue).length;
  const [dailyNotes, setDailyNotes] = useState('');
  const [handoverNotes, setHandoverNotes] = useState(patient.handoverNotes || patient.importantNotes || '');

  // Sinh hiệu nhanh
  const latestVital = patient.vitals?.[0];
  const [bpSys, setBpSys] = useState<string>(latestVital?.bpSystolic ? String(latestVital.bpSystolic) : '');
  const [bpDia, setBpDia] = useState<string>(latestVital?.bpDiastolic ? String(latestVital.bpDiastolic) : '');
  const [pulse, setPulse] = useState<string>(latestVital?.heartRate ? String(latestVital.heartRate) : '');
  const [temperature, setTemperature] = useState<string>(latestVital?.temperature ? String(latestVital.temperature) : '');
  const [spO2, setSpO2] = useState<string>(latestVital?.spO2 ? String(latestVital.spO2) : '');

  // Nhập nhanh 1 dòng sinh hiệu (Single-line Vitals Input)
  const [quickVitalsInput, setQuickVitalsInput] = useState('');
  const [quickVitalsFeedback, setQuickVitalsFeedback] = useState<string | null>(null);

  const handleApplyQuickVitals = (textToParse?: string) => {
    const text = textToParse !== undefined ? textToParse : quickVitalsInput;
    if (!text.trim()) return;
    const parsed = parseQuickVitals(text);
    const applied: string[] = [];
    if (parsed.bpSys) { setBpSys(parsed.bpSys); applied.push(`HA ${parsed.bpSys}/${parsed.bpDia || ''}`); }
    if (parsed.bpDia && !parsed.bpSys) { setBpDia(parsed.bpDia); applied.push(`HA /${parsed.bpDia}`); }
    else if (parsed.bpDia) { setBpDia(parsed.bpDia); }
    if (parsed.pulse) { setPulse(parsed.pulse); applied.push(`Mạch ${parsed.pulse}`); }
    if (parsed.spO2) { setSpO2(parsed.spO2); applied.push(`SpO2 ${parsed.spO2}%`); }
    if (parsed.temperature) { setTemperature(parsed.temperature); applied.push(`T ${parsed.temperature}°C`); }

    if (applied.length > 0) {
      setQuickVitalsFeedback(`⚡ Đã bóc tách: ${applied.join(' • ')}`);
      showToast(`⚡ Đã điền nhanh: ${applied.join(' • ')}`);
      setTimeout(() => setQuickVitalsFeedback(null), 3000);
    } else {
      setQuickVitalsFeedback('Không nhận diện được số sinh hiệu. Hãy thử gõ: 130/80 82 98 37');
      setTimeout(() => setQuickVitalsFeedback(null), 3500);
    }
  };

  // Lọc lịch sử diễn tiến
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyShiftFilter, setHistoryShiftFilter] = useState<'ALL' | 'Sáng' | 'Chiều' | 'Đêm / Trực'>('ALL');
  const [mobileTab, setMobileTab] = useState<'form' | 'history'>('form');

  // Error message & feedback toast
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  // Nạp toàn bộ dữ liệu từ lần diễn tiến gần nhất (Smart One-Click Prefill)
  const handlePrefillLatestEvolution = () => {
    const latestEvo = patient.evolutions?.[0];
    const latestDiag = patient.primaryDiagnosis + (patient.secondaryDiagnosis ? ` - ${patient.secondaryDiagnosis}` : '');
    
    if (latestDiag) setDiagnosis(latestDiag);
    if (latestEvo?.clinicalNote) setClinicalNote(latestEvo.clinicalNote);
    if (latestEvo?.treatmentAction || patient.treatmentPlan) {
      setTreatmentAction(latestEvo?.treatmentAction || patient.treatmentPlan || '');
    }
    if (patient.handoverNotes || latestEvo?.notes) {
      setHandoverNotes(patient.handoverNotes || latestEvo?.notes || '');
    }
    if (latestEvo?.notes) {
      setDailyNotes(latestEvo.notes);
    }
    showToast('✨ Đã nạp nhanh diễn biến & y lệnh từ ca trước!');
  };

  // Xóa trắng form để nhập ca mới hoàn toàn
  const handleClearForm = () => {
    setClinicalNote('');
    setNewClsText('');
    setTreatmentAction('');
    setDailyNotes('');
    setHandoverNotes('');
    setBpSys('');
    setBpDia('');
    setPulse('');
    setTemperature('');
    setSpO2('');
    setQuickVitalsInput('');
    setQuickVitalsFeedback(null);
    showToast('Đã làm mới các ô nhập liệu.');
  };

  // Thêm nhanh cụm từ vào ô Diễn biến lâm sàng
  const handleAddSymptomChip = (chip: string) => {
    setClinicalNote((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return chip;
      if (trimmed.includes(chip)) return prev;
      if (trimmed.endsWith('.') || trimmed.endsWith(',')) return `${trimmed} ${chip}`;
      return `${trimmed}, ${chip}`;
    });
    if (errorMsg) setErrorMsg(null);
  };

  // Thêm nhanh cụm từ vào ô Y lệnh
  const handleAddTreatmentChip = (chip: string) => {
    setTreatmentAction((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return chip;
      if (trimmed.includes(chip)) return prev;
      if (trimmed.endsWith(';') || trimmed.endsWith('.') || trimmed.endsWith('\n')) return `${trimmed} ${chip}`;
      return `${trimmed}; ${chip}`;
    });
  };

  // Sao chép chẩn đoán gần nhất
  const handleCopyLatestDiagnosis = () => {
    const latestDiag = patient.primaryDiagnosis + (patient.secondaryDiagnosis ? ` - ${patient.secondaryDiagnosis}` : '');
    setDiagnosis(latestDiag);
    showToast('Đã sao chép chẩn đoán ban đầu!');
  };

  const handleCopyLatestClinicalNote = () => {
    const latest = patient.evolutions?.[0]?.clinicalNote;
    if (latest) {
      setClinicalNote(latest);
      showToast('Đã sao chép diễn biến lâm sàng gần nhất!');
    } else {
      showToast('Chưa có lịch sử diễn biến trước đó để sao chép.');
    }
  };

  const handleCopyLatestTreatmentAction = () => {
    const latest = patient.evolutions?.[0]?.treatmentAction || patient.treatmentPlan;
    if (latest) {
      setTreatmentAction(latest);
      showToast('Đã sao chép hướng xử trí gần nhất!');
    } else {
      showToast('Chưa có hướng xử trí trước đó để sao chép.');
    }
  };

  const handleCopyLatestHandover = () => {
    const latest = patient.handoverNotes || patient.evolutions?.[0]?.notes;
    if (latest) {
      setHandoverNotes(latest);
      showToast('Đã sao chép nội dung bàn giao gần nhất!');
    } else {
      showToast('Chưa có nội dung bàn giao trước đó.');
    }
  };

  // Chèn khung bàn giao chuẩn quốc tế SBAR (Situation - Background - Assessment - Recommendation)
  const handleInsertSbarTemplate = () => {
    const sbarTemplate = `[S - Tình trạng]: Bệnh tỉnh, tiếp xúc tốt, sinh hiệu tạm ổn\n[B - Tiền sử/Bệnh nền]: Bệnh nền kiểm soát ổn\n[A - Đánh giá]: Đáp ứng phác đồ điều trị ca trực\n[R - Dặn dò ca sau]: Theo dõi sinh hiệu theo cữ, kiểm tra kết quả xét nghiệm`;
    setHandoverNotes((prev) => (prev.trim() ? `${prev}\n${sbarTemplate}` : sbarTemplate));
    showToast('✨ Đã chèn mẫu bàn giao ca trực chuẩn SBAR!');
  };

  // Áp dụng trực tiếp 1 entry trong lịch sử
  const handleApplyHistoricalEntry = (evo: ClinicalEvolution) => {
    if (evo.clinicalNote) setClinicalNote(evo.clinicalNote);
    if (evo.treatmentAction) setTreatmentAction(evo.treatmentAction);
    if (evo.notes) setDailyNotes(evo.notes);
    setMobileTab('form');
    showToast(`Đã áp dụng dữ liệu ca ${evo.shift} (${evo.timestamp})!`);
  };

  const handleCopyHistoricalPlanOnly = (planText: string) => {
    setTreatmentAction(planText);
    showToast('Đã sao chép y lệnh điều trị này vào form!');
  };

  // Bật/tắt gắn nhãn thẻ lâm sàng
  const handleToggleTag = (tag: ClinicalTag) => {
    setSelectedTags((prev) => 
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Hotkeys: Esc để đóng, Ctrl+Enter để lưu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clinicalNote, treatmentAction, dailyNotes, handoverNotes, evolutionDateTime, shift, doctorName, severity, admissionStatus, diagnosis, selectedTags, bpSys, bpDia, pulse, temperature, spO2]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!clinicalNote.trim()) {
      setErrorMsg('Vui lòng nhập diễn biến lâm sàng của bệnh nhân trong ca trực.');
      return;
    }
    if (!diagnosis.trim()) {
      setErrorMsg('Vui lòng nhập chẩn đoán lâm sàng của bệnh nhân.');
      return;
    }

    const formattedTime = evolutionDateTime.replace('T', ' ');

    // Tạo record diễn tiến mới
    const newEvolution: ClinicalEvolution = {
      id: `EV-${Date.now()}`,
      timestamp: formattedTime,
      doctorName: loggedInDoctor?.name || doctorName || 'BS Điều trị',
      shift,
      clinicalNote: clinicalNote.trim(),
      treatmentAction: treatmentAction.trim() || 'Duy trì phác đồ điều trị hiện tại.',
      orders: labTests.trim() || undefined,
      notes: dailyNotes.trim() || undefined,
    };

    // Tạo record sinh hiệu mới nếu có nhập
    const hasVitalsEntered = !!(bpSys.trim() || bpDia.trim() || pulse.trim() || temperature.trim() || spO2.trim());
    const newVitalsList = [...(patient.vitals || [])];

    if (hasVitalsEntered) {
      const newVital: VitalSign = {
        id: `V-${Date.now()}`,
        timestamp: formattedTime,
        bpSystolic: bpSys ? Number(bpSys) : 120,
        bpDiastolic: bpDia ? Number(bpDia) : 80,
        heartRate: pulse ? Number(pulse) : 80,
        temperature: temperature ? Number(temperature) : 37.0,
        spO2: spO2 ? Number(spO2) : 98,
        respiratoryRate: 20,
        notes: `Ghi nhận ca ${shift}`,
      };
      newVitalsList.unshift(newVital);
    }

    // Bổ sung CLS mới vào bệnh nhân nếu có nhập
    let updatedInitialLabsText = patient.initialLabsText || '';
    let updatedLabs = [...(patient.labs || [])];

    if (newClsText.trim()) {
      const timeHeader = `\n\n--- [Cận Lâm Sàng Mới Ca ${shift}: ${formattedTime}] ---\n`;
      updatedInitialLabsText = updatedInitialLabsText.trim()
        ? `${updatedInitialLabsText.trim()}${timeHeader}${newClsText.trim()}`
        : newClsText.trim();

      const newParsedLabs = parseRawLabsText(newClsText.trim(), formattedTime);
      updatedLabs = [...updatedLabs, ...newParsedLabs];
    }

    const updatedPatient: Patient = {
      ...patient,
      initialLabsText: updatedInitialLabsText,
      labs: updatedLabs,
      primaryDiagnosis: diagnosis.trim() || patient.primaryDiagnosis,
      secondaryDiagnosis: undefined,
      tags: selectedTags,
      allergies: selectedTags.includes('ALLERGY') ? (isRealAllergy(patient.allergies) ? patient.allergies : 'Có dị ứng thuốc/thức ăn') : undefined,
      severity,
      admissionStatus,
      treatmentPlan: treatmentAction.trim() || patient.treatmentPlan,
      importantNotes: handoverNotes.trim() || patient.importantNotes,
      handoverNotes: handoverNotes.trim() || patient.handoverNotes,
      evolutions: [newEvolution, ...(patient.evolutions || [])],
      vitals: newVitalsList,
    };

    onSaveEvolution(updatedPatient);
  };

  // Danh sách lịch sử diễn tiến đã lọc
  const filteredEvolutions = useMemo(() => {
    let list = patient.evolutions || [];
    if (historyShiftFilter !== 'ALL') {
      list = list.filter((e) => e.shift === historyShiftFilter);
    }
    if (historySearchQuery.trim()) {
      const q = historySearchQuery.toLowerCase();
      list = list.filter((e) => 
        (e.clinicalNote && e.clinicalNote.toLowerCase().includes(q)) ||
        (e.treatmentAction && e.treatmentAction.toLowerCase().includes(q)) ||
        (e.doctorName && e.doctorName.toLowerCase().includes(q)) ||
        (e.timestamp && e.timestamp.toLowerCase().includes(q)) ||
        (e.notes && e.notes.toLowerCase().includes(q))
      );
    }
    return list;
  }, [patient.evolutions, historyShiftFilter, historySearchQuery]);

  // Cảnh báo xét nghiệm nguy hiểm
  const criticalLabAlerts = useMemo(() => getCriticalLabAlerts(patient), [patient]);

  // Sinh hiệu status
  const bpSysStatus = getBpSysStatus(bpSys);
  const bpDiaStatus = getBpDiaStatus(bpDia);
  const pulseStatus = getPulseStatus(pulse);
  const spO2Status = getSpO2Status(spO2);
  const tempStatus = getTempStatus(temperature);

  const vitalAlerts: { text: string; isCritical: boolean }[] = [];
  if (pulseStatus === 'critical') {
    vitalAlerts.push({
      text: Number(pulse) > 120 ? `Mạch rất nhanh (${pulse} l/p > 120)` : `Mạch chậm nguy hiểm (${pulse} l/p < 50)`,
      isCritical: true,
    });
  } else if (pulseStatus === 'warning') {
    vitalAlerts.push({ text: `Mạch ranh giới (${pulse} l/p)`, isCritical: false });
  }

  if (spO2Status === 'critical') {
    vitalAlerts.push({ text: `SpO2 tụt thấp (${spO2}% < 94%)`, isCritical: true });
  } else if (spO2Status === 'warning') {
    vitalAlerts.push({ text: `SpO2 ranh giới (${spO2}%)`, isCritical: false });
  }

  if (bpSysStatus === 'critical' || bpDiaStatus === 'critical') {
    vitalAlerts.push({
      text: `Huyết áp bất thường (${bpSys || '--'}/${bpDia || '--'} mmHg)`,
      isCritical: true,
    });
  } else if (bpSysStatus === 'warning' || bpDiaStatus === 'warning') {
    vitalAlerts.push({
      text: `Huyết áp cảnh báo (${bpSys || '--'}/${bpDia || '--'} mmHg)`,
      isCritical: false,
    });
  }

  if (tempStatus === 'critical') {
    vitalAlerts.push({
      text: `Hạ thân nhiệt (${temperature}°C < 35.5)`,
      isCritical: true,
    });
  }

  const hasCriticalVitals = vitalAlerts.some((a) => a.isCritical);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-in fade-in duration-150">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity cursor-pointer"
        title="Bấm bên ngoài để đóng"
      />

      {/* Main Drawer Panel - Rộng gần hết màn hình theo yêu cầu */}
      <div className="relative w-full sm:w-[97vw] md:w-[96vw] lg:w-[95vw] max-w-[1920px] bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200 overflow-hidden border-l-0 sm:border-l border-slate-300">
        
        {/* HEADER: HIỆN ĐẠI, KHOA HỌC, ĐẬM CHẤT LÂM SÀNG */}
        <div className="px-3 sm:px-5 py-2 sm:py-3 bg-gradient-to-r from-slate-900 via-[#0b4d8c] to-[#12589b] text-white flex items-center justify-between border-b border-[#083a69] shrink-0 shadow-xs">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0 shadow-inner">
              <Stethoscope className="w-5 h-5 text-cyan-300" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs uppercase tracking-wider font-extrabold text-cyan-300 bg-white/10 px-2 py-0.5 rounded border border-white/15">
                  Nhập Diễn Tiến Lâm Sàng
                </span>
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white truncate">
                  {formatPatientDisplayName(patient.fullName)}
                </h3>
                
                {/* Giới tính + Tuổi */}
                <span className="text-xs px-2 py-0.5 rounded-md bg-white/15 text-white font-bold border border-white/20 shrink-0">
                  {patient.age}T • {patient.gender === "Nam" ? (
                    <span className="text-blue-200 font-black">♂ Nam</span>
                  ) : (
                    <span className="text-rose-200 font-black">♀ Nữ</span>
                  )}
                </span>

                {/* Phòng & Giường */}
                <span className="text-xs px-2 py-0.5 rounded-md bg-cyan-500/30 text-cyan-100 font-extrabold border border-cyan-400/40 shrink-0">
                  Phòng {patient.roomNumber}
                </span>

                {/* Ngày điều trị */}
                <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/30 text-emerald-100 font-extrabold border border-emerald-400/40 shrink-0">
                  {treatmentInfo.label}
                </span>

                {/* Bác sĩ điều trị */}
                {patient.attendingDoctorId && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 text-slate-100 font-semibold border border-white/15 shrink-0 hidden md:inline-block">
                    BSĐT: {formatDoctorShortName(currentDoc?.name || '')}
                  </span>
                )}
              </div>

              {/* Chẩn đoán tóm tắt */}
              <p className="text-xs text-blue-100 font-medium mt-0.5 truncate max-w-4xl">
                Chẩn đoán: <strong className="text-white font-bold">{diagnosis || patient.primaryDiagnosis}</strong>
                {patient.medicalHistory ? ` • Tiền sử: ${patient.medicalHistory}` : ''}
              </p>
            </div>
          </div>

          {/* Phím tắt & Nút đóng */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-blue-200 bg-white/10 px-2.5 py-1 rounded-lg border border-white/15 font-mono">
              <kbd className="px-1.5 py-0.5 rounded bg-black/30 text-white font-bold text-[10px]">Ctrl+Enter</kbd>
              <span>Lưu</span>
              <span className="text-blue-300">•</span>
              <kbd className="px-1.5 py-0.5 rounded bg-black/30 text-white font-bold text-[10px]">Esc</kbd>
              <span>Đóng</span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-blue-200 hover:text-white hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
              title="Đóng cửa sổ (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SMART ACTION BAR: NẠP DỮ LIỆU CA TRƯỚC, LÀM MỚI & CẢNH BÁO */}
        <div className="bg-slate-100/90 border-b border-slate-200 px-3 sm:px-5 py-1.5 sm:py-2 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold text-slate-700 uppercase tracking-tight flex items-center gap-1 text-[11px]">
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>Thao tác nhanh:</span>
            </span>

            {/* Nút nạp nhanh từ ca trước */}
            <button
              type="button"
              onClick={handlePrefillLatestEvolution}
              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-98"
              title="Điền tự động diễn biến, y lệnh và chẩn đoán gần nhất chỉ với 1 click"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Nạp nhanh dữ liệu ca trước</span>
            </button>

            {/* Nút làm mới form */}
            <button
              type="button"
              onClick={handleClearForm}
              className="px-2 py-1 rounded-lg bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold flex items-center gap-1 transition-colors cursor-pointer"
              title="Xóa trắng các ô để nhập ca mới"
            >
              <RotateCcw className="w-3 h-3 text-slate-500" />
              <span>Làm mới form</span>
            </button>

            {/* Gợi ý bác sĩ đăng nhập */}
            <span className="text-[11px] text-slate-500 hidden xl:inline-block">
              Người nhập: <strong className="text-slate-800">{loggedInDoctor?.name || doctorName}</strong>
            </span>
          </div>

          {/* Toast thông báo */}
          {toastMsg && (
            <div className="bg-emerald-600 text-white text-[11px] font-bold px-3 py-1 rounded-lg shadow-xs flex items-center gap-1 animate-in fade-in">
              <Check className="w-3.5 h-3.5" />
              <span>{toastMsg}</span>
            </div>
          )}
        </div>

        {/* MOBILE SEGMENTED TAB SWITCH: BÁC SĨ CHỌN XEM FORM HOẶC XEM LỊCH SỬ TRÊN ĐIỆN THOẠI */}
        <div className="flex sm:hidden p-1.5 bg-slate-100 border-b border-slate-200 shrink-0">
          <div className="grid grid-cols-2 gap-1 w-full bg-white p-0.5 rounded-xl border border-slate-200 text-xs font-bold shadow-2xs">
            <button
              type="button"
              onClick={() => setMobileTab('form')}
              className={`py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mobileTab === 'form'
                  ? 'bg-[#0b4d8c] text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>1. Nhập Diễn Tiến</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('history')}
              className={`py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mobileTab === 'history'
                  ? 'bg-[#0b4d8c] text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>2. Lịch Sử ({patient.evolutions?.length || 0})</span>
            </button>
          </div>
        </div>

        {/* 2 CỘT CHÍNH: CỘT TRÁI (NHẬP LIỆU) & CỘT PHẢI (LỊCH SỬ TIMELINE) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
          
          {/* ========================================================================= */}
          {/* CỘT TRÁI (6 cols trên LG, 6 cols trên XL): FORM NHẬP KHOA HỌC, DỄ NHẬP */}
          {/* ========================================================================= */}
          <form 
            onSubmit={handleSubmit} 
            className={`lg:col-span-6 xl:col-span-6 p-3 sm:p-5 overflow-y-auto space-y-3 sm:space-y-3.5 border-r border-slate-200 bg-slate-50/60 flex flex-col justify-between text-xs ${
              mobileTab === 'form' ? 'flex' : 'hidden sm:flex'
            }`}
          >
            <div className="space-y-3.5">
              
              {/* Thông báo lỗi nếu có */}
              {errorMsg && (
                <div className="p-2.5 bg-rose-50 border-2 border-rose-300 rounded-xl text-rose-900 font-bold flex items-center gap-2 animate-in slide-in-from-top-1">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* KHỐI 1: THỜI ĐIỂM, CA TRỰC & MỨC ĐỘ BỆNH */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                  <span className="font-black text-slate-800 text-xs uppercase tracking-tight flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#0b4d8c]" />
                    <span>1. Thời Điểm Khám & Đánh Giá Tổng Trạng</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold">
                    Khoa Nội Tổng Hợp
                  </span>
                </div>

                {/* Ngày giờ */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-[11px]">
                    Ngày Giờ Ghi Nhận <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={evolutionDateTime}
                    onChange={(e) => setEvolutionDateTime(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg font-bold text-xs text-slate-900 focus:ring-2 focus:ring-[#0b4d8c] focus:border-transparent bg-slate-50/50"
                    required
                  />
                </div>

                {/* Mức độ tình trạng bệnh nhân */}
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-extrabold text-slate-700 block text-[11px] uppercase">
                      Mức Độ Tình Trạng Bệnh Nhân:
                    </label>
                    {admissionStatus === 'DISCHARGE_TOMORROW' && (
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        ✓ Đã đánh dấu Dự kiến ra viện mai
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSeverity('STABLE');
                      }}
                      className={`py-1.5 px-2 rounded-lg font-black text-xs border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        severity === 'STABLE' && admissionStatus !== 'DISCHARGE_TOMORROW'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-emerald-50'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                      Ổn định
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSeverity('MODERATE');
                        setAdmissionStatus('STABLE_INPATIENT');
                      }}
                      className={`py-1.5 px-2 rounded-lg font-black text-xs border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        severity === 'MODERATE'
                          ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-amber-50'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-300 inline-block"></span>
                      Trung bình
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSeverity('CRITICAL');
                        setAdmissionStatus('STABLE_INPATIENT');
                      }}
                      className={`py-1.5 px-2 rounded-lg font-black text-xs border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        severity === 'CRITICAL'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-rose-50'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-300 inline-block"></span>
                      Nặng
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (admissionStatus === 'DISCHARGE_TOMORROW') {
                          setAdmissionStatus('STABLE_INPATIENT');
                        } else {
                          setAdmissionStatus('DISCHARGE_TOMORROW');
                          setSeverity('STABLE');
                        }
                      }}
                      className={`py-1.5 px-2 rounded-lg font-black text-xs border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        admissionStatus === 'DISCHARGE_TOMORROW'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-blue-50/70 text-blue-800 border-blue-200 hover:bg-blue-100'
                      }`}
                      title="Đánh dấu bệnh nhân dự kiến ra viện vào ngày mai"
                    >
                      <span className="w-2 h-2 rounded-full bg-blue-300 inline-block"></span>
                      Dự RV mai
                    </button>
                  </div>
                </div>

                {/* Sinh hiệu hôm nay */}
                <div className={`p-2.5 rounded-xl border space-y-2 transition-colors ${
                  hasCriticalVitals 
                    ? 'bg-rose-50/60 border-rose-300 ring-1 ring-rose-200' 
                    : vitalAlerts.length > 0 
                    ? 'bg-amber-50/50 border-amber-300' 
                    : 'bg-slate-50/60 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-800 font-extrabold text-[11px] uppercase">
                      <HeartPulse className={`w-3.5 h-3.5 ${hasCriticalVitals ? 'text-rose-600 animate-pulse' : 'text-rose-600'}`} />
                      <span>Sinh Hiệu Lâm Sàng</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">(Tự động cảnh báo màu theo ngưỡng y khoa)</span>
                  </div>

                  {/* THANH NHẬP NHANH 1 DÒNG SINH HIỆU (SINGLE-LINE QUICK VITALS) */}
                  <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-blue-200 shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <label className="text-[10.5px] font-black uppercase text-[#0b4d8c] flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                        <span>Nhập Nhanh 1 Dòng (Gõ hoặc dán chuỗi)</span>
                      </label>
                      {quickVitalsFeedback && (
                        <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 animate-in fade-in">
                          {quickVitalsFeedback}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={quickVitalsInput}
                          onChange={(e) => setQuickVitalsInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleApplyQuickVitals();
                            }
                          }}
                          placeholder="Gõ nhanh: 130/80 82 98 37 hoặc 120/70 78 99 rồi nhấn Enter..."
                          className="w-full pl-8 pr-2.5 py-1.5 sm:py-2 bg-slate-50/70 border border-slate-300 focus:border-[#0b4d8c] focus:bg-white rounded-lg text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:ring-2 focus:ring-[#0b4d8c]/20 transition-all"
                        />
                        <Zap className="w-3.5 h-3.5 text-blue-600 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleApplyQuickVitals()}
                        className="px-3 py-1.5 sm:py-2 bg-gradient-to-r from-[#0b4d8c] to-[#083a69] hover:from-[#094178] hover:to-[#062c52] text-white font-black text-xs rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1 shrink-0 active:scale-95"
                        title="Tự động bóc tách số vào các ô sinh hiệu bên dưới"
                      >
                        <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
                        <span>Bóc tách</span>
                      </button>
                    </div>

                    {/* Dải nút gợi ý mẫu sinh hiệu thông dụng */}
                    <div className="flex items-center gap-1 flex-wrap pt-0.5">
                      <span className="text-[9.5px] font-bold text-slate-400">Mẫu sẵn:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickVitalsInput('120/80 75 98 37');
                          handleApplyQuickVitals('120/80 75 98 37');
                        }}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-blue-50 hover:text-[#0b4d8c] border border-slate-200 rounded-md text-[10px] font-bold text-slate-700 transition-colors cursor-pointer"
                        title="Huyết áp 120/80, Mạch 75, SpO2 98%, Nhiệt độ 37°C"
                      >
                        120/80 75 98% 37° (Chuẩn)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickVitalsInput('130/80 80 98');
                          handleApplyQuickVitals('130/80 80 98');
                        }}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-blue-50 hover:text-[#0b4d8c] border border-slate-200 rounded-md text-[10px] font-bold text-slate-700 transition-colors cursor-pointer"
                      >
                        130/80 80 98%
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickVitalsInput('110/70 72 99');
                          handleApplyQuickVitals('110/70 72 99');
                        }}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-blue-50 hover:text-[#0b4d8c] border border-slate-200 rounded-md text-[10px] font-bold text-slate-700 transition-colors cursor-pointer"
                      >
                        110/70 72 99%
                      </button>
                      {(bpSys || bpDia || pulse || spO2 || temperature) && (
                        <button
                          type="button"
                          onClick={() => {
                            setBpSys('');
                            setBpDia('');
                            setPulse('');
                            setSpO2('');
                            setTemperature('');
                            setQuickVitalsInput('');
                            setQuickVitalsFeedback(null);
                          }}
                          className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md text-[10px] font-bold text-rose-700 transition-colors cursor-pointer ml-auto"
                        >
                          ✕ Xóa trắng
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block text-center truncate mb-0.5">HA (mmHg)</label>
                      <div className="flex items-center gap-0.5">
                        <input
                          type="number"
                          value={bpSys}
                          onChange={(e) => setBpSys(e.target.value)}
                          placeholder="120"
                          className={getVitalInputClass(bpSysStatus, 'w-full p-1.5 rounded text-center text-xs font-mono')}
                          title="Tâm thu: Chuẩn 90-139, Vàng >=140, Đỏ >=160 hoặc <85"
                        />
                        <span className="text-slate-400 text-xs font-bold">/</span>
                        <input
                          type="number"
                          value={bpDia}
                          onChange={(e) => setBpDia(e.target.value)}
                          placeholder="80"
                          className={getVitalInputClass(bpDiaStatus, 'w-full p-1.5 rounded text-center text-xs font-mono')}
                          title="Tâm trương: Chuẩn 60-89, Vàng >=90, Đỏ >=100 hoặc <55"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block text-center truncate mb-0.5">Mạch (l/p)</label>
                      <input
                        type="number"
                        value={pulse}
                        onChange={(e) => setPulse(e.target.value)}
                        placeholder="80"
                        className={getVitalInputClass(pulseStatus, 'w-full p-1.5 rounded text-center text-xs font-mono')}
                        title="Mạch: Chuẩn 60-99, Vàng 100-120, Đỏ >120 hoặc <50"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block text-center truncate mb-0.5">SpO2 (%)</label>
                      <input
                        type="number"
                        value={spO2}
                        onChange={(e) => setSpO2(e.target.value)}
                        placeholder="98"
                        className={getVitalInputClass(spO2Status, 'w-full p-1.5 rounded text-center text-xs font-mono')}
                        title="SpO2: Chuẩn >=95%, Vàng 94%, Đỏ <94%"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block text-center truncate mb-0.5">Nhiệt (°C)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={temperature}
                        onChange={(e) => setTemperature(e.target.value)}
                        placeholder="37"
                        className={getVitalInputClass(tempStatus, 'w-full p-1.5 rounded text-center text-xs font-mono')}
                        title="Nhiệt độ: Chuẩn 36.5-37.4, Vàng 37.5-38.4, Đỏ >=38.5 hoặc <35.5"
                      />
                    </div>
                  </div>

                  {/* Dải cảnh báo sinh hiệu bất thường */}
                  {vitalAlerts.length > 0 && (
                    <div className={`p-1.5 px-2 rounded-lg text-[10.5px] font-extrabold flex items-center gap-1.5 animate-in fade-in ${
                      hasCriticalVitals 
                        ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}>
                      <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${hasCriticalVitals ? 'text-rose-600 animate-bounce' : 'text-amber-600'}`} />
                      <span>Cảnh báo sinh hiệu: {vitalAlerts.map((a) => a.text).join(' • ')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* KHỐI 2: DIỄN BIẾN LÂM SÀNG & KHÁM THỰC THỂ (SUBJECTIVE & OBJECTIVE) */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="uppercase text-slate-900 font-black text-xs flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#0b4d8c]" />
                    <span>2. Diễn Biến Lâm Sàng & Khám Thực Thể <span className="text-rose-500">*</span></span>
                  </span>

                  <button
                    type="button"
                    onClick={handleCopyLatestClinicalNote}
                    className="text-[10.5px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1 cursor-pointer transition-colors"
                    title="Sao chép diễn biến lâm sàng gần nhất"
                  >
                    <Copy className="w-2.5 h-2.5 text-indigo-600" />
                    <span>Sao chép ca trước</span>
                  </button>
                </div>

                {/* Textarea Diễn biến */}
                <textarea
                  rows={3}
                  value={clinicalNote}
                  onChange={(e) => {
                    setClinicalNote(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Nhập chi tiết diễn biến: Bệnh nhân tỉnh táo, đỡ đau ngực, tim đều rõ, phổi thông khí 2 đáy tốt, không phù, ăn uống khá hơn..."
                  className="w-full p-2.5 bg-slate-50/50 border border-slate-300 rounded-lg font-medium text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#0b4d8c] focus:border-transparent leading-relaxed"
                  required
                />
              </div>

              
              {/* KHỐI CẬN LÂM SÀNG MỚI: TỰ ĐỘNG PHÂN TÍCH, SẮP XẾP GỌN & SO SÁNH VỚI NGÀY TRƯỚC */}
              <div className="bg-white p-3 rounded-xl border border-blue-200 shadow-2xs space-y-2 bg-blue-50/20">
                <div className="flex items-center justify-between pb-1.5 border-b border-blue-100 flex-wrap gap-1">
                  <span className="uppercase text-slate-900 font-black text-xs flex items-center gap-1.5">
                    <TestTube className="w-3.5 h-3.5 text-blue-600" />
                    <span>Cận Lâm Sàng & Kết Quả Xét Nghiệm Mới Trong Ca</span>
                  </span>
                  <span className="text-[10px] text-blue-700 font-bold bg-blue-100/80 px-2 py-0.5 rounded-md">
                    ⚡ Tự động phân tích & so sánh với ngày trước
                  </span>
                </div>

                <textarea
                  rows={2}
                  value={newClsText}
                  onChange={(e) => setNewClsText(e.target.value)}
                  placeholder="Dán hoặc gõ nhanh kết quả xét nghiệm vừa trả từ HIS (e.g. CTM: WBC 14.2, HGB 110, PLT 65; Sinh hóa: K+ 3.2, Creatinine 115, Troponin hs 45, ECG: Rung nhĩ...)"
                  className="w-full p-2.5 bg-white border border-blue-200 rounded-lg text-xs font-mono font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent leading-relaxed"
                />

                {/* Kết quả phân tích tự động, gọn gàng, kèm so sánh với ngày trước */}
                {parsedClsComparison.length > 0 && (
                  <div className="bg-white p-2.5 rounded-lg border border-blue-200 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs flex-wrap gap-1">
                      <span className="font-extrabold text-[#0b4d8c] flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Đã tự động phân tích & sắp xếp ({parsedClsComparison.length} chỉ số):</span>
                      </span>
                      <div className="flex items-center gap-1.5 text-[10.5px]">
                        {clsPanicCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-black animate-pulse">
                            🚨 {clsPanicCount} Báo động đỏ
                          </span>
                        )}
                        {clsAbnormalCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-bold">
                            ⚠️ {clsAbnormalCount} Bất thường
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {parsedClsComparison.map((item) => (
                        <div
                          key={item.id}
                          className={`p-2 rounded-lg border text-xs flex items-start justify-between gap-1.5 ${
                            item.isPanicValue
                              ? 'bg-rose-50 border-rose-300 text-rose-950 font-black shadow-2xs'
                              : item.isAbnormal
                              ? 'bg-amber-50/70 border-amber-300 text-amber-950 font-bold shadow-2xs'
                              : 'bg-slate-50 border-slate-200 text-slate-800 font-medium'
                          }`}
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-1 flex-wrap">
                              {item.isPanicValue && <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />}
                              <span className="font-bold text-slate-900">{item.testName}:</span>
                              <span className="font-mono font-extrabold">{item.value}</span>
                              {item.unit && <span className="text-[10px] text-slate-500 font-mono">{item.unit}</span>}
                            </div>
                            
                            {/* Hiển thị so sánh với các ngày trước */}
                            {item.diffText ? (
                              <div className={`text-[10.5px] font-bold flex items-center gap-1 ${
                                item.changeTrend === 'INCREASED' ? 'text-blue-700' :
                                item.changeTrend === 'DECREASED' ? 'text-indigo-700' :
                                'text-slate-600'
                              }`}>
                                <span>{item.diffText}</span>
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-400 italic">
                                Chưa có dữ liệu so sánh ngày trước
                              </div>
                            )}
                          </div>

                          {/* Badge trạng thái */}
                          <span className={`text-[9.5px] font-black uppercase px-1.5 py-0.2 rounded shrink-0 ${
                            item.isPanicValue ? 'bg-rose-600 text-white animate-pulse' :
                            item.isAbnormal ? 'bg-amber-500 text-white' :
                            'bg-emerald-600 text-white'
                          }`}>
                            {item.isPanicValue ? 'Báo động' : item.isAbnormal ? 'Bất thường' : 'Bình thường'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* KHỐI 3: CẬP NHẬT CHẨN ĐOÁN & GẮN NHÃN LÂM SÀNG ĐẶC BIỆT (ASSESSMENT) */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-black text-slate-900 text-xs uppercase flex items-center gap-1.5">
                    <Stethoscope className="w-3.5 h-3.5 text-[#0b4d8c]" />
                    <span>3. Chẩn Đoán & Nhãn Lâm Sàng Đặc Biệt <span className="text-rose-500">*</span></span>
                  </label>

                  <button
                    type="button"
                    onClick={handleCopyLatestDiagnosis}
                    className="text-[10.5px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-300 flex items-center gap-1 cursor-pointer transition-colors"
                    title="Sao chép lại chẩn đoán ban đầu của bệnh nhân"
                  >
                    <Copy className="w-3 h-3 text-slate-600" />
                    <span>Chẩn đoán gốc</span>
                  </button>
                </div>

                <textarea
                  rows={2}
                  value={diagnosis}
                  onChange={(e) => {
                    setDiagnosis(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Nhập chẩn đoán xác định / theo dõi: Cơn đau thắt ngực không ổn định / THA độ 2, ĐTĐ typ 2..."
                  className="w-full p-2 bg-slate-50/50 border border-slate-300 rounded-lg font-medium text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#0b4d8c] focus:border-transparent leading-relaxed"
                  required
                />

                {/* Nhãn thẻ lâm sàng */}
                <div className="pt-1.5 border-t border-slate-100 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-slate-600 uppercase flex items-center gap-1">
                      <Tags className="w-3 h-3 text-indigo-600" />
                      <span>Nhãn cảnh báo & Theo dõi đặc biệt:</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      {selectedTags.length > 0 ? `Đã gắn ${selectedTags.length} nhãn` : 'Bấm chọn nhãn'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {(Object.keys(CLINICAL_TAGS_META) as ClinicalTag[])
                      .filter((t) => t !== 'O2')
                      .map((tagKey) => {
                        const meta = CLINICAL_TAGS_META[tagKey];
                        const isSelected = selectedTags.includes(tagKey);
                        return (
                          <button
                            type="button"
                            key={tagKey}
                            onClick={() => handleToggleTag(tagKey)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                              isSelected
                                ? `${meta.badgeBg} ${meta.textColor} border-transparent shadow-xs font-black`
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                            title={meta.description}
                          >
                            <span>{isSelected ? '✓' : '+'}</span>
                            <span>{meta.shortLabel || meta.label}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* KHỐI 4: HƯỚNG XỬ TRÍ, Y LỆNH & CẢNH BÁO XÉT NGHIỆM (PLAN) */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="uppercase font-black text-slate-900 text-xs flex items-center gap-1.5">
                    <Pill className="w-3.5 h-3.5 text-[#0b4d8c]" />
                    <span>4. Hướng Xử Trí & Y Lệnh Điều Trị</span>
                  </span>

                  <button
                    type="button"
                    onClick={handleCopyLatestTreatmentAction}
                    className="text-[10.5px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-300 flex items-center gap-1 cursor-pointer transition-colors"
                    title="Sao chép hướng xử trí gần nhất"
                  >
                    <Copy className="w-2.5 h-2.5 text-slate-600" />
                    <span>Sao chép y lệnh trước</span>
                  </button>
                </div>

                {/* Textarea Y lệnh */}
                <textarea
                  rows={3}
                  value={treatmentAction}
                  onChange={(e) => setTreatmentAction(e.target.value)}
                  placeholder="Nhập y lệnh: Tiếp tục kháng sinh, hạ áp, giảm đau, theo dõi sát SpO2, chỉ định chụp CT sọ não..."
                  className="w-full p-2.5 bg-slate-50/50 border border-slate-300 rounded-lg font-medium text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#0b4d8c] focus:border-transparent leading-relaxed"
                />
              </div>

              {/* KHỐI 5: BÀN GIAO CA SAU & GHI CHÚ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Bàn giao */}
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-slate-800 font-bold text-[11px] uppercase">
                      <ArrowRightLeft className="w-3 h-3 text-slate-600" />
                      <span>5. Bàn Giao Ca Sau</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleInsertSbarTemplate}
                        className="text-[9.5px] font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-1.5 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        title="Chèn khung bàn giao ca trực chuẩn SBAR"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-teal-600" />
                        <span>Mẫu SBAR</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyLatestHandover}
                        className="text-[9.5px] font-bold text-slate-600 hover:text-slate-900 px-1.5 py-0.5 rounded hover:bg-slate-100 cursor-pointer"
                      >
                        Sao chép
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={3}
                    value={handoverNotes}
                    onChange={(e) => setHandoverNotes(e.target.value)}
                    placeholder="Dặn dò theo dõi ca sau hoặc bấm 'Mẫu SBAR'..."
                    className="w-full p-2 bg-slate-50/50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white leading-relaxed font-sans"
                  />
                </div>

                {/* Ghi chú khác */}
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-slate-800 font-bold text-[11px] uppercase">
                      <FileText className="w-3 h-3 text-slate-600" />
                      <span>Ghi Chú Trong Ngày</span>
                    </div>
                  </div>
                  <textarea
                    rows={2}
                    value={dailyNotes}
                    onChange={(e) => setDailyNotes(e.target.value)}
                    placeholder="Ghi chú thêm (nếu có)..."
                    className="w-full p-2 bg-slate-50/50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white"
                  />
                </div>
              </div>

            </div>

            {/* THANH FOOTER: CÁC NÚT LƯU VÀ HỦY */}
            <div className="pt-3 mt-2 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 bg-slate-50/90 sticky bottom-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-slate-700 hover:bg-slate-200/80 rounded-xl font-bold transition-colors cursor-pointer text-xs flex items-center gap-1.5"
              >
                <X className="w-4 h-4 text-slate-500" />
                <span>Hủy (Esc)</span>
              </button>

              <button
                type="submit"
                className="flex-1 sm:flex-initial px-4 sm:px-6 py-3 sm:py-2.5 min-h-[44px] bg-gradient-to-r from-[#0b4d8c] to-[#12589b] hover:from-[#083a69] hover:to-[#0e487f] text-white font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 text-xs sm:text-xs hover:shadow-lg"
              >
                <CheckCircle2 className="w-4 h-4 text-cyan-300 shrink-0" />
                <span>Lưu Diễn Tiến Lâm Sàng (Ctrl+Enter)</span>
              </button>
            </div>

          </form>

          {/* ========================================================================= */}
          {/* CỘT PHẢI (6 cols trên LG, 6 cols trên XL): LỊCH SỬ CLINICAL TIMELINE */}
          {/* ========================================================================= */}
          <div className={`lg:col-span-6 xl:col-span-6 p-3 sm:p-5 overflow-y-auto space-y-3 bg-white flex flex-col ${
            mobileTab === 'history' ? 'flex' : 'hidden sm:flex'
          }`}>
            
            {/* Header Lịch sử + Tìm kiếm & Bộ lọc */}
            <div className="space-y-2 pb-2 border-b border-slate-200 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                    <History className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-xs uppercase tracking-tight">
                      Dòng Thời Gian Diễn Tiến (Clinical Timeline)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Đối chiếu diễn biến & y lệnh theo thời gian
                    </p>
                  </div>
                </div>

                <span className="px-2.5 py-0.5 rounded-full bg-slate-900 text-white text-[11px] font-mono font-bold shadow-2xs">
                  {patient.evolutions?.length || 0} lần ghi nhận
                </span>
              </div>

              {/* Search bar & Shift Filter */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder="Tìm theo triệu chứng, thuốc, bác sĩ..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-400"
                  />
                  {historySearchQuery && (
                    <button
                      type="button"
                      onClick={() => setHistorySearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>


              </div>
            </div>

            {/* DANH SÁCH CLINICAL TIMELINE */}
            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              {filteredEvolutions.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 my-auto">
                  <History className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-extrabold text-slate-700">
                    {historySearchQuery || historyShiftFilter !== 'ALL'
                      ? 'Không tìm thấy diễn tiến phù hợp bộ lọc.'
                      : 'Chưa có diễn tiến nào được ghi nhận trước đó.'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Nhập diễn tiến ca đầu tiên ở cột bên trái để bắt đầu theo dõi bệnh nhân.
                  </p>
                </div>
              ) : (
                <div className="relative pl-5 before:absolute before:left-2 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 space-y-3">
                  {filteredEvolutions.map((evo, idx) => {
                    const isFirst = idx === 0 && !historySearchQuery && historyShiftFilter === 'ALL';
                    const correspondingVital = patient.vitals?.find((v) => v.timestamp === evo.timestamp);

                    return (
                      <div 
                        key={evo.id || idx} 
                        className={`relative p-3.5 rounded-xl border transition-all ${
                          isFirst 
                            ? 'bg-gradient-to-br from-indigo-50/60 to-white border-indigo-200 ring-1 ring-indigo-200 shadow-xs' 
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                        } space-y-2`}
                      >
                        {/* Timeline Node Icon */}
                        <div className={`absolute -left-[27px] top-4 w-4 h-4 rounded-full border-2 border-white shadow-2xs flex items-center justify-center ${
                          isFirst ? 'bg-indigo-600 ring-2 ring-indigo-200' : 'bg-slate-400'
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                        </div>

                        {/* Card Header: Ngày giờ, Ca trực, Bác sĩ, Nút áp dụng */}
                        <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-slate-100 text-xs">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-slate-900 flex items-center gap-1 font-mono">
                              <Clock className="w-3.5 h-3.5 text-slate-500 inline" />
                              {evo.timestamp}
                            </span>

                            <span className={`px-2 py-0.5 rounded-md font-bold text-[10.5px] border ${
                              evo.shift === 'Sáng'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : evo.shift === 'Chiều'
                                ? 'bg-orange-50 text-orange-800 border-orange-200'
                                : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            }`}>
                              Ca {evo.shift}
                            </span>

                            {isFirst && (
                              <span className="px-1.5 py-0.2 bg-indigo-600 text-white rounded text-[9px] font-black uppercase tracking-wider shadow-2xs">
                                Ca gần nhất
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                              BS. {formatDoctorShortName(evo.doctorName)}
                            </span>

                            {/* Nút áp dụng nhanh cả ca */}
                            <button
                              type="button"
                              onClick={() => handleApplyHistoricalEntry(evo)}
                              className="text-[10px] text-indigo-700 hover:text-white hover:bg-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-2 py-0.5 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              title="Điền toàn bộ diễn biến & y lệnh của ca này sang form bên trái"
                            >
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>Điền vào form</span>
                            </button>
                          </div>
                        </div>

                        {/* Sinh hiệu đo được nếu có */}
                        {correspondingVital && (
                          <div className="flex items-center gap-2 flex-wrap bg-slate-50 p-1.5 px-2.5 rounded-lg border border-slate-200/80 text-[10.5px] font-mono">
                            <span className="font-bold text-slate-500 font-sans text-[10px]">Sinh hiệu:</span>
                            <span className="font-extrabold text-slate-800">
                              HA: <strong className="text-rose-700">{correspondingVital.bpSystolic}/{correspondingVital.bpDiastolic}</strong> mmHg
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="font-extrabold text-slate-800">
                              Mạch: <strong className="text-amber-700">{correspondingVital.heartRate}</strong> l/p
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="font-extrabold text-slate-800">
                              SpO2: <strong className="text-cyan-700">{correspondingVital.spO2}%</strong>
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="font-extrabold text-slate-800">
                              T°: <strong className="text-slate-700">{correspondingVital.temperature}°C</strong>
                            </span>
                          </div>
                        )}

                        {/* Diễn biến lâm sàng */}
                        <div className="text-xs space-y-0.5">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight flex items-center gap-1">
                            <FileText className="w-3 h-3 text-slate-400" />
                            <span>Diễn biến lâm sàng:</span>
                          </span>
                          <p className="text-slate-800 font-medium leading-relaxed bg-slate-50/70 p-2.5 rounded-lg border border-slate-200 whitespace-pre-wrap">
                            {evo.clinicalNote}
                          </p>
                        </div>

                        {/* Hướng xử trí & Y lệnh */}
                        {evo.treatmentAction && (
                          <div className="text-xs space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-emerald-800 uppercase tracking-tight flex items-center gap-1">
                                <Pill className="w-3 h-3 text-emerald-600" />
                                <span>Kế hoạch điều trị / Y lệnh:</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyHistoricalPlanOnly(evo.treatmentAction)}
                                className="text-[9.5px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-0.5"
                                title="Chỉ chép y lệnh này sang form"
                              >
                                <Copy className="w-2.5 h-2.5" />
                                <span>Chép y lệnh</span>
                              </button>
                            </div>
                            <p className="text-slate-900 font-medium leading-relaxed bg-emerald-50/40 p-2.5 rounded-lg border border-emerald-200 whitespace-pre-wrap">
                              {evo.treatmentAction}
                            </p>
                          </div>
                        )}

                        {/* Bàn giao hoặc Ghi chú */}
                        {evo.notes && (
                          <div className="text-xs space-y-0.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                              Ghi chú thêm:
                            </span>
                            <p className="text-slate-700 font-medium leading-relaxed bg-slate-50/50 p-2 rounded-lg border border-slate-200/60 text-[11px]">
                              {evo.notes}
                            </p>
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};

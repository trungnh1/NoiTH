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
import { isRealAllergy } from '../utils/clinicalTextParser';
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
  CheckCheck
} from 'lucide-react';
import { calculateTreatmentDays, formatDoctorShortName } from './DetailedPatientListView';
import { formatPatientDisplayName } from '../utils/storage';
import { getSavedDoctorSession } from '../utils/auth';
import { getCriticalLabAlerts } from '../utils/labAlerts';

// Ngưỡng sinh hiệu tiêu chuẩn lâm sàng
export type VitalStatus = 'normal' | 'warning' | 'critical' | 'empty';

export function getBpSysStatus(valStr: string): VitalStatus {
  if (!valStr.trim()) return 'empty';
  const val = Number(valStr);
  if (isNaN(val)) return 'empty';
  if (val >= 160 || val < 85) return 'critical'; // Đỏ: Tăng huyết áp độ 2-3 hoặc tụt HA nặng
  if (val >= 140 || val < 90) return 'warning'; // Vàng: THA độ 1 hoặc HA thấp
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
  if (val >= 38.5 || val < 35.5) return 'critical'; // Đỏ: Sốt cao >= 38.5°C hoặc hạ thân nhiệt
  if (val >= 37.5 || val < 36.0) return 'warning'; // Vàng: Sốt nhẹ 37.5-38.4°C
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
  const [shift, setShift] = useState<'Sáng' | 'Chiều' | 'Đêm / Trực'>('Sáng');
  
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
  const [dailyNotes, setDailyNotes] = useState('');
  const [handoverNotes, setHandoverNotes] = useState(patient.handoverNotes || patient.importantNotes || '');

  // Sinh hiệu nhanh
  const latestVital = patient.vitals?.[0];
  const [bpSys, setBpSys] = useState<string>(latestVital?.bpSystolic ? String(latestVital.bpSystolic) : '');
  const [bpDia, setBpDia] = useState<string>(latestVital?.bpDiastolic ? String(latestVital.bpDiastolic) : '');
  const [pulse, setPulse] = useState<string>(latestVital?.heartRate ? String(latestVital.heartRate) : '');
  const [temperature, setTemperature] = useState<string>(latestVital?.temperature ? String(latestVital.temperature) : '');
  const [spO2, setSpO2] = useState<string>(latestVital?.spO2 ? String(latestVital.spO2) : '');

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
    setTreatmentAction('');
    setDailyNotes('');
    setHandoverNotes('');
    setBpSys('');
    setBpDia('');
    setPulse('');
    setTemperature('');
    setSpO2('');
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

    const updatedPatient: Patient = {
      ...patient,
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
      text: Number(temperature) >= 38.5 ? `Sốt cao (${temperature}°C >= 38.5)` : `Hạ thân nhiệt (${temperature}°C < 35.5)`,
      isCritical: true,
    });
  } else if (tempStatus === 'warning') {
    vitalAlerts.push({ text: `Thân nhiệt ranh giới (${temperature}°C)`, isCritical: false });
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
                  Nhập Diễn Tiến Ca Trực
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

          {/* Cảnh báo xét nghiệm nguy hiểm nếu có */}
          {criticalLabAlerts.length > 0 && (
            <div className="flex items-center gap-1.5 bg-rose-100 border border-rose-300 text-rose-900 px-2.5 py-0.5 rounded-lg text-[11px] font-bold animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>Phát hiện {criticalLabAlerts.length} chỉ số cận lâm sàng bất thường nguy hiểm!</span>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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

                  {/* Ca trực */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1 text-[11px]">
                      Ca Trực
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      {(['Sáng', 'Chiều', 'Đêm / Trực'] as const).map((s) => (
                        <button
                          type="button"
                          key={s}
                          onClick={() => setShift(s)}
                          className={`py-1.5 rounded-md font-bold text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1 ${
                            shift === s
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                          }`}
                        >
                          {s === 'Sáng' && <Sun className="w-3 h-3 text-amber-400" />}
                          {s === 'Chiều' && <Sunset className="w-3 h-3 text-orange-400" />}
                          {s === 'Đêm / Trực' && <Moon className="w-3 h-3 text-indigo-300" />}
                          <span>{s === 'Đêm / Trực' ? 'Đêm' : s}</span>
                        </button>
                      ))}
                    </div>
                  </div>
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
                      <span>Sinh Hiệu Ca Trực</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">(Tự động cảnh báo màu theo ngưỡng y khoa)</span>
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

                {/* Smart Quick Chips cho Diễn biến lâm sàng */}
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold block">
                    Gợi ý mẫu nhanh (Bấm để chèn vào diễn biến):
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-0.5">
                    {QUICK_CLINICAL_SYMPTOMS.map((chip, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => handleAddSymptomChip(chip)}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 text-slate-700 border border-slate-200 transition-colors cursor-pointer flex items-center gap-0.5"
                      >
                        <Plus className="w-2.5 h-2.5 text-slate-400" />
                        <span>{chip}</span>
                      </button>
                    ))}
                  </div>
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

                {/* Smart Quick Chips cho Y lệnh */}
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold block">
                    Gợi ý y lệnh nhanh (Bấm để chèn vào y lệnh):
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-0.5">
                    {QUICK_TREATMENT_PLANS.map((chip, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => handleAddTreatmentChip(chip)}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-slate-700 border border-slate-200 transition-colors cursor-pointer flex items-center gap-0.5"
                      >
                        <Plus className="w-2.5 h-2.5 text-slate-400" />
                        <span>{chip}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Textarea Y lệnh */}
                <textarea
                  rows={3}
                  value={treatmentAction}
                  onChange={(e) => setTreatmentAction(e.target.value)}
                  placeholder="Nhập y lệnh: Tiếp tục kháng sinh, hạ áp, giảm đau, theo dõi sát SpO2, chỉ định chụp CT sọ não..."
                  className="w-full p-2.5 bg-slate-50/50 border border-slate-300 rounded-lg font-medium text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#0b4d8c] focus:border-transparent leading-relaxed"
                />

                {/* Cảnh báo cận lâm sàng nguy hiểm ngay dưới y lệnh để bác sĩ lưu ý */}
                {criticalLabAlerts.length > 0 && (
                  <div className="mt-2 p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-950 space-y-1 animate-in fade-in">
                    <div className="flex items-center gap-1.5 font-black text-xs text-rose-800 uppercase tracking-wide">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Cảnh báo xét nghiệm bất thường nguy hiểm (Panic Values):</span>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] font-bold text-rose-900 pl-1">
                      {criticalLabAlerts.map((alert, idx) => (
                        <li key={idx}>{alert}</li>
                      ))}
                    </ul>
                  </div>
                )}
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
                    <button
                      type="button"
                      onClick={handleCopyLatestHandover}
                      className="text-[9.5px] font-bold text-slate-600 hover:text-slate-900 px-1.5 py-0.2 rounded hover:bg-slate-100"
                    >
                      Sao chép
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={handoverNotes}
                    onChange={(e) => setHandoverNotes(e.target.value)}
                    placeholder="Dặn dò theo dõi ca sau..."
                    className="w-full p-2 bg-slate-50/50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white"
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
                className="px-6 py-2.5 bg-gradient-to-r from-[#0b4d8c] to-[#12589b] hover:from-[#083a69] hover:to-[#0e487f] text-white font-extrabold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-98 text-xs hover:shadow-lg"
              >
                <CheckCircle2 className="w-4 h-4 text-cyan-300" />
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
                      Đối chiếu diễn biến & y lệnh theo từng ca trực
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

                {/* Filter Ca trực */}
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0 text-[11px]">
                  {(['ALL', 'Sáng', 'Chiều', 'Đêm / Trực'] as const).map((sh) => (
                    <button
                      type="button"
                      key={sh}
                      onClick={() => setHistoryShiftFilter(sh)}
                      className={`px-2 py-1 rounded font-bold transition-all cursor-pointer ${
                        historyShiftFilter === sh
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {sh === 'ALL' ? 'Tất cả' : sh === 'Đêm / Trực' ? 'Đêm' : sh}
                    </button>
                  ))}
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

import { formatPatientDisplayName } from '../utils/storage';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Patient, 
  Doctor, 
  DepartmentRoom, 
  SeverityLevel, 
  ClinicalTag, 
  CLINICAL_TAGS_META,
  VitalSign,
  ClinicalEvolution
} from '../types/patient';
import { GROUP_1_ROOM_NUMBERS, GROUP_1_DOCTOR_IDS, GROUP_2_DOCTOR_IDS, CARDIO_DOCTOR_IDS } from '../data/mockData';
import { formatDoctorShortName } from './DetailedPatientListView';
import { sortDoctorsAlphabetically } from '../utils/doctorSorter';
import { 
  X, 
  UserPlus, 
  AlertTriangle, 
  Stethoscope, 
  HeartPulse, 
  Building2, 
  Activity, 
  ClipboardList,
  History,
  ArrowRightLeft,
  FileText,
  ShieldAlert,
  FileEdit,
  Sparkles,
  Cpu,
  Key,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { 
  analyzeClinicalNote, 
  loadAIConfig, 
  saveAIConfig, 
  AIAnalysisConfig, 
  AIProvider 
} from '../services/aiClinicalService';
import { 
  getBpSysStatus, 
  getBpDiaStatus, 
  getPulseStatus, 
  getSpO2Status, 
  getTempStatus, 
  getVitalInputClass 
} from './QuickEvolutionModal';

interface SimplifiedNewPatientModalProps {
  rooms: DepartmentRoom[];
  doctors: Doctor[];
  patients: Patient[];
  patientToEdit?: Patient;
  isImportMode?: boolean;
  prefilledRoom?: string;
  prefilledBed?: string;
  currentUser?: Doctor | null;
  onClose: () => void;
  onAddPatient?: (newPatient: Patient) => void;
  onUpdatePatient?: (updatedPatient: Patient) => void;
}

// Quick initial treatment orders
const QUICK_ORDERS = [
  'Nghỉ ngơi tại giường, ăn giảm muối',
  'Thở oxy qua kính 2-3 l/p khi SpO2 < 95%',
  'Chỉ định XN CTM, Sinh hóa, ECG',
  'Kháng sinh TM + Khí dung',
  'TD đường huyết mao mạch trước ăn'
];

export const SimplifiedNewPatientModal: React.FC<SimplifiedNewPatientModalProps> = ({
  rooms,
  doctors,
  patients,
  patientToEdit,
  isImportMode = false,
  prefilledRoom,
  currentUser,
  onClose,
  onAddPatient,
  onUpdatePatient,
}) => {
  const isEditing = !!patientToEdit && !isImportMode;
  const nameInputRef = useRef<HTMLInputElement>(null);
  const now = new Date();
  const defaultDateTimeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Logged-in doctor takes precedence as attending/entering doctor
  const defaultDocId = currentUser?.id || patientToEdit?.attendingDoctorId || doctors[0]?.id || '00979';

  // Form states
  const [fullName, setFullName] = useState(patientToEdit?.fullName || '');
  const [age, setAge] = useState<number>(patientToEdit?.age ?? 60);
  const [gender, setGender] = useState<'Nam' | 'Nữ'>(patientToEdit?.gender || 'Nam');
  const [roomNumber, setRoomNumber] = useState<string>(patientToEdit?.roomNumber || prefilledRoom || '703');
  const [admissionDateTime, setAdmissionDateTime] = useState<string>(() => {
    if (patientToEdit?.admissionDate) {
      const formatted = patientToEdit.admissionDate.replace(' ', 'T');
      if (formatted.length >= 16) return formatted.slice(0, 16);
      if (formatted.length === 10) return `${formatted}T08:00`;
    }
    return defaultDateTimeStr;
  });

  const [primaryDiagnosis, setPrimaryDiagnosis] = useState(patientToEdit?.primaryDiagnosis || '');
  
  // Tiền sử & Dị ứng (có nút tích chọn có dị ứng)
  const [medicalHistory, setMedicalHistory] = useState(patientToEdit?.medicalHistory || '');
  const [hasAllergy, setHasAllergy] = useState<boolean>(() => {
    if (patientToEdit) {
      return Boolean(patientToEdit.allergies || patientToEdit.tags?.includes('ALLERGY'));
    }
    return false;
  });
  const [allergyDetails, setAllergyDetails] = useState(patientToEdit?.allergies || '');

  // Diễn tiến lâm sàng lúc tiếp nhận (tùy chọn)
  const [admissionClinicalNote, setAdmissionClinicalNote] = useState(() => {
    if (patientToEdit?.evolutions && patientToEdit.evolutions.length > 0) {
      return patientToEdit.evolutions[0].clinicalNote || '';
    }
    return '';
  });

  const [severity, setSeverity] = useState<SeverityLevel>(patientToEdit?.severity || 'STABLE');
  const [selectedTags, setSelectedTags] = useState<ClinicalTag[]>(patientToEdit?.tags || []);

  // Bác sĩ phụ trách: Nếu nhập từ BN vệ tinh (isImportMode) hoặc chưa chọn, để trống bác sĩ điều trị ('')
  const [attendingDoctorId, setAttendingDoctorId] = useState<string>(() => {
    if (isImportMode) {
      return patientToEdit?.attendingDoctorId || '';
    }
    if (isEditing) {
      return patientToEdit?.attendingDoctorId || '';
    }
    return currentUser?.id || doctors[0]?.id || '';
  });
  const [treatmentPlan, setTreatmentPlan] = useState(patientToEdit?.treatmentPlan || '');
  
  // Tách riêng: Bàn giao tua trực (ở trên) & Ghi chú (ở dưới)
  const [handoverNotes, setHandoverNotes] = useState(patientToEdit?.handoverNotes || '');
  const [importantNotes, setImportantNotes] = useState(patientToEdit?.importantNotes || '');

  // Initial vitals - lấy sinh hiệu gần nhất nếu sửa, hoặc để trống nếu thêm mới
  const latestVital = patientToEdit?.vitals && patientToEdit.vitals.length > 0
    ? patientToEdit.vitals[patientToEdit.vitals.length - 1]
    : undefined;

  const [bpSys, setBpSys] = useState<string>(latestVital?.bpSystolic ? String(latestVital.bpSystolic) : '');
  const [bpDia, setBpDia] = useState<string>(latestVital?.bpDiastolic ? String(latestVital.bpDiastolic) : '');
  const [pulse, setPulse] = useState<string>(latestVital?.heartRate ? String(latestVital.heartRate) : '');
  const [temperature, setTemperature] = useState<string>(latestVital?.temperature ? String(latestVital.temperature) : '');
  const [spO2, setSpO2] = useState<string>(latestVital?.spO2 ? String(latestVital.spO2) : '');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Smart Paste & AI Clinical Intake (Gemini, DeepSeek & Offline Regex)
  const [smartPasteText, setSmartPasteText] = useState('');
  const [showSmartPaste, setShowSmartPaste] = useState(false);
  const [smartPasteMsg, setSmartPasteMsg] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiConfig, setAiConfig] = useState<AIAnalysisConfig>(loadAIConfig);
  const [showAiConfigModal, setShowAiConfigModal] = useState(false);
  const [tempGeminiKey, setTempGeminiKey] = useState(aiConfig.geminiApiKey || '');
  const [tempDeepseekKey, setTempDeepseekKey] = useState(aiConfig.deepseekApiKey || '');

  const handleSmartPasteParse = async () => {
    if (!smartPasteText.trim()) return;
    setIsAnalyzing(true);
    setSmartPasteMsg(null);

    try {
      const parsed = await analyzeClinicalNote(smartPasteText, aiConfig);

      if (parsed.fullName) {
        setFullName(parsed.fullName);
      }
      if (parsed.age) {
        setAge(parsed.age);
      }
      if (parsed.gender) {
        setGender(parsed.gender);
      }
      if (parsed.diagnosis) {
        setPrimaryDiagnosis(parsed.diagnosis);
      }
      if (parsed.treatmentPlan) {
        setTreatmentPlan(parsed.treatmentPlan);
      }
      if (parsed.medicalHistory) {
        setMedicalHistory(parsed.medicalHistory);
      }
      if (parsed.clinicalNote) {
        setAdmissionClinicalNote(parsed.clinicalNote);
      }
      if (parsed.severity) {
        setSeverity(parsed.severity);
      }
      if (parsed.suggestedTags && parsed.suggestedTags.length > 0) {
        setSelectedTags((prev) => {
          const combined = new Set([...prev, ...parsed.suggestedTags]);
          return Array.from(combined);
        });
      }

      const modeName = aiConfig.provider === 'gemini' 
        ? 'Google Gemini AI' 
        : aiConfig.provider === 'deepseek' 
        ? 'DeepSeek AI' 
        : 'Thuật toán lâm sàng nội khoa';

      setSmartPasteMsg(`✓ Đã phân tích thành công (${modeName}) và tự động điền đầy đủ Chẩn đoán, Kế hoạch, Tiền sử!`);
      setTimeout(() => setSmartPasteMsg(null), 5000);
    } catch (err: any) {
      console.error('Lỗi phân tích bệnh án:', err);
      setSmartPasteMsg(`Lỗi phân tích: ${err.message || 'Không thể bóc tách dữ liệu'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveAiKeys = () => {
    const updated: AIAnalysisConfig = {
      ...aiConfig,
      geminiApiKey: tempGeminiKey.trim() || undefined,
      deepseekApiKey: tempDeepseekKey.trim() || undefined,
    };
    setAiConfig(updated);
    saveAIConfig(updated);
    setShowAiConfigModal(false);
    setSmartPasteMsg('Đã lưu cấu hình API Key!');
    setTimeout(() => setSmartPasteMsg(null), 3000);
  };

  // 3 Clinical Doctor Groups for 1-click select (sắp xếp theo thứ tự ABC của tên BS)
  const group1Doctors = useMemo(() => {
    const list = doctors.filter(
      (d) => (GROUP_1_DOCTOR_IDS.includes(d.id) || /trần hữu ngọc|nguyễn hữu trung|đỗ thị vân huyền|phạm cao thiên|đặng thị ngọc ánh|trần bùi bình chi/i.test(d.name)) &&
      !/tuế|quyên/i.test(d.name) && d.id !== '00101' && d.id !== '00199'
    );
    return sortDoctorsAlphabetically(list);
  }, [doctors]);

  const group2Doctors = useMemo(() => {
    const list = doctors.filter(
      (d) => (GROUP_2_DOCTOR_IDS.includes(d.id) || /thái thị thùy linh|dương thị hoài|nguyễn thị ngọc mai|đỗ thị ngoan|nguyễn thị phương chi/i.test(d.name)) &&
      !/bình chi/i.test(d.name) &&
      !/tuế|quyên/i.test(d.name) && d.id !== '00101' && d.id !== '00199'
    );
    return sortDoctorsAlphabetically(list);
  }, [doctors]);

  const cardioDoctors = useMemo(() => {
    const list = doctors.filter(
      (d) => (CARDIO_DOCTOR_IDS.includes(d.id) || /nguyễn văn phương nhật|võ văn thọ|võ hồng thịnh|trương hoài lam|đồng văn luận/i.test(d.name)) &&
      !/tuế|quyên/i.test(d.name) && d.id !== '00101' && d.id !== '00199'
    );
    return sortDoctorsAlphabetically(list);
  }, [doctors]);

  // Current room active patient count
  const roomPatientCount = useMemo(() => {
    return patients.filter((p) => p.status === 'ACTIVE' && p.roomNumber === roomNumber).length;
  }, [roomNumber, patients]);

  // Sync allergy checkbox with clinical tags (gán thẻ lâm sàng đặc biệt: Dị ứng)
  const handleToggleAllergy = (checked: boolean) => {
    setHasAllergy(checked);
    if (checked) {
      setSelectedTags((prev) => (prev.includes('ALLERGY') ? prev : [...prev, 'ALLERGY']));
    } else {
      setSelectedTags((prev) => prev.filter((t) => t !== 'ALLERGY'));
      setAllergyDetails('');
    }
  };

  // Auto focus name input on open
  useEffect(() => {
    if (nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, []);

  // Global hotkeys: Esc to close, Ctrl+Enter to submit
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
  }, [fullName, primaryDiagnosis, medicalHistory, hasAllergy, allergyDetails, admissionClinicalNote, attendingDoctorId, roomNumber, age, gender, severity, treatmentPlan, handoverNotes, importantNotes, bpSys, bpDia, pulse, temperature, spO2]);

  const toggleTag = (tag: ClinicalTag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags((prev) => prev.filter((t) => t !== tag));
      if (tag === 'ALLERGY') {
        setHasAllergy(false);
        setAllergyDetails('');
      }
    } else {
      setSelectedTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
      if (tag === 'ALLERGY') {
        setHasAllergy(true);
      }
    }
  };

  const handleAddOrderChip = (order: string) => {
    setTreatmentPlan((prev) => {
      const cleanPrev = prev.trim();
      if (!cleanPrev) return `- ${order}`;
      if (cleanPrev.toLowerCase().includes(order.toLowerCase())) return cleanPrev;
      return `${cleanPrev}\n- ${order}`;
    });
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!fullName.trim()) {
      setErrorMsg('Vui lòng nhập họ và tên bệnh nhân.');
      if (nameInputRef.current) nameInputRef.current.focus();
      return;
    }
    if (!primaryDiagnosis.trim()) {
      setErrorMsg('Vui lòng nhập chẩn đoán lâm sàng của bệnh nhân.');
      return;
    }

    const formattedAdmissionDate = admissionDateTime.replace('T', ' ');
    const assignedDoctor = doctors.find((d) => d.id === attendingDoctorId);

    // Kiểm tra xem người dùng có nhập sinh hiệu không
    const hasVitalsEntered = !!(bpSys.trim() || bpDia.trim() || pulse.trim() || temperature.trim() || spO2.trim());
    const initialVitalsList: VitalSign[] = [];

    if (hasVitalsEntered) {
      initialVitalsList.push({
        id: `V-${Date.now()}`,
        timestamp: formattedAdmissionDate,
        bpSystolic: bpSys ? Number(bpSys) : 120,
        bpDiastolic: bpDia ? Number(bpDia) : 80,
        heartRate: pulse ? Number(pulse) : 80,
        temperature: temperature ? Number(temperature) : 37.0,
        spO2: spO2 ? Number(spO2) : 98,
        respiratoryRate: 20,
        notes: 'Sinh hiệu lúc nhập khoa',
      });
    }

    // Diễn tiến lâm sàng lúc tiếp nhận: nếu nhập thì lấy, không thì dùng mặc định khoa học
    const evolutionNoteText = admissionClinicalNote.trim() 
      ? admissionClinicalNote.trim()
      : `Tiếp nhận bệnh nhân vào Phòng ${roomNumber}. Chẩn đoán: ${primaryDiagnosis.trim()}.${medicalHistory.trim() ? ` Tiền sử: ${medicalHistory.trim()}` : ''}${hasAllergy && allergyDetails.trim() ? ` [Dị ứng: ${allergyDetails.trim()}]` : ''}`;

    const initialEvolution: ClinicalEvolution = {
      id: `EV-${Date.now()}`,
      timestamp: formattedAdmissionDate,
      doctorName: assignedDoctor?.name || 'BS Điều trị',
      shift: 'Sáng',
      clinicalNote: evolutionNoteText,
      treatmentAction: treatmentPlan.trim() || 'Chỉ định cận lâm sàng thường quy, y lệnh điều trị ban đầu và theo dõi sinh hiệu.',
    };

    const newPatient: Patient = {
      id: `PAT-${Date.now()}`,
      patientCode: `BN-${Date.now().toString().slice(-6)}`,
      fullName: formatPatientDisplayName(fullName.trim()),
      gender,
      age: Number(age) || 50,
      dateOfBirth: `${now.getFullYear() - (Number(age) || 50)}-01-01`,
      admissionDate: formattedAdmissionDate,
      department: 'Khoa Nội Tổng Hợp',
      roomNumber,
      bedNumber: '', // Không phân biệt số giường
      attendingDoctorId,
      primaryNurse: 'ĐD. Tua trực tiếp nhận',
      primaryDiagnosis: primaryDiagnosis.trim(),
      secondaryDiagnosis: undefined,
      medicalHistory: medicalHistory.trim() || undefined,
      allergies: hasAllergy ? (allergyDetails.trim() || 'Có dị ứng thuốc/thức ăn') : undefined,
      severity,
      admissionStatus: 'ADMITTED_TODAY',
      tags: selectedTags,
      treatmentPlan: treatmentPlan.trim() || 'Theo dõi sinh hiệu, điều trị theo phác đồ nội khoa.',
      importantNotes: importantNotes.trim() || undefined,
      handoverNotes: handoverNotes.trim() || undefined,
      initialLabsText: patientToEdit?.initialLabsText || undefined,
      status: 'ACTIVE',
      vitals: initialVitalsList,
      evolutions: [initialEvolution],
      labs: [],
      medications: [],
    };

    if (isEditing && patientToEdit) {
      let updatedVitals = [...(patientToEdit.vitals || [])];
      if (hasVitalsEntered) {
        updatedVitals.push({
          id: `V-${Date.now()}`,
          timestamp: formattedAdmissionDate,
          bpSystolic: bpSys ? Number(bpSys) : 120,
          bpDiastolic: bpDia ? Number(bpDia) : 80,
          heartRate: pulse ? Number(pulse) : 80,
          temperature: temperature ? Number(temperature) : 37.0,
          spO2: spO2 ? Number(spO2) : 98,
          respiratoryRate: 20,
          notes: 'Sinh hiệu cập nhật',
        });
      }

      let updatedEvolutions = [...(patientToEdit.evolutions || [])];
      if (admissionClinicalNote.trim()) {
        if (updatedEvolutions.length > 0) {
          updatedEvolutions[0] = {
            ...updatedEvolutions[0],
            clinicalNote: admissionClinicalNote.trim(),
            treatmentAction: treatmentPlan.trim() || updatedEvolutions[0].treatmentAction,
          };
        } else {
          updatedEvolutions.push(initialEvolution);
        }
      }

      const updatedPatient: Patient = {
        ...patientToEdit,
        fullName: formatPatientDisplayName(fullName.trim()),
        gender,
        age: Number(age) || 50,
        dateOfBirth: `${now.getFullYear() - (Number(age) || 50)}-01-01`,
        admissionDate: formattedAdmissionDate,
        roomNumber,
        attendingDoctorId,
        primaryDiagnosis: primaryDiagnosis.trim(),
        medicalHistory: medicalHistory.trim() || undefined,
        allergies: hasAllergy ? (allergyDetails.trim() || 'Có dị ứng thuốc/thức ăn') : undefined,
        severity,
        tags: selectedTags,
        treatmentPlan: treatmentPlan.trim() || patientToEdit.treatmentPlan,
        importantNotes: importantNotes.trim() || undefined,
        handoverNotes: handoverNotes.trim() || undefined,
        vitals: updatedVitals,
        evolutions: updatedEvolutions,
      };

      if (onUpdatePatient) {
        onUpdatePatient(updatedPatient);
      }
      onClose();
      return;
    }

    if (onAddPatient) {
      onAddPatient(newPatient);
    }
    onClose();
  };

  const currentDoctorName = doctors.find((d) => d.id === attendingDoctorId)?.name || 'Chưa chọn';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-in fade-in duration-150">
      {/* Light backdrop so the patient list and names on the left stay clearly visible */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-2xs transition-opacity cursor-pointer"
        title="Bấm bên ngoài để đóng"
      />

      {/* Right-side sliding drawer panel */}
      <div className="relative w-full sm:w-[96vw] md:w-[95vw] lg:w-[94vw] max-w-[1850px] bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col z-10 animate-in slide-in-from-right duration-200 overflow-hidden">
        
        {/* Header - Phong cách BV Hùng Vương Gia Lai */}
        <div className="px-6 py-3.5 bg-[#0b4d8c] text-white flex items-center justify-between border-b border-[#083a69] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-white border border-white/20">
              {isEditing ? (
                <FileEdit className="w-4 h-4 text-white" />
              ) : (
                <UserPlus className="w-4 h-4 text-white" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black tracking-tight text-white">
                  {isEditing ? `Chỉnh Sửa Bệnh Nhân: ${formatPatientDisplayName(patientToEdit?.fullName || "")}` : 'Tiếp Nhận Bệnh Nhân Nội Trú Mới'}
                </h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-white/15 text-white border border-white/20">
                  BV Đa Khoa Hùng Vương Gia Lai
                </span>
              </div>
              <p className="text-xs text-blue-100">
                {isEditing
                  ? 'Cập nhật thông tin hành chính, sinh hiệu, chẩn đoán và điều trị'
                  : 'Nhập thông tin hành chính, sinh hiệu, chẩn đoán và bàn giao'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block text-[11px] text-blue-100 bg-[#083a69] px-2.5 py-1 rounded border border-blue-400/30 font-mono">
              Esc để đóng • Ctrl+Enter để lưu
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-blue-100 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Đóng (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Body - 2 Cột khoa học, rộng rãi */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 font-bold flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Top 2-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* CỘT TRÁI (4.5 cols): Dán nhanh HIS, Buồng phòng, Hành chính & Sinh hiệu ban đầu */}
            <div className="lg:col-span-4 xl:col-span-4 space-y-3.5">
              
              {/* Dán Nhanh Bệnh Án Cũ / HIS & AI Clinical Intake */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-blue-200/80 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[#0b4d8c] font-black text-xs uppercase">
                    <ClipboardList className="w-3.5 h-3.5 text-[#0b4d8c]" />
                    <span>Dán Nhanh Bệnh Án / Nhập Bằng AI</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowAiConfigModal(!showAiConfigModal)}
                      className="text-[10px] font-bold text-slate-600 hover:text-[#0b4d8c] bg-white px-2 py-0.5 rounded border border-slate-300 flex items-center gap-1 cursor-pointer transition-colors"
                      title="Cấu hình API Key Gemini, DeepSeek hoặc xem hướng dẫn bảo mật trên Vercel"
                    >
                      <Key className="w-3 h-3 text-slate-500" />
                      <span>API Key / Vercel</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSmartPaste(!showSmartPaste)}
                      className="text-[11px] font-bold text-[#0b4d8c] bg-blue-50 hover:bg-blue-100 px-2.5 py-0.5 rounded border border-blue-200 cursor-pointer transition-colors"
                    >
                      {showSmartPaste ? 'Thu gọn' : 'Mở ô dán'}
                    </button>
                  </div>
                </div>

                {/* Popover / Form Cấu hình API Key nếu người dùng muốn dùng Gemini hoặc DeepSeek */}
                {showAiConfigModal && (
                  <div className="p-3 bg-white border border-blue-300 rounded-xl space-y-2 animate-in fade-in shadow-md">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1">
                        <Cpu className="w-3.5 h-3.5 text-[#0b4d8c]" />
                        <span>Cài Đặt AI (Gemini & DeepSeek)</span>
                      </span>
                      <button 
                        type="button" 
                        onClick={() => setShowAiConfigModal(false)}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer text-xs"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-600 space-y-1">
                      <p>
                        💡 <strong>Bảo mật API trên Vercel:</strong> Khi deploy lên Vercel, cài biến môi trường <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold text-rose-600">GEMINI_API_KEY</code> hoặc <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold text-indigo-600">DEEPSEEK_API_KEY</code> trong Vercel Dashboard (Xem chi tiết file <strong className="text-blue-700">VERCEL_DEPLOYMENT_GUIDE.md</strong>).
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Hoặc nếu chạy thử nghiệm ngay tại trình duyệt, bạn có thể dán API Key trực tiếp dưới đây:
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div>
                        <label className="text-[10.5px] font-bold text-slate-700 block">
                          Gemini API Key (Google AI Studio)
                        </label>
                        <input
                          type="password"
                          value={tempGeminiKey}
                          onChange={(e) => setTempGeminiKey(e.target.value)}
                          placeholder="AIzaSy..."
                          className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-[10.5px] font-bold text-slate-700 block">
                          DeepSeek API Key (Platform DeepSeek)
                        </label>
                        <input
                          type="password"
                          value={tempDeepseekKey}
                          onChange={(e) => setTempDeepseekKey(e.target.value)}
                          placeholder="sk-..."
                          className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-mono"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleSaveAiKeys}
                          className="px-3 py-1 bg-[#0b4d8c] hover:bg-[#083a69] text-white text-xs font-bold rounded-lg cursor-pointer"
                        >
                          Lưu Cấu Hình
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {showSmartPaste && (
                  <div className="space-y-2 pt-1 animate-in fade-in">
                    {/* Chọn Chế Độ Phân Tích: Thuật toán Offline, Gemini hoặc DeepSeek */}
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span className="text-[10.5px] font-bold text-slate-600">Công nghệ bóc tách:</span>
                      <div className="inline-flex bg-white p-0.5 rounded-lg border border-slate-200 text-[10.5px]">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = { ...aiConfig, provider: 'offline_regex' as const };
                            setAiConfig(updated);
                            saveAIConfig(updated);
                          }}
                          className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                            aiConfig.provider === 'offline_regex'
                              ? 'bg-[#0b4d8c] text-white shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="Phân tích tức thời 0s không cần API / không cần mạng"
                        >
                          ⚡ Không cần AI (0s)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = { ...aiConfig, provider: 'gemini' as const };
                            setAiConfig(updated);
                            saveAIConfig(updated);
                          }}
                          className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                            aiConfig.provider === 'gemini'
                              ? 'bg-[#0b4d8c] text-white shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="Dùng mô hình Gemini 1.5 Flash"
                        >
                          🤖 Gemini
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = { ...aiConfig, provider: 'deepseek' as const };
                            setAiConfig(updated);
                            saveAIConfig(updated);
                          }}
                          className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                            aiConfig.provider === 'deepseek'
                              ? 'bg-[#0b4d8c] text-white shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="Dùng mô hình DeepSeek Chat"
                        >
                          🧠 DeepSeek
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-600">
                      Dán văn bản tóm tắt bệnh án, phiếu khám, giấy chuyển tuyến (Hệ thống tự động lọc <strong>* Vấn đề:</strong>, <strong>* Kế hoạch:</strong>, <strong>Tiền sử:</strong>, <strong>Lâm sàng & CLS</strong>).
                    </p>

                    <textarea
                      rows={4}
                      value={smartPasteText}
                      onChange={(e) => setSmartPasteText(e.target.value)}
                      placeholder="Dán tóm tắt bệnh án tại đây...
Ví dụ:
Bệnh nhân nam 61 tuổi vào viện vì đau cổ vai gáy
Tiền sử: tăng huyết áp...
Hiện tại: Bệnh tỉnh, tiếp xúc tốt...
* Vấn đề: Hội chứng cổ vai gáy - THA
* Kế hoạch điều trị: giảm đau, giãn cơ, mời PHCN"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-medium text-slate-800 focus:ring-2 focus:ring-[#0b4d8c]"
                    />

                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={handleSmartPasteParse}
                        disabled={isAnalyzing || !smartPasteText.trim()}
                        className="px-3.5 py-1.5 bg-[#0b4d8c] hover:bg-[#083a69] text-white rounded-lg font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
                      >
                        {isAnalyzing ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Đang bóc tách dữ liệu...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Phân tích & Tự động điền</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSmartPasteText('');
                          setShowSmartPaste(false);
                        }}
                        className="text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                      >
                        Đóng
                      </button>
                    </div>
                  </div>
                )}

                {smartPasteMsg && (
                  <div className="p-2.5 bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-bold animate-in fade-in flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{smartPasteMsg}</span>
                  </div>
                )}
              </div>

              {/* 1. Chọn Buồng Phòng */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-800 font-black text-xs uppercase">
                    <Building2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Buồng Phòng Tiếp Nhận</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">
                    Hiện có: {roomPatientCount} BN
                  </span>
                </div>

                <select
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-black text-slate-800 text-xs focus:ring-2 focus:ring-rose-500 focus:border-rose-500 cursor-pointer"
                >
                  <optgroup label="Buồng Phòng Nhóm 1 (703 - 731 & 733)">
                    {GROUP_1_ROOM_NUMBERS.map((num) => {
                      const count = patients.filter((p) => p.status === 'ACTIVE' && p.roomNumber === num).length;
                      return (
                        <option key={num} value={num}>
                          Phòng {num} ({count} bệnh nhân hiện tại)
                        </option>
                      );
                    })}
                  </optgroup>
                </select>
              </div>

              {/* 2. Thông tin Hành chính */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3 shadow-2xs">
                <div className="flex items-center gap-1.5 text-slate-800 font-black text-xs uppercase">
                  <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
                  <span>Hành Chính Bệnh Nhân</span>
                </div>

                {/* Họ tên */}
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">
                    Họ và Tên Bệnh Nhân <span className="text-rose-500">*</span>
                  </label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="VD: Nguyễn Văn An"
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-black text-xs tracking-wide focus:ring-2 focus:ring-rose-500 placeholder:normal-case"
                    required
                  />
                </div>

                {/* Tuổi & Giới tính */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="font-extrabold text-slate-700 block mb-1">
                      Tuổi <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={age}
                      onChange={(e) => setAge(Number(e.target.value))}
                      min={1}
                      max={120}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg font-black text-xs text-center focus:ring-2 focus:ring-rose-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-extrabold text-slate-700 block mb-1">
                      Giới Tính
                    </label>
                    <div className="grid grid-cols-2 gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setGender('Nam')}
                        className={`py-1.5 rounded font-black text-xs transition-all cursor-pointer ${
                          gender === 'Nam'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        ♂ Nam
                      </button>
                      <button
                        type="button"
                        onClick={() => setGender('Nữ')}
                        className={`py-1.5 rounded font-black text-xs transition-all cursor-pointer ${
                          gender === 'Nữ'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        ♀ Nữ
                      </button>
                    </div>
                  </div>
                </div>

                {/* Ngày giờ vào khoa */}
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">
                    Ngày Giờ Vào Viện / Nhập Khoa
                  </label>
                  <input
                    type="datetime-local"
                    value={admissionDateTime}
                    onChange={(e) => setAdmissionDateTime(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-xs focus:ring-2 focus:ring-rose-500 text-slate-700"
                    required
                  />
                </div>
              </div>

              {/* 3. Sinh Hiệu Ban Đầu (Tự động highlight đỏ/vàng khi ngoài ngưỡng an toàn) */}
              {(() => {
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
                  vitalAlerts.push({ text: `Mạch cảnh báo (${pulse} l/p)`, isCritical: false });
                }

                if (spO2Status === 'critical') {
                  vitalAlerts.push({ text: `SpO2 tụt thấp (${spO2}% < 94%)`, isCritical: true });
                } else if (spO2Status === 'warning') {
                  vitalAlerts.push({ text: `SpO2 ranh giới (${spO2}%)`, isCritical: false });
                }

                if (bpSysStatus === 'critical' || bpDiaStatus === 'critical') {
                  vitalAlerts.push({
                    text: `Huyết áp bất thường nguy hiểm (${bpSys || '--'}/${bpDia || '--'} mmHg)`,
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
                  vitalAlerts.push({ text: `Thân nhiệt cảnh báo (${temperature}°C)`, isCritical: false });
                }

                const hasCritical = vitalAlerts.some((a) => a.isCritical);

                return (
                  <div className={`p-3 rounded-xl border space-y-2 shadow-2xs transition-colors ${
                    hasCritical 
                      ? 'bg-rose-50/50 border-rose-300 ring-1 ring-rose-200' 
                      : vitalAlerts.length > 0 
                      ? 'bg-amber-50/50 border-amber-300' 
                      : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-slate-800 font-black text-[11px] uppercase">
                        <HeartPulse className={`w-3.5 h-3.5 ${hasCritical ? 'text-rose-600 animate-pulse' : 'text-rose-600'}`} />
                        <span>Sinh Hiệu Ban Đầu</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-semibold">(Tùy chọn)</span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      <div>
                        <label className="text-[9px] font-bold text-slate-600 block text-center truncate">HA (mmHg)</label>
                        <div className="flex items-center gap-0.5">
                          <input
                            type="number"
                            value={bpSys}
                            onChange={(e) => setBpSys(e.target.value)}
                            placeholder="120"
                            className={getVitalInputClass(bpSysStatus, 'w-full p-1 rounded text-center text-xs placeholder:font-normal placeholder:text-slate-300')}
                            title="Tâm thu: Bình thường 90-139, Vàng >=140, Đỏ >=160 hoặc <85"
                          />
                          <span className="text-slate-400 text-xs font-bold">/</span>
                          <input
                            type="number"
                            value={bpDia}
                            onChange={(e) => setBpDia(e.target.value)}
                            placeholder="80"
                            className={getVitalInputClass(bpDiaStatus, 'w-full p-1 rounded text-center text-xs placeholder:font-normal placeholder:text-slate-300')}
                            title="Tâm trương: Bình thường 60-89, Vàng >=90, Đỏ >=100 hoặc <55"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-slate-600 block text-center truncate">Mạch (l/p)</label>
                        <input
                          type="number"
                          value={pulse}
                          onChange={(e) => setPulse(e.target.value)}
                          placeholder="80"
                          className={getVitalInputClass(pulseStatus, 'w-full p-1 rounded text-center text-xs placeholder:font-normal placeholder:text-slate-300')}
                          title="Mạch: Bình thường 60-99, Vàng 100-120, Đỏ >120 hoặc <50"
                        />
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-slate-600 block text-center truncate">SpO2 (%)</label>
                        <input
                          type="number"
                          value={spO2}
                          onChange={(e) => setSpO2(e.target.value)}
                          placeholder="98"
                          className={getVitalInputClass(spO2Status, 'w-full p-1 rounded text-center text-xs placeholder:font-normal placeholder:text-slate-300')}
                          title="SpO2: Bình thường >=95%, Vàng 94%, Đỏ <94%"
                        />
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-slate-600 block text-center truncate">Nhiệt (°C)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={temperature}
                          onChange={(e) => setTemperature(e.target.value)}
                          placeholder="37"
                          className={getVitalInputClass(tempStatus, 'w-full p-1 rounded text-center text-xs placeholder:font-normal placeholder:text-slate-300')}
                          title="Nhiệt độ: Bình thường 36.5-37.4, Vàng 37.5-38.4, Đỏ >=38.5 hoặc <35.5"
                        />
                      </div>
                    </div>

                    {vitalAlerts.length > 0 && (
                      <div className={`p-1.5 px-2.5 rounded-lg text-[10.5px] font-black flex items-center gap-1.5 animate-in fade-in ${
                        hasCritical 
                          ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}>
                        <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${hasCritical ? 'text-rose-600 animate-bounce' : 'text-amber-600'}`} />
                        <span>Cảnh báo: {vitalAlerts.map((a) => a.text).join(' • ')}</span>
                      </div>
                    )}
                  </div>
                );
              })()}

            </div>

            {/* CỘT PHẢI (7.5 cols / 8 cols): Chẩn đoán, Tiền sử & Dị ứng, Diễn tiến, Bác sĩ, Y lệnh, Bàn giao & Ghi chú */}
            <div className="lg:col-span-8 xl:col-span-8 space-y-3.5">
              
              {/* 4. Chẩn Đoán Lâm Sàng & Mức Độ */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-800 font-black text-xs uppercase">
                    <Activity className="w-3.5 h-3.5 text-rose-600" />
                    <span>Chẩn Đoán Lâm Sàng</span>
                    <span className="text-rose-500">*</span>
                  </div>
                </div>

                <textarea
                  rows={2}
                  value={primaryDiagnosis}
                  onChange={(e) => {
                    setPrimaryDiagnosis(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Nhập chẩn đoán lâm sàng: VD: Cơn đau thắt ngực không ổn định, Tăng huyết áp độ 2, ĐTĐ typ 2..."
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-medium text-xs focus:ring-2 focus:ring-rose-500 leading-relaxed"
                  required
                />

                {/* Mức độ nặng nhẹ */}
                <div className="pt-0.5">
                  <label className="font-extrabold text-slate-700 block mb-1">
                    Mức Độ Tình Trạng
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setSeverity('UNCLASSIFIED')}
                      className={`py-1.5 px-2 rounded-lg font-black text-xs border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        severity === 'UNCLASSIFIED'
                          ? 'bg-slate-700 text-white border-slate-700 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-slate-400 inline-block"></span>
                      Chưa phân loại
                    </button>
                    <button
                      type="button"
                      onClick={() => setSeverity('STABLE')}
                      className={`py-1.5 px-2 rounded-lg font-black text-xs border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        severity === 'STABLE'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-emerald-50'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-300 inline-block"></span>
                      Ổn định
                    </button>
                    <button
                      type="button"
                      onClick={() => setSeverity('MODERATE')}
                      className={`py-1.5 px-2 rounded-lg font-black text-xs border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        severity === 'MODERATE'
                          ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-amber-50'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-200 inline-block"></span>
                      Trung bình
                    </button>
                    <button
                      type="button"
                      onClick={() => setSeverity('CRITICAL')}
                      className={`py-1.5 px-2 rounded-lg font-black text-xs border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        severity === 'CRITICAL'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-rose-50'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-200 inline-block"></span>
                      Nặng
                    </button>
                  </div>
                </div>
              </div>

              {/* 5. Tiền Sử Bệnh & Dị Ứng (Có nút tích chọn Có Dị Ứng) */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-slate-800 font-black text-xs uppercase">
                    <History className="w-3.5 h-3.5 text-amber-600" />
                    <span>Tiền Sử Bệnh & Dị Ứng</span>
                  </div>

                  {/* Nút tích chọn Có Dị Ứng */}
                  <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 cursor-pointer select-none hover:bg-amber-100/70 transition-colors">
                    <input
                      type="checkbox"
                      checked={hasAllergy}
                      onChange={(e) => handleToggleAllergy(e.target.checked)}
                      className="w-3.5 h-3.5 text-red-600 rounded border-slate-300 focus:ring-red-500 cursor-pointer"
                    />
                    <span className="font-black text-xs text-red-700 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-red-600 inline" />
                      Có dị ứng (thuốc / thức ăn)
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <input
                    type="text"
                    value={medicalHistory}
                    onChange={(e) => setMedicalHistory(e.target.value)}
                    placeholder="Tiền sử bệnh mạn tính: VD: THA 5 năm, ĐTĐ typ 2 tiêm insulin, phẫu thuật cũ, stent mạch vành..."
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-medium text-xs focus:ring-2 focus:ring-amber-500"
                  />

                  {/* Hiện ô nhập chi tiết dị ứng khi được tích chọn */}
                  {hasAllergy && (
                    <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg animate-in fade-in">
                      <span className="text-[11px] font-black text-red-800 shrink-0">Dị ứng:</span>
                      <input
                        type="text"
                        value={allergyDetails}
                        onChange={(e) => setAllergyDetails(e.target.value)}
                        placeholder="Nhập tên thuốc/dị nguyên gây dị ứng: VD: Dị ứng Penicillin, Aspirin, hải sản..."
                        className="w-full p-1.5 bg-white border border-red-300 rounded font-bold text-xs text-red-900 focus:ring-2 focus:ring-red-500 placeholder:font-normal placeholder:text-red-300"
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 6. Mục Diễn Tiến Lâm Sàng Lúc Tiếp Nhận (Có thể nhập hoặc không) */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-800 font-black text-xs uppercase">
                    <Activity className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Diễn Tiến Lâm Sàng Lúc Tiếp Nhận</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold">(Có thể nhập hoặc không)</span>
                </div>

                <textarea
                  rows={2}
                  value={admissionClinicalNote}
                  onChange={(e) => setAdmissionClinicalNote(e.target.value)}
                  placeholder="Tình trạng lúc vào khoa: Bệnh nhân tỉnh táo, tiếp xúc tốt, đau ngực trái từng cơn, tim đều, phổi thông khí rõ, bụng mềm, không phù... (Không bắt buộc)"
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-medium text-xs focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                />
              </div>

              {/* Thẻ theo dõi Lâm Sàng Đặc Biệt (Bác sĩ phụ trách mặc định theo tài khoản đăng nhập) */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800 block uppercase">
                    Thẻ Theo Dõi Lâm Sàng Đặc Biệt
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium">
                    <span>BS điều trị:</span>
                    <select
                      value={attendingDoctorId}
                      onChange={(e) => setAttendingDoctorId(e.target.value)}
                      className="px-2 py-0.5 bg-slate-50 border border-slate-300 rounded font-bold text-indigo-700 text-xs focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="">-- Chưa phân công BS --</option>
                      {doctors.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.name}
                        </option>
                      ))}
                    </select>
                  </div>
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
                          onClick={() => toggleTag(tagKey)}
                          className={`px-2.5 py-1 rounded-md border text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? `${meta.badgeBg} text-white border-transparent shadow-xs`
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {isSelected && '✓ '}
                          {meta.label}
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* 8. Kế Hoạch Điều Trị & Y Lệnh Ban Đầu */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-800 font-black text-xs uppercase">
                    <ClipboardList className="w-3.5 h-3.5 text-blue-600" />
                    <span>Kế Hoạch Điều Trị & Y Lệnh Ban Đầu</span>
                  </div>
                </div>

                <textarea
                  rows={2}
                  value={treatmentPlan}
                  onChange={(e) => setTreatmentPlan(e.target.value)}
                  placeholder="Y lệnh ban đầu: VD: Nằm đầu cao 30 độ; Thở oxy Canula 2 l/p; Kháng sinh..."
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-medium text-xs focus:ring-2 focus:ring-blue-500"
                />

                <div className="flex flex-wrap gap-1">
                  {QUICK_ORDERS.map((ord) => (
                    <button
                      type="button"
                      key={ord}
                      onClick={() => handleAddOrderChip(ord)}
                      className="px-1.5 py-0.5 bg-blue-50/70 hover:bg-blue-100 text-blue-800 rounded border border-blue-200 text-[10px] font-medium transition-colors cursor-pointer"
                    >
                      + {ord}
                    </button>
                  ))}
                </div>
              </div>

              {/* TÁCH LÀM 2: BÀN GIAO BỆNH (Ở TRÊN) & GHI CHÚ (Ở DƯỚI) */}
              <div className="space-y-3">
                {/* 9. Bàn Giao Bệnh (ở trên) */}
                <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-amber-900 font-black text-xs uppercase">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-amber-700" />
                    <span>Bàn Giao Bệnh</span>
                  </div>
                  <textarea
                    rows={2}
                    value={handoverNotes}
                    onChange={(e) => setHandoverNotes(e.target.value)}
                    placeholder="Dặn dò theo dõi kíp trực tiếp theo, bàn giao diễn biến qua đêm, dặn dò thân nhân..."
                    className="w-full p-2 bg-white border border-amber-300 rounded-lg font-medium text-xs focus:ring-2 focus:ring-amber-500 leading-relaxed text-slate-900"
                  />
                </div>

                {/* 10. Ghi Chú (ở dưới) */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-slate-800 font-black text-xs uppercase">
                    <FileText className="w-3.5 h-3.5 text-teal-600" />
                    <span>Ghi Chú</span>
                  </div>
                  <textarea
                    rows={2}
                    value={importantNotes}
                    onChange={(e) => setImportantNotes(e.target.value)}
                    placeholder="Ghi chú điều trị, hoàn cảnh bệnh nhân, bảo hiểm y tế, lưu ý hành chính..."
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-medium text-xs focus:ring-2 focus:ring-teal-500 leading-relaxed"
                  />
                </div>
              </div>

            </div>

          </div>

          {/* Footer Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <div className="text-[11px] text-slate-500 flex items-center gap-2">
              <span className="font-bold text-slate-700">Tiếp nhận vào:</span>
              <span className="px-2.5 py-0.5 bg-slate-100 rounded border border-slate-200 font-mono font-bold text-slate-800">
                Phòng {roomNumber}
              </span>
              <span>• BS: <strong className="text-indigo-700">{formatDoctorShortName(currentDoctorName)}</strong></span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition-colors cursor-pointer text-xs"
              >
                Hủy (Esc)
              </button>

              <button
                type="submit"
                className="px-6 py-2.5 bg-[#0b4d8c] hover:bg-[#083a69] text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-98 text-xs"
              >
                {isEditing ? (
                  <>
                    <FileEdit className="w-4 h-4" />
                    <span>Lưu Thay Đổi (Ctrl+Enter)</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Tiếp Nhận Bệnh Nhân (Ctrl+Enter)</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};

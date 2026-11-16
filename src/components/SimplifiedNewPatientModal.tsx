import React, { useState, useRef, useEffect } from 'react';
import { formatPatientDisplayName } from '../utils/storage';
import { 
  Patient, 
  Doctor, 
  DepartmentRoom, 
  SeverityLevel,
  AdmissionDischargeStatus 
} from '../types/patient';
import { 
  X, 
  UserPlus, 
  FileEdit, 
  Check, 
  AlertCircle, 
  Activity, 
  FileText, 
  ArrowRightLeft, 
  ChevronDown, 
  FolderPlus,
  Building2,
  Calendar,
  Stethoscope,
  Edit3,
  Sparkles,
  Bot,
  Copy,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Wand2,
  ListPlus,
  RefreshCw
} from 'lucide-react';
import { analyzeFullClinicalNote, AIAnalysisOutput } from '../utils/aiClinicalAssistant';

export interface SimplifiedNewPatientModalProps {
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

  // 1. Thông tin bệnh nhân & buồng phòng
  const [fullName, setFullName] = useState(patientToEdit?.fullName || '');
  const [age, setAge] = useState<number | string>(patientToEdit?.age ?? 60);
  const [gender, setGender] = useState<'Nam' | 'Nữ'>(patientToEdit?.gender || 'Nam');
  const [roomNumber, setRoomNumber] = useState<string>(() => {
    const raw = patientToEdit?.roomNumber || prefilledRoom || '';
    if (/\d/.test(raw)) {
      return raw.replace(/^(phòng|p\.?|buồng)\s*/i, '').trim();
    }
    return prefilledRoom || '703';
  });
  const [admissionDateTime, setAdmissionDateTime] = useState<string>(() => {
    if (patientToEdit?.admissionDate) {
      const formatted = patientToEdit.admissionDate.replace(' ', 'T');
      if (formatted.length >= 16) return formatted.slice(0, 16);
      if (formatted.length === 10) return `${formatted}T08:00`;
    }
    return defaultDateTimeStr;
  });
  const [attendingDoctorId, setAttendingDoctorId] = useState<string>(() => {
    if (isImportMode) return patientToEdit?.attendingDoctorId || '';
    if (isEditing) return patientToEdit?.attendingDoctorId || '';
    return currentUser?.id || doctors[0]?.id || '';
  });
  // Phần hành chính mặc định thu gọn súc tích khi nhập diễn tiến bệnh nhân cũ (isEditing), có nút sửa để mở rộng
  const [isEditingAdmin, setIsEditingAdmin] = useState<boolean>(!isEditing);
  const attendingDoctor = doctors.find((d) => d.id === attendingDoctorId);

  // 2. Chẩn đoán, Hướng xử trí, Ghi chú, Bàn giao & Gắn nhãn Mức Độ Tình Trạng
  const [primaryDiagnosis, setPrimaryDiagnosis] = useState(
    patientToEdit?.primaryDiagnosis === 'Nhập chẩn đoán' ? '' : (patientToEdit?.primaryDiagnosis || '')
  );
  const [treatmentPlan, setTreatmentPlan] = useState(
    patientToEdit?.treatmentPlan === 'Nhập hướng điều trị' ? '' : (patientToEdit?.treatmentPlan || '')
  );
  const [importantNotes, setImportantNotes] = useState(patientToEdit?.importantNotes || '');
  const [handoverNotes, setHandoverNotes] = useState(patientToEdit?.handoverNotes || '');
  const [severity, setSeverity] = useState<SeverityLevel>(patientToEdit?.severity || 'STABLE');
  const [admissionStatus, setAdmissionStatus] = useState<AdmissionDischargeStatus>(
    patientToEdit?.admissionStatus || 'STABLE_INPATIENT'
  );
  const [dischargeTomorrowSetDate, setDischargeTomorrowSetDate] = useState<string | undefined>(
    patientToEdit?.dischargeTomorrowSetDate
  );

  // 3. Mở rộng: Cận lâm sàng & Diễn tiến
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    return Boolean(
      (patientToEdit?.initialLabsText && patientToEdit.initialLabsText.trim()) ||
      (patientToEdit?.evolutions && patientToEdit.evolutions.length > 0 && patientToEdit.evolutions[0].clinicalNote)
    );
  });
  const [initialLabsText, setInitialLabsText] = useState(patientToEdit?.initialLabsText || '');
  const [admissionClinicalNote, setAdmissionClinicalNote] = useState(() => {
    if (patientToEdit?.evolutions && patientToEdit.evolutions.length > 0) {
      return patientToEdit.evolutions[0].clinicalNote || '';
    }
    return '';
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 4. Trợ lý AI Bóc Tách Bệnh Án & Biểu Dẫn Cận Lâm Sàng
  const [showAiPanel, setShowAiPanel] = useState<boolean>(false);
  const [aiInputText, setAiInputText] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<AIAnalysisOutput | null>(null);
  const [aiSuccessMsg, setAiSuccessMsg] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);
  const [insertedLabSuccess, setInsertedLabSuccess] = useState<boolean>(false);

  const handleRunAiAnalysis = async () => {
    if (!aiInputText.trim()) {
      setErrorMsg('Vui lòng dán nội dung bệnh án hoặc kết quả xét nghiệm để AI phân tích.');
      return;
    }
    setIsAnalyzing(true);
    setErrorMsg(null);
    setAiSuccessMsg(null);
    try {
      const output = await analyzeFullClinicalNote(aiInputText, patientToEdit);
      setAiResult(output);

      // Tự động điền đúng mục các trường dữ liệu vào form
      if (output.fullName) setFullName(output.fullName);
      if (output.age) setAge(output.age);
      if (output.gender) setGender(output.gender);
      if (output.roomNumber) setRoomNumber(output.roomNumber);
      if (output.primaryDiagnosis) setPrimaryDiagnosis(output.primaryDiagnosis);
      if (output.treatmentPlan) setTreatmentPlan(output.treatmentPlan);
      if (output.importantNotes) setImportantNotes(output.importantNotes);
      if (output.handoverNotes) setHandoverNotes(output.handoverNotes);
      if (output.severity) setSeverity(output.severity);
      if (output.admissionStatus) {
        setAdmissionStatus(output.admissionStatus);
        if (output.admissionStatus === 'DISCHARGE_TOMORROW') {
          const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          setDischargeTomorrowSetDate(todayDateStr);
        }
      }
      if (output.clinicalNote) {
        setAdmissionClinicalNote(output.clinicalNote);
        setIsExpanded(true);
      }
      if (output.labsText) {
        setInitialLabsText((prev) => prev ? `${prev}\n${output.labsText}` : output.labsText!);
        setIsExpanded(true);
      }

      setAiSuccessMsg('AI đã phân tích thành công và tự động điền các trường vào hồ sơ bệnh nhân!');
      setTimeout(() => setAiSuccessMsg(null), 6000);
    } catch (err: any) {
      console.error('Lỗi phân tích AI:', err);
      setErrorMsg('Không thể phân tích dữ liệu AI: ' + (err?.message || 'Vui lòng thử lại'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePasteSample = () => {
    const sample = `Bệnh nhân: NGUYỄN VĂN AN, Nam 68 tuổi, Phòng 705
Chẩn đoán: Viêm phổi thùy phải / Đái tháo đường typ 2, Tăng huyết áp độ 2
Diễn tiến hiện tại: Bệnh nhân tỉnh táo, ho khan ít đờm, còn tức ngực nhẹ, phổi ran nổ đáy phải giảm, SpO2 96% khí trời, huyết áp 130/80 mmHg, không sốt.
Cận lâm sàng:
• Ngày 14/11: WBC 16.5 G/L, NEU 85%, CRP 95 mg/L, Glucose 12.5 mmol/L, Creatinine 125 µmol/L
• Ngày 16/11: WBC 7.8 G/L, NEU 65%, CRP 14 mg/L, Glucose 7.2 mmol/L, Creatinine 92 µmol/L
Kế hoạch điều trị:
Tiếp tục kháng sinh Ceftriaxone 2g/ngày tĩnh mạch, kiểm soát đường huyết theo dõi đường mao mạch, hạ áp Amlodipine 5mg.
Bàn giao ca trực: Theo dõi sinh hiệu ca đêm, nếu sốt lại cấy máu và báo bác sĩ trực.
Lưu ý: Tiền sử tăng huyết áp lâu năm, không ghi nhận dị ứng thuốc.
Tình trạng: Ổn định, dự kiến ra viện ngày mai.`;
    setAiInputText(sample);
  };

  useEffect(() => {
    if (nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMsg('Vui lòng nhập Họ và tên bệnh nhân.');
      return;
    }
    if (!roomNumber.trim()) {
      setErrorMsg('Vui lòng nhập Buồng / Phòng bệnh.');
      return;
    }
    if (!primaryDiagnosis.trim()) {
      setErrorMsg('Vui lòng nhập Chẩn đoán hiện tại của người bệnh.');
      return;
    }

    const formattedAdmissionDate = admissionDateTime.includes('T')
      ? admissionDateTime.replace('T', ' ')
      : admissionDateTime;

    const ageNum = Number(age) || 50;
    const nowFormatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const hour = now.getHours();
    const currentShift = (hour >= 7 && hour < 17) ? ('Hành chính' as const) : ('Trực đêm' as const);
    const doctorName = doctors.find((d) => d.id === attendingDoctorId)?.name || currentUser?.name || 'BS. Điều trị';

    // Chuẩn bị diễn tiến ban đầu nếu thêm mới bệnh nhân
    const initialEvolution = {
      id: `EVO-${Date.now()}`,
      date: formattedAdmissionDate,
      clinicalNote: admissionClinicalNote.trim() || 'Tiếp nhận bệnh nhân vào khoa, toàn trạng ổn định, tiếp tục theo dõi và điều trị theo phác đồ.',
      treatmentAction: treatmentPlan.trim() || 'Nhập hướng điều trị',
      doctorName,
      shift: currentShift,
    };

    if (isEditing && patientToEdit) {
      // Mỗi lần sửa coi như 1 lần nhập diễn tiến mới
      const severityText = severity === 'CRITICAL' 
        ? 'Nặng / Nguy kịch' 
        : severity === 'MODERATE' 
        ? 'Cần theo dõi' 
        : 'Ổn định';

      const dischargeText = admissionStatus === 'DISCHARGE_TOMORROW' 
        ? 'Dự kiến ra viện ngày mai' 
        : admissionStatus === 'DISCHARGE_TODAY'
        ? 'Ra viện'
        : null;

      const statusText = [severityText, dischargeText].filter(Boolean).join(' + ');

      const autoClinicalNote = admissionClinicalNote.trim() || 
        `Tình trạng: ${statusText}. Chẩn đoán hiện tại: ${primaryDiagnosis.trim()}.${importantNotes.trim() ? ` Lưu ý: ${importantNotes.trim()}` : ''}${handoverNotes.trim() ? ` Bàn giao: ${handoverNotes.trim()}` : ''}`;

      const newEditEvolution = {
        id: `EVO-${Date.now()}`,
        date: nowFormatted,
        clinicalNote: autoClinicalNote,
        treatmentAction: treatmentPlan.trim() || 'Nhập hướng điều trị',
        doctorName,
        shift: currentShift,
      };

      const updatedEvolutions = [newEditEvolution, ...(patientToEdit.evolutions || [])];

      const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const updatedPatient: Patient = {
        ...patientToEdit,
        fullName: formatPatientDisplayName(fullName.trim()),
        gender,
        age: ageNum,
        dateOfBirth: `${now.getFullYear() - ageNum}-01-01`,
        admissionDate: formattedAdmissionDate,
        roomNumber: roomNumber.trim(),
        attendingDoctorId,
        primaryDiagnosis: primaryDiagnosis.trim() || 'Nhập chẩn đoán',
        severity,
        admissionStatus,
        dischargeTomorrowSetDate: admissionStatus === 'DISCHARGE_TOMORROW' 
          ? (dischargeTomorrowSetDate || todayDateStr) 
          : undefined,
        treatmentPlan: treatmentPlan.trim() || 'Nhập hướng điều trị',
        importantNotes: importantNotes.trim() || undefined,
        handoverNotes: handoverNotes.trim() || undefined,
        initialLabsText: initialLabsText.trim() || undefined,
        evolutions: updatedEvolutions,
      };

      if (onUpdatePatient) {
        onUpdatePatient(updatedPatient);
      }
      onClose();
      return;
    }

    const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Tạo bệnh nhân mới
    const newPatient: Patient = {
      id: `PAT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      patientCode: `BN-${Date.now().toString().slice(-6)}`,
      fullName: formatPatientDisplayName(fullName.trim()),
      gender,
      age: ageNum,
      dateOfBirth: `${now.getFullYear() - ageNum}-01-01`,
      admissionDate: formattedAdmissionDate,
      department: 'Khoa Nội Tổng Hợp',
      roomNumber: roomNumber.trim(),
      bedNumber: '',
      attendingDoctorId,
      primaryNurse: 'ĐD. Tua trực tiếp nhận',
      primaryDiagnosis: primaryDiagnosis.trim(),
      severity,
      admissionStatus: admissionStatus || 'ADMITTED_TODAY',
      dischargeTomorrowSetDate: admissionStatus === 'DISCHARGE_TOMORROW' ? todayDateStr : undefined,
      tags: [],
      treatmentPlan: treatmentPlan.trim() || 'Nhập hướng điều trị',
      importantNotes: importantNotes.trim() || undefined,
      handoverNotes: handoverNotes.trim() || undefined,
      initialLabsText: initialLabsText.trim() || undefined,
      status: 'ACTIVE',
      vitals: [],
      evolutions: admissionClinicalNote.trim() ? [initialEvolution] : [],
      labs: [],
      medications: [],
    };

    if (onAddPatient) {
      onAddPatient(newPatient);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        onClick={onClose} 
        className="fixed inset-0 cursor-pointer" 
        title="Bấm bên ngoài để đóng" 
      />

      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-150">
        
        {/* Header Modal */}
        <div className="px-4 sm:px-6 py-3.5 bg-gradient-to-r from-[#0b4d8c] via-[#083a69] to-slate-900 text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shadow-inner">
              {isEditing ? <FileEdit className="w-5 h-5 text-amber-300" /> : <UserPlus className="w-5 h-5 text-emerald-300" />}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-2">
                <span>{isEditing ? 'Nhập Diễn Tiến Bệnh Nhân' : 'Tiếp Nhận Bệnh Nhân Mới'}</span>
                {isEditing && patientToEdit?.roomNumber && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-white/20 text-white font-bold">
                    P.{patientToEdit.roomNumber}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-blue-100/80 font-medium">
                {isEditing ? 'Cập nhật chẩn đoán, hướng xử trí, ghi chú & tự động ghi nhận diễn tiến mới' : 'Khoa Nội Tổng Hợp • Bệnh Viện Hùng Vương Gia Lai'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAiPanel((prev) => !prev)}
              className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black text-xs shadow-md border border-white/20 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              title="Mở trình bóc tách và phân tích bệnh án bằng AI"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" style={{ animationDuration: '4s' }} />
              <span>{showAiPanel ? 'Đóng AI' : 'Nhập bằng AI'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/90 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Thông báo lỗi nếu có */}
        {errorMsg && (
          <div className="mx-4 sm:mx-6 mt-3 p-2.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs font-bold flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button 
              type="button" 
              onClick={() => setErrorMsg(null)}
              className="text-rose-500 hover:text-rose-800 font-bold px-1.5"
            >
              ×
            </button>
          </div>
        )}

        {/* Form Body - Cuộn mượt mà */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {/* Quick AI Trigger Banner when collapsed */}
          {!showAiPanel && (
            <div className="p-2.5 sm:p-3 rounded-2xl bg-gradient-to-r from-violet-600/10 via-indigo-600/10 to-blue-600/10 border border-indigo-200/80 flex items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <span className="text-xs font-black text-indigo-950 block">
                    Nhập Nhanh Hồ Sơ & Diễn Tiến Bằng AI
                  </span>
                  <span className="text-[11px] text-slate-600 block">
                    Dán tóm tắt bệnh án, diễn biến hoặc CLS để AI tự động điền đúng mục & phân tích thay đổi
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAiPanel(true)}
                className="py-1.5 px-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Nhập bằng AI</span>
              </button>
            </div>
          )}

          {/* BẢNG TRỢ LÝ AI: PHÂN TÍCH BỆNH ÁN & BIỂU DẪN CẬN LÂM SÀNG */}
          {showAiPanel && (
            <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 text-white p-4 sm:p-5 rounded-2xl border-2 border-indigo-400/50 shadow-2xl space-y-4 animate-in slide-in-from-top-3 duration-200">
              <div className="flex items-center justify-between border-b border-indigo-800/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center text-amber-300 shadow-inner">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                      <span>Trợ Lý Lâm Sàng AI • Bóc Tách Bệnh Án & Biểu Dẫn Cận Lâm Sàng</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 font-mono">
                        Thông minh
                      </span>
                    </h4>
                    <p className="text-[11px] text-indigo-200/80">
                      Dán toàn bộ văn bản bệnh án, diễn biến, kết quả xét nghiệm... AI sẽ tự động phân tích, điền đúng mục, tóm tắt bệnh án và biểu dẫn thay đổi CLS.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAiPanel(false)}
                  className="text-xs text-indigo-300 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Đóng AI
                </button>
              </div>

              {/* Textarea nhập liệu */}
              <div className="space-y-2">
                <textarea
                  rows={4}
                  value={aiInputText}
                  onChange={(e) => setAiInputText(e.target.value)}
                  placeholder="Dán toàn bộ nội dung bệnh án, diễn tiến, kết quả xét nghiệm tại đây (VD: Bệnh nhân Nguyễn Văn A 65 tuổi phòng 703, chẩn đoán Viêm phổi / ĐTĐ, CLS: WBC 15 -> 7.8, CRP 85 -> 12, kế hoạch điều trị...)"
                  className="w-full p-3 bg-slate-900/90 border border-indigo-500/40 rounded-xl text-white font-medium text-xs sm:text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent leading-relaxed"
                />

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRunAiAnalysis}
                      disabled={isAnalyzing || !aiInputText.trim()}
                      className="px-4 py-2 bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-indigo-900/40 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                    >
                      {isAnalyzing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                          <span>Đang phân tích & bóc tách...</span>
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4 text-amber-300" />
                          <span>⚡ Phân Tích & Tự Động Điền</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handlePasteSample}
                      className="px-3 py-2 bg-indigo-900/50 hover:bg-indigo-800/60 border border-indigo-700/60 text-indigo-200 hover:text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                      title="Dán mẫu văn bản bệnh án lâm sàng mẫu để thử nghiệm nhanh"
                    >
                      📋 Dán mẫu thử
                    </button>
                  </div>

                  {aiInputText && (
                    <button
                      type="button"
                      onClick={() => {
                        setAiInputText('');
                        setAiResult(null);
                      }}
                      className="text-xs text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                    >
                      Xóa nội dung
                    </button>
                  )}
                </div>
              </div>

              {/* Thông báo thành công */}
              {aiSuccessMsg && (
                <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{aiSuccessMsg}</span>
                </div>
              )}

              {/* KẾT QUẢ AI PHÂN TÍCH: TÓM TẮT BỆNH ÁN & BIỂU DẪN CẬN LÂM SÀNG */}
              {aiResult && (
                <div className="space-y-3 pt-2 border-t border-indigo-800/60 animate-in fade-in">
                  
                  {/* PHẦN A: TÓM TẮT BỆNH ÁN */}
                  <div className="p-3.5 bg-slate-900/80 rounded-xl border border-indigo-500/30 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-black text-amber-300 uppercase tracking-wide">
                        <FileText className="w-4 h-4 text-amber-400" />
                        <span>Tóm Tắt Bệnh Án Lâm Sàng</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(aiResult.caseSummary);
                            setCopiedSummary(true);
                            setTimeout(() => setCopiedSummary(false), 2500);
                          }}
                          className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                          title="Sao chép toàn bộ tóm tắt bệnh án"
                        >
                          {copiedSummary ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedSummary ? 'Đã chép' : 'Sao chép'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setImportantNotes((prev) => prev ? `${prev}\n\n${aiResult.caseSummary}` : aiResult.caseSummary);
                            setAiSuccessMsg('Đã chèn tóm tắt bệnh án vào ô Ghi chú của Bác sĩ');
                            setTimeout(() => setAiSuccessMsg(null), 3000);
                          }}
                          className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                          title="Thêm tóm tắt này vào mục Ghi chú của Bác sĩ"
                        >
                          <span>+ Đưa vào Ghi chú</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setAdmissionClinicalNote((prev) => prev ? `${prev}\n\n${aiResult.caseSummary}` : aiResult.caseSummary);
                            setIsExpanded(true);
                            setAiSuccessMsg('Đã chèn tóm tắt bệnh án vào ô Diễn tiến lâm sàng');
                            setTimeout(() => setAiSuccessMsg(null), 3000);
                          }}
                          className="px-2 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                          title="Thêm tóm tắt này vào mục Diễn tiến lâm sàng"
                        >
                          <span>+ Đưa vào Diễn tiến</span>
                        </button>
                      </div>
                    </div>
                    <div className="p-2.5 bg-black/40 rounded-lg text-[11.5px] font-mono text-slate-200 whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto border border-white/5">
                      {aiResult.caseSummary}
                    </div>
                  </div>

                  {/* PHẦN B: BIỂU DẪN THAY ĐỔI CẬN LÂM SÀNG */}
                  {aiResult.labTrends && aiResult.labTrends.length > 0 && (
                    <div className="p-3.5 bg-slate-900/80 rounded-xl border border-indigo-500/30 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-black text-cyan-300 uppercase tracking-wide">
                          <Activity className="w-4 h-4 text-cyan-400" />
                          <span>Biểu Dẫn Thay Đổi Cận Lâm Sàng & Đánh Giá Xu Hướng</span>
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
                            {aiResult.labTrends.length} chỉ số
                          </span>
                        </div>

                        {aiResult.labSummaryText && (
                          <button
                            type="button"
                            onClick={() => {
                              const appendText = `\n[Biểu dẫn Cận Lâm Sàng]:\n${aiResult.labSummaryText}`;
                              setAdmissionClinicalNote((prev) => prev ? `${prev}\n${appendText}` : appendText.trim());
                              setIsExpanded(true);
                              setInsertedLabSuccess(true);
                              setTimeout(() => setInsertedLabSuccess(false), 2500);
                            }}
                            className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                            title="Chèn nội dung biểu dẫn thay đổi CLS này vào ô Diễn tiến lâm sàng"
                          >
                            {insertedLabSuccess ? <Check className="w-3 h-3 text-emerald-300" /> : <ListPlus className="w-3 h-3" />}
                            <span>{insertedLabSuccess ? 'Đã chèn vào Diễn tiến' : '+ Chèn vào Diễn tiến'}</span>
                          </button>
                        )}
                      </div>

                      {/* Bảng biểu dẫn */}
                      <div className="overflow-x-auto rounded-xl border border-white/10 max-h-60 overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-white/10 text-slate-300 font-black text-[10.5px] uppercase border-b border-white/10 sticky top-0">
                            <tr>
                              <th className="py-2 px-2.5">Chỉ Số Xét Nghiệm</th>
                              <th className="py-2 px-2.5">Giá Trị Cũ ➔ Mới</th>
                              <th className="py-2 px-2.5 text-center">Xu Hướng</th>
                              <th className="py-2 px-2.5">Nhận Định Lâm Sàng</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 font-medium text-[11px]">
                            {aiResult.labTrends.map((lab) => {
                              const isCritical = lab.status === 'CRITICAL';
                              const isWarning = lab.status === 'WARNING';
                              const isUp = lab.trend === 'UP';
                              const isDown = lab.trend === 'DOWN';

                              return (
                                <tr key={lab.id} className="hover:bg-white/5 transition-colors">
                                  <td className="py-2 px-2.5">
                                    <div className="font-bold text-white flex items-center gap-1.5">
                                      {isCritical && <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />}
                                      <span>{lab.name}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400">
                                      Chuẩn: {lab.normalRange} {lab.unit}
                                    </span>
                                  </td>

                                  <td className="py-2 px-2.5 whitespace-nowrap">
                                    {lab.prevValue !== undefined ? (
                                      <div className="flex items-center gap-1.5 font-mono">
                                        <span className="text-slate-400">{lab.prevValue}</span>
                                        <span className="text-slate-500">➔</span>
                                        <span className={`font-black ${isCritical ? 'text-rose-400 font-bold' : isWarning ? 'text-amber-300' : 'text-emerald-400'}`}>
                                          {lab.currentValue} {lab.unit}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className={`font-mono font-black ${isCritical ? 'text-rose-400' : isWarning ? 'text-amber-300' : 'text-emerald-400'}`}>
                                        {lab.currentValue} {lab.unit}
                                      </span>
                                    )}
                                  </td>

                                  <td className="py-2 px-2.5 text-center whitespace-nowrap">
                                    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black ${
                                      isUp 
                                        ? (lab.name.includes('Bạch cầu') || lab.name.includes('CRP') || lab.name.includes('Creatinine') ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30')
                                        : isDown 
                                        ? (lab.name.includes('Bạch cầu') || lab.name.includes('CRP') || lab.name.includes('Creatinine') ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30')
                                        : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                                    }`}>
                                      {lab.trendLabel}
                                    </span>
                                  </td>

                                  <td className="py-2 px-2.5 text-slate-300">
                                    <p className="line-clamp-2 leading-relaxed text-[11px]" title={lab.clinicalInterpretation}>
                                      {lab.clinicalInterpretation}
                                    </p>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          )}

          {/* NỘI DUNG 1: THÔNG TIN HÀNH CHÍNH & BUỒNG PHÒNG */}
          {!isEditingAdmin ? (
            <div className="bg-slate-50/95 p-2.5 sm:p-3 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs">
                {/* Buồng phòng */}
                <span className="px-2.5 py-0.5 rounded-lg bg-[#0b4d8c] text-white font-black text-xs shadow-2xs flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-blue-200" />
                  <span>P.{roomNumber || '---'}</span>
                </span>

                {/* Họ tên */}
                <span className="font-black text-slate-900 text-sm tracking-wide uppercase">
                  {fullName || 'CHƯA NHẬP HỌ TÊN'}
                </span>

                {/* Tuổi & Giới tính */}
                <span className="text-slate-600 font-bold bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  {age} tuổi • <span className={gender === 'Nữ' ? 'text-pink-600' : 'text-blue-700'}>{gender}</span>
                </span>

                {/* Ngày vào viện */}
                <span className="text-slate-600 font-medium flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Vào: <strong className="text-slate-800">{admissionDateTime ? admissionDateTime.replace('T', ' ') : '---'}</strong></span>
                </span>

                {/* Bác sĩ phụ trách */}
                <span className="text-slate-600 font-medium flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  <Stethoscope className="w-3.5 h-3.5 text-[#0b4d8c]" />
                  <span>BS: <strong className="text-slate-800">{attendingDoctor?.name || 'Chưa chỉ định'}</strong></span>
                </span>

                {patientToEdit?.patientCode && (
                  <span className="text-[11px] font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                    Mã: {patientToEdit.patientCode}
                  </span>
                )}
              </div>

              {/* Nút bấm Sửa hành chính */}
              <button
                type="button"
                onClick={() => setIsEditingAdmin(true)}
                className="py-1 px-2.5 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-xl font-bold text-xs flex items-center gap-1 shadow-2xs transition-all cursor-pointer shrink-0"
                title="Bấm để chỉnh sửa lại thông tin hành chính (Họ tên, tuổi, buồng phòng, bác sĩ...)"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#0b4d8c]" />
                <span>Sửa hành chính</span>
              </button>
            </div>
          ) : (
            <div className="bg-slate-50/90 p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-[#0b4d8c] flex items-center justify-center font-black text-xs">
                    1
                  </div>
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide">
                    Thông Tin Hành Chính & Buồng Phòng
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  {patientToEdit?.patientCode && (
                    <span className="text-[11px] font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      Mã BN: {patientToEdit.patientCode}
                    </span>
                  )}
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => setIsEditingAdmin(false)}
                      className="text-xs text-slate-600 hover:text-slate-900 font-bold px-2 py-0.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Thu gọn
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                {/* Buồng / Phòng */}
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-[#0b4d8c]" />
                    <span>Buồng / Phòng <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    type="text"
                    value={roomNumber}
                    onChange={(e) => {
                      setRoomNumber(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="VD: 703, 717, 735..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-black text-sm text-slate-900 focus:ring-2 focus:ring-[#0b4d8c] focus:border-transparent"
                    required
                  />
                </div>

                {/* Họ và tên */}
                <div className="sm:col-span-8">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Họ và Tên Bệnh Nhân <span className="text-rose-500">*</span>
                  </label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value.toUpperCase());
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="NGUYỄN VĂN A"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-black text-sm text-slate-900 uppercase tracking-wide focus:ring-2 focus:ring-[#0b4d8c] focus:border-transparent"
                    required
                  />
                </div>

                {/* Tuổi */}
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Tuổi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    min={0}
                    max={120}
                    placeholder="60"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-sm text-slate-900 text-center focus:ring-2 focus:ring-[#0b4d8c] focus:border-transparent"
                    required
                  />
                </div>

                {/* Giới tính */}
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Giới Tính
                  </label>
                  <div className="grid grid-cols-2 gap-1 bg-white p-0.5 rounded-xl border border-slate-300 h-[38px]">
                    <button
                      type="button"
                      onClick={() => setGender('Nam')}
                      className={`rounded-lg font-black text-xs transition-all flex items-center justify-center cursor-pointer ${
                        gender === 'Nam' ? 'bg-[#0b4d8c] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Nam
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('Nữ')}
                      className={`rounded-lg font-black text-xs transition-all flex items-center justify-center cursor-pointer ${
                        gender === 'Nữ' ? 'bg-pink-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Nữ
                    </button>
                  </div>
                </div>

                {/* Ngày giờ vào viện */}
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Ngày Giờ Vào Viện</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={admissionDateTime}
                    onChange={(e) => setAdmissionDateTime(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl font-medium text-xs text-slate-900 focus:ring-2 focus:ring-[#0b4d8c] focus:border-transparent"
                  />
                </div>

                {/* Bác sĩ điều trị */}
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                    <Stethoscope className="w-3.5 h-3.5 text-[#0b4d8c]" />
                    <span>Bác Sĩ Phụ Trách</span>
                  </label>
                  <select
                    value={attendingDoctorId}
                    onChange={(e) => setAttendingDoctorId(e.target.value)}
                    className="w-full px-2 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-900 focus:ring-2 focus:ring-[#0b4d8c] focus:border-transparent truncate cursor-pointer"
                  >
                    <option value="">-- Chưa chỉ định --</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.title ? `(${d.title})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* NỘI DUNG 2: CHẨN ĐOÁN, HƯỚNG XỬ TRÍ, GHI CHÚ, BÀN GIAO & MỨC ĐỘ */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xs">
                  2
                </div>
                <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide">
                  Chẩn Đoán, Hướng Xử Trí & Bàn Giao
                </h4>
              </div>
            </div>

            <div className="space-y-3">
              {/* Chẩn đoán hiện tại */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-[#0b4d8c]" />
                  <span>Chẩn Đoán Hiện Tại <span className="text-rose-500">*</span></span>
                </label>
                <textarea
                  rows={2}
                  value={primaryDiagnosis}
                  onChange={(e) => {
                    setPrimaryDiagnosis(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Nhập chẩn đoán hiện tại (VD: Viêm phổi thùy / ĐTĐ typ 2, Tăng huyết áp độ 2...)"
                  className="w-full p-2.5 bg-slate-50/60 border border-slate-300 rounded-xl font-bold text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#0b4d8c] focus:border-transparent leading-relaxed"
                  required
                />
              </div>

              {/* Hướng xử trí / Kế hoạch điều trị */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                  <Stethoscope className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Hướng Xử Trí / Kế Hoạch Điều Trị</span>
                </label>
                <textarea
                  rows={3}
                  value={treatmentPlan}
                  onChange={(e) => setTreatmentPlan(e.target.value)}
                  placeholder="Nhập y lệnh điều trị, kháng sinh, dịch truyền, chế độ ăn, theo dõi sinh hiệu..."
                  className="w-full p-2.5 bg-slate-50/60 border border-slate-300 rounded-xl font-medium text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#0b4d8c] focus:border-transparent leading-relaxed"
                />
              </div>

              {/* Grid 2 cột: Ghi chú & Bàn giao bệnh */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Ghi chú lâm sàng */}
                <div>
                  <label className="block text-[11px] font-bold text-amber-900 uppercase mb-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Ghi Chú Của Bác Sĩ</span>
                  </label>
                  <textarea
                    rows={3}
                    value={importantNotes}
                    onChange={(e) => setImportantNotes(e.target.value)}
                    placeholder="Lưu ý đặc biệt, nhắc nhở theo dõi..."
                    className="w-full p-2.5 bg-amber-50/40 border border-amber-200 rounded-xl font-medium text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-transparent leading-relaxed"
                  />
                </div>

                {/* Bàn giao bệnh */}
                <div>
                  <label className="block text-[11px] font-bold text-indigo-900 uppercase mb-1 flex items-center gap-1">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Bàn Giao Ca Trực</span>
                  </label>
                  <textarea
                    rows={3}
                    value={handoverNotes}
                    onChange={(e) => setHandoverNotes(e.target.value)}
                    placeholder="Dặn dò trực đêm, việc cần làm ca tiếp theo..."
                    className="w-full p-2.5 bg-indigo-50/40 border border-indigo-200 rounded-xl font-medium text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent leading-relaxed"
                  />
                </div>
              </div>

              {/* Gắn nhãn: Mức Độ Tình Trạng & Dự Kiến Ra Viện (Có thể dùng kèm nhau) */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-black text-slate-700 uppercase">
                    Gắn Nhãn: Mức Độ Tình Trạng & Ra Viện
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                      severity === 'CRITICAL' 
                        ? 'bg-rose-50 text-rose-700 border-rose-200' 
                        : severity === 'MODERATE' 
                        ? 'bg-amber-50 text-amber-700 border-amber-200' 
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {severity === 'CRITICAL' ? '🔴 Nặng' : severity === 'MODERATE' ? '🟡 Cần theo dõi' : '🟢 Ổn định'}
                    </span>
                    {admissionStatus === 'DISCHARGE_TODAY' && (
                      <span className="text-[10px] font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                        🟣 Ra viện
                      </span>
                    )}
                    {admissionStatus === 'DISCHARGE_TOMORROW' && (
                      <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                        🔵 RV ngày mai
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setSeverity('STABLE')}
                    className={`p-2.5 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      severity === 'STABLE'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-300'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    <span>🟢</span>
                    <span>Ổn định</span>
                    {severity === 'STABLE' && (
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSeverity('MODERATE')}
                    className={`p-2.5 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      severity === 'MODERATE'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-xs ring-2 ring-amber-300'
                        : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                    }`}
                  >
                    <span>🟡</span>
                    <span>Cần theo dõi</span>
                    {severity === 'MODERATE' && (
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSeverity('CRITICAL')}
                    className={`p-2.5 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      severity === 'CRITICAL'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs ring-2 ring-rose-300 animate-pulse'
                        : 'bg-rose-50 text-rose-900 border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    <span>🔴</span>
                    <span>Nặng</span>
                    {severity === 'CRITICAL' && (
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                      if (admissionStatus === 'DISCHARGE_TOMORROW' || admissionStatus === 'DISCHARGE_TODAY') {
                        setAdmissionStatus('STABLE_INPATIENT');
                        setDischargeTomorrowSetDate(undefined);
                      } else {
                        setAdmissionStatus('DISCHARGE_TOMORROW');
                        setDischargeTomorrowSetDate(todayDateStr);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      admissionStatus === 'DISCHARGE_TOMORROW'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-300'
                        : admissionStatus === 'DISCHARGE_TODAY'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs ring-2 ring-purple-300'
                        : 'bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100'
                    }`}
                    title="Bấm để bật/tắt nhãn RV ngày mai (dùng kèm với Ổn định, Cần theo dõi hoặc Nặng)"
                  >
                    <span>{admissionStatus === 'DISCHARGE_TODAY' ? '🟣' : '🔵'}</span>
                    <span>{admissionStatus === 'DISCHARGE_TODAY' ? 'Ra viện' : 'RV ngày mai'}</span>
                    {(admissionStatus === 'DISCHARGE_TOMORROW' || admissionStatus === 'DISCHARGE_TODAY') && (
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* NỘI DUNG 3: NÚT MỞ RỘNG ĐỂ NHẬP CẬN LÂM SÀNG HOẶC DIỄN TIẾN */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-2xs transition-all">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full p-3 sm:p-3.5 bg-slate-50 hover:bg-slate-100 text-slate-800 font-black text-xs sm:text-sm flex items-center justify-between transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <FolderPlus className="w-3.5 h-3.5" />
                </div>
                <span>Mở Rộng: Nhập Cận Lâm Sàng & Diễn Tiến</span>
                {(initialLabsText.trim() || admissionClinicalNote.trim()) && (
                  <span className="text-[10px] bg-indigo-600 text-white font-bold px-2 py-0.5 rounded-full">
                    Có dữ liệu
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-slate-400 text-xs font-bold">
                <span>{isExpanded ? 'Thu gọn' : 'Bấm để mở rộng'}</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {isExpanded && (
              <div className="p-3.5 sm:p-4 space-y-3.5 border-t border-slate-200 bg-white animate-in fade-in duration-150">
                {/* Cận lâm sàng */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-[#0b4d8c]" />
                    <span>Kết Quả Cận Lâm Sàng & Xét Nghiệm (HIS / Bệnh Án)</span>
                  </label>
                  <textarea
                    rows={4}
                    value={initialLabsText}
                    onChange={(e) => setInitialLabsText(e.target.value)}
                    placeholder="Dán hoặc nhập kết quả xét nghiệm máu (CTM, Sinh hóa), X-Quang phổi, CT Scanner, Siêu âm, ECG từ HIS..."
                    className="w-full p-2.5 bg-slate-50/60 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#0b4d8c] focus:border-transparent leading-relaxed"
                  />
                </div>

                {/* Diễn tiến lâm sàng */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Diễn Tiến Lâm Sàng & Thăm Khám</span>
                  </label>
                  <textarea
                    rows={5}
                    value={admissionClinicalNote}
                    onChange={(e) => setAdmissionClinicalNote(e.target.value)}
                    placeholder="Nhập diễn biến lâm sàng, triệu chứng cơ năng, thăm khám thực thể lúc tiếp nhận / hiện tại..."
                    className="w-full p-2.5 bg-slate-50/60 border border-slate-300 rounded-xl font-medium text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:border-transparent leading-relaxed"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2.5 sticky bottom-0 bg-white/95 backdrop-blur-xs py-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 min-h-[42px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 sm:flex-initial px-6 py-2.5 min-h-[42px] bg-gradient-to-r from-[#0b4d8c] to-[#083a69] hover:from-[#094178] hover:to-[#062c52] text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{isEditing ? 'Lưu Diễn Tiến' : 'Thêm Vào Khoa'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

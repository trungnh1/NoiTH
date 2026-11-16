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
  Stethoscope
} from 'lucide-react';

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

  // 2. Chẩn đoán, Hướng xử trí, Ghi chú, Bàn giao & Gắn nhãn Mức Độ Tình Trạng
  const [primaryDiagnosis, setPrimaryDiagnosis] = useState(patientToEdit?.primaryDiagnosis || '');
  const [treatmentPlan, setTreatmentPlan] = useState(patientToEdit?.treatmentPlan || '');
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
      treatmentAction: treatmentPlan.trim() || 'Theo dõi sinh hiệu, điều trị theo phác đồ nội khoa.',
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
        treatmentAction: treatmentPlan.trim() || 'Theo dõi sinh hiệu, tiếp tục điều trị theo phác đồ nội khoa.',
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
        primaryDiagnosis: primaryDiagnosis.trim(),
        severity,
        admissionStatus,
        dischargeTomorrowSetDate: admissionStatus === 'DISCHARGE_TOMORROW' 
          ? (dischargeTomorrowSetDate || todayDateStr) 
          : undefined,
        treatmentPlan: treatmentPlan.trim() || patientToEdit.treatmentPlan,
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
      treatmentPlan: treatmentPlan.trim() || 'Theo dõi sinh hiệu, điều trị theo phác đồ nội khoa.',
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

      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        
        {/* Header Modal */}
        <div className="px-4 sm:px-6 py-3.5 bg-gradient-to-r from-[#0b4d8c] via-[#083a69] to-slate-900 text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shadow-inner">
              {isEditing ? <FileEdit className="w-5 h-5 text-amber-300" /> : <UserPlus className="w-5 h-5 text-emerald-300" />}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-2">
                <span>{isEditing ? 'Chỉnh Sửa Hồ Sơ Bệnh Nhân' : 'Tiếp Nhận Bệnh Nhân Mới'}</span>
                {isEditing && patientToEdit?.roomNumber && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-white/20 text-white font-bold">
                    P.{patientToEdit.roomNumber}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-blue-100/80 font-medium">
                {isEditing ? 'Cập nhật thông tin bệnh nhân, chẩn đoán, hướng xử trí & bàn giao' : 'Khoa Nội Tổng Hợp • Bệnh Viện Hùng Vương Gia Lai'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/90 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Đóng cửa sổ"
          >
            <X className="w-4 h-4" />
          </button>
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
          
          {/* NỘI DUNG 1: THÔNG TIN BỆNH NHÂN */}
          <div className="bg-slate-50/90 p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-100 text-[#0b4d8c] flex items-center justify-center font-black text-xs">
                  1
                </div>
                <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide">
                  Thông Tin Bệnh Nhân & Buồng Phòng
                </h4>
              </div>
              {isEditing && patientToEdit?.patientCode && (
                <span className="text-[11px] font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                  Mã BN: {patientToEdit.patientCode}
                </span>
              )}
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
                  rows={2}
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
                    rows={2}
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
                    rows={2}
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
                    rows={3}
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
                    rows={3}
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
              <span>{isEditing ? 'Lưu Thay Đổi' : 'Thêm Vào Khoa'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

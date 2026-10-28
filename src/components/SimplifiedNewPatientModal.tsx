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
import { GROUP_1_ROOM_NUMBERS, GROUP_1_DOCTOR_IDS } from '../data/mockData';
import { formatDoctorShortName } from './DetailedPatientListView';
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
  ShieldAlert
} from 'lucide-react';

interface SimplifiedNewPatientModalProps {
  rooms: DepartmentRoom[];
  doctors: Doctor[];
  patients: Patient[];
  prefilledRoom?: string;
  prefilledBed?: string;
  onClose: () => void;
  onAddPatient: (newPatient: Patient) => void;
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
  prefilledRoom,
  onClose,
  onAddPatient,
}) => {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const now = new Date();
  const defaultDateTimeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Form states
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState<number>(60);
  const [gender, setGender] = useState<'Nam' | 'Nữ'>('Nam');
  const [roomNumber, setRoomNumber] = useState<string>(prefilledRoom || '703');
  const [admissionDateTime, setAdmissionDateTime] = useState<string>(defaultDateTimeStr);

  const [primaryDiagnosis, setPrimaryDiagnosis] = useState('');
  
  // Tiền sử & Dị ứng (có nút tích chọn có dị ứng)
  const [medicalHistory, setMedicalHistory] = useState('');
  const [hasAllergy, setHasAllergy] = useState<boolean>(false);
  const [allergyDetails, setAllergyDetails] = useState('');

  // Diễn tiến lâm sàng lúc tiếp nhận (tùy chọn)
  const [admissionClinicalNote, setAdmissionClinicalNote] = useState('');

  const [severity, setSeverity] = useState<SeverityLevel>('STABLE');
  const [selectedTags, setSelectedTags] = useState<ClinicalTag[]>([]);

  // Default to first doctor in Nhóm 1 (e.g. BS. Trần Hữu Ngọc)
  const defaultGroup1Doc = doctors.find((d) => GROUP_1_DOCTOR_IDS.includes(d.id))?.id || '00708';
  const [attendingDoctorId, setAttendingDoctorId] = useState<string>(defaultGroup1Doc);
  const [treatmentPlan, setTreatmentPlan] = useState('');
  
  // Tách riêng: Bàn giao tua trực (ở trên) & Ghi chú (ở dưới)
  const [handoverNotes, setHandoverNotes] = useState('');
  const [importantNotes, setImportantNotes] = useState('');

  // Initial vitals - KHÔNG NHẬP SẴN (để trống, nằm ở cột hành chính)
  const [bpSys, setBpSys] = useState<string>('');
  const [bpDia, setBpDia] = useState<string>('');
  const [pulse, setPulse] = useState<string>('');
  const [temperature, setTemperature] = useState<string>('');
  const [spO2, setSpO2] = useState<string>('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Group 1 core doctors list for 1-click select
  const group1Doctors = useMemo(() => {
    return doctors.filter(
      (d) => GROUP_1_DOCTOR_IDS.includes(d.id) || /ngọc|trung|huyền|thiên|ánh|bình chi/i.test(d.name)
    );
  }, [doctors]);

  // Current room active patient count
  const roomPatientCount = useMemo(() => {
    return patients.filter((p) => p.status === 'ACTIVE' && p.roomNumber === roomNumber).length;
  }, [roomNumber, patients]);

  // Sync allergy checkbox with clinical tags
  const handleToggleAllergy = (checked: boolean) => {
    setHasAllergy(checked);
    if (checked) {
      if (!selectedTags.includes('ALLERGY')) {
        setSelectedTags([...selectedTags, 'ALLERGY']);
      }
    } else {
      setSelectedTags(selectedTags.filter((t) => t !== 'ALLERGY'));
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
      setSelectedTags(selectedTags.filter((t) => t !== tag));
      if (tag === 'ALLERGY') setHasAllergy(false);
    } else {
      setSelectedTags([...selectedTags, tag]);
      if (tag === 'ALLERGY') setHasAllergy(true);
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
      fullName: fullName.trim().toUpperCase(),
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
      status: 'ACTIVE',
      vitals: initialVitalsList,
      evolutions: [initialEvolution],
      labs: [],
      medications: [],
    };

    onAddPatient(newPatient);
    onClose();
  };

  const currentDoctorName = doctors.find((d) => d.id === attendingDoctorId)?.name || 'Chưa chọn';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
      {/* POPUP RỘNG HƠN GẦN FULL MÀN HÌNH (max-w-[96vw] / max-w-7xl) */}
      <div className="bg-white rounded-2xl w-full max-w-[96vw] xl:max-w-7xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[96vh]">
        
        {/* Header */}
        <div className="px-6 py-3.5 bg-gradient-to-r from-slate-900 via-rose-900 to-slate-900 text-white flex items-center justify-between border-b border-rose-950/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white border border-white/20 shadow-xs">
              <UserPlus className="w-5 h-5 text-rose-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-white">
                  Tiếp Nhận Bệnh Nhân Nội Trú Mới
                </h3>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-200 border border-rose-400/40">
                  Khoa Nội Tổng Hợp
                </span>
              </div>
              <p className="text-xs text-rose-200/90 font-medium">
                Nhập nhanh thông tin hành chính, sinh hiệu, chẩn đoán, tiền sử, diễn tiến và bàn giao
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block text-[11px] text-slate-300 bg-black/20 px-2.5 py-1 rounded-lg border border-white/10 font-mono">
              Esc để đóng • Ctrl+Enter để lưu
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
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
            
            {/* CỘT TRÁI (4.5 cols): Buồng phòng, Hành chính & Sinh hiệu ban đầu */}
            <div className="lg:col-span-4 xl:col-span-4 space-y-3.5">
              
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
                      setFullName(e.target.value.toUpperCase());
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="VD: NGUYỄN VĂN AN"
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-black text-xs tracking-wide focus:ring-2 focus:ring-rose-500 uppercase placeholder:normal-case"
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

              {/* 3. Sinh Hiệu Ban Đầu (Cùng bên hành chính, nhỏ gọn hơn ô chẩn đoán, không nhập sẵn) */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-800 font-black text-[11px] uppercase">
                    <HeartPulse className="w-3.5 h-3.5 text-rose-600" />
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
                        className="w-full p-1 bg-white border border-slate-300 rounded text-center font-bold text-xs placeholder:font-normal placeholder:text-slate-300"
                        title="Tâm thu"
                      />
                      <span className="text-slate-400 text-xs font-bold">/</span>
                      <input
                        type="number"
                        value={bpDia}
                        onChange={(e) => setBpDia(e.target.value)}
                        placeholder="80"
                        className="w-full p-1 bg-white border border-slate-300 rounded text-center font-bold text-xs placeholder:font-normal placeholder:text-slate-300"
                        title="Tâm trương"
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
                      className="w-full p-1 bg-white border border-slate-300 rounded text-center font-bold text-xs placeholder:font-normal placeholder:text-slate-300"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-slate-600 block text-center truncate">SpO2 (%)</label>
                    <input
                      type="number"
                      value={spO2}
                      onChange={(e) => setSpO2(e.target.value)}
                      placeholder="98"
                      className="w-full p-1 bg-white border border-slate-300 rounded text-center font-black text-xs text-rose-600 placeholder:font-normal placeholder:text-slate-300"
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
                      className="w-full p-1 bg-white border border-slate-300 rounded text-center font-bold text-xs placeholder:font-normal placeholder:text-slate-300"
                    />
                  </div>
                </div>
              </div>

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
                  <div className="grid grid-cols-3 gap-2">
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

              {/* 7. Bác Sĩ Điều Trị Phụ Trách & Thẻ Lâm Sàng */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                
                {/* Bác sĩ Nhóm 1 */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-800 font-black text-xs uppercase">
                      <Stethoscope className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Bác Sĩ Điều Trị</span>
                      <span className="text-rose-500">*</span>
                    </div>
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                      BS. {formatDoctorShortName(currentDoctorName)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1">
                    {group1Doctors.map((doc) => {
                      const isSelected = attendingDoctorId === doc.id;
                      const short = formatDoctorShortName(doc.name);
                      return (
                        <button
                          type="button"
                          key={doc.id}
                          onClick={() => setAttendingDoctorId(doc.id)}
                          className={`py-1 px-1 rounded-lg border font-bold text-xs text-center transition-all cursor-pointer truncate ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs font-black'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50 hover:border-indigo-300'
                          }`}
                          title={doc.name}
                        >
                          BS. {short}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Thẻ theo dõi */}
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1 shadow-2xs">
                  <span className="text-[11px] font-extrabold text-slate-700 block uppercase">
                    Thẻ Theo Dõi Lâm Sàng Đặc Biệt
                  </span>
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
                            className={`px-2 py-0.5 rounded-md border text-[10.5px] font-bold transition-all cursor-pointer ${
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

              {/* TÁCH LÀM 2: BÀN GIAO TUA TRỰC (Ở TRÊN) & GHI CHÚ (Ở DƯỚI) */}
              <div className="space-y-3">
                {/* 9. Bàn Giao Tua Trực (ở trên) */}
                <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-amber-900 font-black text-xs uppercase">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-amber-700" />
                    <span>Bàn Giao Tua Trực</span>
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
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-98 text-xs"
              >
                <UserPlus className="w-4 h-4" />
                <span>Tiếp Nhận Bệnh Nhân (Ctrl+Enter)</span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};

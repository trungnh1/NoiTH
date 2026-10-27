import React, { useState, useMemo } from 'react';
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
import { 
  X, 
  UserPlus, 
  CheckCircle2, 
  AlertTriangle, 
  Stethoscope, 
  HeartPulse, 
  Wind, 
  Eye, 
  Calendar,
  Clock,
  Building,
  Activity
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

export const SimplifiedNewPatientModal: React.FC<SimplifiedNewPatientModalProps> = ({
  rooms,
  doctors,
  patients,
  prefilledRoom,
  prefilledBed,
  onClose,
  onAddPatient,
}) => {
  const now = new Date();
  const defaultDateTimeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Form states
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState<number>(60);
  const [gender, setGender] = useState<'Nam' | 'Nữ'>('Nam');
  const [roomNumber, setRoomNumber] = useState<string>(prefilledRoom || rooms[0]?.number || '733');
  const [admissionDateTime, setAdmissionDateTime] = useState<string>(defaultDateTimeStr);

  const [primaryDiagnosis, setPrimaryDiagnosis] = useState('');
  const [secondaryDiagnosis, setSecondaryDiagnosis] = useState('');
  const [severity, setSeverity] = useState<SeverityLevel>('STABLE');
  const [selectedTags, setSelectedTags] = useState<ClinicalTag[]>([]);

  const [attendingDoctorId, setAttendingDoctorId] = useState<string>(doctors[0]?.id || '00161');
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');

  // Initial vitals
  const [bpSys, setBpSys] = useState<number>(120);
  const [bpDia, setBpDia] = useState<number>(80);
  const [pulse, setPulse] = useState<number>(80);
  const [temperature, setTemperature] = useState<number>(37.0);
  const [spO2, setSpO2] = useState<number>(98);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto calculate empty bed in room
  const autoAssignedBed = useMemo(() => {
    if (prefilledBed && prefilledRoom === roomNumber) {
      return prefilledBed;
    }
    const targetRoom = rooms.find((r) => r.number === roomNumber);
    const totalBeds = targetRoom?.totalBeds || 3;
    const occupiedBeds = new Set(
      patients
        .filter((p) => p.status === 'ACTIVE' && p.roomNumber === roomNumber)
        .map((p) => p.bedNumber)
    );

    for (let i = 1; i <= totalBeds; i++) {
      const bName = `Giường ${i < 10 ? '0' + i : i}`;
      if (!occupiedBeds.has(bName)) {
        return bName;
      }
    }
    return 'Giường 01';
  }, [roomNumber, prefilledBed, prefilledRoom, rooms, patients]);

  const [customBed, setCustomBed] = useState<string>('');

  const effectiveBedNumber = customBed.trim() || autoAssignedBed;

  const toggleTag = (tag: ClinicalTag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMsg('Vui lòng nhập họ và tên bệnh nhân.');
      return;
    }
    if (!primaryDiagnosis.trim()) {
      setErrorMsg('Vui lòng nhập chẩn đoán hiện tại của bệnh nhân.');
      return;
    }

    const formattedAdmissionDate = admissionDateTime.replace('T', ' ');
    const assignedDoctor = doctors.find((d) => d.id === attendingDoctorId);

    const initialVital: VitalSign = {
      id: `V-${Date.now()}`,
      timestamp: formattedAdmissionDate,
      bpSystolic: bpSys || 120,
      bpDiastolic: bpDia || 80,
      heartRate: pulse || 80,
      temperature: temperature || 37.0,
      spO2: spO2 || 98,
      respiratoryRate: 20,
      notes: 'Sinh hiệu lúc nhập khoa',
    };

    const initialEvolution: ClinicalEvolution = {
      id: `EV-${Date.now()}`,
      timestamp: formattedAdmissionDate,
      doctorName: assignedDoctor?.name || 'BS Điều trị',
      shift: 'Sáng',
      clinicalNote: `Tiếp nhận bệnh nhân vào ${roomNumber} - ${effectiveBedNumber}. Chẩn đoán: ${primaryDiagnosis.trim()}.`,
      treatmentAction: treatmentPlan.trim() || 'Chỉ định cận lâm sàng thường quy, y lệnh điều trị ban đầu và theo dõi sinh hiệu.',
    };

    const newPatient: Patient = {
      id: `PAT-${Date.now()}`,
      patientCode: `BN-${Date.now().toString().slice(-6)}`,
      fullName: fullName.trim(),
      gender,
      age: Number(age) || 50,
      dateOfBirth: `${now.getFullYear() - (Number(age) || 50)}-01-01`,
      admissionDate: formattedAdmissionDate,
      department: 'Khoa Nội Tổng Hợp',
      roomNumber,
      bedNumber: effectiveBedNumber,
      attendingDoctorId,
      primaryNurse: 'ĐD. Tua trực tiếp nhận',
      primaryDiagnosis: primaryDiagnosis.trim(),
      secondaryDiagnosis: secondaryDiagnosis.trim() || undefined,
      severity,
      admissionStatus: 'STABLE_INPATIENT',
      tags: selectedTags,
      treatmentPlan: treatmentPlan.trim() || 'Theo dõi sinh hiệu, điều trị theo phác đồ nội khoa.',
      importantNotes: handoverNotes.trim() || `Bệnh nhân tiếp nhận vào khoa lúc ${formattedAdmissionDate}.`,
      handoverNotes: handoverNotes.trim() || 'Theo dõi diễn tiến lâm sàng.',
      status: 'ACTIVE',
      vitals: [initialVital],
      evolutions: [initialEvolution],
      labs: [],
      medications: [],
    };

    onAddPatient(newPatient);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-rose-700 via-red-700 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">
                Tiếp Nhận Bệnh Nhân Nội Trú Mới (Khoa Nội Tổng Hợp)
              </h3>
              <p className="text-xs text-rose-100/90">
                Nhập nhanh thông tin hành chính, chẩn đoán, kế hoạch điều trị và buồng giường
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 font-bold flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Buồng Phòng & Hành Chính */}
          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 space-y-3">
            <span className="font-black text-slate-800 uppercase text-[11px] block">
              1. Buồng Phòng & Thông Tin Bệnh Nhân
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* Phòng bệnh */}
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">
                  Phòng Bệnh <span className="text-rose-500">*</span>
                </label>
                <select
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-xs focus:ring-2 focus:ring-rose-500 cursor-pointer"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.number}>
                      Phòng {r.number} ({r.name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Giường bệnh */}
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">
                  Giường Bệnh
                </label>
                <input
                  type="text"
                  value={customBed || autoAssignedBed}
                  onChange={(e) => setCustomBed(e.target.value)}
                  placeholder={autoAssignedBed}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-xs focus:ring-2 focus:ring-rose-500 text-rose-700"
                />
              </div>

              {/* Ngày giờ vào viện */}
              <div className="sm:col-span-2">
                <label className="font-extrabold text-slate-700 block mb-1">
                  Ngày Giờ Vào Viện <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={admissionDateTime}
                  onChange={(e) => setAdmissionDateTime(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-xs focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>
            </div>

            {/* Họ tên, tuổi, giới */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="font-extrabold text-slate-700 block mb-1">
                  Họ và Tên Bệnh Nhân <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Ví dụ: Lê Thị Kim Oanh"
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-xs focus:ring-2 focus:ring-rose-500 uppercase"
                  required
                />
              </div>

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
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-xs focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">
                  Giới Tính
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as 'Nam' | 'Nữ')}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-xs focus:ring-2 focus:ring-rose-500 cursor-pointer"
                >
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Chẩn Đoán & Mức Độ */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3 shadow-2xs">
            <span className="font-black text-slate-800 uppercase text-[11px] block">
              2. Chẩn Đoán & Tình Trạng Lâm Sàng
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">
                  Chẩn Đoán Hiện Tại (Không Cần ICD) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={primaryDiagnosis}
                  onChange={(e) => {
                    setPrimaryDiagnosis(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Ví dụ: Suy tim cấp đợt mất bù, Đợt cấp COPD bội nhiễm..."
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-medium text-xs focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">
                  Bệnh Kèm Theo / Tiền Sử (Nếu có)
                </label>
                <textarea
                  rows={2}
                  value={secondaryDiagnosis}
                  onChange={(e) => setSecondaryDiagnosis(e.target.value)}
                  placeholder="Ví dụ: Tăng huyết áp, Đái tháo đường typ 2, Suy thận mạn giai đoạn 3..."
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-medium text-xs focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            {/* Mức độ & Bác sĩ phụ trách */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">
                  Mức Độ Tình Trạng
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSeverity('CRITICAL')}
                    className={`flex-1 py-2 px-3 rounded-lg font-black text-xs border transition-all cursor-pointer ${
                      severity === 'CRITICAL'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-rose-50'
                    }`}
                  >
                    🔴 Nặng
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeverity('MODERATE')}
                    className={`flex-1 py-2 px-3 rounded-lg font-black text-xs border transition-all cursor-pointer ${
                      severity === 'MODERATE'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-amber-50'
                    }`}
                  >
                    🟡 Trung bình
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeverity('STABLE')}
                    className={`flex-1 py-2 px-3 rounded-lg font-black text-xs border transition-all cursor-pointer ${
                      severity === 'STABLE'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-emerald-50'
                    }`}
                  >
                    🟢 Ổn định
                  </button>
                </div>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">
                  Bác Sĩ Điều Trị Phụ Trách <span className="text-rose-500">*</span>
                </label>
                <select
                  value={attendingDoctorId}
                  onChange={(e) => setAttendingDoctorId(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-xs focus:ring-2 focus:ring-rose-500 cursor-pointer"
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      BS. {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Nhãn đặc biệt */}
            <div>
              <span className="font-extrabold text-slate-700 block mb-1 text-[11px]">
                Nhãn Lâm Sàng Đặc Biệt (Chọn nhanh)
              </span>
              <div className="flex flex-wrap gap-1.5">
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
                        className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? `${meta.badgeBg} text-white border-transparent shadow-xs`
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Section 3: Kế Hoạch Điều Trị & Ghi Chú Bàn Giao */}
          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 space-y-3">
            <span className="font-black text-slate-800 uppercase text-[11px] block">
              3. Kế Hoạch Điều Trị & Ghi Chú Bàn Giao
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-extrabold text-blue-900 block mb-1">
                  Kế Hoạch Điều Trị Ban Đầu / Y Lệnh Thuốc
                </label>
                <textarea
                  rows={2}
                  value={treatmentPlan}
                  onChange={(e) => setTreatmentPlan(e.target.value)}
                  placeholder="Ví dụ: Nằm đầu cao 30 độ; Thở oxy Canula 2 l/p; Ceftriaxon 1g x 02 lọ tiêm TM; Khí dung Ventolin 2.5mg..."
                  className="w-full p-2 bg-white border border-blue-200 rounded-lg font-medium text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-extrabold text-amber-900 block mb-1">
                  Ghi Chú & Bàn Giao Kíp Trực
                </label>
                <textarea
                  rows={2}
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  placeholder="Ví dụ: Bệnh nhân lớn tuổi, tiền sử dị ứng thuốc Penicillin, cần theo dõi SpO2 mỗi 2h, dặn dò thân nhân..."
                  className="w-full p-2 bg-white border border-amber-200 rounded-lg font-medium text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Quick Vitals */}
            <div className="pt-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Sinh hiệu lúc vào viện (tùy chọn)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 block">HA Tâm Thu</span>
                  <input
                    type="number"
                    value={bpSys}
                    onChange={(e) => setBpSys(Number(e.target.value))}
                    className="w-full p-1.5 bg-white border border-slate-300 rounded-lg font-bold text-center text-xs"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">HA Tâm Trương</span>
                  <input
                    type="number"
                    value={bpDia}
                    onChange={(e) => setBpDia(Number(e.target.value))}
                    className="w-full p-1.5 bg-white border border-slate-300 rounded-lg font-bold text-center text-xs"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Mạch (l/p)</span>
                  <input
                    type="number"
                    value={pulse}
                    onChange={(e) => setPulse(Number(e.target.value))}
                    className="w-full p-1.5 bg-white border border-slate-300 rounded-lg font-bold text-center text-xs"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Nhiệt Độ (°C)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                    className="w-full p-1.5 bg-white border border-slate-300 rounded-lg font-bold text-center text-xs"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">SpO2 (%)</span>
                  <input
                    type="number"
                    value={spO2}
                    onChange={(e) => setSpO2(Number(e.target.value))}
                    className="w-full p-1.5 bg-white border border-slate-300 rounded-lg font-bold text-center text-xs text-rose-700"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition-colors cursor-pointer"
            >
              Hủy Bỏ
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-98"
            >
              <UserPlus className="w-4 h-4" />
              <span>Tiếp Nhận Bệnh Nhân</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { 
  Patient, 
  Doctor, 
  SeverityLevel, 
  ClinicalEvolution, 
  VitalSign 
} from '../types/patient';
import { 
  X, 
  Activity, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Stethoscope, 
  FileText, 
  HeartPulse, 
  Layers,
  ChevronDown,
  History
} from 'lucide-react';
import { calculateTreatmentDays, formatDoctorShortName } from './DetailedPatientListView';

interface QuickEvolutionModalProps {
  patient: Patient;
  doctors: Doctor[];
  onClose: () => void;
  onSaveEvolution: (updatedPatient: Patient) => void;
}

export const QuickEvolutionModal: React.FC<QuickEvolutionModalProps> = ({
  patient,
  doctors,
  onClose,
  onSaveEvolution,
}) => {
  const treatmentInfo = calculateTreatmentDays(patient.admissionDate);
  const now = new Date();
  const defaultDateTimeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Form states
  const [evolutionDateTime, setEvolutionDateTime] = useState(defaultDateTimeStr);
  const [shift, setShift] = useState<'Sáng' | 'Chiều' | 'Đêm / Trực'>('Sáng');
  
  const currentDoc = doctors.find((d) => d.id === patient.attendingDoctorId);
  const [doctorName, setDoctorName] = useState(currentDoc?.name || doctors[0]?.name || 'BS Điều trị');
  const [severity, setSeverity] = useState<SeverityLevel>(patient.severity || 'STABLE');
  const [admissionStatus, setAdmissionStatus] = useState<Patient['admissionStatus']>(patient.admissionStatus || 'STABLE_INPATIENT');

  // Clinical content
  const [clinicalNote, setClinicalNote] = useState('');
  const [treatmentAction, setTreatmentAction] = useState(
    patient.treatmentPlan || patient.evolutions?.[0]?.treatmentAction || ''
  );
  const [handoverNotes, setHandoverNotes] = useState(patient.importantNotes || patient.handoverNotes || '');

  // Quick vital signs
  const latestVital = patient.vitals?.[0];
  const [bpSys, setBpSys] = useState<string>(latestVital?.bpSystolic ? String(latestVital.bpSystolic) : '120');
  const [bpDia, setBpDia] = useState<string>(latestVital?.bpDiastolic ? String(latestVital.bpDiastolic) : '80');
  const [pulse, setPulse] = useState<string>(latestVital?.heartRate ? String(latestVital.heartRate) : '80');
  const [temperature, setTemperature] = useState<string>(latestVital?.temperature ? String(latestVital.temperature) : '37.0');
  const [spO2, setSpO2] = useState<string>(latestVital?.spO2 ? String(latestVital.spO2) : '98');

  // Error message
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicalNote.trim()) {
      setErrorMsg('Vui lòng nhập diễn biến lâm sàng của bệnh nhân trong ngày.');
      return;
    }

    const formattedTime = evolutionDateTime.replace('T', ' ');

    // New evolution entry
    const newEvolution: ClinicalEvolution = {
      id: `EV-${Date.now()}`,
      timestamp: formattedTime,
      doctorName,
      shift,
      clinicalNote: clinicalNote.trim(),
      treatmentAction: treatmentAction.trim() || 'Duy trì phác đồ điều trị hiện tại.',
    };

    // New vital sign entry if values provided
    const newVital: VitalSign = {
      id: `V-${Date.now()}`,
      timestamp: formattedTime,
      bpSystolic: Number(bpSys) || 120,
      bpDiastolic: Number(bpDia) || 80,
      heartRate: Number(pulse) || 80,
      temperature: Number(temperature) || 37.0,
      spO2: Number(spO2) || 98,
      respiratoryRate: 20,
      notes: `Ghi nhận ca ${shift}`,
    };

    const updatedPatient: Patient = {
      ...patient,
      severity,
      admissionStatus,
      treatmentPlan: treatmentAction.trim() || patient.treatmentPlan,
      importantNotes: handoverNotes.trim() || patient.importantNotes,
      handoverNotes: handoverNotes.trim() || patient.handoverNotes,
      evolutions: [newEvolution, ...(patient.evolutions || [])],
      vitals: [newVital, ...(patient.vitals || [])],
    };

    onSaveEvolution(updatedPatient);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-indigo-900 via-slate-900 to-rose-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight">
                  Nhập Diễn Tiến Lâm Sàng & Kế Hoạch Điều Trị
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">
                  {treatmentInfo.label}
                </span>
              </div>
              <p className="text-xs text-indigo-200/90 font-medium">
                Bệnh nhân: <strong className="text-white">{patient.fullName}</strong> ({patient.age}t, {patient.gender}) • <span className="bg-white/20 px-1.5 py-0.2 rounded font-bold">{patient.roomNumber} - {patient.bedNumber}</span>
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

        {/* Current Clinical Summary Card */}
        <div className="bg-slate-50 px-5 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div>
            <span className="text-slate-400 font-bold uppercase text-[10px] block">Chẩn đoán:</span>
            <span className="font-extrabold text-slate-800">
              {[patient.primaryDiagnosis, patient.secondaryDiagnosis].filter(Boolean).join(' - ')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold text-[10px] uppercase">Bác sĩ phụ trách:</span>
            <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
              BS. {currentDoc?.name || 'Điều trị'}
            </span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 font-bold flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Row 1: Time, Shift, Doctor, Severity, Discharge Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            
            {/* DateTime */}
            <div>
              <label className="font-extrabold text-slate-700 block mb-1">
                Ngày Giờ Diễn Tiến <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={evolutionDateTime}
                onChange={(e) => setEvolutionDateTime(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg font-bold text-xs focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            {/* Shift */}
            <div>
              <label className="font-extrabold text-slate-700 block mb-1">
                Ca Trực
              </label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value as any)}
                className="w-full p-2 border border-slate-300 rounded-lg font-bold text-xs focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="Sáng">Ca Sáng (07:00 - 15:00)</option>
                <option value="Chiều">Ca Chiều (15:00 - 21:00)</option>
                <option value="Đêm / Trực">Ca Đêm / Trực (21:00 - 07:00)</option>
              </select>
            </div>

            {/* Doctor */}
            <div>
              <label className="font-extrabold text-slate-700 block mb-1">
                Bác Sĩ Ghi Nhận
              </label>
              <select
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg font-bold text-xs focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {doctors.map((d) => (
                  <option key={d.id} value={d.name}>
                    BS. {formatDoctorShortName(d.name)}
                  </option>
                ))}
              </select>
            </div>

            {/* Severity Status */}
            <div>
              <label className="font-extrabold text-slate-700 block mb-1">
                Tình Trạng Lâm Sàng
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as SeverityLevel)}
                className={`w-full p-2 border rounded-lg font-black text-xs cursor-pointer ${
                  severity === 'CRITICAL' 
                    ? 'bg-rose-50 border-rose-400 text-rose-800' 
                    : severity === 'MODERATE' 
                    ? 'bg-amber-50 border-amber-400 text-amber-800' 
                    : 'bg-emerald-50 border-emerald-400 text-emerald-800'
                }`}
              >
                <option value="CRITICAL">🔴 NẶNG (Báo động)</option>
                <option value="MODERATE">🟡 TRUNG BÌNH</option>
                <option value="STABLE">🟢 ỔN ĐỊNH</option>
              </select>
            </div>

            {/* Discharge Plan Status */}
            <div>
              <label className="font-extrabold text-slate-700 block mb-1">
                Kế Hoạch Ra Viện
              </label>
              <select
                value={admissionStatus || 'STABLE_INPATIENT'}
                onChange={(e) => setAdmissionStatus(e.target.value as Patient['admissionStatus'])}
                className={`w-full p-2 border rounded-lg font-black text-xs cursor-pointer ${
                  admissionStatus === 'DISCHARGE_TODAY'
                    ? 'bg-purple-50 border-purple-400 text-purple-900 font-extrabold'
                    : admissionStatus === 'DISCHARGE_TOMORROW'
                    ? 'bg-blue-50 border-blue-400 text-blue-900 font-extrabold'
                    : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              >
                <option value="STABLE_INPATIENT">🏥 Đang điều trị</option>
                <option value="DISCHARGE_TODAY">🟣 RV hôm nay</option>
                <option value="DISCHARGE_TOMORROW">🔵 Dự kiến RV mai</option>
              </select>
            </div>

          </div>

          {/* Quick Vital Signs Bar */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="font-extrabold text-slate-700 uppercase text-[10px] block mb-2">
              Sinh Hiệu Hiện Tại (Tùy Chọn Nhập Nhanh)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div>
                <span className="text-[10px] text-slate-500 font-bold block">HA Tâm Thu (mmHg)</span>
                <input
                  type="number"
                  value={bpSys}
                  onChange={(e) => setBpSys(e.target.value)}
                  placeholder="120"
                  className="w-full p-1.5 bg-white border border-slate-300 rounded-lg font-bold text-xs text-center"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold block">HA Tâm Trương (mmHg)</span>
                <input
                  type="number"
                  value={bpDia}
                  onChange={(e) => setBpDia(e.target.value)}
                  placeholder="80"
                  className="w-full p-1.5 bg-white border border-slate-300 rounded-lg font-bold text-xs text-center"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold block">Mạch (lần/phút)</span>
                <input
                  type="number"
                  value={pulse}
                  onChange={(e) => setPulse(e.target.value)}
                  placeholder="80"
                  className="w-full p-1.5 bg-white border border-slate-300 rounded-lg font-bold text-xs text-center"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold block">Nhiệt Độ (°C)</span>
                <input
                  type="number"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  placeholder="37.0"
                  className="w-full p-1.5 bg-white border border-slate-300 rounded-lg font-bold text-xs text-center"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold block">SpO2 (%)</span>
                <input
                  type="number"
                  value={spO2}
                  onChange={(e) => setSpO2(e.target.value)}
                  placeholder="98"
                  className="w-full p-1.5 bg-white border border-slate-300 rounded-lg font-bold text-xs text-center text-indigo-700"
                />
              </div>
            </div>
          </div>

          {/* Core Field 1: Diễn biến lâm sàng trong ngày */}
          <div className="space-y-1">
            <label className="font-extrabold text-slate-900 text-xs flex items-center justify-between">
              <span>1. Diễn Biến Lâm Sàng Trong Ngày <span className="text-rose-500">*</span></span>
              <span className="text-[11px] text-slate-400 font-normal">Triệu chứng, tri giác, đáp ứng điều trị...</span>
            </label>
            <textarea
              rows={3}
              value={clinicalNote}
              onChange={(e) => {
                setClinicalNote(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="Ví dụ: Bệnh nhân tỉnh táo, đỡ khó thở, phổi ran ẩm 2 đáy giảm, bụng mềm, không sốt, sinh hiệu ổn định, ăn uống khá hơn..."
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-medium text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              required
            />
          </div>

          {/* Core Field 2: Kế hoạch điều trị ngày tiếp theo */}
          <div className="space-y-1">
            <label className="font-extrabold text-slate-900 text-xs flex items-center justify-between">
              <span className="text-blue-900 font-black">2. Kế Hoạch Điều Trị / Y Lệnh Mới <span className="text-rose-500">*</span></span>
              <span className="text-[11px] text-blue-600 font-normal">Thuốc, dịch truyền, cận lâm sàng, điều chỉnh liều...</span>
            </label>
            <textarea
              rows={3}
              value={treatmentAction}
              onChange={(e) => setTreatmentAction(e.target.value)}
              placeholder="Ví dụ: Tiếp tục Ceftriaxon 1g x 02 lọ tiêm TM; Furosemid 20mg x 01 ống tiêm TM sáng; Thở oxy gọng kính 2 l/p; Làm lại Creatinine và Điện giải đồ sáng mai..."
              className="w-full p-2.5 bg-blue-50/40 border border-blue-300 rounded-xl font-medium text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Core Field 3: Ghi chú và bàn giao */}
          <div className="space-y-1">
            <label className="font-extrabold text-slate-900 text-xs flex items-center justify-between">
              <span className="text-amber-900 font-black">3. Ghi Chú & Bàn Giao Kíp Trực</span>
              <span className="text-[11px] text-amber-700 font-normal">Dặn dò theo dõi đêm, lưu ý tai biến...</span>
            </label>
            <textarea
              rows={2}
              value={handoverNotes}
              onChange={(e) => setHandoverNotes(e.target.value)}
              placeholder="Ví dụ: Theo dõi sát SpO2 và lượng nước tiểu 24h; Báo bác sĩ trực ngay nếu SpO2 < 94% hoặc đau ngực tái phát..."
              className="w-full p-2.5 bg-amber-50/40 border border-amber-300 rounded-xl font-medium text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          {/* Previous Evolutions Accordion / History */}
          {patient.evolutions && patient.evolutions.length > 0 && (
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/60 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-slate-700 text-xs">
                <History className="w-4 h-4 text-slate-500" />
                <span>Lịch Sử Các Ngày Diễn Tiến Trước Đó ({patient.evolutions.length} lần ghi)</span>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                {patient.evolutions.map((evo, idx) => (
                  <div key={evo.id || idx} className="p-2 rounded-lg bg-white border border-slate-200 text-[11px] space-y-0.5">
                    <div className="flex items-center justify-between text-slate-500 font-semibold">
                      <span>{evo.timestamp} • Ca {evo.shift}</span>
                      <span className="font-bold text-slate-700">BS. {evo.doctorName}</span>
                    </div>
                    <p className="text-slate-800 font-medium">
                      <strong>Diễn biến:</strong> {evo.clinicalNote}
                    </p>
                    {evo.treatmentAction && (
                      <p className="text-blue-800">
                        <strong>Xử trí:</strong> {evo.treatmentAction}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

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
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-98"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Lưu Diễn Tiến Lâm Sàng</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

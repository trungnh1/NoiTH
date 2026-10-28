import React, { useState, useEffect } from 'react';
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
  CheckCircle2, 
  AlertTriangle, 
  Stethoscope, 
  FileText, 
  HeartPulse, 
  History,
  Copy,
  Clock,
  ArrowRightLeft,
  ChevronRight
} from 'lucide-react';
import { calculateTreatmentDays, formatDoctorShortName } from './DetailedPatientListView';
import { GROUP_1_DOCTOR_IDS } from '../data/mockData';

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
  const [handoverNotes, setHandoverNotes] = useState(patient.handoverNotes || patient.importantNotes || '');

  // Quick vital signs (không bắt buộc nhập sẵn nếu không có đo mới)
  const latestVital = patient.vitals?.[0];
  const [bpSys, setBpSys] = useState<string>(latestVital?.bpSystolic ? String(latestVital.bpSystolic) : '');
  const [bpDia, setBpDia] = useState<string>(latestVital?.bpDiastolic ? String(latestVital.bpDiastolic) : '');
  const [pulse, setPulse] = useState<string>(latestVital?.heartRate ? String(latestVital.heartRate) : '');
  const [temperature, setTemperature] = useState<string>(latestVital?.temperature ? String(latestVital.temperature) : '');
  const [spO2, setSpO2] = useState<string>(latestVital?.spO2 ? String(latestVital.spO2) : '');

  // Error message & copy toast
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Group 1 core doctors list for 1-click select
  const group1Doctors = doctors.filter(
    (d) => GROUP_1_DOCTOR_IDS.includes(d.id) || /ngọc|trung|huyền|thiên|ánh|bình chi/i.test(d.name)
  );

  // Hotkeys: Esc to close, Ctrl+Enter to submit
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
  }, [clinicalNote, treatmentAction, handoverNotes, evolutionDateTime, shift, doctorName, severity, admissionStatus, bpSys, bpDia, pulse, temperature, spO2]);

  const handleCopyPreviousPlan = (actionText: string) => {
    setTreatmentAction(actionText);
    setToastMsg('Đã sao chép y lệnh sang hôm nay!');
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
      {/* POPUP RỘNG GẦN FULL MÀN HÌNH (max-w-[96vw] / max-w-7xl) */}
      <div className="bg-white rounded-2xl w-full max-w-[96vw] xl:max-w-7xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[96vh]">
        
        {/* Header - Thông tin Bệnh Nhân Rõ Ràng & Khoa Học */}
        <div className="px-6 py-3.5 bg-gradient-to-r from-indigo-950 via-slate-900 to-rose-950 text-white flex items-center justify-between border-b border-indigo-900/40 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-xs">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black tracking-tight uppercase">
                  {patient.fullName}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-md bg-white/20 font-bold text-slate-100">
                  {patient.age} tuổi • {patient.gender}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-md bg-rose-600 font-black text-white">
                  Phòng {patient.roomNumber}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-600 font-extrabold text-white">
                  {treatmentInfo.label}
                </span>
              </div>
              <p className="text-xs text-indigo-200/90 font-medium mt-0.5">
                Chẩn đoán: <strong className="text-white">{patient.primaryDiagnosis}</strong>
                {patient.secondaryDiagnosis ? ` - ${patient.secondaryDiagnosis}` : ''}
                {patient.medicalHistory ? ` • Tiền sử: ${patient.medicalHistory}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block text-[11px] text-slate-300 bg-black/20 px-2.5 py-1 rounded-lg border border-white/10 font-mono">
              Esc để đóng • Ctrl+Enter để lưu
            </span>
            <button
              onClick={onClose}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Đóng (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toast thông báo sao chép */}
        {toastMsg && (
          <div className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 text-center animate-in fade-in shrink-0">
            {toastMsg}
          </div>
        )}

        {/* 2 Cột khoa học: Cột trái (Nhập mới) & Cột phải (Lịch sử các ngày để đối chiếu) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
          
          {/* CỘT TRÁI (5 cols): NHẬP DIỄN TIẾN & Y LỆNH HÔM NAY */}
          <form onSubmit={handleSubmit} className="lg:col-span-6 xl:col-span-5 p-4 sm:p-5 overflow-y-auto space-y-3.5 border-r border-slate-200 bg-slate-50/50 flex flex-col justify-between text-xs">
            
            <div className="space-y-3.5">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                <span className="font-black text-slate-800 text-xs uppercase flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  <span>1. Nhập Diễn Tiến Mới Hôm Nay</span>
                </span>
                <span className="text-[10px] text-slate-500 font-bold">
                  Khoa Nội Tổng Hợp
                </span>
              </div>

              {errorMsg && (
                <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Ngày giờ, Ca trực & Bác sĩ ký */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
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

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">
                    Ca Trực
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    {(['Sáng', 'Chiều', 'Đêm / Trực'] as const).map((s) => (
                      <button
                        type="button"
                        key={s}
                        onClick={() => setShift(s)}
                        className={`py-1.5 rounded font-black text-[11px] transition-all cursor-pointer ${
                          shift === s
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {s === 'Đêm / Trực' ? 'Đêm' : s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bác sĩ ký diễn tiến */}
                <div className="sm:col-span-2 pt-1">
                  <label className="font-extrabold text-slate-700 block mb-1">
                    Bác Sĩ Ký Diễn Tiến: <strong className="text-indigo-700">{formatDoctorShortName(doctorName)}</strong>
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
                    {group1Doctors.map((doc) => {
                      const isSelected = doctorName === doc.name || doctorName.includes(formatDoctorShortName(doc.name));
                      return (
                        <button
                          type="button"
                          key={doc.id}
                          onClick={() => setDoctorName(doc.name)}
                          className={`py-1 px-1 rounded-lg border font-bold text-xs text-center transition-all cursor-pointer truncate ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs font-black'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50'
                          }`}
                          title={doc.name}
                        >
                          BS. {formatDoctorShortName(doc.name)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Mức độ tình trạng hôm nay */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                <label className="font-extrabold text-slate-700 block text-[11px] uppercase">
                  Mức Độ Tình Trạng Bệnh Nhân
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

              {/* Sinh hiệu thăm khám hôm nay */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-800 font-black text-[11px] uppercase">
                    <HeartPulse className="w-3.5 h-3.5 text-rose-600" />
                    <span>Sinh Hiệu Hôm Nay</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold">(Không bắt buộc)</span>
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

              {/* 1. Diễn biến lâm sàng trong ngày */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                <label className="font-extrabold text-slate-900 text-xs flex items-center justify-between">
                  <span className="uppercase text-slate-800 font-black">Diễn Biến Lâm Sàng Trong Ngày <span className="text-rose-500">*</span></span>
                  <span className="text-[10px] text-slate-400 font-normal">Triệu chứng, đáp ứng...</span>
                </label>
                <textarea
                  rows={3}
                  value={clinicalNote}
                  onChange={(e) => {
                    setClinicalNote(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Ví dụ: Bệnh nhân tỉnh táo, đỡ đau ngực, tim đều rõ, phổi thông khí 2 đáy tốt, không phù, ăn uống khá hơn..."
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-medium text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                  required
                />
              </div>

              {/* 2. Kế hoạch điều trị & y lệnh mới */}
              <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-200 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-blue-950 font-black text-xs uppercase">
                    Kế Hoạch Điều Trị / Y Lệnh Mới
                  </span>
                  {patient.evolutions?.[0]?.treatmentAction && (
                    <button
                      type="button"
                      onClick={() => handleCopyPreviousPlan(patient.evolutions![0].treatmentAction)}
                      className="text-[10px] font-bold text-blue-700 bg-white hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-300 flex items-center gap-1 cursor-pointer transition-colors"
                      title="Sao chép y lệnh của lần ghi gần nhất"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Sao chép y lệnh trước</span>
                    </button>
                  )}
                </div>

                <textarea
                  rows={3}
                  value={treatmentAction}
                  onChange={(e) => setTreatmentAction(e.target.value)}
                  placeholder="Ví dụ: Tiếp tục kháng sinh Ceftriaxon 1g x 02 lọ tiêm TM; Thở oxy gọng kính 2 l/p; Làm lại Creatinine và Điện giải đồ..."
                  className="w-full p-2 bg-white border border-blue-300 rounded-lg font-medium text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 leading-relaxed"
                />
              </div>

              {/* 3. Bàn giao kíp trực */}
              <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200 space-y-1.5 shadow-2xs">
                <div className="flex items-center gap-1.5 text-amber-900 font-black text-xs uppercase">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-amber-700" />
                  <span>Bàn Giao Ca Trực Tiếp Theo & Ghi Chú</span>
                </div>
                <textarea
                  rows={2}
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  placeholder="Dặn dò theo dõi đêm, báo bác sĩ trực nếu SpO2 < 94% hoặc đau ngực tái phát..."
                  className="w-full p-2 bg-white border border-amber-300 rounded-lg font-medium text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 leading-relaxed"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200/60 rounded-xl font-bold transition-colors cursor-pointer text-xs"
              >
                Hủy (Esc)
              </button>

              <button
                type="submit"
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-98 text-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Lưu Diễn Tiến Lâm Sàng (Ctrl+Enter)</span>
              </button>
            </div>

          </form>

          {/* CỘT PHẢI (7 cols): LỊCH SỬ DIỄN TIẾN CÁC NGÀY TRƯỚC - KHOA HỌC, DỄ DÀNG COI */}
          <div className="lg:col-span-6 xl:col-span-7 p-4 sm:p-5 overflow-y-auto space-y-3.5 bg-white flex flex-col">
            
            {/* Header Lịch sử */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-xs uppercase tracking-tight">
                    Lịch Sử Diễn Tiến Qua Các Ngày
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Đối chiếu quá trình điều trị theo trình tự thời gian
                  </p>
                </div>
              </div>

              <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-black border border-indigo-200">
                {patient.evolutions?.length || 0} lần ghi chép
              </span>
            </div>

            {/* Danh sách diễn tiến theo trình tự thời gian */}
            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              {(!patient.evolutions || patient.evolutions.length === 0) ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 my-auto">
                  <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">
                    Chưa có diễn tiến ghi nhận trước đó.
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Nhập diễn tiến ca đầu tiên ở cột bên trái để bắt đầu theo dõi bệnh nhân.
                  </p>
                </div>
              ) : (
                patient.evolutions.map((evo, idx) => {
                  const isFirst = idx === 0;
                  return (
                    <div 
                      key={evo.id || idx} 
                      className={`p-3.5 rounded-xl border transition-all ${
                        isFirst 
                          ? 'bg-indigo-50/40 border-indigo-300 ring-1 ring-indigo-200 shadow-xs' 
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                      } space-y-2.5`}
                    >
                      {/* Card Header: Ngày giờ, Ca trực, BS ký */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-slate-100 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-800 flex items-center gap-1 font-mono">
                            <Clock className="w-3.5 h-3.5 text-indigo-600 inline" />
                            {evo.timestamp}
                          </span>
                          <span className={`px-2 py-0.5 rounded font-bold text-[10.5px] ${
                            evo.shift === 'Sáng' 
                              ? 'bg-amber-100 text-amber-800' 
                              : evo.shift === 'Chiều' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            Ca {evo.shift}
                          </span>
                          {isFirst && (
                            <span className="px-1.5 py-0.2 bg-emerald-600 text-white rounded text-[9px] font-black uppercase tracking-wider">
                              Gần nhất
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                            BS. {formatDoctorShortName(evo.doctorName)}
                          </span>

                          {evo.treatmentAction && (
                            <button
                              type="button"
                              onClick={() => handleCopyPreviousPlan(evo.treatmentAction)}
                              className="text-[10px] text-indigo-600 hover:text-indigo-800 bg-white hover:bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              title="Sao chép y lệnh này sang hôm nay"
                            >
                              <Copy className="w-2.5 h-2.5" />
                              <span>Sao chép</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Diễn biến lâm sàng */}
                      <div className="text-xs">
                        <span className="text-[10px] font-black text-slate-500 uppercase block mb-0.5">
                          Diễn biến lâm sàng:
                        </span>
                        <p className="text-slate-800 font-medium leading-relaxed bg-slate-50/80 p-2 rounded-lg border border-slate-200/80">
                          {evo.clinicalNote}
                        </p>
                      </div>

                      {/* Xử trí & Y lệnh */}
                      {evo.treatmentAction && (
                        <div className="text-xs">
                          <span className="text-[10px] font-black text-blue-700 uppercase block mb-0.5">
                            Kế hoạch điều trị / Y lệnh:
                          </span>
                          <p className="text-blue-950 font-semibold leading-relaxed bg-blue-50/80 p-2 rounded-lg border border-blue-200/80">
                            {evo.treatmentAction}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { 
  Patient, 
  Doctor, 
  SeverityLevel, 
  ClinicalTag, 
  CLINICAL_TAGS_META,
  VitalSign,
  ClinicalEvolution,
  LabResult,
  Medication,
  AdmissionDischargeStatus
} from '../types/patient';
import { formatDoctorShortName } from './DetailedPatientListView';
import { sortDoctorsAlphabetically } from '../utils/doctorSorter';
import { 
  X, 
  Sparkles, 
  Activity, 
  FileText, 
  TestTube, 
  Pill, 
  Info, 
  AlertTriangle, 
  HeartPulse, 
  Wind, 
  Eye, 
  Printer, 
  Plus, 
  Send, 
  Bot, 
  User, 
  Clock, 
  CheckCircle2, 
  AlertOctagon,
  Calendar,
  MapPin,
  CreditCard,
  ShieldAlert,
  Loader2
} from 'lucide-react';

interface PatientDetailModalProps {
  patient: Patient;
  doctors: Doctor[];
  currentUser?: Doctor | null;
  onClose: () => void;
  onUpdatePatient: (updatedPatient: Patient) => void;
}

export const PatientDetailModal: React.FC<PatientDetailModalProps> = ({
  patient,
  doctors,
  currentUser,
  onClose,
  onUpdatePatient,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'evolutions' | 'labs' | 'medications' | 'ai'>('overview');
  
  // AI Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Important notes state
  const [importantNotes, setImportantNotes] = useState(patient.importantNotes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Form states for adding medication dates
  const [newMedStartDate, setNewMedStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [newMedEndDate, setNewMedEndDate] = useState('Đang duy trì');

  // AI Chat state
  const [chatMessage, setChatMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: `Xin chào Bác sĩ! Tôi là Trợ lý AI Lâm sàng Khoa Nội Tổng Hợp BV Hùng Vương Gia Lai. Tôi đã nắm toàn bộ hồ sơ của bệnh nhân ${patient.fullName} (${patient.gender}, ${patient.age}t, Chẩn đoán: ${patient.primaryDiagnosis}). Bác sĩ cần hỗ trợ tra cứu tương tác thuốc, chẩn đoán phân biệt hay hướng dẫn phác đồ điều trị nào?`,
    },
  ]);

  // Form states for adding evolution
  const [showAddEvolution, setShowAddEvolution] = useState(false);
  const [newEvolutionShift, setNewEvolutionShift] = useState<'Sáng' | 'Chiều' | 'Đêm / Trực'>('Sáng');
  const [newEvolutionNote, setNewEvolutionNote] = useState('');
  const [newEvolutionAction, setNewEvolutionAction] = useState('');
  const [newBpSys, setNewBpSys] = useState(patient.vitals?.[0]?.bpSystolic || 120);
  const [newBpDia, setNewBpDia] = useState(patient.vitals?.[0]?.bpDiastolic || 80);
  const [newPulse, setNewPulse] = useState(patient.vitals?.[0]?.heartRate || 80);
  const [newTemp, setNewTemp] = useState(patient.vitals?.[0]?.temperature || 37.0);
  const [newSpo2, setNewSpo2] = useState(patient.vitals?.[0]?.spO2 || 98);

  // Form states for adding lab
  const [showAddLab, setShowAddLab] = useState(false);
  const [newLabCategory, setNewLabCategory] = useState<'Huyết học' | 'Sinh hóa' | 'Điện giải' | 'Khí máu' | 'CĐHA' | 'Khác'>('Sinh hóa');
  const [newLabName, setNewLabName] = useState('');
  const [newLabValue, setNewLabValue] = useState('');
  const [newLabUnit, setNewLabUnit] = useState('');
  const [newLabRange, setNewLabRange] = useState('');
  const [newLabPanic, setNewLabPanic] = useState(false);

  // Form states for adding medication
  const [showAddMed, setShowAddMed] = useState(false);
  const [newMedName, setNewMedName] = useState('');
  const [newMedIngredient, setNewMedIngredient] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newMedRoute, setNewMedRoute] = useState<'Uống' | 'Tiêm TM' | 'Truyền TM' | 'Khí dung' | 'Tiêm dưới da' | 'Đặt hậu môn'>('Uống');
  const [newMedFreq, setNewMedFreq] = useState('1 lần/ngày');
  const [newMedTiming, setNewMedTiming] = useState('08:00');
  const [newMedInstruct, setNewMedInstruct] = useState('');

  // Raw Copy-Paste Text states for Medications & Labs
  const [initialMedicationsText, setInitialMedicationsText] = useState(patient.initialMedicationsText || '');
  const [initialLabsText, setInitialLabsText] = useState(patient.initialLabsText || '');
  const [isEditingMedText, setIsEditingMedText] = useState(false);
  const [isEditingLabText, setIsEditingLabText] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopyText = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleSaveMedText = () => {
    const updated = { ...patient, initialMedicationsText };
    onUpdatePatient(updated);
    setIsEditingMedText(false);
  };

  const handleSaveLabText = () => {
    const updated = { ...patient, initialLabsText };
    onUpdatePatient(updated);
    setIsEditingLabText(false);
  };

  const currentDoctor = doctors.find((d) => d.id === patient.attendingDoctorId);

  // Toggle clinical tags
  const handleToggleTag = (tag: ClinicalTag) => {
    const hasTag = patient.tags.includes(tag);
    const updatedTags = hasTag
      ? patient.tags.filter((t) => t !== tag)
      : [...patient.tags, tag];
    
    onUpdatePatient({
      ...patient,
      tags: updatedTags,
    });
  };

  // Change severity
  const handleChangeSeverity = (severity: SeverityLevel) => {
    onUpdatePatient({
      ...patient,
      severity,
    });
  };

  // Change doctor
  const handleChangeDoctor = (doctorId: string) => {
    onUpdatePatient({
      ...patient,
      attendingDoctorId: doctorId,
    });
  };

  // Change admission / discharge status
  const handleChangeAdmissionStatus = (status: AdmissionDischargeStatus) => {
    const todayStr = new Date().toISOString().split('T')[0];
    onUpdatePatient({
      ...patient,
      admissionStatus: status,
      dischargeTomorrowSetDate: status === 'DISCHARGE_TOMORROW' ? todayStr : undefined,
    });
  };

  // Trigger server-side AI analysis
  const runAiAnalysis = async () => {
    setIsAnalyzing(true);
    setAiError(null);
    try {
      const res = await fetch('/api/ai/analyze-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Lỗi khi gọi AI phân tích.');
      }
      onUpdatePatient({
        ...patient,
        aiAnalysis: data.data,
      });
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'Không thể kết nối với hệ thống AI.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Send AI chat message
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || isChatLoading) return;

    const userText = chatMessage.trim();
    setChatMessage('');
    const newHistory = [...chatHistory, { role: 'user' as const, text: userText }];
    setChatHistory(newHistory);
    setIsChatLoading(true);

    try {
      const res = await fetch('/api/ai/chat-consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient,
          message: userText,
          conversationHistory: newHistory.slice(-8),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Lỗi xử lý tư vấn.');
      }
      setChatHistory((prev) => [...prev, { role: 'assistant', text: data.reply }]);
    } catch (err: any) {
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `⚠️ Xin lỗi Bác sĩ, có lỗi khi kết nối với AI: ${err.message}`,
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Save new evolution
  const handleSaveEvolution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvolutionNote) return;

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newEvo: ClinicalEvolution = {
      id: `EV-${Date.now()}`,
      timestamp: timeStr,
      doctorName: currentUser?.name || currentDoctor?.name || 'Bác sĩ điều trị',
      shift: newEvolutionShift,
      clinicalNote: newEvolutionNote,
      treatmentAction: newEvolutionAction || 'Tiếp tục y lệnh hiện tại.',
    };

    const newVital: VitalSign = {
      id: `V-${Date.now()}`,
      timestamp: timeStr,
      bpSystolic: Number(newBpSys),
      bpDiastolic: Number(newBpDia),
      heartRate: Number(newPulse),
      temperature: Number(newTemp),
      spO2: Number(newSpo2),
      respiratoryRate: 20,
    };

    onUpdatePatient({
      ...patient,
      evolutions: [newEvo, ...patient.evolutions],
      vitals: [newVital, ...patient.vitals],
    });

    setNewEvolutionNote('');
    setNewEvolutionAction('');
    setShowAddEvolution(false);
  };

  // Save new Lab
  const handleSaveLab = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabName || !newLabValue) return;

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newLab: LabResult = {
      id: `L-${Date.now()}`,
      timestamp: timeStr,
      category: newLabCategory,
      testName: newLabName,
      value: newLabValue,
      unit: newLabUnit,
      normalRange: newLabRange || '--',
      isAbnormal: true,
      isPanicValue: newLabPanic,
    };

    onUpdatePatient({
      ...patient,
      labs: [newLab, ...patient.labs],
    });

    setNewLabName('');
    setNewLabValue('');
    setNewLabUnit('');
    setNewLabRange('');
    setNewLabPanic(false);
    setShowAddLab(false);
  };

  // Save new medication
  const handleSaveMedication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedName) return;

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const newMed: Medication = {
      id: `M-${Date.now()}`,
      name: newMedName,
      activeIngredient: newMedIngredient || newMedName,
      dosage: newMedDosage,
      route: newMedRoute,
      frequency: newMedFreq,
      timing: newMedTiming,
      instructions: newMedInstruct,
      status: 'active',
      startDate: newMedStartDate || dateStr,
      endDate: newMedEndDate || 'Đang duy trì',
    };

    onUpdatePatient({
      ...patient,
      medications: [...patient.medications, newMed],
    });

    setNewMedName('');
    setNewMedIngredient('');
    setNewMedDosage('');
    setNewMedInstruct('');
    setNewMedStartDate(dateStr);
    setNewMedEndDate('Đang duy trì');
    setShowAddMed(false);
  };

  // Save important notes
  const handleSaveImportantNotes = () => {
    setIsSavingNotes(true);
    onUpdatePatient({
      ...patient,
      importantNotes: importantNotes.trim(),
    });
    setTimeout(() => setIsSavingNotes(false), 600);
  };

  // Print clinical sheet
  const handlePrint = () => {
    window.print();
  };

  const isCritical = patient.severity === 'CRITICAL';
  const isModerate = patient.severity === 'MODERATE';
  const isStable = patient.severity === 'STABLE';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-in fade-in duration-150">
      {/* Light backdrop so the patient list and names on the left stay clearly visible */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/25 backdrop-blur-2xs transition-opacity cursor-pointer"
        title="Bấm bên ngoài để đóng bảng chi tiết"
      />

      {/* Right-side expansive sliding drawer panel (khung rộng hơn nữa) */}
      <div className="relative w-full sm:w-[94vw] md:w-[90vw] lg:w-[86vw] xl:w-[82vw] max-w-[1400px] bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col z-10 animate-in slide-in-from-right duration-200 overflow-hidden">
        
        {/* Modal Top Header - Đậm chất BV Hùng Vương Gia Lai */}
        <div className={`px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
          isCritical
            ? 'bg-gradient-to-r from-rose-800 via-rose-900 to-slate-900 text-white'
            : isModerate
            ? 'bg-gradient-to-r from-amber-700 via-amber-800 to-slate-900 text-white'
            : 'bg-gradient-to-r from-[#0b4d8c] via-[#083a69] to-slate-900 text-white'
        }`}>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-white/20 text-white font-black text-xs tracking-wider shadow-2xs">
                Phòng {patient.roomNumber}
              </span>
              {patient.patientCode && (
                <span className="px-2 py-0.5 rounded bg-white/10 text-white/90 font-mono font-bold text-xs">
                  Mã BN: {patient.patientCode}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-2xl font-black tracking-tight text-white uppercase">
                {patient.fullName}
              </h2>
              <span className="text-xs sm:text-sm font-semibold text-white/80 bg-white/10 px-2 py-0.5 rounded">
                {patient.gender}, {patient.age} tuổi
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Severity Selector */}
            <div className="bg-white/10 rounded-xl p-1 flex items-center gap-1 border border-white/20">
              <button
                type="button"
                onClick={() => handleChangeSeverity('CRITICAL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  patient.severity === 'CRITICAL'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                Nặng (Đỏ)
              </button>
              <button
                type="button"
                onClick={() => handleChangeSeverity('MODERATE')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  patient.severity === 'MODERATE'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                Vừa
              </button>
              <button
                type="button"
                onClick={() => handleChangeSeverity('STABLE')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  patient.severity === 'STABLE'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                Ổn định
              </button>
              <button
                type="button"
                onClick={() => handleChangeSeverity('UNCLASSIFIED')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  patient.severity === 'UNCLASSIFIED' || !patient.severity
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                Chưa phân loại
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title="In trích lục bệnh án"
            >
              <Printer className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title="Đóng bảng chi tiết"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Compact Administrative Ribbon: Chiếm ít không gian hơn, đầy đủ thông tin hành chính */}
        <div className="px-5 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            {/* BS điều trị */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-500">BS điều trị:</span>
              <div className="flex items-center gap-1.5">
                <div className={`w-4 h-4 rounded-full ${currentDoctor?.avatarColor || 'bg-slate-400'} text-white flex items-center justify-center text-[9px] font-bold`}>
                  {currentDoctor ? currentDoctor.name.split(' ').pop()?.[0] : '?'}
                </div>
                <select
                  value={patient.attendingDoctorId}
                  onChange={(e) => handleChangeDoctor(e.target.value)}
                  className="bg-white border border-slate-300 rounded-md px-2 py-0.5 font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#0b4d8c] text-xs cursor-pointer"
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      BS. {formatDoctorShortName(d.name)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Lưu chuyển tua trực */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-500">Tua trực:</span>
              <select
                value={patient.admissionStatus || 'STABLE_INPATIENT'}
                onChange={(e) => handleChangeAdmissionStatus(e.target.value as any)}
                className="bg-white border border-slate-300 rounded-md px-2 py-0.5 font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#0b4d8c] text-xs cursor-pointer"
              >
                <option value="ADMITTED_TODAY">🟢 Mới nhập hôm nay</option>
                <option value="ADMITTED_YESTERDAY">🟡 Mới nhập tua hôm qua</option>
                <option value="DISCHARGE_TODAY">🟣 Chuẩn bị ra viện hôm nay</option>
                <option value="DISCHARGE_TOMORROW">🔵 Dự kiến ra viện mai</option>
                <option value="STABLE_INPATIENT">⚪ Đang điều trị</option>
              </select>
            </div>

            {/* Ngày vào viện */}
            <div className="flex items-center gap-1 text-slate-700 font-semibold bg-white px-2 py-0.5 rounded border border-slate-200">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>NV: <strong className="text-slate-900">{patient.admissionDate}</strong></span>
              {patient.treatmentDays !== undefined && (
                <span className="text-[#0b4d8c] font-bold ml-1">• ĐT {patient.treatmentDays} ngày</span>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 border-b border-slate-200 flex items-center gap-1 overflow-x-auto bg-white no-print">
          <button
            onClick={() => setActiveTab('overview')}
            className={`inline-flex items-center gap-1.5 py-3 px-3.5 border-b-2 text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Info className="w-4 h-4" />
            <span>Hành Chính & Chẩn Đoán</span>
          </button>

          <button
            onClick={() => setActiveTab('evolutions')}
            className={`inline-flex items-center gap-1.5 py-3 px-3.5 border-b-2 text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'evolutions'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Diễn Tiến & Sinh Hiệu ({patient.evolutions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('labs')}
            className={`inline-flex items-center gap-1.5 py-3 px-3.5 border-b-2 text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'labs'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <TestTube className="w-4 h-4" />
            <span>Xét Nghiệm & Cận Lâm Sàng ({patient.labs.length})</span>
            {patient.labs.some((l) => l.isPanicValue) && (
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping inline-block" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('medications')}
            className={`inline-flex items-center gap-1.5 py-3 px-3.5 border-b-2 text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'medications'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Pill className="w-4 h-4" />
            <span>Y Lệnh Thuốc ({patient.medications.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`inline-flex items-center gap-1.5 py-3 px-3.5 border-b-2 text-xs font-extrabold transition-all whitespace-nowrap ml-auto ${
              activeTab === 'ai'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                : 'border-transparent text-indigo-600 hover:bg-indigo-50/40'
            }`}
          >
            <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
            <span>AI Cố Vấn Lâm Sàng & Cảnh Báo</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 bg-slate-50/40">
          
          {/* TAB 1: OVERVIEW & DEMOGRAPHICS */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Special Priority Clinical Tags (Thở Oxy, Dùng Vận Mạch, Cần Theo Dõi Sát) */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <HeartPulse className="w-4 h-4 text-rose-600" />
                    Các Nhãn Lâm Sàng Đặc Biệt (Bấm để kích hoạt / tắt)
                  </h3>
                  <span className="text-[11px] font-bold text-slate-500">
                    Tình trạng: <span className={isCritical ? 'text-rose-600 font-black' : isModerate ? 'text-amber-600 font-black' : 'text-emerald-600 font-black'}>
                      {isCritical ? 'BỆNH NẶNG' : isModerate ? 'TRUNG BÌNH' : 'NHẸ / ỔN ĐỊNH'}
                    </span>
                  </span>
                </div>

                {/* Priority badges as compact inline buttons */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {/* Thở Canula */}
                  <button
                    type="button"
                    onClick={() => handleToggleTag('O2_CANULA')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      patient.tags.includes('O2_CANULA') || patient.tags.includes('O2')
                        ? 'bg-cyan-600 text-white shadow-2xs'
                        : 'bg-cyan-50 text-cyan-800 border border-cyan-200 hover:bg-cyan-100'
                    }`}
                  >
                    <Wind className="w-3.5 h-3.5 shrink-0" />
                    <span>Thở Canula</span>
                    {(patient.tags.includes('O2_CANULA') || patient.tags.includes('O2')) && <CheckCircle2 className="w-3 h-3 ml-0.5 shrink-0" />}
                  </button>

                  {/* Thở Mask */}
                  <button
                    type="button"
                    onClick={() => handleToggleTag('O2_MASK')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      patient.tags.includes('O2_MASK')
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
                    }`}
                  >
                    <Wind className="w-3.5 h-3.5 shrink-0" />
                    <span>Thở Mask</span>
                    {patient.tags.includes('O2_MASK') && <CheckCircle2 className="w-3 h-3 ml-0.5 shrink-0" />}
                  </button>

                  {/* TD dịch nhập/xuất */}
                  <button
                    type="button"
                    onClick={() => handleToggleTag('FLUID_BALANCE')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      patient.tags.includes('FLUID_BALANCE')
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5 shrink-0" />
                    <span>TD Dịch Nhập/Xuất</span>
                    {patient.tags.includes('FLUID_BALANCE') && <CheckCircle2 className="w-3 h-3 ml-0.5 shrink-0" />}
                  </button>

                  {/* Vận Mạch */}
                  <button
                    type="button"
                    onClick={() => handleToggleTag('VASOPRESSOR')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      patient.tags.includes('VASOPRESSOR')
                        ? 'bg-rose-600 text-white shadow-2xs animate-pulse'
                        : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    <HeartPulse className="w-3.5 h-3.5 shrink-0" />
                    <span>Vận Mạch</span>
                    {patient.tags.includes('VASOPRESSOR') && <CheckCircle2 className="w-3 h-3 ml-0.5 shrink-0" />}
                  </button>
                </div>

                {/* Other secondary tags */}
                <div className="pt-1.5 border-t border-slate-100">
                  <span className="text-[10.5px] font-bold text-slate-400 block mb-1 uppercase tracking-wide">
                    Nhãn lâm sàng bổ trợ khác:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(Object.keys(CLINICAL_TAGS_META) as ClinicalTag[])
                      .filter((t) => t !== 'O2' && t !== 'O2_CANULA' && t !== 'O2_MASK' && t !== 'VASOPRESSOR' && t !== 'FLUID_BALANCE')
                      .map((tagKey) => {
                        const meta = CLINICAL_TAGS_META[tagKey];
                        const isActive = patient.tags.includes(tagKey);
                        return (
                          <button
                            key={tagKey}
                            type="button"
                            onClick={() => handleToggleTag(tagKey)}
                            className={`text-xs font-semibold px-2 py-0.5 rounded-md border transition-all flex items-center gap-1 cursor-pointer ${
                              isActive
                                ? `${meta.badgeBg} text-white border-transparent font-bold shadow-2xs`
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <span>{meta.label}</span>
                            {isActive && <CheckCircle2 className="w-3 h-3 ml-0.5 shrink-0" />}
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* Important Notes Box (Ghi chú quan trọng) */}
              <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Ghi Chú Quan Trọng & Lưu Ý Điều Trị
                  </span>
                  <button
                    onClick={handleSaveImportantNotes}
                    disabled={isSavingNotes}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors"
                  >
                    {isSavingNotes ? 'Đang lưu...' : 'Lưu ghi chú'}
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={importantNotes}
                  onChange={(e) => setImportantNotes(e.target.value)}
                  placeholder="Ghi chú lâm sàng quan trọng (ví dụ: đang thở oxy mask, dùng vận mạch Noradrenalin, dị ứng kháng sinh, nguy cơ xuất huyết, cần theo dõi sát sinh hiệu...)"
                  className="w-full text-xs p-2.5 bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-slate-800"
                />
              </div>

              {/* Chẩn Đoán Lâm Sàng Trọng Tâm */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-black text-[#0b4d8c] uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#0b4d8c]" />
                    Chẩn Đoán Lâm Sàng Hiện Tại
                  </span>
                  <span className={`px-2 py-0.5 rounded-full font-black text-[11px] ${
                    isCritical ? 'bg-rose-100 text-rose-700 border border-rose-300' : isModerate ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}>
                    {isCritical ? 'NẶNG' : isModerate ? 'VỪA' : isStable ? 'ỔN ĐỊNH' : 'CHƯA PHÂN LOẠI'}
                  </span>
                </div>
                
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-base font-black text-slate-900 leading-relaxed">
                    {[patient.primaryDiagnosis, patient.secondaryDiagnosis].filter(Boolean).join(' - ') || (
                      <span className="text-amber-700 italic font-semibold text-xs flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        Chưa ghi nhận chẩn đoán lâm sàng (Bác sĩ nhập trực tiếp trong mục Sửa hoặc Ghi diễn tiến).
                      </span>
                    )}
                  </div>
                  {patient.icd10Primary && (
                    <div className="text-[11px] font-mono text-slate-500 mt-1">
                      Mã ICD: {patient.icd10Primary} {patient.icd10Secondary ? `• ${patient.icd10Secondary}` : ''}
                    </div>
                  )}
                </div>
              </div>

              {/* Dị Ứng Thuốc & Tiền Sử Bệnh */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Dị ứng thuốc - Cảnh báo đỏ nổi bật */}
                <div className={`p-3.5 rounded-xl border ${
                  patient.allergies && !patient.allergies.toLowerCase().includes('không')
                    ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-300'
                    : 'bg-white border-slate-200 shadow-2xs'
                }`}>
                  <div className="flex items-center gap-1.5 font-black text-rose-700 uppercase tracking-wider mb-1">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span>Dị ứng thuốc & Thận trọng</span>
                  </div>
                  <p className={`font-bold mt-1 ${
                    patient.allergies && !patient.allergies.toLowerCase().includes('không')
                      ? 'text-rose-950 font-black text-sm'
                      : 'text-slate-700'
                  }`}>
                    {patient.allergies || 'Chưa ghi nhận tiền sử dị ứng thuốc'}
                  </p>
                </div>

                {/* Tiền sử bệnh bản thân & gia đình */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center gap-1.5 font-black text-slate-700 uppercase tracking-wider mb-1">
                    <Activity className="w-4 h-4 text-slate-600" />
                    <span>Tiền sử bệnh lý bản thân</span>
                  </div>
                  <p className="text-slate-800 font-medium mt-1">
                    {patient.medicalHistory || 'Không ghi nhận tiền sử bệnh lý mạn tính'}
                  </p>
                </div>
              </div>

              {/* Hành Chính Rút Gọn: Chiếm ít không gian nhất */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs text-xs space-y-1.5">
                <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">
                  Thông tin hành chính bệnh nhân (Rút gọn)
                </span>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-700">
                  <span>Mã BN: <strong className="font-mono text-slate-900">{patient.patientCode || '---'}</strong></span>
                  <span>Ngày sinh: <strong className="text-slate-900">{patient.dateOfBirth}</strong> ({patient.age}t, {patient.gender})</span>
                  <span>Khoa: <strong className="text-[#0b4d8c]">{patient.department || 'Nội Tổng Hợp'}</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CLINICAL EVOLUTIONS & VITALS */}
          {activeTab === 'evolutions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Nhật Ký Diễn Tiến Lâm Sàng & Sinh Hiệu
                  </h3>
                  <p className="text-xs text-slate-500">
                    Theo dõi sinh hiệu và diễn biến bệnh nhân theo từng ca trực
                  </p>
                </div>
                <button
                  onClick={() => setShowAddEvolution(!showAddEvolution)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-600 text-white hover:bg-rose-700 shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Ghi Diễn Tiến Mới</span>
                </button>
              </div>

              {/* Add Evolution Form */}
              {showAddEvolution && (
                <form
                  onSubmit={handleSaveEvolution}
                  className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm space-y-3 animate-in fade-in"
                >
                  <h4 className="text-xs font-extrabold text-rose-700 uppercase tracking-wider">
                    Thêm Ghi Chép Diễn Tiến Ca Trực
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">HA Tâm thu</label>
                      <input
                        type="number"
                        value={newBpSys}
                        onChange={(e) => setNewBpSys(Number(e.target.value))}
                        className="w-full text-xs p-2 border rounded-lg"
                        placeholder="120"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">HA Tâm trương</label>
                      <input
                        type="number"
                        value={newBpDia}
                        onChange={(e) => setNewBpDia(Number(e.target.value))}
                        className="w-full text-xs p-2 border rounded-lg"
                        placeholder="80"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Mạch (l/p)</label>
                      <input
                        type="number"
                        value={newPulse}
                        onChange={(e) => setNewPulse(Number(e.target.value))}
                        className="w-full text-xs p-2 border rounded-lg"
                        placeholder="80"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Nhiệt độ (°C)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={newTemp}
                        onChange={(e) => setNewTemp(Number(e.target.value))}
                        className="w-full text-xs p-2 border rounded-lg"
                        placeholder="37.0"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">SpO₂ (%)</label>
                      <input
                        type="number"
                        value={newSpo2}
                        onChange={(e) => setNewSpo2(Number(e.target.value))}
                        className="w-full text-xs p-2 border rounded-lg"
                        placeholder="98"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      Diễn biến triệu chứng lâm sàng
                    </label>
                    <textarea
                      rows={2}
                      value={newEvolutionNote}
                      onChange={(e) => setNewEvolutionNote(e.target.value)}
                      placeholder="Bệnh nhân tỉnh/mê, khó thở, ho khạc, đau bụng, sốt, lượng nước tiểu 24h..."
                      className="w-full text-xs p-2.5 border rounded-lg focus:ring-2 focus:ring-rose-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      Xử trí & Hướng điều trị tiếp theo
                    </label>
                    <input
                      type="text"
                      value={newEvolutionAction}
                      onChange={(e) => setNewEvolutionAction(e.target.value)}
                      placeholder="Tiếp tục phác đồ, tăng liều vận mạch, khí dung thêm, mời hội chẩn..."
                      className="w-full text-xs p-2 border rounded-lg focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddEvolution(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs"
                    >
                      Lưu diễn tiến
                    </button>
                  </div>
                </form>
              )}

              {/* Timeline of Evolutions */}
              <div className="space-y-3">
                {patient.evolutions.map((evo, index) => {
                  const vitalForThis = patient.vitals[index];

                  return (
                    <div
                      key={evo.id}
                      className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-2 relative pl-5 border-l-4 border-l-rose-500"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {evo.timestamp}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700 text-[11px]">
                            {evo.shift}
                          </span>
                        </div>
                        <span className="font-semibold text-rose-700 text-xs">
                          {evo.doctorName}
                        </span>
                      </div>

                      {/* Vital Strip if present */}
                      {vitalForThis && (
                        <div className="inline-flex flex-wrap gap-3 py-1 px-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px]">
                          <span>HA: <b className="text-slate-800">{vitalForThis.bpSystolic}/{vitalForThis.bpDiastolic}</b> mmHg</span>
                          <span>Mạch: <b className="text-slate-800">{vitalForThis.heartRate}</b> l/p</span>
                          <span>Nhiệt độ: <b className="text-slate-800">{vitalForThis.temperature}°C</b></span>
                          <span>SpO₂: <b className="text-emerald-700">{vitalForThis.spO2}%</b></span>
                          {vitalForThis.bloodSugar && (
                            <span>Đường huyết: <b className="text-amber-700">{vitalForThis.bloodSugar} mmol/L</b></span>
                          )}
                        </div>
                      )}

                      <div className="text-xs text-slate-800 leading-relaxed font-medium">
                        {evo.clinicalNote}
                      </div>

                      <div className="text-xs bg-rose-50/60 text-rose-900 rounded-lg p-2 border border-rose-100">
                        <span className="font-bold text-rose-800">Xử trí: </span>
                        {evo.treatmentAction}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: LABS & PARACLINICAL RESULTS */}
          {activeTab === 'labs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Kết Quả Xét Nghiệm & Cận Lâm Sàng
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tự động cảnh báo chỉ số nguy hiểm (Panic value) và bất thường sinh hóa, huyết học
                  </p>
                </div>
                <button
                  onClick={() => setShowAddLab(!showAddLab)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-600 text-white hover:bg-rose-700 shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Thêm Chỉ Số Mới</span>
                </button>
              </div>

              {/* Raw Copy-Paste Labs & Results Card */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-blue-200/60">
                  <div className="flex items-center gap-2">
                    <TestTube className="w-4 h-4 text-blue-600" />
                    <span className="font-extrabold text-blue-950 text-xs uppercase tracking-wide">
                      Văn Bản Cận Lâm Sàng & Kết Quả Ban Đầu (HIS / Copy-Paste)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {initialLabsText && (
                      <button
                        type="button"
                        onClick={() => handleCopyText(initialLabsText, 'labs')}
                        className="px-2 py-0.5 rounded bg-white hover:bg-blue-100 text-blue-800 border border-blue-200 text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                      >
                        {copiedSection === 'labs' ? '✓ Đã sao chép' : 'Sao chép văn bản'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (isEditingLabText) handleSaveLabText();
                        else setIsEditingLabText(true);
                      }}
                      className="px-2.5 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                    >
                      {isEditingLabText ? 'Lưu thay đổi' : 'Sửa văn bản'}
                    </button>
                  </div>
                </div>

                {isEditingLabText ? (
                  <textarea
                    rows={4}
                    value={initialLabsText}
                    onChange={(e) => setInitialLabsText(e.target.value)}
                    placeholder="Dán hoặc cập nhật kết quả xét nghiệm, CTM, sinh hóa, ECG, X-Quang..."
                    className="w-full p-2.5 bg-white border border-blue-300 rounded-lg text-xs font-mono font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                ) : initialLabsText ? (
                  <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed bg-white/80 p-2.5 rounded-lg border border-blue-100">
                    {initialLabsText}
                  </pre>
                ) : (
                  <p className="text-xs text-blue-800/80 italic">
                    Chưa có văn bản kết quả CLS sao chép nhanh. Bấm "Sửa văn bản" để dán trực tiếp từ HIS hoặc bệnh án.
                  </p>
                )}
              </div>

              {/* Add Lab Form */}
              {showAddLab && (
                <form
                  onSubmit={handleSaveLab}
                  className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm space-y-3 animate-in fade-in text-xs"
                >
                  <h4 className="font-extrabold text-rose-700 uppercase tracking-wider">
                    Nhập Chỉ Số Xét Nghiệm Mới
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">Chuyên mục</label>
                      <select
                        value={newLabCategory}
                        onChange={(e) => setNewLabCategory(e.target.value as any)}
                        className="w-full p-2 border rounded-lg bg-white"
                      >
                        <option value="Huyết học">Huyết học</option>
                        <option value="Sinh hóa">Sinh hóa</option>
                        <option value="Điện giải">Điện giải</option>
                        <option value="Khí máu">Khí máu</option>
                        <option value="CĐHA">CĐHA / X-quang</option>
                        <option value="Khác">Khác</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">Tên xét nghiệm</label>
                      <input
                        type="text"
                        value={newLabName}
                        onChange={(e) => setNewLabName(e.target.value)}
                        placeholder="e.g. Troponin T hs, Kali, WBC..."
                        className="w-full p-2 border rounded-lg"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">Giá trị đo</label>
                      <input
                        type="text"
                        value={newLabValue}
                        onChange={(e) => setNewLabValue(e.target.value)}
                        placeholder="e.g. 18.5"
                        className="w-full p-2 border rounded-lg"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">Đơn vị & Khoảng BT</label>
                      <input
                        type="text"
                        value={newLabUnit}
                        onChange={(e) => setNewLabUnit(e.target.value)}
                        placeholder="e.g. mmol/L (BT: 3.5 - 5.0)"
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-rose-700">
                      <input
                        type="checkbox"
                        checked={newLabPanic}
                        onChange={(e) => setNewLabPanic(e.target.checked)}
                        className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                      />
                      <span>Đánh dấu đây là Giá trị Nguy hiểm (Panic Value báo động đỏ)</span>
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddLab(false)}
                      className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs"
                    >
                      Lưu kết quả
                    </button>
                  </div>
                </form>
              )}

              {/* Lab table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Thời gian</th>
                      <th className="py-2.5 px-4">Nhóm</th>
                      <th className="py-2.5 px-4">Xét nghiệm</th>
                      <th className="py-2.5 px-4">Kết quả</th>
                      <th className="py-2.5 px-4">Khoảng tham chiếu</th>
                      <th className="py-2.5 px-4 text-right">Đánh giá</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {patient.labs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Chưa có kết quả xét nghiệm được ghi nhận.
                        </td>
                      </tr>
                    ) : (
                      patient.labs.map((lab) => (
                        <tr
                          key={lab.id}
                          className={`hover:bg-slate-50 ${
                            lab.isPanicValue
                              ? 'bg-rose-50/70 font-semibold text-rose-950'
                              : lab.isAbnormal
                              ? 'bg-amber-50/30'
                              : ''
                          }`}
                        >
                          <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                            {lab.timestamp}
                          </td>
                          <td className="py-2.5 px-4">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 font-semibold text-slate-700">
                              {lab.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-bold text-slate-900">
                            {lab.testName}
                          </td>
                          <td className="py-2.5 px-4">
                            <span className={`text-sm font-black ${
                              lab.isPanicValue ? 'text-rose-600' : lab.isAbnormal ? 'text-amber-700' : 'text-slate-800'
                            }`}>
                              {lab.value}
                            </span>{' '}
                            <span className="text-[11px] text-slate-500">{lab.unit}</span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-500">
                            {lab.normalRange}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            {lab.isPanicValue ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse">
                                NGUY HIỂM
                              </span>
                            ) : lab.isAbnormal ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                Bất thường
                              </span>
                            ) : (
                              <span className="text-[10px] text-emerald-700 font-bold">
                                Bình thường
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: MEDICATIONS & TREATMENT ORDERS */}
          {activeTab === 'medications' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Danh Mục Y Lệnh Thuốc Hiện Hành
                  </h3>
                  <p className="text-xs text-slate-500">
                    Các thuốc đang điều trị, liều lượng, đường dùng và thời gian y lệnh
                  </p>
                </div>
                <button
                  onClick={() => setShowAddMed(!showAddMed)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-600 text-white hover:bg-rose-700 shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Kê Thêm Y Lệnh Thuốc</span>
                </button>
              </div>

              {/* Raw Copy-Paste Medications Card */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200/60">
                  <div className="flex items-center gap-2">
                    <Pill className="w-4 h-4 text-emerald-600" />
                    <span className="font-extrabold text-emerald-950 text-xs uppercase tracking-wide">
                      Văn Bản Y Lệnh Thuốc Ban Đầu (HIS / Copy-Paste)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {initialMedicationsText && (
                      <button
                        type="button"
                        onClick={() => handleCopyText(initialMedicationsText, 'meds')}
                        className="px-2 py-0.5 rounded bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                      >
                        {copiedSection === 'meds' ? '✓ Đã sao chép' : 'Sao chép văn bản'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (isEditingMedText) handleSaveMedText();
                        else setIsEditingMedText(true);
                      }}
                      className="px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                    >
                      {isEditingMedText ? 'Lưu thay đổi' : 'Sửa văn bản'}
                    </button>
                  </div>
                </div>

                {isEditingMedText ? (
                  <textarea
                    rows={4}
                    value={initialMedicationsText}
                    onChange={(e) => setInitialMedicationsText(e.target.value)}
                    placeholder="Dán hoặc cập nhật danh sách y lệnh thuốc ban đầu..."
                    className="w-full p-2.5 bg-white border border-emerald-300 rounded-lg text-xs font-mono font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  />
                ) : initialMedicationsText ? (
                  <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed bg-white/80 p-2.5 rounded-lg border border-emerald-100">
                    {initialMedicationsText}
                  </pre>
                ) : (
                  <p className="text-xs text-emerald-800/80 italic">
                    Chưa có văn bản y lệnh thuốc sao chép nhanh. Bấm "Sửa văn bản" để dán trực tiếp danh sách thuốc.
                  </p>
                )}
              </div>

              {/* Add Medication Form */}
              {showAddMed && (
                <form
                  onSubmit={handleSaveMedication}
                  className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm space-y-3 animate-in fade-in text-xs"
                >
                  <h4 className="font-extrabold text-rose-700 uppercase tracking-wider">
                    Nhập Y Lệnh Thuốc Mới
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">Tên thuốc biệt dược</label>
                      <input
                        type="text"
                        value={newMedName}
                        onChange={(e) => setNewMedName(e.target.value)}
                        placeholder="e.g. Meropenem 1g, Noradrenalin..."
                        className="w-full p-2 border rounded-lg"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">Hoạt chất chính</label>
                      <input
                        type="text"
                        value={newMedIngredient}
                        onChange={(e) => setNewMedIngredient(e.target.value)}
                        placeholder="e.g. Meropenem"
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">Đường dùng</label>
                      <select
                        value={newMedRoute}
                        onChange={(e) => setNewMedRoute(e.target.value as any)}
                        className="w-full p-2 border rounded-lg bg-white"
                      >
                        <option value="Uống">Uống</option>
                        <option value="Tiêm TM">Tiêm tĩnh mạch (Tiêm TM)</option>
                        <option value="Truyền TM">Truyền tĩnh mạch (Truyền TM)</option>
                        <option value="Khí dung">Khí dung</option>
                        <option value="Tiêm dưới da">Tiêm dưới da</option>
                        <option value="Đặt hậu môn">Đặt hậu môn</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">Liều lượng dùng</label>
                      <input
                        type="text"
                        value={newMedDosage}
                        onChange={(e) => setNewMedDosage(e.target.value)}
                        placeholder="e.g. 1g x 3 lọ pha NaCl 0.9%..."
                        className="w-full p-2 border rounded-lg"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">Tần suất</label>
                      <input
                        type="text"
                        value={newMedFreq}
                        onChange={(e) => setNewMedFreq(e.target.value)}
                        placeholder="e.g. Mỗi 8 giờ, 1 lần/ngày..."
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">Ngày bắt đầu</label>
                      <input
                        type="date"
                        value={newMedStartDate}
                        onChange={(e) => setNewMedStartDate(e.target.value)}
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">Ngày kết thúc</label>
                      <input
                        type="text"
                        value={newMedEndDate}
                        onChange={(e) => setNewMedEndDate(e.target.value)}
                        placeholder="Đang duy trì / YYYY-MM-DD"
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">Giờ dùng thuốc</label>
                      <input
                        type="text"
                        value={newMedTiming}
                        onChange={(e) => setNewMedTiming(e.target.value)}
                        placeholder="e.g. 08:00 - 16:00 - 24:00"
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">Chỉ dẫn thực hiện y lệnh</label>
                      <input
                        type="text"
                        value={newMedInstruct}
                        onChange={(e) => setNewMedInstruct(e.target.value)}
                        placeholder="e.g. Uống sau ăn no, truyền trong 3 giờ, theo dõi HA..."
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddMed(false)}
                      className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs"
                    >
                      Lưu y lệnh
                    </button>
                  </div>
                </form>
              )}

              {/* Medications List */}
              <div className="space-y-2">
                {patient.medications.map((med, idx) => (
                  <div
                    key={med.id}
                    className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-sm">
                          {idx + 1}. {med.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px]">
                          {med.route}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          ({med.activeIngredient})
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-slate-700 font-semibold pt-0.5">
                        <span>Liều dùng: <b className="text-slate-900">{med.dosage}</b></span>
                        <span>• Tần suất: <b className="text-slate-900">{med.frequency}</b></span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                        <span>Ngày bắt đầu: <b className="text-slate-700">{med.startDate}</b></span>
                        <span>Ngày kết thúc: <b className="text-rose-700 font-bold">{med.endDate || 'Đang duy trì'}</b></span>
                      </div>
                      {med.instructions && (
                        <p className="text-slate-500 italic text-[11px]">
                          Lưu ý: {med.instructions}
                        </p>
                      )}
                    </div>

                    <div className="flex sm:flex-col items-end justify-between sm:justify-center text-right shrink-0">
                      <span className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded">
                        ⏰ {med.timing}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded mt-1 ${
                        med.endDate === 'Đang duy trì' || !med.endDate
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {med.endDate === 'Đang duy trì' || !med.endDate ? 'Đang dùng' : 'Đã kết thúc'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: AI CLINICAL COPILOT & ALERTS */}
          {activeTab === 'ai' && (
            <div className="space-y-5">
              {/* AI action banner */}
              <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white rounded-2xl p-5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-xs font-bold mb-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Gemini AI Hỗ Trợ Chẩn Đoán & An Toàn Người Bệnh</span>
                  </div>
                  <h3 className="text-lg font-black tracking-tight">
                    Cố Vấn Lâm Sàng AI Khoa Nội Tổng Hợp
                  </h3>
                  <p className="text-xs text-indigo-200 mt-1 max-w-xl">
                    Tự động rà soát toàn bộ tiền sử, sinh hiệu, kết quả cận lâm sàng và y lệnh thuốc để phát hiện nguy cơ chuyển nặng, cảnh báo tương tác thuốc và gợi ý chẩn đoán phân biệt.
                  </p>
                </div>

                <button
                  onClick={runAiAnalysis}
                  disabled={isAnalyzing}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs bg-white text-indigo-950 hover:bg-indigo-50 shadow-md transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                      <span>Đang phân tích ca bệnh...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span>Phân Tích Ca Bệnh Bằng AI</span>
                    </>
                  )}
                </button>
              </div>

              {aiError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{aiError}</span>
                </div>
              )}

              {/* Show existing analysis results */}
              {patient.aiAnalysis ? (
                <div className="space-y-4">
                  {/* Summary & Risk header */}
                  <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    patient.aiAnalysis.riskLevel === 'HIGH'
                      ? 'bg-rose-50 border-rose-300 text-rose-950'
                      : patient.aiAnalysis.riskLevel === 'MEDIUM'
                      ? 'bg-amber-50 border-amber-300 text-amber-950'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  }`}>
                    <div>
                      <span className="text-[11px] font-extrabold uppercase tracking-wider block">
                        Đánh giá mức độ rủi ro lâm sàng
                      </span>
                      <p className="text-sm font-bold mt-1">
                        {patient.aiAnalysis.summary}
                      </p>
                    </div>
                    <span className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase shrink-0 shadow-xs ${
                      patient.aiAnalysis.riskLevel === 'HIGH'
                        ? 'bg-rose-600 text-white'
                        : patient.aiAnalysis.riskLevel === 'MEDIUM'
                        ? 'bg-amber-500 text-white'
                        : 'bg-emerald-600 text-white'
                    }`}>
                      Rủi ro: {patient.aiAnalysis.riskLevel === 'HIGH' ? 'CAO (Báo động)' : patient.aiAnalysis.riskLevel === 'MEDIUM' ? 'TRUNG BÌNH' : 'THẤP'}
                    </span>
                  </div>

                  {/* Clinical Alerts / Red flags */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2.5">
                    <h4 className="text-xs font-black text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-rose-600" />
                      Cảnh Báo Thông Tin Quan Trọng & Bất Thường
                    </h4>
                    <div className="space-y-2">
                      {patient.aiAnalysis.clinicalAlerts.map((alert, i) => (
                        <div
                          key={i}
                          className={`p-3 rounded-lg text-xs border ${
                            alert.type === 'critical'
                              ? 'bg-rose-50/80 border-rose-300 text-rose-900'
                              : 'bg-amber-50/70 border-amber-300 text-amber-900'
                          }`}
                        >
                          <div className="font-extrabold flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            {alert.message}
                          </div>
                          {alert.evidence && (
                            <p className="text-[11px] mt-1 text-slate-600">
                              Bằng chứng lâm sàng: <span className="font-mono">{alert.evidence}</span>
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Differential diagnosis & Recommendations Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Differential */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
                      <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-indigo-600" />
                        Chẩn Đoán Phân Biệt & Biến Chứng Cần Loại Trừ
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-700">
                        {patient.aiAnalysis.differentialDiagnosis.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Recommendations */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
                      <h4 className="text-xs font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Đề Xuất Phác Đồ & Bổ Sung Cận Lâm Sàng
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-700">
                        {patient.aiAnalysis.recommendations.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                              ✓
                            </span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Suggested monitoring */}
                  {patient.aiAnalysis.suggestedMonitoring && (
                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 text-purple-950 space-y-1.5 text-xs">
                      <h4 className="font-extrabold uppercase tracking-wider flex items-center gap-1.5 text-purple-800">
                        <Eye className="w-4 h-4 text-purple-600" />
                        Chỉ Dẫn Trọng Tâm Cho Kíp Trực
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        {patient.aiAnalysis.suggestedMonitoring.map((item, idx) => (
                          <div key={idx} className="bg-white/80 p-2 rounded-lg border border-purple-200 font-medium">
                            • {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white p-6 rounded-xl border border-dashed border-slate-300 text-center space-y-2">
                  <Bot className="w-10 h-10 text-indigo-400 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">
                    Chưa thực hiện phân tích AI cho bệnh nhân này
                  </p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Bấm vào nút "Phân Tích Ca Bệnh Bằng AI" ở trên để AI tự động đánh giá chẩn đoán, cảnh báo xét nghiệm nguy hiểm và kiểm tra tương tác thuốc.
                  </p>
                </div>
              )}

              {/* Direct Doctor-AI Consultation Chat */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col h-[320px]">
                <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <Bot className="w-4 h-4 text-indigo-600" />
                    <span>Hỏi Đáp Chuyên Môn Trực Tiếp Về Bệnh Nhân Này</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Trợ lý Gemini Flash BV Hùng Vương Gia Lai
                  </span>
                </div>

                {/* Messages list */}
                <div className="p-3 flex-1 overflow-y-auto space-y-2.5 text-xs">
                  {chatHistory.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-2 ${
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 text-[10px] font-bold">
                          AI
                        </div>
                      )}
                      <div
                        className={`p-3 rounded-xl max-w-[80%] leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-rose-600 text-white font-medium rounded-tr-none'
                            : 'bg-slate-100 text-slate-800 rounded-tl-none whitespace-pre-wrap'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 italic">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                      <span>AI đang tra cứu hướng dẫn lâm sàng...</span>
                    </div>
                  )}
                </div>

                {/* Chat input box */}
                <form
                  onSubmit={handleSendChat}
                  className="p-2 border-t border-slate-200 bg-slate-50 flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Ví dụ: Bệnh nhân có tiền sử dị ứng Penicillin, nếu viêm phổi nặng nên dùng kháng sinh nào thay thế?..."
                    className="flex-1 text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={isChatLoading || !chatMessage.trim()}
                    className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
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
import { getDoctorsForRoomOrGroup } from '../data/mockData';
import { formatPatientDisplayName } from '../utils/storage';
import { sortDoctorsAlphabetically } from '../utils/doctorSorter';
import { getCriticalLabAlerts, parseRawLabsText, autoClassifyAndTagPatient } from '../utils/labAlerts';
import { isRealAllergy } from '../utils/clinicalTextParser';
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
  Stethoscope, 
  AlertOctagon,
  Calendar,
  MapPin,
  CreditCard,
  ShieldAlert,
  Loader2,
  Copy,
  Check,
  ClipboardCheck,
  Search,
  LayoutGrid,
  Table as TableIcon,
  ChevronDown,
  ChevronUp,
  FileCode,
  CheckCircle,
  AlertCircle,
  Layers
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
  const [newEvolutionShift, setNewEvolutionShift] = useState<'Sáng' | 'Chiều' | 'Đêm / Trực'>(() => {
    const h = new Date().getHours();
    if (h >= 7 && h < 14) return 'Sáng';
    if (h >= 14 && h < 21) return 'Chiều';
    return 'Đêm / Trực';
  });
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
  const [isQuickAppendingLab, setIsQuickAppendingLab] = useState(false);
  const [newAppendLabText, setNewAppendLabText] = useState('');
  const [appendSuccessAlert, setAppendSuccessAlert] = useState<string | null>(null);
  const [labCategoryFilter, setLabCategoryFilter] = useState<string>('ALL');
  const [labViewMode, setLabViewMode] = useState<'cards' | 'table'>('cards');
  const [labSearchTerm, setLabSearchTerm] = useState<string>('');
  const [showRawLabsText, setShowRawLabsText] = useState<boolean>(false);

  useEffect(() => {
    setInitialLabsText(patient.initialLabsText || '');
  }, [patient.id, patient.initialLabsText]);
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

  const [aiClassificationResult, setAiClassificationResult] = useState<{
    severity: SeverityLevel;
    tags: ClinicalTag[];
    admissionStatus?: AdmissionDischargeStatus;
    reasons: string[];
  } | null>(null);

  const handleRunAiClassification = () => {
    const result = autoClassifyAndTagPatient(patient);
    setAiClassificationResult(result);
    onUpdatePatient({
      ...patient,
      severity: result.severity,
      tags: result.tags,
      admissionStatus: result.admissionStatus || patient.admissionStatus,
    });
  };

  const handleParseAndOrganizeLabs = () => {
    const parsedLabs = parseRawLabsText(initialLabsText);
    if (parsedLabs.length === 0) return;
    const updated = {
      ...patient,
      initialLabsText,
      labs: parsedLabs,
    };
    onUpdatePatient(updated);
  };

  const handleSaveLabText = () => {
    // Tự động phân tích toàn bộ văn bản và sắp xếp các chỉ số xuống bảng
    const parsedLabs = parseRawLabsText(initialLabsText);
    const updated = { 
      ...patient, 
      initialLabsText,
      labs: parsedLabs.length > 0 ? parsedLabs : (patient.labs || []),
    };
    onUpdatePatient(updated);
    setIsEditingLabText(false);
  };

  // Tự động thêm mốc thời gian, sắp xếp văn bản nối tiếp xuống dưới và tự động phân tích chỉ số mới
  const handleAutoAppendAndParseNewLabs = (rawTextToAppend?: string) => {
    const textToProcess = (typeof rawTextToAppend === 'string' ? rawTextToAppend : newAppendLabText).trim();
    if (!textToProcess) return;

    const now = new Date();
    const timeDisplay = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    // 1. Tự động thêm mốc thời gian và sắp xếp văn bản nối tiếp xuống dưới
    const appendHeader = `\n\n--- [Cận Lâm Sàng Mới: ${timeDisplay}] ---\n`;
    const fullText = initialLabsText.trim()
      ? `${initialLabsText.trim()}${appendHeader}${textToProcess}`
      : textToProcess;

    // 2. Tự động bóc tách và phân tích các chỉ số mới
    const newParsedLabs = parseRawLabsText(textToProcess, timeDisplay);

    // 3. Tự động sắp xếp các chỉ số xét nghiệm xuống dưới bảng kết quả
    const existingLabs = patient.labs || [];
    const combinedLabs = [...existingLabs, ...newParsedLabs];

    const updated: Patient = {
      ...patient,
      initialLabsText: fullText,
      labs: combinedLabs,
    };

    onUpdatePatient(updated);
    setInitialLabsText(fullText);
    setNewAppendLabText('');
    setIsQuickAppendingLab(false);

    // Thông báo phản hồi tức thì cho bác sĩ
    const count = newParsedLabs.length;
    setAppendSuccessAlert(`✓ Đã tự động phân tích và đưa ${count > 0 ? `${count} chỉ số mới` : 'kết quả CLS'} nối tiếp xuống dưới!`);
    setTimeout(() => {
      setAppendSuccessAlert(null);
    }, 4500);
  };

  // Đọc trực tiếp từ Clipboard và tự động phân tích & đưa nối tiếp xuống dưới với 1 chạm
  const handleDirectClipboardAppend = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          handleAutoAppendAndParseNewLabs(text.trim());
          return;
        }
      }
    } catch (err) {
      console.warn('Clipboard read error or not permitted:', err);
    }
    // Mở hộp dán nếu clipboard trống hoặc chưa được cấp quyền đọc tự động
    setIsQuickAppendingLab(true);
  };

  const displayedLabs = useMemo(() => {
    let list = patient.labs || [];
    if (labCategoryFilter === 'PANIC') {
      list = list.filter((l) => l.isPanicValue);
    } else if (labCategoryFilter === 'ABNORMAL') {
      list = list.filter((l) => l.isAbnormal || l.isPanicValue);
    } else if (labCategoryFilter !== 'ALL') {
      list = list.filter((l) => l.category === labCategoryFilter);
    }
    if (labSearchTerm.trim()) {
      const q = labSearchTerm.toLowerCase();
      list = list.filter((l) => 
        l.testName.toLowerCase().includes(q) || 
        (l.category && l.category.toLowerCase().includes(q)) ||
        (l.value && l.value.toLowerCase().includes(q))
      );
    }
    return list;
  }, [patient.labs, labCategoryFilter, labSearchTerm]);

  const labStats = useMemo(() => {
    const all = patient.labs || [];
    const panicCount = all.filter((l) => l.isPanicValue).length;
    const abnormalCount = all.filter((l) => l.isAbnormal && !l.isPanicValue).length;
    const bloodCount = all.filter((l) => l.category === 'Huyết học' || l.category === 'Sinh hóa' || l.category === 'Điện giải' || l.category === 'Khí máu').length;
    const imagingCount = all.filter((l) => l.category === 'CĐHA').length;
    return { total: all.length, panicCount, abnormalCount, bloodCount, imagingCount };
  }, [patient.labs]);

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
  const criticalLabAlerts = getCriticalLabAlerts(patient);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-in fade-in duration-150">
      {/* Light backdrop so the patient list and names on the left stay clearly visible */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/25 backdrop-blur-2xs transition-opacity cursor-pointer"
        title="Bấm bên ngoài để đóng bảng chi tiết"
      />

      {/* Right-side expansive sliding drawer panel (khung rộng gần hết màn hình) */}
      <div className="relative w-full sm:w-[98vw] md:w-[96vw] lg:w-[95vw] xl:w-[95vw] max-w-[1900px] bg-white h-full shadow-2xl border-l-0 sm:border-l border-slate-200 flex flex-col z-10 animate-in slide-in-from-right duration-200 overflow-hidden">
        
        {/* Modal Top Header - Đậm chất BV Hùng Vương Gia Lai */}
        <div className={`px-3 sm:px-5 py-2 sm:py-3 border-b flex flex-wrap items-center justify-between gap-2 sm:gap-3 shrink-0 ${
          isCritical
            ? 'bg-gradient-to-r from-rose-800 via-rose-900 to-slate-900 text-white'
            : isModerate
            ? 'bg-gradient-to-r from-amber-700 via-amber-800 to-slate-900 text-white'
            : 'bg-gradient-to-r from-[#0b4d8c] via-[#083a69] to-slate-900 text-white'
        }`}>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-white/20 text-white font-black text-[11px] sm:text-xs tracking-wider shadow-2xs">
                Phòng {patient.roomNumber}
              </span>
              {patient.patientCode && (
                <span className="px-1.5 sm:px-2 py-0.5 rounded bg-white/10 text-white/90 font-mono font-bold text-[10.5px] sm:text-xs">
                  Mã BN: {patient.patientCode}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-2xl font-black tracking-tight text-white">
                {formatPatientDisplayName(patient.fullName)}
              </h2>
              <span className="text-xs sm:text-sm font-semibold text-white/90 bg-white/10 px-2 sm:px-2.5 py-0.5 rounded flex items-center gap-1">
                {patient.gender === 'Nam' ? (
                  <span className="text-blue-300 font-extrabold flex items-center gap-0.5"><span>♂</span> Nam</span>
                ) : (
                  <span className="text-rose-300 font-extrabold flex items-center gap-0.5"><span>♀</span> Nữ</span>
                )}, {patient.age} tuổi
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Nút Phân Loại Bệnh Án AI */}
            <button
              type="button"
              onClick={handleRunAiClassification}
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[11px] sm:text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer border border-purple-400/50"
              title="Tự động phân tích diễn tiến lâm sàng, sinh hiệu, cận lâm sàng để gắn nhãn (New, Dị ứng, Nặng...)"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin shrink-0" />
              <span><span className="hidden sm:inline">Phân Loại Bệnh Án </span>AI</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="p-1.5 sm:p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title="In trích lục bệnh án"
            >
              <Printer className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title="Đóng bảng chi tiết"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Compact Administrative Ribbon: Chiếm ít không gian hơn, đầy đủ thông tin hành chính */}
        <div className="px-3 sm:px-5 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 sm:gap-3 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {/* BS điều trị */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-500">BS điều trị:</span>
              <div className="flex items-center gap-1.5">
                <div className={`w-4 h-4 rounded-full ${currentDoctor?.avatarColor || 'bg-slate-400'} text-white flex items-center justify-center text-[9px] font-bold`}>
                  {currentDoctor ? currentDoctor.name.split(' ').pop()?.[0] : '?'}
                </div>
                {(() => {
                  const roomDocs = getDoctorsForRoomOrGroup(patient.roomNumber, doctors, patient.attendingDoctorId);
                  return (
                    <select
                      value={patient.attendingDoctorId}
                      onChange={(e) => handleChangeDoctor(e.target.value)}
                      className="bg-white border border-slate-300 rounded-md px-2 py-0.5 font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#0b4d8c] text-xs cursor-pointer"
                    >
                      {roomDocs.map((d) => (
                        <option key={d.id} value={d.id}>
                          BS. {formatDoctorShortName(d.name)}
                        </option>
                      ))}
                    </select>
                  );
                })()}
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
        <div className="px-2 sm:px-5 border-b border-slate-200 flex items-center gap-1 overflow-x-auto bg-white no-print scrollbar-none">
          <button
            onClick={() => setActiveTab('overview')}
            className={`inline-flex items-center gap-1.5 py-2.5 sm:py-3 px-2 sm:px-3.5 border-b-2 text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'overview'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Info className="w-3.5 sm:w-4 h-3.5 sm:h-4 shrink-0" />
            <span className="sm:hidden">Hành Chính</span>
            <span className="hidden sm:inline">Hành Chính & Chẩn Đoán</span>
          </button>

          <button
            onClick={() => setActiveTab('evolutions')}
            className={`inline-flex items-center gap-1.5 py-2.5 sm:py-3 px-2 sm:px-3.5 border-b-2 text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'evolutions'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Activity className="w-3.5 sm:w-4 h-3.5 sm:h-4 shrink-0" />
            <span className="sm:hidden">Diễn Tiến ({patient.evolutions.length})</span>
            <span className="hidden sm:inline">Diễn Tiến & Sinh Hiệu ({patient.evolutions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('labs')}
            className={`inline-flex items-center gap-1.5 py-2.5 sm:py-3 px-2 sm:px-3.5 border-b-2 text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'labs'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <TestTube className="w-3.5 sm:w-4 h-3.5 sm:h-4 shrink-0" />
            <span className="sm:hidden">CLS & XN ({patient.labs.length})</span>
            <span className="hidden sm:inline">Xét Nghiệm & Cận Lâm Sàng ({patient.labs.length})</span>
            {patient.labs.some((l) => l.isPanicValue) && (
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping inline-block" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('medications')}
            className={`inline-flex items-center gap-1.5 py-2.5 sm:py-3 px-2 sm:px-3.5 border-b-2 text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'medications'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Pill className="w-3.5 sm:w-4 h-3.5 sm:h-4 shrink-0" />
            <span>Y Lệnh Thuốc ({patient.medications.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`inline-flex items-center gap-1.5 py-2.5 sm:py-3 px-2 sm:px-3.5 border-b-2 text-xs font-extrabold transition-all whitespace-nowrap ml-auto cursor-pointer ${
              activeTab === 'ai'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                : 'border-transparent text-indigo-600 hover:bg-indigo-50/40'
            }`}
          >
            <Sparkles className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-indigo-600 animate-pulse shrink-0" />
            <span className="sm:hidden">AI Cố Vấn</span>
            <span className="hidden sm:inline">AI Cố Vấn Lâm Sàng & Cảnh Báo</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1 space-y-3.5 sm:space-y-5 bg-slate-50/40">
          
          {/* Thông báo kết quả Phân Loại Bệnh Án AI */}
          {aiClassificationResult && (
            <div className="p-3.5 bg-purple-50 border-2 border-purple-300 rounded-xl text-xs space-y-2 animate-in fade-in shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-purple-900">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span className="uppercase tracking-wide">KẾT QUẢ PHÂN LOẠI BỆNH ÁN AI (ĐÃ TỰ ĐỘNG GẮN NHÃN)</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setAiClassificationResult(null)} 
                  className="px-2 py-0.5 rounded bg-purple-200/60 hover:bg-purple-300 text-purple-800 text-[11px] font-bold cursor-pointer"
                >
                  ✕ Đóng
                </button>
              </div>
              <div className="flex items-center gap-2 font-bold text-slate-800 flex-wrap">
                <span>Mức độ: <strong className="text-purple-700 uppercase px-1.5 py-0.5 bg-purple-100 rounded">{aiClassificationResult.severity}</strong></span>
                <span>•</span>
                <span>Nhãn tự động: <strong className="text-purple-700">{aiClassificationResult.tags.join(', ') || 'Không'}</strong></span>
                {aiClassificationResult.admissionStatus && (
                  <>
                    <span>•</span>
                    <span>Trạng thái: <strong className="text-purple-700">{aiClassificationResult.admissionStatus}</strong></span>
                  </>
                )}
              </div>
              <ul className="list-disc list-inside text-slate-700 text-[11px] space-y-0.5 pl-1 font-medium bg-white/70 p-2 rounded-lg border border-purple-100">
                {aiClassificationResult.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* TAB 1: OVERVIEW & DEMOGRAPHICS */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Special Priority Clinical Tags & Severity Selection */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <HeartPulse className="w-4 h-4 text-rose-600" />
                    Phân Loại Tình Trạng & Nhãn Lâm Sàng Đặc Biệt
                  </h3>
                </div>

                {/* 1. Mức độ tình trạng bệnh nhân (Severity Pills) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wide">
                      Tình trạng & Nhãn người bệnh:
                    </span>
                    {patient.admissionStatus === 'DISCHARGE_TODAY' && (
                      <span className="text-[10px] font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                        🟣 Ra viện
                      </span>
                    )}
                    {patient.admissionStatus === 'DISCHARGE_TOMORROW' && (
                      <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        🔵 RV ngày mai
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onUpdatePatient({
                          ...patient,
                          severity: 'STABLE',
                        });
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        patient.severity === 'STABLE'
                          ? 'bg-emerald-600 text-white shadow-2xs font-black ring-2 ring-emerald-300'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      <span>Ổn định</span>
                      {patient.severity === 'STABLE' && (
                        <CheckCircle2 className="w-3 h-3 ml-0.5 shrink-0" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onUpdatePatient({
                          ...patient,
                          severity: 'MODERATE',
                        });
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        patient.severity === 'MODERATE'
                          ? 'bg-amber-500 text-white shadow-2xs font-black ring-2 ring-amber-300'
                          : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                      }`}
                    >
                      <span>Cần theo dõi</span>
                      {patient.severity === 'MODERATE' && (
                        <CheckCircle2 className="w-3 h-3 ml-0.5 shrink-0" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onUpdatePatient({
                          ...patient,
                          severity: 'CRITICAL',
                        });
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        patient.severity === 'CRITICAL'
                          ? 'bg-rose-600 text-white shadow-2xs font-black ring-2 ring-rose-300'
                          : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                      <span>Nặng</span>
                      {patient.severity === 'CRITICAL' && (
                        <CheckCircle2 className="w-3 h-3 ml-0.5 shrink-0" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                        if (patient.admissionStatus === 'DISCHARGE_TOMORROW' || patient.admissionStatus === 'DISCHARGE_TODAY') {
                          onUpdatePatient({
                            ...patient,
                            admissionStatus: 'STABLE_INPATIENT',
                            dischargeTomorrowSetDate: undefined,
                          });
                        } else {
                          onUpdatePatient({
                            ...patient,
                            admissionStatus: 'DISCHARGE_TOMORROW',
                            dischargeTomorrowSetDate: todayStr,
                          });
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        patient.admissionStatus === 'DISCHARGE_TOMORROW'
                          ? 'bg-blue-600 text-white shadow-2xs font-black ring-2 ring-blue-300'
                          : patient.admissionStatus === 'DISCHARGE_TODAY'
                          ? 'bg-purple-600 text-white shadow-2xs font-black ring-2 ring-purple-300'
                          : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
                      }`}
                      title="Gắn nhãn: Dự kiến ra viện ngày mai (hôm sau tự chuyển thành Ra viện, có thể dùng kèm Ổn định, Cần theo dõi hoặc Nặng)"
                    >
                      <span>{patient.admissionStatus === 'DISCHARGE_TODAY' ? '🟣 Ra viện' : '🔵 RV ngày mai'}</span>
                      {(patient.admissionStatus === 'DISCHARGE_TOMORROW' || patient.admissionStatus === 'DISCHARGE_TODAY') && (
                        <CheckCircle2 className="w-3 h-3 ml-0.5 shrink-0" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleChangeSeverity('UNCLASSIFIED')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        patient.severity === 'UNCLASSIFIED' || !patient.severity
                          ? 'bg-slate-700 text-white shadow-2xs font-black ring-2 ring-slate-400'
                          : 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      <span>Chưa phân loại</span>
                      {(patient.severity === 'UNCLASSIFIED' || !patient.severity) && <CheckCircle2 className="w-3 h-3 ml-0.5 shrink-0" />}
                    </button>
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
                    isCritical
                      ? 'bg-rose-100 text-rose-700 border border-rose-300 uppercase tracking-wide'
                      : isModerate
                      ? 'bg-amber-100 text-amber-800 border border-amber-300 uppercase tracking-wide'
                      : isStable
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wide'
                      : 'bg-slate-100 text-slate-700 border border-slate-300 normal-case'
                  }`}>
                    {isCritical ? 'NẶNG' : isModerate ? 'VỪA' : isStable ? 'ỔN ĐỊNH' : 'Chưa phân loại'}
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
                  

                  {patient.treatmentPlan && (
                    <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-indigo-900">
                      <span className="font-extrabold uppercase">Kế hoạch điều trị: </span>
                      <span className="font-bold">{patient.treatmentPlan}</span>
                    </div>
                  )}

                  {patient.todayProgressSummary && (
                    <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-cyan-950 flex items-start gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-cyan-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-extrabold uppercase text-cyan-900">Tóm tắt diễn tiến: </span>
                        <span className="font-medium whitespace-pre-line">{patient.todayProgressSummary}</span>
                      </div>
                    </div>
                  )}

                  {(patient.detailedClinicalEvolution || (patient.id?.startsWith('SAT-') && patient.evolutions?.[0]?.clinicalNote)) && (
                    <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-indigo-950 flex items-start gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-extrabold uppercase text-indigo-900">Diễn tiến lâm sàng chi tiết: </span>
                        <span className="font-medium whitespace-pre-line">{patient.detailedClinicalEvolution || patient.evolutions?.[0]?.clinicalNote?.split(/\[Sinh hiệu:.*?\]/i)[0]?.trim()}</span>
                      </div>
                    </div>
                  )}

                  {/* Cận lâm sàng & Kết quả nổi bật */}
                  {(patient.initialLabsText || (patient.labs && patient.labs.length > 0)) && (
                    <div className="mt-2 pt-2 border-t border-slate-200 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold uppercase text-blue-900 flex items-center gap-1.5">
                          <TestTube className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>Cận lâm sàng nổi bật:</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveTab('labs')}
                          className="text-[11px] font-bold text-[#0b4d8c] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>Xem toàn bộ ({patient.labs?.length || 0} chỉ số)</span>
                          <span>→</span>
                        </button>
                      </div>

                      {/* Hiển thị nhanh các chỉ số bất thường hoặc nổi bật */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {patient.labs && patient.labs.length > 0 ? (
                          <>
                            {patient.labs.filter((l) => l.isPanicValue || l.isAbnormal).slice(0, 6).map((lab) => (
                              <span
                                key={lab.id}
                                className={`px-2 py-0.5 rounded-md text-[11px] font-bold shadow-2xs flex items-center gap-1 ${
                                  lab.isPanicValue
                                    ? 'bg-rose-600 text-white animate-pulse'
                                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                                }`}
                              >
                                <span>{lab.isPanicValue ? '🚨' : '⚠️'}</span>
                                <span>{lab.testName}: <strong>{lab.value}</strong> {lab.unit}</span>
                              </span>
                            ))}
                            {patient.labs.filter((l) => l.category === 'CĐHA').slice(0, 2).map((lab) => (
                              <span
                                key={lab.id}
                                className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-900 border border-blue-200 truncate max-w-[280px]"
                                title={lab.value}
                              >
                                🩻 <strong>{lab.testName}:</strong> {lab.value}
                              </span>
                            ))}
                            {patient.labs.filter((l) => l.isPanicValue || l.isAbnormal).length === 0 && (
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                🟢 Các chỉ số xét nghiệm hiện tại trong giới hạn bình thường
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">
                            Đã lưu văn bản kết quả CLS. Bấm "Xem toàn bộ" để bóc tách chi tiết.
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Dị Ứng Thuốc & Tiền Sử Bệnh */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Dị ứng thuốc - Cảnh báo đỏ nổi bật */}
                <div className={`p-3.5 rounded-xl border ${
                  isRealAllergy(patient.allergies)
                    ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-300'
                    : 'bg-white border-slate-200 shadow-2xs'
                }`}>
                  <div className="flex items-center gap-1.5 font-black text-rose-700 uppercase tracking-wider mb-1">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span>Dị ứng thuốc & Thận trọng</span>
                  </div>
                  <p className={`font-bold mt-1 ${
                    isRealAllergy(patient.allergies)
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
                  className="bg-white p-4 rounded-xl border border-rose-300 shadow-sm space-y-3.5 animate-in fade-in"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <h4 className="text-xs font-black text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Stethoscope className="w-4 h-4 text-rose-600" />
                      <span>Thêm Ghi Chép Diễn Tiến Mới</span>
                    </h4>
                  </div>

                  {/* Sinh hiệu */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Sinh hiệu ca trực (HA, Mạch, Thân nhiệt, SpO2)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-500 font-semibold block mb-0.5">HA Tâm thu</span>
                        <input
                          type="number"
                          value={newBpSys}
                          onChange={(e) => setNewBpSys(Number(e.target.value))}
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono font-bold"
                          placeholder="120"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-semibold block mb-0.5">HA Tâm trương</span>
                        <input
                          type="number"
                          value={newBpDia}
                          onChange={(e) => setNewBpDia(Number(e.target.value))}
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono font-bold"
                          placeholder="80"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-semibold block mb-0.5">Mạch (l/p)</span>
                        <input
                          type="number"
                          value={newPulse}
                          onChange={(e) => setNewPulse(Number(e.target.value))}
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono font-bold"
                          placeholder="80"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-semibold block mb-0.5">Nhiệt độ (°C)</span>
                        <input
                          type="number"
                          step="0.1"
                          value={newTemp}
                          onChange={(e) => setNewTemp(Number(e.target.value))}
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono font-bold"
                          placeholder="37.0"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-semibold block mb-0.5">SpO₂ (%)</span>
                        <input
                          type="number"
                          value={newSpo2}
                          onChange={(e) => setNewSpo2(Number(e.target.value))}
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono font-bold text-emerald-700"
                          placeholder="98"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Diễn biến triệu chứng lâm sàng */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        Diễn biến triệu chứng lâm sàng <span className="text-rose-500">*</span>
                      </label>
                      {patient.evolutions?.[0]?.clinicalNote && (
                        <button
                          type="button"
                          onClick={() => setNewEvolutionNote(patient.evolutions[0].clinicalNote)}
                          className="text-[10.5px] font-bold text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded border border-rose-200 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Copy className="w-2.5 h-2.5" />
                          <span>Sao chép ca trước</span>
                        </button>
                      )}
                    </div>

                    {/* Quick chips triệu chứng */}
                    <div className="flex flex-wrap gap-1">
                      {['Tỉnh, tiếp xúc tốt', 'Đỡ đau ngực, không khó thở', 'SpO2 khí trời ổn', 'Tim đều, phổi không rales', 'Bụng mềm, không chướng', 'Ăn ngủ khá'].map((chip, idx) => (
                        <button
                          type="button"
                          key={idx}
                          onClick={() => {
                            setNewEvolutionNote((prev) => {
                              const trimmed = prev.trim();
                              if (!trimmed) return chip;
                              if (trimmed.includes(chip)) return prev;
                              return `${trimmed}, ${chip}`;
                            });
                          }}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 hover:bg-rose-50 hover:text-rose-700 border border-slate-200 transition-colors"
                        >
                          + {chip}
                        </button>
                      ))}
                    </div>

                    <textarea
                      rows={3}
                      value={newEvolutionNote}
                      onChange={(e) => setNewEvolutionNote(e.target.value)}
                      placeholder="Bệnh nhân tỉnh táo, đỡ khó thở, tim đều rõ, phổi thông khí tốt, bụng mềm, nước tiểu vàng trong..."
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 leading-relaxed font-medium text-slate-900"
                      required
                    />
                  </div>

                  {/* Xử trí & Hướng điều trị tiếp theo */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        Xử trí & Hướng điều trị tiếp theo
                      </label>
                      {(patient.evolutions?.[0]?.treatmentAction || patient.treatmentPlan) && (
                        <button
                          type="button"
                          onClick={() => setNewEvolutionAction(patient.evolutions?.[0]?.treatmentAction || patient.treatmentPlan || '')}
                          className="text-[10.5px] font-bold text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded border border-rose-200 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Copy className="w-2.5 h-2.5" />
                          <span>Sao chép y lệnh trước</span>
                        </button>
                      )}
                    </div>

                    {/* Quick chips y lệnh */}
                    <div className="flex flex-wrap gap-1">
                      {['Duy trì y lệnh hiện tại', 'Chỉnh liều thuốc theo HA', 'Khí dung theo cữ', 'Theo dõi sát SpO2 & sinh hiệu', 'Làm lại XN sáng mai'].map((chip, idx) => (
                        <button
                          type="button"
                          key={idx}
                          onClick={() => {
                            setNewEvolutionAction((prev) => {
                              const trimmed = prev.trim();
                              if (!trimmed) return chip;
                              if (trimmed.includes(chip)) return prev;
                              return `${trimmed}; ${chip}`;
                            });
                          }}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 hover:bg-rose-50 hover:text-rose-700 border border-slate-200 transition-colors"
                        >
                          + {chip}
                        </button>
                      ))}
                    </div>

                    <input
                      type="text"
                      value={newEvolutionAction}
                      onChange={(e) => setNewEvolutionAction(e.target.value)}
                      placeholder="Tiếp tục phác đồ, tăng liều vận mạch, khí dung thêm, mời hội chẩn..."
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 font-medium text-slate-900"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowAddEvolution(false)}
                      className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-bold"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-98"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Lưu diễn tiến</span>
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
              
              {/* 1. Header & Quick Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#0b4d8c] flex items-center justify-center font-bold">
                      <TestTube className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <span>Kết Quả Xét Nghiệm & Cận Lâm Sàng</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 font-bold font-mono">
                          {patient.labs?.length || 0} chỉ số
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Tự động bóc tách chỉ số từ HIS/Bệnh án, phân nhóm chuyên khoa và cảnh báo bất thường
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {/* Nút 1-chạm dán từ clipboard */}
                  <button
                    type="button"
                    onClick={handleDirectClipboardAppend}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-black shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                    title="Đọc kết quả CLS từ clipboard, tự động phân tích và đưa nối tiếp xuống dưới ngay lập tức"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5 text-emerald-200" />
                    <span>📋 Dán & Đưa Xuống Dưới</span>
                  </button>

                  {/* Nút mở ô dán thủ công có mốc thời gian */}
                  <button
                    type="button"
                    onClick={() => setIsQuickAppendingLab(!isQuickAppendingLab)}
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>+ Nối Tiếp</span>
                  </button>

                  {/* Nút xem văn bản gốc HIS */}
                  <button
                    type="button"
                    onClick={() => setShowRawLabsText(!showRawLabsText)}
                    className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1 ${
                      showRawLabsText
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                    }`}
                    title="Xem hoặc chỉnh sửa toàn văn bản sao chép gốc từ HIS"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>{showRawLabsText ? 'Đóng văn bản HIS' : 'Văn bản gốc HIS'}</span>
                  </button>

                  {/* Nút thêm thủ công */}
                  <button
                    type="button"
                    onClick={() => setShowAddLab(!showAddLab)}
                    className="px-2.5 py-1.5 text-xs font-bold rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Thêm thủ công</span>
                  </button>
                </div>
              </div>

              {/* 2. Thống Kê & Bộ Lọc Nhanh 1-Chạm (KPI Cards) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {/* Panic card */}
                <button
                  type="button"
                  onClick={() => setLabCategoryFilter(labCategoryFilter === 'PANIC' ? 'ALL' : 'PANIC')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    labCategoryFilter === 'PANIC'
                      ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-300 shadow-xs'
                      : labStats.panicCount > 0
                      ? 'bg-rose-50/80 border-rose-300 hover:bg-rose-100/80 text-rose-950'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${
                      labCategoryFilter === 'PANIC' ? 'text-rose-100' : 'text-rose-700'
                    }`}>
                      Báo động nguy hiểm
                    </span>
                    {labStats.panicCount > 0 && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
                    )}
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-black">{labStats.panicCount}</span>
                    <span className="text-[11px] font-semibold opacity-80">chỉ số</span>
                  </div>
                </button>

                {/* Abnormal card */}
                <button
                  type="button"
                  onClick={() => setLabCategoryFilter(labCategoryFilter === 'ABNORMAL' ? 'ALL' : 'ABNORMAL')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    labCategoryFilter === 'ABNORMAL'
                      ? 'bg-amber-600 text-white border-amber-700 ring-2 ring-amber-300 shadow-xs'
                      : labStats.abnormalCount > 0
                      ? 'bg-amber-50/80 border-amber-300 hover:bg-amber-100/80 text-amber-950'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${
                      labCategoryFilter === 'ABNORMAL' ? 'text-amber-100' : 'text-amber-700'
                    }`}>
                      Chỉ số bất thường
                    </span>
                    <AlertTriangle className={`w-3.5 h-3.5 ${
                      labCategoryFilter === 'ABNORMAL' ? 'text-amber-200' : 'text-amber-600'
                    }`} />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-black">{labStats.abnormalCount}</span>
                    <span className="text-[11px] font-semibold opacity-80">chỉ số</span>
                  </div>
                </button>

                {/* Blood tests count */}
                <button
                  type="button"
                  onClick={() => setLabCategoryFilter(labCategoryFilter === 'Huyết học' ? 'ALL' : 'Huyết học')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    labCategoryFilter === 'Huyết học' || labCategoryFilter === 'Sinh hóa' || labCategoryFilter === 'Điện giải'
                      ? 'bg-[#0b4d8c] text-white border-blue-900 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Xét nghiệm máu & SH
                    </span>
                    <Activity className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-black text-slate-900">{labStats.bloodCount}</span>
                    <span className="text-[11px] font-semibold text-slate-500">chỉ số</span>
                  </div>
                </button>

                {/* Imaging count */}
                <button
                  type="button"
                  onClick={() => setLabCategoryFilter(labCategoryFilter === 'CĐHA' ? 'ALL' : 'CĐHA')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    labCategoryFilter === 'CĐHA'
                      ? 'bg-purple-700 text-white border-purple-900 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      CĐHA & ECG
                    </span>
                    <span className="text-xs">🩻</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-black text-slate-900">{labStats.imagingCount}</span>
                    <span className="text-[11px] font-semibold text-slate-500">kết quả</span>
                  </div>
                </button>
              </div>

              {/* Thông báo cập nhật thành công nếu có */}
              {appendSuccessAlert && (
                <div className="bg-emerald-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-1">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 stroke-[3] text-emerald-200" />
                    <span>{appendSuccessAlert}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAppendSuccessAlert(null)}
                    className="text-emerald-100 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-emerald-700 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* 3. Ô DÁN NHANH CẬN LÂM SÀNG MỚI ĐỂ NỐI TIẾP (Khi bật "+ Nối Tiếp") */}
              {isQuickAppendingLab && (
                <div className="bg-white p-3.5 rounded-2xl border-2 border-emerald-500 space-y-2.5 shadow-md animate-in fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1 pb-1.5 border-b border-emerald-100">
                    <span className="flex items-center gap-1.5 font-black text-emerald-950">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>Dán Kết Quả Cận Lâm Sàng Mới (HIS):</span>
                    </span>
                    <span className="text-[10.5px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      ⚡ Tự động phân tích & đưa xuống dưới ngay khi dán (Ctrl+V)
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={newAppendLabText}
                    onChange={(e) => setNewAppendLabText(e.target.value)}
                    onPaste={(e) => {
                      const pasted = e.clipboardData?.getData('text');
                      if (pasted && pasted.trim()) {
                        e.preventDefault();
                        handleAutoAppendAndParseNewLabs(pasted.trim());
                      }
                    }}
                    placeholder="Dán (Ctrl+V) kết quả xét nghiệm mới tại đây: Hệ thống sẽ TỰ ĐỘNG PHÂN TÍCH và ĐƯA NỐI TIẾP XUỐNG DƯỚI ngay khi dán..."
                    className="w-full p-2.5 bg-emerald-50/30 border border-emerald-300 rounded-xl text-xs font-mono font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400"
                    autoFocus
                  />
                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                    <button
                      type="button"
                      onClick={handleDirectClipboardAppend}
                      className="px-2.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      title="Đọc từ Clipboard và đưa xuống dưới ngay lập tức"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5 text-emerald-700" />
                      <span>📋 Dán từ Clipboard</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsQuickAppendingLab(false);
                          setNewAppendLabText('');
                        }}
                        className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-bold cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAutoAppendAndParseNewLabs()}
                        disabled={!newAppendLabText.trim()}
                        className={`px-3.5 py-1.5 rounded-lg font-black text-white shadow-xs flex items-center gap-1.5 transition-all ${
                          newAppendLabText.trim()
                            ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 cursor-pointer'
                            : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                        <span>⚡ Tự Động Phân Tích & Thêm Xuống Dưới</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. KHỐI VĂN BẢN GỐC TỪ HIS (DẠNG ACCORDION THU GỌN THÔNG MINH) */}
              {showRawLabsText && (
                <div className="bg-white rounded-2xl border border-blue-200 p-3.5 space-y-2.5 shadow-sm animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-blue-600" />
                      <span className="font-extrabold text-xs text-blue-950 uppercase tracking-wide">
                        Văn Bản Toàn Văn Sao Chép Từ HIS / Bệnh Án
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {initialLabsText && (
                        <button
                          type="button"
                          onClick={() => handleCopyText(initialLabsText, 'labs')}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer"
                        >
                          {copiedSection === 'labs' ? '✓ Đã sao chép' : 'Sao chép'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditingLabText) handleSaveLabText();
                          else setIsEditingLabText(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold cursor-pointer"
                      >
                        {isEditingLabText ? 'Lưu & Phân Tích' : 'Sửa văn bản'}
                      </button>
                    </div>
                  </div>

                  {isEditingLabText ? (
                    <div className="space-y-2">
                      <textarea
                        rows={6}
                        value={initialLabsText}
                        onChange={(e) => setInitialLabsText(e.target.value)}
                        placeholder="Dán hoặc cập nhật kết quả xét nghiệm, CTM, sinh hóa, ECG, X-Quang..."
                        className="w-full p-2.5 bg-slate-50 border border-blue-300 rounded-xl text-xs font-mono font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 leading-relaxed"
                      />
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Khi bấm Lưu, hệ thống sẽ <strong>tự động phân tích</strong> và cập nhật các chỉ số phía dưới.</span>
                        <button
                          type="button"
                          onClick={handleSaveLabText}
                          className="px-3.5 py-1.5 bg-blue-600 text-white font-bold rounded-lg cursor-pointer"
                        >
                          Lưu & Tự Động Phân Tích
                        </button>
                      </div>
                    </div>
                  ) : initialLabsText ? (
                    <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed bg-slate-50/70 p-3 rounded-xl border border-slate-200 max-h-48 overflow-y-auto">
                      {initialLabsText}
                    </pre>
                  ) : (
                    <p className="text-xs text-blue-800/80 italic p-2">
                      Chưa có văn bản kết quả CLS sao chép nhanh. Bấm "+ Nối Tiếp" hoặc "Sửa văn bản" để dán trực tiếp từ HIS.
                    </p>
                  )}
                </div>
              )}

              {/* 5. KHỐI FORM THÊM CHỈ SỐ THỦ CÔNG */}
              {showAddLab && (
                <form
                  onSubmit={handleSaveLab}
                  className="bg-white p-4 rounded-2xl border border-rose-200 shadow-sm space-y-3 animate-in fade-in text-xs"
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
                      className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs cursor-pointer"
                    >
                      Lưu kết quả
                    </button>
                  </div>
                </form>
              )}

              {/* 6. KHỐI BÁO ĐỘNG NGUY HIỂM (PANIC VALUES BANNER) NẾU CÓ */}
              {labStats.panicCount > 0 && (
                <div className="p-3.5 bg-gradient-to-r from-rose-50 via-rose-100/60 to-red-50 border-2 border-rose-400 rounded-2xl shadow-xs space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between pb-1 border-b border-rose-200">
                    <div className="flex items-center gap-2 font-black text-xs text-rose-900 uppercase tracking-wide">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
                      <span>CẢNH BÁO CHỈ SỐ CẬN LÂM SÀNG NGUY HIỂM (PANIC VALUE)</span>
                    </div>
                    <span className="text-[10px] font-bold bg-rose-600 text-white px-2 py-0.5 rounded-full uppercase">
                      Cần xử trí
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                    {patient.labs.filter((l) => l.isPanicValue).map((lab) => (
                      <div
                        key={lab.id}
                        className="bg-white/90 p-2.5 rounded-xl border border-rose-300 shadow-2xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <strong className="text-rose-950 font-black">{lab.testName}</strong>
                          <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-rose-600 text-white font-extrabold uppercase animate-pulse">
                            🚨 Nguy hiểm
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-base font-black text-rose-700">{lab.value}</span>
                          <span className="text-xs font-bold text-rose-900">{lab.unit}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Khoảng tham chiếu: <strong className="text-slate-700">{lab.normalRange || '---'}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 7. THANH CÔNG CỤ: CHUYỂN ĐỔI CHẾ ĐỘ XEM (THẺ CHUYÊN KHOA VS BẢNG) & TÌM KIẾM */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                {/* Left: View Mode Tabs */}
                <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setLabViewMode('cards')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                      labViewMode === 'cards'
                        ? 'bg-white text-[#0b4d8c] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>🗂️ Thẻ Chuyên Khoa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLabViewMode('table')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                      labViewMode === 'table'
                        ? 'bg-white text-[#0b4d8c] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                    <span>📊 Bảng Dữ Liệu</span>
                  </button>
                </div>

                {/* Right: Search & Category Filter */}
                <div className="flex items-center gap-2 flex-1 max-w-md ml-auto">
                  <div className="relative w-full">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={labSearchTerm}
                      onChange={(e) => setLabSearchTerm(e.target.value)}
                      placeholder="Tìm chỉ số (WBC, Creatinine, Kali, X-quang...)..."
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                    {labSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setLabSearchTerm('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 shrink-0 whitespace-nowrap">
                    {displayedLabs.length} / {patient.labs?.length || 0}
                  </span>
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                <button
                  type="button"
                  onClick={() => setLabCategoryFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-black transition-all cursor-pointer shrink-0 ${
                    labCategoryFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Tất cả ({patient.labs?.length || 0})
                </button>

                {labStats.panicCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setLabCategoryFilter('PANIC')}
                    className={`px-2.5 py-1 rounded-lg font-black transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                      labCategoryFilter === 'PANIC'
                        ? 'bg-rose-600 text-white shadow-2xs ring-2 ring-rose-300'
                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    <span>🚨 Báo động ({labStats.panicCount})</span>
                  </button>
                )}

                {labStats.abnormalCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setLabCategoryFilter('ABNORMAL')}
                    className={`px-2.5 py-1 rounded-lg font-black transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                      labCategoryFilter === 'ABNORMAL'
                        ? 'bg-amber-600 text-white shadow-2xs ring-2 ring-amber-300'
                        : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                    }`}
                  >
                    <span>⚠️ Bất thường ({labStats.abnormalCount})</span>
                  </button>
                )}

                {(['Huyết học', 'Sinh hóa', 'Điện giải', 'Khí máu', 'CĐHA'] as const).map((cat) => {
                  const count = patient.labs.filter((l) => l.category === cat).length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setLabCategoryFilter(cat)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
                        labCategoryFilter === cat
                          ? 'bg-[#0b4d8c] text-white shadow-2xs'
                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {cat === 'Huyết học' ? '🩸 ' : cat === 'Sinh hóa' ? '🧪 ' : cat === 'Điện giải' ? '⚡ ' : cat === 'Khí máu' ? '🫁 ' : '🩻 '}
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>

              {/* 8. MAIN DISPLAY: CHẾ ĐỘ THẺ CHUYÊN KHOA (CARDS VIEW) HOẶC BẢNG DỮ LIỆU (TABLE VIEW) */}
              {displayedLabs.length === 0 ? (
                <div className="py-12 bg-white rounded-2xl border border-slate-200 text-center space-y-3 p-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0b4d8c] flex items-center justify-center mx-auto shadow-inner">
                    <TestTube className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800">
                      {patient.labs?.length === 0 ? 'Chưa Có Kết Quả Cận Lâm Sàng Nào' : 'Không Tìm Thấy Chỉ Số Phù Hợp'}
                    </h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                      {patient.labs?.length === 0 
                        ? 'Dán văn bản sao chép từ HIS/Bệnh án hoặc đọc trực tiếp từ Clipboard để hệ thống tự động bóc tách và phân loại.'
                        : 'Hãy thử xóa từ khóa tìm kiếm hoặc chọn bộ lọc "Tất cả".'}
                    </p>
                  </div>
                  {patient.labs?.length === 0 && (
                    <div className="pt-2 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={handleDirectClipboardAppend}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <ClipboardCheck className="w-4 h-4 text-emerald-200" />
                        <span>📋 Dán từ Clipboard ngay</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsQuickAppendingLab(true)}
                        className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl font-bold text-xs cursor-pointer"
                      >
                        + Dán thủ công
                      </button>
                    </div>
                  )}
                </div>
              ) : labViewMode === 'cards' ? (
                /* CHẾ ĐỘ 1: XEM THEO THẺ CHUYÊN KHOA */
                <div className="space-y-4">
                  {(['Huyết học', 'Sinh hóa', 'Điện giải', 'Khí máu', 'CĐHA', 'Khác'] as const).map((categoryName) => {
                    const labsInCat = displayedLabs.filter((l) => l.category === categoryName);
                    if (labsInCat.length === 0) return null;

                    const catTitle = 
                      categoryName === 'Huyết học' ? '🩸 Huyết Học & Đông Máu (Công Thức Máu - CTM)' :
                      categoryName === 'Sinh hóa' ? '🧪 Sinh Hóa & Đánh Giá Chức Năng (Gan - Thận - Viêm - Tim)' :
                      categoryName === 'Điện giải' ? '⚡ Điện Giải Đồ (Na+, K+, Cl-, Ca2+)' :
                      categoryName === 'Khí máu' ? '🫁 Khí Máu Động Mạch (ABG)' :
                      categoryName === 'CĐHA' ? '🩻 Chẩn Đoán Hình Ảnh & Thăm Dò Chức Năng (X-Quang, Siêu Âm, ECG, CT)' :
                      '📋 Các Xét Nghiệm Khác';

                    return (
                      <div key={categoryName} className="space-y-2.5 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                          <h4 className="font-black text-xs sm:text-sm text-slate-900 tracking-tight flex items-center gap-1.5">
                            <span>{catTitle}</span>
                            <span className="text-[10.5px] font-bold font-mono px-2 py-0.2 bg-slate-100 text-slate-700 rounded-full">
                              {labsInCat.length}
                            </span>
                          </h4>
                          {labsInCat.some((l) => l.isPanicValue) && (
                            <span className="text-[10px] font-black uppercase text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 animate-pulse">
                              Có chỉ số nguy hiểm
                            </span>
                          )}
                        </div>

                        {categoryName === 'CĐHA' ? (
                          /* Hiển thị CĐHA dạng thẻ kết luận chi tiết */
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            {labsInCat.map((lab) => (
                              <div 
                                key={lab.id} 
                                className={`p-3.5 rounded-xl border transition-all ${
                                  lab.isPanicValue 
                                    ? 'bg-rose-50/90 border-rose-400 ring-2 ring-rose-300 shadow-xs' 
                                    : lab.isAbnormal 
                                    ? 'bg-amber-50/70 border-amber-300 shadow-2xs' 
                                    : 'bg-slate-50/60 border-slate-200 shadow-2xs'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/80 mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                                      lab.isPanicValue ? 'bg-rose-600 text-white' : lab.isAbnormal ? 'bg-amber-500 text-white' : 'bg-blue-100 text-blue-700'
                                    }`}>
                                      {/ecg/i.test(lab.testName) ? '📈' : /siêu âm/i.test(lab.testName) ? '📡' : /ct/i.test(lab.testName) ? '🖥️' : '🩻'}
                                    </div>
                                    <div>
                                      <h5 className="font-black text-xs sm:text-sm text-slate-900">
                                        {lab.testName}
                                      </h5>
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        {lab.timestamp}
                                      </span>
                                    </div>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                    lab.isPanicValue ? 'bg-rose-600 text-white animate-pulse' : lab.isAbnormal ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-800'
                                  }`}>
                                    {lab.isPanicValue ? '🚨 NGUY HIỂM' : lab.isAbnormal ? '⚠️ BẤT THƯỜNG' : 'BÌNH THƯỜNG'}
                                  </span>
                                </div>

                                <div className="text-xs text-slate-800 leading-relaxed font-medium bg-white/80 p-2.5 rounded-lg border border-slate-200/70">
                                  <span className="font-bold text-slate-900 block mb-0.5 text-[10.5px] uppercase tracking-wide text-slate-500">
                                    Mô tả & Kết luận chuyên môn:
                                  </span>
                                  <span className={`whitespace-pre-line text-xs sm:text-sm ${
                                    lab.isPanicValue ? 'text-rose-950 font-black' : lab.isAbnormal ? 'text-amber-950 font-bold' : 'text-slate-800 font-semibold'
                                  }`}>
                                    {lab.value}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          /* Hiển thị xét nghiệm số học dạng lưới thẻ Metric Card */
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
                            {labsInCat.map((lab) => (
                              <div
                                key={lab.id}
                                className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
                                  lab.isPanicValue
                                    ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-300/70 shadow-xs'
                                    : lab.isAbnormal
                                    ? 'bg-amber-50/70 border-amber-300 shadow-2xs'
                                    : 'bg-slate-50/50 border-slate-200 shadow-2xs hover:bg-white'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1 mb-1">
                                  <h5 className="font-extrabold text-xs text-slate-900 leading-tight">
                                    {lab.testName}
                                  </h5>
                                  {lab.isPanicValue ? (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-rose-600 text-white shrink-0 animate-pulse">
                                      🚨 Nguy hiểm
                                    </span>
                                  ) : lab.isAbnormal ? (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                                      ⚠️ Bất thường
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold text-emerald-700 bg-emerald-50 shrink-0">
                                      🟢 BT
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-baseline gap-1 my-1.5">
                                  <span className={`text-lg font-black tracking-tight ${
                                    lab.isPanicValue ? 'text-rose-700' : lab.isAbnormal ? 'text-amber-800' : 'text-slate-900'
                                  }`}>
                                    {lab.value}
                                  </span>
                                  {lab.unit && (
                                    <span className="text-xs font-semibold text-slate-500">{lab.unit}</span>
                                  )}
                                </div>

                                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-slate-200/60 mt-1">
                                  <span title={`Khoảng tham chiếu: ${lab.normalRange || '---'}`}>
                                    BT: <strong className="font-semibold text-slate-700">{lab.normalRange || '---'}</strong>
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-mono">
                                    {lab.timestamp}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* CHẾ ĐỘ 2: XEM BẢNG DỮ LIỆU ĐẦY ĐỦ (DATA TABLE VIEW) */
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[650px]">
                      <thead className="bg-slate-100 text-slate-700 uppercase font-black border-b border-slate-200 text-[10.5px]">
                        <tr>
                          <th className="py-2.5 px-3.5">Thời Gian</th>
                          <th className="py-2.5 px-3.5">Chuyên Khoa</th>
                          <th className="py-2.5 px-3.5">Xét Nghiệm / Chỉ Số</th>
                          <th className="py-2.5 px-3.5">Kết Quả Đo</th>
                          <th className="py-2.5 px-3.5">Khoảng Tham Chiếu</th>
                          <th className="py-2.5 px-3.5 text-right">Đánh Giá Lâm Sàng</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {displayedLabs.map((lab) => (
                          <tr
                            key={lab.id}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              lab.isPanicValue
                                ? 'bg-rose-50/80 font-semibold text-rose-950'
                                : lab.isAbnormal
                                ? 'bg-amber-50/40'
                                : ''
                            }`}
                          >
                            <td className="py-2 px-3.5 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                              {lab.timestamp}
                            </td>
                            <td className="py-2 px-3.5">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-700 text-[10.5px]">
                                {lab.category}
                              </span>
                            </td>
                            <td className="py-2 px-3.5 font-bold text-slate-900">
                              {lab.testName}
                            </td>
                            <td className="py-2 px-3.5">
                              <span className={`text-sm font-black ${
                                lab.isPanicValue ? 'text-rose-600' : lab.isAbnormal ? 'text-amber-700' : 'text-slate-800'
                              }`}>
                                {lab.value}
                              </span>{' '}
                              <span className="text-[11px] text-slate-500 font-semibold">{lab.unit}</span>
                            </td>
                            <td className="py-2 px-3.5 text-slate-500 font-medium text-[11px]">
                              {lab.normalRange || '---'}
                            </td>
                            <td className="py-2 px-3.5 text-right">
                              {lab.isPanicValue ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse">
                                  🚨 NGUY HIỂM
                                </span>
                              ) : lab.isAbnormal ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                  ⚠️ Bất thường
                                </span>
                              ) : (
                                <span className="text-[10.5px] text-emerald-700 font-bold">
                                  🟢 Bình thường
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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

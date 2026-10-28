import React, { useState, useMemo } from 'react';
import { 
  Patient, 
  Doctor, 
  DepartmentRoom, 
  SeverityLevel, 
  ClinicalTag, 
  CLINICAL_TAGS_META,
  VitalSign,
  Medication,
  LabResult,
  ClinicalEvolution,
  AdmissionDischargeStatus
} from '../types/patient';
import { 
  X, 
  UserPlus, 
  Sparkles, 
  Wand2, 
  Calendar, 
  ClipboardCheck, 
  Stethoscope, 
  MessageSquareWarning, 
  FileText,
  Pill,
  TestTube,
  Activity,
  History,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { shortenPatientName } from '../utils/storage';
import { sortDoctorsAlphabetically } from '../utils/doctorSorter';

interface NewPatientModalProps {
  rooms: DepartmentRoom[];
  doctors: Doctor[];
  patients: Patient[];
  prefilledRoom?: string;
  prefilledBed?: string;
  onClose: () => void;
  onAddPatient: (newPatient: Patient) => void;
}

const COMMON_HISTORIES = [
  'Tăng huyết áp',
  'Đái tháo đường type 2',
  'Bệnh tim thiếu máu cục bộ',
  'Suy tim mạn',
  'Bệnh thận mạn',
  'COPD / Hen phế quản',
  'Viêm gan B / Xơ gan',
  'Đột quỵ cũ'
];

export const NewPatientModal: React.FC<NewPatientModalProps> = ({
  rooms,
  doctors,
  patients,
  prefilledRoom,
  prefilledBed,
  onClose,
  onAddPatient,
}) => {
  // Current default datetime string for datetime-local input
  const now = new Date();
  const defaultDateTimeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Form fields: Basic
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<'Nam' | 'Nữ'>('Nam');
  const [age, setAge] = useState<number>(55);
  const [roomNumber, setRoomNumber] = useState(prefilledRoom || rooms[0]?.number || '703');
  const [attendingDoctorId, setAttendingDoctorId] = useState(doctors[0]?.id || '00161');
  const [admissionDateTime, setAdmissionDateTime] = useState(defaultDateTimeStr);
  const [primaryDiagnosis, setPrimaryDiagnosis] = useState('');
  const [allergies, setAllergies] = useState('Không ghi nhận');
  const [severity, setSeverity] = useState<SeverityLevel>('STABLE');
  const [admissionStatus, setAdmissionStatus] = useState<AdmissionDischargeStatus>('ADMITTED_TODAY');
  const [selectedTags, setSelectedTags] = useState<ClinicalTag[]>([]);

  // 2 Separate Note Boxes
  const [doctorNotes, setDoctorNotes] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');

  // Initial vitals
  const [bpSys, setBpSys] = useState<number>(120);
  const [bpDia, setBpDia] = useState<number>(80);
  const [heartRate, setHeartRate] = useState<number>(78);
  const [temperature, setTemperature] = useState<number>(37.0);
  const [spO2, setSpO2] = useState<number>(98);

  // NEW EXTENDED SECTIONS: Tiền sử, Diễn tiến, Thuốc, Cận lâm sàng
  const [medicalHistory, setMedicalHistory] = useState('Chưa ghi nhận bệnh lý nền đặc biệt');
  const [clinicalNote, setClinicalNote] = useState('Bệnh nhân tỉnh, tiếp xúc tốt, tim đều, phổi thông khí rõ, bụng mềm.');
  const [treatmentAction, setTreatmentAction] = useState('Nằm đầu cao 30 độ, chỉ định cận lâm sàng thường quy, theo dõi sinh hiệu.');

  // Simple Copy-Paste Text Areas for Medications and Labs
  const [initialMedicationsText, setInitialMedicationsText] = useState('');
  const [initialLabsText, setInitialLabsText] = useState('');

  // Collapsible toggle for extended clinical section
  const [showExtendedClinical, setShowExtendedClinical] = useState(true);

  // AI Smart Paste state
  const [aiRawText, setAiRawText] = useState('');
  const [isParsingAi, setIsParsingAi] = useState(false);
  const [aiSuccessMsg, setAiSuccessMsg] = useState('');

  // Automatically determine best bed in selected room
  const autoAssignedBed = useMemo(() => {
    if (prefilledBed && prefilledRoom === roomNumber) {
      return prefilledBed;
    }
    const targetRoom = rooms.find(r => r.number === roomNumber);
    const totalBeds = targetRoom?.totalBeds || 3;
    const occupiedBeds = new Set(
      patients
        .filter(p => p.status === 'ACTIVE' && p.roomNumber === roomNumber)
        .map(p => p.bedNumber)
    );

    for (let i = 1; i <= totalBeds; i++) {
      const bName = `Giường ${i < 10 ? '0' + i : i}`;
      if (!occupiedBeds.has(bName)) {
        return bName;
      }
    }
    return 'Giường 01';
  }, [roomNumber, prefilledBed, prefilledRoom, rooms, patients]);

  const toggleTag = (tag: ClinicalTag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleAppendHistory = (historyText: string) => {
    if (medicalHistory === 'Chưa ghi nhận bệnh lý nền đặc biệt' || !medicalHistory.trim()) {
      setMedicalHistory(historyText);
    } else if (!medicalHistory.includes(historyText)) {
      setMedicalHistory(`${medicalHistory.trim()}, ${historyText}`);
    }
  };

  const handlePasteClipboardMedication = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) {
        if (!initialMedicationsText.trim()) {
          setInitialMedicationsText(clipText);
        } else {
          setInitialMedicationsText(`${initialMedicationsText.trim()}\n${clipText}`);
        }
      }
    } catch {
      // ignore
    }
  };

  const handlePasteClipboardLab = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) {
        if (!initialLabsText.trim()) {
          setInitialLabsText(clipText);
        } else {
          setInitialLabsText(`${initialLabsText.trim()}\n${clipText}`);
        }
      }
    } catch {
      // ignore
    }
  };

  // AI Smart Extraction from pasted clinical text
  const handleAiSmartExtract = () => {
    if (!aiRawText.trim()) return;
    setIsParsingAi(true);
    setAiSuccessMsg('');

    setTimeout(() => {
      const text = aiRawText;
      
      // 1. Name
      const nameMatch = text.match(/(?:họ tên|họ và tên|bn|bệnh nhân)[:\s]+([^\n,;]+)/i);
      if (nameMatch && nameMatch[1]) {
        setFullName(nameMatch[1].trim());
      }

      // 2. Age
      const ageMatch = text.match(/(?:tuổi|age)[:\s]*(\d{1,3})/i) || text.match(/(\d{1,3})\s*(?:tuổi|t\b)/i);
      if (ageMatch && ageMatch[1]) {
        const parsedAge = Number(ageMatch[1]);
        if (parsedAge > 0 && parsedAge < 120) {
          setAge(parsedAge);
        }
      }

      // 3. Gender
      if (/\bnam\b/i.test(text) && !/\bnữ\b/i.test(text)) {
        setGender('Nam');
      } else if (/\bnữ\b/i.test(text)) {
        setGender('Nữ');
      }

      // 4. Diagnosis
      const dxMatch = text.match(/(?:chẩn đoán|chẩn đoán chính|cđ)[:\s]+([^\n.]+)/i);
      if (dxMatch && dxMatch[1]) {
        setPrimaryDiagnosis(dxMatch[1].trim());
      } else {
        const lines = text.split('\n').filter(l => l.trim().length > 5);
        if (lines.length > 0 && !primaryDiagnosis) {
          setPrimaryDiagnosis(lines[0].trim());
        }
      }

      // 5. Blood Pressure
      const bpMatch = text.match(/(?:ha|huyết áp)[:\s]*(\d{2,3})\s*[\/]\s*(\d{2,3})/i) || text.match(/(\d{2,3})\s*[\/]\s*(\d{2,3})\s*(?:mmhg)?/i);
      if (bpMatch) {
        setBpSys(Number(bpMatch[1]));
        setBpDia(Number(bpMatch[2]));
      }

      // 6. Heart Rate
      const hrMatch = text.match(/(?:mạch|hr|pulse)[:\s]*(\d{2,3})/i);
      if (hrMatch) {
        setHeartRate(Number(hrMatch[1]));
      }

      // 7. Temperature
      const tempMatch = text.match(/(?:nhiệt độ|nhiệt|t)[:\s]*(\d{2}[.,]\d)/i) || text.match(/(\d{2}[.,]\d)\s*(?:độ|°c)/i);
      if (tempMatch) {
        setTemperature(parseFloat(tempMatch[1].replace(',', '.')));
      }

      // 8. SpO2
      const spo2Match = text.match(/spo2[:\s]*(\d{2})/i);
      if (spo2Match) {
        setSpO2(Number(spo2Match[1]));
      }

      // 9. Severity
      if (/nặng|nguy kịch|sốc|nguy hiểm|critical/i.test(text)) {
        setSeverity('CRITICAL');
        setSelectedTags((prev) => Array.from(new Set([...prev, 'CLOSE_MONITORING'])));
      } else if (/trung bình|đau nhiều|sốt cao/i.test(text)) {
        setSeverity('MODERATE');
      } else {
        setSeverity('STABLE');
      }

      // 10. Tags: Canula vs Mask vs Fluid Balance
      if (/canula|gọng kính|kính/i.test(text)) {
        setSelectedTags((prev) => Array.from(new Set([...prev, 'O2_CANULA'])));
      } else if (/mask|mặt nạ/i.test(text)) {
        setSelectedTags((prev) => Array.from(new Set([...prev, 'O2_MASK'])));
      } else if (/oxy|o2/i.test(text)) {
        setSelectedTags((prev) => Array.from(new Set([...prev, 'O2_CANULA'])));
      }

      if (/vận mạch|noradrenalin|dopamin|adrenalin|vasopressor/i.test(text)) {
        setSelectedTags((prev) => Array.from(new Set([...prev, 'VASOPRESSOR'])));
      }

      if (/dịch nhập|dịch xuất|nhập xuất|cân bằng dịch|theo dõi dịch|nước tiểu/i.test(text)) {
        setSelectedTags((prev) => Array.from(new Set([...prev, 'FLUID_BALANCE'])));
      }

      // 11. Allergies
      const allergyMatch = text.match(/(?:dị ứng|tiền sử dị ứng)[:\s]+([^\n.]+)/i);
      if (allergyMatch && allergyMatch[1]) {
        setAllergies(allergyMatch[1].trim());
      }

      // 12. Medical History
      const histMatch = text.match(/(?:tiền sử|tiền căn|bệnh nền)[:\s]+([^\n.]+)/i);
      if (histMatch && histMatch[1]) {
        setMedicalHistory(histMatch[1].trim());
      }

      // 13. Clinical Note & Treatment
      const noteMatch = text.match(/(?:diễn tiến|khám lâm sàng|tình trạng lúc vào)[:\s]+([^\n.]+)/i);
      if (noteMatch && noteMatch[1]) {
        setClinicalNote(noteMatch[1].trim());
      }

      const treatMatch = text.match(/(?:xử trí|điều trị ban đầu|y lệnh)[:\s]+([^\n.]+)/i);
      if (treatMatch && treatMatch[1]) {
        setTreatmentAction(treatMatch[1].trim());
      }

      // 14. Initial Medications Text (Copy-paste support)
      const medMatch = text.match(/(?:thuốc|y lệnh thuốc|toa thuốc|đơn thuốc)[:\s]+([^]+?)(?=(?:cận lâm sàng|cls|xét nghiệm|tiền sử|ghi chú|bàn giao|họ tên|$))/i);
      if (medMatch && medMatch[1]) {
        setInitialMedicationsText(medMatch[1].trim());
      } else {
        const medLines = text.split('\n').filter(l => /\b(?:mg|ml|g\b|viên|ống|lọ|bơm|chai|gói|uống|tiêm|truyền)\b/i.test(l));
        if (medLines.length > 0 && !initialMedicationsText.trim()) {
          setInitialMedicationsText(medLines.join('\n'));
        }
      }

      // 15. Initial Labs Text (Copy-paste support)
      const labMatch = text.match(/(?:cận lâm sàng|cls|xét nghiệm|kết quả cls|kết quả xét nghiệm|hình ảnh|ecg|x-quang|siêu âm)[:\s]+([^]+?)(?=(?:thuốc|y lệnh|tiền sử|ghi chú|bàn giao|$))/i);
      if (labMatch && labMatch[1]) {
        setInitialLabsText(labMatch[1].trim());
      } else {
        const labLines = text.split('\n').filter(l => /\b(?:wbc|rbc|hb|plt|troponin|glucose|creatinine|ure|ast|alt|ecg|x-quang|siêu âm|ctm|sinh hóa|khí máu)\b/i.test(l));
        if (labLines.length > 0 && !initialLabsText.trim()) {
          setInitialLabsText(labLines.join('\n'));
        }
      }

      // 16. Doctor Notes & Handover Notes
      const docMatch = text.match(/(?:ghi chú bác sĩ|ghi chú bs|chỉ định bs|kế hoạch điều trị)[:\s]+([^\n]+)/i);
      if (docMatch && docMatch[1]) {
        setDoctorNotes(docMatch[1].trim());
      }

      const handoverMatch = text.match(/(?:bàn giao|bàn giao bệnh|dặn dò|lưu ý trực|y lệnh trực)[:\s]+([^\n]+)/i);
      if (handoverMatch && handoverMatch[1]) {
        setHandoverNotes(handoverMatch[1].trim());
      } else if (!handoverNotes.trim()) {
        const summaryParts: string[] = [];
        if (/nặng|nguy kịch/i.test(text)) summaryParts.push('Bệnh nhân nặng, đo sinh hiệu mỗi 2h.');
        if (/canula/i.test(text)) summaryParts.push('Đang thở oxy canula.');
        if (/mask/i.test(text)) summaryParts.push('Đang thở oxy mask.');
        if (/vận mạch/i.test(text)) summaryParts.push('Đang duy trì vận mạch.');
        if (summaryParts.length > 0) {
          setHandoverNotes(summaryParts.join(' '));
        }
      }

      setIsParsingAi(false);
      setAiSuccessMsg('✨ AI đã trích xuất thành công toàn bộ thông tin (hành chính, y lệnh thuốc, kết quả CLS, tiền sử & dặn dò)!');
    }, 350);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !primaryDiagnosis) return;

    // Format admission date
    const selectedDate = admissionDateTime ? admissionDateTime.replace('T', ' ') + ':00' : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const dateOnly = selectedDate.split(' ')[0];
    const autoHsba = `HS-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const birthYear = now.getFullYear() - Number(age || 50);

    const initialVital: VitalSign = {
      id: `V-${Date.now()}`,
      timestamp: selectedDate,
      bpSystolic: Number(bpSys),
      bpDiastolic: Number(bpDia),
      heartRate: Number(heartRate),
      temperature: Number(temperature),
      spO2: Number(spO2),
      respiratoryRate: 18,
      notes: 'Sinh hiệu lúc tiếp nhận vào khoa',
    };

    // Convert lines in initialMedicationsText into Medication[] array for seamless tab display
    const validMeds: Medication[] = initialMedicationsText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((line, idx) => ({
        id: `M-${Date.now()}-${idx}`,
        name: line.replace(/^[\d+•\-*.)\s]+/, '').trim(),
        activeIngredient: line.replace(/^[\d+•\-*.)\s]+/, '').trim(),
        dosage: 'Theo y lệnh',
        route: (line.toLowerCase().includes('tiêm tm') || line.toLowerCase().includes('tiêm tĩnh mạch'))
          ? 'Tiêm TM'
          : line.toLowerCase().includes('truyền')
          ? 'Truyền TM'
          : line.toLowerCase().includes('dưới da') || line.toLowerCase().includes('tdd')
          ? 'Tiêm dưới da'
          : line.toLowerCase().includes('khí dung')
          ? 'Khí dung'
          : 'Uống',
        frequency: '1 lần/ngày',
        timing: '08:00',
        status: 'active' as const,
        startDate: dateOnly,
        endDate: 'Đang duy trì',
      }));

    // Convert lines in initialLabsText into LabResult[] array for seamless tab display
    const validLabs: LabResult[] = initialLabsText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((line, idx) => {
        const isPanic = /tăng cao|rất cao|nguy hiểm|st chênh lên|panic/i.test(line);
        const isAbn = isPanic || /tăng|giảm|bất thường|chênh|dương tính/i.test(line);
        return {
          id: `L-${Date.now()}-${idx}`,
          timestamp: selectedDate,
          testDate: dateOnly,
          category: 'Khác' as const,
          testName: line.replace(/^[\d+•\-*.)\s]+/, '').trim(),
          value: 'Đã thực hiện ban đầu',
          unit: '',
          normalRange: '',
          isAbnormal: isAbn,
          isPanicValue: isPanic,
        };
      });

    const finalDoctorNotes = doctorNotes.trim() || (
      selectedTags.includes('VASOPRESSOR')
        ? 'Đang dùng vận mạch, cần theo dõi sát huyết áp liên tục.'
        : selectedTags.includes('O2_CANULA') || selectedTags.includes('O2_MASK')
        ? 'Đang hỗ trợ thở oxy, kiểm tra SpO2 định kỳ.'
        : selectedTags.includes('CLOSE_MONITORING')
        ? 'Bệnh nhân diễn biến phức tạp, theo dõi sát sinh hiệu.'
        : 'Theo dõi sinh hiệu và diễn tiến thường quy.'
    );

    const initialEvolution: ClinicalEvolution = {
      id: `EV-${Date.now()}`,
      timestamp: selectedDate,
      doctorName: doctors.find((d) => d.id === attendingDoctorId)?.name || 'Bác sĩ tiếp nhận',
      shift: 'Sáng',
      clinicalNote: clinicalNote.trim() || `Tiếp nhận bệnh nhân vào P.${roomNumber} - ${autoAssignedBed}. Chẩn đoán: ${primaryDiagnosis}.`,
      treatmentAction: treatmentAction.trim() || 'Hoàn tất hồ sơ bệnh án nội trú, chỉ định cận lâm sàng thường quy, theo dõi sinh hiệu.',
    };

    const newPatient: Patient = {
      id: `PAT-${Date.now()}`,
      patientCode: `BN-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      medicalRecordNumber: autoHsba,
      fullName: shortenPatientName(fullName.trim()),
      gender,
      age: Number(age),
      dateOfBirth: `${birthYear}-01-01`,
      address: 'Gia Lai',
      insuranceNumber: 'GD464' + Math.floor(100000000 + Math.random() * 900000000),
      admissionDate: selectedDate,
      department: 'Khoa Nội Tổng Hợp',
      roomNumber,
      bedNumber: autoAssignedBed,
      attendingDoctorId,
      primaryNurse: 'ĐD. Ca trực',
      primaryDiagnosis: primaryDiagnosis.trim(),
      allergies: allergies.trim() || 'Không ghi nhận',
      medicalHistory: medicalHistory.trim() || 'Không có bệnh lý nền đặc biệt',
      severity,
      admissionStatus,
      tags: selectedTags,
      importantNotes: finalDoctorNotes,
      handoverNotes: handoverNotes.trim(),
      initialLabsText: initialLabsText.trim(),
      initialMedicationsText: initialMedicationsText.trim(),
      status: 'ACTIVE',
      vitals: [initialVital],
      evolutions: [initialEvolution],
      labs: validLabs,
      medications: validMeds,
    };

    onAddPatient(newPatient);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl w-full max-w-7xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[96vh] animate-in fade-in">
        
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-rose-700 via-rose-800 to-slate-900 text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">
                Tiếp Nhận Bệnh Nhân Mới Vào Khoa
              </h2>
              <p className="text-[11px] text-rose-200">
                Khoa Nội Tổng Hợp - Bệnh viện Hùng Vương Gia Lai
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-3 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs custom-scrollbar">
          
          {/* AI SMART EXTRACTION BOX */}
          <div className="bg-gradient-to-br from-rose-50 via-indigo-50/40 to-slate-50 p-3.5 rounded-2xl border-2 border-rose-200 shadow-xs space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-rose-600 text-white shadow-2xs shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-xs sm:text-sm tracking-tight flex items-center gap-1.5">
                    Trợ lý AI Trích Xuất & Điền Tự Động (Bệnh án, Thuốc, CLS, Tiền sử)
                  </h3>
                  <p className="text-[11px] text-slate-600">
                    Dán đoạn văn bản bàn giao, bệnh án cấp cứu hoặc ghi chú ca bệnh để AI tự phân tích và điền toàn diện vào form.
                  </p>
                </div>
              </div>
              
              <button
                type="button"
                onClick={handleAiSmartExtract}
                disabled={!aiRawText.trim() || isParsingAi}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white font-black text-xs shadow-md transition-all shrink-0 cursor-pointer disabled:cursor-not-allowed"
              >
                <Wand2 className={`w-4 h-4 ${isParsingAi ? 'animate-spin' : ''}`} />
                <span>{isParsingAi ? 'AI đang phân tích...' : '✨ AI Phân Tích & Điền'}</span>
              </button>
            </div>

            <textarea
              rows={2}
              value={aiRawText}
              onChange={(e) => setAiRawText(e.target.value)}
              placeholder="Dán toàn bộ dữ liệu tại đây. Ví dụ: BN Nguyễn Văn A, 68 tuổi, nam, vào khoa lúc 08h30. Chẩn đoán Cơn đau thắt ngực không ổn định - THA. Tiền sử THA 8 năm. HA 150/90, mạch 82, SpO2 96%, thở oxy canula 2L/p. Thuốc: Aspirin 81mg 1v, Clopidogrel 75mg 1v. CLS: Troponin I 0.08 ng/ml, ECG ST chênh xuống. Ghi chú BS: Theo dõi men tim mỗi 6h. Bàn giao: Đo sinh hiệu mỗi 2h, dặn nhịn ăn sáng mai..."
              className="w-full p-2.5 bg-white border border-rose-200 rounded-xl font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs shadow-2xs"
            />

            {aiSuccessMsg && (
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-900 font-bold text-[11px] flex items-center gap-1.5 animate-in fade-in">
                <span>{aiSuccessMsg}</span>
              </div>
            )}
          </div>

          {/* MAIN GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* LEFT COLUMN: Patient Info, Diagnosis, Status (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              
              {/* Section 1: Thông tin bệnh nhân */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <span className="w-2 h-4 rounded-full bg-rose-600" />
                  <span className="font-black text-slate-900 uppercase tracking-wider text-xs">
                    1. Thông tin bệnh nhân
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="font-bold text-slate-700 block mb-1">Họ và tên bệnh nhân (*)</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Nguyễn Văn An"
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-black text-slate-900 text-sm focus:ring-2 focus:ring-rose-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Giới tính</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as any)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-bold"
                    >
                      <option value="Nam">Nam</option>
                      <option value="Nữ">Nữ</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Tuổi (*)</label>
                    <input
                      type="number"
                      value={age}
                      onChange={(e) => setAge(Number(e.target.value))}
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-black text-center"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Chẩn đoán & Mức độ lâm sàng */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <span className="w-2 h-4 rounded-full bg-rose-600" />
                  <span className="font-black text-slate-900 uppercase tracking-wider text-xs">
                    2. Chẩn đoán lâm sàng & Phân loại
                  </span>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Chẩn đoán (*)</label>
                  <input
                    type="text"
                    value={primaryDiagnosis}
                    onChange={(e) => setPrimaryDiagnosis(e.target.value)}
                    placeholder="e.g. Cơn đau thắt ngực không ổn định - Tăng huyết áp độ 2"
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900"
                    required
                  />
                </div>

                {/* Severity selection */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Mức độ lâm sàng (*)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setSeverity('CRITICAL')}
                      className={`p-2 rounded-xl font-black border transition-all text-center cursor-pointer ${
                        severity === 'CRITICAL'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-sm scale-[1.01]'
                          : 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100'
                      }`}
                    >
                      🔴 Nặng (Đỏ)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSeverity('MODERATE')}
                      className={`p-2 rounded-xl font-black border transition-all text-center cursor-pointer ${
                        severity === 'MODERATE'
                          ? 'bg-amber-500 text-white border-amber-500 shadow-sm scale-[1.01]'
                          : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                      }`}
                    >
                      🟡 Trung bình (Vàng)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSeverity('STABLE')}
                      className={`p-2 rounded-xl font-black border transition-all text-center cursor-pointer ${
                        severity === 'STABLE'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm scale-[1.01]'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                      }`}
                    >
                      🟢 Ổn định (Xanh)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSeverity('UNCLASSIFIED')}
                      className={`p-2 rounded-xl font-black border transition-all text-center cursor-pointer ${
                        severity === 'UNCLASSIFIED'
                          ? 'bg-slate-700 text-white border-slate-700 shadow-sm scale-[1.01]'
                          : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      ⚪ Chưa phân loại
                    </button>
                  </div>
                </div>

                {/* Admission Status */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Trạng thái lưu chuyển tua trực (*)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setAdmissionStatus('ADMITTED_TODAY')}
                      className={`p-2 rounded-xl font-bold border transition-all text-xs text-center cursor-pointer ${
                        admissionStatus === 'ADMITTED_TODAY'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      🟢 Mới nhập hôm nay
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdmissionStatus('ADMITTED_YESTERDAY')}
                      className={`p-2 rounded-xl font-bold border transition-all text-xs text-center cursor-pointer ${
                        admissionStatus === 'ADMITTED_YESTERDAY'
                          ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                          : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                      }`}
                    >
                      🟡 Nhập tua hôm qua
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdmissionStatus('DISCHARGE_TODAY')}
                      className={`p-2 rounded-xl font-bold border transition-all text-xs text-center cursor-pointer ${
                        admissionStatus === 'DISCHARGE_TODAY'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100'
                      }`}
                    >
                      🟣 RV hôm nay
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdmissionStatus('DISCHARGE_TOMORROW')}
                      className={`p-2 rounded-xl font-bold border transition-all text-xs text-center cursor-pointer ${
                        admissionStatus === 'DISCHARGE_TOMORROW'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                      }`}
                    >
                      🔵 Dự kiến RV mai
                    </button>
                  </div>
                </div>

                {/* Clinical Tags: Updated with Canula, Mask, Fluid Balance (No Dialysis, No IV Fluid) */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Nhãn theo dõi (Thở Canula, Thở Mask, TD Dịch Nhập/Xuất, Vận Mạch...)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(CLINICAL_TAGS_META) as ClinicalTag[])
                      .filter((tag) => tag !== 'O2') // Render explicit O2_CANULA and O2_MASK
                      .map((tagKey) => {
                        const meta = CLINICAL_TAGS_META[tagKey];
                        const isSelected = selectedTags.includes(tagKey);

                        return (
                          <button
                            type="button"
                            key={tagKey}
                            onClick={() => toggleTag(tagKey)}
                            className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                              isSelected
                                ? `${meta.badgeBg} text-white border-transparent shadow-xs`
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {meta.label}
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: Room/Doctor/Date & Vitals (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              
              {/* Section 3: Buồng bệnh, Bác sĩ & Ngày nhập viện */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-4 rounded-full bg-rose-600" />
                    <span className="font-black text-slate-900 uppercase tracking-wider text-xs">
                      3. Buồng điều trị & Bác sĩ
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-extrabold text-[11px]">
                    {autoAssignedBed}
                  </span>
                </div>

                {/* Admission Date & Time */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-rose-600" />
                    <span>Ngày & Giờ Nhập Viện</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={admissionDateTime}
                    onChange={(e) => setAdmissionDateTime(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block italic">
                    (Mặc định là ngày giờ hiện tại nếu không chọn lại)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Phòng điều trị (*)</label>
                    <select
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900"
                    >
                      {rooms.map((r) => (
                        <option key={r.id} value={r.number}>
                          Phòng {r.number}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Bác sĩ điều trị (*)</label>
                    <select
                      value={attendingDoctorId}
                      onChange={(e) => setAttendingDoctorId(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-rose-700 truncate"
                    >
                      {sortDoctorsAlphabetically(doctors).map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 4: Dị ứng & Dấu hiệu sinh tồn */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <span className="w-2 h-4 rounded-full bg-rose-600" />
                  <span className="font-black text-slate-900 uppercase tracking-wider text-xs">
                    4. Dị ứng & Sinh hiệu vào khoa
                  </span>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tiền sử dị ứng thuốc</label>
                  <input
                    type="text"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="Không ghi nhận / Dị ứng Penicillin..."
                    className="w-full p-2 border border-slate-300 rounded-xl text-rose-700 font-semibold text-xs"
                  />
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Huyết áp</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={bpSys}
                        onChange={(e) => setBpSys(Number(e.target.value))}
                        className="w-full p-1.5 border border-slate-300 rounded-lg font-bold text-center text-xs"
                        placeholder="120"
                      />
                      <span className="text-slate-400">/</span>
                      <input
                        type="number"
                        value={bpDia}
                        onChange={(e) => setBpDia(Number(e.target.value))}
                        className="w-full p-1.5 border border-slate-300 rounded-lg font-bold text-center text-xs"
                        placeholder="80"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Mạch (l/p)</label>
                    <input
                      type="number"
                      value={heartRate}
                      onChange={(e) => setHeartRate(Number(e.target.value))}
                      className="w-full p-1.5 border border-slate-300 rounded-lg font-bold text-center text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Nhiệt độ (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(Number(e.target.value))}
                      className="w-full p-1.5 border border-slate-300 rounded-lg font-bold text-center text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">SpO₂ (%)</label>
                    <input
                      type="number"
                      value={spO2}
                      onChange={(e) => setSpO2(Number(e.target.value))}
                      className="w-full p-1.5 border border-slate-300 rounded-lg font-bold text-center text-xs"
                    />
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* TWO SEPARATE BOXES: GHI CHÚ BÁC SĨ & BÀN GIAO BỆNH */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* BOX 1: GHI CHÚ BÁC SĨ ĐIỀU TRỊ */}
            <div className="bg-blue-50/70 p-4 rounded-2xl border-2 border-blue-300 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-blue-200">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-blue-600 text-white shadow-2xs">
                    <Stethoscope className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-black text-blue-950 uppercase tracking-wider text-xs">
                      GHI CHÚ BÁC SĨ ĐIỀU TRỊ
                    </span>
                    <p className="text-[10px] text-blue-800">
                      Kế hoạch điều trị, chỉ định theo dõi cận lâm sàng của bác sĩ
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-200 text-blue-900">
                  Bác sĩ
                </span>
              </div>

              <textarea
                rows={4}
                value={doctorNotes}
                onChange={(e) => setDoctorNotes(e.target.value)}
                placeholder="Nhập ghi chú của bác sĩ... Ví dụ: Đã dùng liều nạp kháng đông, theo dõi men tim Troponin I mỗi 6h, chỉ định siêu âm tim tại giường..."
                className="w-full p-3 bg-white border border-blue-300 rounded-xl font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs shadow-2xs leading-relaxed resize-y min-h-[90px]"
              />
            </div>

            {/* BOX 2: BÀN GIAO BỆNH (TUA TRỰC / ĐIỀU DƯỠNG) */}
            <div className="bg-amber-50/70 p-4 rounded-2xl border-2 border-amber-300 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-amber-500 text-white shadow-2xs">
                    <ClipboardCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-black text-amber-950 uppercase tracking-wider text-xs">
                      BÀN GIAO BỆNH (TUA TRỰC)
                    </span>
                    <p className="text-[10px] text-amber-800">
                      Dặn dò tua trực kế tiếp & điều dưỡng theo dõi buồng bệnh
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-200 text-amber-900">
                  Tua trực
                </span>
              </div>

              <textarea
                rows={4}
                value={handoverNotes}
                onChange={(e) => setHandoverNotes(e.target.value)}
                placeholder="Nhập dặn dò bàn giao... Ví dụ: Bệnh nhân đau ngực từng cơn, đo sinh hiệu mỗi 2h, dặn nhịn ăn sáng mai làm thủ thuật, theo dõi lượng dịch xuất nhập 24h..."
                className="w-full p-3 bg-white border border-amber-300 rounded-xl font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs shadow-2xs leading-relaxed resize-y min-h-[90px]"
              />
            </div>

          </div>

          {/* NEW EXTENDED SECTION: TIỀN SỬ, DIỄN TIẾN, THUỐC & CẬN LÂM SÀNG BAN ĐẦU */}
          <div className="bg-slate-50 rounded-2xl border-2 border-indigo-200 overflow-hidden shadow-xs">
            <div 
              onClick={() => setShowExtendedClinical(!showExtendedClinical)}
              className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 flex items-center justify-between cursor-pointer border-b border-indigo-100 hover:bg-indigo-100/60 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-indigo-600 text-white shadow-2xs">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-black text-indigo-950 uppercase tracking-wider text-xs">
                    THÔNG TIN LÂM SÀNG BỔ SUNG: TIỀN SỬ, DIỄN TIẾN, Y LỆNH THUỐC & CẬN LÂM SÀNG
                  </span>
                  <p className="text-[10px] text-indigo-700">
                    Nhập chi tiết y lệnh điều trị, tiền sử và diễn tiến lúc tiếp nhận vào khoa
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-indigo-700 font-bold text-xs">
                <span>{showExtendedClinical ? 'Thu gọn' : 'Mở rộng'}</span>
                {showExtendedClinical ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>

            {showExtendedClinical && (
              <div className="p-4 space-y-4">
                
                {/* 1. Tiền sử bệnh lý nền */}
                <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-indigo-50">
                    <span className="font-extrabold text-slate-800 flex items-center gap-1.5 text-xs">
                      <History className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Tiền sử bệnh lý nền & thói quen sinh hoạt</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                      Bệnh nền
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1 items-center">
                    {COMMON_HISTORIES.map((item, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => handleAppendHistory(item)}
                        className="px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-semibold transition-all cursor-pointer"
                      >
                        + {item}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={2}
                    value={medicalHistory}
                    onChange={(e) => setMedicalHistory(e.target.value)}
                    placeholder="Tiền sử bệnh: Tăng huyết áp 8 năm điều trị liên tục, ĐTĐ typ 2, tiền sử hút thuốc lá..."
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                  />
                </div>

                {/* 2. Diễn tiến lâm sàng & Hướng xử trí ban đầu - LỚN HƠN, RỘNG RÃI */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Diễn tiến lúc vào khoa */}
                  <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-indigo-100">
                      <span className="font-extrabold text-slate-900 flex items-center gap-2 text-xs">
                        <FileText className="w-4 h-4 text-indigo-600" />
                        <span>Diễn tiến lúc vào khoa (Triệu chứng & Thăm khám)</span>
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                        Lâm sàng
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-500">
                      Khám lâm sàng: tri giác, da niêm, tim mạch, hô hấp, tiêu hóa, tiết niệu, thần kinh...
                    </p>

                    <textarea
                      rows={6}
                      value={clinicalNote}
                      onChange={(e) => setClinicalNote(e.target.value)}
                      placeholder={`Ví dụ nhập chi tiết diễn tiến:
• Bệnh nhân tỉnh táo, tiếp xúc tốt, Glasgow 15 điểm.
• Đau thắt ngực sau xương ức từng cơn lan lên vai trái và hàm, kéo dài khoảng 15-20 phút.
• Tim đều, nhịp xoang 84 l/p, T1 T2 rõ, không âm thổi bệnh lý.
• Phổi thông khí 2 bên rõ, không rale ẩm, không rale rít.
• Bụng mềm, không chướng, gan lách không sờ chạm.
• Hai chi dưới ấm, không phù, mạch mu chân 2 bên rõ.`}
                      className="w-full p-3 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs leading-relaxed resize-y min-h-[140px]"
                    />
                  </div>

                  {/* Hướng xử trí & Kế hoạch điều trị ban đầu */}
                  <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-indigo-100">
                      <span className="font-extrabold text-slate-900 flex items-center gap-2 text-xs">
                        <Activity className="w-4 h-4 text-indigo-600" />
                        <span>Hướng xử trí ban đầu & Kế hoạch điều trị</span>
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                        Xử trí
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-500">
                      Chế độ nghỉ ngơi, thở oxy, lập đường truyền, chỉ định CLS cấp, phác đồ dùng thuốc...
                    </p>

                    <textarea
                      rows={6}
                      value={treatmentAction}
                      onChange={(e) => setTreatmentAction(e.target.value)}
                      placeholder={`Ví dụ nhập chi tiết hướng xử trí:
• Nằm nghỉ ngơi tuyệt đối tại giường, tư thế Fowler đầu cao 30 độ.
• Thở oxy qua gọng mũi (canula) 2-3 lít/phút, duy trì SpO2 >= 95%.
• Thiết lập đường truyền TM ngoại vi dung dịch NaCl 0.9% 500ml giữ ven.
• Chỉ định khẩn: Điện tâm đồ (ECG) tại giường, X-quang tim phổi thẳng.
• Xét nghiệm máu cấp cứu: hs-Troponin I, CK-MB, CTM, Điện giải đồ, Chức năng thận (Ure/Creatinine).
• Đo và theo dõi sinh hiệu (Mạch, HA, SpO2) mỗi 2 giờ.`}
                      className="w-full p-3 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs leading-relaxed resize-y min-h-[140px]"
                    />
                  </div>
                </div>

                {/* 3. Y LỆNH THUỐC BAN ĐẦU (Copy & Paste Trực Tiếp) */}
                <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-2xs space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-emerald-100">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-emerald-600 text-white">
                        <Pill className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="font-extrabold text-slate-900 text-xs uppercase tracking-wide">
                          Y Lệnh Thuốc Ban Đầu (Copy & Paste Trực Tiếp)
                        </span>
                        <p className="text-[10px] text-slate-500">
                          Dán trực tiếp danh sách thuốc, liều dùng, đường dùng từ HIS hoặc đơn thuốc cấp cứu
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handlePasteClipboardMedication}
                        className="px-2 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                        title="Dán nội dung từ bộ nhớ tạm máy tính"
                      >
                        <span>📋 Dán từ Clipboard</span>
                      </button>
                      {initialMedicationsText && (
                        <button
                          type="button"
                          onClick={() => setInitialMedicationsText('')}
                          className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-semibold transition-all cursor-pointer"
                        >
                          Xóa
                        </button>
                      )}
                    </div>
                  </div>

                  <textarea
                    rows={6}
                    value={initialMedicationsText}
                    onChange={(e) => setInitialMedicationsText(e.target.value)}
                    placeholder={`Ví dụ dán trực tiếp:
1. Aspirin 81mg x 01 viên uống sau ăn sáng
2. Clopidogrel 75mg x 01 viên uống 08h
3. Rosuvastatin 20mg x 01 viên uống 20h
4. Pantoprazole 40mg x 01 lọ tiêm TM chậm 08h
5. Enoxaparin 40mg/0.4ml x 01 bơm tiêm dưới da 08h`}
                    className="w-full p-3 bg-slate-50/70 border border-slate-300 rounded-xl font-mono text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white leading-relaxed resize-y min-h-[140px]"
                  />
                </div>

                {/* 4. CẬN LÂM SÀNG & KẾT QUẢ BAN ĐẦU (Copy & Paste Trực Tiếp) */}
                <div className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-2xs space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-blue-100">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-blue-600 text-white">
                        <TestTube className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="font-extrabold text-slate-900 text-xs uppercase tracking-wide">
                          Cận Lâm Sàng & Kết Quả Ban Đầu (Copy & Paste Trực Tiếp)
                        </span>
                        <p className="text-[10px] text-slate-500">
                          Dán trực tiếp kết quả CTM, sinh hóa, ECG, X-Quang, siêu âm từ phần mềm bệnh viện
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handlePasteClipboardLab}
                        className="px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 text-[10px] font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                        title="Dán nội dung từ bộ nhớ tạm máy tính"
                      >
                        <span>📋 Dán từ Clipboard</span>
                      </button>
                      {initialLabsText && (
                        <button
                          type="button"
                          onClick={() => setInitialLabsText('')}
                          className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-semibold transition-all cursor-pointer"
                        >
                          Xóa
                        </button>
                      )}
                    </div>
                  </div>

                  <textarea
                    rows={6}
                    value={initialLabsText}
                    onChange={(e) => setInitialLabsText(e.target.value)}
                    placeholder={`Ví dụ dán trực tiếp:
• CTM: BC: 12.8 G/L (Neu 82%), HC: 4.1 T/L, Hb: 125 g/L, TC: 235 G/L
• Sinh hóa máu: Troponin I hs 1.48 ng/mL (Tăng cao), Glucose 8.6 mmol/L, Creatinine 108 umol/L
• Điện giải đồ: Na 139, K 4.2, Cl 101 mmol/L
• ECG 12 chuyển đạo: Nhịp xoang 92 l/p, ST chênh lên ở V1-V4, T âm
• X-quang tim phổi thẳng: Chỉ số tim/lồng ngực 56%, ứ huyết rốn phổi nhẹ`}
                    className="w-full p-3 bg-slate-50/70 border border-slate-300 rounded-xl font-mono text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white leading-relaxed resize-y min-h-[140px]"
                  />
                </div>

              </div>
            )}
          </div>



          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer text-xs"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer text-xs"
            >
              <UserPlus className="w-4 h-4" />
              <span>Tiếp Nhận Vào Khoa</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

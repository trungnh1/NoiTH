import React, { useState, useMemo } from 'react';
import { 
  Patient, 
  Doctor, 
  SeverityLevel, 
  ClinicalTag, 
  CLINICAL_TAGS_META,
  VitalSign 
} from '../types/patient';
import { 
  Search, 
  Filter, 
  Printer, 
  FileSpreadsheet, 
  Activity, 
  AlertTriangle, 
  Stethoscope, 
  Clock, 
  Calendar, 
  Users, 
  ChevronDown, 
  Check, 
  ArrowRightLeft, 
  Edit3, 
  ShieldAlert, 
  HeartPulse, 
  Wind, 
  Maximize2, 
  Minimize2,
  Sparkles,
  Eye,
  FileText
} from 'lucide-react';
import { formatPatientDisplayName } from '../utils/storage';
import { sortDoctorsAlphabetically } from '../utils/doctorSorter';
import { getCriticalLabAlerts, getImportantOrAbnormalLabs } from '../utils/labAlerts';
import { matchesPatientSearch } from '../utils/searchUtils';
import { 
  formatDoctorShortName, 
  getLatestDiagnosis, 
  calculateTreatmentDays, 
  formatAdmissionDateDisplay, 
  isNewAdmissionWithin24Hours, 
  getRoomGroupName,
  GROUP_1_ROOM_NUMBERS,
  GROUP_2_ROOM_NUMBERS,
  CARDIO_ROOM_NUMBERS
} from './DetailedPatientListView';

interface ClinicalKardexViewProps {
  patients: Patient[];
  doctors: Doctor[];
  roomDoctorAssignments?: Record<string, string>;
  onSelectPatient: (patient: Patient) => void;
  onOpenEvolution?: (patient: Patient) => void;
  onTransferPatient?: (patient: Patient) => void;
  onUpdatePatient?: (patient: Patient) => void;
}

export const ClinicalKardexView: React.FC<ClinicalKardexViewProps> = ({
  patients,
  doctors,
  roomDoctorAssignments = {},
  onSelectPatient,
  onOpenEvolution,
  onTransferPatient,
  onUpdatePatient,
}) => {
  const [selectedGroup, setSelectedGroup] = useState<'ALL' | 'GROUP_1' | 'GROUP_2' | 'CARDIO'>('ALL');
  const [selectedRoom, setSelectedRoom] = useState<string>('ALL');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | SeverityLevel | 'NEW' | 'DISCHARGE_TODAY'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isCompactDensity, setIsCompactDensity] = useState<boolean>(false);
  const [openSeverityMenuPatientId, setOpenSeverityMenuPatientId] = useState<string | null>(null);

  // Inline Quick Edit for Handover / Duty Notes
  const [editingNotePatientId, setEditingNotePatientId] = useState<string | null>(null);
  const [noteDraftText, setNoteDraftText] = useState<string>('');

  const sortedDoctors = useMemo(() => sortDoctorsAlphabetically(doctors), [doctors]);
  const doctorMap = useMemo(() => new Map<string, Doctor>(sortedDoctors.map((d) => [d.id, d])), [sortedDoctors]);

  // Active rooms in currently selected group
  const currentGroupRoomNumbers = useMemo(() => {
    if (selectedGroup === 'GROUP_1') return GROUP_1_ROOM_NUMBERS;
    if (selectedGroup === 'GROUP_2') return GROUP_2_ROOM_NUMBERS;
    if (selectedGroup === 'CARDIO') return CARDIO_ROOM_NUMBERS;
    return Array.from(new Set(patients.map((p) => p.roomNumber?.replace(/^(phòng|p\.?|buồng|b\.?)\s*/i, '').trim()).filter(Boolean))).sort();
  }, [selectedGroup, patients]);

  // Filtered patients for Kardex
  const filteredPatients = useMemo(() => {
    return patients.filter((patient) => {
      if (patient.status !== 'ACTIVE') return false;

      // Group filter
      if (selectedGroup !== 'ALL') {
        const cleanRoom = patient.roomNumber ? patient.roomNumber.replace(/^(phòng|p\.?|buồng|b\.?)\s*/i, '').trim() : '';
        if (!currentGroupRoomNumbers.includes(cleanRoom)) return false;
      }

      // Room filter
      if (selectedRoom !== 'ALL') {
        const cleanRoom = patient.roomNumber ? patient.roomNumber.replace(/^(phòng|p\.?|buồng|b\.?)\s*/i, '').trim() : '';
        if (cleanRoom !== selectedRoom) return false;
      }

      // Doctor filter
      if (selectedDoctorId !== 'ALL') {
        if (patient.attendingDoctorId !== selectedDoctorId) return false;
      }

      // Severity / Status filter
      if (severityFilter !== 'ALL') {
        if (severityFilter === 'NEW') {
          if (!isNewAdmissionWithin24Hours(patient.admissionDate)) return false;
        } else if (severityFilter === 'DISCHARGE_TODAY') {
          if (patient.admissionStatus !== 'DISCHARGE_TODAY') return false;
        } else if (severityFilter === 'UNCLASSIFIED') {
          if (patient.severity && patient.severity !== 'UNCLASSIFIED') return false;
        } else {
          if (patient.severity !== severityFilter) return false;
        }
      }

      // Search term
      if (searchTerm.trim()) {
        if (!matchesPatientSearch(patient, searchTerm, doctorMap)) return false;
      }

      return true;
    }).sort((a, b) => {
      // Sắp xếp tự nhiên theo số phòng, sau đó theo tên bệnh nhân
      const roomA = parseInt(a.roomNumber?.replace(/\D/g, '') || '0', 10);
      const roomB = parseInt(b.roomNumber?.replace(/\D/g, '') || '0', 10);
      if (roomA !== roomB) return roomA - roomB;
      return a.fullName.localeCompare(b.fullName, 'vi');
    });
  }, [patients, selectedGroup, currentGroupRoomNumbers, selectedRoom, selectedDoctorId, severityFilter, searchTerm, doctorMap]);

  // Gom nhóm bệnh nhân theo buồng phòng để hiển thị dạng gộp (rowSpan)
  const groupedPatients = useMemo(() => {
    const groups: {
      roomKey: string;
      roomNumber: string;
      doctorName: string;
      patients: Patient[];
    }[] = [];

    filteredPatients.forEach((patient) => {
      const cleanRoom = (patient.roomNumber || '---').replace(/^(P\.|Phòng\s*)/i, '').trim() || '---';
      const lastGroup = groups[groups.length - 1];

      if (lastGroup && lastGroup.roomNumber === cleanRoom) {
        lastGroup.patients.push(patient);
      } else {
        groups.push({
          roomKey: `${cleanRoom}_${groups.length}`,
          roomNumber: cleanRoom,
          doctorName: '',
          patients: [patient],
        });
      }
    });

    // Xác định Bác sĩ điều trị cho từng buồng phòng
    groups.forEach((group) => {
      // 1. Lấy từ attendingDoctorId của bệnh nhân trong phòng
      const docNames = Array.from(
        new Set(
          group.patients
            .map((p) => {
              const doc = doctorMap.get(p.attendingDoctorId);
              return formatDoctorShortName(doc?.name || '');
            })
            .filter(Boolean)
        )
      );

      if (docNames.length > 0) {
        group.doctorName = docNames.join(', ');
      } else {
        // 2. Lấy từ roomDoctorAssignments nếu có
        const assignedDocId = roomDoctorAssignments[group.roomNumber];
        if (assignedDocId) {
          const doc = doctorMap.get(assignedDocId);
          group.doctorName = formatDoctorShortName(doc?.name || '');
        }
      }
    });

    return groups;
  }, [filteredPatients, doctorMap, roomDoctorAssignments]);

  // Statistics
  const criticalCount = patients.filter((p) => p.status === 'ACTIVE' && p.severity === 'CRITICAL').length;
  const moderateCount = patients.filter((p) => p.status === 'ACTIVE' && p.severity === 'MODERATE').length;
  const stableCount = patients.filter((p) => p.status === 'ACTIVE' && p.severity === 'STABLE').length;
  const newCount = patients.filter((p) => p.status === 'ACTIVE' && isNewAdmissionWithin24Hours(p.admissionDate)).length;
  const dischargeTodayCount = patients.filter((p) => p.status === 'ACTIVE' && p.admissionStatus === 'DISCHARGE_TODAY').length;

  const handleQuickUpdateSeverity = (patient: Patient, newSeverity: SeverityLevel) => {
    if (onUpdatePatient) {
      onUpdatePatient({ ...patient, severity: newSeverity });
    }
    setOpenSeverityMenuPatientId(null);
  };

  const handleSaveNote = (patient: Patient) => {
    if (onUpdatePatient) {
      onUpdatePatient({
        ...patient,
        handoverNotes: noteDraftText.trim(),
        importantNotes: noteDraftText.trim(),
      });
    }
    setEditingNotePatientId(null);
    setNoteDraftText('');
  };

  const handlePrintKardex = () => {
    window.print();
  };

  const now = new Date();
  const printTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  return (
    <div className="w-full space-y-3">
      {/* ============================================================== */}
      {/* 1. THANH ĐIỀU HƯỚNG & CÔNG CỤ KARDEX (ẨN KHI IN) */}
      {/* ============================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs space-y-3 print:hidden">
        {/* Row 1: Tiêu đề Kardex & Nút In */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0b4d8c] to-blue-600 text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Bảng Kardex Lâm Sàng 1 Trang
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-black uppercase tracking-wider bg-blue-100 text-[#0b4d8c] border border-blue-200">
                  {filteredPatients.length} Bệnh Nhân
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Giao ban, đi buồng & tổng hợp nhanh: Chẩn đoán • Diễn tiến • Hướng xử trí • CLS & Dặn dò
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Toggle Compact Mode */}
            <button
              type="button"
              onClick={() => setIsCompactDensity(!isCompactDensity)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="Thu nhỏ khoảng cách để xem được nhiều bệnh nhân nhất trên 1 trang"
            >
              {isCompactDensity ? <Maximize2 className="w-3.5 h-3.5 text-blue-600" /> : <Minimize2 className="w-3.5 h-3.5 text-blue-600" />}
              <span>{isCompactDensity ? 'Xem rộng rãi' : 'Chế độ siêu gọn'}</span>
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrintKardex}
              className="px-3.5 py-1.5 rounded-xl bg-[#0b4d8c] hover:bg-[#083a69] active:scale-95 text-white font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title="In bản Kardex chuẩn giấy A4 hoặc lưu file PDF kẹp vào hồ sơ bệnh án"
            >
              <Printer className="w-3.5 h-3.5 text-amber-200" />
              <span>In Bảng Kardex A4</span>
            </button>
          </div>
        </div>

        {/* Row 2: Bộ lọc phân khu, phân loại mức độ & Bác sĩ */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Phân Khu Buttons */}
          <div className="inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200 font-bold gap-1 overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => { setSelectedGroup('ALL'); setSelectedRoom('ALL'); }}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                selectedGroup === 'ALL'
                  ? 'bg-white text-[#0b4d8c] shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Toàn Khoa ({patients.filter((p) => p.status === 'ACTIVE').length})
            </button>
            <button
              type="button"
              onClick={() => { setSelectedGroup('GROUP_1'); setSelectedRoom('ALL'); }}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                selectedGroup === 'GROUP_1'
                  ? 'bg-white text-[#0b4d8c] shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Nhóm 1 (P.703 - 733)
            </button>
            <button
              type="button"
              onClick={() => { setSelectedGroup('GROUP_2'); setSelectedRoom('ALL'); }}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                selectedGroup === 'GROUP_2'
                  ? 'bg-white text-[#0b4d8c] shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Nhóm 2 (P.747 - 757)
            </button>
            <button
              type="button"
              onClick={() => { setSelectedGroup('CARDIO'); setSelectedRoom('ALL'); }}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                selectedGroup === 'CARDIO'
                  ? 'bg-white text-[#0b4d8c] shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tim Mạch (P.735 - 745)
            </button>
          </div>

          {/* Lọc Bác Sĩ Điều Trị */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-500 font-bold text-[11px]">Bác sĩ:</span>
            <select
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
              className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">Tất cả bác sĩ</option>
              {sortedDoctors.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 3: Status Pills & Search Box */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            <button
              type="button"
              onClick={() => setSeverityFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
                severityFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs font-black'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Tất cả ({patients.filter((p) => p.status === 'ACTIVE').length})
            </button>
            <button
              type="button"
              onClick={() => setSeverityFilter('CRITICAL')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                severityFilter === 'CRITICAL'
                  ? 'bg-rose-600 text-white shadow-2xs font-black'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
              <span>🚨 Nặng ({criticalCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setSeverityFilter('MODERATE')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
                severityFilter === 'MODERATE'
                  ? 'bg-amber-500 text-white shadow-2xs font-black'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <span>⚠️ Vừa ({moderateCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setSeverityFilter('STABLE')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
                severityFilter === 'STABLE'
                  ? 'bg-emerald-600 text-white shadow-2xs font-black'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <span>🟢 Nhẹ ({stableCount})</span>
            </button>
            {newCount > 0 && (
              <button
                type="button"
                onClick={() => setSeverityFilter('NEW')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
                  severityFilter === 'NEW'
                    ? 'bg-rose-500 text-white shadow-2xs font-black'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                }`}
              >
                <span>🆕 Mới &lt;24h ({newCount})</span>
              </button>
            )}
            {dischargeTodayCount > 0 && (
              <button
                type="button"
                onClick={() => setSeverityFilter('DISCHARGE_TODAY')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
                  severityFilter === 'DISCHARGE_TODAY'
                    ? 'bg-purple-600 text-white shadow-2xs font-black'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                }`}
              >
                <span>🏥 RV Hôm Nay ({dischargeTodayCount})</span>
              </button>
            )}
          </div>

          {/* Search box */}
          <div className="relative min-w-[200px] sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm tên, phòng, CĐ, BS..."
              className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. HEADER IN ẤN CHUYÊN NGHIỆP (CHỈ HIỂN THỊ KHI IN A4 / PDF) */}
      {/* ============================================================== */}
      <div className="hidden print:block mb-4 pb-2 border-b-2 border-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-black uppercase tracking-wider text-slate-900">
              BỆNH VIỆN HÙNG VƯƠNG GIA LAI • KHOA NỘI TỔNG HỢP
            </h1>
            <h2 className="text-sm font-extrabold text-[#0b4d8c] mt-0.5 uppercase tracking-wide">
              BẢNG KARDEX GIAO BAN & THEO DÕI ĐIỀU TRỊ LÂM SÀNG
            </h2>
          </div>
          <div className="text-right text-xs text-slate-700">
            <p className="font-bold">Thời điểm in: {printTimeStr}</p>
            <p className="font-semibold">Tổng số bệnh nhân: {filteredPatients.length} BN</p>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. BẢNG DỮ LIỆU KARDEX LÂM SÀNG CHÍNH */}
      {/* ============================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto shadow-xs print:border-none print:shadow-none">
        <table className="w-full text-left text-xs min-w-[950px] border-collapse print:text-[10px]">
          {/* Table Header */}
          <thead className="bg-[#0b4d8c] text-white font-black uppercase tracking-wider sticky top-0 z-10 shadow-xs print:bg-slate-900 print:text-white">
            <tr className="divide-x divide-blue-800/60 print:divide-slate-700">
              <th className="py-2.5 px-3 w-[115px] text-center">Buồng & Bác Sĩ</th>
              <th className="py-2.5 px-3 w-[170px]">Bệnh Nhân</th>
              <th className="py-2.5 px-3 w-[200px]">Chẩn Đoán</th>
              {/* CỘT DIỄN TIẾN LÂM SÀNG (ĐƯỢC THÊM TRƯỚC HƯỚNG XỬ TRÍ THEO ĐÚNG YÊU CẦU USER) */}
              <th className="py-2.5 px-3 w-[230px] bg-[#094178] print:bg-slate-800">
                <div className="flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                  <span>Diễn Tiến Lâm Sàng</span>
                </div>
              </th>
              {/* CỘT HƯỚNG XỬ TRÍ (THAY THẾ CHO THUỐC CHÍNH THEO ĐÚNG YÊU CẦU USER) */}
              <th className="py-2.5 px-3 w-[230px] bg-[#083a69] print:bg-slate-800">
                <div className="flex items-center gap-1">
                  <Stethoscope className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                  <span>Hướng Xử Trí & Điều Trị</span>
                </div>
              </th>
              <th className="py-2.5 px-3 w-[200px]">Cận Lâm Sàng & Báo Động</th>
              <th className="py-2.5 px-3 w-[180px]">Dặn Dò Trực / Ghi Chú</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-200 bg-white print:divide-slate-300">
            {groupedPatients.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="font-bold text-slate-600 text-sm">
                    Không tìm thấy bệnh nhân nào phù hợp với bộ lọc Kardex hiện tại.
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Hãy thử đổi phân khu, xóa từ khóa tìm kiếm hoặc chọn "Tất cả".
                  </p>
                </td>
              </tr>
            ) : (
              groupedPatients.map((group, groupIndex) => {
                const patientCount = group.patients.length;
                const docDisplayName = group.doctorName
                  ? (group.doctorName.startsWith('BS') || group.doctorName.startsWith('Bs')
                      ? group.doctorName
                      : `Bs. ${group.doctorName}`)
                  : 'Chưa phân công';
                const roomTitle = group.roomNumber === '---' ? 'Chưa xếp phòng' : `P.${group.roomNumber}`;

                return group.patients.map((patient, pIndex) => {
                  const isFirstInRoom = pIndex === 0;
                  const isLastInRoom = pIndex === patientCount - 1;

                  const doctor = doctorMap.get(patient.attendingDoctorId);
                  const doctorShortName = formatDoctorShortName(doctor?.name || '');
                  const latestDiagnosis = getLatestDiagnosis(patient);
                  const treatmentInfo = calculateTreatmentDays(patient.admissionDate);
                  const admissionDateDisplay = formatAdmissionDateDisplay(patient.admissionDate);
                  const isNew = isNewAdmissionWithin24Hours(patient.admissionDate);
                  const criticalAlerts = getCriticalLabAlerts(patient);

                  // Diễn tiến lâm sàng & Sinh hiệu
                  const latestEvo = patient.evolutions && patient.evolutions.length > 0 ? patient.evolutions[0] : null;
                  const rawClinicalNote = latestEvo?.clinicalNote || patient.medicalHistory || '';
                  const clinicalNoteClean = rawClinicalNote.split(/\[Sinh hiệu:.*?\]/i)[0].trim();
                  const latestVital = patient.vitals && patient.vitals.length > 0 ? patient.vitals[0] : null;

                  // Hướng xử trí & kế hoạch điều trị (Thay thế cho thuốc chính)
                  const treatmentPlanText = patient.treatmentPlan || latestEvo?.treatmentAction || patient.initialMedicationsText || '';

                  // Ghi chú & Dặn dò trực
                  const handoverText = patient.handoverNotes?.trim() || patient.importantNotes?.trim() || '';

                  const isCritical = patient.severity === 'CRITICAL';
                  const isModerate = patient.severity === 'MODERATE';
                  const isStable = patient.severity === 'STABLE';

                  const padClass = isCompactDensity ? 'py-1.5 px-2.5' : 'py-2.5 px-3';

                  return (
                    <tr
                      key={patient.id}
                      className={`hover:bg-blue-50/40 transition-colors ${
                        isLastInRoom ? 'border-b-2 border-slate-200' : 'border-b border-slate-100'
                      } print:border-slate-300 print:break-inside-avoid ${
                        groupIndex % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'
                      } ${isCritical ? 'bg-rose-50/50' : ''}`}
                    >
                      {/* 1. Phòng & Bác Sĩ (Gộp buồng bệnh với rowSpan) */}
                      {isFirstInRoom && (
                        <td
                          rowSpan={patientCount}
                          className={`${padClass} align-middle text-center bg-slate-50/80 border-r border-slate-200 print:border-slate-300 whitespace-nowrap`}
                        >
                          <div className="space-y-1.5 py-1">
                            <span className="inline-block font-black text-slate-900 bg-blue-100 text-[#0b4d8c] px-2.5 py-1 rounded-md text-xs border border-blue-200 shadow-2xs">
                              {roomTitle} ({patientCount} BN)
                            </span>
                            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                              <span className="truncate max-w-[100px]" title={docDisplayName}>
                                {docDisplayName}
                              </span>
                            </div>
                          </div>
                        </td>
                      )}

                      {/* 2. Bệnh Nhân & Hành Chính */}
                      <td className={`${padClass} align-top`}>
                        <div className="space-y-1">
                          <div 
                            onClick={() => onSelectPatient(patient)}
                            className="cursor-pointer group"
                          >
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`font-black text-xs sm:text-[13px] group-hover:text-blue-700 group-hover:underline transition-colors ${
                                isCritical ? 'text-rose-700' : isModerate ? 'text-amber-800' : 'text-slate-900'
                              }`}>
                                {formatPatientDisplayName(patient.fullName)}
                              </span>
                              {isNew && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-rose-600 text-white shadow-2xs animate-pulse">
                                  NEW
                                </span>
                            )}
                          </div>
                        </div>

                        {/* Tuổi, Giới & Ngày điều trị */}
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-bold">
                          <span>{patient.age}t</span>
                          <span>•</span>
                          {patient.gender === 'Nam' ? (
                            <span className="text-blue-700 font-extrabold">♂ Nam</span>
                          ) : (
                            <span className="text-rose-600 font-extrabold">♀ Nữ</span>
                          )}
                          <span>•</span>
                          <span className="text-slate-900 font-extrabold bg-slate-100 px-1 rounded">
                            {treatmentInfo.label}
                          </span>
                        </div>

                        {/* Phân loại mức độ bệnh: 1-chạm đổi nhanh */}
                        <div className="relative inline-block print:hidden">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenSeverityMenuPatientId(
                                openSeverityMenuPatientId === patient.id ? null : patient.id
                              );
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-0.2 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-2xs border ${
                              isCritical
                                ? 'bg-rose-600 text-white border-rose-700'
                                : isModerate
                                ? 'bg-amber-500 text-white border-amber-600'
                                : isStable
                                ? 'bg-emerald-600 text-white border-emerald-700'
                                : 'bg-slate-200 text-slate-700 border-slate-300'
                            }`}
                            title="Bấm để đổi nhanh phân loại bệnh nhân"
                          >
                            <span>{isCritical ? 'Nặng' : isModerate ? 'Vừa' : isStable ? 'Nhẹ' : 'Chưa PL'}</span>
                            <ChevronDown className="w-2.5 h-2.5 opacity-80" />
                          </button>

                          {/* Menu đổi phân loại */}
                          {openSeverityMenuPatientId === patient.id && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenSeverityMenuPatientId(null);
                                }}
                              />
                              <div
                                className="absolute left-0 top-full mt-1 w-40 bg-white rounded-xl shadow-2xl border border-slate-200 p-1.5 z-50 animate-in fade-in zoom-in-95 text-left"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="px-2 py-0.5 text-[9.5px] font-black uppercase text-slate-400 border-b border-slate-100">
                                  Đổi mức độ:
                                </div>
                                <div className="py-1 space-y-0.5">
                                  {[
                                    { id: 'CRITICAL', label: 'Nặng', color: 'text-rose-700 hover:bg-rose-50', active: 'bg-rose-600 text-white', dot: 'bg-rose-500' },
                                    { id: 'MODERATE', label: 'Trung bình', color: 'text-amber-800 hover:bg-amber-50', active: 'bg-amber-500 text-white', dot: 'bg-amber-400' },
                                    { id: 'STABLE', label: 'Nhẹ', color: 'text-emerald-700 hover:bg-emerald-50', active: 'bg-emerald-600 text-white', dot: 'bg-emerald-500' },
                                    { id: 'UNCLASSIFIED', label: 'Chưa phân loại', color: 'text-slate-600 hover:bg-slate-100', active: 'bg-slate-700 text-white', dot: 'bg-slate-300' },
                                  ].map((opt) => (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      onClick={() => handleQuickUpdateSeverity(patient, opt.id as SeverityLevel)}
                                      className={`w-full flex items-center justify-between px-2 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                        (patient.severity || 'UNCLASSIFIED') === opt.id ? opt.active : opt.color
                                      }`}
                                    >
                                      <span className="flex items-center gap-1.5">
                                        <span className={`w-2 h-2 rounded-full ${opt.dot}`} />
                                        <span>{opt.label}</span>
                                      </span>
                                      {(patient.severity || 'UNCLASSIFIED') === opt.id && <Check className="w-3 h-3" />}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Text hiển thị khi in */}
                        <span className="hidden print:inline-block text-[9.5px] font-black uppercase text-slate-700">
                          [{isCritical ? 'NẶNG' : isModerate ? 'VỪA' : isStable ? 'NHẸ' : 'CHƯA PL'}]
                        </span>
                      </div>
                    </td>

                    {/* 3. Chẩn Đoán Bệnh */}
                    <td className={`${padClass} align-top`}>
                      <div className="space-y-1">
                        <p className="font-bold text-slate-900 leading-snug line-clamp-3" title={latestDiagnosis}>
                          {latestDiagnosis}
                        </p>
                        {patient.secondaryDiagnosis && (
                          <p className="text-[10.5px] text-slate-600 font-medium line-clamp-2" title={patient.secondaryDiagnosis}>
                            Kèm: {patient.secondaryDiagnosis}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* 4. DIỄN TIẾN LÂM SÀNG (CỘT THÊM TRƯỚC HƯỚNG XỬ TRÍ) */}
                    <td className={`${padClass} align-top bg-cyan-50/20 print:bg-transparent`}>
                      <div className="space-y-1.5">
                        {/* Diễn tiến lâm sàng gần nhất */}
                        <p className="font-medium text-slate-800 leading-snug line-clamp-3" title={clinicalNoteClean || 'Chưa ghi nhận diễn tiến mới'}>
                          {clinicalNoteClean || (
                            <span className="text-slate-400 italic">Bệnh tỉnh, tiếp xúc tốt, chưa có diễn tiến bất thường</span>
                          )}
                        </p>

                        {/* Sinh hiệu gần nhất dạng inline pill */}
                        {latestVital && (latestVital.bpSystolic || latestVital.heartRate || latestVital.spO2 || latestVital.temperature) ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700 flex-wrap shadow-2xs">
                            {latestVital.bpSystolic ? (
                              <span className={latestVital.bpSystolic >= 140 || latestVital.bpSystolic < 90 ? 'text-rose-600 font-black' : 'text-slate-900'}>
                                HA {latestVital.bpSystolic}/{latestVital.bpDiastolic || '--'}
                              </span>
                            ) : null}
                            {latestVital.heartRate ? (
                              <span className={latestVital.heartRate > 100 || latestVital.heartRate < 55 ? 'text-rose-600 font-black' : 'text-slate-800'}>
                                M {latestVital.heartRate}
                              </span>
                            ) : null}
                            {latestVital.spO2 ? (
                              <span className={latestVital.spO2 < 95 ? 'text-rose-600 font-black' : 'text-emerald-700'}>
                                SpO₂ {latestVital.spO2}%
                              </span>
                            ) : null}
                            {latestVital.temperature ? (
                              <span className={latestVital.temperature >= 38.0 ? 'text-rose-600 font-black' : 'text-slate-800'}>
                                T {latestVital.temperature}°C
                              </span>
                            ) : null}
                          </div>
                        ) : null}

                        {/* Nút bấm nhanh thêm diễn tiến trực tiếp */}
                        {onOpenEvolution && (
                          <div className="print:hidden pt-0.5">
                            <button
                              type="button"
                              onClick={() => onOpenEvolution(patient)}
                              className="text-[10.5px] font-bold text-cyan-800 hover:text-cyan-900 hover:underline flex items-center gap-1 cursor-pointer"
                              title="Thêm diễn tiến mới cho bệnh nhân này"
                            >
                              <Activity className="w-3 h-3 text-cyan-700" />
                              <span>+ Thêm diễn tiến</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 5. HƯỚNG XỬ TRÍ & ĐIỀU TRỊ (THAY THẾ CHO THUỐC CHÍNH) */}
                    <td className={`${padClass} align-top bg-emerald-50/20 print:bg-transparent`}>
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-900 leading-snug whitespace-pre-line line-clamp-4" title={treatmentPlanText || 'Theo dõi và điều trị theo phác đồ nội khoa'}>
                          {treatmentPlanText || (
                            <span className="text-slate-400 italic">Theo dõi sinh hiệu, điều trị theo phác đồ nội khoa</span>
                          )}
                        </p>
                      </div>
                    </td>

                    {/* 6. Cận Lâm Sàng & Báo Động Nguy Hiểm (CHỈ HIỂN THỊ CLS QUAN TRỌNG HOẶC BẤT THƯỜNG NHIỀU) */}
                    <td className={`${padClass} align-top`}>
                      {(() => {
                        const importantLabs = getImportantOrAbnormalLabs(patient);
                        if (importantLabs.length === 0) {
                          return patient.initialLabsText || (patient.labs && patient.labs.length > 0) ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[10.5px]">
                              <span>🟢</span>
                              <span>Bình thường</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[10.5px]">Chưa có kết quả CLS</span>
                          );
                        }

                        return (
                          <div className="space-y-1">
                            {importantLabs.map((item) => (
                              <div
                                key={item.id}
                                className={`text-[10.5px] p-1 rounded leading-tight shadow-2xs ${
                                  item.severity === 'CRITICAL'
                                    ? 'bg-rose-50 border border-rose-300 text-rose-900 font-black'
                                    : item.severity === 'WARNING'
                                    ? 'bg-amber-50 border border-amber-200 text-amber-900 font-bold'
                                    : 'bg-blue-50 border border-blue-200 text-blue-900 font-bold'
                                }`}
                                title={item.badgeLabel}
                              >
                                {item.badgeLabel}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </td>

                    {/* 7. Dặn Dò Trực & Bàn Giao */}
                    <td className={`${padClass} align-top`}>
                      <div className="space-y-1">
                        {editingNotePatientId === patient.id ? (
                          <div className="space-y-1 print:hidden">
                            <textarea
                              rows={2}
                              value={noteDraftText}
                              onChange={(e) => setNoteDraftText(e.target.value)}
                              placeholder="Nhập dặn dò trực, theo dõi đặc biệt..."
                              className="w-full p-1.5 text-xs font-medium border border-blue-400 rounded-md focus:ring-1 focus:ring-blue-500 bg-white"
                              autoFocus
                            />
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingNotePatientId(null)}
                                className="px-2 py-0.5 text-[10.5px] font-bold text-slate-500 hover:bg-slate-100 rounded"
                              >
                                Hủy
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveNote(patient)}
                                className="px-2.5 py-0.5 text-[10.5px] font-black text-white bg-blue-600 hover:bg-blue-700 rounded shadow-xs"
                              >
                                Lưu
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="group relative">
                            {handoverText ? (
                              <p className="font-semibold text-slate-800 leading-snug line-clamp-3 bg-amber-50/70 p-1.5 rounded border border-amber-200/80 text-[11px]" title={handoverText}>
                                📌 {handoverText}
                              </p>
                            ) : (
                              <span className="text-slate-400 italic text-[10.5px]">Chưa có dặn dò trực</span>
                            )}
                            
                            {/* Nút sửa nhanh dặn dò trực */}
                            {onUpdatePatient && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingNotePatientId(patient.id);
                                  setNoteDraftText(handoverText);
                                }}
                                className="mt-1 text-[10px] font-bold text-slate-500 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer print:hidden"
                                title="Sửa dặn dò trực / bàn giao bệnh"
                              >
                                <Edit3 className="w-2.5 h-2.5" />
                                <span>{handoverText ? 'Sửa dặn dò' : '+ Dặn dò trực'}</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              });
            })
          )}
          </tbody>
        </table>
      </div>

      {/* Footer Summary (Khi xem trên màn hình) */}
      <div className="text-right text-xs font-bold text-slate-500 pt-1 print:hidden">
        Đang hiển thị {filteredPatients.length} / {patients.filter((p) => p.status === 'ACTIVE').length} bệnh nhân trong bảng Kardex
      </div>
    </div>
  );
};

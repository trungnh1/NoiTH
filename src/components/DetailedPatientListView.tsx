import React, { useState, useMemo, useEffect } from 'react';
import { 
  Patient, 
  Doctor, 
  DepartmentRoom,
  SeverityLevel, 
  ClinicalTag, 
  CLINICAL_TAGS_META 
} from '../types/patient';
import { 
  Search, 
  UserPlus, 
  FileEdit, 
  Calendar, 
  AlertCircle, 
  Stethoscope, 
  Activity,
  Plus,
  CheckCircle2,
  Users,
  ArrowRightLeft,
  LogOut,
  Trash2,
  Printer
} from 'lucide-react';

// Rooms for Nhóm 1 (Khoa Nội Tổng Hợp: 703 -> 731 và bổ sung phòng 733)
export const GROUP_1_ROOM_NUMBERS = [
  '703', '704', '705', '709', '711', '713', '715', '717', '718', '721', '725', '727', '729', '731', '733'
];

// 6 Bác sĩ phụ trách Nhóm 1: Ngọc, Trung, Huyền, Thiên, Ánh, Bình Chi
export const GROUP_1_DOCTOR_IDS = [
  '00708', // BS. Trần Hữu Ngọc (Ngọc)
  '00979', // BS. Nguyễn Hữu Trung (Trung)
  '00257', // BS. Đỗ Thị Vân Huyền (Huyền)
  '00144', // BS. Phạm Cao Thiên (Thiên)
  '00226', // BS. Đặng Thị Ngọc Ánh (Ánh)
  '00943', // BS. Trần Bùi Bình Chi (Bình Chi)
];

interface DetailedPatientListViewProps {
  patients: Patient[];
  doctors: Doctor[];
  rooms?: DepartmentRoom[];
  roomDoctorAssignments?: Record<string, string>;
  onAssignRoomDoctor?: (roomNumber: string, doctorId: string) => void;
  onOpenNewPatient: () => void;
  onOpenNewPatientForRoom?: (roomNumber: string) => void;
  onOpenEvolution: (patient: Patient) => void;
  onSelectPatient: (patient: Patient) => void;
  onTransferPatient?: (patient: Patient) => void;
  onDischargePatient?: (patient: Patient) => void;
  onDeletePatient?: (patient: Patient) => void;
  onOpenPrintModal?: () => void;
}

/**
 * Formats doctor name to short name without surname and middle names (e.g. "Trần Hữu Ngọc" -> "Ngọc")
 */
export function formatDoctorShortName(fullName: string): string {
  if (!fullName) return '';
  const clean = fullName.replace(/^BS(\.|\s+)/i, '').trim();
  if (!clean) return fullName;
  if (/bình chi/i.test(clean)) return 'Bình Chi';
  if (/như ý/i.test(clean)) return 'Như Ý';
  const parts = clean.split(/\s+/);
  return parts[parts.length - 1];
}

/**
 * Formats all diagnoses into a unified text string without splitting into main and secondary.
 */
export function formatCombinedDiagnosis(patient: { primaryDiagnosis: string; secondaryDiagnosis?: string }): string {
  const parts: string[] = [];
  if (patient.primaryDiagnosis?.trim()) {
    parts.push(patient.primaryDiagnosis.trim());
  }
  if (patient.secondaryDiagnosis?.trim()) {
    const sec = patient.secondaryDiagnosis.trim();
    if (!patient.primaryDiagnosis.toLowerCase().includes(sec.toLowerCase())) {
      parts.push(sec);
    }
  }
  return parts.join(' - ') || 'Chưa ghi nhận chẩn đoán';
}

/**
 * Formats admission date into "NV: DD/MM" (ví dụ: NV: 26/10)
 */
export function formatAdmissionDateShort(dateStr: string): string {
  if (!dateStr) return 'NV: --/--';
  try {
    // DD/MM/YYYY or DD-MM-YYYY
    const dmy = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})/);
    if (dmy) {
      return `NV: ${dmy[1].padStart(2, '0')}/${dmy[2].padStart(2, '0')}`;
    }
    // YYYY-MM-DD
    const ymd = dateStr.match(/^\d{4}[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (ymd) {
      return `NV: ${ymd[2].padStart(2, '0')}/${ymd[1].padStart(2, '0')}`;
    }
    const d = new Date(dateStr.replace(' ', 'T'));
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `NV: ${dd}/${mm}`;
    }
  } catch {
    // fallback
  }
  return `NV: ${dateStr.slice(0, 5)}`;
}

/**
 * Calculates number of treatment days from admissionDate to today (inclusive).
 * Format: "ngày ĐT: 03" with 2-digit padding.
 */
export function calculateTreatmentDays(admissionDateStr: string): { days: number; label: string } {
  if (!admissionDateStr) return { days: 1, label: 'ngày ĐT: 01' };
  try {
    let admDate: Date;
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(admissionDateStr)) {
      const parts = admissionDateStr.split(/[ /:]/);
      admDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    } else {
      admDate = new Date(admissionDateStr.replace(' ', 'T'));
    }

    if (isNaN(admDate.getTime())) return { days: 1, label: 'ngày ĐT: 01' };

    const today = new Date();
    const start = new Date(admDate.getFullYear(), admDate.getMonth(), admDate.getDate()).getTime();
    const current = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

    const diffDays = Math.floor((current - start) / (1000 * 60 * 60 * 24));
    const treatmentDays = Math.max(1, diffDays + 1);
    const padded = String(treatmentDays).padStart(2, '0');

    return {
      days: treatmentDays,
      label: `ngày ĐT: ${padded}`,
    };
  } catch {
    return { days: 1, label: 'ngày ĐT: 01' };
  }
}

export const DetailedPatientListView: React.FC<DetailedPatientListViewProps> = ({
  patients,
  doctors,
  rooms = [],
  roomDoctorAssignments = {},
  onAssignRoomDoctor,
  onOpenNewPatient,
  onOpenNewPatientForRoom,
  onOpenEvolution,
  onSelectPatient,
  onTransferPatient,
  onDischargePatient,
  onDeletePatient,
  onOpenPrintModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | SeverityLevel | 'DISCHARGE_TODAY' | 'DISCHARGE_TOMORROW'>('ALL');
  const [doctorFilter, setDoctorFilter] = useState<string>('ALL');
  const [showAllGroup1Rooms, setShowAllGroup1Rooms] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Group 1 doctors (Ngọc, Trung, Huyền, Thiên, Ánh, Bình Chi)
  const group1Doctors = useMemo(() => {
    const raw = doctors.filter((d) => 
      GROUP_1_DOCTOR_IDS.includes(d.id) || 
      d.id === 'DOC-NGOC' ||
      /ngọc|trung|huyền|thiên|ánh|bình chi/i.test(d.name)
    );
    const seenNames = new Set<string>();
    const uniqueList: Doctor[] = [];
    for (const d of raw) {
      const norm = d.name.trim().toLowerCase();
      if (!seenNames.has(norm)) {
        seenNames.add(norm);
        uniqueList.push(d);
      }
    }
    return uniqueList;
  }, [doctors]);

  const otherDoctors = useMemo(() => {
    const raw = doctors.filter((d) => !group1Doctors.some((g) => g.id === d.id || g.name.trim().toLowerCase() === d.name.trim().toLowerCase()));
    const seenNames = new Set<string>();
    const uniqueList: Doctor[] = [];
    for (const d of raw) {
      const norm = d.name.trim().toLowerCase();
      if (!seenNames.has(norm)) {
        seenNames.add(norm);
        uniqueList.push(d);
      }
    }
    return uniqueList;
  }, [doctors, group1Doctors]);

  const doctorMap = useMemo(() => {
    const map = new Map<string, Doctor>();
    doctors.forEach((d) => {
      map.set(d.id, d);
    });
    // Map alias DOC-NGOC to Trần Hữu Ngọc if exists
    const ngoc = doctors.find((d) => d.id === '00708' || /trần hữu ngọc/i.test(d.name));
    if (ngoc) {
      map.set('DOC-NGOC', ngoc);
    }
    return map;
  }, [doctors]);

  // Active inpatients - Filtered strictly to NHÓM 1 ROOMS (including 733)
  const group1ActivePatients = useMemo(() => {
    return patients.filter((p) => {
      if (p.status !== 'ACTIVE') return false;
      const cleanRoom = p.roomNumber ? p.roomNumber.replace(/^(phòng|p\.?)\s*/i, '').trim() : '';
      return GROUP_1_ROOM_NUMBERS.includes(cleanRoom);
    });
  }, [patients]);

  // Filtered patients based on user search and filters
  const filteredPatients = useMemo(() => {
    return group1ActivePatients.filter((p) => {
      // Status & Severity filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'DISCHARGE_TODAY') {
          if (p.admissionStatus !== 'DISCHARGE_TODAY') return false;
        } else if (statusFilter === 'DISCHARGE_TOMORROW') {
          if (p.admissionStatus !== 'DISCHARGE_TOMORROW') return false;
        } else {
          if (p.severity !== statusFilter) return false;
        }
      }

      // Doctor filter
      if (doctorFilter !== 'ALL') {
        const docId = p.attendingDoctorId;
        if (docId !== doctorFilter) {
          // Check DOC-NGOC alias
          if (!(doctorFilter === '00708' && docId === 'DOC-NGOC')) {
            return false;
          }
        }
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const docName = doctorMap.get(p.attendingDoctorId)?.name.toLowerCase() || '';
        const matchName = p.fullName.toLowerCase().includes(query);
        const matchRoom = p.roomNumber.toLowerCase().includes(query) || p.bedNumber.toLowerCase().includes(query);
        const matchDiagnosis = formatCombinedDiagnosis(p).toLowerCase().includes(query);
        const matchPlan = (p.treatmentPlan || p.evolutions?.[0]?.treatmentAction || '').toLowerCase().includes(query);
        const matchNotes = (p.importantNotes || p.handoverNotes || '').toLowerCase().includes(query);
        const matchDoctor = docName.includes(query);

        return matchName || matchRoom || matchDiagnosis || matchPlan || matchNotes || matchDoctor;
      }

      return true;
    });
  }, [group1ActivePatients, statusFilter, doctorFilter, searchTerm, doctorMap]);

  // Group patients by Room (Vertical List of Nhóm 1 Rooms)
  const roomGroups = useMemo(() => {
    const patientMap = new Map<string, Patient[]>();

    filteredPatients.forEach((p) => {
      const cleanNum = p.roomNumber ? p.roomNumber.replace(/^(phòng|p\.?)\s*/i, '').trim() : '';
      if (cleanNum) {
        if (!patientMap.has(cleanNum)) {
          patientMap.set(cleanNum, []);
        }
        patientMap.get(cleanNum)!.push(p);
      }
    });

    // Rooms to display: either all 15 rooms of Nhóm 1, or only rooms with patients
    const roomsToRender = showAllGroup1Rooms 
      ? GROUP_1_ROOM_NUMBERS 
      : GROUP_1_ROOM_NUMBERS.filter((r) => patientMap.has(r));

    return roomsToRender.map((roomKey) => {
      const roomPatientList = patientMap.get(roomKey) || [];
      
      // Sort patients by bed number
      roomPatientList.sort((a, b) => {
        return (a.bedNumber || '').localeCompare(b.bedNumber || '', undefined, { numeric: true });
      });

      // Find assigned doctor for this room
      // Priority: roomDoctorAssignments prop -> first patient's attending doctor -> empty
      let assignedDoctorId = roomDoctorAssignments[roomKey] || '';
      if (!assignedDoctorId && roomPatientList.length > 0) {
        assignedDoctorId = roomPatientList[0].attendingDoctorId;
      }

      const assignedDoc = doctorMap.get(assignedDoctorId);

      return {
        roomNumber: roomKey,
        assignedDoctorId,
        assignedDoctorName: assignedDoc ? `BS. ${assignedDoc.name}` : '',
        patients: roomPatientList,
      };
    });
  }, [filteredPatients, doctorMap, roomDoctorAssignments, showAllGroup1Rooms]);

  // Handler for quick doctor assignment
  const handleQuickAssignDoctor = (roomNumber: string, doctorId: string) => {
    if (onAssignRoomDoctor) {
      onAssignRoomDoctor(roomNumber, doctorId);
      const doc = doctorMap.get(doctorId);
      setNotification(`Đã phân công BS. ${doc?.name || doctorId} phụ trách buồng Phòng ${roomNumber}`);
      setTimeout(() => setNotification(null), 3500);
    }
  };

  // Counters for Nhóm 1
  const criticalCount = group1ActivePatients.filter((p) => p.severity === 'CRITICAL').length;
  const moderateCount = group1ActivePatients.filter((p) => p.severity === 'MODERATE').length;
  const stableCount = group1ActivePatients.filter((p) => p.severity === 'STABLE').length;
  const dischargeTodayCount = group1ActivePatients.filter((p) => p.admissionStatus === 'DISCHARGE_TODAY').length;
  const dischargeTomorrowCount = group1ActivePatients.filter((p) => p.admissionStatus === 'DISCHARGE_TOMORROW').length;

  // Active doctors currently treating patients in Nhóm 1 (sorted alphabetically by Vietnamese given name)
  const activeDoctorsWithCounts = useMemo(() => {
    const countsMap = new Map<string, { id: string; name: string; count: number }>();

    group1ActivePatients.forEach((p) => {
      let doc = doctorMap.get(p.attendingDoctorId);
      if (!doc && p.attendingDoctorId === 'DOC-NGOC') {
        doc = doctors.find((d) => d.id === '00708' || /trần hữu ngọc/i.test(d.name));
      }
      if (doc) {
        const cur = countsMap.get(doc.id) || { id: doc.id, name: doc.name, count: 0 };
        cur.count += 1;
        countsMap.set(doc.id, cur);
      }
    });

    // Only include doctors with active patients (> 0)
    const list = Array.from(countsMap.values()).filter((item) => item.count > 0);

    // Sort alphabetically by Vietnamese given name (ABC)
    const getSortName = (fullName: string) => {
      const parts = fullName.trim().split(/\s+/);
      return parts[parts.length - 1]; // e.g. Ánh, Chi, Huyền, Ngọc, Thiên, Trung
    };

    list.sort((a, b) => {
      const nameA = getSortName(a.name);
      const nameB = getSortName(b.name);
      return nameA.localeCompare(nameB, 'vi', { sensitivity: 'base' });
    });

    return list;
  }, [group1ActivePatients, doctorMap, doctors]);

  return (
    <div className="space-y-4 animate-in fade-in">
      
      {/* Quick feedback notification banner */}
      {notification && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-md flex items-center justify-between text-xs font-bold animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
            <span>{notification}</span>
          </div>
          <button 
            onClick={() => setNotification(null)}
            className="text-emerald-200 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Action Bar & Quick Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-3 sm:p-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Left: Title + Nhóm 1 Scope Badge + Dynamic ABC Doctor List */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                Danh Sách Bệnh Nhân - Buồng Phòng Nhóm 1
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-extrabold shadow-2xs">
                Nhóm 1 (703-731 & 733)
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-900 text-white font-extrabold">
                {group1ActivePatients.length} bệnh nhân
              </span>
            </div>

            {/* Doctors treating patients sorted ABC: Tên BS (số BN) */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {activeDoctorsWithCounts.length === 0 ? (
                <span className="text-xs text-slate-400 italic">Hiện chưa có bệnh nhân nào được phân công bác sĩ.</span>
              ) : (
                activeDoctorsWithCounts.map((docItem) => {
                  const isSelected = doctorFilter === docItem.id;
                  // Display short name: BS. [Tên]
                  const parts = docItem.name.trim().split(/\s+/);
                  const shortName = parts.length > 2 && /bình chi/i.test(docItem.name) 
                    ? 'Bình Chi' 
                    : parts[parts.length - 1];

                  return (
                    <button
                      key={docItem.id}
                      type="button"
                      onClick={() => setDoctorFilter(isSelected ? 'ALL' : docItem.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                        isSelected 
                          ? 'bg-rose-600 text-white border-rose-600 shadow-2xs' 
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                      }`}
                      title={`Nhấn để ${isSelected ? 'bỏ lọc' : 'lọc'} bệnh nhân do BS. ${docItem.name} điều trị`}
                    >
                      <span>BS. {shortName}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                        isSelected ? 'bg-white text-rose-700' : 'bg-slate-900 text-white'
                      }`}>
                        {docItem.count}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: In Danh Sách, + Nhập mới BN & Toggle xem tất cả phòng */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onOpenPrintModal && (
              <button
                type="button"
                onClick={onOpenPrintModal}
                className="px-3.5 py-2 rounded-xl text-xs font-black bg-purple-700 hover:bg-purple-800 text-white shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                title="In danh sách bệnh nhân nội trú theo tùy chọn (Tất cả, Theo phòng, Theo bác sĩ)"
              >
                <Printer className="w-4 h-4 text-purple-200" />
                <span>🖨️ In Danh Sách</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowAllGroup1Rooms(!showAllGroup1Rooms)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                showAllGroup1Rooms 
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
              title="Xem tất cả 15 buồng phòng của Nhóm 1 (bao gồm cả phòng trống) để gán bác sĩ"
            >
              <Users className="w-3.5 h-3.5" />
              <span>{showAllGroup1Rooms ? 'Ẩn phòng trống' : 'Hiện cả phòng trống (15 phòng)'}</span>
            </button>

            <button
              type="button"
              onClick={onOpenNewPatient}
              className="px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-xs shadow-rose-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Nhập Mới Bệnh Nhân</span>
            </button>
          </div>

        </div>

        {/* Filter Bar */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
          
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên bệnh nhân, phòng, chẩn đoán, kế hoạch, bác sĩ..."
              className="w-full pl-9 pr-8 py-1.5 bg-slate-50 hover:bg-slate-100/60 focus:bg-white text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500 font-medium transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-0.5"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            
            {/* Status & Severity Filters */}
            <div className="inline-flex flex-wrap items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 gap-0.5">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả ({group1ActivePatients.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('CRITICAL')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'CRITICAL'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-rose-700 hover:bg-rose-50'
                }`}
              >
                <span>Nặng</span>
                <span className="text-[10px] px-1 rounded-full bg-black/20 font-black">
                  {criticalCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('MODERATE')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'MODERATE'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                <span>Vừa</span>
                <span className="text-[10px] px-1 rounded-full bg-black/20 font-black">
                  {moderateCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('STABLE')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'STABLE'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                <span>Ổn định</span>
                <span className="text-[10px] px-1 rounded-full bg-black/20 font-black">
                  {stableCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('DISCHARGE_TODAY')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'DISCHARGE_TODAY'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-purple-700 hover:bg-purple-50'
                }`}
              >
                <span>RV hôm nay</span>
                <span className="text-[10px] px-1.5 rounded-full bg-purple-200 text-purple-900 font-black">
                  {dischargeTodayCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('DISCHARGE_TOMORROW')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'DISCHARGE_TOMORROW'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-blue-700 hover:bg-blue-50'
                }`}
              >
                <span>Dự kiến RV mai</span>
                <span className="text-[10px] px-1.5 rounded-full bg-blue-200 text-blue-900 font-black">
                  {dischargeTomorrowCount}
                </span>
              </button>
            </div>

            {/* Doctor Select Filter - Highlighting Nhóm 1 Doctors */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
              <Stethoscope className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                value={doctorFilter}
                onChange={(e) => setDoctorFilter(e.target.value)}
                className="bg-transparent text-slate-800 font-bold text-xs focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">Lọc theo Bác sĩ</option>
                <optgroup label="Bác sĩ Nhóm 1">
                  {group1Doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      BS. {formatDoctorShortName(d.name)}
                    </option>
                  ))}
                </optgroup>
                {otherDoctors.length > 0 && (
                  <optgroup label="Bác sĩ khác">
                    {otherDoctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        BS. {formatDoctorShortName(d.name)}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {(searchTerm || statusFilter !== 'ALL' || doctorFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('ALL');
                  setDoctorFilter('ALL');
                }}
                className="text-xs text-rose-600 hover:underline font-bold px-1 cursor-pointer"
              >
                Xóa lọc
              </button>
            )}

          </div>

        </div>
      </div>

      {/* Main Vertical List of Nhóm 1 Rooms */}
      {roomGroups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 shadow-xs">
          <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="font-extrabold text-slate-700 text-sm">
            Không tìm thấy bệnh nhân nào trong Nhóm 1 theo bộ lọc hiện tại.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Bấm "Hiện cả phòng trống" để xem tất cả buồng phòng Nhóm 1 hoặc bấm "+ Nhập Mới Bệnh Nhân".
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {roomGroups.map((group) => {
            return (
              <div 
                key={group.roomNumber}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
              >
                {/* 1. Header: Số phòng - Bs điều trị (Quick Doctor Assignment Dropdown) */}
                <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
                  
                  {/* Left: Phòng & Chọn nhanh Bác Sĩ Điều Trị */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className="text-rose-400 font-black text-sm sm:text-base tracking-tight">
                      Phòng {group.roomNumber}
                    </span>
                    <span className="text-slate-500 font-light">•</span>
                    
                    {/* Quick Doctor Selector */}
                    <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-lg px-2.5 py-1 transition-colors">
                      <Stethoscope className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span className="text-slate-400 text-[11px] font-semibold hidden sm:inline">
                        BS điều trị:
                      </span>
                      <select
                        value={group.assignedDoctorId || ''}
                        onChange={(e) => handleQuickAssignDoctor(group.roomNumber, e.target.value)}
                        className="bg-transparent text-white font-extrabold text-xs focus:outline-hidden cursor-pointer"
                        title={`Chọn nhanh Bác sĩ điều trị cho toàn bộ Phòng ${group.roomNumber}`}
                      >
                        <option value="" className="text-slate-900 bg-white">-- Chọn BS điều trị --</option>
                        <optgroup label="Bác sĩ Nhóm 1 (Ngọc, Trung, Huyền, Thiên, Ánh, Bình Chi)" className="text-slate-900 bg-white font-bold">
                          {group1Doctors.map((doc) => (
                            <option key={doc.id} value={doc.id}>
                              BS. {formatDoctorShortName(doc.name)}
                            </option>
                          ))}
                        </optgroup>
                        {otherDoctors.length > 0 && (
                          <optgroup label="Bác sĩ khác" className="text-slate-900 bg-white">
                            {otherDoctors.map((doc) => (
                              <option key={doc.id} value={doc.id}>
                                BS. {formatDoctorShortName(doc.name)}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    {group.assignedDoctorName && (
                      <span className="text-[11px] text-emerald-400 font-bold hidden md:inline">
                        (Phụ trách buồng)
                      </span>
                    )}
                  </div>

                  {/* Right: Số lượng bệnh nhân & Nút + Thêm BN */}
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-semibold">
                      {group.patients.length} bệnh nhân
                    </span>
                    {onOpenNewPatientForRoom && (
                      <button
                        type="button"
                        onClick={() => onOpenNewPatientForRoom(group.roomNumber)}
                        className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title={`Tiếp nhận bệnh nhân mới vào Phòng ${group.roomNumber}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm BN</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. 3-Column Patient Grid: 3 cột là 3 bệnh nhân, 6 bệnh nhân là 2 dòng 3 cột */}
                {group.patients.length === 0 ? (
                  <div className="p-6 bg-slate-50/50 text-center">
                    <p className="text-xs text-slate-400 font-medium mb-2">
                      Phòng {group.roomNumber} hiện chưa có bệnh nhân nội trú.
                    </p>
                    {onOpenNewPatientForRoom && (
                      <button
                        type="button"
                        onClick={() => onOpenNewPatientForRoom(group.roomNumber)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-rose-400 text-rose-700 bg-rose-50/50 hover:bg-rose-100 text-xs font-bold transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Tiếp nhận bệnh nhân vào Phòng {group.roomNumber}</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 p-3.5 bg-slate-50/60">
                    {group.patients.map((patient) => {
                      const isCritical = patient.severity === 'CRITICAL';
                      const isModerate = patient.severity === 'MODERATE';
                      const treatmentInfo = calculateTreatmentDays(patient.admissionDate);
                      
                      // Combined unified diagnosis (tất cả các chẩn đoán, không phân biệt bệnh chính / bệnh kèm)
                      const combinedDiagnosis = formatCombinedDiagnosis(patient);

                      // Plan of treatment: explicit plan or newest evolution action
                      const currentPlan = patient.treatmentPlan || 
                        patient.evolutions?.[0]?.treatmentAction || 
                        patient.initialMedicationsText || 
                        'Chăm sóc cấp 2, theo dõi sinh hiệu, ăn chế độ bệnh lý.';

                      // Notes and handover:
                      const currentNotes = patient.importantNotes || 
                        patient.handoverNotes || 
                        (patient.evolutions?.[0]?.clinicalNote ? `Diễn biến: ${patient.evolutions[0].clinicalNote}` : 'Chưa có ghi chú đặc biệt');

                      return (
                        <div
                          key={patient.id}
                          className={`bg-white rounded-xl border ${
                            isCritical 
                              ? 'border-rose-400/80 ring-1 ring-rose-400/40 shadow-xs' 
                              : isModerate
                              ? 'border-amber-300 shadow-2xs'
                              : 'border-slate-200 shadow-2xs'
                          } p-3 flex flex-col justify-between hover:shadow-md transition-all duration-150`}
                        >
                          {/* Top Content */}
                          <div>
                            
                            {/* Row 1: Tên Bệnh Nhân + 3 Nút Thao Tác Nhanh (Chuyển phòng, Ra viện, Xóa BN) */}
                            <div className="pb-2 border-b border-slate-100 flex flex-wrap items-start justify-between gap-1.5">
                              <div 
                                onClick={() => onSelectPatient(patient)}
                                className="cursor-pointer group flex-1 min-w-[120px]"
                              >
                                <h4 className={`font-black text-sm tracking-tight transition-colors uppercase leading-snug ${
                                  isCritical 
                                    ? 'text-rose-600 group-hover:text-rose-700' 
                                    : isModerate 
                                    ? 'text-amber-600 group-hover:text-amber-700' 
                                    : 'text-emerald-700 group-hover:text-emerald-800'
                                }`}>
                                  {patient.fullName}
                                </h4>
                                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mt-0.5">
                                  <span>{patient.age} tuổi</span>
                                  <span>•</span>
                                  <span className={patient.gender === 'Nam' ? 'text-blue-600 font-bold' : 'text-pink-600 font-bold'}>
                                    {patient.gender}
                                  </span>
                                </div>
                              </div>

                              {/* Quick Actions Beside Name: Chuyển phòng, Đã ra viện, Xóa */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onTransferPatient) onTransferPatient(patient);
                                  }}
                                  className="p-1 px-1.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 font-bold text-[11px] flex items-center gap-0.5 transition-colors cursor-pointer"
                                  title="Chuyển bệnh nhân sang buồng phòng khác"
                                >
                                  <ArrowRightLeft className="w-3 h-3 text-blue-600" />
                                  <span>Chuyển</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onDischargePatient) onDischargePatient(patient);
                                  }}
                                  className="p-1 px-1.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 font-bold text-[11px] flex items-center gap-0.5 transition-colors cursor-pointer"
                                  title="Bấm đã ra viện (rời khỏi buồng phòng)"
                                >
                                  <LogOut className="w-3 h-3 text-emerald-600" />
                                  <span>Ra viện</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onDeletePatient) onDeletePatient(patient);
                                  }}
                                  className="p-1 px-1.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 font-bold text-[11px] flex items-center gap-0.5 transition-colors cursor-pointer"
                                  title="Xóa bệnh nhân khỏi hệ thống"
                                >
                                  <Trash2 className="w-3 h-3 text-rose-600" />
                                  <span>Xóa</span>
                                </button>
                              </div>
                            </div>

                            {/* Row 2: Ngày Vào (NV: DD/MM) & Số Ngày ĐT (ngày ĐT: XX) */}
                            <div className="flex items-center justify-between text-xs py-1.5 text-slate-600 border-b border-slate-100">
                              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{formatAdmissionDateShort(patient.admissionDate)}</span>
                              </div>
                              <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-900 font-black text-[11px] border border-indigo-200/80">
                                {treatmentInfo.label}
                              </span>
                            </div>

                            {/* Row 3: Chẩn Đoán (Tất cả chẩn đoán, không phân thành bệnh chính, bệnh kèm) */}
                            <div className="py-2 space-y-1">
                              <p className="font-bold text-xs text-slate-900 leading-snug" title={combinedDiagnosis}>
                                {combinedDiagnosis}
                              </p>
                            </div>

                            {/* Row 4: Tình Trạng & Nhãn Đặc Biệt */}
                            <div className="flex flex-wrap items-center gap-1 pb-2.5">
                              {/* Mức độ nặng/vừa/ổn định */}
                              {isCritical ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-black text-[10px] bg-rose-600 text-white shadow-2xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                  NẶNG
                                </span>
                              ) : isModerate ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-black text-[10px] bg-amber-500 text-white">
                                  TRUNG BÌNH
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-black text-[10px] bg-emerald-600 text-white">
                                  ỔN ĐỊNH
                                </span>
                              )}

                              {/* RV hôm nay / Dự kiến RV mai */}
                              {patient.admissionStatus === 'DISCHARGE_TODAY' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-black text-[10px] bg-purple-600 text-white shadow-2xs">
                                  RV hôm nay
                                </span>
                              )}
                              {patient.admissionStatus === 'DISCHARGE_TOMORROW' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-black text-[10px] bg-blue-600 text-white shadow-2xs">
                                  Dự kiến RV mai
                                </span>
                              )}

                              {/* Nhãn đặc biệt nếu có */}
                              {patient.tags?.map((tag) => {
                                const meta = CLINICAL_TAGS_META[tag];
                                if (!meta) return null;
                                return (
                                  <span
                                    key={tag}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${meta.badgeBg} text-white`}
                                    title={meta.description}
                                  >
                                    {meta.shortLabel}
                                  </span>
                                );
                              })}
                            </div>

                            {/* Row 5: Kế Hoạch Điều Trị (Hiển thị trực tiếp nội dung) */}
                            <div className="p-2 rounded-lg bg-blue-50/70 border border-blue-200/80 mb-2">
                              <div className="flex items-start gap-1.5">
                                <Stethoscope className="w-3.5 h-3.5 text-blue-700 shrink-0 mt-0.5" />
                                <p className="text-xs font-semibold text-blue-950 leading-relaxed line-clamp-3" title={currentPlan}>
                                  {currentPlan}
                                </p>
                              </div>
                            </div>

                            {/* Row 6: Ghi Chú và Bàn Giao (Hiển thị trực tiếp nội dung) */}
                            <div className="p-2 rounded-lg bg-amber-50/75 border border-amber-200/80 mb-3">
                              <div className="flex items-start gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                                <p className="text-xs font-medium text-amber-950 leading-relaxed line-clamp-3" title={currentNotes}>
                                  {currentNotes}
                                </p>
                              </div>
                            </div>

                          </div>

                          {/* Bottom Action Buttons: + Diễn Tiến & Chi Tiết */}
                          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
                            <button
                              type="button"
                              onClick={() => onOpenEvolution(patient)}
                              className="flex-1 py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-black text-xs shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                              title="Nhập diễn tiến và kế hoạch điều trị cho ngày hôm sau"
                            >
                              <Activity className="w-3.5 h-3.5 text-indigo-200" />
                              <span>+ Diễn Tiến</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onSelectPatient(patient)}
                              className="py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1"
                              title="Xem chi tiết hồ sơ bệnh nhân"
                            >
                              <FileEdit className="w-3.5 h-3.5 text-slate-500" />
                              <span>Chi tiết</span>
                            </button>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

      {/* Summary Footer */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
        <div>
          Buồng phòng Nhóm 1: <strong className="text-slate-800">{filteredPatients.length}</strong> bệnh nhân tại {roomGroups.length} buồng phòng
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-600" />
            <span>{criticalCount} ca nặng</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>{moderateCount} ca vừa</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-600" />
            <span>{dischargeTodayCount} ra viện hôm nay</span>
          </span>
        </div>
      </div>

    </div>
  );
};

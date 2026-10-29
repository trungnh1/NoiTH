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
  Printer,
  Database
} from 'lucide-react';
import { sortDoctorsAlphabetically } from '../utils/doctorSorter';
import { parseExcelAdmissionDate } from '../utils/excelParser';

// Rooms for Nhóm 1 (Khoa Nội Tổng Hợp: 703 -> 731 và bổ sung phòng 733)
export const GROUP_1_ROOM_NUMBERS = [
  '703', '704', '707', '705', '709', '711', '713', '715', '717', '718', '721', '725', '727', '729', '731', '733'
];

// Rooms for Nhóm Tim Mạch (Cardio: 735 -> 745)
export const CARDIO_ROOM_NUMBERS = [
  '735', '737', '739', '741', '743', '745'
];

// Rooms for Nhóm 2 (747 -> 757)
export const GROUP_2_ROOM_NUMBERS = [
  '747', '749', '751', '753', '755', '757'
];

export const ALL_ROOM_NUMBERS = [
  ...GROUP_1_ROOM_NUMBERS,
  ...CARDIO_ROOM_NUMBERS,
  ...GROUP_2_ROOM_NUMBERS,
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

// Bác sĩ Nhóm 2: Linh, Hoài, Mai, Ngoan, Chi
export const GROUP_2_DOCTOR_IDS = [
  '00161', // BS. Thái Thị Thùy Linh (Linh)
  '00146', // BS. Dương Thị Hoài (Hoài)
  '00318', // BS. Nguyễn Thị Ngọc Mai (Mai)
  '00176', // BS. Đỗ Thị Ngoan (Ngoan)
  '00769', // BS. Nguyễn Thị Phương Chi (Chi)
];

// Bác sĩ Tim Mạch: Nhật, Thọ, Thịnh, Lam
export const CARDIO_DOCTOR_IDS = [
  '00020', // BS. Nguyễn Văn Phương Nhật (Nhật)
  '00355', // BS. Võ Văn Thọ (Thọ)
  '00818', // BS. Võ Hồng Thịnh (Thịnh)
  '00929', // BS. Trương Hoài Lam (Lam)
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
  onEditPatient?: (patient: Patient) => void;
  onTransferPatient?: (patient: Patient) => void;
  onDischargePatient?: (patient: Patient) => void;
  onDeletePatient?: (patient: Patient) => void;
  onOpenPrintModal?: () => void;
  onAddPatient?: (patient: Patient) => void;
  onOpenSatelliteSync?: () => void;
  pendingSatelliteCount?: number;
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
    // Chuẩn hóa trước nếu là định dạng Excel hoặc chuỗi ngày đặc thù
    const normalized = parseExcelAdmissionDate(dateStr).formatted || dateStr;

    // DD/MM/YYYY or DD-MM-YYYY
    const dmy = normalized.match(/^(\d{1,2})[\/\-](\d{1,2})/);
    if (dmy) {
      return `NV: ${dmy[1].padStart(2, '0')}/${dmy[2].padStart(2, '0')}`;
    }
    // YYYY-MM-DD
    const ymd = normalized.match(/^\d{4}[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (ymd) {
      return `NV: ${ymd[2].padStart(2, '0')}/${ymd[1].padStart(2, '0')}`;
    }
    const d = new Date(normalized.replace(' ', 'T'));
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `NV: ${dd}/${mm}`;
    }
  } catch {
    // fallback
  }
  return `NV: ${String(dateStr).slice(0, 5)}`;
}

/**
 * Calculates number of treatment days from admissionDate to today (inclusive).
 * Format: "ngày ĐT: 03" with 2-digit padding.
 */
export function calculateTreatmentDays(admissionDateStr: string): { days: number; label: string } {
  if (!admissionDateStr) return { days: 1, label: 'ngày ĐT: 01' };
  try {
    const normalized = parseExcelAdmissionDate(admissionDateStr).formatted || admissionDateStr;
    let admDate: Date;

    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(normalized)) {
      const parts = normalized.split(/[ /\-:]/);
      admDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    } else {
      admDate = new Date(normalized.replace(' ', 'T'));
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
  onEditPatient,
  onTransferPatient,
  onDischargePatient,
  onDeletePatient,
  onOpenPrintModal,
  onAddPatient,
  onOpenSatelliteSync,
  pendingSatelliteCount,
}) => {
  const [selectedGroup, setSelectedGroup] = useState<'GROUP_1' | 'CARDIO' | 'GROUP_2' | 'ALL'>('GROUP_1');
  const [showEmptyRooms, setShowEmptyRooms] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | SeverityLevel | 'DISCHARGE_TODAY' | 'DISCHARGE_TOMORROW'>('ALL');
  const [doctorFilter, setDoctorFilter] = useState<string>('ALL');
  const [notification, setNotification] = useState<string | null>(null);
  const [hoveredPatientId, setHoveredPatientId] = useState<string | null>(null);

  // Group 1 doctors (Ngọc, Trung, Huyền, Thiên, Ánh, Bình Chi)
  const group1Doctors = useMemo(() => {
    const list = doctors.filter((d) => 
      (GROUP_1_DOCTOR_IDS.includes(d.id) || d.id === 'DOC-NGOC' || /trần hữu ngọc|nguyễn hữu trung|đỗ thị vân huyền|phạm cao thiên|đặng thị ngọc ánh|trần bùi bình chi/i.test(d.name)) &&
      !/tuế|quyên/i.test(d.name) && d.id !== '00101' && d.id !== '00199'
    );
    return sortDoctorsAlphabetically(list);
  }, [doctors]);

  // Group 2 doctors (Linh, Hoài, Mai, Ngoan, Chi)
  const group2Doctors = useMemo(() => {
    const list = doctors.filter((d) => 
      (GROUP_2_DOCTOR_IDS.includes(d.id) || /thái thị thùy linh|dương thị hoài|nguyễn thị ngọc mai|đỗ thị ngoan|nguyễn thị phương chi/i.test(d.name)) &&
      !/bình chi/i.test(d.name) &&
      !/tuế|quyên/i.test(d.name) && d.id !== '00101' && d.id !== '00199'
    );
    return sortDoctorsAlphabetically(list);
  }, [doctors]);

  // Cardio doctors (Nhật, Thọ, Thịnh, Lam)
  const cardioDoctors = useMemo(() => {
    const list = doctors.filter((d) => 
      (CARDIO_DOCTOR_IDS.includes(d.id) || /nguyễn văn phương nhật|võ văn thọ|võ hồng thịnh|trương hoài lam/i.test(d.name)) &&
      !/tuế|quyên/i.test(d.name) && d.id !== '00101' && d.id !== '00199'
    );
    return sortDoctorsAlphabetically(list);
  }, [doctors]);

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

  // Current room numbers for the selected clinical group
  const currentGroupRoomNumbers = useMemo(() => {
    if (selectedGroup === 'CARDIO') return CARDIO_ROOM_NUMBERS;
    if (selectedGroup === 'GROUP_2') return GROUP_2_ROOM_NUMBERS;
    if (selectedGroup === 'ALL') return ALL_ROOM_NUMBERS;
    return GROUP_1_ROOM_NUMBERS;
  }, [selectedGroup]);

  // Active inpatients - Filtered strictly to current group rooms
  const activeGroupPatients = useMemo(() => {
    return patients.filter((p) => {
      if (p.status !== 'ACTIVE') return false;
      const cleanRoom = p.roomNumber ? p.roomNumber.replace(/^(phòng|p\.?)\s*/i, '').trim() : '';
      return currentGroupRoomNumbers.includes(cleanRoom);
    });
  }, [patients, currentGroupRoomNumbers]);

  // Filtered patients based on user search and filters
  const filteredPatients = useMemo(() => {
    return activeGroupPatients.filter((p) => {
      // Status & Severity filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'DISCHARGE_TODAY') {
          if (p.admissionStatus !== 'DISCHARGE_TODAY') return false;
        } else if (statusFilter === 'DISCHARGE_TOMORROW') {
          if (p.admissionStatus !== 'DISCHARGE_TOMORROW') return false;
        } else if (statusFilter === 'UNCLASSIFIED') {
          if (p.severity && p.severity !== 'UNCLASSIFIED') return false;
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
  }, [activeGroupPatients, statusFilter, doctorFilter, searchTerm, doctorMap]);

  // Group patients by Room (Vertical List of Rooms for Selected Group)
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

    // Rooms to display: either all rooms in current group, or only rooms with patients (nút ẩn phòng trống)
    const roomsToRender = showEmptyRooms 
      ? currentGroupRoomNumbers 
      : currentGroupRoomNumbers.filter((r) => patientMap.has(r));

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
  }, [filteredPatients, doctorMap, roomDoctorAssignments, showEmptyRooms, currentGroupRoomNumbers]);

  // Handler for quick doctor assignment
  const handleQuickAssignDoctor = (roomNumber: string, doctorId: string) => {
    if (onAssignRoomDoctor) {
      onAssignRoomDoctor(roomNumber, doctorId);
      const doc = doctorMap.get(doctorId);
      setNotification(`Đã phân công BS. ${doc?.name || doctorId} phụ trách buồng Phòng ${roomNumber}`);
      setTimeout(() => setNotification(null), 3500);
    }
  };

  // Counters for the currently selected group
  const criticalCount = activeGroupPatients.filter((p) => p.severity === 'CRITICAL').length;
  const moderateCount = activeGroupPatients.filter((p) => p.severity === 'MODERATE').length;
  const stableCount = activeGroupPatients.filter((p) => p.severity === 'STABLE').length;
  const unclassifiedCount = activeGroupPatients.filter((p) => p.severity === 'UNCLASSIFIED' || !p.severity).length;
  const dischargeTodayCount = activeGroupPatients.filter((p) => p.admissionStatus === 'DISCHARGE_TODAY').length;
  const dischargeTomorrowCount = activeGroupPatients.filter((p) => p.admissionStatus === 'DISCHARGE_TOMORROW').length;

  // Active doctors currently treating patients in the selected group (sorted alphabetically by Vietnamese given name)
  const activeDoctorsWithCounts = useMemo(() => {
    const countsMap = new Map<string, { id: string; name: string; count: number }>();

    activeGroupPatients.forEach((p) => {
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
  }, [activeGroupPatients, doctorMap, doctors]);

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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3.5">
        
        {/* Row 1: Clinical Group Selector & Primary Actions */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-6 bg-[#0b4d8c] rounded-full" />
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Danh Sách Buồng Bệnh
              </h2>
            </div>

            {/* Clinical Group Tabs (Nhóm 1, Tim Mạch, Nhóm 2, Tất cả) */}
            <div className="inline-flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200 text-xs font-semibold gap-1">
              <button
                type="button"
                onClick={() => setSelectedGroup('GROUP_1')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedGroup === 'GROUP_1'
                    ? 'bg-[#0b4d8c] text-white font-bold shadow-xs'
                    : 'text-slate-700 hover:text-[#0b4d8c] hover:bg-white/80'
                }`}
                title="Nhóm 1: Phòng 703 - 731 & 733 (16 phòng)"
              >
                <span>Nhóm 1 (16P)</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedGroup('CARDIO')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedGroup === 'CARDIO'
                    ? 'bg-[#0b4d8c] text-white font-bold shadow-xs'
                    : 'text-slate-700 hover:text-[#0b4d8c] hover:bg-white/80'
                }`}
                title="Nhóm Tim Mạch: Phòng 735 - 745 (6 phòng)"
              >
                <span>Tim Mạch (6P)</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedGroup('GROUP_2')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedGroup === 'GROUP_2'
                    ? 'bg-[#0b4d8c] text-white font-bold shadow-xs'
                    : 'text-slate-700 hover:text-[#0b4d8c] hover:bg-white/80'
                }`}
                title="Nhóm 2: Phòng 747 - 757 (6 phòng)"
              >
                <span>Nhóm 2 (6P)</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedGroup('ALL')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedGroup === 'ALL'
                    ? 'bg-[#0b4d8c] text-white font-bold shadow-xs'
                    : 'text-slate-700 hover:text-[#0b4d8c] hover:bg-white/80'
                }`}
                title="Tất cả các phòng trong khoa (28 phòng)"
              >
                <span>Tất cả (28P)</span>
              </button>
            </div>

            <span className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-[#0b4d8c] border border-blue-200 font-black">
              {activeGroupPatients.length} BN
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onOpenPrintModal && (
              <button
                type="button"
                onClick={onOpenPrintModal}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                title="In danh sách bệnh nhân"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>In DS</span>
              </button>
            )}

            {/* Toggle Empty Rooms */}
            <button
              type="button"
              onClick={() => setShowEmptyRooms(!showEmptyRooms)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                !showEmptyRooms 
                  ? 'bg-[#0b4d8c] text-white border-[#0b4d8c] shadow-xs' 
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
              }`}
              title={showEmptyRooms ? 'Ẩn các buồng phòng hiện chưa có bệnh nhân' : 'Hiển thị tất cả các buồng phòng'}
            >
              <Users className="w-3.5 h-3.5 text-current" />
              <span>{showEmptyRooms ? 'Ẩn phòng trống' : `Hiện phòng trống (${currentGroupRoomNumbers.length})`}</span>
            </button>

            {onOpenSatelliteSync && (
              <button
                type="button"
                onClick={onOpenSatelliteSync}
                className="px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-[#0b4d8c] border border-blue-200 font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-98"
                title="Lấy dữ liệu bệnh nhân tự động từ Cloud Firestore lâm sàng vệ tinh"
              >
                <Database className="w-3.5 h-3.5 text-[#0b4d8c]" />
                <span>Lấy dữ liệu BN</span>
                {Boolean(pendingSatelliteCount && pendingSatelliteCount > 0) && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white font-black text-[10px]">
                    {pendingSatelliteCount}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onOpenNewPatient}
              className="px-3.5 py-1.5 bg-gradient-to-r from-[#0b4d8c] to-[#083a69] hover:from-[#094178] hover:to-[#062c52] text-white font-black text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-98"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Tiếp Nhận BN Mới</span>
            </button>
          </div>
        </div>

        {/* Row 2: Doctor Filter Chips */}
        <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-xs font-black text-slate-500 uppercase tracking-wide flex items-center gap-1">
            <Stethoscope className="w-3.5 h-3.5 text-[#0b4d8c]" />
            Bác sĩ:
          </span>
          {activeDoctorsWithCounts.map((docItem) => {
            const isSelected = doctorFilter === docItem.id;
            const parts = docItem.name.trim().split(/\s+/);
            const shortName = parts.length > 2 && /bình chi/i.test(docItem.name) 
              ? 'Bình Chi' 
              : parts[parts.length - 1];

            return (
              <button
                key={docItem.id}
                type="button"
                onClick={() => setDoctorFilter(isSelected ? 'ALL' : docItem.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  isSelected 
                    ? 'bg-[#0b4d8c] text-white border-[#0b4d8c] shadow-xs' 
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span>BS. {shortName}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                }`}>
                  {docItem.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Row 3: Search Bar & Severity Filters */}
        <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px] max-w-lg">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên bệnh nhân, phòng, chẩn đoán, kế hoạch, bác sĩ..."
              className="w-full pl-10 pr-9 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0b4d8c]/30 font-medium transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Severity & Status Filters */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer border ${
                statusFilter === 'ALL'
                  ? 'bg-[#0b4d8c] text-white border-[#0b4d8c] shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Tất cả ({activeGroupPatients.length})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('CRITICAL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 border ${
                statusFilter === 'CRITICAL'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                  : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span>Nặng ({criticalCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('MODERATE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 border ${
                statusFilter === 'MODERATE'
                  ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                  : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Vừa ({moderateCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('STABLE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 border ${
                statusFilter === 'STABLE'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Ổn định ({stableCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('UNCLASSIFIED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 border ${
                statusFilter === 'UNCLASSIFIED'
                  ? 'bg-slate-700 text-white border-slate-700 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>Chưa phân loại ({unclassifiedCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('DISCHARGE_TOMORROW')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 border ${
                statusFilter === 'DISCHARGE_TOMORROW'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Dự RV mai ({dischargeTomorrowCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('DISCHARGE_TODAY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 border ${
                statusFilter === 'DISCHARGE_TODAY'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                  : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50'
              }`}
            >
              <span>RV hôm nay ({dischargeTodayCount})</span>
            </button>

            {(searchTerm || statusFilter !== 'ALL' || doctorFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('ALL');
                  setDoctorFilter('ALL');
                }}
                className="text-xs text-rose-600 hover:underline font-bold px-2 py-1 cursor-pointer"
              >
                Xóa lọc
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Main Vertical List of Rooms */}
      {roomGroups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 shadow-sm">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-extrabold text-slate-800 text-base">
            Không tìm thấy bệnh nhân nào trong {selectedGroup === 'CARDIO' ? 'Nhóm Tim Mạch' : selectedGroup === 'GROUP_2' ? 'Nhóm 2' : selectedGroup === 'ALL' ? 'Toàn Khoa' : 'Nhóm 1'} theo bộ lọc hiện tại.
          </p>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Bấm "Hiện phòng trống" để hiển thị tất cả các buồng phòng hoặc bấm "+ Tiếp Nhận BN Mới".
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {roomGroups.map((group) => {
            return (
              <div 
                key={group.roomNumber}
                className="bg-white rounded-2xl border border-slate-200/70 shadow-2xs overflow-hidden"
              >
                {/* 1. Header: Số phòng - Bs điều trị - Màu nhạt nhẹ nhàng, thanh thoát, không đóng khung tối */}
                <div className="bg-slate-50/80 text-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100">
                  
                  {/* Left: Phòng & Chọn nhanh Bác Sĩ Điều Trị */}
                  <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#0b4d8c]" />
                      <span className="text-[#0b4d8c] font-black text-base sm:text-lg tracking-tight">
                        Phòng {group.roomNumber}
                      </span>
                    </div>
                    <span className="text-slate-300 font-light">•</span>
                    
                    {/* Quick Doctor Selector */}
                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-blue-300 rounded-lg px-2.5 py-1 transition-colors shadow-2xs">
                      <Stethoscope className="w-4 h-4 text-[#0b4d8c] shrink-0" />
                      <span className="text-slate-500 text-xs font-semibold hidden sm:inline">
                        BS phụ trách:
                      </span>
                      <select
                        value={group.assignedDoctorId || ''}
                        onChange={(e) => handleQuickAssignDoctor(group.roomNumber, e.target.value)}
                        className="bg-transparent text-slate-800 font-bold text-xs focus:outline-hidden cursor-pointer"
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
                        <optgroup label="Bác sĩ Nhóm 2 (Linh, Hoài, Mai, Ngoan, Chi)" className="text-slate-900 bg-white font-bold">
                          {group2Doctors.map((doc) => (
                            <option key={doc.id} value={doc.id}>
                              BS. {formatDoctorShortName(doc.name)}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Bác sĩ Tim Mạch (Nhật, Thọ, Thịnh, Lam)" className="text-slate-900 bg-white font-bold">
                          {cardioDoctors.map((doc) => (
                            <option key={doc.id} value={doc.id}>
                              BS. {formatDoctorShortName(doc.name)}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    {group.assignedDoctorName && (
                      <span className="text-xs text-[#0b4d8c] font-bold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md hidden md:inline">
                        {group.assignedDoctorName}
                      </span>
                    )}
                  </div>

                  {/* Right: Số lượng bệnh nhân & Nút + Thêm BN */}
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-white text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs">
                      {group.patients.length} bệnh nhân
                    </span>
                    {onOpenNewPatientForRoom && (
                      <button
                        type="button"
                        onClick={() => onOpenNewPatientForRoom(group.roomNumber)}
                        className="px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                        title={`Tiếp nhận bệnh nhân mới vào Phòng ${group.roomNumber}`}
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Thêm BN</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. 3-Column Patient Grid: 3 cột là 3 bệnh nhân, 6 bệnh nhân là 2 dòng 3 cột */}
                {group.patients.length === 0 ? (
                  <div className="p-8 bg-slate-50/70 text-center">
                    <p className="text-xs sm:text-sm text-slate-500 font-medium mb-3">
                      Phòng {group.roomNumber} hiện chưa có bệnh nhân nội trú.
                    </p>
                    {onOpenNewPatientForRoom && (
                      <button
                        type="button"
                        onClick={() => onOpenNewPatientForRoom(group.roomNumber)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-dashed border-[#0b4d8c]/40 text-[#0b4d8c] bg-white hover:bg-blue-50 text-xs sm:text-sm font-bold transition-colors cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-4 h-4" />
                        <span>+ Tiếp nhận bệnh nhân vào Phòng {group.roomNumber}</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-100/50">
                    {group.patients.map((patient) => {
                      const isCritical = patient.severity === 'CRITICAL';
                      const isModerate = patient.severity === 'MODERATE';
                      const isDischargeTomorrow = patient.admissionStatus === 'DISCHARGE_TOMORROW';
                      const isUnclassified = patient.severity === 'UNCLASSIFIED' || !patient.severity;
                      const isStable = patient.severity === 'STABLE';
                      const treatmentInfo = calculateTreatmentDays(patient.admissionDate);
                      
                      // Màu sắc tên Bệnh Nhân theo tình trạng bệnh lâm sàng
                      const nameColorClass = isCritical
                        ? 'text-rose-700'
                        : isModerate
                        ? 'text-amber-700'
                        : isDischargeTomorrow
                        ? 'text-blue-700'
                        : isUnclassified
                        ? 'text-slate-800'
                        : 'text-emerald-800';

                      // Card left border accent
                      const cardBorderAccentClass = isCritical
                        ? 'border-l-[6px] border-l-rose-500 ring-1 ring-rose-200/70'
                        : isModerate
                        ? 'border-l-[6px] border-l-amber-500 ring-1 ring-amber-200/50'
                        : isDischargeTomorrow
                        ? 'border-l-[6px] border-l-blue-500 ring-1 ring-blue-200/50'
                        : isUnclassified
                        ? 'border-l-[6px] border-l-slate-400 ring-1 ring-slate-200/50'
                        : 'border-l-[6px] border-l-emerald-500 ring-1 ring-emerald-200/50';

                      // Combined unified diagnosis
                      const combinedDiagnosis = formatCombinedDiagnosis(patient);

                      // Plan of treatment: explicit plan or newest evolution action (BỎ hoàn toàn dòng Chăm sóc cấp 2 mặc định)
                      const currentPlan = patient.treatmentPlan || 
                        patient.evolutions?.[0]?.treatmentAction || 
                        patient.initialMedicationsText || 
                        '';

                      // Notes and handover:
                      const currentNotes = patient.importantNotes || 
                        patient.handoverNotes || 
                        (patient.evolutions?.[0]?.clinicalNote ? `Diễn biến: ${patient.evolutions[0].clinicalNote}` : '');

                      return (
                        <div
                          key={patient.id}
                          className={`bg-white rounded-2xl border border-slate-200 ${cardBorderAccentClass} p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-all duration-150`}
                        >
                          {/* Top Content */}
                          <div>
                            
                            {/* Row 1: Tên Bệnh Nhân - Đổi màu theo tình trạng bệnh & Nhãn trạng thái */}
                            <div className="pb-3 border-b border-slate-100 flex items-start justify-between gap-2">
                              <div 
                                onClick={() => onSelectPatient(patient)}
                                onMouseEnter={() => setHoveredPatientId(patient.id)}
                                onMouseLeave={() => setHoveredPatientId(null)}
                                className="cursor-pointer group flex-1 min-w-[130px] relative"
                              >
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className={`text-base sm:text-lg font-black tracking-tight uppercase leading-snug group-hover:underline transition-colors ${nameColorClass}`}>
                                    {patient.fullName}
                                  </h4>
                                  {isCritical && (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-rose-600 text-white shrink-0 shadow-xs">
                                      Nặng
                                    </span>
                                  )}
                                  {isModerate && (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500 text-white shrink-0 shadow-xs">
                                      Vừa
                                    </span>
                                  )}
                                  {isDischargeTomorrow && (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-blue-600 text-white shrink-0 shadow-xs">
                                      Dự RV mai
                                    </span>
                                  )}
                                  {isUnclassified && (
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700 shrink-0">
                                      Chưa phân loại
                                    </span>
                                  )}
                                  {isStable && (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-600 text-white shrink-0 shadow-xs">
                                      Ổn
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 font-bold mt-1">
                                  <span>{patient.age} tuổi</span>
                                  <span>•</span>
                                  <span>{patient.gender}</span>
                                  {patient.bedNumber && (
                                    <>
                                      <span>•</span>
                                      <span className="text-[#0b4d8c] font-black">{patient.bedNumber}</span>
                                    </>
                                  )}
                                </div>

                                {/* Hover Preview Popover Card: Hiện nhiều nội dung lâm sàng khi lướt vào tên */}
                                {hoveredPatientId === patient.id && (
                                  <div className="absolute left-0 top-full mt-2 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-blue-200 p-4 space-y-2.5 text-xs animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                      <div>
                                        <div className={`font-black text-sm uppercase ${nameColorClass}`}>
                                          {patient.fullName}
                                        </div>
                                        <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
                                          {patient.gender} • {patient.age} tuổi • Phòng {patient.roomNumber} {patient.bedNumber ? `- ${patient.bedNumber}` : ''}
                                        </div>
                                      </div>
                                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-blue-50 text-[#0b4d8c] border border-blue-200">
                                        {treatmentInfo.label}
                                      </span>
                                    </div>

                                    {/* Chẩn đoán lâm sàng */}
                                    <div className="space-y-0.5 bg-blue-50/70 p-2.5 rounded-xl border border-blue-100">
                                      <span className="text-[10px] font-black uppercase text-[#0b4d8c] tracking-wider block">
                                        Chẩn đoán lâm sàng:
                                      </span>
                                      <p className="font-bold text-slate-900 leading-snug">
                                        {combinedDiagnosis}
                                      </p>
                                    </div>

                                    {/* Sinh hiệu gần nhất */}
                                    {patient.vitals && patient.vitals.length > 0 && (
                                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                                        <div className="text-[10px] font-black uppercase text-slate-500 mb-1.5 flex items-center justify-between">
                                          <span>Sinh hiệu ({patient.vitals[0].timestamp?.slice(11, 16) || 'Mới nhất'}):</span>
                                        </div>
                                        <div className="grid grid-cols-4 gap-1 text-center">
                                          <div className="bg-white p-1 rounded-lg border border-slate-200">
                                            <span className="block text-[9px] text-slate-400 font-bold">HA</span>
                                            <span className="font-black text-slate-800">{patient.vitals[0].bpSystolic}/{patient.vitals[0].bpDiastolic}</span>
                                          </div>
                                          <div className="bg-white p-1 rounded-lg border border-slate-200">
                                            <span className="block text-[9px] text-slate-400 font-bold">Mạch</span>
                                            <span className="font-black text-slate-800">{patient.vitals[0].heartRate}</span>
                                          </div>
                                          <div className="bg-white p-1 rounded-lg border border-slate-200">
                                            <span className="block text-[9px] text-slate-400 font-bold">SpO2</span>
                                            <span className="font-black text-slate-800">{patient.vitals[0].spO2}%</span>
                                          </div>
                                          <div className="bg-white p-1 rounded-lg border border-slate-200">
                                            <span className="block text-[9px] text-slate-400 font-bold">Thân nhiệt</span>
                                            <span className="font-black text-slate-800">{patient.vitals[0].temperature}°C</span>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Tiền sử & Dị ứng */}
                                    {(patient.medicalHistory || patient.allergies) && (
                                      <div className="text-[11px] text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-200 space-y-1">
                                        {patient.medicalHistory && (
                                          <p><strong className="text-slate-900 font-bold">Tiền sử:</strong> {patient.medicalHistory}</p>
                                        )}
                                        {patient.allergies && (
                                          <p className="text-rose-700 font-bold"><strong className="text-rose-800">Dị ứng:</strong> {patient.allergies}</p>
                                        )}
                                      </div>
                                    )}

                                    {/* Hướng xử trí & Kế hoạch */}
                                    <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200">
                                      <span className="block text-[10px] font-black uppercase text-emerald-800 mb-0.5">
                                        Hướng xử trí & Kế hoạch:
                                      </span>
                                      <p className="text-[11px] font-semibold text-slate-800 leading-relaxed line-clamp-3">
                                        {currentPlan}
                                      </p>
                                    </div>

                                    {/* Ghi chú hoặc Diễn biến gần nhất */}
                                    {patient.evolutions && patient.evolutions.length > 0 && patient.evolutions[0].clinicalNote && (
                                      <div className="text-[11px] text-slate-700 bg-amber-50/60 p-2 rounded-xl border border-amber-200">
                                        <span className="block text-[10px] font-black uppercase text-amber-900 mb-0.5">
                                          Diễn biến gần nhất ({patient.evolutions[0].timestamp?.slice(5, 16) || ''}):
                                        </span>
                                        <p className="italic text-slate-800 line-clamp-2">
                                          "{patient.evolutions[0].clinicalNote}"
                                        </p>
                                      </div>
                                    )}

                                    <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                                      <span>BS: <strong>{doctorMap.get(patient.attendingDoctorId)?.name || 'BS Điều trị'}</strong></span>
                                      <span className="text-[#0b4d8c] font-bold">Bấm để mở trượt bên phải ➔</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Row 2: Ngày Vào (NV: DD/MM) & Số Ngày ĐT (ngày ĐT: XX) */}
                            <div className="flex items-center justify-between text-xs sm:text-sm py-2 text-slate-700 border-b border-slate-100 font-bold">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                                <span>{formatAdmissionDateShort(patient.admissionDate)}</span>
                              </div>
                              <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-800 font-extrabold text-xs border border-slate-200">
                                {treatmentInfo.label}
                              </span>
                            </div>

                            {/* Row 3: Chẩn Đoán Lâm Sàng */}
                            <div className="py-2.5">
                              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 shadow-2xs">
                                <div className="text-[11px] font-black uppercase text-[#0b4d8c] tracking-wider mb-1 flex items-center gap-1">
                                  <Activity className="w-3.5 h-3.5" />
                                  Chẩn đoán:
                                </div>
                                <p className="font-bold text-xs sm:text-sm text-slate-900 leading-relaxed" title={combinedDiagnosis}>
                                  {combinedDiagnosis}
                                </p>
                              </div>
                            </div>

                            {/* Row 4: Tình Trạng & Nhãn Đặc Biệt */}
                            <div className="flex flex-wrap items-center gap-1.5 pb-2.5">
                              {/* Mức độ nặng/vừa/chưa phân loại/ổn định */}
                              {isCritical ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-black text-xs bg-rose-50 text-rose-700 border border-rose-300">
                                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                                  NẶNG
                                </span>
                              ) : isModerate ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-black text-xs bg-amber-50 text-amber-800 border border-amber-300">
                                  VỪA
                                </span>
                              ) : isUnclassified ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-black text-xs bg-slate-100 text-slate-700 border border-slate-300">
                                  CHƯA PHÂN LOẠI
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-black text-xs bg-emerald-50 text-emerald-800 border border-emerald-300">
                                  ỔN ĐỊNH
                                </span>
                              )}

                              {/* RV hôm nay / Dự kiến RV mai */}
                              {patient.admissionStatus === 'DISCHARGE_TODAY' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-black text-xs bg-purple-50 text-purple-700 border border-purple-300">
                                  RV hôm nay
                                </span>
                              )}
                              {patient.admissionStatus === 'DISCHARGE_TOMORROW' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-black text-xs bg-blue-50 text-blue-700 border border-blue-300">
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
                                    className="px-2 py-0.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200"
                                    title={meta.description}
                                  >
                                    {meta.shortLabel}
                                  </span>
                                );
                              })}
                            </div>

                            {/* Row 5: Kế Hoạch & Hướng Xử Trí */}
                            {currentPlan ? (
                              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 mb-2.5 shadow-2xs">
                                <div className="text-[11px] font-black uppercase text-emerald-800 tracking-wider mb-1 flex items-center gap-1">
                                  <Stethoscope className="w-3.5 h-3.5" />
                                  Hướng xử trí & Kế hoạch:
                                </div>
                                <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed line-clamp-3" title={currentPlan}>
                                  {currentPlan}
                                </p>
                              </div>
                            ) : (
                              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 mb-2.5 shadow-2xs flex items-center justify-between text-slate-500">
                                <div className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                                  <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
                                  Kế hoạch:
                                </div>
                                <span className="text-xs italic text-slate-400">Chưa có y lệnh điều trị</span>
                              </div>
                            )}

                            {/* Row 6: Ghi Chú và Bàn Giao (chỉ hiển thị nếu có ghi chú thực tế) */}
                            {currentNotes && (
                              <div className="p-2.5 rounded-xl bg-amber-50/50 border border-amber-200/70 mb-3.5 shadow-2xs">
                                <div className="text-[11px] font-bold text-amber-900 tracking-wider mb-0.5 flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                  Ghi chú lâm sàng / bàn giao:
                                </div>
                                <p className="text-xs font-medium text-slate-700 leading-relaxed line-clamp-3" title={currentNotes}>
                                  {currentNotes}
                                </p>
                              </div>
                            )}

                          </div>

                          {/* Bottom Action Buttons: + Diễn Tiến, Chi Tiết, Sửa, Chuyển, Ra viện, Xóa */}
                          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5 mt-auto">
                            <button
                              type="button"
                              onClick={() => onOpenEvolution(patient)}
                              className="py-1.5 px-3 bg-gradient-to-r from-[#0b4d8c] to-[#083a69] hover:from-[#094178] hover:to-[#062c52] text-white rounded-xl font-black text-xs shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0"
                              title="Nhập diễn tiến và hướng xử trí / kế hoạch điều trị"
                            >
                              <Activity className="w-3.5 h-3.5 text-white" />
                              <span>+ Diễn Tiến</span>
                            </button>

                            <div className="flex items-center gap-1 flex-wrap shrink-0">
                              <button
                                type="button"
                                onClick={() => onSelectPatient(patient)}
                                className="py-1.5 px-2 bg-white hover:bg-blue-50 hover:text-[#0b4d8c] text-slate-700 border border-slate-200 hover:border-blue-300 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="Xem chi tiết hồ sơ bệnh nhân"
                              >
                                <FileEdit className="w-3 h-3" />
                                <span>Chi tiết</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onEditPatient) onEditPatient(patient);
                                  else onSelectPatient(patient);
                                }}
                                className="py-1.5 px-2 bg-white hover:bg-amber-50 hover:text-amber-800 text-slate-700 border border-slate-200 hover:border-amber-300 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                                title="Chỉnh sửa thông tin bệnh nhân"
                              >
                                <FileEdit className="w-3 h-3" />
                                <span>Sửa</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onTransferPatient) onTransferPatient(patient);
                                }}
                                className="py-1.5 px-2 bg-white hover:bg-indigo-50 hover:text-indigo-800 text-slate-700 border border-slate-200 hover:border-indigo-300 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                                title="Chuyển bệnh nhân sang buồng phòng khác"
                              >
                                <ArrowRightLeft className="w-3 h-3" />
                                <span>Chuyển</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onDischargePatient) onDischargePatient(patient);
                                }}
                                className="py-1.5 px-2 bg-white hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 border border-slate-200 hover:border-emerald-300 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                                title="Bấm đã ra viện (rời khỏi buồng phòng)"
                              >
                                <LogOut className="w-3 h-3" />
                                <span>Ra viện</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onDeletePatient) onDeletePatient(patient);
                                }}
                                className="py-1.5 px-2 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 text-slate-400 border border-slate-200 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                                title="Xóa bệnh nhân khỏi hệ thống"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Xóa</span>
                              </button>
                            </div>
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
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-slate-600 shadow-sm">
        <div>
          Buồng phòng {selectedGroup === 'CARDIO' ? 'Nhóm Tim Mạch' : selectedGroup === 'GROUP_2' ? 'Nhóm 2' : selectedGroup === 'ALL' ? 'Toàn Khoa' : 'Nhóm 1'}: <strong className="text-slate-900 font-black">{filteredPatients.length}</strong> bệnh nhân tại <strong className="text-slate-900 font-black">{roomGroups.length}</strong> buồng phòng
        </div>
        <div className="flex items-center gap-3 font-bold">
          <span className="flex items-center gap-1.5 text-rose-700">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
            <span>{criticalCount} ca nặng</span>
          </span>
          <span className="flex items-center gap-1.5 text-amber-700">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>{moderateCount} ca vừa</span>
          </span>
          <span className="flex items-center gap-1.5 text-blue-700">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
            <span>{dischargeTomorrowCount} dự RV mai</span>
          </span>
          <span className="flex items-center gap-1.5 text-purple-700">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
            <span>{dischargeTodayCount} ra viện hôm nay</span>
          </span>
        </div>
      </div>

    </div>
  );
};

import { formatPatientDisplayName } from '../utils/storage';
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
  ChevronDown,
  X,
  Building2,
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
  Database,
  AlertTriangle,
  Clock,
  Filter
} from 'lucide-react';
import { sortDoctorsAlphabetically } from '../utils/doctorSorter';
import { parseExcelAdmissionDate } from '../utils/excelParser';
import { isRealAllergy } from '../utils/clinicalTextParser';
import { 
  normalizeSearchText, 
  extractSearchRoomNumber, 
  isRoomNumberMatch, 
  matchesPatientSearch 
} from '../utils/searchUtils';

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
  '743',
  ...GROUP_1_ROOM_NUMBERS,
  ...GROUP_2_ROOM_NUMBERS,
  ...CARDIO_ROOM_NUMBERS.filter((r) => r !== '743'),
];

/**
 * Returns the clinical group badge label and key for any room number
 */
export function getRoomGroupName(roomNumber: string): { label: string; groupKey: 'GROUP_1' | 'GROUP_2' | 'CARDIO' } {
  const clean = roomNumber.replace(/^(phòng|p\.?|buồng|b\.?)\s*/i, '').trim();
  if (GROUP_2_ROOM_NUMBERS.includes(clean)) {
    return { label: 'Nhóm 2', groupKey: 'GROUP_2' };
  }
  if (CARDIO_ROOM_NUMBERS.includes(clean)) {
    return { label: 'Tim Mạch', groupKey: 'CARDIO' };
  }
  return { label: 'Nhóm 1', groupKey: 'GROUP_1' };
}

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
  currentUser?: Doctor | null;
  onAssignRoomDoctor?: (roomNumber: string, doctorId: string) => void;
  onOpenNewPatient: () => void;
  onOpenNewPatientForRoom?: (roomNumber: string) => void;
  onOpenEvolution: (patient: Patient) => void;
  onSelectPatient: (patient: Patient) => void;
  onEditPatient?: (patient: Patient) => void;
  onTransferPatient?: (patient: Patient) => void;
  onDischargePatient?: (patient: Patient) => void;
  onDeletePatient?: (patient: Patient) => void;
  onDeleteAllPatients?: () => void;
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

/**
 * Lấy chẩn đoán cập nhật mới nhất của bệnh nhân (từ diễn tiến mới nhất hoặc chẩn đoán ban đầu)
 */
export function getLatestDiagnosis(patient: Patient): string {
  // 1. Kiểm tra diễn tiến mới nhất có chẩn đoán cập nhật không
  if (patient.evolutions && patient.evolutions.length > 0) {
    for (const evo of patient.evolutions) {
      const evoDiag = (evo as any).diagnosis || (evo as any).primaryDiagnosis;
      if (evoDiag && typeof evoDiag === 'string' && evoDiag.trim()) {
        return evoDiag.trim();
      }
    }
  }
  // 2. Chẩn đoán đầy đủ kết hợp
  return formatCombinedDiagnosis(patient);
}

/**
 * Định dạng ngày nhập viện hiển thị rõ ràng: DD/MM/YYYY
 */
export function formatAdmissionDateDisplay(dateStr: string): string {
  if (!dateStr) return '--/--/----';
  try {
    const normalized = parseExcelAdmissionDate(dateStr).formatted || dateStr;
    const ymd = normalized.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (ymd) {
      return `${ymd[3].padStart(2, '0')}/${ymd[2].padStart(2, '0')}/${ymd[1]}`;
    }
    const dmy = normalized.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmy) {
      return `${dmy[1].padStart(2, '0')}/${dmy[2].padStart(2, '0')}/${dmy[3]}`;
    }
    const d = new Date(normalized.replace(' ', 'T'));
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yy = d.getFullYear();
      return `${dd}/${mm}/${yy}`;
    }
  } catch {
    // fallback
  }
  return dateStr.slice(0, 10);
}

/**
 * Kiểm tra xem bệnh nhân có nhập viện từ 16h30 tối hôm trước tới thời điểm hiện tại không
 */
export function isNewAdmissionFromYesterday1630(admissionDateStr: string): boolean {
  if (!admissionDateStr) return false;
  try {
    const normalized = parseExcelAdmissionDate(admissionDateStr).formatted || admissionDateStr;
    let admDate: Date;
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(normalized)) {
      const parts = normalized.split(/[ /\-:]/);
      admDate = new Date(
        Number(parts[2]),
        Number(parts[1]) - 1,
        Number(parts[0]),
        Number(parts[3] || 8),
        Number(parts[4] || 0)
      );
    } else {
      admDate = new Date(normalized.replace(' ', 'T'));
    }
    if (isNaN(admDate.getTime())) return false;

    const now = new Date();
    // 16:30 yesterday
    const yesterday1630 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 16, 30, 0, 0);

    return admDate.getTime() >= yesterday1630.getTime();
  } catch {
    return false;
  }
}

/**
 * Trích xuất các cảnh báo cận lâm sàng bất thường nặng, nguy hiểm (Panic Values)
 */
export function getCriticalLabAlerts(patient: Patient): string[] {
  const alerts: string[] = [];

  // 1. Kiểm tra mảng kết quả xét nghiệm (labs)
  if (patient.labs && patient.labs.length > 0) {
    patient.labs.forEach((lab) => {
      if (lab.isPanicValue) {
        alerts.push(`${lab.testName}: ${lab.value} ${lab.unit} (Ngưỡng báo động đỏ)`);
      } else if (lab.isAbnormal) {
        const numVal = parseFloat(lab.value.replace(/[^0-9.]/g, ''));
        const nameLower = lab.testName.toLowerCase();

        if (nameLower.includes('k+') || nameLower.includes('kali')) {
          if (!isNaN(numVal) && (numVal < 3.0 || numVal > 5.5)) {
            alerts.push(`Kali máu (K+): ${lab.value} ${lab.unit} (${numVal < 3.0 ? 'Hạ Kali nguy hiểm' : 'Tăng Kali nguy hiểm'})`);
          }
        } else if (nameLower.includes('na+') || nameLower.includes('natri')) {
          if (!isNaN(numVal) && (numVal < 125 || numVal > 155)) {
            alerts.push(`Natri máu (Na+): ${lab.value} ${lab.unit} (Rối loạn điện giải nặng)`);
          }
        } else if (nameLower.includes('plt') || nameLower.includes('tiểu cầu') || nameLower.includes('platelet')) {
          if (!isNaN(numVal) && numVal < 50) {
            alerts.push(`Tiểu cầu (PLT): ${lab.value} G/L (Giảm tiểu cầu nặng < 50)`);
          }
        } else if (nameLower.includes('glucose') || nameLower.includes('đường huyết')) {
          if (!isNaN(numVal) && (numVal < 3.0 || numVal > 18)) {
            alerts.push(`Đường huyết: ${lab.value} mmol/L (${numVal < 3.0 ? 'Hạ đường huyết' : 'Tăng đường huyết cấp'})`);
          }
        } else if (nameLower.includes('troponin')) {
          alerts.push(`${lab.testName}: ${lab.value} (Troponin tăng - Nghi ngờ NMCT)`);
        } else if (nameLower.includes('ns1') || nameLower.includes('dengue')) {
          if (/dương|pos/i.test(lab.value)) {
            alerts.push(`Test NS1Ag: DƯƠNG TÍNH (Sốt xuất huyết Dengue)`);
          }
        }
      }
    });
  }

  // 2. Kiểm tra văn bản CLS ban đầu (initialLabsText)
  if (patient.initialLabsText) {
    const text = patient.initialLabsText;
    if (/dengue.*dương tính|ns1.*dương tính/i.test(text)) {
      if (!alerts.some((a) => a.includes('Dengue') || a.includes('NS1'))) {
        alerts.push('Dengue virus NS1Ag: DƯƠNG TÍNH (Sốt xuất huyết Dengue)');
      }
    }
    if (/huyết khối/i.test(text)) {
      alerts.push('Hình ảnh siêu âm: Có huyết khối mạch máu');
    }
    if (/hẹp\s*(khoảng\s*)?4\d%|hẹp\s*(khoảng\s*)?[5-9]\d%|hẹp nặng/i.test(text)) {
      const matchHep = text.match(/hẹp\s*[^;\.\n]+/i);
      alerts.push(matchHep ? matchHep[0].trim() : 'Hẹp lòng động mạch đáng kể');
    }
    if (/platelets[^:]*:\s*([1-4]\d)\b/i.test(text)) {
      const matchPlt = text.match(/platelets[^:]*:\s*([1-4]\d)\b/i);
      if (matchPlt && !alerts.some((a) => a.includes('Tiểu cầu'))) {
        alerts.push(`Tiểu cầu (PLT) giảm thấp: ${matchPlt[1]} G/L`);
      }
    }
    if (/k\+:\s*([12]\.\d+)\b/i.test(text)) {
      const matchK = text.match(/k\+:\s*([12]\.\d+)\b/i);
      if (matchK && !alerts.some((a) => a.includes('Kali'))) {
        alerts.push(`Hạ Kali máu: K+ = ${matchK[1]} mmol/L`);
      }
    }
  }

  // 3. Cảnh báo mức độ nghiêm trọng từ AI Analysis (nếu có)
  if (patient.aiAnalysis?.clinicalAlerts) {
    patient.aiAnalysis.clinicalAlerts
      .filter((a) => a.type === 'critical')
      .forEach((a) => {
        if (!alerts.includes(a.message)) {
          alerts.push(a.message);
        }
      });
  }

  return Array.from(new Set(alerts));
}

export const DetailedPatientListView: React.FC<DetailedPatientListViewProps> = ({
  patients,
  doctors,
  rooms = [],
  roomDoctorAssignments = {},
  currentUser,
  onAssignRoomDoctor,
  onOpenNewPatient,
  onOpenNewPatientForRoom,
  onOpenEvolution,
  onSelectPatient,
  onEditPatient,
  onTransferPatient,
  onDischargePatient,
  onDeletePatient,
  onDeleteAllPatients,
  onOpenPrintModal,
  onAddPatient,
  onOpenSatelliteSync,
  pendingSatelliteCount,
}) => {
  const [selectedGroup, setSelectedGroup] = useState<'ALL' | 'GROUP_1' | 'GROUP_2' | 'CARDIO'>('ALL');
  const [showEmptyRooms, setShowEmptyRooms] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | SeverityLevel | 'DISCHARGE_TODAY' | 'DISCHARGE_TOMORROW'>('ALL');
  const [doctorFilter, setDoctorFilter] = useState<string>('ALL');
  const [tagFilter, setTagFilter] = useState<'ALL' | 'NEW' | 'ALLERGY' | ClinicalTag>('ALL');
  const [isMobileGroupMenuOpen, setIsMobileGroupMenuOpen] = useState(false);
  const [isMobileFilterMenuOpen, setIsMobileFilterMenuOpen] = useState(false);
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
    if (selectedGroup === 'GROUP_1') return GROUP_1_ROOM_NUMBERS;
    if (selectedGroup === 'GROUP_2') return GROUP_2_ROOM_NUMBERS;
    if (selectedGroup === 'CARDIO') return CARDIO_ROOM_NUMBERS;
    return ALL_ROOM_NUMBERS;
  }, [selectedGroup]);

  // Active inpatients - Filtered strictly to current group rooms when not searching
  const activeGroupPatients = useMemo(() => {
    return patients.filter((p) => {
      if (p.status !== 'ACTIVE') return false;
      if (selectedGroup === 'ALL') return true;
      const cleanRoom = p.roomNumber ? p.roomNumber.replace(/^(phòng|p\.?|buồng|b\.?)\s*/i, '').trim() : '';
      return currentGroupRoomNumbers.includes(cleanRoom);
    });
  }, [patients, currentGroupRoomNumbers, selectedGroup]);

  // When searching, evaluate across ALL rooms so searching e.g. "735" finds room 735 regardless of currently selected group
  const baseSearchPatients = useMemo(() => {
    if (searchTerm.trim()) {
      return patients.filter((p) => p.status === 'ACTIVE');
    }
    return activeGroupPatients;
  }, [patients, activeGroupPatients, searchTerm]);

  // Filtered patients based on user search and filters
  const filteredPatients = useMemo(() => {
    return baseSearchPatients.filter((p) => {
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

      // Tag / Label filter (NEW, ALLERGY, etc.)
      if (tagFilter !== 'ALL') {
        if (tagFilter === 'NEW') {
          if (!isNewAdmissionFromYesterday1630(p.admissionDate)) return false;
        } else if (tagFilter === 'ALLERGY') {
          const hasTag = p.tags?.includes('ALLERGY');
          const hasText = isRealAllergy(p.allergies);
          if (!hasTag && !hasText) return false;
        } else {
          if (!p.tags?.includes(tagFilter as ClinicalTag)) return false;
        }
      }

      // Search term: robust matching across room number, bed, patient name (accent-insensitive), diagnosis, doctor, notes
      if (searchTerm.trim()) {
        return matchesPatientSearch(p, searchTerm, doctorMap);
      }

      return true;
    });
  }, [baseSearchPatients, statusFilter, doctorFilter, tagFilter, searchTerm, doctorMap]);

  // Group patients by Room (Vertical List of Rooms for Selected Group or Search Results)
  const roomGroups = useMemo(() => {
    const patientMap = new Map<string, Patient[]>();

    filteredPatients.forEach((p) => {
      const cleanNum = p.roomNumber ? p.roomNumber.replace(/^(phòng|p\.?|buồng|b\.?)\s*/i, '').trim() : '';
      if (cleanNum) {
        if (!patientMap.has(cleanNum)) {
          patientMap.set(cleanNum, []);
        }
        patientMap.get(cleanNum)!.push(p);
      }
    });

    let roomsToRender: string[] = [];

    if (searchTerm.trim()) {
      // Khi đang có từ khóa tìm kiếm:
      // 1. Kiểm tra phòng trong toàn khoa khớp trực tiếp với từ khóa (VD: gõ "735", "phòng 735", "p735")
      const matchedDirectRooms = ALL_ROOM_NUMBERS.filter((r) => isRoomNumberMatch(r, searchTerm));

      // 2. Các phòng có bệnh nhân khớp với từ khóa tìm kiếm
      const roomsWithMatchingPatients = Array.from(patientMap.keys());

      // 3. Nếu tìm kiếm tên Bác sĩ, hiển thị cả phòng có BS phụ trách khớp tên
      const normQuery = normalizeSearchText(searchTerm);
      const roomsWithMatchingDoctor = ALL_ROOM_NUMBERS.filter((r) => {
        const docId = roomDoctorAssignments[r];
        if (!docId) return false;
        const doc = doctorMap.get(docId);
        if (!doc) return false;
        return normalizeSearchText(doc.name).includes(normQuery);
      });

      // Hợp nhất danh sách phòng khớp và loại bỏ trùng lặp
      const combinedRoomsSet = new Set<string>([
        ...matchedDirectRooms,
        ...roomsWithMatchingPatients,
        ...roomsWithMatchingDoctor,
      ]);

      // Nếu người dùng nhập số phòng cụ thể chưa có trong ALL_ROOM_NUMBERS, vẫn cho phép hiển thị
      const targetRoom = extractSearchRoomNumber(searchTerm);
      if (targetRoom) {
        combinedRoomsSet.add(targetRoom);
      }

      roomsToRender = Array.from(combinedRoomsSet);

      // Sắp xếp thứ tự phòng chuẩn theo danh mục ALL_ROOM_NUMBERS
      roomsToRender.sort((a, b) => {
        const idxA = ALL_ROOM_NUMBERS.indexOf(a);
        const idxB = ALL_ROOM_NUMBERS.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        return a.localeCompare(b, undefined, { numeric: true });
      });
    } else {
      // Chế độ xem thông thường theo tab nhóm phòng đã chọn
      roomsToRender = showEmptyRooms 
        ? currentGroupRoomNumbers 
        : currentGroupRoomNumbers.filter((r) => patientMap.has(r));

      // Bổ sung các phòng có bệnh nhân ngoài danh mục (nếu có)
      if (selectedGroup === 'ALL') {
        const extraRooms = Array.from(patientMap.keys()).filter((r) => !roomsToRender.includes(r));
        if (extraRooms.length > 0) {
          roomsToRender = [...roomsToRender, ...extraRooms];
        }
      }
    }

    // Đảm bảo ở chế độ hiện tất cả các nhóm (ALL), phòng 743 luôn đứng đầu danh sách
    if (selectedGroup === 'ALL' && roomsToRender.includes('743')) {
      roomsToRender = ['743', ...roomsToRender.filter((r) => r !== '743')];
    }

    return roomsToRender.map((roomKey) => {
      const roomPatientList = patientMap.get(roomKey) || [];
      
      // Sắp xếp bệnh nhân trong buồng theo mức độ ưu tiên lâm sàng: Nặng -> Vừa -> Chưa phân loại -> Ổn định, sau đó theo tên
      const severityPriority: Record<string, number> = {
        CRITICAL: 1,
        MODERATE: 2,
        UNCLASSIFIED: 3,
        STABLE: 4,
      };
      roomPatientList.sort((a, b) => {
        const pA = severityPriority[a.severity] || 3;
        const pB = severityPriority[b.severity] || 3;
        if (pA !== pB) return pA - pB;
        return (a.fullName || '').localeCompare(b.fullName || '', 'vi');
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
  }, [filteredPatients, doctorMap, roomDoctorAssignments, showEmptyRooms, currentGroupRoomNumbers, searchTerm]);

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
  const newCount = activeGroupPatients.filter((p) => isNewAdmissionFromYesterday1630(p.admissionDate)).length;
  const allergyCount = activeGroupPatients.filter((p) => p.tags?.includes('ALLERGY') || isRealAllergy(p.allergies)).length;

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

      {/* Top Action Bar & Quick Filters (Menu Thông Minh Cho Mobile & Đầy Đủ Cho Desktop) */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-2xs sm:shadow-sm p-2 sm:p-4 space-y-2 sm:space-y-3.5">
        
        {/* Row 1: Clinical Group Selector & Primary Actions */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2 sm:gap-3">
          
          <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2.5">
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <div className="w-2 sm:w-2.5 h-4 sm:h-6 bg-[#0b4d8c] rounded-full shrink-0" />
              <h2 className="text-xs sm:text-lg font-black text-slate-900 tracking-tight shrink-0 uppercase sm:normal-case">
                Buồng Bệnh
              </h2>
            </div>

            {/* DESKTOP VIEW: Clinical Group Tabs */}
            <div className="hidden sm:inline-flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200 text-xs font-semibold gap-1">
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
                onClick={() => setSelectedGroup('CARDIO')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedGroup === 'CARDIO'
                    ? 'bg-[#0b4d8c] text-white font-bold shadow-xs'
                    : 'text-slate-700 hover:text-[#0b4d8c] hover:bg-white/80'
                }`}
                title="Nhóm Tim Mạch: Phòng 735 - 745 (6 phòng)"
              >
                <span>Nhóm TM (6P)</span>
              </button>
            </div>

            {/* MOBILE VIEW: SMART GROUP MENU (Menu thông minh, không cần cuộn ngang) */}
            <div className="relative sm:hidden">
              <button
                type="button"
                onClick={() => {
                  setIsMobileGroupMenuOpen(!isMobileGroupMenuOpen);
                  setIsMobileFilterMenuOpen(false);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-[11px] flex items-center gap-1 border border-slate-200 shadow-2xs cursor-pointer"
              >
                <Building2 className="w-3 h-3 text-[#0b4d8c]" />
                <span>
                  {selectedGroup === 'ALL' ? 'Tất cả (28P)' : selectedGroup === 'GROUP_1' ? 'Nhóm 1 (16P)' : selectedGroup === 'GROUP_2' ? 'Nhóm 2 (6P)' : 'Nhóm TM (6P)'}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </button>

              {isMobileGroupMenuOpen && (
                <>
                  <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-40" onClick={() => setIsMobileGroupMenuOpen(false)} />
                  <div className="absolute top-8 left-0 w-60 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 space-y-1">
                    <div className="text-[10px] font-black uppercase text-slate-400 px-2 py-0.5">Chọn Phân Khu Buồng Bệnh:</div>
                    {[
                      { id: 'ALL', label: 'Tất cả các phòng', desc: 'Toàn khoa (28 phòng)', count: '28P' },
                      { id: 'GROUP_1', label: 'Nhóm 1', desc: 'P.703 - 731 & 733', count: '16P' },
                      { id: 'GROUP_2', label: 'Nhóm 2', desc: 'P.747 - 757', count: '6P' },
                      { id: 'CARDIO', label: 'Nhóm Tim Mạch', desc: 'P.735 - 745', count: '6P' },
                    ].map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          setSelectedGroup(g.id as any);
                          setIsMobileGroupMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-colors text-left cursor-pointer ${
                          selectedGroup === g.id ? 'bg-[#0b4d8c] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div>
                          <div>{g.label}</div>
                          <div className={`text-[10px] font-medium ${selectedGroup === g.id ? 'text-blue-200' : 'text-slate-400'}`}>{g.desc}</div>
                        </div>
                        <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${selectedGroup === g.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>{g.count}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <span className="text-[10.5px] sm:text-xs px-2 py-0.5 sm:py-1 rounded-lg bg-blue-50 text-[#0b4d8c] border border-blue-200 font-black shrink-0">
              {activeGroupPatients.length} BN
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0 w-full sm:w-auto">
            <div className="flex items-center gap-1 shrink-0">
              {onOpenPrintModal && (
                <button
                  type="button"
                  onClick={onOpenPrintModal}
                  className="px-2 sm:px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                  title="In danh sách bệnh nhân"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span className="hidden sm:inline">In DS</span>
                </button>
              )}

              {/* Toggle Empty Rooms */}
              <button
                type="button"
                onClick={() => setShowEmptyRooms(!showEmptyRooms)}
                className={`px-2 sm:px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
                  !showEmptyRooms 
                    ? 'bg-[#0b4d8c] text-white border-[#0b4d8c] shadow-xs' 
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
                }`}
                title={showEmptyRooms ? 'Ẩn các buồng phòng hiện chưa có bệnh nhân' : 'Hiển thị tất cả các buồng phòng'}
              >
                <Users className="w-3.5 h-3.5 text-current" />
                <span className="hidden sm:inline">{showEmptyRooms ? 'Ẩn phòng trống' : `Hiện phòng trống (${currentGroupRoomNumbers.length})`}</span>
                <span className="sm:hidden text-[11px]">{showEmptyRooms ? 'Ẩn trống' : 'Hiện trống'}</span>
              </button>

              {/* Delete All Patients Button - EXCLUSIVE FOR DOCTOR ACCOUNT ID 00979 */}
              {currentUser?.id === '00979' && onDeleteAllPatients && (
                <button
                  type="button"
                  onClick={onDeleteAllPatients}
                  className="px-2 sm:px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer active:scale-98"
                  title="Xóa vĩnh viễn toàn bộ bệnh nhân khỏi hệ thống (Chỉ dành riêng cho tài khoản ID 00979)"
                >
                  <Trash2 className="w-3.5 h-3.5 text-white" />
                  <span className="hidden sm:inline">Xóa Tất Cả BN</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onOpenNewPatient}
              className="flex-1 sm:flex-initial px-2.5 sm:px-3.5 py-1.5 bg-gradient-to-r from-[#0b4d8c] to-[#083a69] hover:from-[#094178] hover:to-[#062c52] text-white font-black text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-98"
            >
              <UserPlus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">+ Tiếp Nhận BN</span>
            </button>
          </div>
        </div>

        {/* Row 2: BỘ LỌC NHANH & TÌM KIẾM */}
        <div className="pt-2 sm:pt-2.5 border-t border-slate-100">
          <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-2 sm:p-2.5 space-y-1.5 sm:space-y-2">
            
            {/* DESKTOP FILTER PILLS ROW (Hiển thị đầy đủ cho màn hình lớn) */}
            <div className="hidden sm:flex items-center gap-1.5 flex-wrap text-xs">
              <div className="flex items-center gap-1 text-[#0b4d8c] font-bold shrink-0 pr-1.5 border-r border-slate-200">
                <Filter className="w-3 h-3 text-[#0b4d8c]" />
                <span className="text-[11px] uppercase tracking-wide">Bộ lọc:</span>
              </div>

              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  statusFilter === 'ALL' && tagFilter === 'ALL'
                    ? 'bg-[#0b4d8c] text-white shadow-2xs font-black'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                Tất cả ({activeGroupPatients.length})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === 'CRITICAL' ? 'ALL' : 'CRITICAL')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'CRITICAL'
                    ? 'bg-rose-600 text-white shadow-2xs font-black'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                <span>Nặng ({criticalCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === 'MODERATE' ? 'ALL' : 'MODERATE')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'MODERATE'
                    ? 'bg-amber-500 text-white shadow-2xs font-black'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                }`}
              >
                <span>Vừa ({moderateCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === 'STABLE' ? 'ALL' : 'STABLE')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'STABLE'
                    ? 'bg-emerald-600 text-white shadow-2xs font-black'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                <span>Ổn ({stableCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === 'UNCLASSIFIED' ? 'ALL' : 'UNCLASSIFIED')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'UNCLASSIFIED'
                    ? 'bg-slate-700 text-white shadow-2xs font-black'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                }`}
              >
                <span>Chưa PL ({unclassifiedCount})</span>
              </button>

              <div className="h-4 w-px bg-slate-300 mx-0.5" />

              <select
                value={doctorFilter}
                onChange={(e) => setDoctorFilter(e.target.value)}
                className={`bg-white font-bold text-xs px-2 py-1 rounded-lg border focus:outline-hidden cursor-pointer transition-all ${
                  doctorFilter !== 'ALL'
                    ? 'border-[#0b4d8c] text-[#0b4d8c] bg-blue-50/70 font-black'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <option value="ALL">BS. Tất cả bác sĩ</option>
                {activeDoctorsWithCounts.map((docItem) => {
                  const parts = docItem.name.trim().split(/\s+/);
                  const shortName = parts.length > 2 && /bình chi/i.test(docItem.name) 
                    ? 'Bình Chi' 
                    : parts[parts.length - 1];
                  return (
                    <option key={docItem.id} value={docItem.id}>
                      BS. {shortName} ({docItem.count})
                    </option>
                  );
                })}
              </select>

              <div className="h-4 w-px bg-slate-300 mx-0.5" />

              <button
                type="button"
                onClick={() => setTagFilter(tagFilter === 'NEW' ? 'ALL' : 'NEW')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1 ${
                  tagFilter === 'NEW'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                }`}
                title="Bệnh mới nhập viện từ 16h30 hôm qua đến nay"
              >
                <span className="px-1 py-0.2 rounded bg-rose-600 text-white text-[9px] font-black">NEW</span>
                <span>Mới ({newCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setTagFilter(tagFilter === 'ALLERGY' ? 'ALL' : 'ALLERGY')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1 ${
                  tagFilter === 'ALLERGY'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Dị ứng ({allergyCount})</span>
              </button>

              {(statusFilter !== 'ALL' || doctorFilter !== 'ALL' || tagFilter !== 'ALL' || searchTerm.trim()) && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('ALL');
                    setDoctorFilter('ALL');
                    setTagFilter('ALL');
                    setSearchTerm('');
                  }}
                  className="px-2 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ml-auto"
                  title="Xóa tất cả các bộ lọc hiện tại"
                >
                  <span>✕ Đặt lại</span>
                </button>
              )}
            </div>

            {/* MOBILE FILTER & SEARCH ROW (MENU THÔNG MINH, KHÔNG CUỘN) */}
            <div className="flex sm:hidden items-center gap-1.5">
              
              {/* Smart Mobile Filter Dropdown Button */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileFilterMenuOpen(!isMobileFilterMenuOpen);
                    setIsMobileGroupMenuOpen(false);
                  }}
                  className={`px-2 py-1.5 rounded-lg font-black text-[11px] flex items-center gap-1 border transition-all cursor-pointer shadow-2xs ${
                    statusFilter !== 'ALL' || tagFilter !== 'ALL' || doctorFilter !== 'ALL'
                      ? 'bg-[#0b4d8c] text-white border-[#0b4d8c]'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  <Filter className="w-3 h-3" />
                  <span className="max-w-[100px] truncate">
                    {statusFilter === 'CRITICAL'
                      ? `Nặng (${criticalCount})`
                      : statusFilter === 'MODERATE'
                      ? `Vừa (${moderateCount})`
                      : statusFilter === 'STABLE'
                      ? `Ổn (${stableCount})`
                      : statusFilter === 'UNCLASSIFIED'
                      ? `Chưa PL (${unclassifiedCount})`
                      : tagFilter === 'NEW'
                      ? `Mới (${newCount})`
                      : tagFilter === 'ALLERGY'
                      ? `Dị ứng (${allergyCount})`
                      : doctorFilter !== 'ALL'
                      ? 'Theo BS'
                      : 'Bộ Lọc'}
                  </span>
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </button>

                {/* Reset button if filter is active */}
                {(statusFilter !== 'ALL' || tagFilter !== 'ALL' || doctorFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('ALL');
                      setTagFilter('ALL');
                      setDoctorFilter('ALL');
                    }}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[9px] font-black shadow-xs cursor-pointer"
                    title="Xóa bộ lọc"
                  >
                    ✕
                  </button>
                )}

                {/* Mobile Filter Menu Modal Sheet */}
                {isMobileFilterMenuOpen && (
                  <>
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-40" onClick={() => setIsMobileFilterMenuOpen(false)} />
                    <div className="fixed top-28 left-4 right-4 max-w-sm mx-auto bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 z-50 animate-in fade-in zoom-in-95 space-y-2 max-h-[75vh] overflow-y-auto">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                        <span className="text-xs font-black uppercase text-slate-800 flex items-center gap-1">
                          <Filter className="w-3.5 h-3.5 text-[#0b4d8c]" />
                          <span>Lọc Bệnh Nhân Nhanh</span>
                        </span>
                        <button type="button" onClick={() => setIsMobileFilterMenuOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-1">
                        {[
                          { id: 'ALL', type: 'status', label: 'Tất cả bệnh nhân', count: activeGroupPatients.length, color: 'text-slate-800' },
                          { id: 'CRITICAL', type: 'status', label: '🔴 Ca Bệnh Nặng', count: criticalCount, color: 'text-rose-700 font-black' },
                          { id: 'MODERATE', type: 'status', label: '🟡 Ca Bệnh Vừa', count: moderateCount, color: 'text-amber-700 font-bold' },
                          { id: 'STABLE', type: 'status', label: '🟢 Ca Bệnh Ổn Định', count: stableCount, color: 'text-emerald-700 font-bold' },
                          { id: 'UNCLASSIFIED', type: 'status', label: '⚪ Chưa Phân Loại', count: unclassifiedCount, color: 'text-slate-600 font-semibold' },
                          { id: 'NEW', type: 'tag', label: '✨ Bệnh Nhân Mới (24h)', count: newCount, color: 'text-rose-600 font-bold' },
                          { id: 'ALLERGY', type: 'tag', label: '⚠️ Bệnh Nhân Dị Ứng', count: allergyCount, color: 'text-amber-800 font-bold' },
                        ].map((f) => {
                          const isSelected = f.type === 'status' ? statusFilter === f.id && tagFilter === 'ALL' : tagFilter === f.id;
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => {
                                if (f.type === 'status') {
                                  setStatusFilter(f.id as any);
                                  setTagFilter('ALL');
                                } else {
                                  setTagFilter(f.id as any);
                                  setStatusFilter('ALL');
                                }
                                setIsMobileFilterMenuOpen(false);
                              }}
                              className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-colors text-left cursor-pointer ${
                                isSelected ? 'bg-[#0b4d8c] text-white font-black shadow-xs' : 'hover:bg-slate-100 ' + f.color
                              }`}
                            >
                              <span>{f.label}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700 font-bold'}`}>
                                {f.count}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Doctor Filter inside popup */}
                      <div className="pt-2 border-t border-slate-100">
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Lọc theo Bác sĩ:</label>
                        <select
                          value={doctorFilter}
                          onChange={(e) => {
                            setDoctorFilter(e.target.value);
                            setIsMobileFilterMenuOpen(false);
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold"
                        >
                          <option value="ALL">BS. Tất cả bác sĩ</option>
                          {activeDoctorsWithCounts.map((docItem) => (
                            <option key={docItem.id} value={docItem.id}>
                              BS. {docItem.name} ({docItem.count} BN)
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setStatusFilter('ALL');
                          setTagFilter('ALL');
                          setDoctorFilter('ALL');
                          setIsMobileFilterMenuOpen(false);
                        }}
                        className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors text-center cursor-pointer"
                      >
                        Đặt lại tất cả bộ lọc
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Search Input Field on Mobile */}
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm phòng (vd: 735), tên BN..."
                  className="w-full pl-8 pr-7 py-1.5 bg-white text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0b4d8c]/30 font-medium"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1 cursor-pointer"
                    title="Xóa tìm kiếm"
                  >
                    ✕
                  </button>
                )}
              </div>

            </div>

            {/* Desktop Search Input Field */}
            <div className="relative hidden sm:block">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm nhanh theo số phòng (vd: 735, 705), tên bệnh nhân, chẩn đoán..."
                className="w-full pl-9 pr-8 py-1.5 bg-white hover:bg-slate-50 focus:bg-white text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0b4d8c]/30 font-medium transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1 cursor-pointer"
                  title="Xóa tìm kiếm"
                >
                  ✕
                </button>
              )}
            </div>

          </div>
        </div>

      </div>

      {/* Search Result Banner */}
      {searchTerm.trim() && (
        <div className="bg-blue-50/90 border border-blue-200 px-4 py-2.5 rounded-2xl flex items-center justify-between gap-3 text-xs text-[#0b4d8c] font-semibold animate-in fade-in">
          <div className="flex items-center gap-2 flex-wrap">
            <Search className="w-4 h-4 text-[#0b4d8c] shrink-0" />
            <span>
              Kết quả tìm kiếm cho: <span className="font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-blue-200">"{searchTerm}"</span>
            </span>
            <span className="text-slate-400">•</span>
            <span>
              Tìm thấy <strong className="font-black text-[#0b4d8c]">{roomGroups.length}</strong> phòng, <strong className="font-black text-[#0b4d8c]">{filteredPatients.length}</strong> bệnh nhân
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="text-xs text-rose-600 hover:text-rose-800 font-bold cursor-pointer hover:underline shrink-0"
          >
            ✕ Xóa tìm kiếm
          </button>
        </div>
      )}

      {/* Main Vertical List of Rooms */}
      {roomGroups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 shadow-sm">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-extrabold text-slate-800 text-base">
            {searchTerm.trim()
              ? `Không tìm thấy buồng phòng hoặc bệnh nhân nào khớp với từ khóa "${searchTerm}".`
              : `Không tìm thấy bệnh nhân nào trong ${selectedGroup === 'CARDIO' ? 'Nhóm Tim Mạch' : selectedGroup === 'GROUP_2' ? 'Nhóm 2' : selectedGroup === 'ALL' ? 'Toàn Khoa' : 'Nhóm 1'} theo bộ lọc hiện tại.`
            }
          </p>
          <div className="text-xs sm:text-sm text-slate-500 mt-2">
            {searchTerm.trim() ? (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0b4d8c] hover:bg-[#083a69] text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
              >
                <span>Xóa từ khóa tìm kiếm</span>
              </button>
            ) : (
              <span>Bấm "Hiện phòng trống" để hiển thị tất cả các buồng phòng hoặc bấm "+ Tiếp Nhận BN Mới".</span>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {roomGroups.map((group) => {
            const groupInfo = getRoomGroupName(group.roomNumber);

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
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-[#0b4d8c] border border-blue-200/60 shrink-0">
                        {groupInfo.label}
                      </span>
                    </div>
                    <span className="text-slate-300 font-light">•</span>
                    
                    {/* Quick Doctor Selector */}
                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-blue-300 rounded-lg px-2 sm:px-2.5 py-1 transition-colors shadow-2xs max-w-[155px] sm:max-w-none">
                      <Stethoscope className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[#0b4d8c] shrink-0" />
                      <span className="text-slate-500 text-xs font-semibold hidden sm:inline">
                        BS phụ trách:
                      </span>
                      <select
                        value={group.assignedDoctorId || ''}
                        onChange={(e) => handleQuickAssignDoctor(group.roomNumber, e.target.value)}
                        className="bg-transparent text-slate-800 font-bold text-xs focus:outline-hidden cursor-pointer w-full truncate"
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-slate-100/60">
                    {group.patients.map((patient) => {
                      const isCritical = patient.severity === 'CRITICAL';
                      const isModerate = patient.severity === 'MODERATE';
                      const isDischargeTomorrow = patient.admissionStatus === 'DISCHARGE_TOMORROW';
                      const isDischargeToday = patient.admissionStatus === 'DISCHARGE_TODAY';
                      const isStable = patient.severity === 'STABLE';
                      const isUnclassified = !patient.severity || patient.severity === 'UNCLASSIFIED';
                      const isNewPatient = isNewAdmissionFromYesterday1630(patient.admissionDate);
                      const treatmentInfo = calculateTreatmentDays(patient.admissionDate);
                      
                      // Màu sắc tên Bệnh Nhân theo tình trạng bệnh lâm sàng
                      const nameColorClass = isCritical
                        ? 'text-rose-700'
                        : isModerate
                        ? 'text-amber-700'
                        : isStable
                        ? 'text-emerald-700'
                        : 'text-slate-800';

                      // Khung của mỗi BN hiển thị theo màu tình trạng bệnh
                      const cardFrameClass = isCritical
                        ? 'border-2 border-rose-500 bg-white ring-1 ring-rose-200/80 shadow-xs hover:border-rose-600'
                        : isModerate
                        ? 'border-2 border-amber-500 bg-white ring-1 ring-amber-200/80 shadow-xs hover:border-amber-600'
                        : isStable
                        ? 'border-2 border-emerald-500 bg-white ring-1 ring-emerald-200/80 shadow-xs hover:border-emerald-600'
                        : 'border-2 border-slate-300 bg-white ring-1 ring-slate-200/80 shadow-xs hover:border-slate-400';

                      // Chẩn đoán cập nhật mới nhất
                      const latestDiagnosis = getLatestDiagnosis(patient);

                      // Cảnh báo cận lâm sàng bất thường nặng, nguy hiểm
                      const criticalAlerts = getCriticalLabAlerts(patient);

                      // Kế hoạch điều trị
                      const currentPlan = patient.treatmentPlan || 
                        patient.evolutions?.[0]?.treatmentAction || 
                        patient.initialMedicationsText || 
                        '';

                      // Ghi chú của BS (nếu có)
                      const doctorNotes = patient.importantNotes?.trim() || '';

                      // Bàn giao bệnh (nếu có)
                      const handoverNotes = patient.handoverNotes?.trim() || '';

                      return (
                        <div
                          key={patient.id}
                          className={`rounded-2xl ${cardFrameClass} p-4 flex flex-col justify-between transition-all duration-150`}
                        >
                          {/* Top Content */}
                          <div>
                            
                            {/* 1. Họ và tên (màu theo tình trạng), Tuổi, Giới & Tình trạng bệnh */}
                            <div className="pb-3 border-b border-slate-100 flex items-start justify-between gap-2">
                              <div 
                                onClick={() => onSelectPatient(patient)}
                                className="cursor-pointer group flex-1 min-w-[130px]"
                              >
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className={`text-base sm:text-lg font-black tracking-tight leading-snug group-hover:underline transition-colors ${nameColorClass}`}>
                                    {formatPatientDisplayName(patient.fullName)}
                                  </h4>
                                  {isNewPatient && (
                                    <span className="px-2 py-0.5 rounded-full text-[10.5px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-xs animate-pulse shrink-0">
                                      NEW
                                    </span>
                                  )}
                                </div>

                                {/* Tuổi & Giới (HOÀN TOÀN BỎ SỐ GIƯỜNG) */}
                                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 font-bold mt-1">
                                  <span>{patient.age} tuổi</span>
                                  <span>•</span>
                                  {patient.gender === 'Nam' ? (
                                    <span className="inline-flex items-center gap-1 text-blue-700 font-extrabold" title="Nam"><span className="text-sm font-black">♂</span> Nam</span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-rose-600 font-extrabold" title="Nữ"><span className="text-sm font-black">♀</span> Nữ</span>
                                  )}
                                </div>
                              </div>

                              {/* Tình trạng bệnh: Nặng, Trung bình, Ổn, Chưa phân loại */}
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                {isCritical && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-rose-600 text-white shadow-xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                    Nặng
                                  </span>
                                )}
                                {isModerate && (
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500 text-white shadow-xs">
                                    Trung bình
                                  </span>
                                )}
                                {isStable && (
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-600 text-white shadow-xs">
                                    Ổn
                                  </span>
                                )}
                                {isUnclassified && (
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-200 text-slate-700">
                                    Chưa phân loại
                                  </span>
                                )}

                                {/* Trạng thái ra viện nếu có */}
                                {isDischargeToday && (
                                  <span className="px-2 py-0.5 rounded-full text-[10.5px] font-black uppercase tracking-wider bg-purple-600 text-white shadow-2xs">
                                    RV hôm nay
                                  </span>
                                )}
                                {isDischargeTomorrow && (
                                  <span className="px-2 py-0.5 rounded-full text-[10.5px] font-black uppercase tracking-wider bg-blue-600 text-white shadow-2xs">
                                    Dự RV mai
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* 2. Ngày vào viện & Số ngày ĐT */}
                            <div className="flex items-center justify-between text-xs sm:text-sm py-2 text-slate-700 border-b border-slate-100 font-bold">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                                <span>Ngày NV: <strong className="text-slate-900">{formatAdmissionDateShort(patient.admissionDate).replace(/^NV:\s*/i, '')}</strong></span>
                              </div>
                              <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-[#0b4d8c] font-black text-xs border border-blue-200">
                                <Clock className="w-3.5 h-3.5 text-[#0b4d8c]" />
                                <span>Số ngày ĐT: {treatmentInfo.days}</span>
                              </div>
                            </div>

                            {/* 3. Các nhãn được gán (nếu có) */}
                            {patient.tags && patient.tags.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 py-2 border-b border-slate-100">
                                {patient.tags.map((tag) => {
                                  const meta = CLINICAL_TAGS_META[tag];
                                  if (!meta) return null;
                                  return (
                                    <span
                                      key={tag}
                                      className="px-2 py-0.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs"
                                      title={meta.description}
                                    >
                                      {meta.shortLabel}
                                    </span>
                                  );
                                })}
                              </div>
                            )}

                            {/* 4. Chẩn đoán (hiển thị bằng Icon) */}
                            <div className="py-2.5">
                              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 shadow-2xs">
                                <div className="flex items-center gap-1.5 text-[#0b4d8c] mb-1" title="Chẩn đoán">
                                  <Activity className="w-4 h-4 text-[#0b4d8c] shrink-0" />
                                </div>
                                <p className="font-bold text-xs sm:text-sm text-slate-900 leading-relaxed" title={latestDiagnosis}>
                                  {latestDiagnosis}
                                </p>
                              </div>
                            </div>

                            {/* 5. Hướng xử trí & Kế hoạch điều trị (hiển thị bằng Icon) */}
                            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 mb-2.5 shadow-2xs">
                              <div className="flex items-center gap-1.5 text-emerald-800 mb-1" title="Hướng xử trí & Kế hoạch điều trị">
                                <Stethoscope className="w-4 h-4 text-emerald-700 shrink-0" />
                              </div>
                              <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed whitespace-pre-line" title={currentPlan || 'Theo dõi diễn tiến'}>
                                {currentPlan || 'Theo dõi sinh hiệu, điều trị theo phác đồ nội khoa'}
                              </p>
                            </div>

                            {/* 6. Cảnh báo xét nghiệm bất thường nguy hiểm (Hiển thị ngay phía dưới Hướng xử trí) */}
                            {criticalAlerts.length > 0 && (
                              <div className="mb-2.5 p-3 rounded-xl bg-rose-50 border-2 border-rose-400 shadow-2xs">
                                <div className="flex items-center gap-1.5 text-rose-800 mb-1.5" title="Cảnh báo cận lâm sàng bất thường nặng, nguy hiểm">
                                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 animate-bounce" />
                                  <span className="text-xs font-black uppercase text-rose-900">Cảnh báo xét nghiệm nguy hiểm:</span>
                                </div>
                                <ul className="space-y-1">
                                  {criticalAlerts.map((alert, idx) => (
                                    <li key={idx} className="text-xs font-bold text-rose-900 flex items-start gap-1.5">
                                      <span className="text-rose-600 font-black shrink-0">•</span>
                                      <span>{alert}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* 7. Ghi chú của bs (hiển thị bằng Icon) */}
                            {doctorNotes && (
                              <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/80 mb-2.5 shadow-2xs">
                                <div className="flex items-center gap-1.5 text-amber-900 mb-1" title="Ghi chú lâm sàng của bác sĩ">
                                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                                </div>
                                <p className="text-xs font-medium text-slate-800 leading-relaxed whitespace-pre-line" title={doctorNotes}>
                                  {doctorNotes}
                                </p>
                              </div>
                            )}

                            {/* 8. Bàn giao bệnh (hiển thị bằng Icon) */}
                            {handoverNotes && (
                              <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-200/80 mb-2.5 shadow-2xs">
                                <div className="flex items-center gap-1.5 text-indigo-900 mb-1" title="Nội dung bàn giao bệnh">
                                  <ArrowRightLeft className="w-4 h-4 text-indigo-700 shrink-0" />
                                </div>
                                <p className="text-xs font-medium text-slate-800 leading-relaxed whitespace-pre-line" title={handoverNotes}>
                                  {handoverNotes}
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

import React, { useState, useMemo } from 'react';
import { 
  DepartmentRoom, 
  Doctor, 
  Patient, 
  ClinicalTag,
  CLINICAL_TAGS_META, 
  SeverityLevel,
  AdmissionDischargeStatus,
  ADMISSION_STATUS_META
} from '../types/patient';
import { 
  User, 
  Wind, 
  HeartPulse, 
  Eye, 
  ArrowRightLeft, 
  PlusCircle,
  Search, 
  CheckCircle2, 
  Clock, 
  LogOut, 
  CalendarDays, 
  LayoutGrid, 
  Columns3, 
  Stethoscope, 
  ChevronRight,
  ChevronDown,
  Trash2,
  AlertTriangle,
  Maximize2,
  Minimize2,
  X,
  FileText,
  BedDouble,
  ShieldAlert,
  ClipboardList,
  Check,
  Activity
} from 'lucide-react';
import { DiseaseStatisticsBar, DiseaseFilterType, matchPatientDisease } from './DiseaseStatisticsBar';
import { DutyRosterBar } from './DutyRosterBar';
import { DutyRosterModal } from './DutyRosterModal';
import { DEFAULT_ROOM_DOCTORS, getDoctorShortName, GROUP_1_DOCTOR_IDS, GROUP_2_DOCTOR_IDS, CARDIO_DOCTOR_IDS } from '../data/mockData';
import { sortDoctorsAlphabetically } from '../utils/doctorSorter';
import { isRoomNumberMatch, matchesPatientSearch } from '../utils/searchUtils';
import { formatPatientDisplayName } from '../utils/storage';

interface WardRoomMapProps {
  rooms: DepartmentRoom[];
  patients: Patient[];
  doctors: Doctor[];
  onSelectPatient: (patient: Patient) => void;
  onTransferPatient: (patient: Patient) => void;
  onAdmitToBed: (roomNumber: string, bedNumber: string) => void;
  onDeletePatient?: (patientId: string) => void;
  onReassignDoctorForRoom?: (roomNumber: string, doctorId: string) => void;
  onUpdatePatient?: (patient: Patient) => void;
}

export const WardRoomMap: React.FC<WardRoomMapProps> = ({
  rooms,
  patients,
  doctors,
  onSelectPatient,
  onTransferPatient,
  onAdmitToBed,
  onDeletePatient,
  onReassignDoctorForRoom,
  onUpdatePatient,
}) => {
  // Cycle severity nhanh khi bấm vào thẻ độ nặng trên khung bệnh nhân
  const handleCycleSeverity = (e: React.MouseEvent, patient: Patient) => {
    e.stopPropagation();
    const current = patient.severity || 'UNCLASSIFIED';
    const nextMap: Record<SeverityLevel, SeverityLevel> = {
      CRITICAL: 'MODERATE',
      MODERATE: 'STABLE',
      STABLE: 'UNCLASSIFIED',
      UNCLASSIFIED: 'CRITICAL',
    };
    const next = nextMap[current] || 'CRITICAL';
    if (onUpdatePatient) {
      onUpdatePatient({
        ...patient,
        severity: next,
      });
    }
  };

  // View mode: 'whiteboard'
  const [viewMode, setViewMode] = useState<'whiteboard' | 'detailed'>('whiteboard');
  const [isDutyModalOpen, setIsDutyModalOpen] = useState(false);

  // Bed expansion: default 3 beds, button allows expanding to 6 beds for 735, 743, 749, 757
  const [showExpandedBeds, setShowExpandedBeds] = useState(false);

  // Room Doctor In-Charge State (persisted to localStorage)
  const [roomDoctorState, setRoomDoctorState] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('HVGL_ROOM_DOCTORS');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse saved room doctors', e);
    }
    return DEFAULT_ROOM_DOCTORS;
  });

  // Modal states
  const [roomToChangeDoctor, setRoomToChangeDoctor] = useState<string | null>(null);
  const [doctorSearchInModal, setDoctorSearchInModal] = useState('');
  const [syncPatientsWithRoomDoctor, setSyncPatientsWithRoomDoctor] = useState(true);

  // Delete Patient Warning Modal state
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);

  // Hover Tooltip state on Patient Name
  const [hoveredPatientData, setHoveredPatientData] = useState<{
    patient: Patient;
    x: number;
    y: number;
  } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | AdmissionDischargeStatus>('ALL');
  const [selectedSeverityFilter, setSelectedSeverityFilter] = useState<'ALL' | SeverityLevel>('ALL');
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState<'ALL' | string>('ALL');
  const [selectedTagFilter, setSelectedTagFilter] = useState<'ALL' | ClinicalTag>('ALL');
  const [selectedDiseaseFilter, setSelectedDiseaseFilter] = useState<DiseaseFilterType>('ALL');

  // 3 Clinical Room Groups defined by user (Khoa Nội Tổng Hợp - Tim Mạch)
  const CARDIO_ROOM_NUMBERS = ['735', '737', '739', '741', '743', '745'];
  const GROUP_2_ROOM_NUMBERS = ['747', '749', '751', '753', '755', '757'];
  const GROUP_1_ROOM_NUMBERS = ['733', '703', '704', '707', '705', '709', '711', '713', '715', '717', '718', '721', '725', '727', '729', '731'];

  const [selectedGroup, setSelectedGroup] = useState<'ALL' | 'CARDIO' | 'GROUP_2' | 'GROUP_1'>('ALL');

  // Fast doctor lookup map
  const doctorMap = useMemo(() => {
    return new Map<string, Doctor>(doctors.map((d) => [d.id, d]));
  }, [doctors]);

  // Fast patient lookup by room and bed
  const patientGridMap = useMemo(() => {
    const map = new Map<string, Patient>();
    patients.forEach((p) => {
      if (p.status === 'ACTIVE') {
        const key = `${p.roomNumber}__${p.bedNumber}`;
        map.set(key, p);
      }
    });
    return map;
  }, [patients]);

  // Doctor patient count for the bottom summary row
  const doctorPatientCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    doctors.forEach((d) => {
      counts[d.id] = 0;
    });
    patients.forEach((p) => {
      if (p.status === 'ACTIVE' && p.attendingDoctorId) {
        counts[p.attendingDoctorId] = (counts[p.attendingDoctorId] || 0) + 1;
      }
    });
    return counts;
  }, [doctors, patients]);

  const activeDoctors = useMemo(() => {
    const valid = doctors.filter(
      (doc) =>
        !['00101', '00199'].includes(doc.id) &&
        !/tuế|quyên/i.test(doc.name) &&
        (doctorPatientCounts[doc.id] || 0) > 0
    );
    return sortDoctorsAlphabetically(valid);
  }, [doctors, doctorPatientCounts]);

  // Distinct room groups defined by user
  const cardioRooms = useMemo(() => rooms.filter(r => CARDIO_ROOM_NUMBERS.includes(r.number)), [rooms]);
  const group2Rooms = useMemo(() => rooms.filter(r => GROUP_2_ROOM_NUMBERS.includes(r.number)), [rooms]);
  const group1Rooms = useMemo(() => rooms.filter(r => GROUP_1_ROOM_NUMBERS.includes(r.number)), [rooms]);

  // Filtered rooms based on selected group or search query
  const filteredRooms = useMemo(() => {
    if (searchQuery.trim()) {
      return rooms.filter((r) => {
        if (isRoomNumberMatch(r.number, searchQuery)) return true;
        const hasMatchingPatient = patients.some(
          (p) =>
            p.status === 'ACTIVE' &&
            p.roomNumber.replace(/^(phòng|p\.?|buồng|b\.?)\s*/i, '').trim() === r.number &&
            matchesPatientSearch(p, searchQuery, doctorMap)
        );
        return hasMatchingPatient;
      });
    }
    if (selectedGroup === 'CARDIO') return cardioRooms;
    if (selectedGroup === 'GROUP_2') return group2Rooms;
    if (selectedGroup === 'GROUP_1') return group1Rooms;

    // Ở chế độ xem tất cả các nhóm (ALL), đưa phòng 743 lên đầu danh sách
    const r743 = rooms.find((r) => r.number === '743');
    if (r743) {
      return [r743, ...rooms.filter((r) => r.number !== '743')];
    }
    return rooms;
  }, [rooms, selectedGroup, cardioRooms, group2Rooms, group1Rooms, searchQuery, patients, doctorMap]);

  // Global counts for filter badges
  const stats = useMemo(() => {
    const active = patients.filter((p) => p.status === 'ACTIVE');
    return {
      total: active.length,
      critical: active.filter((p) => p.severity === 'CRITICAL').length,
      moderate: active.filter((p) => p.severity === 'MODERATE').length,
      stable: active.filter((p) => p.severity === 'STABLE').length,
      unclassified: active.filter((p) => p.severity === 'UNCLASSIFIED' || !p.severity).length,
      admittedToday: active.filter((p) => p.admissionStatus === 'ADMITTED_TODAY').length,
      admittedYesterday: active.filter((p) => p.admissionStatus === 'ADMITTED_YESTERDAY').length,
      dischargeToday: active.filter((p) => p.admissionStatus === 'DISCHARGE_TODAY').length,
      dischargeTomorrow: active.filter((p) => p.admissionStatus === 'DISCHARGE_TOMORROW').length,
      canulaCount: active.filter((p) => p.tags.includes('O2_CANULA') || p.tags.includes('O2')).length,
      maskCount: active.filter((p) => p.tags.includes('O2_MASK')).length,
      fluidBalanceCount: active.filter((p) => p.tags.includes('FLUID_BALANCE')).length,
      vasoCount: active.filter((p) => p.tags.includes('VASOPRESSOR')).length,
      monitoringCount: active.filter((p) => p.tags.includes('CLOSE_MONITORING')).length,
    };
  }, [patients]);

  // Total bed capacity and department census
  const totalBedsCount = useMemo(() => {
    return rooms.reduce((acc, r) => acc + r.totalBeds, 0);
  }, [rooms]);

  const availableBedsCount = Math.max(0, totalBedsCount - stats.total);
  const totalOccupancyPercent = totalBedsCount > 0 
    ? Math.min(100, Math.round((stats.total / totalBedsCount) * 100)) 
    : 0;

  // Helper to determine if a patient passes the active filters
  const matchesFilters = (patient?: Patient | null): boolean => {
    if (!patient) return false;

    // Search query: room, bed, name, diagnosis, doctor
    if (searchQuery.trim()) {
      if (!matchesPatientSearch(patient, searchQuery, doctorMap)) return false;
    }

    // Status filter
    if (selectedStatusFilter !== 'ALL' && patient.admissionStatus !== selectedStatusFilter) {
      return false;
    }

    // Severity filter
    if (selectedSeverityFilter !== 'ALL' && patient.severity !== selectedSeverityFilter) {
      return false;
    }

    // Doctor filter
    if (selectedDoctorFilter !== 'ALL' && patient.attendingDoctorId !== selectedDoctorFilter) {
      return false;
    }

    // Clinical tag filter
    if (selectedTagFilter !== 'ALL') {
      if (selectedTagFilter === 'O2_CANULA') {
        if (!patient.tags.includes('O2_CANULA') && !patient.tags.includes('O2')) return false;
      } else if (!patient.tags.includes(selectedTagFilter)) {
        return false;
      }
    }

    // Disease & elderly filter
    if (selectedDiseaseFilter !== 'ALL' && !matchPatientDisease(patient, selectedDiseaseFilter)) {
      return false;
    }

    return true;
  };

  // Small Status Badge Component (User requested: "các chữ nhập hôm qua, hôm nay, ra viện... hiển thị nhỏ thôi")
  const renderSmallStatusBadge = (status?: AdmissionDischargeStatus) => {
    if (!status || status === 'STABLE_INPATIENT') return null;

    if (status === 'ADMITTED_TODAY') {
      return (
        <span 
          className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1 py-0.5 rounded bg-emerald-600 text-white shrink-0 shadow-2xs leading-none" 
          title="Mới"
        >
          <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
          <span>Mới</span>
        </span>
      );
    }

    if (status === 'ADMITTED_YESTERDAY') {
      return (
        <span 
          className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1 py-0.5 rounded bg-amber-500 text-white shrink-0 shadow-2xs leading-none" 
          title="Mới"
        >
          <Clock className="w-2.5 h-2.5 shrink-0" />
          <span>Mới</span>
        </span>
      );
    }

    if (status === 'DISCHARGE_TODAY') {
      return (
        <span 
          className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1 py-0.5 rounded bg-purple-600 text-white shrink-0 shadow-2xs leading-none" 
          title="RV hôm nay"
        >
          <LogOut className="w-2.5 h-2.5 shrink-0" />
          <span>RV hôm nay</span>
        </span>
      );
    }

    if (status === 'DISCHARGE_TOMORROW') {
      return (
        <span 
          className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1 py-0.5 rounded bg-blue-600 text-white shrink-0 shadow-2xs leading-none" 
          title="Dự kiến RV mai"
        >
          <CalendarDays className="w-2.5 h-2.5 shrink-0" />
          <span>Dự kiến RV mai</span>
        </span>
      );
    }

    return null;
  };

  // Handle reassigning room doctor
  const handleAssignDoctorToRoom = (doctorId: string) => {
    if (!roomToChangeDoctor) return;
    const updated = {
      ...roomDoctorState,
      [roomToChangeDoctor]: doctorId,
    };
    setRoomDoctorState(updated);
    try {
      localStorage.setItem('HVGL_ROOM_DOCTORS', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save room doctor', e);
    }

    if (syncPatientsWithRoomDoctor && onReassignDoctorForRoom) {
      onReassignDoctorForRoom(roomToChangeDoctor, doctorId);
    }

    setRoomToChangeDoctor(null);
  };

  // Render Room Cards Grid for a given list of rooms in Whiteboard Mode (Fits on screen without horizontal scrolling, wrapping naturally)
  const renderRoomColumns = (roomList: DepartmentRoom[]) => {
    if (roomList.length === 0) return null;

    // Number of bed rows to display: 3 beds by default, 6 beds if expanded
    const maxBedRows = showExpandedBeds ? 6 : 3;

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5 w-full">
        {roomList.map((room) => {
          const isAcute = room.type === 'ACUTE';
          const isVip = room.type === 'VIP';
          const is6Bed = room.totalBeds >= 6;
          const assignedDocId = roomDoctorState[room.number] || DEFAULT_ROOM_DOCTORS[room.number];
          const doc = assignedDocId ? doctorMap.get(assignedDocId) : null;
          const shortName = doc ? getDoctorShortName(doc) : 'Chọn BS';

          // Calculate bed occupancy for this room
          const roomPatients = patients.filter((p) => {
            if (p.status !== 'ACTIVE') return false;
            const pRoom = p.roomNumber.replace(/^(phòng|p\.?|buồng|b\.?)\s*/i, '').trim();
            return pRoom === room.number;
          });
          const occupiedCount = roomPatients.length;
          const totalBeds = room.totalBeds;
          const occupancyPercent = totalBeds > 0 ? Math.min(100, Math.round((occupiedCount / totalBeds) * 100)) : 0;
          const isFull = occupiedCount >= totalBeds;
          const isNearlyFull = !isFull && occupiedCount > 0 && occupancyPercent >= 66;

          return (
            <div key={room.id} className="bg-white rounded-xl border border-slate-300 shadow-2xs hover:shadow-sm transition-all overflow-hidden flex flex-col">
              {/* Room Header with Occupancy & Progress Bar */}
              <div className={`px-2 py-1.5 flex flex-col border-b ${
                isAcute 
                  ? 'bg-gradient-to-r from-amber-900 to-amber-950 text-amber-100 border-amber-800' 
                  : isVip 
                    ? 'bg-gradient-to-r from-indigo-900 to-indigo-950 text-indigo-100 border-indigo-800' 
                    : CARDIO_ROOM_NUMBERS.includes(room.number)
                      ? 'bg-gradient-to-r from-slate-900 to-slate-800 text-slate-100 border-slate-700'
                      : 'bg-gradient-to-r from-slate-800 to-slate-700 text-slate-100 border-slate-600'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black tracking-tight">P.{room.number}</span>
                    {is6Bed ? (
                      <span className="text-[9px] font-extrabold px-1 py-0.2 rounded bg-amber-500/30 text-amber-200 border border-amber-400/50">6G</span>
                    ) : (
                      <span className="text-[9px] opacity-75 font-semibold">3G</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded leading-none transition-colors ${
                      isFull 
                        ? 'bg-rose-500 text-white shadow-2xs font-black animate-pulse' 
                        : isNearlyFull
                          ? 'bg-amber-500/90 text-white'
                          : occupiedCount > 0 
                            ? 'bg-emerald-500/40 text-emerald-200 border border-emerald-400/40' 
                            : 'bg-white/10 text-slate-300'
                    }`}>
                      {occupiedCount}/{totalBeds} {isFull ? '(Đầy)' : occupiedCount === 0 ? '(Trống)' : ''}
                    </span>
                  </div>
                </div>

                {/* Mini Occupancy Progress Bar */}
                <div 
                  className="w-full bg-black/40 rounded-full h-1 mt-1 overflow-hidden" 
                  title={`Công suất buồng: ${occupiedCount}/${totalBeds} giường (${occupancyPercent}%)`}
                >
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      isFull 
                        ? 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.9)]' 
                        : isNearlyFull 
                          ? 'bg-amber-400' 
                          : occupiedCount > 0 
                            ? 'bg-emerald-400' 
                            : 'bg-transparent'
                    }`}
                    style={{ width: `${occupancyPercent}%` }}
                  />
                </div>
              </div>

              {/* Doctor In Charge - Modernized & Balanced */}
              <div className="bg-slate-50 px-2 py-1 border-b border-slate-200 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setDoctorSearchInModal('');
                    setRoomToChangeDoctor(room.number);
                  }}
                  className="group inline-flex items-center justify-between gap-1 px-2 py-0.5 rounded-md bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 transition-all w-full text-center shadow-2xs"
                  title={`Đổi BS phụ trách Phòng ${room.number}`}
                >
                  <div className="flex items-center gap-1 truncate">
                    <Stethoscope className="w-3 h-3 text-slate-400 group-hover:text-rose-600 transition-colors shrink-0" />
                    <span className="font-extrabold text-slate-700 group-hover:text-rose-700 text-xs tracking-tight truncate">
                      {shortName}
                    </span>
                  </div>
                  <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600 shrink-0" />
                </button>
              </div>

              {/* Beds List - Tối ưu mật độ hiển thị nhiều bệnh nhân hơn */}
              <div className="p-1 space-y-1 flex-1 bg-slate-50/50">
                {Array.from({ length: maxBedRows }, (_, idx) => {
                  const bedIndex = idx + 1;
                  const bedNumFormatted = `Giường ${bedIndex < 10 ? '0' + bedIndex : bedIndex}`;
                  const isRoomBedAllowed = bedIndex <= room.totalBeds;

                  if (!isRoomBedAllowed) {
                    return (
                      <div key={bedIndex} className="h-10 rounded-md bg-slate-100/60 border border-dashed border-slate-200 flex items-center justify-center text-slate-300 text-[9px] italic">
                        Tối đa 3G
                      </div>
                    );
                  }

                  const key = `${room.number}__${bedNumFormatted}`;
                  const patient = patientGridMap.get(key);
                  const isMatched = patient ? matchesFilters(patient) : false;
                  const isAnyFilterActive = searchQuery.trim() !== '' || 
                    selectedStatusFilter !== 'ALL' || 
                    selectedSeverityFilter !== 'ALL' || 
                    selectedDoctorFilter !== 'ALL' || 
                    selectedTagFilter !== 'ALL' || 
                    selectedDiseaseFilter !== 'ALL';

                  if (!patient) {
                    return (
                      <div
                        key={bedIndex}
                        onClick={() => onAdmitToBed(room.number, bedNumFormatted)}
                        className="h-[50px] rounded-lg border border-dashed border-slate-300 hover:border-emerald-400 bg-white/70 hover:bg-emerald-50/60 transition-all cursor-pointer flex flex-col items-center justify-center p-0.5 text-slate-400 hover:text-emerald-700 group shadow-2xs"
                        title={`Bấm để tiếp nhận bệnh nhân vào ${bedNumFormatted} P.${room.number}`}
                      >
                        <div className="flex items-center gap-1">
                          <PlusCircle className="w-3 h-3 opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-transform text-emerald-600" />
                          <span className="text-[9.5px] font-bold text-slate-500 group-hover:text-emerald-700">G.{bedIndex < 10 ? '0' + bedIndex : bedIndex}</span>
                        </div>
                        <span className="text-[8.5px] font-medium text-slate-400 group-hover:text-emerald-600">Trống (Nhận BN)</span>
                      </div>
                    );
                  }

                  const isCritical = patient.severity === 'CRITICAL';
                  const isModerate = patient.severity === 'MODERATE';
                  const isStable = patient.severity === 'STABLE';
                  const isUnclassified = patient.severity === 'UNCLASSIFIED' || !patient.severity;

                  const latestVital = patient.vitals?.[0];
                  const hasVital = !!latestVital && (latestVital.bpSystolic > 0 || latestVital.heartRate > 0 || latestVital.spO2 > 0);
                  const isVitalAlert = latestVital && (
                    (latestVital.bpSystolic > 0 && (latestVital.bpSystolic < 90 || latestVital.bpSystolic >= 160)) ||
                    (latestVital.spO2 > 0 && latestVital.spO2 < 92) ||
                    (latestVital.heartRate > 0 && (latestVital.heartRate < 50 || latestVital.heartRate > 120))
                  );

                  return (
                    <div
                      key={bedIndex}
                      className={`rounded-lg p-1 transition-all border shadow-2xs hover:shadow-md flex flex-col justify-between min-h-[50px] relative group ${
                        isCritical
                          ? 'bg-rose-50/90 border-rose-300 border-l-4 border-l-rose-600 hover:bg-rose-100/90'
                          : isModerate
                          ? 'bg-amber-50/90 border-amber-300 border-l-4 border-l-amber-500 hover:bg-amber-100/90'
                          : isStable
                          ? 'bg-emerald-50/80 border-emerald-300 border-l-4 border-l-emerald-500 hover:bg-emerald-100/90'
                          : 'bg-slate-50/90 border-slate-300 border-l-4 border-l-slate-400 hover:bg-slate-100/90'
                      } ${isAnyFilterActive && !isMatched ? 'opacity-30 grayscale' : 'opacity-100'}`}
                    >
                      {/* Bed & Patient Name */}
                      <div className="flex items-start justify-between gap-1 leading-none">
                        <div 
                          className="flex items-baseline gap-1 truncate cursor-pointer flex-1"
                          onClick={() => onSelectPatient(patient)}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredPatientData({
                              patient,
                              x: rect.right + 8,
                              y: rect.top,
                            });
                          }}
                          onMouseLeave={() => setHoveredPatientData(null)}
                        >
                          <span className="text-[8.5px] font-black px-1 py-0.2 rounded bg-slate-200/80 text-slate-700 shrink-0">
                            G.{bedIndex < 10 ? '0' + bedIndex : bedIndex}
                          </span>
                          <span 
                            className="font-black text-[11px] text-slate-900 group-hover:text-rose-700 leading-tight truncate underline decoration-dotted decoration-slate-300"
                            title={patient.fullName}
                          >
                            {formatPatientDisplayName(patient.fullName)}
                          </span>
                          <span className="text-[9px] font-bold text-slate-500 shrink-0">{patient.age}t</span>
                          {patient.gender === 'Nam' ? (
                            <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-blue-100 text-blue-700 font-black text-[8.5px] shrink-0 leading-none" title="Nam">♂</span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-rose-100 text-rose-600 font-black text-[8.5px] shrink-0 leading-none" title="Nữ">♀</span>
                          )}
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0 opacity-80 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onTransferPatient(patient);
                            }}
                            className="p-0.5 rounded text-slate-500 hover:text-blue-700 hover:bg-blue-100 transition-colors"
                            title="Chuyển phòng / đổi giường"
                          >
                            <ArrowRightLeft className="w-2.5 h-2.5" />
                          </button>
                          {onDeletePatient && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPatientToDelete(patient);
                              }}
                              className="p-0.5 rounded text-slate-400 hover:text-rose-700 hover:bg-rose-100 transition-colors"
                              title="Xóa bệnh nhân"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Diagnosis */}
                      <div 
                        onClick={() => onSelectPatient(patient)}
                        className="my-0.5 cursor-pointer leading-tight"
                        title={patient.primaryDiagnosis}
                      >
                        <p className="text-[8.5px] text-slate-700 font-medium line-clamp-1">
                          {patient.primaryDiagnosis}
                        </p>
                      </div>

                      {/* Vital Signs Mini Snapshot (HA, Mạch, SpO2) */}
                      {hasVital && (
                        <div 
                          onClick={() => onSelectPatient(patient)}
                          className={`flex items-center gap-1 text-[8px] font-bold px-1 py-0.2 rounded cursor-pointer leading-none my-0.2 ${
                            isVitalAlert 
                              ? 'bg-rose-100 text-rose-800 border border-rose-300 font-extrabold' 
                              : 'bg-slate-100/90 text-slate-700'
                          }`}
                          title={`Sinh hiệu gần nhất: HA ${latestVital.bpSystolic}/${latestVital.bpDiastolic} mmHg, Mạch ${latestVital.heartRate} l/p, SpO2 ${latestVital.spO2}%`}
                        >
                          <Activity className={`w-2 h-2 shrink-0 ${isVitalAlert ? 'text-rose-600 animate-pulse' : 'text-slate-500'}`} />
                          <span>HA:{latestVital.bpSystolic}/{latestVital.bpDiastolic}</span>
                          <span className="text-slate-300">|</span>
                          <span>M:{latestVital.heartRate}</span>
                          <span className="text-slate-300">|</span>
                          <span>SpO2:{latestVital.spO2}%</span>
                        </div>
                      )}

                      {/* Status badge & Tags */}
                      <div className="flex items-center justify-between text-[8px] pt-0.5 border-t border-slate-200/60 mt-0.5 leading-none">
                        <div className="flex items-center gap-0.5 flex-wrap">
                          {renderSmallStatusBadge(patient.admissionStatus)}
                          <button
                            type="button"
                            onClick={(e) => handleCycleSeverity(e, patient)}
                            className={`text-[7.5px] font-black px-1.5 py-0.2 rounded transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95 flex items-center gap-0.5 ${
                              isCritical
                                ? 'bg-rose-600 text-white hover:bg-rose-700'
                                : isModerate
                                ? 'bg-amber-500 text-white hover:bg-amber-600'
                                : isStable
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-slate-200 text-slate-700 border border-slate-300 hover:bg-slate-300'
                            }`}
                            title="Bấm để đổi phân loại nhanh: Nặng ➔ Vừa ➔ Ổn ➔ Chưa PL"
                          >
                            {isCritical && <span className="w-1 h-1 rounded-full bg-white animate-ping" />}
                            <span>{isCritical ? 'NẶNG' : isModerate ? 'VỪA' : isStable ? 'ỔN' : 'Chưa PL'}</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0 flex-wrap">
                          {(patient.tags.includes('O2_CANULA') || patient.tags.includes('O2')) && (
                            <span className="px-1 rounded text-[7.5px] font-black bg-cyan-600 text-white" title="Thở Canula">Canula</span>
                          )}
                          {patient.tags.includes('O2_MASK') && (
                            <span className="px-1 rounded text-[7.5px] font-black bg-blue-600 text-white" title="Thở Mask">Mask</span>
                          )}
                          {patient.tags.includes('FLUID_BALANCE') && (
                            <span className="px-1 rounded text-[7.5px] font-black bg-indigo-600 text-white" title="TD dịch nhập/xuất">TD Dịch</span>
                          )}
                          {patient.tags.includes('VASOPRESSOR') && (
                            <span className="px-1 rounded text-[7.5px] font-black bg-rose-600 text-white animate-pulse" title="Vận mạch">VM</span>
                          )}
                          {patient.tags.includes('CLOSE_MONITORING') && (
                            <span className="px-1 rounded text-[7.5px] font-black bg-amber-500 text-white" title="Theo dõi sát">TDS</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-3.5 relative w-full">
      {/* Daily Duty Roster Bar (Tự động đồng bộ 06:00 hàng ngày) */}
      <DutyRosterBar
        onOpenFullSchedule={() => setIsDutyModalOpen(true)}
        onFilterDoctor={(docName: string) => {
          const matchedDoc = doctors.find((d) => d.name.toLowerCase().includes(docName.toLowerCase()));
          if (matchedDoc) {
            setSelectedDoctorFilter(matchedDoc.id);
          } else {
            setSearchQuery(docName);
          }
        }}
      />

      {/* 🏥 HOSPITAL CENSUS BANNER: THANH THỐNG KÊ TỔNG LỰC TOÀN KHOA */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl border border-slate-700/60 shadow-md p-3 sm:p-4 w-full">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          
          {/* Cụm 1: Công suất giường & Quân số toàn khoa */}
          <div className="flex items-center gap-3 sm:border-r border-slate-700/60 sm:pr-4 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-inner shrink-0">
              <BedDouble className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300">
                  NỘI TRÚ
                </span>
                <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${
                  totalOccupancyPercent >= 90
                    ? 'bg-rose-500 text-white animate-pulse'
                    : totalOccupancyPercent >= 75
                      ? 'bg-amber-500 text-white'
                      : 'bg-emerald-500 text-white'
                }`}>
                  {totalOccupancyPercent}%
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-black tracking-tight text-white font-mono">
                  {stats.total}
                </span>
                <span className="text-xs text-indigo-200 font-bold uppercase">BN</span>
                <span className="text-[11px] text-slate-400 font-medium ml-1">
                  ({availableBedsCount} trống / {totalBedsCount}G)
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-44 bg-slate-800 rounded-full h-1 mt-1 overflow-hidden border border-slate-700/50">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    totalOccupancyPercent >= 90 ? 'bg-rose-400' : totalOccupancyPercent >= 75 ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${totalOccupancyPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Cụm 2: Phân tầng nguy cơ lâm sàng (Nặng, Vừa, Ổn, Chưa phân loại) */}
          <div className="flex items-center gap-1.5 flex-wrap sm:border-r border-slate-700/60 sm:pr-4">
            {/* Nặng */}
            <button
              onClick={() => setSelectedSeverityFilter(selectedSeverityFilter === 'CRITICAL' ? 'ALL' : 'CRITICAL')}
              className={`flex items-center gap-2 px-2.5 py-1 rounded-xl transition-all cursor-pointer border ${
                selectedSeverityFilter === 'CRITICAL'
                  ? 'bg-rose-500/30 border-rose-400 text-white ring-2 ring-rose-400'
                  : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700 text-slate-200'
              }`}
              title="Xem danh sách bệnh nhân NẶNG"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
              <div className="text-left">
                <div className="text-[9.5px] text-rose-300 font-extrabold uppercase tracking-wider">NẶNG</div>
                <div className="text-base font-black text-rose-100 leading-tight font-mono">{stats.critical} <span className="text-[9px] font-normal opacity-75">BN</span></div>
              </div>
            </button>

            {/* Vừa */}
            <button
              onClick={() => setSelectedSeverityFilter(selectedSeverityFilter === 'MODERATE' ? 'ALL' : 'MODERATE')}
              className={`flex items-center gap-2 px-2.5 py-1 rounded-xl transition-all cursor-pointer border ${
                selectedSeverityFilter === 'MODERATE'
                  ? 'bg-amber-500/30 border-amber-400 text-white ring-2 ring-amber-400'
                  : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700 text-slate-200'
              }`}
              title="Xem danh sách bệnh nhân VỪA (Trung bình)"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
              <div className="text-left">
                <div className="text-[9.5px] text-amber-300 font-extrabold uppercase tracking-wider">VỪA</div>
                <div className="text-base font-black text-amber-100 leading-tight font-mono">{stats.moderate} <span className="text-[9px] font-normal opacity-75">BN</span></div>
              </div>
            </button>

            {/* Ổn */}
            <button
              onClick={() => setSelectedSeverityFilter(selectedSeverityFilter === 'STABLE' ? 'ALL' : 'STABLE')}
              className={`flex items-center gap-2 px-2.5 py-1 rounded-xl transition-all cursor-pointer border ${
                selectedSeverityFilter === 'STABLE'
                  ? 'bg-emerald-500/30 border-emerald-400 text-white ring-2 ring-emerald-400'
                  : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700 text-slate-200'
              }`}
              title="Xem danh sách bệnh nhân ỔN ĐỊNH"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
              <div className="text-left">
                <div className="text-[9.5px] text-emerald-300 font-extrabold uppercase tracking-wider">ỔN</div>
                <div className="text-base font-black text-emerald-100 leading-tight font-mono">{stats.stable} <span className="text-[9px] font-normal opacity-75">BN</span></div>
              </div>
            </button>

            {/* Chưa phân loại */}
            <button
              onClick={() => setSelectedSeverityFilter(selectedSeverityFilter === 'UNCLASSIFIED' ? 'ALL' : 'UNCLASSIFIED')}
              className={`flex items-center gap-2 px-2.5 py-1 rounded-xl transition-all cursor-pointer border ${
                selectedSeverityFilter === 'UNCLASSIFIED'
                  ? 'bg-slate-600 border-slate-400 text-white ring-2 ring-slate-400'
                  : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700 text-slate-300'
              }`}
              title="Xem danh sách bệnh nhân CHƯA PHÂN LOẠI"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
              <div className="text-left">
                <div className="text-[9.5px] text-slate-400 font-extrabold uppercase tracking-wider">CHƯA PL</div>
                <div className="text-base font-black text-slate-200 leading-tight font-mono">{stats.unclassified} <span className="text-[9px] font-normal opacity-75">BN</span></div>
              </div>
            </button>
          </div>

          {/* Cụm 3: Can thiệp Hồi sức Trọng yếu & Lưu chuyển */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelectedTagFilter(selectedTagFilter === 'O2_CANULA' ? 'ALL' : 'O2_CANULA')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                selectedTagFilter === 'O2_CANULA'
                  ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200'
                  : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700 text-cyan-300'
              }`}
              title="Thở Oxy Canula + Mask"
            >
              <Wind className="w-3.5 h-3.5 text-cyan-400" />
              <span>Oxy: <strong className="text-white font-mono">{stats.canulaCount + stats.maskCount}</strong></span>
            </button>

            <button
              onClick={() => setSelectedTagFilter(selectedTagFilter === 'VASOPRESSOR' ? 'ALL' : 'VASOPRESSOR')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                selectedTagFilter === 'VASOPRESSOR'
                  ? 'bg-rose-500/30 border-rose-400 text-rose-200'
                  : stats.vasoCount > 0
                    ? 'bg-rose-950/60 border-rose-700 text-rose-300 animate-pulse'
                    : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700 text-slate-300'
              }`}
              title="Đang dùng vận mạch (Noradrenalin, Dopamin...)"
            >
              <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
              <span>Vận mạch: <strong className="text-white font-mono">{stats.vasoCount}</strong></span>
            </button>

            <div className="h-6 w-[1px] bg-slate-700/80 mx-1 hidden sm:block" />

            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-950/60 border border-emerald-700/60 text-emerald-300" title="Bệnh nhân mới vào viện hôm nay">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Vào: <strong className="text-white font-mono">+{stats.admittedToday}</strong>
              </span>
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-950/60 border border-purple-700/60 text-purple-300" title="Bệnh nhân ra viện hôm nay">
                <LogOut className="w-3 h-3 text-purple-400" />
                Ra: <strong className="text-white font-mono">{stats.dischargeToday}</strong>
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* Top Bar: View Mode Switcher, Bed Rows Toggle & Quick Filters (Compact) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden w-full mb-2">
        {/* Row 1: View mode switcher, Expand Beds Button & Search */}
        <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Segmented View Mode Switcher + Expand Beds Toggle */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="inline-flex items-center p-0.5 bg-slate-200/80 rounded-lg gap-0.5">
              <button
                onClick={() => setViewMode('whiteboard')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold transition-all ${
                  viewMode === 'whiteboard'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Chế độ xem ngắn gọn (Bảng buồng phòng)"
              >
                <Columns3 className="w-3.5 h-3.5 text-rose-600" />
                <span>Bảng buồng phòng</span>
              </button>

              <button
                onClick={() => setViewMode('detailed')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold transition-all ${
                  viewMode === 'detailed'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Thẻ chi tiết buồng giường"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
                <span>Thẻ chi tiết</span>
              </button>
            </div>

            {/* Expand / Collapse Bed Rows */}
            {viewMode === 'whiteboard' && (
              <button
                type="button"
                onClick={() => setShowExpandedBeds(!showExpandedBeds)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border transition-all ${
                  showExpandedBeds
                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:border-slate-400'
                }`}
                title={showExpandedBeds ? 'Thu gọn hiển thị 3 giường cơ bản' : 'Mở rộng hiển thị tối đa 6 giường (cho phòng 735, 743, 749, 757)'}
              >
                {showExpandedBeds ? (
                  <>
                    <Minimize2 className="w-3 h-3" />
                    <span>Thu gọn (3G)</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3 h-3 text-rose-600" />
                    <span>Mở rộng (4 - 6G)</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Quick Search & Admit Patient */}
          <div className="flex items-center gap-1.5 flex-1 max-w-md justify-end">
            <div className="relative w-full max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm BN, phòng, giường, Bác sĩ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-6 py-1 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 font-medium placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              onClick={() => onAdmitToBed('733', 'Giường 01')}
              className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-2xs transition-colors shrink-0"
              title="Tiếp nhận bệnh nhân mới vào khoa"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ Tiếp nhận</span>
            </button>
          </div>
        </div>

        {/* Row 2: Status Badges Filter Bar (Compact Chips) */}
        <div className="px-3 py-1 bg-white flex flex-wrap items-center gap-1 text-[11px] overflow-x-auto">
          <span className="font-extrabold text-slate-600 uppercase text-[10px] mr-0.5">Lọc nhanh:</span>

          <button
            onClick={() => {
              setSelectedStatusFilter('ALL');
              setSelectedSeverityFilter('ALL');
              setSelectedTagFilter('ALL');
              setSelectedDoctorFilter('ALL');
              setSelectedDiseaseFilter('ALL');
              setSearchQuery('');
            }}
            className={`px-2 py-0.5 rounded-md font-bold transition-all ${
              selectedStatusFilter === 'ALL' && selectedSeverityFilter === 'ALL' && selectedTagFilter === 'ALL' && selectedDiseaseFilter === 'ALL' && !searchQuery
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Tất cả ({stats.total})
          </button>

          <button
            onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'ADMITTED_YESTERDAY' ? 'ALL' : 'ADMITTED_YESTERDAY')}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold transition-all ${
              selectedStatusFilter === 'ADMITTED_YESTERDAY'
                ? 'bg-amber-500 text-white shadow-2xs'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <Clock className="w-2.5 h-2.5" />
            <span>Hôm qua ({stats.admittedYesterday})</span>
          </button>

          <button
            onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'ADMITTED_TODAY' ? 'ALL' : 'ADMITTED_TODAY')}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold transition-all ${
              selectedStatusFilter === 'ADMITTED_TODAY'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-2.5 h-2.5" />
            <span>Hôm nay ({stats.admittedToday})</span>
          </button>

          <button
            onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'DISCHARGE_TODAY' ? 'ALL' : 'DISCHARGE_TODAY')}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold transition-all ${
              selectedStatusFilter === 'DISCHARGE_TODAY'
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100'
            }`}
          >
            <LogOut className="w-2.5 h-2.5" />
            <span>RV nay ({stats.dischargeToday})</span>
          </button>

          <button
            onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'DISCHARGE_TOMORROW' ? 'ALL' : 'DISCHARGE_TOMORROW')}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold transition-all ${
              selectedStatusFilter === 'DISCHARGE_TOMORROW'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
            }`}
          >
            <CalendarDays className="w-2.5 h-2.5" />
            <span>RV mai ({stats.dischargeTomorrow})</span>
          </button>

          <div className="h-3.5 w-[1px] bg-slate-300 mx-0.5 hidden sm:block" />

          {/* Severity Filters */}
          <button
            onClick={() => setSelectedSeverityFilter(selectedSeverityFilter === 'CRITICAL' ? 'ALL' : 'CRITICAL')}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold transition-all ${
              selectedSeverityFilter === 'CRITICAL'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 inline-block animate-pulse" />
            <span>Nặng ({stats.critical})</span>
          </button>

          <button
            onClick={() => setSelectedSeverityFilter(selectedSeverityFilter === 'MODERATE' ? 'ALL' : 'MODERATE')}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold transition-all ${
              selectedSeverityFilter === 'MODERATE'
                ? 'bg-amber-500 text-white shadow-2xs'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
            <span>Trung bình ({stats.moderate})</span>
          </button>

          <button
            onClick={() => setSelectedSeverityFilter(selectedSeverityFilter === 'STABLE' ? 'ALL' : 'STABLE')}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold transition-all ${
              selectedSeverityFilter === 'STABLE'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
            <span>Ổn định ({stats.stable})</span>
          </button>

          <button
            onClick={() => setSelectedSeverityFilter(selectedSeverityFilter === 'UNCLASSIFIED' ? 'ALL' : 'UNCLASSIFIED')}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold transition-all ${
              selectedSeverityFilter === 'UNCLASSIFIED'
                ? 'bg-slate-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block" />
            <span>Chưa phân loại ({stats.unclassified})</span>
          </button>

          <div className="h-3.5 w-[1px] bg-slate-300 mx-0.5 hidden sm:block" />

          {/* Special Tags Filter */}
          <button
            onClick={() => setSelectedTagFilter(selectedTagFilter === 'O2_CANULA' ? 'ALL' : 'O2_CANULA')}
            className={`px-1.5 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
              selectedTagFilter === 'O2_CANULA'
                ? 'bg-cyan-600 text-white shadow-2xs'
                : 'bg-cyan-50 text-cyan-800 border border-cyan-200 hover:bg-cyan-100'
            }`}
          >
            Thở Canula ({stats.canulaCount})
          </button>
          <button
            onClick={() => setSelectedTagFilter(selectedTagFilter === 'O2_MASK' ? 'ALL' : 'O2_MASK')}
            className={`px-1.5 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
              selectedTagFilter === 'O2_MASK'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
            }`}
          >
            Thở Mask ({stats.maskCount})
          </button>
          <button
            onClick={() => setSelectedTagFilter(selectedTagFilter === 'FLUID_BALANCE' ? 'ALL' : 'FLUID_BALANCE')}
            className={`px-1.5 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
              selectedTagFilter === 'FLUID_BALANCE'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100'
            }`}
          >
            TD Dịch ({stats.fluidBalanceCount})
          </button>
          <button
            onClick={() => setSelectedTagFilter(selectedTagFilter === 'VASOPRESSOR' ? 'ALL' : 'VASOPRESSOR')}
            className={`px-1.5 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
              selectedTagFilter === 'VASOPRESSOR'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            Vận Mạch ({stats.vasoCount})
          </button>
          <button
            onClick={() => setSelectedTagFilter(selectedTagFilter === 'CLOSE_MONITORING' ? 'ALL' : 'CLOSE_MONITORING')}
            className={`px-1.5 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
              selectedTagFilter === 'CLOSE_MONITORING'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            Theo Dõi Sát ({stats.monitoringCount})
          </button>
        </div>

        {/* Row 3: 3 Room Group Tabs (Nhóm Tim mạch | Nhóm 2 | Nhóm 1) - Compact */}
        <div className="px-3 sm:px-5 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-extrabold text-slate-700 mr-1">3 Nhóm buồng bệnh:</span>
            
            {/* All Groups */}
            <button
              onClick={() => setSelectedGroup('ALL')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                selectedGroup === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
              }`}
            >
              Tất cả khoa (28 buồng)
            </button>

            {/* Group 1: 703, 707, 705, 709, 711, 713, 715, 717, 718, 721, 725, 727, 729, 731, 733 */}
            <button
              onClick={() => setSelectedGroup('GROUP_1')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                selectedGroup === 'GROUP_1'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Nhóm 1 (P.703 - 733)</span>
              <span className="text-[10px] opacity-75 font-mono">({group1Rooms.length}P)</span>
            </button>

            {/* Group 2: 747, 749, 751, 753, 755, 757 */}
            <button
              onClick={() => setSelectedGroup('GROUP_2')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                selectedGroup === 'GROUP_2'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <span>Nhóm 2 (P.747 - 757)</span>
              <span className="text-[10px] opacity-75 font-mono">({group2Rooms.length}P)</span>
            </button>

            {/* Group Tim Mạch: 735, 737, 739, 741, 743, 745 */}
            <button
              onClick={() => setSelectedGroup('CARDIO')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                selectedGroup === 'CARDIO'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Nhóm TM (P.735 - 745)</span>
              <span className="text-[10px] opacity-75 font-mono">({cardioRooms.length}P)</span>
            </button>
          </div>

          {/* Active Doctor Filter Highlight */}
          {selectedDoctorFilter !== 'ALL' && (
            <div className="flex items-center gap-1.5 bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-1 rounded-lg text-xs font-bold">
              <span>Đang lọc BS: {doctorMap.get(selectedDoctorFilter)?.name}</span>
              <button onClick={() => setSelectedDoctorFilter('ALL')} className="text-blue-500 hover:text-blue-800 ml-1">✕</button>
            </div>
          )}
        </div>
      </div>

      {/* Disease Surveillance & Over 70 Statistics Bar */}
      <DiseaseStatisticsBar
        patients={patients}
        selectedFilter={selectedDiseaseFilter}
        onSelectFilter={setSelectedDiseaseFilter}
      />

      {/* VIEW 1: WHITEBOARD COMPACT VIEW (CHẾ ĐỘ XEM NGẮN GỌN) */}
      {viewMode === 'whiteboard' && (
        <div className="space-y-4 w-full">
          {selectedGroup === 'ALL' ? (
            <>
              {/* 1. NHÓM 1: 703, 707, 705, 709, 711, 713, 715, 717, 718, 721, 725, 727, 729, 731 */}
              {group1Rooms.length > 0 && (
                <div className="bg-white rounded-2xl border-2 border-blue-300 shadow-2xs p-3 sm:p-4 w-full">
                  <div className="flex items-center gap-2 pb-2.5 mb-2.5 border-b border-blue-100">
                    <span className="w-3 h-5 rounded-full bg-blue-600 shrink-0" />
                    <h2 className="text-sm font-black text-blue-950 tracking-tight uppercase">
                      NHÓM 1: PHÒNG 703, 707, 705, 709, 711, 713, 715, 717, 718, 721, 725, 727, 729, 731
                    </h2>
                  </div>
                  {renderRoomColumns(group1Rooms)}
                </div>
              )}

              {/* 2. NHÓM TIM MẠCH: 733, 735, 737, 739, 741, 743, 745 */}
              {cardioRooms.length > 0 && (
                <div className="bg-white rounded-2xl border-2 border-rose-300 shadow-2xs p-3 sm:p-4 w-full">
                  <div className="flex items-center gap-2 pb-2.5 mb-2.5 border-b border-rose-100">
                    <span className="w-3 h-5 rounded-full bg-rose-600 shrink-0" />
                    <h2 className="text-sm font-black text-rose-950 tracking-tight uppercase">
                      NHÓM TIM MẠCH: PHÒNG 733, 735, 737, 739, 741, 743, 745
                    </h2>
                  </div>
                  {renderRoomColumns(cardioRooms)}
                </div>
              )}

              {/* 3. NHÓM 2: 747, 749, 751, 753, 755, 757 */}
              {group2Rooms.length > 0 && (
                <div className="bg-white rounded-2xl border-2 border-indigo-300 shadow-2xs p-3 sm:p-4 w-full">
                  <div className="flex items-center gap-2 pb-2.5 mb-2.5 border-b border-indigo-100">
                    <span className="w-3 h-5 rounded-full bg-indigo-600 shrink-0" />
                    <h2 className="text-sm font-black text-indigo-950 tracking-tight uppercase">
                      NHÓM 2: PHÒNG 747, 749, 751, 753, 755, 757
                    </h2>
                  </div>
                  {renderRoomColumns(group2Rooms)}
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-3 sm:p-4 w-full">
              {renderRoomColumns(filteredRooms)}
            </div>
          )}

          {/* BOTTOM SUMMARY ROW: DOCTORS & PATIENT COUNT (BẢNG TRỰC KHOA) */}
          <div className="bg-white rounded-2xl border border-slate-300 shadow-2xs overflow-hidden w-full">
            <div className="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-rose-400" />
                <span className="font-black uppercase tracking-wider">
                  TỔNG HỢP SỐ BỆNH NHÂN THEO BÁC SĨ (BẢNG TRỰC KHOA)
                </span>
              </div>
              <span className="text-slate-400 text-[11px] hidden sm:inline">
                Nhấp vào tên bác sĩ để lọc nhanh bệnh nhân trên bảng
              </span>
            </div>

            <div className="overflow-x-auto p-3 sm:p-4 custom-scrollbar w-full">
              <table className="min-w-full border-collapse border border-slate-300 text-center text-xs">
                <tbody>
                  {/* Row: BÁC SĨ */}
                  <tr className="bg-slate-100 font-black text-slate-800 divide-x divide-slate-300 border-b border-slate-300">
                    <td className="w-24 px-3 py-2 bg-slate-200 text-slate-900 uppercase font-black sticky left-0 z-10">
                      BÁC SĨ
                    </td>
                    {activeDoctors.map((doc) => {
                      const isSelected = selectedDoctorFilter === doc.id;
                      const shortName = getDoctorShortName(doc);
                      return (
                        <td
                          key={doc.id}
                          onClick={() => setSelectedDoctorFilter(isSelected ? 'ALL' : doc.id)}
                          className={`min-w-[80px] px-2 py-2 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-rose-600 text-white font-black'
                              : 'hover:bg-slate-200 text-slate-800'
                          }`}
                          title={`${doc.name} (${doc.title} - ${doc.role})`}
                        >
                          <span className="font-black block text-xs">{shortName}</span>
                          
                        </td>
                      );
                    })}
                  </tr>

                  {/* Row: SỐ BN */}
                  <tr className="bg-white font-extrabold text-slate-900 divide-x divide-slate-300">
                    <td className="px-3 py-2 bg-slate-100 text-slate-700 uppercase font-bold sticky left-0 z-10 text-[11px]">
                      SỐ BN
                    </td>
                    {activeDoctors.map((doc) => {
                      const count = doctorPatientCounts[doc.id] || 0;
                      const isSelected = selectedDoctorFilter === doc.id;
                      return (
                        <td
                          key={doc.id}
                          onClick={() => setSelectedDoctorFilter(isSelected ? 'ALL' : doc.id)}
                          className={`px-2 py-2 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-rose-100 text-rose-900 font-black ring-2 ring-rose-500'
                              : count > 0
                              ? 'text-slate-900 hover:bg-slate-50'
                              : 'text-slate-300'
                          }`}
                        >
                          <span className={`inline-block px-2 py-0.5 rounded-full font-black text-sm ${
                            count >= 8
                              ? 'bg-rose-100 text-rose-700'
                              : count > 0
                              ? 'bg-blue-50 text-blue-800'
                              : 'text-slate-400'
                          }`}>
                            {count}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: DETAILED WARD CARDS VIEW */}
      {viewMode === 'detailed' && (
        <div className="space-y-4 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5">
            {filteredRooms.map((room) => {
              const assignedDocId = roomDoctorState[room.number] || DEFAULT_ROOM_DOCTORS[room.number];
              const doc = assignedDocId ? doctorMap.get(assignedDocId) : null;
              const shortName = doc ? getDoctorShortName(doc) : 'Chưa phân';

              // Calculate room occupancy
              const roomPatients = patients.filter((p) => {
                if (p.status !== 'ACTIVE') return false;
                const pRoom = p.roomNumber.replace(/^(phòng|p\.?|buồng|b\.?)\s*/i, '').trim();
                return pRoom === room.number;
              });
              const occupiedCount = roomPatients.length;
              const totalBeds = room.totalBeds;
              const occupancyPercent = totalBeds > 0 ? Math.min(100, Math.round((occupiedCount / totalBeds) * 100)) : 0;
              const isFull = occupiedCount >= totalBeds;
              const isNearlyFull = !isFull && occupiedCount > 0 && occupancyPercent >= 66;

              return (
                <div 
                  key={room.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between"
                >
                  <div className="p-3 bg-slate-900 text-white flex flex-col justify-between gap-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-base">Phòng {room.number}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isFull 
                              ? 'bg-rose-500 text-white font-black animate-pulse' 
                              : isNearlyFull
                                ? 'bg-amber-500 text-white'
                                : occupiedCount > 0
                                  ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/30'
                                  : 'bg-white/20 text-slate-200'
                          }`}>
                            {occupiedCount}/{room.totalBeds} giường {isFull ? '(Đầy)' : occupiedCount === 0 ? '(Trống)' : ''}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 truncate max-w-[180px]">
                          {room.name}
                        </p>
                      </div>

                      <button
                        onClick={() => setRoomToChangeDoctor(room.number)}
                        className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition-colors flex items-center gap-1"
                        title="Đổi bác sĩ phụ trách buồng"
                      >
                        <Stethoscope className="w-3 h-3 text-rose-300" />
                        <span>{shortName}</span>
                      </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden" title={`Công suất buồng: ${occupiedCount}/${totalBeds} giường (${occupancyPercent}%)`}>
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          isFull 
                            ? 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.9)]' 
                            : isNearlyFull 
                              ? 'bg-amber-400' 
                              : occupiedCount > 0 
                                ? 'bg-emerald-400' 
                                : 'bg-transparent'
                        }`}
                        style={{ width: `${occupancyPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-2.5 space-y-2 flex-1">
                    {Array.from({ length: room.totalBeds }, (_, idx) => {
                      const bedNum = `Giường ${idx + 1 < 10 ? '0' + (idx + 1) : idx + 1}`;
                      const key = `${room.number}__${bedNum}`;
                      const pt = patientGridMap.get(key);

                      if (!pt) {
                        return (
                          <div
                            key={bedNum}
                            onClick={() => onAdmitToBed(room.number, bedNum)}
                            className="p-2 rounded-xl border border-dashed border-slate-200 hover:border-rose-400 bg-slate-50/50 hover:bg-rose-50/30 cursor-pointer flex items-center justify-between text-xs text-slate-400 transition-colors"
                          >
                            <span className="font-mono font-bold text-slate-500">{bedNum}</span>
                            <span className="text-[11px] flex items-center gap-1 text-slate-400 hover:text-rose-600">
                              <PlusCircle className="w-3.5 h-3.5" />
                              Trống
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={pt.id}
                          className="p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-white shadow-2xs transition-all space-y-1.5"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div 
                              onClick={() => onSelectPatient(pt)}
                              className="cursor-pointer"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 hover:text-rose-600 text-xs">
                                  {pt.fullName}
                                </span>
                                <span className="text-[10px] text-slate-500 font-semibold">
                                  ({pt.age}t)
                                </span>
                              </div>
                              <span className="text-[10px] font-mono font-bold text-rose-700 block">
                                {pt.bedNumber}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => onTransferPatient(pt)}
                                className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                title="Chuyển giường"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setPatientToDelete(pt)}
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                title="Xóa khỏi phòng"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-600 line-clamp-1">
                            {pt.primaryDiagnosis}
                          </p>

                          <div className="flex items-center justify-between text-[10px]">
                            {renderSmallStatusBadge(pt.admissionStatus)}
                            <span className={`px-1.5 py-0.2 rounded font-bold ${
                              pt.severity === 'CRITICAL'
                                ? 'bg-rose-600 text-white'
                                : pt.severity === 'MODERATE'
                                ? 'bg-amber-500 text-white'
                                : 'bg-emerald-600 text-white'
                            }`}>
                              {pt.severity === 'CRITICAL' ? 'NẶNG' : pt.severity === 'MODERATE' ? 'TB' : 'Nhẹ'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FLOATING HOVER TOOLTIP ON PATIENT NAME */}
      {hoveredPatientData && (
        <div
          className="fixed z-50 pointer-events-none w-88 bg-slate-950/95 text-white rounded-2xl shadow-2xl p-4 border border-slate-700 text-xs backdrop-blur-md animate-in fade-in duration-100 space-y-2.5"
          style={{
            left: Math.min(hoveredPatientData.x, window.innerWidth - 370),
            top: Math.max(16, Math.min(hoveredPatientData.y - 40, window.innerHeight - 360)),
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between pb-2 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-rose-300">
                  {formatPatientDisplayName(hoveredPatientData.patient.fullName)}
                </span>
                <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                  <span>{hoveredPatientData.patient.age}t</span>
                  <span>•</span>
                  {hoveredPatientData.patient.gender === 'Nam' ? (
                    <span className="inline-flex items-center gap-0.5 text-blue-400 font-black"><span>♂</span> Nam</span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-rose-400 font-black"><span>♀</span> Nữ</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold mt-0.5">
                <BedDouble className="w-3 h-3 text-rose-400" />
                <span>Phòng {hoveredPatientData.patient.roomNumber} - {hoveredPatientData.patient.bedNumber}</span>
              </div>
            </div>

            <div className="text-right">
              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                hoveredPatientData.patient.severity === 'CRITICAL'
                  ? 'bg-rose-600 text-white'
                  : hoveredPatientData.patient.severity === 'MODERATE'
                  ? 'bg-amber-500 text-white'
                  : 'bg-emerald-600 text-white'
              }`}>
                {hoveredPatientData.patient.severity === 'CRITICAL' ? 'NẶNG' : hoveredPatientData.patient.severity === 'MODERATE' ? 'TRUNG BÌNH' : 'NHẸ'}
              </span>
            </div>
          </div>

          {/* Diagnosis */}
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Chẩn đoán hiện tại:
            </span>
            <p className="text-xs text-white font-semibold leading-snug mt-0.5">
              {hoveredPatientData.patient.primaryDiagnosis}
              
            </p>
          </div>

          {/* Ghi chú của bác sĩ (Doctor's Note) */}
          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-bold">
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Ghi chú của bác sĩ:</span>
            </div>
            <p className="text-[11px] text-slate-200 leading-relaxed italic">
              {hoveredPatientData.patient.importantNotes || 
               hoveredPatientData.patient.evolutions?.[0]?.clinicalNote || 
               'Bệnh nhân tỉnh, tiếp xúc tốt, sinh hiệu ổn định.'}
            </p>
          </div>

          {/* Hướng xử trí (Treatment Action / Management Plan) */}
          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-bold">
              <Activity className="w-3.5 h-3.5" />
              <span>Hướng xử trí:</span>
            </div>
            <p className="text-[11px] text-slate-200 leading-relaxed">
              {hoveredPatientData.patient.evolutions?.[0]?.treatmentAction || 
               (hoveredPatientData.patient.medications?.length > 0 
                ? `Duy trì thuốc: ${hoveredPatientData.patient.medications.map(m => m.name).slice(0, 3).join(', ')}...`
                : 'Tiếp tục theo dõi lâm sàng và điều trị theo phác đồ.')}
            </p>
          </div>

          {/* Ghi chú bàn giao bệnh (nếu có) */}
          {(hoveredPatientData.patient.handoverNotes || hoveredPatientData.patient.tags.includes('CLOSE_MONITORING')) && (
            <div className="bg-rose-950/40 p-2.5 rounded-xl border border-rose-900/60 space-y-1">
              <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-bold">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Ghi chú bàn giao ca trực:</span>
              </div>
              <p className="text-[11px] text-rose-200 leading-relaxed">
                {hoveredPatientData.patient.handoverNotes || 
                 'Lưu ý ca trực: Bệnh nhân cần theo dõi sát sinh hiệu mỗi 2h, báo ngay BS trực nếu SpO2 < 92% hoặc HA tụt.'}
              </p>
            </div>
          )}

          {/* Footer attending doctor */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[10px] text-slate-400">
            <span>BS điều trị: <strong className="text-slate-200">{doctorMap.get(hoveredPatientData.patient.attendingDoctorId)?.name || 'Chưa phân công'}</strong></span>
            <span>Nhấp vào thẻ để mở hồ sơ đầy đủ</span>
          </div>
        </div>
      )}

      {/* CONFIRMATION WARNING MODAL BEFORE DELETING PATIENT FROM ROOM */}
      {patientToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-rose-200 overflow-hidden animate-in zoom-in-95">
            <div className="p-5 bg-rose-50 border-b border-rose-100 flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-100 text-rose-600 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-rose-950">
                  Cảnh báo: Xác nhận xóa bệnh nhân khỏi phòng
                </h3>
                <p className="text-xs text-rose-700 mt-1">
                  Hành động này sẽ giải phóng giường bệnh và chuyển hồ sơ bệnh nhân sang trạng thái xuất viện/đã xóa khỏi buồng phòng.
                </p>
              </div>
            </div>

            <div className="p-5 space-y-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5 font-sans">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Bệnh nhân:</span>
                  <span className="font-extrabold text-slate-900">{patientToDelete.fullName} ({patientToDelete.age} tuổi)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Vị trí giường:</span>
                  <span className="font-bold text-rose-700">Phòng {patientToDelete.roomNumber} - {patientToDelete.bedNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Chẩn đoán:</span>
                  <span className="font-medium text-slate-800 text-right max-w-[240px] truncate">{patientToDelete.primaryDiagnosis}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">BS điều trị:</span>
                  <span className="font-medium text-slate-800">{getDoctorShortName(doctorMap.get(patientToDelete.attendingDoctorId))}</span>
                </div>
              </div>

              <p className="text-xs text-slate-500 italic">
                * Lưu ý: Hồ sơ sẽ được lưu vào danh sách xuất viện, bạn có thể xem lại trong tab danh sách tổng hợp.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPatientToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeletePatient) {
                    onDeletePatient(patientToDelete.id);
                  }
                  setPatientToDelete(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xác nhận xóa khỏi phòng</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ROOM DOCTOR ASSIGNMENT MODAL (INTERACTIVE SWITCHER) */}
      {roomToChangeDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-rose-400" />
                <div>
                  <h3 className="text-sm font-black">
                    Phân công Bác sĩ phụ trách Phòng {roomToChangeDoctor}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Khoa Nội Tổng Hợp - Tim Mạch
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setRoomToChangeDoctor(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Doctor in charge */}
            <div className="p-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <span className="text-xs text-rose-900 font-semibold">
                Bác sĩ hiện tại:
              </span>
              <span className="text-xs font-extrabold text-rose-700">
                {doctorMap.get(roomDoctorState[roomToChangeDoctor] || DEFAULT_ROOM_DOCTORS[roomToChangeDoctor])?.name || 'Chưa phân công'}
              </span>
            </div>

            {/* Doctor Picker List */}
            <div className="p-4 space-y-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo tên bác sĩ..."
                  value={doctorSearchInModal}
                  onChange={(e) => setDoctorSearchInModal(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                {sortDoctorsAlphabetically(
                  doctors.filter((d) => 
                    !['00101', '00199'].includes(d.id) &&
                    !/tuế|quyên/i.test(d.name) &&
                    (!doctorSearchInModal.trim() || 
                    d.name.toLowerCase().includes(doctorSearchInModal.toLowerCase()) ||
                    (d.specialty && d.specialty.toLowerCase().includes(doctorSearchInModal.toLowerCase())) ||
                    d.role.toLowerCase().includes(doctorSearchInModal.toLowerCase()))
                  )
                ).map((doc) => {
                    const isCurrent = (roomDoctorState[roomToChangeDoctor] || DEFAULT_ROOM_DOCTORS[roomToChangeDoctor]) === doc.id;
                    const patientCount = doctorPatientCounts[doc.id] || 0;
                    const shortName = getDoctorShortName(doc);
                    const isGroup1 = GROUP_1_DOCTOR_IDS.includes(doc.id) || /ngọc|trung|huyền|thiên|ánh|bình chi/i.test(doc.name);
                    const isGroup2 = GROUP_2_DOCTOR_IDS.includes(doc.id) || /linh|hoài|mai|ngoan|nguyễn thị phương chi/i.test(doc.name);
                    const groupBadge = isGroup1 
                      ? { label: 'Nhóm 1', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
                      : isGroup2
                      ? { label: 'Nhóm 2', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
                      : { label: 'Tim Mạch', bg: 'bg-rose-50 text-rose-700 border-rose-200' };

                    return (
                      <div
                        key={doc.id}
                        onClick={() => handleAssignDoctorToRoom(doc.id)}
                        className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                          isCurrent
                            ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-300'
                            : 'bg-white border-slate-200 hover:border-rose-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                            isCurrent ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {shortName.slice(0, 2)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-xs text-slate-900">
                                {doc.name}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-bold">
                                {shortName}
                              </span>
                              <span className={`text-[9.5px] px-1.5 py-0.2 rounded-full border font-black ${groupBadge.bg}`}>
                                {groupBadge.label}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 block">
                              {doc.phone ? `SĐT: ${doc.phone}` : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                            {patientCount} BN
                          </span>
                          {isCurrent && (
                            <Check className="w-4 h-4 text-rose-600" />
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Checkbox option to sync all active patients in this room */}
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-2 border-t border-slate-200">
                <input
                  type="checkbox"
                  checked={syncPatientsWithRoomDoctor}
                  onChange={(e) => setSyncPatientsWithRoomDoctor(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                />
                <span>Đồng bộ cập nhật BS điều trị cho tất cả BN đang nằm tại phòng này</span>
              </label>
            </div>

            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setRoomToChangeDoctor(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duty Roster Modal */}
      {isDutyModalOpen && (
        <DutyRosterModal
          onClose={() => setIsDutyModalOpen(false)}
        />
      )}
    </div>
  );
};

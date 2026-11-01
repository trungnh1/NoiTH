import React, { useState, useEffect, useMemo } from 'react';
import { Doctor, Patient, DepartmentRoom, WARD_GROUPS_META, WardRoomGroup } from '../types/patient';
import { 
  Users, 
  Calendar, 
  Search, 
  Filter, 
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  Stethoscope,
  Copy,
  UserCheck,
  AlertCircle,
  Building2,
  ChevronDown,
  ChevronUp,
  Layers,
  TableProperties,
  LayoutGrid,
  BarChart3,
  HeartPulse,
  Activity,
  BedDouble,
  Sparkles
} from 'lucide-react';

import { getDoctorShortName } from '../data/mockData';
import { sortDoctorsAlphabetically, formatPatientName } from '../utils/doctorSorter';

/**
 * Định dạng tên hiển thị của Bác sĩ: Chỉ giữ lại Tên chính (không lấy Họ và Tên đệm)
 * Ví dụ:
 * - "BS. Đặng Thị Ngọc Ánh" -> "BS. Ánh"
 * - "BS. Nguyễn Hữu Trung" -> "BS. Trung"
 * - "Trần Bùi Bình Chi" -> "BS. Bình Chi"
 */
export function formatDoctorGivenName(nameOrDoctor?: string | Doctor | null): string {
  const shortName = getDoctorShortName(nameOrDoctor);
  if (!shortName || shortName === 'Chưa phân') return 'Chưa phân';
  return shortName.startsWith('BS.') ? shortName : `BS. ${shortName}`;
}

interface DoctorAllocationViewProps {
  rooms: DepartmentRoom[];
  doctors: Doctor[];
  patients: Patient[];
  onSelectPatient: (patient: Patient) => void;
  onReassignDoctor: (patientId: string, newDoctorId: string) => void;
  onReassignDoctorForRoom: (roomNumber: string, newDoctorId: string) => void;
}

interface RoomDutySchedule {
  yesterdayDoctorId: string;
  todayDoctorId: string;
  tomorrowDoctorId: string;
}

const SCHEDULE_STORAGE_KEY = 'hvg_room_doctor_schedule_v2';

export const DoctorAllocationView: React.FC<DoctorAllocationViewProps> = ({
  rooms,
  doctors: rawDoctors,
  patients,
  onSelectPatient,
  onReassignDoctorForRoom,
}) => {
  // Sắp xếp bác sĩ theo bảng chữ cái ABC của tên chính
  const doctors = useMemo(() => sortDoctorsAlphabetically(rawDoctors), [rawDoctors]);

  const activePatients = useMemo(
    () => patients.filter((p) => p.status === 'ACTIVE'),
    [patients]
  );

  // Chế độ xem: 'rooms' (Theo buồng phòng) hoặc 'doctor_stats' (Thống kê chi tiết theo BS)
  const [viewMode, setViewMode] = useState<'rooms' | 'doctor_stats'>('rooms');

  // Tùy chọn hiển thị danh sách bệnh nhân trong buồng phòng (lưu vào localStorage)
  const [showPatientsInRooms, setShowPatientsInRooms] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('hvg_allocation_show_patients');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const toggleShowPatientsInRooms = () => {
    setShowPatientsInRooms((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('hvg_allocation_show_patients', JSON.stringify(next));
      } catch {
        // ignore
      }
      showToast(next ? 'Đã bật hiển thị bệnh nhân trong phòng' : 'Đã ẩn danh sách bệnh nhân (giao diện siêu gọn)');
      return next;
    });
  };

  // Search & filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Formatted date labels
  const dateLabels = useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const fmt = (d: Date) =>
      `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

    return {
      yesterday: fmt(yesterday),
      today: fmt(today),
      tomorrow: fmt(tomorrow),
    };
  }, []);

  // Room Doctor Schedule Map (roomNumber -> { yesterdayDoctorId, todayDoctorId, tomorrowDoctorId })
  const [scheduleMap, setScheduleMap] = useState<Record<string, RoomDutySchedule>>(() => {
    try {
      const saved = localStorage.getItem(SCHEDULE_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return {};
  });

  // Keep scheduleMap populated for every room, using actual active patients in room as initial todayDoctor
  useEffect(() => {
    setScheduleMap((prev) => {
      let changed = false;
      const next = { ...prev };

      rooms.forEach((room, index) => {
        const roomPatients = activePatients.filter(
          (p) => p.roomNumber === room.number || p.roomNumber === `P.${room.number}` || p.roomNumber === `Phòng ${room.number}`
        );

        // Current doctor from patients or round-robin default
        const activeDocId =
          roomPatients[0]?.attendingDoctorId ||
          doctors[index % Math.max(1, doctors.length)]?.id ||
          doctors[0]?.id ||
          '';

        // Yesterday doctor fallback (previous in list)
        const yestDocId =
          doctors[(index + doctors.length - 1) % Math.max(1, doctors.length)]?.id ||
          activeDocId;

        if (!next[room.number]) {
          next[room.number] = {
            yesterdayDoctorId: yestDocId,
            todayDoctorId: activeDocId,
            tomorrowDoctorId: activeDocId,
          };
          changed = true;
        } else {
          // If patients already in room have a specific doctor, sync todayDoctorId if it was not explicitly changed
          if (roomPatients.length > 0 && roomPatients[0].attendingDoctorId && next[room.number].todayDoctorId !== roomPatients[0].attendingDoctorId) {
            next[room.number] = {
              ...next[room.number],
              todayDoctorId: roomPatients[0].attendingDoctorId,
            };
            changed = true;
          }
        }
      });

      if (changed) {
        try {
          localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
  }, [rooms, doctors, activePatients]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Change doctor for a room
  const handleChangeDoctor = (
    roomNumber: string,
    period: 'yesterday' | 'today' | 'tomorrow',
    newDoctorId: string
  ) => {
    setScheduleMap((prev) => {
      const current = prev[roomNumber] || {
        yesterdayDoctorId: doctors[0]?.id || '',
        todayDoctorId: doctors[0]?.id || '',
        tomorrowDoctorId: doctors[0]?.id || '',
      };

      const updated = {
        ...prev,
        [roomNumber]: {
          ...current,
          [`${period}DoctorId`]: newDoctorId,
        },
      };

      try {
        localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });

    const docName = formatDoctorGivenName(doctors.find((d) => d.id === newDoctorId));
    const periodLabel = period === 'yesterday' ? 'hôm qua' : period === 'today' ? 'hôm nay' : 'ngày mai';
    showToast(`Đã phân công ${docName} phụ trách P.${roomNumber} (${periodLabel})`);

    // If changing today's doctor, also update all current active patients in this room
    if (period === 'today') {
      onReassignDoctorForRoom(roomNumber, newDoctorId);
    }
  };

  // Quick copy Today -> Tomorrow for all rooms
  const handleCopyTodayToTomorrowAll = () => {
    setScheduleMap((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((rNum) => {
        next[rNum] = {
          ...next[rNum],
          tomorrowDoctorId: next[rNum].todayDoctorId,
        };
      });
      try {
        localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    showToast('Đã sao chép toàn bộ phân công Hôm Nay sang Ngày Mai');
  };

  // Compute patient count statistics per doctor (only doctors with > 0 patients or assigned rooms)
  const doctorStats = useMemo(() => {
    return doctors
      .map((doc) => {
        const docPatients = activePatients.filter((p) => p.attendingDoctorId === doc.id);
        const criticalCount = docPatients.filter((p) => p.severity === 'CRITICAL').length;
        const moderateCount = docPatients.filter((p) => p.severity === 'MODERATE').length;
        const stableCount = docPatients.filter((p) => p.severity === 'STABLE').length;
        const o2Count = docPatients.filter((p) =>
          p.tags?.some((t) => t === 'O2' || t === 'O2_CANULA' || t === 'O2_MASK')
        ).length;

        // Find rooms assigned today
        const assignedRooms = rooms
          .filter((r) => scheduleMap[r.number]?.todayDoctorId === doc.id)
          .map((r) => r.number);

        return {
          doctor: doc,
          shortDisplayName: formatDoctorGivenName(doc),
          totalPatients: docPatients.length,
          criticalCount,
          moderateCount,
          stableCount,
          o2Count,
          assignedRooms,
          patients: docPatients,
        };
      })
      .filter((stat) => stat.totalPatients > 0 || stat.assignedRooms.length > 0);
  }, [doctors, activePatients, rooms, scheduleMap]);

  // Filtered rooms list
  const filteredRooms = useMemo(() => {
    const list = rooms.filter((room) => {
      // Filter by group
      if (selectedGroup !== 'ALL' && room.group !== selectedGroup) {
        return false;
      }

      // Filter by doctor
      if (selectedDoctorFilter) {
        const schedule = scheduleMap[room.number];
        const isMatch =
          schedule?.todayDoctorId === selectedDoctorFilter ||
          schedule?.yesterdayDoctorId === selectedDoctorFilter ||
          schedule?.tomorrowDoctorId === selectedDoctorFilter;
        if (!isMatch) return false;
      }

      // Filter by search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const roomNameMatch = room.name.toLowerCase().includes(query) || room.number.toLowerCase().includes(query);
        const sched = scheduleMap[room.number];
        const yDoc = formatDoctorGivenName(doctors.find((d) => d.id === sched?.yesterdayDoctorId)).toLowerCase();
        const tDoc = formatDoctorGivenName(doctors.find((d) => d.id === sched?.todayDoctorId)).toLowerCase();
        const tmDoc = formatDoctorGivenName(doctors.find((d) => d.id === sched?.tomorrowDoctorId)).toLowerCase();
        
        const docMatch = yDoc.includes(query) || tDoc.includes(query) || tmDoc.includes(query);

        const roomPatients = activePatients.filter(
          (p) => p.roomNumber === room.number || p.roomNumber === `P.${room.number}` || p.roomNumber === `Phòng ${room.number}`
        );
        const patientMatch = roomPatients.some(
          (p) => p.fullName.toLowerCase().includes(query) || (p.medicalRecordNumber || '').toLowerCase().includes(query)
        );

        return roomNameMatch || docMatch || patientMatch;
      }

      return true;
    });

    // Ở chế độ xem tất cả các nhóm (ALL), đưa phòng 743 (Hồi sức cấp cứu Tim mạch) lên đầu
    if (selectedGroup === 'ALL') {
      const idx743 = list.findIndex((r) => r.number === '743');
      if (idx743 > -1) {
        const [r743] = list.splice(idx743, 1);
        list.unshift(r743);
      }
    }

    return list;
  }, [rooms, selectedGroup, selectedDoctorFilter, searchTerm, scheduleMap, doctors, activePatients]);

  const totalActivePatients = activePatients.length;
  const totalCritical = useMemo(
    () => activePatients.filter((p) => p.severity === 'CRITICAL').length,
    [activePatients]
  );
  const totalModerate = useMemo(
    () => activePatients.filter((p) => p.severity === 'MODERATE').length,
    [activePatients]
  );
  const totalStable = useMemo(
    () => activePatients.filter((p) => p.severity === 'STABLE').length,
    [activePatients]
  );
  const totalOxygen = useMemo(
    () => activePatients.filter((p) => p.tags?.some((t) => t === 'O2' || t === 'O2_CANULA' || t === 'O2_MASK')).length,
    [activePatients]
  );

  return (
    <div className="space-y-3.5 pb-12 sm:pb-8">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-14 right-3 sm:right-6 z-50 bg-slate-900 text-white px-3.5 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-in slide-in-from-top duration-150 border border-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* 1. HEADER: TIÊU ĐỀ & CHUYỂN ĐỔI CHẾ ĐỘ XEM (GỌN GÀNG, TỐI ƯU MOBILE) */}
      {/* ============================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0b4d8c] text-white flex items-center justify-center shadow-xs shrink-0">
              <Stethoscope className="w-5 h-5 text-blue-100" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight leading-tight">
                Phân Công & Thống Kê Bác Sĩ
              </h2>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-medium">
                <span>Khoa Nội Tổng Hợp</span>
                <span>•</span>
                <span className="font-bold text-[#0b4d8c]">{totalActivePatients} BN Nội Trú</span>
                {totalCritical > 0 && (
                  <span className="text-rose-600 font-black">• {totalCritical} nặng</span>
                )}
                {totalModerate > 0 && (
                  <span className="text-amber-600 font-bold">• {totalModerate} vừa</span>
                )}
              </div>
            </div>
          </div>

          {/* Mode Switcher Tabs (Thumb-friendly on mobile) */}
          <div className="flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200 text-xs font-bold self-stretch sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('rooms')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                viewMode === 'rooms'
                  ? 'bg-[#0b4d8c] text-white font-black shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BedDouble className="w-3.5 h-3.5" />
              <span>Theo Buồng Phòng</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('doctor_stats')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                viewMode === 'doctor_stats'
                  ? 'bg-[#0b4d8c] text-white font-black shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Thống Kê Chi Tiết BS</span>
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2. THANH BÁC SĨ VUỐT NGANG (TOUCH CAROUSEL CHO ĐIỆN THOẠI) */}
        {/* ============================================================== */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
              Bác Sĩ Điều Trị ({doctorStats.length} BS có ca):
            </span>
            {selectedDoctorFilter && (
              <button
                type="button"
                onClick={() => setSelectedDoctorFilter(null)}
                className="text-[11px] font-extrabold text-rose-600 hover:text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg cursor-pointer transition-colors"
              >
                ✕ Bỏ lọc bác sĩ
              </button>
            )}
          </div>

          {/* Swipeable Doctor Pills Strip (Cuộn mượt mà trên mobile, không bị chèn ép) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar scroll-smooth">
            {/* Pill: Tất cả */}
            <button
              type="button"
              onClick={() => setSelectedDoctorFilter(null)}
              className={`shrink-0 px-3 py-2 rounded-xl border text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                selectedDoctorFilter === null
                  ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-300'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span>Tất cả</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                selectedDoctorFilter === null ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-800'
              }`}>
                {totalActivePatients} BN
              </span>
            </button>

            {/* Doctor Pills */}
            {doctorStats.map(({ doctor, shortDisplayName, totalPatients, criticalCount, moderateCount, assignedRooms }) => {
              const isSelected = selectedDoctorFilter === doctor.id;
              const givenInitial = shortDisplayName.replace(/^BS\.\s*/i, '').charAt(0) || 'B';

              return (
                <button
                  key={doctor.id}
                  type="button"
                  onClick={() => setSelectedDoctorFilter(isSelected ? null : doctor.id)}
                  className={`shrink-0 px-3 py-2 rounded-xl border text-xs transition-all flex items-center gap-2 cursor-pointer shadow-2xs active:scale-95 ${
                    isSelected
                      ? 'bg-blue-50/90 border-[#0b4d8c] ring-2 ring-blue-300 shadow-xs'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                  title={`${shortDisplayName} (${totalPatients} BN • ${assignedRooms.length} buồng)`}
                >
                  <div className={`w-6 h-6 rounded-lg ${doctor.avatarColor || 'bg-[#0b4d8c]'} text-white flex items-center justify-center font-black text-[11px] shadow-2xs shrink-0`}>
                    {givenInitial}
                  </div>

                  <div className="text-left">
                    <span className="font-black text-xs block leading-tight text-slate-900">
                      {shortDisplayName}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold leading-none mt-0.5">
                      <span className="text-[#0b4d8c] font-black">{totalPatients} BN</span>
                      {criticalCount > 0 && (
                        <span className="text-rose-600 font-black">• {criticalCount} nặng</span>
                      )}
                      {assignedRooms.length > 0 && (
                        <span className="text-slate-400 font-normal">({assignedRooms.length}P)</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: THEO BUỒNG PHÒNG (ROOM MATRIX & MOBILE CARDS) */}
      {/* ============================================================== */}
      {viewMode === 'rooms' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-0">
          
          {/* TOOLBAR: NHÓM PHÒNG, TÌM KIẾM & CHÉP NHANH */}
          <div className="p-3 sm:p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
            {/* Nhóm buồng bệnh Pills (Cuộn mượt trên mobile) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedGroup('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  selectedGroup === 'ALL'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Tất cả ({rooms.length})
              </button>
              {(['GROUP_1', 'GROUP_2', 'CARDIO'] as WardRoomGroup[]).map((gKey) => {
                const meta = WARD_GROUPS_META[gKey];
                const count = rooms.filter((r) => r.group === gKey).length;
                return (
                  <button
                    key={gKey}
                    type="button"
                    onClick={() => setSelectedGroup(gKey)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      selectedGroup === gKey
                        ? 'bg-[#0b4d8c] text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {meta.shortName} ({count})
                  </button>
                );
              })}
            </div>

            {/* Tìm kiếm & Sao chép nhanh */}
            <div className="flex items-center flex-wrap gap-2">
              {/* NÚT TÍCH CHỌN HIỂN THỊ / ẨN BỆNH NHÂN TRONG PHÒNG */}
              <button
                type="button"
                onClick={toggleShowPatientsInRooms}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0 active:scale-95 border ${
                  showPatientsInRooms
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300 ring-1 ring-emerald-200'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
                title={showPatientsInRooms ? 'Bấm để ẩn danh sách bệnh nhân (giúp giao diện gọn gàng)' : 'Bấm để hiện danh sách bệnh nhân trong từng buồng'}
              >
                <div className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all ${
                  showPatientsInRooms 
                    ? 'bg-emerald-600 border-emerald-600 text-white' 
                    : 'border-slate-400 bg-white'
                }`}>
                  {showPatientsInRooms && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span>{showPatientsInRooms ? 'Hiện Bệnh Nhân' : 'Ẩn Bệnh Nhân'}</span>
              </button>

              <div className="relative flex-1 sm:w-56 min-w-[140px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm phòng, BS (Ngọc, Trung...), BN..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#0b4d8c]"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleCopyTodayToTomorrowAll}
                title="Sao chép bác sĩ hôm nay sang ngày mai cho tất cả các buồng"
                className="px-3 py-1.5 bg-white hover:bg-blue-50 text-[#0b4d8c] border border-blue-200 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 shadow-2xs transition-all cursor-pointer active:scale-95"
              >
                <Copy className="w-3.5 h-3.5 text-[#0b4d8c]" />
                <span className="hidden sm:inline">Chép Hôm Nay → Ngày Mai (Tất Cả)</span>
                <span className="sm:hidden text-[11px]">Chép sang mai</span>
              </button>
            </div>
          </div>

          {/* ============================================================== */}
          {/* MOBILE VIEW (CARDS): THIẾT KẾ ĐẶC BIỆT DÀNH CHO ĐIỆN THOẠI */}
          {/* ============================================================== */}
          <div className="md:hidden p-2.5 sm:p-3 space-y-3 bg-slate-50/60">
            {filteredRooms.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
                Không tìm thấy phòng nào phù hợp với bộ lọc tìm kiếm.
              </div>
            ) : (
              filteredRooms.map((room) => {
                const schedule = scheduleMap[room.number] || {
                  yesterdayDoctorId: doctors[0]?.id || '',
                  todayDoctorId: doctors[0]?.id || '',
                  tomorrowDoctorId: doctors[0]?.id || '',
                };

                const roomPatients = activePatients.filter(
                  (p) =>
                    p.roomNumber === room.number ||
                    p.roomNumber === `P.${room.number}` ||
                    p.roomNumber === `Phòng ${room.number}`
                );

                const groupMeta = (room.group && room.group in WARD_GROUPS_META) 
                  ? WARD_GROUPS_META[room.group as WardRoomGroup] 
                  : null;

                const todayDocObj = doctors.find((d) => d.id === schedule.todayDoctorId);

                return (
                  <div
                    key={room.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
                  >
                    {/* Top Room Banner */}
                    <div className="p-3 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex flex-col items-center justify-center font-black shrink-0 shadow-xs">
                          <span className="text-[8px] uppercase tracking-tighter opacity-60">
                            P.
                          </span>
                          <span className="text-xs leading-none">
                            {room.number}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-xs text-slate-900">{room.name}</span>
                            {groupMeta && (
                              <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-md ${groupMeta.badgeColor}`}>
                                {groupMeta.shortName}
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] text-slate-500 font-medium">
                            {roomPatients.length}/{room.totalBeds} giường có bệnh
                          </div>
                        </div>
                      </div>

                      {/* Right: Status Pill */}
                      <span className={`text-xs font-black px-2.5 py-1 rounded-xl border ${
                        roomPatients.length >= room.totalBeds
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : roomPatients.length > 0
                          ? 'bg-blue-50 text-[#0b4d8c] border-blue-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {roomPatients.length} BN
                      </span>
                    </div>

                    {/* Room Body: Doctor Allocation Selectors */}
                    <div className="p-3 space-y-2.5">
                      {/* 1. BS HÔM NAY - TRỌNG TÂM LÂM SÀNG (LỚN, DỄ BẤM VỚI NGÓN TAY) */}
                      <div className="bg-rose-50/60 p-2.5 rounded-xl border-2 border-rose-300 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-black text-rose-950 flex items-center gap-1 text-[11px] uppercase">
                            <Stethoscope className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>BS Hôm Nay ({dateLabels.today}) • Trực tiếp:</span>
                          </span>
                          <span className="text-[10px] text-rose-800 font-bold bg-rose-200/80 px-2 py-0.5 rounded-md">
                            đang điều trị
                          </span>
                        </div>

                        {/* Large Touch Dropdown for Today's Doctor */}
                        <div className="relative">
                          <select
                            value={schedule.todayDoctorId}
                            onChange={(e) => handleChangeDoctor(room.number, 'today', e.target.value)}
                            className="w-full h-10 pl-3 pr-8 bg-white text-rose-950 font-black text-sm border border-rose-400 rounded-xl shadow-xs focus:outline-hidden focus:ring-2 focus:ring-rose-500 cursor-pointer"
                          >
                            {doctors.map((doc) => (
                              <option key={doc.id} value={doc.id}>
                                {formatDoctorGivenName(doc)}
                              </option>
                            ))}
                          </select>
                        </div>

                        {roomPatients.length > 0 && (
                          <div className="text-[10.5px] text-rose-700 font-semibold pl-1 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                            <span>Phụ trách {roomPatients.length} BN trong buồng</span>
                          </div>
                        )}
                      </div>

                      {/* 2. BS HÔM QUA & NGÀY MAI (2 CỘT GỌN GÀNG VỚI NÚT CHÉP NHANH) */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {/* Hôm qua */}
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 space-y-1">
                          <span className="text-[10.5px] font-bold text-slate-500 block truncate">
                            Hôm qua ({dateLabels.yesterday})
                          </span>
                          <select
                            value={schedule.yesterdayDoctorId}
                            onChange={(e) => handleChangeDoctor(room.number, 'yesterday', e.target.value)}
                            className="w-full h-9 px-2 bg-white text-slate-800 font-bold text-xs border border-slate-300 rounded-lg cursor-pointer"
                          >
                            {doctors.map((doc) => (
                              <option key={doc.id} value={doc.id}>
                                {formatDoctorGivenName(doc)}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Ngày mai */}
                        <div className="bg-blue-50/50 p-2 rounded-xl border border-blue-200 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10.5px] font-black text-[#0b4d8c] block truncate">
                              Ngày mai ({dateLabels.tomorrow})
                            </span>
                            <button
                              type="button"
                              onClick={() => handleChangeDoctor(room.number, 'tomorrow', schedule.todayDoctorId)}
                              className="text-[10px] text-[#0b4d8c] font-black flex items-center gap-0.5 bg-white px-1.5 py-0.5 rounded-md border border-blue-300 cursor-pointer shadow-2xs active:scale-95 transition-all"
                              title="Sao chép từ Hôm Nay sang Ngày Mai"
                            >
                              <Copy className="w-2.5 h-2.5" />
                              <span>Giữ BS</span>
                            </button>
                          </div>
                          <select
                            value={schedule.tomorrowDoctorId}
                            onChange={(e) => handleChangeDoctor(room.number, 'tomorrow', e.target.value)}
                            className="w-full h-9 px-2 bg-white text-[#0b4d8c] font-black text-xs border border-blue-300 rounded-lg cursor-pointer"
                          >
                            {doctors.map((doc) => (
                              <option key={doc.id} value={doc.id}>
                                {formatDoctorGivenName(doc)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* 3. DANH SÁCH BỆNH NHÂN TRONG PHÒNG (ẨN/HIỆN THEO TÙY CHỌN TÍCH CHỌN) */}
                      {showPatientsInRooms && roomPatients.length > 0 && (
                        <div className="pt-2 border-t border-slate-100">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10.5px] font-black uppercase text-slate-500 tracking-wider">
                              Bệnh nhân trong phòng ({roomPatients.length}):
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {roomPatients.map((patient) => {
                              const displayName = formatPatientName(patient.fullName);
                              return (
                                <button
                                  key={patient.id}
                                  type="button"
                                  onClick={() => onSelectPatient(patient)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer ${
                                    patient.severity === 'CRITICAL'
                                      ? 'bg-rose-50 text-rose-900 border-rose-300 font-black'
                                      : patient.severity === 'MODERATE'
                                      ? 'bg-amber-50 text-amber-900 border-amber-300 font-bold'
                                      : 'bg-white text-slate-800 border-slate-200'
                                  }`}
                                  title={`Bấm để mở hồ sơ ${displayName}`}
                                >
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                                    patient.severity === 'CRITICAL' ? 'bg-rose-500 animate-pulse' :
                                    patient.severity === 'MODERATE' ? 'bg-amber-500' : 'bg-emerald-500'
                                  }`} />
                                  <span className="truncate max-w-[130px]">{displayName}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ============================================================== */}
          {/* DESKTOP VIEW: BẢNG MA TRẬN 5 CỘT (TABLE VIEW) */}
          {/* ============================================================== */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-[11px] font-extrabold uppercase text-slate-600 tracking-wider border-b border-slate-200">
                  <th className="py-2.5 px-3 sm:px-4 w-48">Phòng Bệnh</th>
                  <th className="py-2.5 px-3 sm:px-4 w-56">
                    <div className="flex items-center gap-1.5 text-slate-500 font-bold">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Hôm Qua ({dateLabels.yesterday})</span>
                    </div>
                  </th>
                  <th className="py-2.5 px-3 sm:px-4 w-72 bg-rose-50/60 border-x border-rose-200/80 text-rose-900">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-black text-rose-700">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Hôm Nay ({dateLabels.today}) • Trực tiếp</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-200/70 text-rose-800 font-bold lowercase">
                        đang điều trị
                      </span>
                    </div>
                  </th>
                  <th className="py-2.5 px-3 sm:px-4 w-60">
                    <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      <span>Ngày Mai ({dateLabels.tomorrow})</span>
                    </div>
                  </th>
                  {showPatientsInRooms && (
                    <th className="py-2.5 px-3 sm:px-4 text-right">Bệnh Nhân Trong Phòng</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredRooms.length === 0 ? (
                  <tr>
                    <td colSpan={showPatientsInRooms ? 5 : 4} className="py-8 text-center text-slate-400">
                      Không tìm thấy phòng nào phù hợp với bộ lọc tìm kiếm.
                    </td>
                  </tr>
                ) : (
                  filteredRooms.map((room) => {
                    const schedule = scheduleMap[room.number] || {
                      yesterdayDoctorId: doctors[0]?.id || '',
                      todayDoctorId: doctors[0]?.id || '',
                      tomorrowDoctorId: doctors[0]?.id || '',
                    };

                    const roomPatients = activePatients.filter(
                      (p) =>
                        p.roomNumber === room.number ||
                        p.roomNumber === `P.${room.number}` ||
                        p.roomNumber === `Phòng ${room.number}`
                    );

                    const groupMeta = (room.group && room.group in WARD_GROUPS_META) 
                      ? WARD_GROUPS_META[room.group as WardRoomGroup] 
                      : null;

                    return (
                      <tr
                        key={room.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        {/* Phòng bệnh & Thông tin cơ bản */}
                        <td className="py-2.5 px-3 sm:px-4 align-middle">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex flex-col items-center justify-center font-black shrink-0 shadow-2xs">
                              <span className="text-[9px] uppercase tracking-tighter opacity-70">
                                Phòng
                              </span>
                              <span className="text-xs leading-none">
                                {room.number}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900">{room.name}</span>
                                {groupMeta && (
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${groupMeta.badgeColor}`}
                                  >
                                    {groupMeta.shortName}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                                {roomPatients.length}/{room.totalBeds} giường có bệnh
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* BS Hôm Qua */}
                        <td className="py-2 px-3 align-middle">
                          <select
                            value={schedule.yesterdayDoctorId}
                            onChange={(e) =>
                              handleChangeDoctor(room.number, 'yesterday', e.target.value)
                            }
                            className="w-full pl-2 pr-6 py-1.5 bg-slate-50 hover:bg-white text-slate-700 font-bold text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-400 cursor-pointer transition-colors"
                          >
                            {doctors.map((doc) => (
                              <option key={doc.id} value={doc.id}>
                                {formatDoctorGivenName(doc)}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* BS Hôm Nay */}
                        <td className="py-2.5 px-3 align-middle bg-rose-50/30 border-x border-rose-200/80">
                          <div className="space-y-1">
                            <select
                              value={schedule.todayDoctorId}
                              onChange={(e) =>
                                handleChangeDoctor(room.number, 'today', e.target.value)
                              }
                              className="w-full pl-2.5 pr-7 py-1.5 bg-white text-rose-950 font-black text-xs border-2 border-rose-400 rounded-lg shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-rose-500 cursor-pointer"
                            >
                              {doctors.map((doc) => (
                                <option key={doc.id} value={doc.id}>
                                  {formatDoctorGivenName(doc)}
                                </option>
                              ))}
                            </select>
                            {roomPatients.length > 0 && (
                              <div className="text-[10px] text-rose-700 font-semibold flex items-center gap-1 pl-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                <span>Phụ trách {roomPatients.length} BN trong buồng</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* BS Ngày Mai */}
                        <td className="py-2 px-3 align-middle">
                          <div className="flex items-center gap-1">
                            <select
                              value={schedule.tomorrowDoctorId}
                              onChange={(e) =>
                                handleChangeDoctor(room.number, 'tomorrow', e.target.value)
                              }
                              className="w-full pl-2 pr-6 py-1.5 bg-blue-50/50 hover:bg-white text-[#0b4d8c] font-black text-xs border border-blue-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-400 cursor-pointer transition-colors"
                            >
                              {doctors.map((doc) => (
                                <option key={doc.id} value={doc.id}>
                                  {formatDoctorGivenName(doc)}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() =>
                                handleChangeDoctor(room.number, 'tomorrow', schedule.todayDoctorId)
                              }
                              title="Sao chép BS hôm nay sang ngày mai cho phòng này"
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer shrink-0"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                        {/* Bệnh nhân trong phòng (Ẩn/Hiện theo tùy chọn) */}
                        {showPatientsInRooms && (
                          <td className="py-2.5 px-3 sm:px-4 align-middle text-right">
                          {roomPatients.length === 0 ? (
                            <span className="text-[11px] text-slate-400 italic">
                              Phòng trống
                            </span>
                          ) : (
                            <div className="flex flex-wrap items-center justify-end gap-1">
                              {roomPatients.map((patient) => {
                                const displayName = formatPatientName(patient.fullName);
                                return (
                                  <button
                                    key={patient.id}
                                    type="button"
                                    onClick={() => onSelectPatient(patient)}
                                    className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold border transition-all flex items-center gap-1 shadow-2xs hover:scale-105 cursor-pointer ${
                                      patient.severity === 'CRITICAL'
                                        ? 'bg-rose-50 text-rose-900 border-rose-300 font-black'
                                        : patient.severity === 'MODERATE'
                                        ? 'bg-amber-50 text-amber-900 border-amber-300 font-bold'
                                        : 'bg-slate-50 text-slate-800 border-slate-200'
                                    }`}
                                    title={`Xem chi tiết bệnh nhân ${displayName}`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                      patient.severity === 'CRITICAL' ? 'bg-rose-500 animate-pulse' :
                                      patient.severity === 'MODERATE' ? 'bg-amber-500' : 'bg-emerald-500'
                                    }`} />
                                    <span className="truncate max-w-[140px]">
                                      {displayName}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Note */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
            <div className="flex items-center gap-1.5 text-[11px]">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>
                Khi thay đổi <strong>Bác sĩ Hôm nay</strong>, hệ thống tự động cập nhật phân công điều trị cho tất cả bệnh nhân đang nằm trong buồng phòng đó.
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              Lịch phân công được lưu trữ tự động trên Cloud & Thiết bị
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: THỐNG KÊ CHI TIẾT THEO BÁC SĨ (DOCTOR CENSUS CARDS) */}
      {/* ============================================================== */}
      {viewMode === 'doctor_stats' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {doctorStats.map(({ doctor, shortDisplayName, totalPatients, criticalCount, moderateCount, stableCount, o2Count, assignedRooms, patients: docPatients }) => {
              const givenInitial = shortDisplayName.replace(/^BS\.\s*/i, '').charAt(0) || 'B';

              return (
                <div 
                  key={doctor.id}
                  className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex flex-col justify-between gap-3 hover:shadow-md transition-all"
                >
                  {/* Doctor Info Header */}
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className={`w-9 h-9 rounded-xl ${doctor.avatarColor || 'bg-[#0b4d8c]'} text-white flex items-center justify-center font-black text-sm shadow-xs shrink-0`}>
                          {givenInitial}
                        </div>
                        <div>
                          <h3 className="font-black text-sm text-slate-900 tracking-tight">
                            {shortDisplayName}
                          </h3>
                          <div className="text-[10.5px] text-slate-500 font-medium">
                            {doctor.shiftStatus || 'Điều trị'} • Mã: {doctor.id}
                          </div>
                        </div>
                      </div>

                      <span className="px-2.5 py-1 rounded-xl bg-blue-50 text-[#0b4d8c] font-black text-xs border border-blue-200">
                        {totalPatients} BN
                      </span>
                    </div>

                    {/* Assigned Rooms & Metrics */}
                    <div className="mt-2.5 space-y-2">
                      {assignedRooms.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10.5px] font-bold text-slate-500">Phụ trách:</span>
                          {assignedRooms.map((rNum) => (
                            <span 
                              key={rNum}
                              className="px-1.5 py-0.2 rounded-md bg-slate-100 font-mono font-black text-[11px] text-slate-800 border border-slate-200"
                            >
                              P.{rNum}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Severity Breakdown Bar */}
                      <div className="flex items-center gap-1.5 text-[11px] font-bold flex-wrap">
                        {criticalCount > 0 && (
                          <span className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 font-black">
                            {criticalCount} Nặng
                          </span>
                        )}
                        {moderateCount > 0 && (
                          <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-black">
                            {moderateCount} Vừa
                          </span>
                        )}
                        {stableCount > 0 && (
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {stableCount} Ổn
                          </span>
                        )}
                        {o2Count > 0 && (
                          <span className="px-2 py-0.5 rounded-lg bg-cyan-50 text-cyan-800 border border-cyan-200">
                            {o2Count} Thở Oxy
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Patient List Under Care */}
                    <div className="mt-3 space-y-1 max-h-52 overflow-y-auto pr-1">
                      {docPatients.length === 0 ? (
                        <div className="text-center py-4 text-xs text-slate-400 italic">
                          Chưa có bệnh nhân nào được phân công
                        </div>
                      ) : (
                        docPatients.map((p) => {
                          const pName = formatPatientName(p.fullName);
                          return (
                            <div
                              key={p.id}
                              onClick={() => onSelectPatient(p)}
                              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-150 flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer group"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 font-black text-slate-900 group-hover:text-[#0b4d8c] transition-colors">
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                                    p.severity === 'CRITICAL' ? 'bg-rose-500 animate-pulse' :
                                    p.severity === 'MODERATE' ? 'bg-amber-500' : 'bg-emerald-500'
                                  }`} />
                                  <span className="truncate">{pName}</span>
                                  <span className="text-[10px] text-slate-400 font-normal">({p.age}t)</span>
                                </div>
                                {p.primaryDiagnosis && (
                                  <div className="text-[10.5px] text-slate-500 truncate mt-0.5">
                                    {p.primaryDiagnosis}
                                  </div>
                                )}
                              </div>

                              <span className="px-1.5 py-0.2 rounded bg-white text-slate-700 font-mono font-bold text-[10.5px] border border-slate-200 shrink-0">
                                P.{p.roomNumber}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-2 border-t border-slate-100 text-right">
                    <span className="text-[11px] text-[#0b4d8c] font-black hover:underline cursor-pointer">
                      Xem chi tiết {totalPatients} hồ sơ →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

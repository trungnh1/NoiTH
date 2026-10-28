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
  AlertCircle
} from 'lucide-react';

import { sortDoctorsAlphabetically, getDoctorGivenName, formatPatientName } from '../utils/doctorSorter';

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
  const doctors = useMemo(() => sortDoctorsAlphabetically(rawDoctors), [rawDoctors]);

  const activePatients = useMemo(
    () => patients.filter((p) => p.status === 'ACTIVE'),
    [patients]
  );

  // Search & filter
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

    const docName = doctors.find((d) => d.id === newDoctorId)?.name || 'Bác sĩ';
    const periodLabel = period === 'yesterday' ? 'hôm qua' : period === 'today' ? 'hôm nay' : 'ngày mai';
    showToast(`Đã cập nhật BS ${docName} phụ trách Phòng ${roomNumber} (${periodLabel})`);

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
    showToast('Đã sao chép toàn bộ phân công hôm nay sang ngày mai');
  };

  // Compute patient count statistics per doctor (only doctors with > 0 patients)
  const doctorStats = useMemo(() => {
    return doctors
      .map((doc) => {
        const docPatients = activePatients.filter((p) => p.attendingDoctorId === doc.id);
        const criticalCount = docPatients.filter((p) => p.severity === 'CRITICAL').length;
        const moderateCount = docPatients.filter((p) => p.severity === 'MODERATE').length;
        const stableCount = docPatients.filter((p) => p.severity === 'STABLE').length;

        // Find rooms assigned today
        const assignedRooms = rooms
          .filter((r) => scheduleMap[r.number]?.todayDoctorId === doc.id)
          .map((r) => r.number);

        return {
          doctor: doc,
          totalPatients: docPatients.length,
          criticalCount,
          moderateCount,
          stableCount,
          assignedRooms,
          patients: docPatients,
        };
      })
      .filter((stat) => stat.totalPatients > 0);
  }, [doctors, activePatients, rooms, scheduleMap]);

  // Filtered rooms list
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
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
        const yDoc = doctors.find((d) => d.id === sched?.yesterdayDoctorId)?.name.toLowerCase() || '';
        const tDoc = doctors.find((d) => d.id === sched?.todayDoctorId)?.name.toLowerCase() || '';
        const tmDoc = doctors.find((d) => d.id === sched?.tomorrowDoctorId)?.name.toLowerCase() || '';
        
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
  }, [rooms, selectedGroup, selectedDoctorFilter, searchTerm, scheduleMap, doctors, activePatients]);

  const totalActivePatients = activePatients.length;

  return (
    <div className="space-y-4">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-top duration-200 border border-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* SECTION 1: THỐNG KÊ TỔNG SỐ BỆNH NHÂN CỦA MỖI BÁC SĨ */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-700">
              <Stethoscope className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-800">
                Thống Kê Tổng Số Bệnh Nhân Theo Bác Sĩ
              </h2>
              <p className="text-xs text-slate-500">
                Tổng cộng {totalActivePatients} bệnh nhân đang điều trị nội trú tại khoa
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {selectedDoctorFilter && (
              <button
                onClick={() => setSelectedDoctorFilter(null)}
                className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 font-bold hover:bg-rose-200 transition-colors"
              >
                ✕ Bỏ lọc bác sĩ
              </button>
            )}
            <span className="text-slate-500 font-medium">
              Hiển thị {doctorStats.length} bác sĩ có bệnh nhân
            </span>
          </div>
        </div>

        {/* Doctor Grid / Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
          {doctorStats.map(({ doctor, totalPatients, criticalCount, moderateCount, stableCount }) => {
            const isSelected = selectedDoctorFilter === doctor.id;
            return (
              <button
                key={doctor.id}
                onClick={() =>
                  setSelectedDoctorFilter(isSelected ? null : doctor.id)
                }
                className={`text-left p-2.5 rounded-xl border transition-all relative overflow-hidden group ${
                  isSelected
                    ? 'border-rose-500 bg-rose-50/50 shadow-xs ring-2 ring-rose-200'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300'
                }`}
              >
                {/* Header: Avatar + Name */}
                <div className="flex items-center gap-2 mb-1.5">
                  <div
                    className={`w-7 h-7 rounded-lg ${doctor.avatarColor} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs`}
                  >
                    {getDoctorGivenName(doctor.name)[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs text-slate-900 truncate leading-snug" title={doctor.name}>
                      {getDoctorGivenName(doctor.name)}
                    </p>
                  </div>
                </div>

                {/* Big Patient Count */}
                <div className="flex items-baseline justify-between mt-1 pt-1 border-t border-slate-200/60">
                  <span className="text-[11px] font-medium text-slate-600">Tổng bệnh:</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-base font-black text-rose-700">
                      {totalPatients}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">BN</span>
                  </div>
                </div>

                {/* Mini Severity Breakdown */}
                {totalPatients > 0 && (
                  <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                    {criticalCount > 0 && (
                      <span className="px-1 py-0.2 rounded bg-rose-100 text-rose-800 font-bold" title="Ca nặng">
                        {criticalCount} nặng
                      </span>
                    )}
                    {moderateCount > 0 && (
                      <span className="px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-medium" title="Ca vừa">
                        {moderateCount} vừa
                      </span>
                    )}
                    {stableCount > 0 && (
                      <span className="px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-medium" title="Ca nhẹ">
                        {stableCount} ổn
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: BẢNG PHÂN CÔNG PHÒNG (HÔM QUA - HÔM NAY - NGÀY MAI) */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Toolbar & Filter */}
        <div className="p-3 sm:p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Group Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setSelectedGroup('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                selectedGroup === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200'
              }`}
            >
              Tất cả phòng ({rooms.length})
            </button>
            {(['CARDIO', 'GROUP_2', 'GROUP_1'] as WardRoomGroup[]).map((gKey) => {
              const meta = WARD_GROUPS_META[gKey];
              const count = rooms.filter((r) => r.group === gKey).length;
              return (
                <button
                  key={gKey}
                  onClick={() => setSelectedGroup(gKey)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                    selectedGroup === gKey
                      ? 'bg-rose-700 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200'
                  }`}
                >
                  {meta.shortName} ({count})
                </button>
              );
            })}
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm phòng, bác sĩ, bệnh nhân..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              onClick={handleCopyTodayToTomorrowAll}
              title="Sao chép bác sĩ hôm nay sang ngày mai cho tất cả các phòng"
              className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shrink-0 shadow-2xs transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Sao chép Hôm nay → Ngày mai</span>
            </button>
          </div>
        </div>

        {/* Room Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-[11px] font-extrabold uppercase text-slate-600 tracking-wider border-b border-slate-200">
                <th className="py-2.5 px-3 sm:px-4 w-48">Phòng Bệnh</th>
                <th className="py-2.5 px-3 sm:px-4 w-60">
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
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Ngày Mai ({dateLabels.tomorrow})</span>
                  </div>
                </th>
                <th className="py-2.5 px-3 sm:px-4 text-right">Bệnh Nhân Trong Phòng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRooms.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
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
                        <div className="relative">
                          <select
                            value={schedule.yesterdayDoctorId}
                            onChange={(e) =>
                              handleChangeDoctor(room.number, 'yesterday', e.target.value)
                            }
                            className="w-full pl-2 pr-6 py-1 bg-slate-50 hover:bg-white text-slate-700 font-medium text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-400 cursor-pointer transition-colors"
                          >
                            {doctors.map((doc) => {
                              const shortName = getDoctorGivenName(doc.name);
                              return (
                                <option key={doc.id} value={doc.id}>
                                  {shortName}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </td>

                      {/* BS Hôm Nay - Khung nổi bật với menu thả xuống gọn gàng */}
                      <td className="py-2.5 px-3 align-middle bg-rose-50/30 border-x border-rose-200/80">
                        <div className="space-y-1">
                          <div className="relative">
                            <select
                              value={schedule.todayDoctorId}
                              onChange={(e) =>
                                handleChangeDoctor(room.number, 'today', e.target.value)
                              }
                              className="w-full pl-2.5 pr-7 py-1.5 bg-white text-rose-950 font-bold text-xs border-2 border-rose-400 rounded-lg shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-rose-500 cursor-pointer"
                            >
                              {doctors.map((doc) => {
                                const shortName = getDoctorGivenName(doc.name);
                                return (
                                  <option key={doc.id} value={doc.id}>
                                    {shortName}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                          {roomPatients.length > 0 && (
                            <div className="text-[10px] text-rose-700 font-medium flex items-center gap-1 pl-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                              <span>Phụ trách {roomPatients.length} BN trong buồng</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* BS Ngày Mai */}
                      <td className="py-2 px-3 align-middle">
                        <div className="flex items-center gap-1">
                          <div className="relative flex-1">
                            <select
                              value={schedule.tomorrowDoctorId}
                              onChange={(e) =>
                                handleChangeDoctor(room.number, 'tomorrow', e.target.value)
                              }
                              className="w-full pl-2 pr-6 py-1 bg-indigo-50/50 hover:bg-white text-slate-800 font-medium text-xs border border-indigo-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-400 cursor-pointer transition-colors"
                            >
                              {doctors.map((doc) => {
                                const shortName = getDoctorGivenName(doc.name);
                                return (
                                  <option key={doc.id} value={doc.id}>
                                    {shortName}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
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

                      {/* Bệnh nhân trong phòng */}
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
                                  className={`px-2 py-0.5 rounded-md text-[10.5px] font-medium border transition-all flex items-center gap-1 shadow-2xs hover:scale-105 cursor-pointer ${
                                    patient.severity === 'CRITICAL'
                                      ? 'bg-rose-50 text-rose-900 border-rose-300 hover:bg-rose-100 font-bold'
                                      : patient.severity === 'MODERATE'
                                      ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 font-medium'
                                      : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
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
              Khi thay đổi <strong>Bác sĩ Hôm nay</strong>, hệ thống tự động cập nhật phân công điều trị cho tất cả bệnh nhân đang nằm trong phòng đó.
            </span>
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Lịch phân công được lưu trữ tự động trên hệ thống
          </div>
        </div>
      </div>
    </div>
  );
};

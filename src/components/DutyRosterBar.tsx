import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  Stethoscope, 
  AlertCircle, 
  RefreshCw, 
  ChevronRight, 
  CheckCircle,
  Building,
  UserCheck
} from 'lucide-react';
import { 
  getDutyScheduleForDate, 
  getAvailableDutyDates, 
  DoctorDutyShift 
} from '../services/dutyScheduleService';

interface DutyRosterBarProps {
  onOpenFullSchedule: () => void;
  onFilterDoctor?: (doctorName: string) => void;
}

export const DutyRosterBar: React.FC<DutyRosterBarProps> = ({
  onOpenFullSchedule,
  onFilterDoctor,
}) => {
  const availableDates = getAvailableDutyDates();
  // Default to 20/07 (active date matching hospital board) or today's date
  const [selectedDate, setSelectedDate] = useState<string>('20/07');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncText, setLastSyncText] = useState('06:00 AM hôm nay (Tự động)');

  const dutyInfo: DoctorDutyShift = getDutyScheduleForDate(selectedDate);

  const handleManualSync = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      const now = new Date();
      setLastSyncText(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} (Đã đồng bộ)`);
    }, 600);
  };

  return (
    <div className="bg-slate-900 text-white rounded-xl shadow-2xs border border-slate-800 p-2 sm:px-3 mb-2">
      {/* Top Header: Compact Row */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1.5 border-b border-slate-800/80 text-xs">
        {/* Left: Title & Daily 6h Sync Indicator */}
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="text-[11px] font-black uppercase tracking-wide text-indigo-300">
            Lịch Trực Hôm Nay:
          </span>
          <span className="font-extrabold text-white text-xs">
            {selectedDate} ({dutyInfo.dayOfWeek})
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
            <CheckCircle className="w-2.5 h-2.5" />
            <span>Đồng bộ 06:00</span>
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">• {lastSyncText}</span>
        </div>

        {/* Right: Date selector & Full schedule button */}
        <div className="flex items-center gap-1.5">
          {/* Quick Date Switcher */}
          <div className="flex items-center gap-1 bg-slate-800/90 px-1.5 py-0.5 rounded-lg border border-slate-700 text-xs">
            <Calendar className="w-3 h-3 text-indigo-400" />
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
            >
              {availableDates.map((d) => (
                <option key={d} value={d} className="bg-slate-900 text-white">
                  {d} ({getDutyScheduleForDate(d).dayOfWeek})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleManualSync}
            disabled={isRefreshing}
            title="Đồng bộ ngay dữ liệu lịch trực"
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
          </button>

          <button
            onClick={onOpenFullSchedule}
            className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            <span>Lịch Tháng</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Duty Shifts Grid - Compact Single-Row Layout */}
      <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5 text-xs">
        {/* 1. Trực Cấp Cứu */}
        <div className="bg-slate-800/60 rounded-lg px-2 py-1 border border-slate-700/60 flex items-center gap-1.5">
          <span className="text-[10px] font-extrabold uppercase text-rose-400 shrink-0">Trực CC:</span>
          <div className="flex flex-wrap gap-1">
            {dutyInfo.emergencyDuty.length > 0 ? (
              dutyInfo.emergencyDuty.map((doc, idx) => (
                <span
                  key={idx}
                  onClick={() => onFilterDoctor?.(doc)}
                  className="px-1.5 py-0.2 rounded bg-rose-600/30 text-rose-200 border border-rose-500/40 font-bold text-[11px] cursor-pointer hover:bg-rose-600/50"
                  title="Nhấp để lọc bệnh nhân"
                >
                  BS. {doc}
                </span>
              ))
            ) : (
              <span className="text-slate-400 italic text-[11px]">Theo phân công</span>
            )}
          </div>
        </div>

        {/* 2. Trực Khoa Nội Trú */}
        <div className="bg-slate-800/60 rounded-lg px-2 py-1 border border-slate-700/60 flex items-center gap-1.5">
          <span className="text-[10px] font-extrabold uppercase text-sky-400 shrink-0">Trực Khoa:</span>
          <div className="flex flex-wrap gap-1">
            {dutyInfo.wardDuty.length > 0 ? (
              dutyInfo.wardDuty.map((doc, idx) => (
                <span
                  key={idx}
                  onClick={() => onFilterDoctor?.(doc)}
                  className="px-1.5 py-0.2 rounded bg-sky-600/30 text-sky-200 border border-sky-500/40 font-bold text-[11px] cursor-pointer hover:bg-sky-600/50"
                  title="Nhấp để lọc bệnh nhân"
                >
                  BS. {doc}
                </span>
              ))
            ) : (
              <span className="text-slate-400 italic text-[11px]">Theo phân công</span>
            )}
          </div>
        </div>

        {/* 3. Bác Sĩ Làm Nội Trú Buồng Bệnh */}
        <div className="bg-slate-800/60 rounded-lg px-2 py-1 border border-slate-700/60 flex items-center gap-1.5">
          <span className="text-[10px] font-extrabold uppercase text-emerald-400 shrink-0">Nội Trú ({dutyInfo.inpatientDoctors.length}):</span>
          <div className="flex flex-wrap gap-1 overflow-x-auto">
            {dutyInfo.inpatientDoctors.length > 0 ? (
              dutyInfo.inpatientDoctors.map((doc, idx) => (
                <span
                  key={idx}
                  onClick={() => onFilterDoctor?.(doc)}
                  className="px-1 py-0.2 rounded bg-emerald-600/20 text-emerald-200 border border-emerald-500/30 font-bold text-[10px] cursor-pointer hover:bg-emerald-600/40"
                  title="Đi buồng bệnh hôm nay"
                >
                  {doc}
                </span>
              ))
            ) : (
              <span className="text-slate-400 italic text-[11px]">Theo tua</span>
            )}
          </div>
        </div>

        {/* 4. Khám Phòng Khám & Kỹ Thuật */}
        <div className="bg-slate-800/60 rounded-lg px-2 py-1 border border-slate-700/60 flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[10px] font-extrabold uppercase text-amber-400 shrink-0">Khám PK:</span>
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-300 shrink-0">
            {dutyInfo.clinic220 && dutyInfo.clinic220.length > 0 && (
              <span>PK220: <strong className="text-amber-300">{dutyInfo.clinic220.join(', ')}</strong></span>
            )}
            {dutyInfo.clinic248 && dutyInfo.clinic248.length > 0 && (
              <span>• PK248: <strong className="text-amber-300">{dutyInfo.clinic248.join(', ')}</strong></span>
            )}
            {dutyInfo.clinic232Morning && dutyInfo.clinic232Morning.length > 0 && (
              <span>• PK232: <strong className="text-amber-300">{dutyInfo.clinic232Morning.join(', ')}</strong></span>
            )}
            {dutyInfo.clinic230Morning && dutyInfo.clinic230Morning.length > 0 && (
              <span>• PK230: <strong className="text-amber-300">{dutyInfo.clinic230Morning.join(', ')}</strong></span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

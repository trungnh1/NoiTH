import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  Search, 
  Filter, 
  Download, 
  Clock, 
  CheckCircle2, 
  User, 
  Building2 
} from 'lucide-react';
import { DUTY_ROSTER_DATA, DoctorDutyShift } from '../services/dutyScheduleService';

interface DutyRosterModalProps {
  onClose: () => void;
  onSelectDoctor?: (doctorName: string) => void;
}

export const DutyRosterModal: React.FC<DutyRosterModalProps> = ({
  onClose,
  onSelectDoctor,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterShift, setFilterShift] = useState<'ALL' | 'CC' | 'WARD' | 'INPATIENT' | 'CLINIC'>('ALL');

  const filteredDays = DUTY_ROSTER_DATA.filter((day) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    const matchEmergency = day.emergencyDuty.some(d => d.toLowerCase().includes(term));
    const matchWard = day.wardDuty.some(d => d.toLowerCase().includes(term));
    const matchInpatient = day.inpatientDoctors.some(d => d.toLowerCase().includes(term));
    const matchClinic220 = (day.clinic220 || []).some(d => d.toLowerCase().includes(term));
    const matchClinic248 = (day.clinic248 || []).some(d => d.toLowerCase().includes(term));
    const matchDate = day.date.includes(term) || day.dayOfWeek.toLowerCase().includes(term);
    return matchEmergency || matchWard || matchInpatient || matchClinic220 || matchClinic248 || matchDate;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-7xl w-[96vw] max-h-[95vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Calendar className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                  Bệnh Viện Hùng Vương Gia Lai • Khoa Nội Tổng Hợp - Tim Mạch
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Tự động đồng bộ 06:00
                </span>
              </div>
              <h2 className="text-lg font-black text-white">
                Bảng Lịch Trực & Phân Ca Bác Sĩ (Tháng 7 - Đầu Tháng 8)
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tên BS, ngày trực (e.g. 20/07, Linh, Lam)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-slate-500 font-semibold mr-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Lọc ca:</span>
            </div>
            <button
              onClick={() => setFilterShift('ALL')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                filterShift === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Tất cả (33 ngày)
            </button>
            <button
              onClick={() => setFilterShift('CC')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                filterShift === 'CC'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Trực Cấp Cứu
            </button>
            <button
              onClick={() => setFilterShift('WARD')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                filterShift === 'WARD'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Trực Khoa
            </button>
            <button
              onClick={() => setFilterShift('INPATIENT')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                filterShift === 'INPATIENT'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Làm Nội Trú
            </button>
          </div>
        </div>

        {/* Schedule Table */}
        <div className="flex-1 overflow-auto p-4 custom-scrollbar">
          <table className="min-w-full border-collapse border border-slate-300 text-xs bg-white rounded-xl overflow-hidden shadow-xs">
            <thead>
              <tr className="bg-slate-800 text-white font-black text-center divide-x divide-slate-700 sticky top-0 z-10">
                <th className="px-3 py-2.5 w-28 text-left bg-slate-900 sticky left-0 z-20">NGÀY / THỨ</th>
                <th className="px-3 py-2.5 min-w-[130px] bg-rose-950/80 text-rose-200">TRỰC CẤP CỨU</th>
                <th className="px-3 py-2.5 min-w-[150px] bg-sky-950/80 text-sky-200">TRỰC KHOA</th>
                <th className="px-3 py-2.5 min-w-[220px] bg-emerald-950/80 text-emerald-200">LÀM NỘI TRÚ (ĐI BUỒNG)</th>
                <th className="px-3 py-2.5 min-w-[180px] bg-amber-950/80 text-amber-200">PHÒNG KHÁM</th>
                <th className="px-3 py-2.5 min-w-[140px] bg-slate-800">RA TRỰC</th>
                <th className="px-3 py-2.5 min-w-[140px] bg-slate-800">NGHỈ PHIÊN / ĐI HỌC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-sans">
              {filteredDays.map((shift, idx) => {
                const isHighlight = shift.date === '20/07';
                return (
                  <tr 
                    key={idx} 
                    className={`hover:bg-slate-50 transition-colors divide-x divide-slate-200 ${
                      isHighlight ? 'bg-indigo-50/70 font-semibold' : ''
                    }`}
                  >
                    {/* Date / Day */}
                    <td className={`px-3 py-2 text-left sticky left-0 z-10 font-bold border-r border-slate-300 ${
                      isHighlight ? 'bg-indigo-100 text-indigo-950' : 'bg-slate-100 text-slate-900'
                    }`}>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-sm">{shift.date}</span>
                        {isHighlight && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-600 text-white font-black">
                            HÔM NAY
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 block font-normal">
                        {shift.dayOfWeek}
                      </span>
                    </td>

                    {/* Trực Cấp Cứu */}
                    <td className="px-2.5 py-2 align-top text-center">
                      <div className="flex flex-wrap gap-1 justify-center">
                        {shift.emergencyDuty.length > 0 ? (
                          shift.emergencyDuty.map((doc, dIdx) => (
                            <span 
                              key={dIdx} 
                              onClick={() => onSelectDoctor?.(doc)}
                              className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold border border-rose-200 text-[11px] cursor-pointer hover:bg-rose-200"
                            >
                              {doc}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">-</span>
                        )}
                      </div>
                    </td>

                    {/* Trực Khoa */}
                    <td className="px-2.5 py-2 align-top text-center">
                      <div className="flex flex-wrap gap-1 justify-center">
                        {shift.wardDuty.length > 0 ? (
                          shift.wardDuty.map((doc, dIdx) => (
                            <span 
                              key={dIdx} 
                              onClick={() => onSelectDoctor?.(doc)}
                              className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-bold border border-sky-200 text-[11px] cursor-pointer hover:bg-sky-200"
                            >
                              {doc}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">-</span>
                        )}
                      </div>
                    </td>

                    {/* Làm Nội Trú */}
                    <td className="px-2.5 py-2 align-top">
                      <div className="flex flex-wrap gap-1">
                        {shift.inpatientDoctors.length > 0 ? (
                          shift.inpatientDoctors.map((doc, dIdx) => (
                            <span 
                              key={dIdx} 
                              onClick={() => onSelectDoctor?.(doc)}
                              className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold border border-emerald-200 text-[11px] cursor-pointer hover:bg-emerald-200"
                            >
                              {doc}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Theo tua</span>
                        )}
                      </div>
                    </td>

                    {/* Khám Phòng Khám */}
                    <td className="px-2.5 py-2 align-top text-[11px]">
                      <div className="space-y-0.5">
                        {shift.clinic220 && shift.clinic220.length > 0 && (
                          <div><span className="text-slate-500 font-medium">PK 220:</span> <span className="font-bold text-slate-800">{shift.clinic220.join(', ')}</span></div>
                        )}
                        {shift.clinic248 && shift.clinic248.length > 0 && (
                          <div><span className="text-slate-500 font-medium">PK 248:</span> <span className="font-bold text-slate-800">{shift.clinic248.join(', ')}</span></div>
                        )}
                        {shift.clinic232Morning && shift.clinic232Morning.length > 0 && (
                          <div><span className="text-slate-500 font-medium">PK 232:</span> <span className="font-bold text-slate-800">{shift.clinic232Morning.join(', ')}</span></div>
                        )}
                        {shift.clinic230Morning && shift.clinic230Morning.length > 0 && (
                          <div><span className="text-slate-500 font-medium">PK 230:</span> <span className="font-bold text-slate-800">{shift.clinic230Morning.join(', ')}</span></div>
                        )}
                        {shift.echoCardio && shift.echoCardio.length > 0 && (
                          <div><span className="text-slate-500 font-medium">SA Tim:</span> <span className="font-bold text-indigo-700">{shift.echoCardio.join(', ')}</span></div>
                        )}
                      </div>
                    </td>

                    {/* Ra trực */}
                    <td className="px-2.5 py-2 align-top text-[11px] text-slate-600">
                      {shift.postDuty && shift.postDuty.length > 0 ? shift.postDuty.join(', ') : '-'}
                    </td>

                    {/* Nghỉ phiên / Đi học */}
                    <td className="px-2.5 py-2 align-top text-[11px]">
                      {shift.offDuty && shift.offDuty.length > 0 && (
                        <div className="text-slate-500">
                          <span className="font-medium">Nghỉ:</span> {shift.offDuty.join(', ')}
                        </div>
                      )}
                      {shift.studying && shift.studying.length > 0 && (
                        <div className="text-indigo-600 font-semibold">
                          <span>Đi học:</span> {shift.studying.join(', ')}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">Ghi chú:</span>
            <span>Hệ thống tự động đồng bộ lúc 06:00 mỗi sáng từ lịch trực Bệnh viện Hùng Vương Gia Lai.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { 
  Patient, 
  Doctor, 
  SeverityLevel, 
  ClinicalTag, 
  CLINICAL_TAGS_META 
} from '../types/patient';
import { 
  Search, 
  UserPlus, 
  FileEdit, 
  Calendar, 
  Clock, 
  User, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight,
  Filter,
  Stethoscope,
  HeartPulse,
  Wind,
  Eye,
  Activity,
  Layers,
  Sparkles
} from 'lucide-react';

interface DetailedPatientListViewProps {
  patients: Patient[];
  doctors: Doctor[];
  onOpenNewPatient: () => void;
  onOpenEvolution: (patient: Patient) => void;
  onSelectPatient: (patient: Patient) => void;
}

/**
 * Calculates number of treatment days from admissionDate to today (inclusive).
 * Admission day counts as Day 1.
 */
export function calculateTreatmentDays(admissionDateStr: string): { days: number; label: string } {
  if (!admissionDateStr) return { days: 1, label: 'Số ngày ĐT: 01' };
  try {
    let admDate: Date;
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(admissionDateStr)) {
      const parts = admissionDateStr.split(/[ /:]/);
      admDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    } else {
      admDate = new Date(admissionDateStr.replace(' ', 'T'));
    }

    if (isNaN(admDate.getTime())) return { days: 1, label: 'Số ngày ĐT: 01' };

    const today = new Date();
    const start = new Date(admDate.getFullYear(), admDate.getMonth(), admDate.getDate()).getTime();
    const current = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

    const diffDays = Math.floor((current - start) / (1000 * 60 * 60 * 24));
    const treatmentDays = Math.max(1, diffDays + 1);
    const padded = String(treatmentDays).padStart(2, '0');

    return {
      days: treatmentDays,
      label: `Số ngày ĐT: ${padded}`,
    };
  } catch {
    return { days: 1, label: 'Số ngày ĐT: 01' };
  }
}

export const DetailedPatientListView: React.FC<DetailedPatientListViewProps> = ({
  patients,
  doctors,
  onOpenNewPatient,
  onOpenEvolution,
  onSelectPatient,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | SeverityLevel | 'DISCHARGE_TODAY' | 'DISCHARGE_TOMORROW'>('ALL');
  const [doctorFilter, setDoctorFilter] = useState<string>('ALL');

  const doctorMap = useMemo(() => {
    return new Map<string, Doctor>(doctors.map((d) => [d.id, d]));
  }, [doctors]);

  // Active inpatients
  const activePatients = useMemo(() => {
    return patients.filter((p) => p.status === 'ACTIVE');
  }, [patients]);

  // Filtered patients
  const filteredPatients = useMemo(() => {
    return activePatients.filter((p) => {
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
      if (doctorFilter !== 'ALL' && p.attendingDoctorId !== doctorFilter) return false;

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const docName = doctorMap.get(p.attendingDoctorId)?.name.toLowerCase() || '';
        const matchName = p.fullName.toLowerCase().includes(query);
        const matchRoom = p.roomNumber.toLowerCase().includes(query) || p.bedNumber.toLowerCase().includes(query);
        const matchDiagnosis = p.primaryDiagnosis.toLowerCase().includes(query) || (p.secondaryDiagnosis?.toLowerCase().includes(query) ?? false);
        const matchPlan = (p.treatmentPlan || p.evolutions?.[0]?.treatmentAction || '').toLowerCase().includes(query);
        const matchNotes = (p.importantNotes || p.handoverNotes || '').toLowerCase().includes(query);
        const matchDoctor = docName.includes(query);

        return matchName || matchRoom || matchDiagnosis || matchPlan || matchNotes || matchDoctor;
      }

      return true;
    });
  }, [activePatients, statusFilter, doctorFilter, searchTerm, doctorMap]);

  // Counters
  const criticalCount = activePatients.filter((p) => p.severity === 'CRITICAL').length;
  const moderateCount = activePatients.filter((p) => p.severity === 'MODERATE').length;
  const stableCount = activePatients.filter((p) => p.severity === 'STABLE').length;
  const dischargeTodayCount = activePatients.filter((p) => p.admissionStatus === 'DISCHARGE_TODAY').length;
  const dischargeTomorrowCount = activePatients.filter((p) => p.admissionStatus === 'DISCHARGE_TOMORROW').length;

  return (
    <div className="space-y-3 animate-in fade-in">
      
      {/* Top Action Bar & Quick Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3.5 sm:p-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Left: Title + Live Summary Pills */}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                Danh Sách Chi Tiết Bệnh Nhân Nội Trú
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-900 text-white font-extrabold">
                  {activePatients.length} bệnh nhân
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Theo dõi buồng phòng, diễn tiến điều trị, kế hoạch y lệnh và bàn giao trực tiếp tại Khoa Nội Tổng Hợp
            </p>
          </div>

          {/* Right: + Tiếp nhận BN mới button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenNewPatient}
              className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-sm shadow-rose-200 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Nhập Mới Bệnh Nhân</span>
            </button>
          </div>

        </div>

        {/* Filter Bar */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
          
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên bệnh nhân, phòng, chẩn đoán, kế hoạch, bác sĩ..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-slate-100/60 focus:bg-white text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500 font-medium transition-all"
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
                Tất cả ({activePatients.length})
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

            {/* Doctor Select Filter */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
              <Stethoscope className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                value={doctorFilter}
                onChange={(e) => setDoctorFilter(e.target.value)}
                className="bg-transparent text-slate-800 font-bold text-xs focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">Tất cả Bác sĩ ({doctors.length})</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    BS. {d.name}
                  </option>
                ))}
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

      {/* Main Detailed Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider border-b border-slate-800">
                <th className="py-3.5 px-3.5 w-32 shrink-0">Tên Phòng</th>
                <th className="py-3.5 px-3.5 w-44">Tên Bệnh Nhân - Tuổi - Giới</th>
                <th className="py-3.5 px-3.5 w-44">Ngày Vào & Số Ngày ĐT</th>
                <th className="py-3.5 px-4 w-60">Chẩn Đoán Hiện Tại</th>
                <th className="py-3.5 px-3.5 w-48">Tình Trạng & Nhãn</th>
                <th className="py-3.5 px-4 min-w-[200px]">Kế Hoạch Điều Trị</th>
                <th className="py-3.5 px-4 min-w-[190px]">Ghi Chú & Bàn Giao</th>
                <th className="py-3.5 px-3.5 w-36">BS Điều Trị</th>
                <th className="py-3.5 px-3 w-28 text-center shrink-0">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-extrabold text-slate-600 text-sm">
                      Không có bệnh nhân nào phù hợp với bộ lọc hiện tại.
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Hãy bấm "Xóa lọc" hoặc nhấn nút "+ Nhập Mới Bệnh Nhân" để tiếp nhận ca mới.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredPatients.map((patient) => {
                  const doctor = doctorMap.get(patient.attendingDoctorId);
                  const isCritical = patient.severity === 'CRITICAL';
                  const isModerate = patient.severity === 'MODERATE';
                  const treatmentInfo = calculateTreatmentDays(patient.admissionDate);
                  
                  // Plan of treatment: explicit plan or newest evolution action
                  const currentPlan = patient.treatmentPlan || 
                    patient.evolutions?.[0]?.treatmentAction || 
                    patient.initialMedicationsText || 
                    'Chăm sóc cấp 2, theo dõi sinh hiệu thường quy, ăn chế độ bệnh lý.';

                  // Notes and handover:
                  const currentNotes = patient.importantNotes || 
                    patient.handoverNotes || 
                    (patient.evolutions?.[0]?.clinicalNote ? `Diễn biến: ${patient.evolutions[0].clinicalNote}` : 'Chưa có ghi chú đặc biệt');

                  return (
                    <tr
                      key={patient.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isCritical ? 'bg-rose-50/35' : ''
                      }`}
                    >
                      {/* 1. TÊN PHÒNG */}
                      <td className="py-3.5 px-3.5 align-top">
                        <div className="space-y-1">
                          <span className="inline-block px-2 py-1 rounded-lg bg-slate-900 text-white font-black text-xs shadow-2xs tracking-tight">
                            {patient.roomNumber.startsWith('P.') || patient.roomNumber.toLowerCase().includes('phòng')
                              ? patient.roomNumber
                              : `Phòng ${patient.roomNumber}`}
                          </span>
                          <div className="font-extrabold text-rose-700 text-xs flex items-center gap-1">
                            <span>{patient.bedNumber}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block font-medium">
                            Khoa Nội TH
                          </span>
                        </div>
                      </td>

                      {/* 2. TÊN BỆNH NHÂN - TUỔI - GIỚI */}
                      <td className="py-3.5 px-3.5 align-top">
                        <div 
                          onClick={() => onSelectPatient(patient)}
                          className="cursor-pointer group space-y-1"
                        >
                          <h4 className="font-extrabold text-sm text-slate-900 group-hover:text-rose-600 transition-colors leading-tight">
                            {patient.fullName}
                          </h4>
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800">
                              {patient.age} tuổi
                            </span>
                            <span className={`px-1.5 py-0.5 rounded ${
                              patient.gender === 'Nam' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'
                            }`}>
                              {patient.gender}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 3. NGÀY VÀO, SỐ NGÀY ĐIỀU TRỊ (TÍNH TỚI HIỆN TẠI) */}
                      <td className="py-3.5 px-3.5 align-top">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1 text-slate-700 font-semibold text-xs">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>Vào: <strong className="font-extrabold text-slate-900">{patient.admissionDate.split(' ')[0]}</strong></span>
                          </div>
                          <div className="inline-flex items-center gap-1 px-2 py-0.8 rounded-md bg-indigo-50 text-indigo-900 border border-indigo-200/80 font-black text-[11px]">
                            <Clock className="w-3 h-3 text-indigo-600 shrink-0" />
                            <span>{treatmentInfo.label}</span>
                          </div>
                        </div>
                      </td>

                      {/* 4. CHẨN ĐOÁN HIỆN TẠI (KHÔNG CẦN ICD) */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="space-y-1">
                          <p className="font-bold text-slate-900 text-xs leading-relaxed">
                            {patient.primaryDiagnosis}
                          </p>
                          {patient.secondaryDiagnosis && (
                            <p className="text-[11px] text-slate-600 font-medium leading-normal bg-slate-50 p-1.5 rounded border border-slate-200/60">
                              <span className="text-slate-400 font-bold uppercase text-[9px] block">Kèm theo:</span>
                              {patient.secondaryDiagnosis}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* 5. TÌNH TRẠNG & NHÃN ĐẶC BIỆT */}
                      <td className="py-3.5 px-3.5 align-top">
                        <div className="space-y-1.5">
                          {/* Severity Badge */}
                          <div className="flex flex-wrap items-center gap-1">
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

                            {/* RV hôm nay / Dự kiến RV mai badges */}
                            {patient.admissionStatus === 'DISCHARGE_TODAY' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-black text-[10px] bg-purple-600 text-white shadow-xs">
                                RV hôm nay
                              </span>
                            )}
                            {patient.admissionStatus === 'DISCHARGE_TOMORROW' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-black text-[10px] bg-blue-600 text-white shadow-xs">
                                Dự kiến RV mai
                              </span>
                            )}
                          </div>

                          {/* Clinical Tags */}
                          {patient.tags && patient.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {patient.tags.map((tag) => {
                                const meta = CLINICAL_TAGS_META[tag];
                                if (!meta) return null;
                                return (
                                  <span
                                    key={tag}
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${meta.badgeBg} text-white`}
                                    title={meta.description}
                                  >
                                    {meta.shortLabel}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">
                              Không có nhãn khác
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 6. KẾ HOẠCH ĐIỀU TRỊ */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="p-2 rounded-xl bg-blue-50/60 border border-blue-200/80 text-blue-950 space-y-1">
                          <span className="text-[9px] font-black text-blue-700 uppercase tracking-wider block">
                            Phác Đồ & Y Lệnh Hiện Tại
                          </span>
                          <p className="text-xs font-semibold leading-relaxed line-clamp-3" title={currentPlan}>
                            {currentPlan}
                          </p>
                        </div>
                      </td>

                      {/* 7. GHI CHÚ VÀ BÀN GIAO */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="p-2 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-950 space-y-1">
                          <span className="text-[9px] font-black text-amber-700 uppercase tracking-wider block">
                            Lưu Ý & Bàn Giao Kíp Trực
                          </span>
                          <p className="text-xs font-medium leading-relaxed line-clamp-3" title={currentNotes}>
                            {currentNotes}
                          </p>
                        </div>
                      </td>

                      {/* 8. BS ĐIỀU TRỊ */}
                      <td className="py-3.5 px-3.5 align-top">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg ${doctor?.avatarColor || 'bg-slate-700'} text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs`}>
                            {doctor?.name ? doctor.name.split(' ').pop()?.[0] : 'BS'}
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-900 block text-xs leading-tight">
                              {doctor?.name || 'BS Điều trị'}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-medium">
                              Phụ trách chính
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 9. THAO TÁC (NHẬP DIỄN TIẾN / SỬA) */}
                      <td className="py-3.5 px-3 align-middle text-center shrink-0">
                        <div className="flex flex-col gap-1.5 items-stretch">
                          {/* Button 1: Nhập diễn tiến ngày tiếp theo */}
                          <button
                            type="button"
                            onClick={() => onOpenEvolution(patient)}
                            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-black text-xs shadow-2xs flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap active:scale-95"
                            title="Nhập diễn tiến và kế hoạch điều trị cho ngày hôm sau"
                          >
                            <Activity className="w-3.5 h-3.5 text-indigo-200" />
                            <span>+ Diễn Tiến</span>
                          </button>

                          {/* Button 2: Sửa / Chi tiết */}
                          <button
                            type="button"
                            onClick={() => onSelectPatient(patient)}
                            className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-bold text-[11px] transition-colors cursor-pointer flex items-center justify-center gap-1"
                            title="Xem chi tiết hồ sơ bệnh nhân"
                          >
                            <FileEdit className="w-3 h-3 text-slate-500" />
                            <span>Chi tiết</span>
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            Hiển thị <strong className="text-slate-800">{filteredPatients.length}</strong> / {activePatients.length} bệnh nhân nội trú
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
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span>{stableCount} ca ổn</span>
            </span>
          </div>
        </div>

      </div>

    </div>
  );
};

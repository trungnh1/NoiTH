import React, { useState, useMemo } from 'react';
import { 
  X, 
  RotateCcw, 
  Search, 
  Calendar, 
  UserCheck, 
  AlertCircle, 
  DoorOpen, 
  Bed, 
  CheckCircle2, 
  Sparkles,
  ArrowRight,
  LogOut
} from 'lucide-react';
import { Patient, DepartmentRoom } from '../types/patient';
import { 
  isDischargedOnNov16, 
  restoreDischargedPatient, 
  formatDischargeDateDisplay,
  isAdmittedBeforeNov10
} from '../utils/dischargeUtils';
import { formatPatientDisplayName } from '../utils/storage';
import { ALL_ROOM_NUMBERS } from './DetailedPatientListView';

interface DischargedPatientsModalProps {
  patients: Patient[];
  rooms: DepartmentRoom[];
  onClose: () => void;
  onRestorePatient: (patient: Patient, targetRoom?: string) => Promise<void> | void;
  onRestoreMultiplePatients: (patients: Patient[]) => Promise<void> | void;
  onDischargeBeforeNov10?: () => Promise<void> | void;
  activeBeforeNov10Count?: number;
}

export const DischargedPatientsModal: React.FC<DischargedPatientsModalProps> = ({
  patients,
  rooms,
  onClose,
  onRestorePatient,
  onRestoreMultiplePatients,
  onDischargeBeforeNov10,
  activeBeforeNov10Count = 0,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'BEFORE_NOV10' | 'NOV16' | 'OTHER'>('ALL');
  const [selectedRoomOverrides, setSelectedRoomOverrides] = useState<Record<string, string>>({});
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [isBatchRestoring, setIsBatchRestoring] = useState(false);
  const [isDischargingBeforeNov10, setIsDischargingBeforeNov10] = useState(false);

  // Danh sách toàn bộ bệnh nhân có trạng thái DISCHARGED
  const dischargedList = useMemo(() => {
    return (patients || []).filter((p) => p.status === 'DISCHARGED');
  }, [patients]);

  // Các ca vào viện trước ngày 10/11
  const beforeNov10List = useMemo(() => {
    return dischargedList.filter(isAdmittedBeforeNov10);
  }, [dischargedList]);

  // Các ca bị cho ra viện ngày 16/11/2026
  const nov16List = useMemo(() => {
    return dischargedList.filter(isDischargedOnNov16);
  }, [dischargedList]);

  // Các ca ngày khác
  const otherList = useMemo(() => {
    return dischargedList.filter((p) => !isAdmittedBeforeNov10(p) && !isDischargedOnNov16(p));
  }, [dischargedList]);

  // Lọc theo tìm kiếm và tab hiện tại
  const filteredList = useMemo(() => {
    let list = dischargedList;
    if (activeTab === 'BEFORE_NOV10') {
      list = beforeNov10List;
    } else if (activeTab === 'NOV16') {
      list = nov16List;
    } else if (activeTab === 'OTHER') {
      list = otherList;
    }

    if (!searchTerm.trim()) return list;

    const query = searchTerm.trim().toLowerCase();
    return list.filter((p) => {
      const name = (p.fullName || '').toLowerCase();
      const code = (p.patientCode || p.medicalRecordNumber || '').toLowerCase();
      const room = (p.roomNumber || '').toLowerCase();
      const diag = (p.primaryDiagnosis || '').toLowerCase();
      return name.includes(query) || code.includes(query) || room.includes(query) || diag.includes(query);
    });
  }, [dischargedList, beforeNov10List, nov16List, otherList, activeTab, searchTerm]);

  // Xử lý khôi phục 1 ca
  const handleSingleRestore = async (patient: Patient) => {
    setRestoringId(patient.id);
    try {
      const customRoom = selectedRoomOverrides[patient.id] || patient.roomNumber;
      await onRestorePatient(patient, customRoom);
    } finally {
      setRestoringId(null);
    }
  };

  // Xử lý khôi phục hàng loạt tất cả ca trong tab hiện tại
  const handleRestoreAllCurrent = async () => {
    const target = filteredList.length > 0 ? filteredList : dischargedList;
    if (target.length === 0) return;
    setIsBatchRestoring(true);
    try {
      await onRestoreMultiplePatients(target);
    } finally {
      setIsBatchRestoring(false);
    }
  };

  const handleTriggerDischargeBeforeNov10 = async () => {
    if (!onDischargeBeforeNov10) return;
    setIsDischargingBeforeNov10(true);
    try {
      await onDischargeBeforeNov10();
    } finally {
      setIsDischargingBeforeNov10(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col w-full max-w-4xl max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#0b4d8c] via-[#0e599e] to-[#083a69] text-white px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-xs shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white shadow-inner">
              <DoorOpen className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  Quản Lý Bệnh Nhân Đã Ra Viện
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-white/20 border border-white/20 text-white">
                  {dischargedList.length} ca
                </span>
              </div>
              <p className="text-xs text-blue-200/90 font-medium">
                Khoa Nội Tổng Hợp - Tim Mạch | Theo dõi hồ sơ ra viện & khôi phục về buồng bệnh khi cần
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Đóng modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Banner for Active Before Nov 10 Patients */}
        {activeBeforeNov10Count > 0 && (
          <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 text-white px-4 sm:px-6 py-3 border-b border-orange-500/30 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                <LogOut className="w-4 h-4 text-amber-200" />
              </div>
              <div>
                <div className="font-black text-sm flex items-center gap-1.5">
                  <span>Còn {activeBeforeNov10Count} bệnh nhân vào viện trước ngày 10/11 đang điều trị</span>
                </div>
                <div className="text-xs text-amber-100 font-medium">
                  Bấm nút bên cạnh để hoàn tất cho ra viện tất cả các trường hợp này ngay lập tức.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTriggerDischargeBeforeNov10}
              disabled={isDischargingBeforeNov10}
              className="px-4 py-2 bg-white hover:bg-amber-50 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-2 shrink-0 border border-amber-300 disabled:opacity-60"
            >
              <LogOut className={`w-4 h-4 text-rose-700 ${isDischargingBeforeNov10 ? 'animate-spin' : ''}`} />
              <span>
                {isDischargingBeforeNov10 
                  ? 'Đang xử lý...' 
                  : `🚪 Cho ra viện tất cả (${activeBeforeNov10Count} ca)`}
              </span>
            </button>
          </div>
        )}

        {/* Search & Tabs Toolbar */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Tabs */}
          <div className="inline-flex p-1 bg-white rounded-xl border border-slate-200 text-xs font-bold gap-1 shadow-2xs overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'ALL'
                  ? 'bg-[#0b4d8c] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>Tất cả đã ra viện</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
                {dischargedList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('BEFORE_NOV10')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'BEFORE_NOV10'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-800 hover:bg-rose-50'
              }`}
            >
              <span>🚪 Vào viện trước 10/11</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'BEFORE_NOV10' ? 'bg-white/25 text-white' : 'bg-rose-100 text-rose-800 font-bold'}`}>
                {beforeNov10List.length}
              </span>
            </button>

            {nov16List.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('NOV16')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'NOV16'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'text-amber-800 hover:bg-amber-50'
                }`}
              >
                <span>⭐ Ca ngày 16/11/2026</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'NOV16' ? 'bg-slate-950 text-amber-300' : 'bg-amber-100 text-amber-900 font-bold'}`}>
                  {nov16List.length}
                </span>
              </button>
            )}

            {otherList.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('OTHER')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'OTHER'
                    ? 'bg-[#0b4d8c] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Các ngày khác</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'OTHER' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
                  {otherList.length}
                </span>
              </button>
            )}
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:w-64 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên, mã BN, phòng, chẩn đoán..."
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0b4d8c] focus:border-transparent text-slate-800 placeholder-slate-400 shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Patient Cards List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 bg-slate-100/60">
          {filteredList.length === 0 ? (
            <div className="text-center py-12 px-4 bg-white rounded-2xl border border-dashed border-slate-300">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <div className="text-base font-bold text-slate-800">
                {searchTerm
                  ? 'Không tìm thấy bệnh nhân nào phù hợp với từ khóa'
                  : 'Không có bệnh nhân nào trong danh mục này'}
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Tất cả bệnh nhân đang được điều trị và quản lý chính xác trong các buồng bệnh của Khoa.
              </p>
            </div>
          ) : (
            filteredList.map((patient) => {
              const isNov16 = isDischargedOnNov16(patient);
              const isBeforeNov10 = isAdmittedBeforeNov10(patient);
              const isRestoringThis = restoringId === patient.id;
              const currentOverrideRoom = selectedRoomOverrides[patient.id] || patient.roomNumber;

              return (
                <div
                  key={patient.id}
                  className={`bg-white rounded-xl border p-3 sm:p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isBeforeNov10
                      ? 'border-rose-200 bg-rose-50/20'
                      : isNov16 
                      ? 'border-amber-300 bg-amber-50/20' 
                      : 'border-slate-200'
                  }`}
                >
                  {/* Left: Patient Info */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-700 shrink-0">
                      <Bed className="w-4 h-4 text-[#0b4d8c]" />
                      <span className="text-[10px] font-black leading-none mt-0.5">
                        {patient.roomNumber}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
                          {formatPatientDisplayName(patient.fullName)}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          ({patient.gender}, {patient.age}t)
                        </span>

                        {isBeforeNov10 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                            🚪 Vào viện trước 10/11
                          </span>
                        )}

                        {isNov16 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                            ⭐ Ca ngày 16/11/2026
                          </span>
                        )}

                        {patient.patientCode && (
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                            {patient.patientCode}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-700 font-semibold mt-1 line-clamp-2">
                        <span className="text-slate-400 font-medium">Chẩn đoán:</span> {patient.primaryDiagnosis || 'Chưa ghi nhận'}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 mt-1.5">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-blue-600" />
                          <span>Vào viện: <strong className="text-slate-800">{patient.admissionDate || 'Chưa rõ'}</strong></span>
                        </div>
                        <div className="flex items-center gap-1">
                          <DoorOpen className="w-3.5 h-3.5 text-slate-400" />
                          <span>Ra viện: <strong className="text-slate-700">{formatDischargeDateDisplay(patient.dischargeDate)}</strong></span>
                        </div>
                        <div>
                          <span>Buồng ban đầu: <strong className="text-[#0b4d8c]">Phòng {patient.roomNumber} - {patient.bedNumber}</strong></span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Room Select & Restore Action */}
                  <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-500 font-medium">Vào phòng:</span>
                      <select
                        value={currentOverrideRoom}
                        onChange={(e) => {
                          setSelectedRoomOverrides({
                            ...selectedRoomOverrides,
                            [patient.id]: e.target.value,
                          });
                        }}
                        className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0b4d8c]"
                      >
                        {ALL_ROOM_NUMBERS.map((r) => (
                          <option key={r} value={r}>
                            P.{r}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSingleRestore(patient)}
                      disabled={isRestoringThis || isBatchRestoring}
                      className="px-3 py-1.5 bg-[#0b4d8c] hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                      title={`Khôi phục bệnh nhân vào buồng ${currentOverrideRoom}`}
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isRestoringThis ? 'animate-spin' : ''}`} />
                      <span>{isRestoringThis ? 'Đang khôi phục...' : `Khôi phục về P.${currentOverrideRoom}`}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs font-semibold shrink-0">
          <div className="text-slate-500">
            Hiển thị <strong className="text-slate-800">{filteredList.length}</strong> / <strong className="text-slate-800">{dischargedList.length}</strong> bệnh nhân đã ra viện
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

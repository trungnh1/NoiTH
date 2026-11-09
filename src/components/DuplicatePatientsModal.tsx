import React, { useState } from 'react';
import { 
  X, 
  AlertTriangle, 
  Trash2, 
  ArrowRightLeft, 
  Sparkles, 
  CheckCircle2, 
  Building2, 
  Calendar, 
  Stethoscope, 
  FileText, 
  Activity, 
  Clock, 
  Eye, 
  ShieldAlert,
  UserCheck
} from 'lucide-react';
import { Patient, Doctor } from '../types/patient';
import { DuplicatePatientGroup } from '../utils/excelParser';
import { formatPatientDisplayName } from '../utils/storage';
import { formatDoctorShortName } from './DetailedPatientListView';

interface DuplicatePatientsModalProps {
  isOpen: boolean;
  duplicateGroups: DuplicatePatientGroup[];
  doctors: Doctor[];
  onClose: () => void;
  onDeletePatient: (patient: Patient) => void;
  onMergePatients?: (primaryPatient: Patient, duplicatePatient: Patient) => void;
  onDismissPair: (idA: string, idB: string) => void;
  onSelectPatient?: (patient: Patient) => void;
}

export const DuplicatePatientsModal: React.FC<DuplicatePatientsModalProps> = ({
  isOpen,
  duplicateGroups,
  doctors,
  onClose,
  onDeletePatient,
  onMergePatients,
  onDismissPair,
  onSelectPatient,
}) => {
  const [confirmDeletePatient, setConfirmDeletePatient] = useState<{
    patient: Patient;
    group: DuplicatePatientGroup;
  } | null>(null);

  const [confirmMergeInfo, setConfirmMergeInfo] = useState<{
    primary: Patient;
    duplicate: Patient;
    group: DuplicatePatientGroup;
  } | null>(null);

  const [notification, setNotification] = useState<string | null>(null);

  if (!isOpen) return null;

  const doctorMap = new Map<string, Doctor>(doctors.map((d) => [d.id, d]));

  // Tính điểm độ đầy đủ dữ liệu lâm sàng của bệnh nhân
  const computeDataScore = (p: Patient): number => {
    const evoCount = p.evolutions?.length || 0;
    const vitCount = p.vitals?.length || 0;
    const labCount = p.labs?.length || 0;
    const hasDiag = p.primaryDiagnosis && p.primaryDiagnosis.trim() ? 5 : 0;
    const hasDoc = p.attendingDoctorId ? 5 : 0;
    const hasPlan = p.treatmentPlan && p.treatmentPlan.trim() ? 3 : 0;
    return evoCount * 10 + vitCount * 3 + labCount * 2 + hasDiag + hasDoc + hasPlan;
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleExecuteDelete = (patient: Patient) => {
    onDeletePatient(patient);
    setConfirmDeletePatient(null);
    showNotification(`Đã xóa bản ghi của bệnh nhân "${patient.fullName}" (P.${patient.roomNumber})!`);
  };

  const handleExecuteMerge = (primary: Patient, duplicate: Patient) => {
    if (onMergePatients) {
      onMergePatients(primary, duplicate);
    } else {
      onDeletePatient(duplicate);
    }
    setConfirmMergeInfo(null);
    showNotification(`Đã gộp dữ liệu lâm sàng vào bản ghi chính và xóa bản ghi thừa!`);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* HEADER */}
        <div className="px-5 py-4 bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs border border-white/30 flex items-center justify-center text-white shadow-inner shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-200 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full border border-white/20">
                  Kiểm Tra & Đối Soát Hàng Ngày
                </span>
                <span className="text-xs font-bold text-amber-100">
                  ({duplicateGroups.length} nhóm trùng lặp)
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white mt-0.5">
                Phát Hiện Bệnh Nhân Trùng Lặp Trong Khoa
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
            title="Đóng cửa sổ (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* NOTIFICATION BANNER */}
        {notification && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* SUBHEADER EXPLANATION */}
        <div className="bg-amber-50/80 border-b border-amber-200 px-5 py-2.5 flex items-center justify-between text-xs text-amber-900 font-medium">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Hệ thống tự động phát hiện các ca bệnh trùng <strong>Họ tên, Tuổi và Ngày nhập viện</strong> hoặc <strong>Mã bệnh nhân</strong>. Bác sĩ hãy chọn <strong>Xóa bản ghi thừa</strong> hoặc <strong>Gộp dữ liệu</strong> để làm sạch danh sách buồng phòng.
            </span>
          </div>
        </div>

        {/* BODY CONTENT */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          {duplicateGroups.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-slate-800">
                Tuyệt vời! Không còn bệnh nhân nào bị trùng lặp trong khoa
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Dữ liệu danh sách nội trú của các buồng phòng (703 - 757) hoàn toàn sạch sẽ, không có ca trùng họ tên, tuổi hoặc ngày nhập viện.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 bg-[#0b4d8c] text-white font-bold text-xs rounded-xl shadow-xs hover:bg-[#083a69] transition-all cursor-pointer"
                >
                  Hoàn Tất & Đóng
                </button>
              </div>
            </div>
          ) : (
            duplicateGroups.map((group, gIdx) => {
              // Sắp xếp các bệnh nhân trong cụm theo điểm dữ liệu giảm dần
              const scoredPatients = group.patients.map((p) => ({
                patient: p,
                score: computeDataScore(p),
              }));
              scoredPatients.sort((a, b) => b.score - a.score);
              const maxScore = scoredPatients[0]?.score || 0;

              return (
                <div 
                  key={group.id} 
                  className="bg-white rounded-2xl border-2 border-amber-300 shadow-sm overflow-hidden space-y-3"
                >
                  {/* GROUP HEADER */}
                  <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-lg bg-amber-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                        {gIdx + 1}
                      </span>
                      <div>
                        <h4 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                          <span>{formatPatientDisplayName(group.patientName)}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-rose-600 text-white font-bold">
                            {group.patients.length} bản ghi trùng
                          </span>
                        </h4>
                        <div className="text-[11px] font-bold text-rose-700 flex items-center gap-1 mt-0.5">
                          <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                          <span>Lý do phát hiện: {group.reason}</span>
                        </div>
                      </div>
                    </div>

                    {/* NÚT BỎ QUA CẶP NÀY NẾU LÀ 2 NGƯỜI THẬT SỰ KHÁC NHAU */}
                    <button
                      type="button"
                      onClick={() => {
                        if (group.patients.length >= 2) {
                          onDismissPair(group.patients[0].id, group.patients[1].id);
                          showNotification(`Đã đánh dấu bỏ qua cảnh báo trùng lặp cho ca "${group.patientName}"!`);
                        }
                      }}
                      className="text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-300 transition-colors cursor-pointer shadow-2xs"
                      title="Bác sĩ xác nhận đây là 2 người bệnh khác nhau (trùng tên), không cảnh báo lại"
                    >
                      ✓ Bỏ qua (Là 2 người khác nhau)
                    </button>
                  </div>

                  {/* CARDS COMPARISON GRID */}
                  <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {scoredPatients.map(({ patient: p, score }, idx) => {
                      const isRecommendedKeep = score === maxScore && idx === 0;
                      const assignedDoc = p.attendingDoctorId ? doctorMap.get(p.attendingDoctorId) : null;
                      const evoCount = p.evolutions?.length || 0;
                      const vitCount = p.vitals?.length || 0;
                      const labCount = p.labs?.length || 0;

                      return (
                        <div
                          key={p.id}
                          className={`rounded-2xl p-3.5 border-2 transition-all flex flex-col justify-between space-y-3 ${
                            isRecommendedKeep
                              ? 'bg-emerald-50/40 border-emerald-400 ring-2 ring-emerald-200'
                              : 'bg-rose-50/30 border-rose-300'
                          }`}
                        >
                          {/* BADGE KHUYÊN DÙNG */}
                          <div className="flex items-center justify-between gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-black uppercase tracking-wider flex items-center gap-1 ${
                              isRecommendedKeep
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-rose-600 text-white shadow-xs'
                            }`}>
                              {isRecommendedKeep ? (
                                <>
                                  <Sparkles className="w-3 h-3 text-yellow-300" />
                                  <span>Bản ghi đầy đủ hơn • Nên Giữ Lại</span>
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="w-3 h-3 text-white" />
                                  <span>Bản ghi nghi vấn thừa • Nên Xóa</span>
                                </>
                              )}
                            </span>

                            <span className="text-[10px] text-slate-400 font-mono font-bold">
                              ID: {p.id.slice(0, 16)}...
                            </span>
                          </div>

                          {/* DETAILS */}
                          <div className="space-y-1.5 text-xs">
                            <div className="flex items-center justify-between font-bold">
                              <span className="text-slate-900 font-black text-sm">
                                {formatPatientDisplayName(p.fullName)}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-blue-100 text-[#0b4d8c] font-black text-xs">
                                Phòng {p.roomNumber} - {p.bedNumber || 'Giường 01'}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600 pt-1 border-t border-slate-200/60">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span>Vào viện: <strong>{p.admissionDate || '--'}</strong></span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span>Tuổi: <strong>{p.age}T</strong> ({p.gender})</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Stethoscope className="w-3 h-3 text-slate-400" />
                                <span className="truncate">
                                  BS: <strong>{assignedDoc ? formatDoctorShortName(assignedDoc.name) : 'Chưa phân công'}</strong>
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span>Mã BN: <strong>{p.patientCode || p.medicalRecordNumber || '---'}</strong></span>
                              </div>
                            </div>

                            {/* CHẨN ĐOÁN */}
                            <div className="pt-1 text-[11px] text-slate-700 bg-white/70 p-2 rounded-lg border border-slate-200">
                              <span className="font-extrabold text-[#0b4d8c]">Chẩn đoán: </span>
                              <span className="font-medium">
                                {p.primaryDiagnosis || <span className="italic text-slate-400">(Chưa có chẩn đoán)</span>}
                              </span>
                            </div>

                            {/* THỐNG KÊ DỮ LIỆU LÂM SÀNG */}
                            <div className="flex items-center gap-2 flex-wrap pt-1 text-[10.5px]">
                              <span className={`px-2 py-0.5 rounded-md font-bold ${
                                evoCount > 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-400'
                              }`}>
                                📝 {evoCount} Diễn tiến
                              </span>
                              <span className={`px-2 py-0.5 rounded-md font-bold ${
                                vitCount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-400'
                              }`}>
                                ❤️ {vitCount} Cữ sinh hiệu
                              </span>
                              <span className={`px-2 py-0.5 rounded-md font-bold ${
                                labCount > 0 ? 'bg-cyan-100 text-cyan-800' : 'bg-slate-100 text-slate-400'
                              }`}>
                                🧪 {labCount} Xét nghiệm
                              </span>
                            </div>
                          </div>

                          {/* ACTION BUTTONS */}
                          <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-1.5">
                            {onSelectPatient && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectPatient(p);
                                  onClose();
                                }}
                                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-lg border border-slate-300 transition-colors cursor-pointer flex items-center gap-1"
                                title="Xem đầy đủ hồ sơ bệnh án"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-500" />
                                <span>Xem hồ sơ</span>
                              </button>
                            )}

                            <div className="flex items-center gap-1.5 ml-auto">
                              {/* NÚT GỘP NẾU CÓ DỮ LIỆU */}
                              {!isRecommendedKeep && onMergePatients && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const primaryPat = scoredPatients[0].patient;
                                    setConfirmMergeInfo({
                                      primary: primaryPat,
                                      duplicate: p,
                                      group,
                                    });
                                  }}
                                  className="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-black text-xs rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                                  title="Chuyển toàn bộ diễn tiến từ bản ghi này sang bản ghi chính rồi xóa bản ghi thừa"
                                >
                                  <ArrowRightLeft className="w-3 h-3 text-teal-200" />
                                  <span>Gộp & Xóa</span>
                                </button>
                              )}

                              {/* NÚT XÓA BẢN GHI */}
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmDeletePatient({ patient: p, group });
                                }}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                                title="Xóa vĩnh viễn bản ghi trùng này khỏi hệ thống"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-white" />
                                <span>Xóa bản ghi</span>
                              </button>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>

                </div>
              );
            })
          )}
        </div>

        {/* MODAL XÁC NHẬN XÓA BẢN GHI TRÙNG */}
        {confirmDeletePatient && (
          <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-3 text-rose-600">
                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">Xác Nhận Xóa Bản Ghi Trùng</h4>
                  <p className="text-xs text-slate-500">Hành động này sẽ xóa bệnh nhân khỏi danh sách buồng phòng và Cloud</p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <div>Bệnh nhân: <strong className="text-slate-900">{confirmDeletePatient.patient.fullName}</strong></div>
                <div>Vị trí: <strong>Phòng {confirmDeletePatient.patient.roomNumber} - {confirmDeletePatient.patient.bedNumber || 'Giường 01'}</strong></div>
                <div>Ngày vào viện: <strong>{confirmDeletePatient.patient.admissionDate || '--'}</strong></div>
                <div>Số diễn tiến hiện có: <strong>{confirmDeletePatient.patient.evolutions?.length || 0}</strong></div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeletePatient(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-xs cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={() => handleExecuteDelete(confirmDeletePatient.patient)}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
                >
                  Đồng Ý Xóa Bản Ghi
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL XÁC NHẬN GỘP DỮ LIỆU & XÓA BẢN GHI THỪA */}
        {confirmMergeInfo && (
          <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-3 text-teal-700">
                <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
                  <ArrowRightLeft className="w-5 h-5 text-teal-700" />
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">Gộp Dữ Liệu & Xóa Bản Ghi Thừa</h4>
                  <p className="text-xs text-slate-500">Giữ nguyên bản ghi chính, gom toàn bộ diễn tiến và xóa bản ghi phụ</p>
                </div>
              </div>

              <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-200 text-xs space-y-2">
                <div>
                  <span className="font-extrabold text-teal-900">1. Bản ghi giữ lại (Chính):</span>
                  <div className="text-slate-700 pl-2">
                    {confirmMergeInfo.primary.fullName} • Phòng {confirmMergeInfo.primary.roomNumber} ({confirmMergeInfo.primary.evolutions?.length || 0} diễn tiến)
                  </div>
                </div>
                <div>
                  <span className="font-extrabold text-rose-800">2. Bản ghi sẽ gộp sang & xóa (Phụ):</span>
                  <div className="text-slate-700 pl-2">
                    Phòng {confirmMergeInfo.duplicate.roomNumber} ({confirmMergeInfo.duplicate.evolutions?.length || 0} diễn tiến sẽ được chuyển sang)
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmMergeInfo(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-xs cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={() => handleExecuteMerge(confirmMergeInfo.primary, confirmMergeInfo.duplicate)}
                  className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
                >
                  Xác Nhận Gộp & Xóa
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <div className="text-slate-500 font-medium flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-[#0b4d8c]" />
            <span>Tự động kiểm tra hàng ngày trên toàn bộ buồng bệnh nội trú (703 – 757).</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Đóng Cửa Sổ
          </button>
        </div>

      </div>
    </div>
  );
};

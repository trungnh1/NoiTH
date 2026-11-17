import React from 'react';
import { AlertTriangle, RotateCcw, DoorOpen, LogOut } from 'lucide-react';
import { Patient } from '../types/patient';
import { DuplicatePatientGroup } from '../utils/excelParser';
import { isAdmittedBeforeNov10 } from '../utils/dischargeUtils';

interface WardBannersProps {
  duplicatePatientGroups: DuplicatePatientGroup[];
  isDuplicateModalOpen: boolean;
  onOpenDuplicateModal: () => void;
  dischargedPatients: Patient[];
  isDischargedModalOpen: boolean;
  onOpenDischargedModal: () => void;
  onRestoreNov16Discharged: () => void;
  activeBeforeNov10Count?: number;
  onDischargeBeforeNov10?: () => void;
  isAutoSyncing: boolean;
  manualPushMessage: string | null;
  onClearManualPushMessage: () => void;
  emergencyAlert: { message: string; patient: Patient } | null;
  onSelectPatient: (patient: Patient) => void;
  onClearEmergencyAlert: () => void;
}

export const WardBanners: React.FC<WardBannersProps> = ({
  duplicatePatientGroups,
  isDuplicateModalOpen,
  onOpenDuplicateModal,
  dischargedPatients,
  isDischargedModalOpen,
  onOpenDischargedModal,
  onRestoreNov16Discharged,
  activeBeforeNov10Count = 0,
  onDischargeBeforeNov10,
  isAutoSyncing,
  manualPushMessage,
  onClearManualPushMessage,
  emergencyAlert,
  onSelectPatient,
  onClearEmergencyAlert,
}) => {
  return (
    <>
      {/* CẢNH BÁO ĐỐI SOÁT PHÁT HIỆN TRÙNG LẶP HÀNG NGÀY */}
      {duplicatePatientGroups.length > 0 && !isDuplicateModalOpen && (
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 text-white px-3 sm:px-5 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2 max-w-4xl truncate">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping shrink-0" />
            <span className="font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded text-[10.5px]">
              Đối soát hàng ngày
            </span>
            <span className="font-extrabold truncate">
              Phát hiện {duplicatePatientGroups.length} trường hợp bệnh nhân nghi vấn trùng lặp trong khoa ({duplicatePatientGroups.map(g => g.patientName).slice(0, 3).join(', ')}{duplicatePatientGroups.length > 3 ? ` và ${duplicatePatientGroups.length - 3} ca khác` : ''})!
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenDuplicateModal}
              className="px-3 py-1 bg-white hover:bg-amber-50 text-slate-950 font-black rounded-xl text-xs shadow-xs transition-transform active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
              <span>Xem & Chọn Xóa Trùng ({duplicatePatientGroups.reduce((acc, g) => acc + g.patients.length, 0)} ca)</span>
            </button>
          </div>
        </div>
      )}

      {/* THÔNG BÁO CHO RA VIỆN CA VÀO VIỆN TRƯỚC 10/11 */}
      {Boolean(activeBeforeNov10Count && activeBeforeNov10Count > 0) && (
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 text-white px-3 sm:px-5 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2 max-w-4xl truncate">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-200 animate-ping shrink-0" />
            <span className="font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded text-[10.5px]">
              Ra Viện Theo Tiêu Chuẩn
            </span>
            <span className="font-extrabold truncate">
              Phát hiện {activeBeforeNov10Count} bệnh nhân vào viện trước ngày 10/11 cần làm thủ tục cho ra viện!
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onDischargeBeforeNov10 && (
              <button
                type="button"
                onClick={onDischargeBeforeNov10}
                disabled={isAutoSyncing}
                className="px-3.5 py-1.5 bg-white hover:bg-amber-50 text-slate-950 font-black rounded-xl text-xs shadow-xs transition-transform active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-700" />
                <span>🚪 Cho ra viện tất cả ({activeBeforeNov10Count} ca)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* QUẢN LÝ HỒ SƠ BỆNH NHÂN ĐÃ RA VIỆN */}
      {dischargedPatients.length > 0 && !isDischargedModalOpen && (
        <div className="bg-gradient-to-r from-slate-800 via-blue-900 to-[#0b4d8c] text-white px-3 sm:px-5 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2 max-w-4xl truncate">
            <span className="w-2 h-2 rounded-full bg-blue-300 shrink-0" />
            <span className="font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded text-[10.5px]">
              Hồ sơ ra viện
            </span>
            <span className="font-semibold truncate">
              Khoa hiện có <strong>{dischargedPatients.length}</strong> bệnh nhân đã cho ra viện ({dischargedPatients.filter(isAdmittedBeforeNov10).length} ca vào viện trước 10/11)
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenDischargedModal}
              className="px-3.5 py-1 bg-white hover:bg-blue-50 text-slate-950 font-black rounded-xl text-xs shadow-xs transition-transform active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <DoorOpen className="w-3.5 h-3.5 text-[#0b4d8c]" />
              <span>Xem danh sách ra viện ({dischargedPatients.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Manual Push Feedback Banner */}
      {manualPushMessage && (
        <div className="bg-slate-900 text-white px-4 py-2 shadow-md flex items-center justify-between text-xs font-bold animate-in fade-in slide-in-from-top-2 border-b border-blue-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
            <span>{manualPushMessage}</span>
          </div>
          <button
            onClick={onClearManualPushMessage}
            className="text-slate-400 hover:text-white cursor-pointer px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Real-time Emergency Ingestion Notification Banner */}
      {emergencyAlert && (
        <div className="bg-gradient-to-r from-rose-600 via-rose-700 to-amber-600 text-white px-4 py-2.5 shadow-md flex items-center justify-between text-xs sm:text-sm animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2 max-w-4xl truncate">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping shrink-0" />
            <span className="font-extrabold uppercase tracking-wide">Cấp cứu chuyển khoa:</span>
            <span className="font-bold truncate">{emergencyAlert.message}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                onSelectPatient(emergencyAlert.patient);
                onClearEmergencyAlert();
              }}
              className="px-2.5 py-1 bg-white text-rose-700 font-black rounded-lg text-xs shadow-xs hover:bg-rose-50 transition-colors cursor-pointer"
            >
              Mở hồ sơ ngay
            </button>
            <button
              onClick={onClearEmergencyAlert}
              className="text-white/80 hover:text-white p-1 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
};

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Patient } from '../types/patient';
import { DuplicatePatientGroup } from '../utils/excelParser';

interface WardBannersProps {
  duplicatePatientGroups: DuplicatePatientGroup[];
  isDuplicateModalOpen: boolean;
  onOpenDuplicateModal: () => void;
  dischargedPatients: Patient[];
  isDischargedModalOpen: boolean;
  onOpenDischargedModal: () => void;
  onRestoreNov16Discharged: () => void;
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

      {/* CẢNH BÁO / KHÔI PHỤC CA BỊ CHO RA VIỆN */}
      {dischargedPatients.length > 0 && !isDischargedModalOpen && (
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-[#0b4d8c] text-white px-3 sm:px-5 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2 max-w-4xl truncate">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
            <span className="font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded text-[10.5px]">
              Khôi phục ca ra viện
            </span>
            <span className="font-extrabold truncate">
              Phát hiện {dischargedPatients.length} bệnh nhân đang ở trạng thái ra viện!
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onRestoreNov16Discharged}
              disabled={isAutoSyncing}
              className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs shadow-xs transition-transform active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-950" />
              <span>⚡ Khôi phục ngay tất cả ({dischargedPatients.length} ca)</span>
            </button>
            <button
              type="button"
              onClick={onOpenDischargedModal}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Xem danh sách ({dischargedPatients.length})
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

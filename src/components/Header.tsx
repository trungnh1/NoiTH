import React from 'react';
import { 
  Building2, 
  HeartPulse, 
  Wind, 
  Eye, 
  UserPlus, 
  Cloud,
  CheckCircle2,
  Printer,
  AlertCircle,
  LogOut,
  Database,
  Settings
} from 'lucide-react';
import { Patient, Doctor } from '../types/patient';
import { SyncStatus } from '../services/firebaseSync';
import { formatDoctorShortName } from './DetailedPatientListView';

interface HeaderProps {
  patients: Patient[];
  activeView: 'detailed_list' | 'map' | 'table' | 'doctors';
  onViewChange: (view: 'detailed_list' | 'map' | 'table' | 'doctors') => void;
  onOpenNewPatient: () => void;
  onOpenHandover?: () => void;
  onOpenWatchlist?: () => void;
  onOpenPrintModal?: () => void;
  onManualPushToCloud?: () => void;
  onOpenDutySchedule?: () => void;
  onOpenSatelliteSync?: () => void;
  onOpenSettings?: () => void;
  onOpenChangePassword?: () => void;
  pendingSatelliteCount?: number;
  syncStatus: SyncStatus;
  isAutoSyncing?: boolean;
  lastAutoSyncTime?: string | null;
  currentDoctor?: Doctor | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  patients,
  activeView,
  onViewChange,
  onOpenNewPatient,
  onOpenPrintModal,
  onManualPushToCloud,
  onOpenSatelliteSync,
  onOpenSettings,
  onOpenChangePassword,
  pendingSatelliteCount,
  syncStatus,
  isAutoSyncing = false,
  lastAutoSyncTime,
  currentDoctor,
  onLogout,
}) => {
  const activePatients = patients.filter((p) => p.status === 'ACTIVE');
  const criticalCount = activePatients.filter((p) => p.severity === 'CRITICAL').length;
  const moderateCount = activePatients.filter((p) => p.severity === 'MODERATE').length;
  const stableCount = activePatients.filter((p) => p.severity === 'STABLE').length;
  
  const o2Count = activePatients.filter((p) => p.tags.includes('O2') || p.tags.includes('O2_CANULA') || p.tags.includes('O2_MASK')).length;
  const vasopressorCount = activePatients.filter((p) => p.tags.includes('VASOPRESSOR')).length;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="w-full px-3 sm:px-6 py-2 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Brand: Logo & Department Name */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0b4d8c] flex items-center justify-center text-white shadow-xs shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-[#0b4d8c] bg-blue-50 px-2 py-0.5 rounded border border-blue-200 uppercase tracking-wide">
                  BV Đa Khoa Hùng Vương Gia Lai
                </span>
                <button
                  type="button"
                  onClick={onManualPushToCloud}
                  className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                    syncStatus.errorMessage 
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : syncStatus.connected 
                      ? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      : 'bg-slate-50 text-slate-500 border-slate-200'
                  }`}
                  title="Bấm để đồng bộ lại dữ liệu lên Cloud Firestore"
                >
                  <Cloud className={`w-3 h-3 ${syncStatus.errorMessage ? 'text-rose-500' : syncStatus.connected ? 'text-emerald-600' : 'text-slate-400 animate-pulse'}`} />
                  <span>
                    {syncStatus.errorMessage ? 'Lỗi Cloud' : syncStatus.connected ? 'Cloud online' : 'Đang kết nối...'}
                  </span>
                </button>
                {syncStatus.errorMessage && (
                  <div className="text-[10px] text-rose-700 font-medium bg-rose-50 px-2 py-0.5 rounded border border-rose-200 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {syncStatus.errorMessage}
                  </div>
                )}
              </div>
              <h1 className="text-sm sm:text-base font-extrabold text-[#0b4d8c] tracking-tight">
                Khoa Nội Tổng Hợp - Tim Mạch
              </h1>
            </div>
          </div>

          {/* Center: Live Inpatient Status Counters - Tối giản */}
          <div className="hidden md:flex items-center gap-1.5 text-xs">
            <div className="bg-slate-100 text-slate-800 border border-slate-200 px-2.5 py-1 rounded-lg font-semibold text-xs flex items-center gap-1.5">
              <span className="text-slate-500 font-normal">Nội trú:</span>
              <span>{activePatients.length} BN</span>
            </div>

            <div className="bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${criticalCount > 0 ? 'bg-rose-500 animate-pulse' : 'bg-slate-300'}`} />
              <span className={criticalCount > 0 ? 'font-bold text-rose-700' : 'text-slate-600'}>
                Nặng: {criticalCount}
              </span>
            </div>

            <div className="bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Vừa: {moderateCount}</span>
            </div>

            <div className="bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Ổn: {stableCount}</span>
            </div>

            {o2Count > 0 && (
              <div className="bg-white border border-slate-200 text-slate-700 px-2 py-1 rounded-lg text-xs flex items-center gap-1">
                <Wind className="w-3.5 h-3.5 text-slate-500" />
                <span>Oxy: {o2Count}</span>
              </div>
            )}

            {vasopressorCount > 0 && (
              <div className="bg-white border border-slate-200 text-slate-700 px-2 py-1 rounded-lg text-xs flex items-center gap-1">
                <HeartPulse className="w-3.5 h-3.5 text-slate-500" />
                <span>Vận mạch: {vasopressorCount}</span>
              </div>
            )}
          </div>

          {/* Right Action Area */}
          <div className="flex items-center gap-1.5">
            {onOpenSatelliteSync && (
              <button
                type="button"
                onClick={onOpenSatelliteSync}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
                title="Lấy dữ liệu bệnh nhân từ Cloud Firestore lâm sàng vệ tinh"
              >
                <Database className="w-3.5 h-3.5 text-slate-500" />
                <span>Lấy dữ liệu BN</span>
                {Boolean(pendingSatelliteCount && pendingSatelliteCount > 0) && (
                  <span className="px-1.5 py-0.2 rounded-full bg-slate-900 text-white font-bold text-[9px]">
                    {pendingSatelliteCount}
                  </span>
                )}
              </button>
            )}

            {onManualPushToCloud && (
              <button
                type="button"
                onClick={onManualPushToCloud}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-2xs"
                title="Đẩy toàn bộ dữ liệu nội trú hiện tại lên Cloud Firestore"
              >
                <Cloud className="w-3.5 h-3.5 text-slate-500" />
                <span>Đẩy Cloud</span>
              </button>
            )}

            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="p-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg transition-all cursor-pointer flex items-center justify-center active:scale-95"
                title="Cài đặt giao diện & kích thước chữ"
              >
                <Settings className="w-4 h-4 text-slate-600" />
              </button>
            )}

            {/* Current Logged-in Doctor badge & Change Password & Logout */}
            {currentDoctor && (
              <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
                <div 
                  className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 px-2 py-1 rounded-lg text-xs border border-slate-200 transition-colors"
                  title={`Bác sĩ: ${currentDoctor.name} (Mã BS: ${currentDoctor.id})`}
                >
                  <div className="w-5 h-5 rounded-md bg-slate-800 flex items-center justify-center text-white text-[10px] font-bold">
                    {formatDoctorShortName(currentDoctor.name).slice(0, 1)}
                  </div>
                  <span className="font-bold text-slate-800 text-xs truncate max-w-[110px]">
                    BS. {formatDoctorShortName(currentDoctor.name)}
                  </span>
                </div>

                {onOpenChangePassword && (
                  <button
                    type="button"
                    onClick={onOpenChangePassword}
                    className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer text-xs font-medium"
                    title="Đổi mật khẩu tài khoản"
                  >
                    <span>Đổi MK</span>
                  </button>
                )}

                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer flex items-center gap-1 text-xs"
                    title="Đăng xuất khỏi hệ thống"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

          </div>

        </div>

        {/* View Switcher Navigation Bar - Tone BV Hùng Vương Gia Lai */}
        <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium gap-0.5">
            <button
              type="button"
              onClick={() => onViewChange('detailed_list')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'detailed_list'
                  ? 'bg-[#0b4d8c] text-white font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <span>Danh Sách Bệnh Nhân</span>
            </button>

            <button
              type="button"
              onClick={() => onViewChange('map')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'map'
                  ? 'bg-[#0b4d8c] text-white font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <span>Bảng Buồng Phòng</span>
            </button>

            <button
              type="button"
              onClick={() => onViewChange('table')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'table'
                  ? 'bg-[#0b4d8c] text-white font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <span>Bảng Lưới Chi Tiết</span>
            </button>

            <button
              type="button"
              onClick={() => onViewChange('doctors')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'doctors'
                  ? 'bg-[#0b4d8c] text-white font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <span>Phân Công Bác Sĩ Điều Trị</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};


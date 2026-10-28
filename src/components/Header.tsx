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
    <header className="bg-white border-b border-slate-200/90 shadow-2xs sticky top-0 z-30">
      <div className="w-full px-3 sm:px-6 py-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Brand: Logo & Department Name */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 flex items-center justify-center text-white shadow-xs shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 uppercase tracking-wide">
                  BV HÙNG VƯƠNG GIA LAI
                </span>
                <button
                  type="button"
                  onClick={onManualPushToCloud}
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all cursor-pointer hover:shadow-xs active:scale-95 ${
                    syncStatus.errorMessage 
                      ? 'bg-rose-50 text-rose-800 border-rose-300'
                      : syncStatus.connected 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                  title="Bấm để đồng bộ lại dữ liệu lên Cloud Firestore"
                >
                  <Cloud className={`w-3 h-3 ${syncStatus.errorMessage ? 'text-rose-600' : syncStatus.connected ? 'text-emerald-600' : 'text-slate-400 animate-pulse'}`} />
                  <span>
                    {syncStatus.errorMessage ? 'Lỗi Cloud (Bấm thử lại)' : syncStatus.connected ? 'Cloud trực tuyến' : 'Đang kết nối Cloud...'}
                  </span>
                </button>
                {syncStatus.errorMessage && (
                  <div className="text-[10px] text-rose-700 font-medium bg-rose-100 px-2 py-0.5 rounded flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {syncStatus.errorMessage}
                  </div>
                )}
              </div>
              <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                Khoa Nội Tổng Hợp - Tim Mạch
              </h1>
            </div>
          </div>

          {/* Center: Live Inpatient Status Counters */}
          <div className="hidden md:flex items-center gap-2 text-xs">
            <div className="bg-slate-900 text-white px-2.5 py-1 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-2xs">
              <span className="text-slate-300 font-medium">Tổng Nội Trú:</span>
              <span>{activePatients.length} BN</span>
            </div>

            <div className={`px-2.5 py-1 rounded-xl font-black text-xs flex items-center gap-1.5 border ${
              criticalCount > 0 ? 'bg-rose-50 border-rose-300 text-rose-800' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
              <span>Nặng: {criticalCount}</span>
            </div>

            <div className="bg-amber-50 border border-amber-300 text-amber-900 px-2.5 py-1 rounded-xl font-black text-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Vừa: {moderateCount}</span>
            </div>

            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-2.5 py-1 rounded-xl font-black text-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Ổn: {stableCount}</span>
            </div>

            {o2Count > 0 && (
              <div className="bg-cyan-50 border border-cyan-300 text-cyan-900 px-2 py-1 rounded-xl font-black text-xs flex items-center gap-1">
                <Wind className="w-3.5 h-3.5 text-cyan-600" />
                <span>Oxy: {o2Count}</span>
              </div>
            )}

            {vasopressorCount > 0 && (
              <div className="bg-rose-50 border border-rose-300 text-rose-900 px-2 py-1 rounded-xl font-black text-xs flex items-center gap-1">
                <HeartPulse className="w-3.5 h-3.5 text-rose-600" />
                <span>Vận mạch: {vasopressorCount}</span>
              </div>
            )}
          </div>

          {/* Right Action Area */}
          <div className="flex items-center gap-2">
            {onOpenSatelliteSync && (
              <button
                type="button"
                onClick={onOpenSatelliteSync}
                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-black rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95 relative"
                title="Lấy dữ liệu bệnh nhân từ Cloud Firestore lâm sàng vệ tinh"
              >
                <Database className="w-3.5 h-3.5 text-indigo-600" />
                <span>Lấy dữ liệu BN</span>
                {Boolean(pendingSatelliteCount && pendingSatelliteCount > 0) && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white font-black text-[9px] animate-pulse">
                    {pendingSatelliteCount} chờ
                  </span>
                )}
              </button>
            )}

            {onManualPushToCloud && (
              <button
                type="button"
                onClick={onManualPushToCloud}
                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                title="Đẩy toàn bộ dữ liệu nội trú hiện tại lên Cloud Firestore"
              >
                <Cloud className="w-3 h-3 text-emerald-600" />
                <span>Đẩy Cloud</span>
              </button>
            )}

            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg transition-all cursor-pointer flex items-center justify-center active:scale-95"
                title="Cài đặt giao diện & kích thước chữ"
              >
                <Settings className="w-4 h-4 text-slate-600" />
              </button>
            )}

            {/* Current Logged-in Doctor badge & Change Password & Logout */}
            {currentDoctor && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                <div 
                  className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded-xl text-xs border border-slate-200 transition-colors"
                  title={`Bác sĩ: ${currentDoctor.name} (Mã BS: ${currentDoctor.id})`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-black ${currentDoctor.avatarColor || 'bg-indigo-600'}`}>
                    {formatDoctorShortName(currentDoctor.name).slice(0, 1)}
                  </div>
                  <div className="flex flex-col text-left leading-tight">
                    <span className="font-black text-slate-800 text-xs truncate max-w-[120px]">
                      BS. {formatDoctorShortName(currentDoctor.name)}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      ID: {currentDoctor.id}
                    </span>
                  </div>
                </div>

                {onOpenChangePassword && (
                  <button
                    type="button"
                    onClick={onOpenChangePassword}
                    className="p-1.5 rounded-xl text-indigo-700 hover:bg-indigo-50 border border-indigo-200 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                    title="Đổi mật khẩu tài khoản"
                  >
                    <span>Đổi mật khẩu</span>
                  </button>
                )}

                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="p-1.5 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                    title="Đăng xuất khỏi hệ thống"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span className="hidden sm:inline text-rose-600">Đăng xuất</span>
                  </button>
                )}
              </div>
            )}

          </div>

        </div>

        {/* View Switcher Navigation Bar */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="inline-flex p-0.5 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold gap-0.5">
            <button
              type="button"
              onClick={() => onViewChange('detailed_list')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'detailed_list'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200/80'
              }`}
            >
              <span>📋 Danh Sách Bệnh Nhân (Chính)</span>
            </button>

            <button
              type="button"
              onClick={() => onViewChange('map')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'map'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200/80'
              }`}
            >
              <span>🏥 Bảng Buồng Phòng</span>
            </button>

            <button
              type="button"
              onClick={() => onViewChange('table')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'table'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200/80'
              }`}
            >
              <span>📊 Bảng Lưới Chi Tiết</span>
            </button>

            <button
              type="button"
              onClick={() => onViewChange('doctors')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'doctors'
                  ? 'bg-indigo-600 text-white shadow-xs font-black'
                  : 'text-indigo-900 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200'
              }`}
            >
              <span>👨‍⚕️ Phân Công Bác Sĩ Điều Trị</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};


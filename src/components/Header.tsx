import React from 'react';
import { 
  Building2, 
  HeartPulse, 
  Wind, 
  UserPlus, 
  Cloud,
  CheckCircle2,
  Printer,
  AlertCircle,
  LogOut,
  Database,
  Settings,
  ShieldCheck,
  KeyRound,
  LayoutGrid,
  MapPin,
  TableProperties,
  UserCheck
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
  const dischargeTomorrowCount = activePatients.filter((p) => p.admissionStatus === 'DISCHARGE_TOMORROW').length;
  
  const o2Count = activePatients.filter((p) => p.tags.includes('O2') || p.tags.includes('O2_CANULA') || p.tags.includes('O2_MASK')).length;
  const vasopressorCount = activePatients.filter((p) => p.tags.includes('VASOPRESSOR')).length;

  return (
    <header className="bg-white border-b border-slate-200 shadow-xs sticky top-0 z-30">
      {/* Top Banner: BV Hùng Vương Gia Lai Branding & Navigation */}
      <div className="bg-gradient-to-r from-[#0b4d8c] via-[#0e599e] to-[#083a69] text-white px-3 sm:px-6 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Brand: Logo & Department Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center text-white shadow-inner shrink-0">
              <Building2 className="w-6 h-6 text-blue-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-blue-100 bg-white/15 px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-white/10">
                  Bệnh Viện Đa Khoa Hùng Vương Gia Lai
                </span>
                
                {/* Real-time Cloud Sync Pill */}
                <button
                  type="button"
                  onClick={onManualPushToCloud}
                  className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-all cursor-pointer ${
                    syncStatus.errorMessage 
                      ? 'bg-rose-500/20 text-rose-200 border-rose-400/40 hover:bg-rose-500/30'
                      : syncStatus.connected 
                      ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30 hover:bg-emerald-500/30'
                      : 'bg-white/10 text-blue-200 border-white/15'
                  }`}
                  title="Bấm để đồng bộ lại dữ liệu lên Cloud Firestore"
                >
                  <Cloud className={`w-3.5 h-3.5 ${syncStatus.errorMessage ? 'text-rose-300' : syncStatus.connected ? 'text-emerald-300' : 'text-blue-300 animate-pulse'}`} />
                  <span>
                    {syncStatus.errorMessage ? 'Lỗi Cloud' : isAutoSyncing ? 'Đang đồng bộ...' : syncStatus.connected ? 'Cloud online' : 'Kết nối...'}
                  </span>
                  {lastAutoSyncTime && (
                    <span className="text-[10px] text-blue-200/80 font-normal">({lastAutoSyncTime})</span>
                  )}
                </button>
              </div>

              <h1 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2 mt-0.5">
                <span>KHOA NỘI TỔNG HỢP - TIM MẠCH</span>
                <span className="text-blue-300 font-normal text-xs sm:text-sm">| Hệ Thống Quản Lý Nội Trú</span>
              </h1>
            </div>
          </div>

          {/* Right Action Area: Satellite Sync, Push Cloud, Doctor Profile & Logout */}
          <div className="flex items-center gap-2">
            {onOpenSatelliteSync && (
              <button
                type="button"
                onClick={onOpenSatelliteSync}
                className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white border border-white/20 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95"
                title="Lấy dữ liệu bệnh nhân từ Cloud Firestore lâm sàng vệ tinh"
              >
                <Database className="w-3.5 h-3.5 text-blue-200" />
                <span>Lấy dữ liệu BN</span>
                {Boolean(pendingSatelliteCount && pendingSatelliteCount > 0) && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] animate-pulse">
                    {pendingSatelliteCount}
                  </span>
                )}
              </button>
            )}

            {onManualPushToCloud && (
              <button
                type="button"
                onClick={onManualPushToCloud}
                className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white border border-white/20 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-xs"
                title="Đẩy toàn bộ dữ liệu nội trú hiện tại lên Cloud Firestore"
              >
                <Cloud className="w-3.5 h-3.5 text-blue-200" />
                <span>Đẩy Cloud</span>
              </button>
            )}

            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="p-1.5 bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-lg transition-all cursor-pointer flex items-center justify-center active:scale-95"
                title="Cài đặt giao diện & kích thước chữ"
              >
                <Settings className="w-4 h-4 text-blue-100" />
              </button>
            )}

            {/* Current Doctor Account Card */}
            {currentDoctor && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-white/20">
                <div 
                  className="flex items-center gap-2 bg-white/15 hover:bg-white/20 px-2.5 py-1 rounded-lg text-xs border border-white/20 transition-colors"
                  title={`Bác sĩ điều trị: ${currentDoctor.name} (Mã: ${currentDoctor.id})`}
                >
                  <div className="w-6 h-6 rounded-full bg-white text-[#0b4d8c] flex items-center justify-center text-xs font-black shadow-xs">
                    {formatDoctorShortName(currentDoctor.name).slice(0, 1)}
                  </div>
                  <div className="text-left">
                    <div className="font-extrabold text-white text-xs leading-none">
                      BS. {formatDoctorShortName(currentDoctor.name)}
                    </div>
                    <div className="text-[10px] text-blue-200 font-medium leading-tight">
                      Mã: {currentDoctor.id}
                    </div>
                  </div>
                </div>

                {onOpenChangePassword && (
                  <button
                    type="button"
                    onClick={onOpenChangePassword}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-blue-100 hover:text-white border border-white/20 transition-all cursor-pointer"
                    title="Đổi mật khẩu tài khoản"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>
                )}

                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-600 text-rose-100 hover:text-white border border-rose-400/30 transition-all cursor-pointer"
                    title="Đăng xuất khỏi hệ thống"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Sub-Header: Live Clinical Counters & Navigation Tabs */}
      <div className="px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 bg-slate-50/90 border-t border-slate-100">
        
        {/* Navigation Tabs */}
        <div className="inline-flex p-1 bg-white rounded-xl border border-slate-200 text-xs font-semibold shadow-2xs gap-1">
          <button
            type="button"
            onClick={() => onViewChange('detailed_list')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeView === 'detailed_list'
                ? 'bg-[#0b4d8c] text-white font-bold shadow-xs'
                : 'text-slate-700 hover:text-[#0b4d8c] hover:bg-blue-50/60'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Danh Sách Bệnh Nhân</span>
          </button>

          <button
            type="button"
            onClick={() => onViewChange('map')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeView === 'map'
                ? 'bg-[#0b4d8c] text-white font-bold shadow-xs'
                : 'text-slate-700 hover:text-[#0b4d8c] hover:bg-blue-50/60'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Bảng Buồng Phòng</span>
          </button>

          <button
            type="button"
            onClick={() => onViewChange('table')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeView === 'table'
                ? 'bg-[#0b4d8c] text-white font-bold shadow-xs'
                : 'text-slate-700 hover:text-[#0b4d8c] hover:bg-blue-50/60'
            }`}
          >
            <TableProperties className="w-3.5 h-3.5" />
            <span>Bảng Lưới Chi Tiết</span>
          </button>

          <button
            type="button"
            onClick={() => onViewChange('doctors')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeView === 'doctors'
                ? 'bg-[#0b4d8c] text-white font-bold shadow-xs'
                : 'text-slate-700 hover:text-[#0b4d8c] hover:bg-blue-50/60'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Phân Công Bác Sĩ</span>
          </button>
        </div>

        {/* Live Clinical Summary Indicators */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          
          {/* Tổng Nội Trú */}
          <div className="bg-white text-slate-800 border border-slate-200 px-3 py-1 rounded-lg font-bold shadow-2xs flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Nội trú:</span>
            <span className="text-[#0b4d8c] text-sm font-black">{activePatients.length}</span>
            <span className="text-slate-500 text-[11px]">BN</span>
          </div>

          {/* Ca Nặng */}
          <div className="bg-rose-50 border border-rose-200 text-rose-800 px-3 py-1 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${criticalCount > 0 ? 'bg-rose-600 animate-ping' : 'bg-rose-400'}`} />
            <span>Nặng:</span>
            <span className="text-rose-700 text-sm font-black">{criticalCount}</span>
          </div>

          {/* Ca Vừa */}
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Vừa:</span>
            <span className="text-amber-800 text-sm font-black">{moderateCount}</span>
          </div>

          {/* Ca Ổn */}
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Ổn:</span>
            <span className="text-emerald-800 text-sm font-black">{stableCount}</span>
          </div>

          {/* Dự RV mai */}
          {dischargeTomorrowCount > 0 && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 px-3 py-1 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>Dự RV mai:</span>
              <span className="text-blue-800 text-sm font-black">{dischargeTomorrowCount}</span>
            </div>
          )}

          {/* Thở Oxy */}
          {o2Count > 0 && (
            <div className="bg-cyan-50 border border-cyan-200 text-cyan-800 px-2.5 py-1 rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1">
              <Wind className="w-3.5 h-3.5 text-cyan-600" />
              <span>Oxy: <strong className="text-cyan-900">{o2Count}</strong></span>
            </div>
          )}

          {/* Vận Mạch */}
          {vasopressorCount > 0 && (
            <div className="bg-pink-50 border border-pink-200 text-pink-800 px-2.5 py-1 rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1">
              <HeartPulse className="w-3.5 h-3.5 text-pink-600 animate-pulse" />
              <span>Vận mạch: <strong className="text-pink-900">{vasopressorCount}</strong></span>
            </div>
          )}

        </div>

      </div>
    </header>
  );
};

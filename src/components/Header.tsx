import React, { useState } from 'react';
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
  UserCheck,
  MoreVertical,
  ChevronDown,
  X,
  User,
  Sparkles
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileMetricsOpen, setIsMobileMetricsOpen] = useState(false);

  const activePatients = patients.filter((p) => p.status === 'ACTIVE');
  const criticalCount = activePatients.filter((p) => p.severity === 'CRITICAL').length;
  const moderateCount = activePatients.filter((p) => p.severity === 'MODERATE').length;
  const stableCount = activePatients.filter((p) => p.severity === 'STABLE').length;
  const dischargeTomorrowCount = activePatients.filter((p) => p.admissionStatus === 'DISCHARGE_TOMORROW').length;
  
  const o2Count = activePatients.filter((p) => p.tags.includes('O2') || p.tags.includes('O2_CANULA') || p.tags.includes('O2_MASK')).length;
  const vasopressorCount = activePatients.filter((p) => p.tags.includes('VASOPRESSOR')).length;

  return (
    <header className="bg-white border-b border-slate-200 shadow-xs sticky top-0 z-30">
      
      {/* ============================================================== */}
      {/* 1. TOP BANNER - DESKTOP LAYOUT (sm: and larger) */}
      {/* ============================================================== */}
      <div className="hidden sm:block bg-gradient-to-r from-[#0b4d8c] via-[#0e599e] to-[#083a69] text-white px-4 sm:px-6 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Brand: Logo & Department Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center text-white shadow-inner shrink-0">
              <Building2 className="w-6 h-6 text-blue-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-blue-100 bg-white/15 px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-white/10">
                  Bệnh Viện Hùng Vương Gia Lai
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

      {/* ============================================================== */}
      {/* 2. TOP BANNER - MOBILE SLIM BAR (< sm: màn hình điện thoại) */}
      {/* ============================================================== */}
      <div className="block sm:hidden bg-gradient-to-r from-[#0b4d8c] via-[#0e599e] to-[#083a69] text-white px-2.5 py-1.5">
        <div className="flex items-center justify-between gap-1.5">
          
          {/* Left: Mini Brand & Cloud Indicator */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center text-white shrink-0">
              <Building2 className="w-4 h-4 text-blue-100" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[8.5px] font-black uppercase text-blue-200 tracking-wider truncate block leading-none">
                  BV Hùng Vương
                </span>
                {/* Cloud indicator dot */}
                <button
                  type="button"
                  onClick={onManualPushToCloud}
                  className="inline-flex items-center gap-0.5 cursor-pointer"
                  title="Trạng thái Cloud"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    syncStatus.errorMessage ? 'bg-rose-400' : syncStatus.connected ? 'bg-emerald-400' : 'bg-blue-300 animate-ping'
                  }`} />
                </button>
              </div>
              <h1 className="text-xs font-black text-white tracking-tight truncate leading-tight">
                Khoa Nội Tổng Hợp
              </h1>
            </div>
          </div>

          {/* Right: Quick Satellite Button + Doctor Menu Trigger */}
          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenSatelliteSync && (
              <button
                type="button"
                onClick={onOpenSatelliteSync}
                className="px-2 py-1 bg-white/15 hover:bg-white/25 active:bg-white/30 text-white border border-white/20 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                title="Lấy dữ liệu BN từ Cloud"
              >
                <Database className="w-3 h-3 text-cyan-200" />
                <span className="text-[10.5px]">Lấy BN</span>
                {Boolean(pendingSatelliteCount && pendingSatelliteCount > 0) && (
                  <span className="px-1 py-0.1 rounded-full bg-amber-400 text-slate-950 font-black text-[9px]">
                    {pendingSatelliteCount}
                  </span>
                )}
              </button>
            )}

            {/* Doctor Profile & Menu Dropdown Button */}
            {currentDoctor && (
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="flex items-center gap-1 bg-white/15 hover:bg-white/25 active:bg-white/30 p-1 pl-1.5 pr-1 rounded-lg border border-white/20 transition-all cursor-pointer"
                title="Tài khoản & Tiện ích"
              >
                <div className="w-5 h-5 rounded-md bg-white text-[#0b4d8c] flex items-center justify-center text-[10px] font-black shadow-xs">
                  {formatDoctorShortName(currentDoctor.name).slice(0, 1)}
                </div>
                <span className="text-[11px] font-extrabold text-white max-w-[65px] truncate">
                  {formatDoctorShortName(currentDoctor.name)}
                </span>
                <ChevronDown className="w-3 h-3 text-blue-200" />
              </button>
            )}
          </div>

        </div>

        {/* MOBILE MENU DROPDOWN / POPOVER SHEET */}
        {isMobileMenuOpen && (
          <>
            <div 
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-40 cursor-pointer"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="absolute top-12 right-2 w-72 bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150 space-y-2">
              {/* Doctor Info Card */}
              {currentDoctor && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#0b4d8c] text-white flex items-center justify-center font-black text-xs">
                      {formatDoctorShortName(currentDoctor.name).slice(0, 1)}
                    </div>
                    <div>
                      <div className="font-black text-xs text-slate-900">
                        BS. {currentDoctor.name}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium font-mono">
                        Mã BS: {currentDoctor.id}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Cloud Sync Status & Action */}
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 font-bold text-slate-700">
                  <Cloud className={`w-3.5 h-3.5 ${syncStatus.connected ? 'text-emerald-600' : 'text-blue-500'}`} />
                  <span>{syncStatus.connected ? 'Cloud online' : 'Đang kết nối Cloud'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (onManualPushToCloud) onManualPushToCloud();
                    setIsMobileMenuOpen(false);
                  }}
                  className="px-2 py-0.5 rounded bg-blue-100 text-[#0b4d8c] font-black text-[10px] hover:bg-blue-200 cursor-pointer"
                >
                  Đồng bộ ngay
                </button>
              </div>

              {/* Action List */}
              <div className="space-y-1 text-xs font-semibold">
                {onOpenSatelliteSync && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenSatelliteSync();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors text-left cursor-pointer"
                  >
                    <Database className="w-4 h-4 text-[#0b4d8c]" />
                    <span>Lấy dữ liệu BN vệ tinh</span>
                    {Boolean(pendingSatelliteCount && pendingSatelliteCount > 0) && (
                      <span className="ml-auto px-1.5 py-0.2 rounded-full bg-rose-600 text-white font-black text-[10px]">
                        {pendingSatelliteCount}
                      </span>
                    )}
                  </button>
                )}

                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenSettings();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors text-left cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-slate-600" />
                    <span>Cài đặt giao diện & cỡ chữ</span>
                  </button>
                )}

                {onOpenChangePassword && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChangePassword();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors text-left cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4 text-slate-600" />
                    <span>Đổi mật khẩu tài khoản</span>
                  </button>
                )}

                {onLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      onLogout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-rose-50 text-rose-700 font-bold transition-colors text-left pt-2 border-t border-slate-100 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-rose-600" />
                    <span>Đăng xuất khỏi hệ thống</span>
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ============================================================== */}
      {/* 3. SUB-HEADER: TABS & LIVE METRICS (MENU THÔNG MINH, KHÔNG CUỘN) */}
      {/* ============================================================== */}
      <div className="px-2.5 sm:px-6 py-1.5 sm:py-2 bg-slate-50/95 border-t border-slate-100">
        
        {/* DESKTOP VIEW: TABS & FULL METRICS */}
        <div className="hidden sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
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

          {/* Desktop Live Clinical Indicators */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <div className="bg-white text-slate-800 border border-slate-200 px-3 py-1 rounded-lg font-bold shadow-2xs flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Nội trú:</span>
              <span className="text-[#0b4d8c] text-sm font-black">{activePatients.length}</span>
              <span className="text-slate-500 text-[11px]">BN</span>
            </div>

            <div className="bg-rose-50 border border-rose-200 text-rose-800 px-3 py-1 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${criticalCount > 0 ? 'bg-rose-600 animate-ping' : 'bg-rose-400'}`} />
              <span>Nặng:</span>
              <span className="text-rose-700 text-sm font-black">{criticalCount}</span>
            </div>

            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>Vừa:</span>
              <span className="text-amber-800 text-sm font-black">{moderateCount}</span>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Ổn:</span>
              <span className="text-emerald-800 text-sm font-black">{stableCount}</span>
            </div>

            {dischargeTomorrowCount > 0 && (
              <div className="bg-blue-50 border border-blue-200 text-blue-800 px-3 py-1 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span>Dự RV mai:</span>
                <span className="text-blue-800 text-sm font-black">{dischargeTomorrowCount}</span>
              </div>
            )}

            {o2Count > 0 && (
              <div className="bg-cyan-50 border border-cyan-200 text-cyan-800 px-2.5 py-1 rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1">
                <Wind className="w-3.5 h-3.5 text-cyan-600" />
                <span>Oxy: <strong className="text-cyan-900">{o2Count}</strong></span>
              </div>
            )}

            {vasopressorCount > 0 && (
              <div className="bg-pink-50 border border-pink-200 text-pink-800 px-2.5 py-1 rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1">
                <HeartPulse className="w-3.5 h-3.5 text-pink-600 animate-pulse" />
                <span>Vận mạch: <strong className="text-pink-900">{vasopressorCount}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* MOBILE VIEW: MENU THÔNG MINH, KHÔNG CẦN DÒNG CUỘN (TẤT CẢ VỪA VẶN TRONG 1 HÀNG) */}
        <div className="flex sm:hidden items-center justify-between gap-1.5">
          {/* Segmented Mini Tabs */}
          <div className="inline-flex p-0.5 bg-white rounded-lg border border-slate-200 text-[11px] font-bold shadow-2xs shrink-0">
            <button
              type="button"
              onClick={() => onViewChange('detailed_list')}
              className={`px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                activeView === 'detailed_list'
                  ? 'bg-[#0b4d8c] text-white font-black shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3 h-3" />
              <span>Bệnh Nhân</span>
            </button>

            <button
              type="button"
              onClick={() => onViewChange('doctors')}
              className={`px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                activeView === 'doctors'
                  ? 'bg-[#0b4d8c] text-white font-black shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-3 h-3" />
              <span>Bác Sĩ</span>
            </button>
          </div>

          {/* Smart Metrics Pill on Mobile: Không cuộn, bấm vào xem chi tiết toàn bộ trong popup */}
          <button
            type="button"
            onClick={() => setIsMobileMetricsOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 text-[10.5px] font-bold shadow-2xs hover:bg-slate-50 transition-all cursor-pointer shrink-0"
            title="Bấm để xem chi tiết thống kê lâm sàng toàn khoa"
          >
            <span className="font-black text-[#0b4d8c]">{activePatients.length} BN</span>
            {criticalCount > 0 && (
              <span className="text-rose-600 font-black">• {criticalCount} nặng</span>
            )}
            {moderateCount > 0 && (
              <span className="text-amber-600 font-black">• {moderateCount} vừa</span>
            )}
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
        </div>

        {/* MOBILE METRICS DETAIL MODAL POPOVER */}
        {isMobileMetricsOpen && (
          <>
            <div 
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-40 cursor-pointer"
              onClick={() => setIsMobileMetricsOpen(false)}
            />
            <div className="fixed top-24 left-4 right-4 bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-3 max-w-sm mx-auto">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
                    <HeartPulse className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-black text-xs uppercase tracking-tight text-slate-900">
                      Thống Kê Lâm Sàng Toàn Khoa
                    </h4>
                    <p className="text-[10px] text-slate-500">Khoa Nội Tổng Hợp - BV Hùng Vương</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMetricsOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Grid 6 metric cards */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10.5px] font-bold text-slate-500 block">Nội trú</span>
                  <span className="text-base font-black text-[#0b4d8c] font-mono">{activePatients.length} <span className="text-[10px] text-slate-500 font-sans font-medium">BN</span></span>
                </div>

                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                  <span className="text-[10.5px] font-bold text-rose-700 block">Ca Nặng</span>
                  <span className="text-base font-black text-rose-700 font-mono">{criticalCount} <span className="text-[10px] text-rose-500 font-sans font-medium">BN</span></span>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-[10.5px] font-bold text-amber-800 block">Ca Vừa</span>
                  <span className="text-base font-black text-amber-800 font-mono">{moderateCount} <span className="text-[10px] text-amber-600 font-sans font-medium">BN</span></span>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10.5px] font-bold text-emerald-800 block">Ca Ổn</span>
                  <span className="text-base font-black text-emerald-800 font-mono">{stableCount} <span className="text-[10px] text-emerald-600 font-sans font-medium">BN</span></span>
                </div>

                <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-200">
                  <span className="text-[10.5px] font-bold text-cyan-800 block">Thở Oxy</span>
                  <span className="text-base font-black text-cyan-800 font-mono">{o2Count} <span className="text-[10px] text-cyan-600 font-sans font-medium">BN</span></span>
                </div>

                <div className="p-2.5 rounded-xl bg-pink-50 border border-pink-200">
                  <span className="text-[10.5px] font-bold text-pink-800 block">Vận Mạch</span>
                  <span className="text-base font-black text-pink-800 font-mono">{vasopressorCount} <span className="text-[10px] text-pink-600 font-sans font-medium">BN</span></span>
                </div>
              </div>

              {dischargeTomorrowCount > 0 && (
                <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[11px] font-bold flex items-center justify-between">
                  <span>Dự kiến ra viện vào ngày mai:</span>
                  <span className="font-mono font-black text-blue-800">{dischargeTomorrowCount} BN</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsMobileMetricsOpen(false)}
                className="w-full py-2 bg-[#0b4d8c] hover:bg-[#083a69] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </>
        )}

      </div>

    </header>
  );
};

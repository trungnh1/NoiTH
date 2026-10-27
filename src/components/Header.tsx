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
  AlertCircle
} from 'lucide-react';
import { Patient } from '../types/patient';
import { SyncStatus } from '../services/firebaseSync';

interface HeaderProps {
  patients: Patient[];
  activeView: 'map' | 'table' | 'doctors';
  onViewChange: (view: 'map' | 'table' | 'doctors') => void;
  onOpenNewPatient: () => void;
  onOpenHandover?: () => void;
  onOpenWatchlist?: () => void;
  onOpenPrintModal?: () => void;
  onManualPushToCloud?: () => void;
  onResetData?: () => void;
  onOpenDutySchedule?: () => void;
  syncStatus: SyncStatus;
}

export const Header: React.FC<HeaderProps> = ({
  patients,
  onOpenNewPatient,
  onOpenPrintModal,
  onManualPushToCloud,
  onResetData,
  syncStatus,
}) => {
  const activePatients = patients.filter((p) => p.status === 'ACTIVE');
  const criticalCount = activePatients.filter((p) => p.severity === 'CRITICAL').length;
  const moderateCount = activePatients.filter((p) => p.severity === 'MODERATE').length;
  const stableCount = activePatients.filter((p) => p.severity === 'STABLE').length;
  
  const o2Count = activePatients.filter((p) => p.tags.includes('O2') || p.tags.includes('O2_CANULA') || p.tags.includes('O2_MASK')).length;
  const vasopressorCount = activePatients.filter((p) => p.tags.includes('VASOPRESSOR')).length;

  return (
    <header className="bg-white border-b border-slate-200/90 shadow-2xs sticky top-0 z-30">
      <div className="w-full px-3 sm:px-6 py-2.5">
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
                <div className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                  syncStatus.errorMessage 
                    ? 'bg-rose-50 text-rose-800 border-rose-300'
                    : syncStatus.connected 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}>
                  <Cloud className={`w-3 h-3 ${syncStatus.errorMessage ? 'text-rose-600' : syncStatus.connected ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span>
                    {syncStatus.errorMessage ? 'Lỗi Cloud' : syncStatus.connected ? 'Cloud trực tuyến' : 'Đang kết nối Cloud...'}
                  </span>
                </div>
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
            <button
              type="button"
              onClick={onResetData}
              className="px-2 py-1 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-700 text-[10px] font-black rounded-lg transition-all"
              title="CẢNH BÁO: Xóa sạch dữ liệu bệnh nhân"
            >
              Xóa sạch dữ liệu
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};


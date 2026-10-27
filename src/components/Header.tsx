import { 
  Building2, 
  AlertOctagon, 
  HeartPulse, 
  Wind, 
  Eye, 
  UserPlus, 
  FileText, 
  LayoutGrid, 
  ListFilter, 
  Users, 
  ShieldAlert,
  RotateCcw,
  Cloud,
  Clock,
  CheckCircle
} from 'lucide-react';
import { Patient } from '../types/patient';

interface HeaderProps {
  patients: Patient[];
  activeView: 'map' | 'table' | 'doctors';
  onViewChange: (view: 'map' | 'table' | 'doctors') => void;
  onOpenNewPatient: () => void;
  onOpenHandover: () => void;
  onOpenWatchlist: () => void;
  onOpenCloudSync: () => void;
  onResetData: () => void;
  onOpenDutySchedule?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  patients,
  activeView,
  onViewChange,
  onOpenNewPatient,
  onOpenHandover,
  onOpenWatchlist,
  onOpenCloudSync,
  onResetData,
  onOpenDutySchedule,
}) => {
  const activePatients = patients.filter((p) => p.status === 'ACTIVE');
  const criticalCount = activePatients.filter((p) => p.severity === 'CRITICAL').length;
  const moderateCount = activePatients.filter((p) => p.severity === 'MODERATE').length;
  const stableCount = activePatients.filter((p) => p.severity === 'STABLE').length;
  
  const o2Count = activePatients.filter((p) => p.tags.includes('O2') || p.tags.includes('O2_CANULA') || p.tags.includes('O2_MASK')).length;
  const vasopressorCount = activePatients.filter((p) => p.tags.includes('VASOPRESSOR')).length;
  const monitoringCount = activePatients.filter((p) => p.tags.includes('CLOSE_MONITORING')).length;

  return (
    <header className="bg-white border-b border-slate-200 shadow-2xs sticky top-0 z-30">
      <div className="w-full px-3 sm:px-5 py-1.5">
        {/* Row 1: Hospital Brand + Action Buttons (Compact Height) */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Logo & Department Branding + Lịch Trực Hôm Nay đưa lên gần với BV HÙNG VƯƠNG GIA LAI */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 flex items-center justify-center text-white shadow-xs shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                BV HÙNG VƯƠNG GIA LAI
              </span>
              <h1 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
                Khoa Nội Tổng Hợp - Tim Mạch
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Trực tuyến 24/7
                </span>
              </h1>

              {/* Lịch Trực Hôm Nay: 20/07 (Thứ Hai) Đồng bộ 06:00 • 06:00 AM hôm nay (Tự động) */}
              <button
                type="button"
                onClick={onOpenDutySchedule}
                className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-1 rounded-lg border border-slate-700 shadow-2xs text-xs transition-all cursor-pointer hover:border-indigo-400 shrink-0"
                title="Nhấp để xem bảng lịch trực chi tiết"
              >
                <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-wide text-indigo-300">
                  Lịch Trực Hôm Nay:
                </span>
                <span className="font-extrabold text-white text-xs">
                  20/07 (Thứ Hai)
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <CheckCircle className="w-2.5 h-2.5 text-emerald-400" />
                  <span>Đồng bộ 06:00</span>
                </span>
                <span className="text-[10px] text-slate-400 hidden xl:inline">
                  • 06:00 AM hôm nay (Tự động)
                </span>
              </button>
            </div>
          </div>

          {/* Action Buttons - Compact */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={onOpenWatchlist}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                criticalCount > 0
                  ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100 animate-pulse'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
              title="Danh sách bệnh nhân nặng & cảnh báo đỏ toàn khoa"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              <span>Cảnh Báo Đỏ ({criticalCount})</span>
            </button>

            <button
              onClick={onOpenHandover}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>Giao Ban AI</span>
            </button>

            <button
              onClick={onOpenCloudSync}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-100 transition-colors shadow-2xs"
              title="Quản lý đồng bộ Cloud Firestore (iron-foundation-kbcxw) & Hướng dẫn Vercel"
            >
              <Cloud className="w-3.5 h-3.5 text-blue-600" />
              <span>Cloud Firestore</span>
            </button>

            <button
              onClick={onOpenNewPatient}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-all shadow-xs shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Tiếp Nhận BN</span>
            </button>

            <button
              onClick={() => {
                if (window.confirm('Khôi phục toàn bộ danh sách bệnh nhân và phân công về dữ liệu gốc ban đầu?')) {
                  onResetData();
                }
              }}
              title="Khôi phục dữ liệu mẫu ban đầu"
              className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Row 2: View Switcher Tabs + Inline Compact KPI Counters (Combined on One Line) */}
        <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          {/* View mode navigation tabs */}
          <div className="flex items-center gap-2">
            <div className="inline-flex p-0.5 bg-slate-100 rounded-lg gap-0.5">
              <button
                onClick={() => onViewChange('map')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  activeView === 'map'
                    ? 'bg-white text-rose-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3 h-3" />
                <span>Sơ Đồ Buồng Giường Bệnh</span>
              </button>

              <button
                onClick={() => onViewChange('table')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  activeView === 'table'
                    ? 'bg-white text-rose-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ListFilter className="w-3 h-3" />
                <span>Danh Sách Chi Tiết ({activePatients.length})</span>
              </button>

              <button
                onClick={() => onViewChange('doctors')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  activeView === 'doctors'
                    ? 'bg-white text-rose-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3 h-3" />
                <span>Phân Công Bác Sĩ Điều Trị</span>
              </button>
            </div>

            {/* Severity Legend */}
            <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-500 pl-1 border-l border-slate-200">
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Đỏ: Nặng</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Vàng: TB</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Xanh: Ổn</span>
            </div>
          </div>

          {/* Compact Department KPI Counters (Inline Chips) */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            {/* Total */}
            <div className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 text-[11px] border border-slate-200">
              <span className="text-slate-500 font-medium">Tổng nội trú:</span>
              <span>{activePatients.length} BN</span>
            </div>

            {/* Critical */}
            <div className={`px-2 py-0.5 rounded-md font-bold flex items-center gap-1 text-[11px] border ${
              criticalCount > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
              <span>Nặng: <strong>{criticalCount}</strong></span>
            </div>

            {/* Moderate */}
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>Trung bình: <strong>{moderateCount}</strong></span>
            </div>

            {/* Stable */}
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Ổn định: <strong>{stableCount}</strong></span>
            </div>

            {/* O2 */}
            <div className="bg-cyan-50 border border-cyan-200 text-cyan-800 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 text-[11px]">
              <Wind className="w-3 h-3 text-cyan-600" />
              <span>Thở Oxy: <strong>{o2Count}</strong></span>
            </div>

            {/* Vasopressor */}
            <div className="bg-rose-50 border border-rose-200 text-rose-800 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 text-[11px]">
              <HeartPulse className="w-3 h-3 text-rose-600" />
              <span>Vận mạch: <strong>{vasopressorCount}</strong></span>
            </div>

            {/* Close monitoring */}
            <div className="bg-purple-50 border border-purple-200 text-purple-800 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 text-[11px]">
              <Eye className="w-3 h-3 text-purple-600" />
              <span>Theo dõi sát: <strong>{monitoringCount}</strong></span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

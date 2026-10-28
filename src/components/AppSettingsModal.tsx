import React from 'react';
import { 
  X, 
  Settings, 
  Sun, 
  Moon, 
  Type, 
  Palette, 
  Check, 
  RotateCcw,
  Sparkles,
  FileSpreadsheet
} from 'lucide-react';
import { AppSettings, DEFAULT_SETTINGS } from '../utils/settings';

interface AppSettingsModalProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onOpenExcelImport?: () => void;
  onClose: () => void;
}

export const AppSettingsModal: React.FC<AppSettingsModalProps> = ({
  settings,
  onUpdateSettings,
  onOpenExcelImport,
  onClose,
}) => {
  const handleReset = () => {
    onUpdateSettings(DEFAULT_SETTINGS);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className={`w-full max-w-lg rounded-2xl shadow-2xl border overflow-hidden transition-all duration-200 ${
        settings.themeMode === 'dark' 
          ? 'bg-slate-900 border-slate-800 text-slate-100' 
          : 'bg-white border-slate-200 text-slate-900'
      }`}>
        
        {/* Header */}
        <div className={`px-5 py-4 flex items-center justify-between border-b ${
          settings.themeMode === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-900 text-white border-slate-800'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-500/30">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight uppercase">
                Cài Đặt Giao Diện & Font Chữ
              </h3>
              <p className="text-xs text-slate-400">
                Tùy chỉnh giao diện theo thói quen thao tác
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Đóng (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-6">
          
          {/* 1. Kích Thước Font Chữ (Font Size) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <Type className="w-4 h-4 text-rose-500" />
                <span>Kích Thước Chữ (Font Size)</span>
              </label>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                {settings.fontSize === 'small' && 'Nhỏ (92%)'}
                {settings.fontSize === 'normal' && 'Vừa (100% - Tiêu chuẩn)'}
                {settings.fontSize === 'large' && 'Lớn (108%)'}
                {settings.fontSize === 'xlarge' && 'Rất Lớn (116%)'}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'small', label: 'Nhỏ', sample: 'A' },
                { id: 'normal', label: 'Vừa', sample: 'A' },
                { id: 'large', label: 'Lớn', sample: 'A' },
                { id: 'xlarge', label: 'Rất lớn', sample: 'A' },
              ].map((item) => {
                const isSelected = settings.fontSize === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, fontSize: item.id as any })}
                    className={`py-2.5 px-2 rounded-xl border font-bold text-xs flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-rose-600 text-white border-rose-600 shadow-md font-black'
                        : settings.themeMode === 'dark'
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span className={`font-black ${
                      item.id === 'small' ? 'text-xs' : item.id === 'normal' ? 'text-sm' : item.id === 'large' ? 'text-base' : 'text-lg'
                    }`}>
                      {item.sample}
                    </span>
                    <span className="text-[10.5px]">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Chế Độ Giao Diện (Theme Mode: Sáng / Tối) */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <Sun className="w-4 h-4 text-amber-500" />
              <span>Chế Độ Giao Diện (Theme)</span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onUpdateSettings({ ...settings, themeMode: 'light' })}
                className={`p-3.5 rounded-xl border font-bold text-xs flex items-center justify-between transition-all cursor-pointer ${
                  settings.themeMode === 'light'
                    ? 'bg-rose-50 text-rose-900 border-rose-500 ring-2 ring-rose-400 font-black shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                    <Sun className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-extrabold text-xs">Giao Diện Sáng</div>
                    <div className="text-[10px] text-slate-500 font-normal">Dễ nhìn ban ngày</div>
                  </div>
                </div>
                {settings.themeMode === 'light' && <Check className="w-4 h-4 text-rose-600" />}
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ ...settings, themeMode: 'dark' })}
                className={`p-3.5 rounded-xl border font-bold text-xs flex items-center justify-between transition-all cursor-pointer ${
                  settings.themeMode === 'dark'
                    ? 'bg-slate-800 text-rose-400 border-rose-500 ring-2 ring-rose-500/50 font-black shadow-xs'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-900/60 text-indigo-300 flex items-center justify-center">
                    <Moon className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-extrabold text-xs">Giao Diện Tối</div>
                    <div className="text-[10px] text-slate-400 font-normal">Đêm / Trực ca</div>
                  </div>
                </div>
                {settings.themeMode === 'dark' && <Check className="w-4 h-4 text-rose-400" />}
              </button>
            </div>
          </div>

          {/* 3. Màu Chủ Đạo (Color Theme) */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <Palette className="w-4 h-4 text-indigo-500" />
              <span>Màu Sắc Chủ Đạo (Primary Color)</span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'rose', name: 'Đỏ Hùng Vương', colorClass: 'bg-rose-600' },
                { id: 'indigo', name: 'Xanh Indigo', colorClass: 'bg-indigo-600' },
                { id: 'emerald', name: 'Xanh Emerald', colorClass: 'bg-emerald-600' },
                { id: 'slate', name: 'Xanh Hải Quân', colorClass: 'bg-slate-800' },
              ].map((theme) => {
                const isSelected = settings.colorTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, colorTheme: theme.id as any })}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-rose-500 ring-2 ring-rose-400 shadow-xs font-black'
                        : settings.themeMode === 'dark'
                        ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full ${theme.colorClass} shrink-0`} />
                    <span className="truncate text-[11px]">{theme.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Nhập Dữ Liệu Từ File Excel */}
          {onOpenExcelImport && (
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
              <label className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Nhập Dữ Liệu Excel / CSV</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenExcelImport();
                }}
                className="w-full p-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Tải Lên File Excel Để Ghép Nối Dữ Liệu Vệ Tinh</span>
              </button>
            </div>
          )}

          {/* Preview box */}
          <div className={`p-3 rounded-xl border text-xs space-y-1 ${
            settings.themeMode === 'dark' ? 'bg-slate-800/80 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            <div className="font-bold flex items-center gap-1.5 text-rose-500">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Xem trước cài đặt giao diện:</span>
            </div>
            <p className="leading-relaxed">
              Bệnh nhân nội trú: <strong className="font-black text-rose-600">NGUYỄN VĂN A</strong> • Phòng 703 - Giường 01 • Sinh hiệu ổn định.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className={`px-5 py-3.5 flex items-center justify-between border-t ${
          settings.themeMode === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Khôi phục về cài đặt mặc định ban đầu"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Đặt Mặc Định</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition-all shadow-md cursor-pointer"
          >
            Lưu & Hoàn Tất
          </button>
        </div>

      </div>
    </div>
  );
};

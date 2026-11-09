import React, { useState } from 'react';
import { 
  X, 
  Settings, 
  Sun, 
  Moon, 
  Eye,
  Type, 
  Palette, 
  Check, 
  RotateCcw,
  Sparkles,
  FileSpreadsheet,
  LayoutGrid,
  TableProperties,
  Volume2,
  VolumeX,
  Clock,
  Printer,
  Activity,
  Sliders,
  CheckCircle2,
  CheckSquare,
  Square
} from 'lucide-react';
import { AppSettings, DEFAULT_SETTINGS, FONT_FAMILY_MAP } from '../utils/settings';

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
  const [activeTab, setActiveTab] = useState<'appearance' | 'clinical' | 'system'>('appearance');

  const handleReset = () => {
    onUpdateSettings(DEFAULT_SETTINGS);
  };

  const isDark = settings.themeMode === 'dark';
  const isEyeCare = settings.themeMode === 'eye-care';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
      <div 
        className={`w-full max-w-2xl rounded-2xl shadow-2xl border overflow-hidden transition-all duration-200 flex flex-col max-h-[92vh] ${
          isDark 
            ? 'bg-slate-900 border-slate-800 text-slate-100' 
            : isEyeCare
            ? 'bg-[#fbf8f1] border-[#e6dece] text-[#2c2825]'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
        style={{ fontFamily: FONT_FAMILY_MAP[settings.fontFamily || 'plus-jakarta'] }}
      >
        
        {/* Header */}
        <div className={`px-5 py-3.5 flex items-center justify-between border-b shrink-0 ${
          isDark 
            ? 'bg-slate-950 border-slate-800 text-white' 
            : isEyeCare
            ? 'bg-[#f4efe4] border-[#e2d8c3] text-[#2c2825]'
            : 'bg-slate-900 text-white border-slate-800'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight uppercase flex items-center gap-2">
                <span>Cài Đặt Giao Diện & Hệ Thống</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Khoa Nội TH
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Tùy chỉnh font chữ, màu sắc, mật độ dòng và hiển thị lâm sàng
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

        {/* Tab Navigation */}
        <div className={`flex items-center border-b px-5 pt-2 gap-2 text-xs font-bold shrink-0 ${
          isDark 
            ? 'bg-slate-950/70 border-slate-800' 
            : isEyeCare
            ? 'bg-[#f0e9dc] border-[#e0d6c1]'
            : 'bg-slate-50 border-slate-200'
        }`}>
          <button
            type="button"
            onClick={() => setActiveTab('appearance')}
            className={`pb-2.5 px-3 border-b-2 font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'appearance'
                ? 'border-[#0b4d8c] text-[#0b4d8c] dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>1. Font Chữ & Màu Sắc</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('clinical')}
            className={`pb-2.5 px-3 border-b-2 font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'clinical'
                ? 'border-[#0b4d8c] text-[#0b4d8c] dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>2. Mật Độ & Cột Lâm Sàng</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('system')}
            className={`pb-2.5 px-3 border-b-2 font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'system'
                ? 'border-[#0b4d8c] text-[#0b4d8c] dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>3. Hệ Thống & In Ấn</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-6">
          
          {/* TAB 1: GIAO DIỆN & FONT CHỮ */}
          {activeTab === 'appearance' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* 1. Kiểu Font Chữ (Font Family) */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <Type className="w-4 h-4 text-blue-600" />
                  <span>Kiểu Font Chữ Hệ Thống (Font Family)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'plus-jakarta', name: 'Plus Jakarta Sans', desc: 'Hiện đại, tiêu chuẩn BV' },
                    { id: 'inter', name: 'Inter / System', desc: 'Rõ nét, chuẩn màn hình' },
                    { id: 'roboto', name: 'Roboto / Segoe UI', desc: 'Dễ đọc tên & số liệu' },
                    { id: 'mono', name: 'JetBrains Mono', desc: 'Font kỹ thuật, thẳng cột' },
                    { id: 'serif', name: 'Merriweather Serif', desc: 'Kiểu chữ y khoa cổ điển' },
                  ].map((font) => {
                    const isSelected = (settings.fontFamily || 'plus-jakarta') === font.id;
                    return (
                      <button
                        key={font.id}
                        type="button"
                        onClick={() => onUpdateSettings({ ...settings, fontFamily: font.id as any })}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#0b4d8c] bg-blue-50/70 text-[#0b4d8c] dark:bg-blue-950/50 dark:border-blue-400 dark:text-blue-300 ring-2 ring-blue-400/50 font-black'
                            : isDark
                            ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-200'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                        style={{ fontFamily: FONT_FAMILY_MAP[font.id as any] }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold">{font.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-normal">
                          {font.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Kích Thước Chữ (Font Size Scale) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <Type className="w-4 h-4 text-emerald-600" />
                    <span>Cỡ Chữ Toàn Hệ Thống (Font Size)</span>
                  </label>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {settings.fontSize === 'compact' && 'Siêu gọn (92%)'}
                    {settings.fontSize === 'small' && 'Nhỏ gọn (96%)'}
                    {settings.fontSize === 'normal' && 'Tiêu chuẩn (104%)'}
                    {settings.fontSize === 'large' && 'Lớn dễ đọc (116%)'}
                    {settings.fontSize === 'xlarge' && 'Rất lớn (128%)'}
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {[
                    { id: 'compact', label: 'Siêu Gọn', pct: '92%' },
                    { id: 'small', label: 'Gọn', pct: '96%' },
                    { id: 'normal', label: 'Chuẩn', pct: '104%' },
                    { id: 'large', label: 'Lớn', pct: '116%' },
                    { id: 'xlarge', label: 'Rất Lớn', pct: '128%' },
                  ].map((item) => {
                    const isSelected = settings.fontSize === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onUpdateSettings({ ...settings, fontSize: item.id as any })}
                        className={`py-2 px-1 rounded-xl border font-bold text-xs flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#0b4d8c] text-white border-[#0b4d8c] shadow-md font-black'
                            : isDark
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span className="font-black text-sm">A</span>
                        <span className="text-[10px]">{item.label}</span>
                        <span className="text-[9px] opacity-70 font-mono">{item.pct}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Chế Độ Giao Diện (Theme Mode: Sáng / Tối / Chống Mỏi Mắt) */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span>Chế Độ Ánh Sáng & Bảo Vệ Mắt (Theme)</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, themeMode: 'light' })}
                    className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-between transition-all cursor-pointer ${
                      settings.themeMode === 'light'
                        ? 'bg-blue-50/80 text-blue-900 border-[#0b4d8c] ring-2 ring-blue-400 font-black shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                        <Sun className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className="font-extrabold text-xs">Giao Diện Sáng</div>
                        <div className="text-[10px] text-slate-500 font-normal">Ban ngày, rõ ràng</div>
                      </div>
                    </div>
                    {settings.themeMode === 'light' && <Check className="w-4 h-4 text-[#0b4d8c]" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, themeMode: 'dark' })}
                    className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-between transition-all cursor-pointer ${
                      settings.themeMode === 'dark'
                        ? 'bg-slate-800 text-blue-400 border-blue-400 ring-2 ring-blue-500/50 font-black shadow-xs'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-900/60 text-indigo-300 flex items-center justify-center shrink-0">
                        <Moon className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className="font-extrabold text-xs">Giao Diện Tối</div>
                        <div className="text-[10px] text-slate-400 font-normal">Đêm / Trực ca</div>
                      </div>
                    </div>
                    {settings.themeMode === 'dark' && <Check className="w-4 h-4 text-blue-400" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, themeMode: 'eye-care' })}
                    className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-between transition-all cursor-pointer ${
                      settings.themeMode === 'eye-care'
                        ? 'bg-[#f4ebd9] text-[#5c4015] border-[#bda069] ring-2 ring-[#cbb483] font-black shadow-xs'
                        : 'bg-[#faf6ee] hover:bg-[#f4efe4] text-[#4a4237] border-[#ded4be]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-[#ebd9b8] text-[#7d581c] flex items-center justify-center shrink-0">
                        <Eye className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className="font-extrabold text-xs">Bảo Vệ Mắt</div>
                        <div className="text-[10px] text-[#7a6d59] font-normal">Ấm dịu, chống mỏi</div>
                      </div>
                    </div>
                    {settings.themeMode === 'eye-care' && <Check className="w-4 h-4 text-[#7d581c]" />}
                  </button>
                </div>
              </div>

              {/* 4. Màu Sắc Nhận Diện Chủ Đạo (Color Theme) */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <Palette className="w-4 h-4 text-indigo-500" />
                  <span>Màu Nhận Diện Chủ Đạo</span>
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'blue', name: 'Xanh Hùng Vương', colorClass: 'bg-[#0b4d8c]' },
                    { id: 'rose', name: 'Đỏ Hồng Y Tế', colorClass: 'bg-rose-600' },
                    { id: 'emerald', name: 'Xanh Lâm Sàng', colorClass: 'bg-emerald-600' },
                    { id: 'indigo', name: 'Xanh Hiện Đại', colorClass: 'bg-indigo-600' },
                    { id: 'slate', name: 'Xám Tối Giản', colorClass: 'bg-slate-700' },
                  ].map((theme) => {
                    const isSelected = (settings.colorTheme || 'blue') === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => onUpdateSettings({ ...settings, colorTheme: theme.id as any })}
                        className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-blue-600 ring-2 ring-blue-400 shadow-xs font-black'
                            : isDark
                            ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded-full ${theme.colorClass} shrink-0`} />
                        <span className="truncate text-[10.5px]">{theme.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MẬT ĐỘ & CỘT LÂM SÀNG */}
          {activeTab === 'clinical' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* 1. Mật Độ Dòng Bảng Hàng Ngang */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <TableProperties className="w-4 h-4 text-blue-600" />
                  <span>Khoảng Cách & Mật Độ Hiển Thị Bảng (Density)</span>
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'compact', title: 'Siêu Cô Đọng', desc: 'Sát nhau tối đa, xem nhiều BN cùng lúc' },
                    { id: 'normal', title: 'Tiêu Chuẩn', desc: 'Khoảng cách vừa vặn, chuẩn lâm sàng' },
                    { id: 'spacious', title: 'Thoáng Đãng', desc: 'Rộng rãi, dễ nhìn từng dòng' },
                  ].map((item) => {
                    const isSelected = (settings.tableDensity || 'compact') === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onUpdateSettings({ ...settings, tableDensity: item.id as any })}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/70 border-[#0b4d8c] text-[#0b4d8c] ring-2 ring-blue-400/50 font-black dark:bg-blue-950/40 dark:border-blue-400 dark:text-blue-300'
                            : isDark
                            ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black">{item.title}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                        </div>
                        <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-1 font-normal leading-tight">
                          {item.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Tùy Chọn Bật / Tắt Các Thành Phần Dữ Liệu Lâm Sàng */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <Activity className="w-4 h-4 text-rose-500" />
                  <span>Tùy Chọn Ẩn / Hiện Dữ Liệu Trong Bảng Hàng Ngang</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { key: 'showVitalSigns', label: 'Sinh hiệu nhanh (HA, Mạch, SpO2, T°)', desc: 'Hiển thị các chỉ số sinh hiệu gần nhất' },
                    { key: 'showClinicalEvolution', label: 'Diễn tiến lâm sàng mới nhất', desc: 'Hiển thị ghi nhận diễn biến ca trực' },
                    { key: 'showTreatmentPlan', label: 'Hướng xử trí / Y lệnh điều trị', desc: 'Kế hoạch điều trị và thuốc phụ trách' },
                    { key: 'showHandoverNotes', label: 'Ghi chú BS & Bàn giao ca trực', desc: 'Các lưu ý đặc biệt giữa các ca' },
                    { key: 'showNewPatientBadge', label: 'Nhãn NEW nhấp nháy cho BN mới', desc: 'Bệnh nhân nhập viện trong 24 giờ qua' },
                  ].map((field) => {
                    const isChecked = (settings as any)[field.key] !== false;
                    return (
                      <div
                        key={field.key}
                        onClick={() => onUpdateSettings({ ...settings, [field.key]: !isChecked })}
                        className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-colors ${
                          isChecked
                            ? isDark
                              ? 'bg-slate-800/80 border-slate-700 text-slate-200'
                              : 'bg-white border-slate-200 text-slate-800 shadow-2xs'
                            : isDark
                            ? 'bg-slate-900/60 border-slate-800 text-slate-500'
                            : 'bg-slate-50/70 border-slate-200 text-slate-400'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400">
                          {isChecked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-400" />}
                        </div>
                        <div className="text-left select-none">
                          <div className={`text-xs font-bold ${isChecked ? 'text-slate-900 dark:text-white' : 'text-slate-400 line-through'}`}>
                            {field.label}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {field.desc}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: HỆ THỐNG & IN ẤN */}
          {activeTab === 'system' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* 1. Tự Động Đồng Bộ / Cập Nhật Dữ Liệu */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>Tự Động Làm Mới / Cập Nhật Dữ Liệu</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { sec: 0, label: 'Tắt' },
                    { sec: 60, label: 'Mỗi 1 phút' },
                    { sec: 120, label: 'Mỗi 2 phút' },
                    { sec: 300, label: 'Mỗi 5 phút' },
                  ].map((item) => {
                    const isSelected = (settings.autoRefreshInterval || 0) === item.sec;
                    return (
                      <button
                        key={item.sec}
                        type="button"
                        onClick={() => onUpdateSettings({ ...settings, autoRefreshInterval: item.sec })}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer font-bold text-xs ${
                          isSelected
                            ? 'bg-[#0b4d8c] text-white border-[#0b4d8c] shadow-md font-black'
                            : isDark
                            ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                      >
                        <div>{item.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Chuông Âm Thanh Cảnh Báo Lâm Sàng */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <Volume2 className="w-4 h-4 text-amber-500" />
                  <span>Âm Thanh Cảnh Báo Cấp Cứu & Báo Động Đỏ</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, enableAlertSound: true })}
                    className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-between transition-all cursor-pointer ${
                      settings.enableAlertSound !== false
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-500 ring-2 ring-emerald-400 font-black'
                        : isDark
                        ? 'bg-slate-800 border-slate-700 text-slate-300'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-emerald-600" />
                      <span>Bật chuông âm thanh</span>
                    </div>
                    {settings.enableAlertSound !== false && <Check className="w-4 h-4 text-emerald-600" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, enableAlertSound: false })}
                    className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-between transition-all cursor-pointer ${
                      settings.enableAlertSound === false
                        ? 'bg-slate-800 text-white border-slate-600 ring-2 ring-slate-400 font-black'
                        : isDark
                        ? 'bg-slate-800 border-slate-700 text-slate-300'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <VolumeX className="w-4 h-4 text-slate-500" />
                      <span>Tắt âm thanh</span>
                    </div>
                    {settings.enableAlertSound === false && <Check className="w-4 h-4 text-white" />}
                  </button>
                </div>
              </div>

              {/* 3. Tùy Chọn Bản In Mặc Định */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <Printer className="w-4 h-4 text-rose-500" />
                  <span>Khổ In & Định Dạng Mặc Định (Print Presets)</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-500">Khổ giấy in:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ ...settings, defaultPrintOrientation: 'landscape' })}
                        className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          (settings.defaultPrintOrientation || 'landscape') === 'landscape'
                            ? 'bg-[#0b4d8c] text-white border-[#0b4d8c]'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        📑 Chiều Ngang
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ ...settings, defaultPrintOrientation: 'portrait' })}
                        className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          settings.defaultPrintOrientation === 'portrait'
                            ? 'bg-[#0b4d8c] text-white border-[#0b4d8c]'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        📄 Chiều Dọc
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-500">Định dạng in:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ ...settings, defaultPrintLayout: 'table' })}
                        className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          (settings.defaultPrintLayout || 'table') === 'table'
                            ? 'bg-[#0b4d8c] text-white border-[#0b4d8c]'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        📊 Dạng Bảng
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ ...settings, defaultPrintLayout: 'cards' })}
                        className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          settings.defaultPrintLayout === 'cards'
                            ? 'bg-[#0b4d8c] text-white border-[#0b4d8c]'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        📋 Dạng Thẻ
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Tải file Excel Ghép Nối Dữ Liệu */}
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
                    className="w-full p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Mở Bảng Tải File Excel Để Ghép Nối Dữ Liệu</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Interactive Live Preview Box */}
          <div className={`p-3 rounded-xl border text-xs space-y-1.5 ${
            isDark 
              ? 'bg-slate-800/80 border-slate-700 text-slate-300' 
              : isEyeCare
              ? 'bg-[#f3ece0] border-[#decbb0] text-[#3d372e]'
              : 'bg-blue-50/50 border-blue-200/80 text-slate-800'
          }`}>
            <div className="font-extrabold flex items-center justify-between text-blue-600 dark:text-blue-400">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                <span>Xem trước kết quả cài đặt hiển thị tức thì:</span>
              </span>
              <span className="text-[10px] font-mono opacity-80">
                Font: {settings.fontFamily || 'plus-jakarta'} • {settings.fontSize || 'normal'}
              </span>
            </div>
            
            <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-slate-400">#01</span>
                <span className="font-black text-[#0b4d8c] dark:text-blue-400">
                  NGUYỄN VĂN A
                </span>
                {settings.showNewPatientBadge !== false && (
                  <span className="px-1.5 py-0.2 rounded-full text-[8.5px] font-black uppercase bg-rose-600 text-white animate-pulse">
                    NEW
                  </span>
                )}
                <span className="text-slate-500 text-[11px]">68t • Nam • P.703</span>
              </div>

              {settings.showVitalSigns !== false && (
                <div className="flex items-center gap-1 text-[10px] font-bold">
                  <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    HA: 125/80
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-cyan-50 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                    SpO2: 98%
                  </span>
                </div>
              )}
            </div>

            <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-400">
              Chẩn đoán BS ghi: <strong>Viêm phổi kẽ / Tăng huyết áp</strong>
              {' • '}
              {settings.showTreatmentPlan !== false && <span>Y lệnh: Kháng sinh IV, thở Oxy 2L/p.</span>}
            </p>
          </div>

        </div>

        {/* Footer Actions */}
        <div className={`px-5 py-3.5 flex items-center justify-between border-t shrink-0 ${
          isDark 
            ? 'bg-slate-950 border-slate-800' 
            : isEyeCare
            ? 'bg-[#f0e9dc] border-[#e0d6c1]'
            : 'bg-slate-50 border-slate-200'
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
            className="px-5 py-2 rounded-xl bg-[#0b4d8c] hover:bg-[#083a69] text-white font-black text-xs transition-all shadow-md cursor-pointer flex items-center gap-1.5 active:scale-95"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Lưu & Hoàn Tất</span>
          </button>
        </div>

      </div>
    </div>
  );
};

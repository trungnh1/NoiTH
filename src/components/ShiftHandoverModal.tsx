import React, { useState } from 'react';
import { Patient, Doctor } from '../types/patient';
import { 
  X, 
  FileText, 
  Sparkles, 
  Copy, 
  Printer, 
  Check, 
  Loader2, 
  ShieldAlert,
  Building2,
  Users
} from 'lucide-react';

interface ShiftHandoverModalProps {
  patients: Patient[];
  doctors: Doctor[];
  onClose: () => void;
}

export const ShiftHandoverModal: React.FC<ShiftHandoverModalProps> = ({
  patients,
  doctors,
  onClose,
}) => {
  const [shift, setShift] = useState<'Ca Sáng (07:00 - 15:00)' | 'Ca Chiều (15:00 - 21:00)' | 'Ca Trực Đêm (21:00 - 07:00)'>('Ca Sáng (07:00 - 15:00)');
  const [reportingDoctor, setReportingDoctor] = useState(doctors[0]?.name || 'BS.CKII Lê Thị Thu Thảo');
  const [reportMarkdown, setReportMarkdown] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const activePatients = patients.filter((p) => p.status === 'ACTIVE');
  const criticalPatients = activePatients.filter((p) => p.severity === 'CRITICAL');
  const o2Patients = activePatients.filter((p) => p.tags.includes('O2'));
  const vasopressorPatients = activePatients.filter((p) => p.tags.includes('VASOPRESSOR'));

  const handleGenerateReport = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/ai/handover-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patients: activePatients,
          shift,
          reportingDoctor,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Lỗi khi tạo báo cáo giao ban.');
      }
      setReportMarkdown(data.reportMarkdown);
    } catch (e: any) {
      alert(`Lỗi: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!reportMarkdown) return;
    navigator.clipboard.writeText(reportMarkdown);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-2xl w-full max-w-7xl w-[96vw] shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in">
        
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-indigo-950 via-slate-900 to-rose-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/50 flex items-center justify-center text-white border border-indigo-400/30">
              <FileText className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">
                Biên Bản Giao Ban Ca Trực Tự Động (AI)
              </h2>
              <p className="text-xs text-indigo-200">
                Khoa Nội Tổng Hợp - Bệnh viện Hùng Vương Gia Lai
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shift Configuration Bar */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Ca trực giao ban</label>
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value as any)}
              className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold"
            >
              <option value="Ca Sáng (07:00 - 15:00)">Ca Sáng (07:00 - 15:00)</option>
              <option value="Ca Chiều (15:00 - 21:00)">Ca Chiều (15:00 - 21:00)</option>
              <option value="Ca Trực Đêm (21:00 - 07:00)">Ca Trực Đêm (21:00 - 07:00)</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Bác sĩ chủ trì / Báo cáo</label>
            <select
              value={reportingDoctor}
              onChange={(e) => setReportingDoctor(e.target.value)}
              className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold"
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name} ({d.title})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleGenerateReport}
              disabled={isLoading}
              className="w-full py-2.5 px-4 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>AI đang tổng hợp...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Tổng Hợp Báo Cáo AI</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Census Indicators */}
        <div className="px-5 py-2.5 bg-indigo-50/50 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3 font-semibold text-slate-700">
            <span>Tổng quân số: <b className="text-slate-900">{activePatients.length}</b></span>
            <span>• Nặng: <b className="text-rose-600">{criticalPatients.length}</b></span>
            <span>• Thở Oxy: <b className="text-cyan-700">{o2Patients.length}</b></span>
            <span>• Vận mạch: <b className="text-rose-700">{vasopressorPatients.length}</b></span>
          </div>
          <div className="flex items-center gap-2">
            {reportMarkdown && (
              <>
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold transition-all shadow-xs"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? 'Đã sao chép' : 'Sao chép'}</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold transition-all shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In báo cáo</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Report Content Body */}
        <div className="p-5 overflow-y-auto flex-1 bg-white">
          {reportMarkdown ? (
            <div className="prose prose-sm max-w-none text-slate-800 leading-relaxed space-y-3 whitespace-pre-wrap font-sans text-xs sm:text-sm">
              {reportMarkdown}
            </div>
          ) : (
            <div className="py-16 text-center text-slate-400 space-y-3">
              <FileText className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-600">
                Chưa tạo biên bản giao ban
              </p>
              <p className="text-xs max-w-md mx-auto text-slate-400">
                Nhấn nút "Tổng Hợp Báo Cáo AI" ở trên. Hệ thống Gemini sẽ tự động quét toàn bộ hồ sơ bệnh nhân trong khoa, trích xuất danh sách bệnh nhân nặng, thở oxy, vận mạch và các vấn đề cần lưu ý cho ca tiếp theo.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

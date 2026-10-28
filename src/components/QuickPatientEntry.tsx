import React, { useState } from 'react';
import { Sparkles, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Patient, SeverityLevel } from '../types/patient';

interface QuickPatientEntryProps {
  onAddPatient: (patient: Patient) => void;
}

export const QuickPatientEntry: React.FC<QuickPatientEntryProps> = ({ onAddPatient }) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleExtract = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/ai/extract-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const result = await response.json();
      if (result.success && result.data) {
        const d = result.data;
        const cleanRoom = (d.roomNumber || '733').toString().replace(/^(phòng|p\.?)\s*/i, '').trim() || '733';
        const cleanBed = (d.bedNumber || 'Giường 01').toString().trim() || 'Giường 01';
        const formattedBed = cleanBed.toLowerCase().startsWith('giường') ? cleanBed : `Giường ${cleanBed}`;
        
        let severity: SeverityLevel = 'STABLE';
        const rawSev = (d.severity || '').toString().toUpperCase();
        if (rawSev.includes('CRITICAL') || rawSev.includes('NẶNG') || rawSev.includes('NANG')) {
          severity = 'CRITICAL';
        } else if (rawSev.includes('MODERATE') || rawSev.includes('VỪA') || rawSev.includes('TRUNG BÌNH')) {
          severity = 'MODERATE';
        }

        const now = new Date();
        const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const newPatient: Patient = {
          id: `PAT-${Date.now()}`,
          patientCode: `BN-${Math.floor(100000 + Math.random() * 900000)}`,
          medicalRecordNumber: `HS-${Math.floor(100000 + Math.random() * 900000)}`,
          fullName: d.fullName || 'Bệnh nhân mới',
          age: Number(d.age) || 50,
          dateOfBirth: `${now.getFullYear() - (Number(d.age) || 50)}-01-01`,
          gender: d.gender === 'Nữ' ? 'Nữ' : 'Nam',
          roomNumber: cleanRoom,
          bedNumber: formattedBed,
          primaryDiagnosis: d.primaryDiagnosis || 'Theo dõi nhập khoa',
          severity,
          importantNotes: d.importantNotes || '',
          status: 'ACTIVE',
          admissionStatus: 'ADMITTED_TODAY',
          admissionDate: nowStr,
          tags: severity === 'CRITICAL' ? ['CLOSE_MONITORING'] : [],
          vitals: [],
          evolutions: [
            {
              id: `EV-${Date.now()}`,
              timestamp: nowStr,
              doctorName: 'BS. Trực tiếp nhận',
              shift: 'Sáng',
              clinicalNote: `Tiếp nhận bệnh nhân nhập buồng ${cleanRoom} - ${formattedBed}.`,
              treatmentAction: 'Rà soát hồ sơ ban đầu và chỉ định điều trị.',
            }
          ],
          labs: [],
          medications: [],
          attendingDoctorId: '00161',
          primaryNurse: 'ĐD. Tua trực',
          department: 'Khoa Nội Tổng Hợp',
        };

        onAddPatient(newPatient);
        setSuccess(`✅ Đã trích xuất & lưu thành công bệnh nhân ${newPatient.fullName} (Phòng ${cleanRoom} - ${formattedBed})!`);
        setText('');
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(result.error || 'Không thể trích xuất thông tin bệnh nhân từ câu nhập.');
      }
    } catch (e: any) {
      setError('Lỗi kết nối: ' + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-3.5 rounded-2xl shadow-2xs border border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>Nhập liệu nhanh bằng AI</span>
        </h3>
        <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
          Nhập câu tự do, AI sẽ tự động phân tích và lưu vào buồng bệnh
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !loading && text.trim()) {
              handleExtract();
            }
          }}
          placeholder="Ví dụ: Trần Văn Nam, 64 tuổi, Nam, phòng 733 giường 02, viêm phế quản cấp, trung bình"
          className="flex-1 px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium bg-slate-50/60 focus:bg-white transition-all"
        />
        <button
          onClick={handleExtract}
          disabled={loading || !text.trim()}
          className="px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-xl font-black text-xs hover:from-rose-700 hover:to-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-xs cursor-pointer active:scale-98"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Đang phân tích...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Trích xuất & Lưu</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded-xl flex items-center gap-1.5 font-medium animate-in fade-in">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mt-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-2 rounded-xl flex items-center gap-1.5 font-bold animate-in fade-in">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}
    </div>
  );
};

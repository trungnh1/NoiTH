import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Patient } from '../types/patient';

interface QuickPatientEntryProps {
  onAddPatient: (patient: Patient) => void;
}

export const QuickPatientEntry: React.FC<QuickPatientEntryProps> = ({ onAddPatient }) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleExtract = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const response = await fetch('/api/ai/extract-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const result = await response.json();
      if (result.success) {
        const newPatient: Patient = {
          id: `PAT-${Date.now()}`,
          ...result.data,
          status: 'ACTIVE',
          admissionStatus: 'ADMITTED_TODAY',
          admissionDate: new Date().toISOString(),
          tags: [],
          vitals: [],
          evolutions: [],
          labs: [],
          medications: [],
          attendingDoctorId: '00161', // Default doctor
          primaryNurse: 'ĐD. Tua trực',
          department: 'Khoa Nội Tổng Hợp',
        };
        onAddPatient(newPatient);
        setText('');
      } else {
        alert('Lỗi phân tích: ' + result.error);
      }
    } catch (e) {
      alert('Lỗi kết nối: ' + e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6">
      <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-500" />
        Nhập liệu nhanh bằng AI
      </h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ví dụ: Nguyễn Văn A, 50 tuổi, Nam, phòng 733 giường 01, viêm phổi, nặng"
          className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
        />
        <button
          onClick={handleExtract}
          disabled={loading || !text.trim()}
          className="px-4 py-2 bg-rose-600 text-white rounded-xl font-black text-sm hover:bg-rose-700 disabled:bg-slate-300 transition-colors flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Trích xuất'}
        </button>
      </div>
    </div>
  );
};

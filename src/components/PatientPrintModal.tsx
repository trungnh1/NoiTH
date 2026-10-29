import React, { useState, useMemo } from 'react';
import { Patient, Doctor, DepartmentRoom } from '../types/patient';
import { X, Printer, Building2, Stethoscope } from 'lucide-react';
import { 
  GROUP_1_ROOM_NUMBERS, 
  GROUP_1_DOCTOR_IDS, 
  formatDoctorShortName, 
  formatCombinedDiagnosis 
} from './DetailedPatientListView';

interface PatientPrintModalProps {
  patients: Patient[];
  doctors: Doctor[];
  rooms?: DepartmentRoom[];
  onClose: () => void;
}

export const PatientPrintModal: React.FC<PatientPrintModalProps> = ({
  patients,
  doctors,
  rooms = [],
  onClose,
}) => {
  const [filterMode, setFilterMode] = useState<'ALL' | 'BY_ROOM' | 'BY_DOCTOR'>('ALL');
  const [selectedRoom, setSelectedRoom] = useState<string>('ALL');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('ALL');
  const [includeNotes, setIncludeNotes] = useState<boolean>(true);

  // Group 1 doctors (Ngọc, Trung, Huyền, Thiên, Ánh, Bình Chi)
  const group1Doctors = useMemo(() => {
    const raw = doctors.filter((d) => 
      GROUP_1_DOCTOR_IDS.includes(d.id) || 
      d.id === 'DOC-NGOC' ||
      /ngọc|trung|huyền|thiên|ánh|bình chi/i.test(d.name)
    );
    const seenNames = new Set<string>();
    const uniqueList: Doctor[] = [];
    for (const d of raw) {
      const norm = d.name.trim().toLowerCase();
      if (!seenNames.has(norm)) {
        seenNames.add(norm);
        uniqueList.push(d);
      }
    }
    return uniqueList;
  }, [doctors]);

  // Doctor lookup map
  const doctorMap = useMemo(() => {
    const map = new Map<string, Doctor>();
    doctors.forEach((d) => map.set(d.id, d));
    const ngoc = doctors.find((d) => d.id === '00708' || /trần hữu ngọc/i.test(d.name));
    if (ngoc) map.set('DOC-NGOC', ngoc);
    return map;
  }, [doctors]);

  // Active inpatients filtered strictly according to user selection
  const printablePatients = useMemo(() => {
    return patients.filter((p) => {
      if (p.status !== 'ACTIVE') return false;

      const cleanRoom = p.roomNumber ? p.roomNumber.replace(/^(phòng|p\.?)\s*/i, '').trim() : '';

      // Filter by room
      if (filterMode === 'BY_ROOM' && selectedRoom !== 'ALL') {
        const cleanSelected = selectedRoom.replace(/^(phòng|p\.?)\s*/i, '').trim();
        if (cleanRoom !== cleanSelected) return false;
      }

      // Filter by doctor
      if (filterMode === 'BY_DOCTOR' && selectedDoctorId !== 'ALL') {
        const docId = p.attendingDoctorId;
        if (docId !== selectedDoctorId) {
          if (!(selectedDoctorId === '00708' && docId === 'DOC-NGOC')) {
            return false;
          }
        }
      }

      return true;
    }).sort((a, b) => {
      // Natural sort by Room and Bed Number
      const roomComp = (a.roomNumber || '').localeCompare(b.roomNumber || '', undefined, { numeric: true });
      if (roomComp !== 0) return roomComp;
      return a.fullName.localeCompare(b.fullName, 'vi');
    });
  }, [patients, filterMode, selectedRoom, selectedDoctorId]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      
      {/* Print Stylesheet injection for A4 portrait document printing */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-patient-list-area, #printable-patient-list-area * {
            visibility: visible;
          }
          #printable-patient-list-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 5mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl w-[96vw] max-w-[96vw] shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in">
        
        {/* Header - Screen Only */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between no-print shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-600 text-white">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight">
                In Danh Sách Bệnh Nhân (Dạng Danh Sách)
              </h3>
              <p className="text-xs text-slate-400">
                Tùy chọn lọc theo phòng, bác sĩ và in danh sách có ô trống ghi tay
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Toolbar - Screen Only */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 no-print space-y-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            
            {/* Filter Mode Selector */}
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-300 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  setFilterMode('ALL');
                  setSelectedRoom('ALL');
                  setSelectedDoctorId('ALL');
                }}
                className={`px-3 py-1.5 rounded-lg font-extrabold transition-all cursor-pointer ${
                  filterMode === 'ALL'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Tất cả BN ({patients.filter((p) => p.status === 'ACTIVE').length})
              </button>

              <button
                type="button"
                onClick={() => setFilterMode('BY_ROOM')}
                className={`px-3 py-1.5 rounded-lg font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                  filterMode === 'BY_ROOM'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Theo buồng phòng</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterMode('BY_DOCTOR')}
                className={`px-3 py-1.5 rounded-lg font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                  filterMode === 'BY_DOCTOR'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5" />
                <span>Theo bác sĩ</span>
              </button>
            </div>

            {/* Sub-Filters based on Mode */}
            {filterMode === 'BY_ROOM' && (
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-300">
                <span className="font-extrabold text-slate-700">Chọn phòng:</span>
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  className="bg-transparent font-bold text-slate-900 focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">Tất cả buồng phòng Nhóm 1</option>
                  {GROUP_1_ROOM_NUMBERS.map((rNum) => (
                    <option key={rNum} value={rNum}>
                      Phòng {rNum}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {filterMode === 'BY_DOCTOR' && (
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-300">
                <span className="font-extrabold text-slate-700">Chọn Bác sĩ:</span>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="bg-transparent font-bold text-slate-900 focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">Tất cả Bác sĩ</option>
                  {group1Doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      BS. {formatDoctorShortName(doc.name)} ({doc.name})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Toggle Include Notes */}
            <label className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-300 cursor-pointer hover:bg-slate-50 transition-all shadow-2xs select-none">
              <input
                type="checkbox"
                checked={includeNotes}
                onChange={(e) => setIncludeNotes(e.target.checked)}
                className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer accent-rose-600"
              />
              <span className="font-extrabold text-slate-800 text-xs">
                In kèm Ghi chú / Y lệnh
              </span>
            </label>

            {/* Print trigger button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-extrabold shadow-md flex items-center gap-2 transition-all cursor-pointer active:scale-95 ml-auto"
            >
              <Printer className="w-4 h-4" />
              <span>🖨️ In Danh Sách / Xuất PDF</span>
            </button>

          </div>
        </div>

        {/* Preview & Printable Document Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100">
          
          <div 
            id="printable-patient-list-area"
            className="bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-sm max-w-3xl mx-auto font-serif text-slate-900 leading-normal"
          >
            {/* Title */}
            <div className="text-center mb-6 pb-3 border-b border-slate-300 space-y-1">
              <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900 font-sans">
                DANH SÁCH BỆNH NHÂN NỘI TRÚ ĐANG ĐIỀU TRỊ
              </h2>
              <p className="text-xs font-sans text-slate-600">
                {filterMode === 'BY_ROOM' && selectedRoom !== 'ALL'
                  ? `Phòng ${selectedRoom}`
                  : filterMode === 'BY_DOCTOR' && selectedDoctorId !== 'ALL'
                  ? `Bác sĩ: ${doctorMap.get(selectedDoctorId)?.name || selectedDoctorId}`
                  : 'Toàn bộ bệnh nhân Buồng phòng Nhóm 1'}
                {' • Tổng số: '}<b>{printablePatients.length}</b> bệnh nhân
              </p>
            </div>

            {/* Printable List Items */}
            {printablePatients.length === 0 ? (
              <div className="py-12 text-center text-slate-400 font-sans text-xs">
                Không tìm thấy bệnh nhân nào theo điều kiện lọc hiện tại.
              </div>
            ) : (
              <div className="space-y-4 font-sans">
                {printablePatients.map((patient, index) => {
                  const combinedDiag = formatCombinedDiagnosis(patient);
                  const roomName = `Phòng ${(patient.roomNumber || '').replace(/^(phòng|p\.?)\s*/i, '').trim()}`;
                  const notes = patient.importantNotes || 
                    patient.handoverNotes || 
                    patient.treatmentPlan || 
                    patient.evolutions?.[0]?.treatmentAction || 
                    'Theo dõi sinh hiệu, chăm sóc cấp 2';

                  return (
                    <div 
                      key={patient.id} 
                      className="p-3.5 rounded-lg border border-slate-300 bg-white text-xs space-y-2 break-inside-avoid"
                    >
                      {/* Line 1: STT, Phòng, Họ tên, Tuổi, Giới */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {index + 1}
                          </span>
                          <span className="font-black text-rose-800 bg-rose-50 px-2.5 py-0.5 rounded border border-rose-200">
                            {roomName}
                          </span>
                          <h4 className="font-black text-sm text-slate-900 tracking-tight">
                            {formatPatientDisplayName(patient.fullName)}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 font-semibold text-slate-700">
                          <span>{patient.age} tuổi</span>
                          <span>•</span>
                          <span className={patient.gender === 'Nam' ? 'text-blue-700 font-bold' : 'text-pink-700 font-bold'}>
                            {patient.gender === 'Nam' ? '♂ Nam' : '♀ Nữ'}
                          </span>
                        </div>
                      </div>

                      {/* Line 2: Chẩn đoán & Ghi chú (nếu bật tùy chọn in ghi chú) */}
                      {includeNotes ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-800">
                          <div>
                            <strong className="text-slate-900">Chẩn đoán:</strong> {combinedDiag}
                          </div>
                          <div>
                            <strong className="text-slate-900">Ghi chú/Y lệnh:</strong> {notes}
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-800">
                          <strong className="text-slate-900">Chẩn đoán:</strong> {combinedDiag}
                        </div>
                      )}

                      {/* Line 3: LUÔN CÓ chỗ trống để ghi tay dành cho Bác sĩ / Điều dưỡng */}
                      <div className="pt-2 mt-1 border-t border-dashed border-slate-300 flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">
                          Ghi chú ghi tay:
                        </span>
                        <div className="flex-1 border-b border-dotted border-slate-400 h-5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>

        </div>

        {/* Footer Actions - Screen Only */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between no-print shrink-0 text-xs">
          <span className="text-slate-500 font-semibold">
            Đang xem trước bản in danh sách ({includeNotes ? 'có bao gồm Ghi chú / Y lệnh' : 'chỉ in thông tin hành chính & chẩn đoán, không in ghi chú'})
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>In Ngay / Lấy File PDF</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

import { formatPatientDisplayName } from '../utils/storage';
import React, { useState, useMemo } from 'react';
import { Patient, Doctor, DepartmentRoom } from '../types/patient';
import { X, Printer, Building2, Stethoscope } from 'lucide-react';
import { 
  GROUP_1_ROOM_NUMBERS, 
  GROUP_1_DOCTOR_IDS, 
  GROUP_2_DOCTOR_IDS,
  CARDIO_DOCTOR_IDS,
  formatDoctorShortName, 
  formatCombinedDiagnosis,
  getLatestDiagnosis,
  formatAdmissionDateShort,
  calculateTreatmentDays
} from './DetailedPatientListView';
import { AppSettings } from '../utils/settings';

interface PatientPrintModalProps {
  patients: Patient[];
  doctors: Doctor[];
  rooms?: DepartmentRoom[];
  settings?: AppSettings;
  onClose: () => void;
}

export const PatientPrintModal: React.FC<PatientPrintModalProps> = ({
  patients,
  doctors,
  rooms = [],
  settings,
  onClose,
}) => {
  const [filterMode, setFilterMode] = useState<'ALL' | 'BY_ROOM' | 'BY_DOCTOR'>('ALL');
  const [selectedRoom, setSelectedRoom] = useState<string>('ALL');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('ALL');
  const [includeNotes, setIncludeNotes] = useState<boolean>(true);
  
  // Tùy chọn hướng in: Chiều Dọc (Portrait) hoặc Chiều Ngang (Landscape)
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>(
    settings?.defaultPrintOrientation || 'landscape'
  );
  // Tùy chọn định dạng: Dạng Bảng hàng ngang hoặc Dạng Thẻ
  const [printLayout, setPrintLayout] = useState<'table' | 'cards'>(
    settings?.defaultPrintLayout || 'table'
  );

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

  // Group 2 doctors (Linh, Hoài, Mai, Ngoan, Chi)
  const group2Doctors = useMemo(() => {
    return doctors.filter((d) => 
      (GROUP_2_DOCTOR_IDS.includes(d.id) || /thái thị thùy linh|dương thị hoài|nguyễn thị ngọc mai|đỗ thị ngoan|nguyễn thị phương chi/i.test(d.name)) &&
      !/bình chi/i.test(d.name)
    );
  }, [doctors]);

  // Cardio doctors (Nhật, Thọ, Thịnh, Lam, Luận)
  const cardioDoctors = useMemo(() => {
    return doctors.filter((d) => 
      (CARDIO_DOCTOR_IDS.includes(d.id) || /nguyễn văn phương nhật|võ văn thọ|võ hồng thịnh|trương hoài lam|đồng văn luận/i.test(d.name)) &&
      !/tuế|quyên/i.test(d.name) && d.id !== '00101' && d.id !== '00199'
    );
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
      
      {/* Print Stylesheet injection for A4 portrait/landscape document printing */}
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
            padding: ${printOrientation === 'landscape' ? '4mm' : '6mm'} !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 ${printOrientation};
            margin: ${printOrientation === 'landscape' ? '6mm' : '10mm'};
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl w-[96vw] max-w-[96vw] shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in">
        
        {/* Header - Screen Only */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between no-print shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#0b4d8c] text-white">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight">
                In Danh Sách Bệnh Nhân Nội Trú
              </h3>
              <p className="text-xs text-slate-400">
                Tùy chọn in theo Chiều Dọc (Portrait) hoặc Chiều Ngang (Landscape) • Dạng Bảng hoặc Thẻ
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
            
            {/* Left: Filter Mode Selector */}
            <div className="flex flex-wrap items-center gap-2">
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
                      ? 'bg-[#0b4d8c] text-white shadow-xs'
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
                      ? 'bg-[#0b4d8c] text-white shadow-xs'
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
                      ? 'bg-[#0b4d8c] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Stethoscope className="w-3.5 h-3.5" />
                  <span>Theo bác sĩ</span>
                </button>
              </div>

              {/* Sub-Filters based on Mode */}
              {filterMode === 'BY_ROOM' && (
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
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
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
                  <span className="font-extrabold text-slate-700">Chọn Bác sĩ:</span>
                  <select
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    className="bg-transparent font-bold text-slate-900 focus:outline-hidden cursor-pointer max-w-[200px]"
                  >
                    <option value="ALL">Tất cả Bác sĩ</option>
                    <optgroup label="Bác sĩ Nhóm 1 (Ngọc, Trung, Huyền, Thiên, Ánh, Bình Chi)">
                      {group1Doctors.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          BS. {formatDoctorShortName(doc.name)} ({doc.name})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Bác sĩ Nhóm 2 (Linh, Hoài, Mai, Ngoan, Chi)">
                      {group2Doctors.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          BS. {formatDoctorShortName(doc.name)} ({doc.name})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Bác sĩ Tim Mạch (Nhật, Thọ, Thịnh, Lam, Luận)">
                      {cardioDoctors.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          BS. {formatDoctorShortName(doc.name)} ({doc.name})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              )}
            </div>

            {/* Right: Print Orientation & Layout Options */}
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              {/* Orientation selector: Dọc vs Ngang */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-300 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setPrintOrientation('portrait')}
                  className={`px-2.5 py-1.5 rounded-lg font-black text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                    printOrientation === 'portrait'
                      ? 'bg-[#0b4d8c] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="In theo khổ giấy A4 Chiều Dọc (Portrait)"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="5" y="3" width="14" height="18" rx="2" />
                  </svg>
                  <span>Chiều Dọc</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPrintOrientation('landscape')}
                  className={`px-2.5 py-1.5 rounded-lg font-black text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                    printOrientation === 'landscape'
                      ? 'bg-[#0b4d8c] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="In theo khổ giấy A4 Chiều Ngang (Landscape)"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                  </svg>
                  <span>Chiều Ngang</span>
                </button>
              </div>

              {/* Layout style: Bảng vs Thẻ */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-300 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setPrintLayout('table')}
                  className={`px-2.5 py-1.5 rounded-lg font-black text-xs transition-all cursor-pointer flex items-center gap-1 ${
                    printLayout === 'table'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="Định dạng Bảng hàng ngang"
                >
                  <span>📊 Dạng Bảng</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPrintLayout('cards')}
                  className={`px-2.5 py-1.5 rounded-lg font-black text-xs transition-all cursor-pointer flex items-center gap-1 ${
                    printLayout === 'cards'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="Định dạng Thẻ ghi chú"
                >
                  <span>📋 Dạng Thẻ</span>
                </button>
              </div>

              {/* Toggle Include Notes */}
              <label className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-300 cursor-pointer hover:bg-slate-50 transition-all shadow-2xs select-none">
                <input
                  type="checkbox"
                  checked={includeNotes}
                  onChange={(e) => setIncludeNotes(e.target.checked)}
                  className="w-3.5 h-3.5 text-[#0b4d8c] rounded border-slate-300 focus:ring-blue-500 cursor-pointer accent-[#0b4d8c]"
                />
                <span className="font-extrabold text-slate-800 text-xs">
                  Ghi chú / Y lệnh
                </span>
              </label>

              {/* Print trigger button */}
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-extrabold shadow-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>🖨️ In / Xuất PDF</span>
              </button>
            </div>

          </div>
        </div>

        {/* Preview & Printable Document Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-100">
          
          <div 
            id="printable-patient-list-area"
            className={`bg-white p-5 sm:p-7 rounded-xl border border-slate-200 shadow-sm mx-auto font-sans text-slate-900 leading-normal transition-all ${
              printOrientation === 'landscape' 
                ? 'w-full max-w-[1100px]' 
                : 'w-full max-w-3xl'
            }`}
          >
            {/* Title & Document Meta Header */}
            <div className="mb-4 pb-3 border-b-2 border-slate-800 space-y-1">
              <div className="flex justify-between items-start text-xs text-slate-600 mb-1">
                <div className="text-left font-bold uppercase tracking-wider text-slate-800">
                  <div className="text-sm font-black text-[#0b4d8c]">BỆNH VIỆN HÙNG VƯƠNG GIA LAI</div>
                  <div className="text-[11.5px] text-slate-600 font-bold">KHOA NỘI TỔNG HỢP</div>
                </div>
                <div className="text-right text-[11px] text-slate-600 font-medium">
                  <div>Thời gian in: {new Date().toLocaleDateString('vi-VN')} {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                  <div className="font-semibold text-slate-700">Khổ giấy: A4 {printOrientation === 'landscape' ? 'Chiều Ngang (Landscape)' : 'Chiều Dọc (Portrait)'}</div>
                </div>
              </div>
              <div className="text-center pt-1">
                <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900 font-sans">
                  DANH SÁCH BỆNH NHÂN NỘI TRÚ ĐANG ĐIỀU TRỊ
                </h2>
                <p className="text-xs font-sans text-slate-600 font-medium mt-0.5">
                  {filterMode === 'BY_ROOM' && selectedRoom !== 'ALL'
                    ? `Phòng ${selectedRoom}`
                    : filterMode === 'BY_DOCTOR' && selectedDoctorId !== 'ALL'
                    ? `Bác sĩ: ${doctorMap.get(selectedDoctorId)?.name || selectedDoctorId}`
                    : 'Toàn bộ bệnh nhân Buồng phòng Nhóm 1'}
                  {' • Tổng số: '}<b>{printablePatients.length}</b> bệnh nhân
                </p>
              </div>
            </div>

            {/* Printable List Items */}
            {printablePatients.length === 0 ? (
              <div className="py-12 text-center text-slate-400 font-sans text-xs">
                Không tìm thấy bệnh nhân nào theo điều kiện lọc hiện tại.
              </div>
            ) : printLayout === 'table' ? (
              /* DẠNG BẢNG HÀNG NGANG */
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse border border-slate-400 text-[11px] font-sans">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 font-black uppercase tracking-wider border-b-2 border-slate-400">
                      <th className="p-1.5 border border-slate-400 text-center w-[36px]">STT</th>
                      <th className="p-1.5 border border-slate-400 text-center w-[54px]">Phòng</th>
                      <th className="p-1.5 border border-slate-400 min-w-[150px] w-[20%]">Họ và Tên Bệnh Nhân</th>
                      <th className="p-1.5 border border-slate-400 text-center min-w-[65px] w-[8%]">Tuổi/Giới</th>
                      <th className="p-1.5 border border-slate-400 text-center min-w-[75px] w-[9%]">Ngày NV/ĐT</th>
                      <th className="p-1.5 border border-slate-400 min-w-[170px] w-[23%]">Chẩn Đoán Mới Nhất</th>
                      {includeNotes && (
                        <th className="p-1.5 border border-slate-400 min-w-[170px] w-[22%]">Diễn Tiến / Hướng Xử Trí</th>
                      )}
                      <th className="p-1.5 border border-slate-400 min-w-[120px] w-[18%]">Ghi Chú / Ký Nhận</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printablePatients.map((patient, index) => {
                      const roomName = (patient.roomNumber || '').replace(/^(phòng|p\.?)\s*/i, '').trim();
                      const latestDiag = getLatestDiagnosis(patient);
                      const treatmentInfo = calculateTreatmentDays(patient.admissionDate);
                      const notes = patient.treatmentPlan || 
                        patient.importantNotes || 
                        patient.handoverNotes || 
                        patient.evolutions?.[0]?.treatmentAction || 
                        patient.evolutions?.[0]?.clinicalNote || 
                        '';

                      return (
                        <tr key={patient.id} className="border-b border-slate-300 break-inside-avoid hover:bg-slate-50/50">
                          <td className="p-1.5 border border-slate-300 text-center font-bold text-slate-700">
                            {index + 1}
                          </td>
                          <td className="p-1.5 border border-slate-300 text-center font-black text-rose-800">
                            P.{roomName}
                          </td>
                          <td className="p-1.5 border border-slate-300 font-bold text-slate-900">
                            <div>{formatPatientDisplayName(patient.fullName)}</div>
                            {patient.admissionStatus === 'DISCHARGE_TODAY' && (
                              <span className="text-[9px] font-bold text-purple-700 uppercase">(Ra viện hôm nay)</span>
                            )}
                            {patient.admissionStatus === 'DISCHARGE_TOMORROW' && (
                              <span className="text-[9px] font-bold text-blue-700 uppercase">(Dự RV mai)</span>
                            )}
                          </td>
                          <td className="p-1.5 border border-slate-300 text-center">
                            <div className="font-bold text-slate-800">{patient.age} t</div>
                            <div className={`text-[10px] font-bold ${patient.gender === 'Nam' ? 'text-blue-700' : 'text-pink-700'}`}>
                              {patient.gender}
                            </div>
                          </td>
                          <td className="p-1.5 border border-slate-300 text-center text-[10.5px]">
                            <div className="text-slate-700">{formatAdmissionDateShort(patient.admissionDate)}</div>
                            <div className="font-bold text-blue-800 text-[10px]">{treatmentInfo.label}</div>
                          </td>
                          <td className="p-1.5 border border-slate-300 leading-snug">
                            <div className="font-semibold text-slate-900">{latestDiag}</div>
                            
                          </td>
                          {includeNotes && (
                            <td className="p-1.5 border border-slate-300 leading-snug">
                              <div className="text-slate-800 text-[10.5px] line-clamp-3">{notes || '-'}</div>
                            </td>
                          )}
                          <td className="p-1.5 border border-slate-300">
                            <div className="min-h-[26px] border-b border-dotted border-slate-400 w-full" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* DẠNG THẺ GHI CHÚ */
              <div className={`font-sans ${printOrientation === 'landscape' ? 'grid grid-cols-2 gap-3' : 'space-y-3.5'}`}>
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
                      className="p-3 rounded-lg border border-slate-300 bg-white text-xs space-y-2 break-inside-avoid"
                    >
                      {/* Line 1: STT, Phòng, Họ tên, Tuổi, Giới */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            {index + 1}
                          </span>
                          <span className="font-black text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-[11px]">
                            {roomName}
                          </span>
                          <h4 className="font-black text-[13.5px] text-slate-900 tracking-tight">
                            {formatPatientDisplayName(patient.fullName)}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 font-semibold text-slate-700 text-xs">
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
                      <div className="pt-1.5 mt-1 border-t border-dashed border-slate-300 flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">
                          Ghi chú ghi tay:
                        </span>
                        <div className="flex-1 border-b border-dotted border-slate-400 h-4" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>

        </div>

        {/* Footer Actions - Screen Only */}
        <div className="p-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 no-print shrink-0 text-xs">
          <div className="flex items-center gap-2 text-slate-600 font-semibold">
            <span>
              Khổ in: <b>A4 {printOrientation === 'landscape' ? 'Chiều Ngang (Landscape)' : 'Chiều Dọc (Portrait)'}</b>
            </span>
            <span>•</span>
            <span>
              Định dạng: <b>{printLayout === 'table' ? 'Bảng Hàng Ngang' : 'Thẻ Ghi Chú'}</b>
            </span>
          </div>
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

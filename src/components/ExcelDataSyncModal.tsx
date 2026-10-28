import React, { useState, useMemo } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Building2, 
  User, 
  Download, 
  Sparkles,
  RefreshCw,
  Plus,
  Stethoscope,
  Database,
  Layers
} from 'lucide-react';
import { Patient, Doctor, DepartmentRoom } from '../types/patient';
import { ClinicalRecord, mapClinicalRecordToPatient, parseAgeNumber } from '../services/clinicalFirebase';
import { 
  parseExcelFile, 
  matchExcelWithSatelliteRecords, 
  ExcelPatientRow, 
  MatchedSatelliteRecord 
} from '../utils/excelParser';

interface ExcelDataSyncModalProps {
  pendingSatelliteRecords: ClinicalRecord[];
  doctors: Doctor[];
  rooms: DepartmentRoom[];
  currentUser?: Doctor | null;
  onClose: () => void;
  onImportPatientDirect: (patient: Patient) => void;
}

export const ExcelDataSyncModal: React.FC<ExcelDataSyncModalProps> = ({
  pendingSatelliteRecords,
  doctors,
  rooms,
  currentUser,
  onClose,
  onImportPatientDirect,
}) => {
  const [excelRows, setExcelRows] = useState<ExcelPatientRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const parsed = parseExcelFile(buffer);
        setExcelRows(parsed);
        setNotification({
          message: `Đã đọc thành công ${parsed.length} dòng dữ liệu từ file Excel "${file.name}"!`,
          type: 'success',
        });
      } catch (err: any) {
        console.error('Excel parse error:', err);
        setNotification({
          message: `Lỗi đọc file Excel: ${err.message || String(err)}`,
          type: 'error',
        });
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Match Excel rows with incomplete satellite records
  const matchedRecords = useMemo(() => {
    if (excelRows.length === 0 || pendingSatelliteRecords.length === 0) return [];
    return matchExcelWithSatelliteRecords(excelRows, pendingSatelliteRecords);
  }, [excelRows, pendingSatelliteRecords]);

  // Action: Merge matched satellite record with Excel and admit to inpatient list
  const handleMergeAndAdmit = (match: MatchedSatelliteRecord) => {
    const sat = match.satelliteRecord;
    const excel = match.matchedExcelRow;

    // Build enriched satellite record
    const mergedRecord: ClinicalRecord = {
      ...sat,
      patientName: sat.patientName || excel.patientName,
      patientAge: sat.patientAge || String(excel.patientAge || ''),
      patientGender: sat.patientGender || excel.patientGender,
      patientRoom: match.proposedRoom,
      diagnosis: sat.diagnosis || excel.diagnosis,
      vitalSigns: sat.vitalSigns || excel.vitalSigns,
      medicalHistory: sat.medicalHistory || excel.medicalHistory,
      treatmentPlan: sat.treatmentPlan || excel.treatmentPlan,
    };

    const patientObj = mapClinicalRecordToPatient(mergedRecord, doctors, rooms, currentUser?.id);
    patientObj.importantNotes = `Hồ sơ vệ tinh ghép nối từ Excel [File: ${fileName || 'Excel'}]`;

    onImportPatientDirect(patientObj);
    setImportedIds((prev) => new Set(prev).add(sat.id));

    setNotification({
      message: `Đã ghép nối và nhập bệnh nhân "${patientObj.fullName}" vào Phòng ${patientObj.roomNumber}!`,
      type: 'success',
    });
    setTimeout(() => setNotification(null), 4000);
  };

  // Action: Merge all matches in one click
  const handleMergeAllMatches = () => {
    if (matchedRecords.length === 0) return;
    let count = 0;
    matchedRecords.forEach((match) => {
      if (!importedIds.has(match.satelliteRecord.id)) {
        handleMergeAndAdmit(match);
        count++;
      }
    });
    setNotification({
      message: `Hoàn tất ghép nối và tiếp nhận ${count} bệnh nhân vào danh sách nội trú!`,
      type: 'success',
    });
  };

  // Action: Import direct patient from Excel row
  const handleImportDirectFromExcel = (excelRow: ExcelPatientRow, index: number) => {
    const now = new Date();
    const defaultDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const ageNum = parseAgeNumber(excelRow.patientAge) || 60;
    const roomClean = String(excelRow.patientRoom || '703').replace(/^(phòng|p\.?|buồng)\s*/i, '').trim();

    const newPatient: Patient = {
      id: `EXCEL-${Date.now()}-${index}`,
      fullName: excelRow.patientName || 'Bệnh Nhân Excel',
      age: ageNum,
      gender: excelRow.patientGender?.toLowerCase().includes('nữ') ? 'Nữ' : 'Nam',
      dateOfBirth: `${now.getFullYear() - ageNum}-01-01`,
      roomNumber: roomClean || '703',
      bedNumber: excelRow.bedNumber || 'Giường 01',
      admissionDate: excelRow.admissionDate || defaultDateStr,
      attendingDoctorId: currentUser?.id || doctors[0]?.id || '00979',
      primaryNurse: 'Điều dưỡng phụ trách phòng',
      primaryDiagnosis: excelRow.diagnosis || 'Theo dõi bệnh nội khoa',
      medicalHistory: excelRow.medicalHistory || undefined,
      severity: 'STABLE',
      admissionStatus: 'ADMITTED_TODAY',
      tags: [],
      treatmentPlan: excelRow.treatmentPlan || 'Duy trì phác đồ điều trị nội khoa.',
      importantNotes: `Nhập trực tiếp từ file Excel [${fileName || 'Excel'}]`,
      vitals: [],
      evolutions: [],
      labs: [],
      medications: [],
      status: 'ACTIVE',
    };

    onImportPatientDirect(newPatient);
    setImportedIds((prev) => new Set(prev).add(`excel-${index}`));

    setNotification({
      message: `Đã nhập bệnh nhân "${newPatient.fullName}" vào Phòng ${newPatient.roomNumber}!`,
      type: 'success',
    });
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-900 via-teal-950 to-slate-900 text-white flex items-center justify-between border-b border-emerald-800/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-white uppercase">
                Nhập File Excel & Ghép Nối Dữ Liệu
              </h3>
              <p className="text-xs text-emerald-200/90 mt-0.5">
                Đọc danh sách bệnh nhân từ Excel để tự động điền Số phòng / Tuổi cho Bệnh nhân Vệ tinh
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title="Đóng (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast Notification */}
        {notification && (
          <div className={`px-4 py-2 text-xs font-bold flex items-center justify-between shrink-0 animate-in fade-in ${
            notification.type === 'success' 
              ? 'bg-emerald-600 text-white' 
              : notification.type === 'error'
              ? 'bg-rose-600 text-white'
              : 'bg-indigo-600 text-white'
          }`}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{notification.message}</span>
            </div>
            <button 
              onClick={() => setNotification(null)}
              className="text-white/80 hover:text-white cursor-pointer ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 bg-slate-50/70">
          
          {/* File Upload Box */}
          <div className="bg-white p-5 rounded-2xl border-2 border-dashed border-emerald-300 hover:border-emerald-500 transition-all text-center space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
              <Upload className="w-6 h-6" />
            </div>

            <div>
              <h4 className="text-sm font-black text-slate-900">
                {fileName ? `File đã chọn: ${fileName}` : 'Kéo thả hoặc Bấm chọn file Excel (.xlsx, .xls, .csv)'}
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-lg mx-auto">
                File Excel chứa các cột: <strong className="text-emerald-800">Họ tên, Tuổi, Giới tính, Phòng/Buồng</strong>. Hệ thống sẽ tự động ghép với Bệnh nhân Vệ tinh thiếu phòng.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3">
              <label className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center gap-2 active:scale-95">
                <FileSpreadsheet className="w-4 h-4" />
                <span>{fileName ? 'Chọn File Khác' : 'Chọn File Excel Từ Máy Tính'}</span>
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
              </label>
            </div>
          </div>

          {/* SECTION 1: Matched Pairs with Pending Satellite Records */}
          {matchedRecords.length > 0 && (
            <div className="bg-white rounded-2xl border border-emerald-200 p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-sm font-black text-slate-900 uppercase">
                    Kết Quả Ghép Nối Với Bệnh Nhân Vệ Tinh ({matchedRecords.length} ca khớp)
                  </h4>
                </div>

                <button
                  type="button"
                  onClick={handleMergeAllMatches}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Ghép Nối Tất Cả Ca Đã Khớp</span>
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {matchedRecords.map((match, idx) => {
                  const sat = match.satelliteRecord;
                  const excel = match.matchedExcelRow;
                  const isMerged = importedIds.has(sat.id);

                  return (
                    <div 
                      key={sat.id || idx}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs transition-all ${
                        isMerged ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-900 uppercase">{sat.patientName || sat.fullName}</span>
                          <span className="text-[11px] font-bold text-slate-500">• Khớp theo {match.matchedField}</span>
                          {isMerged && (
                            <span className="text-[10.5px] px-2 py-0.2 rounded-full bg-emerald-600 text-white font-bold">
                              ✓ Đã nhập
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11.5px] text-slate-700 flex-wrap">
                          <span className="bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                            Vệ tinh: {sat.patientRoom || 'Thiếu phòng'}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="bg-emerald-100 text-emerald-900 px-1.5 py-0.2 rounded font-black">
                            Excel ghép: Phòng {match.proposedRoom} (Tuổi: {match.proposedAge})
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleMergeAndAdmit(match)}
                        disabled={isMerged}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                          isMerged
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs active:scale-95'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isMerged ? 'Đã Nhập' : 'Ghép Nối & Nhập Viện'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 2: All Rows Extracted from Excel */}
          {excelRows.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-sm font-black text-slate-900 uppercase">
                    Danh Sách Đọc Từ File Excel ({excelRows.length} bệnh nhân)
                  </h4>
                </div>
              </div>

              <div className="overflow-x-auto max-h-72 overflow-y-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">Họ Và Tên</th>
                      <th className="p-2.5">Tuổi</th>
                      <th className="p-2.5">Giới</th>
                      <th className="p-2.5">Phòng / Buồng</th>
                      <th className="p-2.5">Chẩn Đoán</th>
                      <th className="p-2.5 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {excelRows.map((row, idx) => {
                      const isImported = importedIds.has(`excel-${idx}`);
                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-2.5 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="p-2.5 font-black text-slate-900 uppercase">{row.patientName}</td>
                          <td className="p-2.5 font-semibold text-slate-700">{row.patientAge}</td>
                          <td className="p-2.5 font-semibold text-slate-700">{row.patientGender}</td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 font-black text-indigo-800">
                              Phòng {row.patientRoom}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-600 truncate max-w-[150px]">{row.diagnosis || 'Chưa ghi nhận'}</td>
                          <td className="p-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleImportDirectFromExcel(row, idx)}
                              disabled={isImported}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                isImported
                                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs active:scale-95'
                              }`}
                            >
                              {isImported ? 'Đã Nhập' : '+ Nhập Viện'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="text-slate-500 font-medium">
            Hỗ trợ cấu trúc cột: <strong className="text-slate-700">Họ tên, Tuổi, Giới tính, Phòng/Buồng, Chẩn đoán</strong>.
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
          >
            Đóng (Esc)
          </button>
        </div>

      </div>
    </div>
  );
};

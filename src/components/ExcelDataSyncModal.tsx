import { formatPatientDisplayName } from '../utils/storage';
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
  Layers,
  Calendar,
  HelpCircle,
  Eye,
  Info,
  LogOut,
  RotateCcw
} from 'lucide-react';
import { Patient, Doctor, DepartmentRoom } from '../types/patient';
import { ClinicalRecord, mapClinicalRecordToPatient, parseAgeNumber } from '../services/clinicalFirebase';
import { 
  parseExcelFile, 
  matchExcelWithSatelliteRecords, 
  ExcelPatientRow, 
  MatchedSatelliteRecord,
  normalizeVietnameseString,
  extractCleanRoomNumber
} from '../utils/excelParser';

interface ExcelDataSyncModalProps {
  existingPatients?: Patient[];
  pendingSatelliteRecords: ClinicalRecord[];
  doctors: Doctor[];
  rooms: DepartmentRoom[];
  currentUser?: Doctor | null;
  onClose: () => void;
  onImportPatientDirect: (patient: Patient) => void;
  onImportMultiplePatients?: (patients: Patient[]) => void;
  onAutoDischargePatients?: (patients: Patient[]) => void;
  onReactivatePatient?: (patient: Patient) => void;
}

export const ExcelDataSyncModal: React.FC<ExcelDataSyncModalProps> = ({
  existingPatients = [],
  pendingSatelliteRecords,
  doctors,
  rooms,
  currentUser,
  onClose,
  onImportPatientDirect,
  onImportMultiplePatients,
  onAutoDischargePatients,
  onReactivatePatient,
}) => {
  const [excelRows, setExcelRows] = useState<ExcelPatientRow[]>([]);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [autoDischargedPatients, setAutoDischargedPatients] = useState<Patient[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Helper: Kiểm tra bệnh nhân có xuất hiện trong danh sách hàng Excel không
  const isPatientInExcel = (patient: Patient, rows: ExcelPatientRow[]): boolean => {
    if (!rows || rows.length === 0) return false;
    const pCode = (patient.patientCode || patient.medicalRecordNumber || patient.id || '').trim().toLowerCase();
    const pNameNorm = normalizeVietnameseString(patient.fullName);

    for (const row of rows) {
      const excelCode = (row.patientCode || '').trim().toLowerCase();
      // 1. Khớp theo mã bệnh nhân (mabn / medicalRecordNumber / id)
      if (excelCode && pCode) {
        if (
          pCode === excelCode ||
          (excelCode.length >= 4 && pCode.length >= 4 && (pCode.includes(excelCode) || excelCode.includes(pCode)))
        ) {
          return true;
        }
      }

      // 2. Khớp theo họ tên chuẩn hóa (accent-insensitive)
      const excelNameNorm = normalizeVietnameseString(row.patientName);
      if (excelNameNorm && pNameNorm && excelNameNorm === pNameNorm) {
        const excelRoomNorm = extractCleanRoomNumber(row.patientRoom);
        const pRoomNorm = extractCleanRoomNumber(patient.roomNumber);
        if (!row.patientRoom || !patient.roomNumber || excelRoomNorm === pRoomNorm) {
          return true;
        }
      }
    }

    return false;
  };

  // Hoàn tác: Khôi phục lại trạng thái nội trú cho bệnh nhân đã tự động cho ra viện
  const handleReactivatePatient = (patient: Patient) => {
    if (onReactivatePatient) {
      onReactivatePatient({
        ...patient,
        status: 'ACTIVE',
        admissionStatus: 'STABLE_INPATIENT',
        dischargeDate: undefined,
      });
    }
    setAutoDischargedPatients((prev) => prev.filter((p) => p.id !== patient.id));
    setNotification({
      message: `Đã khôi phục bệnh nhân "${patient.fullName}" (Phòng ${patient.roomNumber}) trở lại danh sách nội trú!`,
      type: 'info',
    });
  };

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
        const { rows: parsed, detectedHeaders: headers } = parseExcelFile(buffer);
        setExcelRows(parsed);
        setDetectedColumns(headers);

        // Theo yêu cầu: Tự động cho ra viện những ca có trong danh sách khoa nhưng KHÔNG CÓ trong file Excel
        if (parsed.length > 0 && existingPatients && existingPatients.length > 0) {
          const activeInpatients = existingPatients.filter((p) => p.status === 'ACTIVE');
          const toDischarge = activeInpatients.filter((p) => !isPatientInExcel(p, parsed));

          if (toDischarge.length > 0) {
            setAutoDischargedPatients(toDischarge);
            if (onAutoDischargePatients) {
              onAutoDischargePatients(toDischarge);
            }
            setNotification({
              message: `Đã đọc thành công ${parsed.length} BN từ file "${file.name}"! Tự động cho ra viện ${toDischarge.length} bệnh nhân không có trong file Excel.`,
              type: 'success',
            });
          } else {
            setNotification({
              message: `Đã đọc thành công ${parsed.length} bệnh nhân từ file "${file.name}"! Nhận diện được ${headers.length} cột dữ liệu.`,
              type: 'success',
            });
          }
        } else {
          setNotification({
            message: `Đã đọc thành công ${parsed.length} bệnh nhân từ file "${file.name}"! Nhận diện được ${headers.length} cột dữ liệu.`,
            type: 'success',
          });
        }
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

  // Deduplication Helper: Kiểm tra bệnh nhân đã có trong danh sách khoa chưa
  const checkPatientAlreadyExists = (row: ExcelPatientRow): { exists: boolean; existingRecord?: Patient } => {
    if (!existingPatients || existingPatients.length === 0) return { exists: false };
    const excelCode = (row.patientCode || '').trim().toLowerCase();
    const excelNameNorm = normalizeVietnameseString(row.patientName);
    const excelRoomNorm = extractCleanRoomNumber(row.patientRoom);

    for (const p of existingPatients) {
      // 1. Khớp theo mã bệnh nhân (mabn / medicalRecordNumber / id)
      if (excelCode) {
        if (
          (p.patientCode && p.patientCode.trim().toLowerCase() === excelCode) ||
          (p.medicalRecordNumber && p.medicalRecordNumber.trim().toLowerCase() === excelCode) ||
          (p.id && p.id.toLowerCase().includes(excelCode))
        ) {
          return { exists: true, existingRecord: p };
        }
      }

      // 2. Khớp theo họ tên chuẩn hóa và số phòng
      const pNameNorm = normalizeVietnameseString(p.fullName);
      const pRoomNorm = extractCleanRoomNumber(p.roomNumber);
      if (excelNameNorm && pNameNorm && excelNameNorm === pNameNorm) {
        if (!row.patientRoom || excelRoomNorm === pRoomNorm) {
          return { exists: true, existingRecord: p };
        }
      }
    }

    return { exists: false };
  };

  // Thống kê số lượng bệnh nhân đã có và bệnh nhân mới
  const { existingCount, newCount } = useMemo(() => {
    let exist = 0;
    let fresh = 0;
    excelRows.forEach(row => {
      if (checkPatientAlreadyExists(row).exists) {
        exist++;
      } else {
        fresh++;
      }
    });
    return { existingCount: exist, newCount: fresh };
  }, [excelRows, existingPatients]);

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
      diagnosis: sat.diagnosis || '', // Giữ chẩn đoán lâm sàng của vệ tinh (nếu có), không dùng ICD
      vitalSigns: sat.vitalSigns || excel.vitalSigns,
      medicalHistory: sat.medicalHistory || excel.medicalHistory,
      treatmentPlan: sat.treatmentPlan || excel.treatmentPlan,
    };

    const patientObj = mapClinicalRecordToPatient(mergedRecord, doctors, rooms, '');
    // Bác sĩ điều trị: Để trống theo yêu cầu lâm sàng (sẽ có người phân sau), không tự động gán người nhập
    patientObj.attendingDoctorId = '';
    // Mức độ mặc định: CHƯA PHÂN LOẠI
    patientObj.severity = 'UNCLASSIFIED';
    if (excel.admissionDate) {
      patientObj.admissionDate = excel.admissionDate;
    }
    if (excel.patientCode) patientObj.patientCode = excel.patientCode;
    if (excel.phoneNumber) patientObj.phoneNumber = excel.phoneNumber;
    if (excel.address) patientObj.address = excel.address;
    if (excel.insuranceNumber) patientObj.insuranceNumber = excel.insuranceNumber;
    if (excel.insuranceType) patientObj.insuranceType = excel.insuranceType;
    if (excel.treatmentDays !== undefined) patientObj.treatmentDays = excel.treatmentDays;
    patientObj.importantNotes = '';
    // Theo yêu cầu: Khi nhập dữ liệu từ Excel / Ghép nối, không tự động tích có dị ứng
    patientObj.allergies = undefined;
    patientObj.tags = (patientObj.tags || []).filter(t => t !== 'ALLERGY');

    onImportPatientDirect(patientObj);
    setImportedIds((prev) => new Set(prev).add(sat.id));

    setNotification({
      message: `Đã ghép nối bệnh nhân "${patientObj.fullName}" vào Phòng ${patientObj.roomNumber} (Chưa phân loại)!`,
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

  // Action: Import direct patient from Excel row (Bỏ qua chẩn đoán ICD trong file)
  const handleImportDirectFromExcel = (excelRow: ExcelPatientRow, index: number) => {
    const now = new Date();
    const defaultDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const ageNum = parseAgeNumber(excelRow.patientAge) || 60;
    const roomClean = excelRow.patientRoom || '703';

    // Ngày nhập viện: ưu tiên ngày đã parse chuẩn xác từ file Excel
    const finalAdmissionDate = excelRow.admissionDate && excelRow.admissionDate.trim() 
      ? excelRow.admissionDate 
      : defaultDateStr;

    // Bác sĩ điều trị: Để trống theo yêu cầu lâm sàng (sẽ có người phân sau), tuyệt đối không tự động lấy người nhập
    let matchedDocId = '';
    if (excelRow.doctorName) {
      const docFound = doctors.find(d => 
        excelRow.doctorName && (
          d.name.toLowerCase().includes(excelRow.doctorName.toLowerCase()) || 
          excelRow.doctorName.toLowerCase().includes(d.name.toLowerCase())
        )
      );
      if (docFound) matchedDocId = docFound.id;
    }

    const newPatient: Patient = {
      id: `EXCEL-${excelRow.patientCode || Date.now()}-${index}`,
      patientCode: excelRow.patientCode || undefined,
      fullName: excelRow.patientName || 'Bệnh Nhân Excel',
      age: ageNum,
      gender: excelRow.patientGender?.toLowerCase().includes('nữ') ? 'Nữ' : 'Nam',
      dateOfBirth: `${now.getFullYear() - ageNum}-01-01`,
      roomNumber: roomClean,
      bedNumber: excelRow.bedNumber || 'Giường 01',
      admissionDate: finalAdmissionDate,
      attendingDoctorId: matchedDocId,
      primaryNurse: 'Điều dưỡng phụ trách phòng',
      phoneNumber: excelRow.phoneNumber || undefined,
      address: excelRow.address || undefined,
      insuranceNumber: excelRow.insuranceNumber || undefined,
      insuranceType: excelRow.insuranceType || undefined,
      treatmentDays: excelRow.treatmentDays,
      // Theo yêu cầu BS: Bỏ qua chẩn đoán ICD trong file Excel, để trống chờ bác sĩ khám và chẩn đoán lâm sàng
      primaryDiagnosis: '',
      medicalHistory: excelRow.medicalHistory || undefined,
      // Theo yêu cầu BS: khi dán nhãn từ dữ liệu Excel, để CHƯA PHÂN LOẠI
      severity: 'UNCLASSIFIED',
      admissionStatus: 'ADMITTED_TODAY',
      tags: [],
      // Theo yêu cầu BS: Khi nhập dữ liệu từ Excel, không tự động tích có dị ứng
      allergies: undefined,
      // Bỏ hiển thị "Chăm sóc cấp 2, theo dõi sinh hiệu, ăn chế độ bệnh lý"
      treatmentPlan: excelRow.treatmentPlan || '',
      importantNotes: '',
      vitals: [],
      evolutions: [],
      labs: [],
      medications: [],
      status: 'ACTIVE',
    };

    onImportPatientDirect(newPatient);
    setImportedIds((prev) => new Set(prev).add(`excel-${index}`));

    setNotification({
      message: `Đã nhập bệnh nhân "${newPatient.fullName}" vào Phòng ${newPatient.roomNumber} [Chưa phân loại • Bỏ ICD]!`,
      type: 'success',
    });
    setTimeout(() => setNotification(null), 4000);
  };

  // Action: Nhập tất cả dữ liệu quét được từ file Excel (Tự động bỏ qua các bệnh nhân ĐÃ CÓ trong dữ liệu khoa)
  const handleImportAllExcelRows = () => {
    if (excelRows.length === 0) return;
    let count = 0;
    let skippedExisting = 0;

    // Kiểm tra và tự động cho ra viện các ca không còn trong file Excel
    const activeInpatients = (existingPatients || []).filter((p) => p.status === 'ACTIVE');
    const toDischarge = activeInpatients.filter((p) => !isPatientInExcel(p, excelRows));
    if (toDischarge.length > 0 && onAutoDischargePatients) {
      onAutoDischargePatients(toDischarge);
      setAutoDischargedPatients((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const newOnes = toDischarge.filter((p) => !seen.has(p.id));
        return [...prev, ...newOnes];
      });
    }

    excelRows.forEach((row, idx) => {
      const key = `excel-${idx}`;
      // Nếu đã có trong dữ liệu khoa -> BỎ QUA KHÔNG NHẬP THÊM
      if (checkPatientAlreadyExists(row).exists) {
        skippedExisting++;
        return;
      }
      if (!importedIds.has(key)) {
        handleImportDirectFromExcel(row, idx);
        count++;
      }
    });

    const dischargeMsg = toDischarge.length > 0 ? ` (Đã tự động cho ra viện ${toDischarge.length} BN không có trong file Excel)` : '';
    if (count > 0) {
      setNotification({
        message: `Đã nhập thành công ${count} bệnh nhân mới vào hệ thống! ${skippedExisting > 0 ? `(Đã tự động bỏ qua ${skippedExisting} bệnh nhân đã có sẵn trong khoa)` : ''}${dischargeMsg}`,
        type: 'success',
      });
    } else {
      setNotification({
        message: `Tất cả ${skippedExisting} bệnh nhân trong file đều đã có trong danh sách khoa, đã tự động bỏ qua không nhập trùng.${dischargeMsg}`,
        type: 'info',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-[96vw] shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* Header - Phong cách BV Hùng Vương Gia Lai */}
        <div className="px-5 py-4 bg-[#0b4d8c] text-white flex items-center justify-between border-b border-[#083a69] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-white uppercase">
                Nhập Dữ Liệu Excel / File Bệnh Án
              </h3>
              <p className="text-xs text-blue-100 mt-0.5">
                Bóc tách ngày nhập viện chuẩn xác • Bỏ qua mã ICD hành chính • Mặc định: Chưa phân loại
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
          <div className="bg-white p-5 rounded-2xl border-2 border-dashed border-[#0b4d8c]/30 hover:border-[#0b4d8c] transition-all text-center space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0b4d8c] flex items-center justify-center mx-auto shadow-xs">
              <Upload className="w-6 h-6" />
            </div>

            <div>
              <h4 className="text-sm font-black text-slate-900">
                {fileName ? `File đã chọn: ${fileName}` : 'Kéo thả hoặc Bấm chọn file Excel (.xlsx, .xls, .csv)'}
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-lg mx-auto">
                Hệ thống tự động nhận diện các cột: <strong className="text-slate-800">Họ tên, Ngày vào viện, Tuổi/Năm sinh, Giới tính, Phòng/Buồng</strong>.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3">
              <label className="px-5 py-2.5 bg-[#0b4d8c] hover:bg-[#083a69] text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center gap-2 active:scale-95">
                <FileSpreadsheet className="w-4 h-4" />
                <span>{fileName ? 'Chọn File Excel Khác' : 'Chọn File Excel (tr.xlsx)'}</span>
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
              </label>
            </div>

            {/* Hiển thị các cột phát hiện được từ file Excel */}
            {detectedColumns.length > 0 && (
              <div className="pt-2 border-t border-slate-100 text-left">
                <div className="text-[11px] font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-[#0b4d8c]" />
                  <span>Các cột phát hiện trong file ({detectedColumns.length} cột):</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                  {detectedColumns.map((col, idx) => (
                    <span 
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10.5px] font-medium text-slate-700"
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 0: Tự Động Cho Ra Viện các ca có trong danh sách khoa nhưng KHÔNG CÓ trong file Excel */}
          {autoDischargedPatients.length > 0 && (
            <div className="bg-purple-50/90 rounded-2xl border-2 border-purple-300 p-4 space-y-3 shadow-xs animate-in fade-in">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-purple-200 pb-2.5 gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-purple-950 uppercase flex items-center gap-2">
                      <span>Tự Động Cho Ra Viện</span>
                      <span className="px-2 py-0.5 rounded-full bg-purple-200 text-purple-900 text-xs font-mono font-black">
                        {autoDischargedPatients.length} BN
                      </span>
                    </h4>
                    <p className="text-xs text-purple-800 font-medium mt-0.5">
                      Các bệnh nhân sau có trong danh sách khoa nhưng <strong>không có trong file Excel vừa tải</strong>, hệ thống đã tự động ghi nhận ra viện.
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-black px-3 py-1 rounded-lg bg-purple-700 text-white shrink-0 shadow-2xs">
                  ✓ Đã Tự Động Cho Ra Viện
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {autoDischargedPatients.map((p) => (
                  <div 
                    key={p.id} 
                    className="p-3 rounded-xl bg-white border border-purple-200 hover:border-purple-300 flex items-center justify-between gap-2.5 shadow-2xs transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-slate-900 text-xs truncate">
                        {p.fullName}
                      </div>
                      <div className="text-[11px] text-purple-900 font-bold mt-0.5 flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 rounded font-mono font-black">
                          P.{p.roomNumber}
                        </span>
                        <span>•</span>
                        <span>{p.age}T</span>
                        <span>•</span>
                        <span>{p.gender}</span>
                      </div>
                      {p.primaryDiagnosis && (
                        <div className="text-[10.5px] text-slate-500 truncate mt-0.5 font-medium" title={p.primaryDiagnosis}>
                          {p.primaryDiagnosis}
                        </div>
                      )}
                    </div>

                    {onReactivatePatient && (
                      <button
                        type="button"
                        onClick={() => handleReactivatePatient(p)}
                        className="px-2 py-1 bg-slate-50 hover:bg-purple-100 text-slate-700 hover:text-purple-800 border border-slate-200 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1 active:scale-95"
                        title="Khôi phục bệnh nhân này lại danh sách nội trú nếu chưa muốn cho ra viện"
                      >
                        <RotateCcw className="w-3 h-3 text-purple-600" />
                        <span>Khôi phục</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

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

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
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
                          <span className="font-black text-slate-900">{formatPatientDisplayName(sat.patientName || sat.fullName)}</span>
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
              <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Database className="w-4 h-4 text-[#0b4d8c]" />
                  <h4 className="text-sm font-black text-slate-900 uppercase">
                    Danh Sách Quét Được Từ Excel ({excelRows.length} BN)
                  </h4>
                  {existingCount > 0 && (
                    <span className="text-[11px] text-slate-700 font-bold bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-300">
                      ✓ Đã có trong khoa: {existingCount} BN (Bỏ qua)
                    </span>
                  )}
                  <span className="text-[11px] text-emerald-800 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Sẵn sàng nhập: {newCount} BN mới
                  </span>
                  <span className="text-[11px] text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Bỏ qua mã ICD
                  </span>
                  {autoDischargedPatients.length > 0 && (
                    <span className="text-[11px] text-purple-800 font-bold bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200 flex items-center gap-1">
                      <LogOut className="w-3 h-3 text-purple-600" />
                      <span>Đã tự động cho ra viện: {autoDischargedPatients.length} BN</span>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleImportAllExcelRows}
                  disabled={newCount === 0}
                  className={`px-4 py-2 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                    newCount > 0
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  }`}
                  title={newCount > 0 ? `Nhập ${newCount} bệnh nhân mới vào hệ thống` : 'Tất cả bệnh nhân trong file đều đã có trong hệ thống'}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {newCount > 0
                      ? `Nhập ${newCount} bệnh nhân mới (Bỏ qua ${existingCount} BN đã có)`
                      : `Tất cả ${existingCount} BN đã có trong hệ thống`}
                  </span>
                </button>
              </div>

              <div className="overflow-x-auto max-h-80 overflow-y-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase sticky top-0 border-b border-slate-200 z-1">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">Mã BN</th>
                      <th className="p-2.5">Họ Và Tên</th>
                      <th className="p-2.5">Tuổi / Giới</th>
                      <th className="p-2.5">Phòng / Giường</th>
                      <th className="p-2.5">Ngày Vào Viện</th>
                      <th className="p-2.5">Chẩn Đoán ICD (Bỏ qua)</th>
                      <th className="p-2.5 text-right">Trạng Thái & Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {excelRows.map((row, idx) => {
                      const isImported = importedIds.has(`excel-${idx}`);
                      const { exists: alreadyInDept, existingRecord } = checkPatientAlreadyExists(row);

                      return (
                        <tr 
                          key={idx} 
                          className={`transition-colors ${
                            alreadyInDept 
                              ? 'bg-slate-50/60 opacity-80' 
                              : isImported 
                              ? 'bg-emerald-50/50' 
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <td className="p-2.5 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="p-2.5 font-mono text-slate-600 font-bold">
                            {row.patientCode || '---'}
                          </td>
                          <td className="p-2.5">
                            <div className="font-black text-slate-900 uppercase">
                              {row.patientName}
                            </div>
                            <div className="flex items-center gap-2 text-[10.5px] text-slate-400 font-normal">
                              {row.phoneNumber && <span>SĐT: {row.phoneNumber}</span>}
                              {row.insuranceNumber && <span>BHYT: {row.insuranceNumber}</span>}
                            </div>
                          </td>
                          <td className="p-2.5 font-semibold text-slate-700">
                            {row.patientAge}T • {row.patientGender}
                          </td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 font-black text-blue-900">
                              Phòng {row.patientRoom}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-700 font-medium">
                            {row.admissionDate ? (
                              <div className="flex items-center gap-1 text-emerald-800 font-bold">
                                <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>{row.admissionDate}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Mặc định hôm nay</span>
                            )}
                            {row.treatmentDays !== undefined && (
                              <div className="text-[10px] text-blue-700 font-bold">
                                SNĐT: {row.treatmentDays} ngày
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 text-slate-400 italic truncate max-w-[170px] line-through" title={row.icdDiagnosis || row.icdCode || 'Không có'}>
                            {row.icdDiagnosis || row.icdCode || 'Không có mã ICD'}
                          </td>
                          <td className="p-2.5 text-right">
                            {alreadyInDept ? (
                              <span 
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-300"
                                title={`Bệnh nhân đã có trong danh sách khoa (${existingRecord?.fullName || ''} - P.${existingRecord?.roomNumber || ''})`}
                              >
                                ✓ Đã có trong dữ liệu (Bỏ qua)
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleImportDirectFromExcel(row, idx)}
                                disabled={isImported}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  isImported
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-[#0b4d8c] hover:bg-[#083a69] text-white shadow-2xs active:scale-95'
                                }`}
                              >
                                {isImported ? 'Đã Nhập' : '+ Nhập Viện'}
                              </button>
                            )}
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
          <div className="text-slate-500 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Mặc định mức độ: <strong>Chưa phân loại</strong> • Bỏ qua ICD • Không tự ý thêm y lệnh giả định.</span>
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

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
  mergeExcelAndSatellitePatient, 
  ExcelPatientRow, 
  MatchedSatelliteRecord,
  normalizeVietnameseString,
  extractCleanRoomNumber,
  isPatientDuplicateWithExisting,
  extractDateOnly
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
  onDismissPendingSatelliteRecord?: (recordId: string) => void;
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
  onDismissPendingSatelliteRecord,
}) => {
  const [excelRows, setExcelRows] = useState<ExcelPatientRow[]>([]);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [autoDischargedPatients, setAutoDischargedPatients] = useState<Patient[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Helper: Kiểm tra bệnh nhân có xuất hiện trong danh sách hàng Excel không
  // Sử dụng chung bộ quy tắc đối soát chuẩn xác (Mã BN hoặc Họ tên + Tuổi + Ngày nhập viện)
  const isPatientInExcel = (patient: Patient, rows: ExcelPatientRow[]): boolean => {
    if (!rows || rows.length === 0) return false;

    for (const row of rows) {
      const dupCheck = isPatientDuplicateWithExisting(row, patient);
      if (dupCheck.isDuplicate) {
        return true;
      }
    }

    return false;
  };

  // Cho ra viện tất cả các ca có trong danh sách khoa nhưng KHÔNG CÓ trong file Excel
  const handleConfirmDischargeAllMissing = () => {
    if (!autoDischargedPatients || autoDischargedPatients.length === 0) return;
    if (onAutoDischargePatients) {
      onAutoDischargePatients(autoDischargedPatients);
      const count = autoDischargedPatients.length;
      setAutoDischargedPatients([]);
      setNotification({
        message: `✅ Đã cho ra viện thành công ${count} bệnh nhân không có trong file Excel!`,
        type: 'success',
      });
      setTimeout(() => setNotification(null), 5000);
    }
  };

  // Cho ra viện 1 ca cụ thể không có trong file Excel
  const handleConfirmDischargeSingle = (patient: Patient) => {
    if (onAutoDischargePatients) {
      onAutoDischargePatients([patient]);
      setAutoDischargedPatients((prev) => prev.filter((p) => p.id !== patient.id));
      setNotification({
        message: `✅ Đã cho ra viện bệnh nhân "${patient.fullName}" (P.${patient.roomNumber})!`,
        type: 'success',
      });
      setTimeout(() => setNotification(null), 4000);
    }
  };

  // Giữ lại bệnh nhân trong danh sách nội trú (loại khỏi danh sách chờ ra viện)
  const handleKeepPatient = (patient: Patient) => {
    setAutoDischargedPatients((prev) => prev.filter((p) => p.id !== patient.id));
    setNotification({
      message: `Đã giữ lại bệnh nhân "${patient.fullName}" (P.${patient.roomNumber}) trong danh sách khoa.`,
      type: 'info',
    });
    setTimeout(() => setNotification(null), 3000);
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
    reader.onload = async (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const { rows: parsed, detectedHeaders: headers } = await parseExcelFile(buffer);
        setExcelRows(parsed);
        setDetectedColumns(headers);

        // Kiểm tra đối soát những ca có trong danh sách khoa nhưng KHÔNG CÓ trong file Excel (chỉ đưa vào danh sách xem xét, không tự ý cho ra viện ngay khi mới đọc file)
        if (parsed.length > 0 && existingPatients && existingPatients.length > 0) {
          const activeInpatients = existingPatients.filter((p) => p.status === 'ACTIVE');
          const toDischarge = activeInpatients.filter((p) => !isPatientInExcel(p, parsed));
          setAutoDischargedPatients(toDischarge);

          setNotification({
            message: `Đã đọc thành công ${parsed.length} bệnh nhân từ file "${file.name}"! Nhận diện được ${headers.length} cột dữ liệu.`,
            type: 'success',
          });
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
  // Tiêu chí đối soát (theo yêu cầu BS): Nếu trùng Họ tên, Tuổi, Ngày nhập viện thì bỏ qua không nhập
  const checkPatientAlreadyExists = (row: ExcelPatientRow): { 
    exists: boolean; 
    isDischarged?: boolean;
    roomMismatch?: boolean;
    existingRecord?: Patient; 
    reason?: string 
  } => {
    if (!existingPatients || existingPatients.length === 0) return { exists: false };

    for (const p of existingPatients) {
      const dupCheck = isPatientDuplicateWithExisting(row, p);
      if (dupCheck.isDuplicate) {
        const isDischarged = p.status === 'DISCHARGED';
        const rowRoom = extractCleanRoomNumber(row.patientRoom);
        const pRoom = extractCleanRoomNumber(p.roomNumber);
        const roomMismatch = !isDischarged && Boolean(rowRoom && pRoom && rowRoom !== pRoom);
        return { 
          // Chỉ coi là đã tồn tại trọn vẹn (bỏ qua không làm gì) nếu đang ACTIVE và CÙNG buồng phòng
          exists: !isDischarged && !roomMismatch, 
          isDischarged,
          roomMismatch,
          existingRecord: p, 
          reason: dupCheck.reason 
        };
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

    // Kiểm tra chặn trùng lặp trước khi tiếp nhận
    const dupCheck = checkPatientAlreadyExists(excel);
    if (dupCheck.exists) {
      setNotification({
        message: `Bệnh nhân "${excel.patientName}" đã có trong danh sách khoa (${dupCheck.reason || 'đã tồn tại'}), bỏ qua ghép nối trùng!`,
        type: 'info',
      });
      return;
    }

    // Sử dụng bộ engine hợp nhất đa nguồn: Excel (Hành chính) + Vệ tinh (Lâm sàng)
    const patientObj = mergeExcelAndSatellitePatient(excel, sat, doctors, rooms, '');
    patientObj.attendingDoctorId = ''; // Bác sĩ điều trị: Để trống theo yêu cầu lâm sàng

    onImportPatientDirect(patientObj);
    if (onDismissPendingSatelliteRecord) {
      onDismissPendingSatelliteRecord(sat.id);
    }
    setImportedIds((prev) => {
      const next = new Set(prev);
      next.add(sat.id);
      const excelIdx = excelRows.indexOf(excel);
      if (excelIdx !== -1) {
        next.add(`excel-${excelIdx}`);
      }
      return next;
    });

    setNotification({
      message: `Đã ghép nối bệnh nhân "${patientObj.fullName}" vào Phòng ${patientObj.roomNumber} (Admin Excel + Lâm sàng Vệ tinh)!`,
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
    // Kiểm tra chặn trùng lặp trước khi tiếp nhận trực tiếp
    const dupCheck = checkPatientAlreadyExists(excelRow);
    const existingRec = dupCheck.existingRecord;

    // 1. Nếu đã có trong khoa và cùng buồng phòng -> bỏ qua
    if (dupCheck.exists) {
      setNotification({
        message: `Bệnh nhân "${excelRow.patientName}" đã có trong danh sách khoa (${dupCheck.reason || 'đã tồn tại'}), tự động bỏ qua để tránh trùng!`,
        type: 'info',
      });
      return;
    }

    const roomClean = extractCleanRoomNumber(excelRow.patientRoom) || '703';

    // 2. Nếu bệnh nhân đã có nhưng đang ở trạng thái Ra viện (DISCHARGED) -> Khôi phục lại nội trú!
    if (dupCheck.isDischarged && existingRec) {
      const reactivated: Patient = {
        ...existingRec,
        status: 'ACTIVE',
        admissionStatus: 'ADMITTED_TODAY',
        roomNumber: roomClean,
        bedNumber: excelRow.bedNumber || existingRec.bedNumber || 'Giường 01',
        admissionDate: excelRow.admissionDate || existingRec.admissionDate,
        dischargeDate: undefined,
        dischargeTomorrowSetDate: undefined,
      };
      if (onReactivatePatient) {
        onReactivatePatient(reactivated);
      } else {
        onImportPatientDirect(reactivated);
      }
      setImportedIds((prev) => new Set(prev).add(`excel-${index}`));
      setNotification({
        message: `Đã khôi phục bệnh nhân "${reactivated.fullName}" trở lại danh sách nội trú vào Phòng ${reactivated.roomNumber}!`,
        type: 'success',
      });
      setTimeout(() => setNotification(null), 4000);
      return;
    }

    // 3. Nếu bệnh nhân đang ACTIVE nhưng lệch buồng phòng -> Cập nhật buồng phòng mới từ Excel!
    if (dupCheck.roomMismatch && existingRec) {
      const moved: Patient = {
        ...existingRec,
        roomNumber: roomClean,
        bedNumber: excelRow.bedNumber || existingRec.bedNumber || 'Giường 01',
      };
      if (onReactivatePatient) {
        onReactivatePatient(moved);
      } else {
        onImportPatientDirect(moved);
      }
      setImportedIds((prev) => new Set(prev).add(`excel-${index}`));
      setNotification({
        message: `Đã cập nhật buồng phòng cho BN "${moved.fullName}": P.${existingRec.roomNumber} ➔ P.${moved.roomNumber}!`,
        type: 'success',
      });
      setTimeout(() => setNotification(null), 4000);
      return;
    }

    const now = new Date();
    const defaultDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const ageNum = parseAgeNumber(excelRow.patientAge) || 60;

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
      // Theo yêu cầu BS: Mặc định hiển thị "Nhập chẩn đoán" cho bệnh nhân nhập từ Excel chờ bác sĩ khám
      primaryDiagnosis: 'Nhập chẩn đoán',
      medicalHistory: excelRow.medicalHistory || undefined,
      // Theo yêu cầu BS: khi dán nhãn từ dữ liệu Excel, để Chưa phân loại
      severity: 'UNCLASSIFIED',
      admissionStatus: 'ADMITTED_TODAY',
      tags: [],
      // Theo yêu cầu BS: Khi nhập dữ liệu từ Excel, không tự động tích có dị ứng
      allergies: undefined,
      // Mặc định hiển thị "Nhập hướng điều trị" cho bệnh nhân nhập từ Excel
      treatmentPlan: excelRow.treatmentPlan || 'Nhập hướng điều trị',
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

  // Action: Nhập tất cả dữ liệu quét được từ file Excel (Tự động cập nhật buồng, thêm ca mới, cho ra viện ca không có trong file)
  const handleImportAllExcelRows = () => {
    if (excelRows.length === 0) return;
    let count = 0;
    let skippedExisting = 0;
    let mergedCount = 0;
    let reactivatedCount = 0;
    let movedCount = 0;

    // 1. Cho ra viện toàn bộ các ca có trong khoa nhưng KHÔNG CÓ trong file Excel chuẩn
    let dischargedCount = 0;
    if (autoDischargedPatients.length > 0 && onAutoDischargePatients) {
      dischargedCount = autoDischargedPatients.length;
      onAutoDischargePatients(autoDischargedPatients);
      setAutoDischargedPatients([]);
    }

    const patientsToBatch: Patient[] = [];
    const newImportedIds = new Set(importedIds);
    const now = new Date();
    const currentYear = now.getFullYear();
    const defaultDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    excelRows.forEach((row, idx) => {
      const key = `excel-${idx}`;
      const check = checkPatientAlreadyExists(row);
      const existingRec = check.existingRecord;
      const roomClean = extractCleanRoomNumber(row.patientRoom) || '703';

      // 1. Nếu đã có trong khoa và cùng phòng -> bỏ qua không nhập thêm
      if (check.exists) {
        skippedExisting++;
        return;
      }

      if (!newImportedIds.has(key)) {
        // Tự động kiểm tra xem hàng Excel này có bản ghi Vệ Tinh chờ ghép nối không
        const matchedSat = matchedRecords.find((m) => m.matchedExcelRow === row && !newImportedIds.has(m.satelliteRecord.id));
        if (matchedSat) {
          const sat = matchedSat.satelliteRecord;
          const mapped = mapClinicalRecordToPatient(sat, doctors, rooms, currentUser?.id);
          mapped.roomNumber = roomClean;
          mapped.bedNumber = row.bedNumber || extractCleanBedNumber(row.bedNumber) || 'Giường 01';
          mapped.status = 'ACTIVE';
          mapped.admissionStatus = 'ADMITTED_TODAY';
          mapped.dischargeDate = undefined;
          patientsToBatch.push(mapped);
          newImportedIds.add(sat.id);
          newImportedIds.add(key);
          mergedCount++;
          count++;
          return;
        }

        // 2. Nếu bệnh nhân đã có nhưng đang ở trạng thái Ra viện (DISCHARGED) -> Khôi phục lại nội trú!
        if (check.isDischarged && existingRec) {
          const reactivated: Patient = {
            ...existingRec,
            status: 'ACTIVE',
            admissionStatus: 'ADMITTED_TODAY',
            roomNumber: roomClean,
            bedNumber: row.bedNumber || existingRec.bedNumber || 'Giường 01',
            admissionDate: row.admissionDate || existingRec.admissionDate,
            dischargeDate: undefined,
            dischargeTomorrowSetDate: undefined,
          };
          patientsToBatch.push(reactivated);
          newImportedIds.add(key);
          reactivatedCount++;
          count++;
          return;
        }

        // 3. Nếu bệnh nhân đang ACTIVE nhưng lệch buồng phòng -> Cập nhật buồng phòng mới từ Excel!
        if (check.roomMismatch && existingRec) {
          const moved: Patient = {
            ...existingRec,
            roomNumber: roomClean,
            bedNumber: row.bedNumber || existingRec.bedNumber || 'Giường 01',
          };
          patientsToBatch.push(moved);
          newImportedIds.add(key);
          movedCount++;
          count++;
          return;
        }

        // 4. Bệnh nhân mới hoàn toàn từ Excel
        const ageNum = parseAgeNumber(row.patientAge) || 60;
        const finalAdmissionDate = row.admissionDate && row.admissionDate.trim() 
          ? row.admissionDate 
          : defaultDateStr;

        let matchedDocId = '';
        if (row.doctorName) {
          const docFound = doctors.find(d => 
            row.doctorName && (
              d.name.toLowerCase().includes(row.doctorName.toLowerCase()) || 
              row.doctorName.toLowerCase().includes(d.name.toLowerCase())
            )
          );
          if (docFound) matchedDocId = docFound.id;
        }

        const newPatient: Patient = {
          id: `EXCEL-${row.patientCode || Date.now()}-${idx}`,
          patientCode: row.patientCode || undefined,
          fullName: row.patientName || 'Bệnh Nhân Excel',
          age: ageNum,
          gender: (row.patientGender?.toLowerCase().includes('nữ') || row.patientGender?.toLowerCase() === 'nu') ? 'Nữ' : 'Nam',
          dateOfBirth: `${currentYear - ageNum}-01-01`,
          admissionDate: finalAdmissionDate,
          department: 'Khoa Nội Tổng Hợp',
          roomNumber: roomClean,
          bedNumber: row.bedNumber || 'Giường 01',
          attendingDoctorId: matchedDocId,
          primaryNurse: 'ĐD. Tua trực tiếp nhận',
          primaryDiagnosis: '',
          icd10Primary: row.icdCode || undefined,
          secondaryDiagnosis: row.icdDiagnosis || undefined,
          severity: 'UNCLASSIFIED',
          admissionStatus: 'ADMITTED_TODAY',
          tags: [],
          importantNotes: 'Nhập tự động từ file Excel HIS. Đang cập nhật chẩn đoán lâm sàng và y lệnh.',
          status: 'ACTIVE',
          vitals: [],
          evolutions: [],
          labs: [],
          medications: [],
          phoneNumber: row.phoneNumber || undefined,
          address: row.address || undefined,
          insuranceNumber: row.insuranceNumber || undefined,
          insuranceType: row.insuranceType || undefined,
          treatmentDays: row.treatmentDays || undefined,
        };

        patientsToBatch.push(newPatient);
        newImportedIds.add(key);
        count++;
      }
    });

    setImportedIds(newImportedIds);

    // Đồng bộ toàn bộ danh sách trong một đợt nguyên tử
    if (patientsToBatch.length > 0) {
      if (onImportMultiplePatients) {
        onImportMultiplePatients(patientsToBatch);
      } else {
        patientsToBatch.forEach((p) => onImportPatientDirect(p));
      }
    }

    const dischargeMsg = dischargedCount > 0 ? ` (Đã cho ra viện ${dischargedCount} ca không có trong file Excel)` : '';
    const mergeMsg = mergedCount > 0 ? ` (Ghép nối ${mergedCount} ca Bệnh án Vệ tinh)` : '';
    const reactivateMsg = reactivatedCount > 0 ? ` (Khôi phục ${reactivatedCount} ca đã ra viện)` : '';
    const moveMsg = movedCount > 0 ? ` (Đổi buồng cho ${movedCount} ca)` : '';
    if (count > 0 || dischargedCount > 0) {
      setNotification({
        message: `Đã hoàn tất đồng bộ danh sách theo file Excel!${dischargeMsg}${mergeMsg}${reactivateMsg}${moveMsg} ${skippedExisting > 0 ? `(Đã giữ nguyên ${skippedExisting} bệnh nhân đã ổn định đúng buồng)` : ''}`,
        type: 'success',
      });
    } else {
      setNotification({
        message: `Tất cả ${skippedExisting} bệnh nhân trong file đều đã có đúng buồng trong danh sách khoa, danh sách hiện tại đã khớp chuẩn.`,
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
            <div className="bg-rose-50/90 rounded-2xl border-2 border-rose-300 p-4 space-y-3 shadow-xs animate-in fade-in">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-rose-200 pb-2.5 gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-rose-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-rose-950 uppercase flex items-center gap-2">
                      <span>Đối Soát Ra Viện Theo File Excel</span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 text-xs font-mono font-black">
                        {autoDischargedPatients.length} BN không có trong file
                      </span>
                    </h4>
                    <p className="text-xs text-rose-800 font-medium mt-0.5">
                      Danh sách file Excel là chuẩn nhất. <strong>{autoDischargedPatients.length} bệnh nhân</strong> dưới đây hiện có trong khoa nhưng không có trong file Excel, cần làm thủ tục cho ra viện.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleConfirmDischargeAllMissing}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                    title="Cho ra viện tất cả các bệnh nhân không có trong file Excel này"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>🚪 Cho Ra Viện Tất Cả ({autoDischargedPatients.length} ca)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {autoDischargedPatients.map((p) => (
                  <div 
                    key={p.id} 
                    className="p-3 rounded-xl bg-white border border-rose-200 hover:border-rose-300 flex items-center justify-between gap-2.5 shadow-2xs transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-slate-900 text-xs truncate">
                        {p.fullName}
                      </div>
                      <div className="text-[11px] text-rose-900 font-bold mt-0.5 flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 rounded font-mono font-black">
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

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleConfirmDischargeSingle(p)}
                        className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                        title="Cho ra viện ca này"
                      >
                        <LogOut className="w-3 h-3 text-rose-600" />
                        <span>Ra viện</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleKeepPatient(p)}
                        className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                        title="Giữ lại trong danh sách khoa (không cho ra viện)"
                      >
                        <span>Giữ lại</span>
                      </button>
                    </div>
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
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                            ⭐ {match.confidenceScore || 100}% {match.matchReason || `Khớp theo ${match.matchedField}`}
                          </span>
                          {isMerged && (
                            <span className="text-[10.5px] px-2 py-0.2 rounded-full bg-emerald-600 text-white font-bold">
                              ✓ Đã nhập
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11.5px] text-slate-700 flex-wrap">
                          <span className="bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                            Vệ tinh lâm sàng: {sat.diagnosis ? `CĐ: ${sat.diagnosis}` : 'Chưa ghi CĐ'} {sat.vitalSigns ? `• ${sat.vitalSigns}` : ''}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="bg-emerald-100 text-emerald-900 px-1.5 py-0.2 rounded font-black">
                            Excel hành chính: Phòng {match.proposedRoom} • {match.proposedAge}T
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
                    <span className="text-[11px] text-rose-800 font-bold bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200 flex items-center gap-1">
                      <LogOut className="w-3 h-3 text-rose-600" />
                      <span>Cần cho ra viện: {autoDischargedPatients.length} BN không có trong file</span>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleImportAllExcelRows}
                  disabled={newCount === 0 && autoDischargedPatients.length === 0}
                  className={`px-4 py-2 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                    newCount > 0 || autoDischargedPatients.length > 0
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  }`}
                  title="Đồng bộ danh sách buồng phòng theo chuẩn file Excel"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {newCount > 0 && autoDischargedPatients.length > 0
                      ? `⚡ Đồng bộ toàn diện (Nhập ${newCount} BN mới & Cho ra viện ${autoDischargedPatients.length} ca)`
                      : newCount > 0
                      ? `Nhập ${newCount} bệnh nhân mới (Bỏ qua ${existingCount} BN đã có)`
                      : autoDischargedPatients.length > 0
                      ? `⚡ Đồng bộ theo file Excel (Cho ra viện ${autoDischargedPatients.length} ca không có trong file)`
                      : `Tất cả ${existingCount} BN đã khớp chuẩn với file Excel`}
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
                      <th className="p-2.5">Phòng Bệnh</th>
                      <th className="p-2.5">Ngày Vào Viện</th>
                      <th className="p-2.5">Chẩn Đoán ICD (Bỏ qua)</th>
                      <th className="p-2.5 text-right">Trạng Thái & Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {excelRows.map((row, idx) => {
                      const isImported = importedIds.has(`excel-${idx}`);
                      const dupCheck = checkPatientAlreadyExists(row);
                      const { exists: alreadyInDept, existingRecord, reason: dupReason } = dupCheck;

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
                            <div className="font-black text-slate-900 uppercase flex items-center gap-1.5 flex-wrap">
                              <span>{row.patientName}</span>
                              {matchedRecords.some((m) => m.matchedExcelRow === row) && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  ✨ Khớp Vệ Tinh
                                </span>
                              )}
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
                                title={`Bệnh nhân đã có trong danh sách khoa: ${existingRecord?.fullName || ''} - P.${existingRecord?.roomNumber || ''} (${dupReason || 'Trùng thông tin'})`}
                              >
                                ✓ Đang ở P.{existingRecord?.roomNumber}
                              </span>
                            ) : dupCheck.isDischarged ? (
                              <button
                                type="button"
                                onClick={() => handleImportDirectFromExcel(row, idx)}
                                disabled={isImported}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 ${
                                  isImported
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-purple-600 hover:bg-purple-700 text-white shadow-2xs active:scale-95'
                                }`}
                                title="Bệnh nhân này trước đó đã ở trạng thái Ra viện. Bấm để khôi phục lại danh sách nội trú!"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>{isImported ? 'Đã Khôi Phục' : `Khôi phục vào P.${row.patientRoom}`}</span>
                              </button>
                            ) : dupCheck.roomMismatch ? (
                              <button
                                type="button"
                                onClick={() => handleImportDirectFromExcel(row, idx)}
                                disabled={isImported}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 ${
                                  isImported
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs active:scale-95'
                                }`}
                                title={`Bệnh nhân đang lưu ở P.${existingRecord?.roomNumber}. Bấm để chuyển sang P.${row.patientRoom}!`}
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                                <span>{isImported ? 'Đã Đổi Buồng' : `Đổi P.${existingRecord?.roomNumber} ➔ P.${row.patientRoom}`}</span>
                              </button>
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

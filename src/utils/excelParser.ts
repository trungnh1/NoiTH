import * as XLSX from 'xlsx';
import { ClinicalRecord, parseAgeNumber } from '../services/clinicalFirebase';

export interface ExcelPatientRow {
  id?: string;
  patientCode?: string; // Mã BN / Mã HSBA / mabn
  patientName: string;
  patientAge: string | number;
  patientGender: string;
  patientRoom: string;
  bedNumber?: string;
  admissionDate?: string; // YYYY-MM-DD HH:mm
  admissionDateRaw?: string; // Nguyên bản từ file để kiểm tra
  icdCode?: string; // Mã ICD10
  icdDiagnosis?: string; // Tên chẩn đoán ICD hành chính (không dùng làm chẩn đoán lâm sàng)
  diagnosis?: string; // Chẩn đoán lâm sàng (để trống theo yêu cầu BS)
  doctorName?: string; // Bác sĩ điều trị trong file (nếu có)
  phoneNumber?: string; // SĐT
  address?: string; // Địa chỉ
  insuranceNumber?: string; // Số thẻ BHYT
  insuranceType?: string; // Đối tượng BHYT / Viện phí
  treatmentDays?: number; // Số ngày điều trị (SNĐT)
  vitalSigns?: string;
  medicalHistory?: string;
  treatmentPlan?: string;
  rawRow: Record<string, any>;
}

export interface MatchedSatelliteRecord {
  satelliteRecord: ClinicalRecord;
  matchedExcelRow: ExcelPatientRow;
  matchedField: string; // e.g., 'Tên bệnh nhân'
  missingFields: string[];
  proposedRoom: string;
  proposedAge: number;
}

/**
 * Remove Vietnamese accents and trim string for fuzzy matching
 */
export function normalizeVietnameseString(str?: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Chuyển đổi an toàn ngày nhập viện từ Excel thành định dạng chuẩn: YYYY-MM-DD HH:mm
 * Hỗ trợ:
 * 1. Date object (khi dùng cellDates: true)
 * 2. Số Serial Date của Excel (vd: 45591 hoặc 45591.35416)
 * 3. Chuỗi định dạng Việt Nam: DD/MM/YYYY HH:mm:ss, DD/MM/YYYY HH:mm, DD/MM/YYYY, DD-MM-YYYY
 * 4. Chuỗi giờ trước ngày: HH:mm DD/MM/YYYY hoặc HHhMM DD/MM/YYYY
 * 5. Chuỗi ISO: YYYY-MM-DD HH:mm
 */
export function parseExcelAdmissionDate(rawVal: any): { formatted: string; raw: string } {
  if (rawVal === undefined || rawVal === null || rawVal === '') {
    return { formatted: '', raw: '' };
  }

  const rawStr = String(rawVal).trim();

  // 1. Nếu đã là Date object
  if (rawVal instanceof Date) {
    if (isNaN(rawVal.getTime())) return { formatted: '', raw: rawStr };
    const y = rawVal.getFullYear();
    const m = String(rawVal.getMonth() + 1).padStart(2, '0');
    const d = String(rawVal.getDate()).padStart(2, '0');
    const h = String(rawVal.getHours()).padStart(2, '0');
    const min = String(rawVal.getMinutes()).padStart(2, '0');
    return { formatted: `${y}-${m}-${d} ${h}:${min}`, raw: rawStr };
  }

  // 2. Nếu là số Serial Date của Excel (thường từ 35000 đến 65000)
  const numVal = typeof rawVal === 'number' ? rawVal : Number(rawStr);
  if (!isNaN(numVal) && numVal > 30000 && numVal < 75000) {
    try {
      // Excel epoch là 1899-12-30 (tính cả lỗi nhuận 1900 của Lotus 1-2-3 / Excel)
      const excelEpochMs = Date.UTC(1899, 11, 30);
      const totalMs = Math.round(excelEpochMs + numVal * 86400 * 1000);
      const date = new Date(totalMs);
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date.getUTCDate()).padStart(2, '0');
      const h = String(date.getUTCHours()).padStart(2, '0');
      const min = String(date.getUTCMinutes()).padStart(2, '0');
      return { formatted: `${y}-${m}-${d} ${h}:${min}`, raw: rawStr };
    } catch {
      // fallback tiếp bên dưới
    }
  }

  // 3. Chuỗi định dạng ngày Việt Nam: DD/MM/YYYY hoặc DD-MM-YYYY (kèm hoặc không kèm giờ)
  // Ví dụ: "26/10/2026 08:30:00", "26/10/2026 08:30", "26/10/2026", "26-10-2026 14:15"
  const dmyRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[\s,T]+(\d{1,2})[:h](\d{1,2})(?::(\d{1,2}))?)?$/i;
  const matchDMY = rawStr.match(dmyRegex);
  if (matchDMY) {
    const day = matchDMY[1].padStart(2, '0');
    const month = matchDMY[2].padStart(2, '0');
    const year = matchDMY[3];
    const hour = matchDMY[4] ? matchDMY[4].padStart(2, '0') : '08';
    const min = matchDMY[5] ? matchDMY[5].padStart(2, '0') : '00';
    return { formatted: `${year}-${month}-${day} ${hour}:${min}`, raw: rawStr };
  }

  // 4. Chuỗi giờ trước ngày: "08:30 26/10/2026" hoặc "08h30 26/10/2026"
  const timeDMYRegex = /^(\d{1,2})[:h](\d{1,2})(?::\d{1,2})?[\s,]+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/i;
  const matchTimeDMY = rawStr.match(timeDMYRegex);
  if (matchTimeDMY) {
    const hour = matchTimeDMY[1].padStart(2, '0');
    const min = matchTimeDMY[2].padStart(2, '0');
    const day = matchTimeDMY[3].padStart(2, '0');
    const month = matchTimeDMY[4].padStart(2, '0');
    const year = matchTimeDMY[5];
    return { formatted: `${year}-${month}-${day} ${hour}:${min}`, raw: rawStr };
  }

  // 5. Chuỗi ISO: "2026-10-26" hoặc "2026-10-26 08:30"
  const isoRegex = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[\s,T]+(\d{1,2})[:h](\d{1,2}))?/;
  const matchISO = rawStr.match(isoRegex);
  if (matchISO) {
    const year = matchISO[1];
    const month = matchISO[2].padStart(2, '0');
    const day = matchISO[3].padStart(2, '0');
    const hour = matchISO[4] ? matchISO[4].padStart(2, '0') : '08';
    const min = matchISO[5] ? matchISO[5].padStart(2, '0') : '00';
    return { formatted: `${year}-${month}-${day} ${hour}:${min}`, raw: rawStr };
  }

  return { formatted: rawStr, raw: rawStr };
}

/**
 * Trích xuất số phòng chuẩn từ chuỗi Excel (vd: "Phòng 743", "Phòng 705", "Phòng 735", "705")
 */
export function extractCleanRoomNumber(roomRaw?: string): string {
  if (!roomRaw) return '703';
  const str = String(roomRaw).trim();
  
  // 1. Match số phòng 3 chữ số bắt đầu bằng 7 (chuẩn Khoa Nội TH - Tim Mạch: 703 -> 757)
  const match7xx = str.match(/\b(7\d{2})\b/);
  if (match7xx) return match7xx[1];

  // 2. Match bất kỳ số phòng 3 chữ số nào
  const any3Digit = str.match(/\b(\d{3})\b/);
  if (any3Digit) return any3Digit[1];

  // 3. Làm sạch các tiền tố thông thường nếu không phải dạng 3 số chuẩn
  const cleaned = str
    .replace(/^(phòng|buồng|phong|buong|p\.?|b\.?)\s*/i, '')
    .trim();
  return cleaned || '703';
}

/**
 * Trích xuất chuẩn xác giá trị phòng từ dòng Excel.
 * Ưu tiên tuyệt đối cột có tên/mã 'tenphong' theo dữ liệu HIS BV Hùng Vương Gia Lai.
 * BỎ QUA HOÀN TOÀN các cột mã phòng (maphong, maphongth) vì đó là mã số nội bộ (93, 96, 376...), không phải số phòng.
 */
export function findRoomValue(row: Record<string, any>): string {
  // 1. ƯU TIÊN SỐ 1: Cột có mã 'tenphong' hoặc 'ten phong', 'ten_phong'
  for (const [rawKey, val] of Object.entries(row)) {
    const k = normalizeVietnameseString(rawKey).replace(/[^a-z0-9]/g, '');
    const strVal = String(val ?? '').trim();
    if (!strVal) continue;
    if (k === 'tenphong' || k === 'tenbuong') {
      return strVal;
    }
  }

  // 2. ƯU TIÊN SỐ 2: Cột chứa 'tenphong' hoặc 'ten phong'
  for (const [rawKey, val] of Object.entries(row)) {
    const k = normalizeVietnameseString(rawKey);
    const strVal = String(val ?? '').trim();
    if (!strVal) continue;
    if (k.includes('tenphong') || k.includes('ten phong') || k.includes('ten buong')) {
      return strVal;
    }
  }

  // 3. ƯU TIÊN SỐ 3: Cột 'phong' hoặc 'buong' hoặc 'so phong', 'so buong', 'room'
  // BỎ QUA TUYỆT ĐỐI các cột mã phòng (maphong, maphongth, ma phong, mabuong)
  for (const [rawKey, val] of Object.entries(row)) {
    const k = normalizeVietnameseString(rawKey);
    const strVal = String(val ?? '').trim();
    if (!strVal) continue;
    
    // Loại trừ hoàn toàn các cột mã phòng
    if (k.startsWith('ma') || k.includes('maphong') || k.includes('ma phong') || k.includes('mabuong')) {
      continue;
    }

    if (k === 'phong' || k === 'so phong' || k === 'buong' || k === 'so buong' || k === 'room') {
      return strVal;
    }
  }

  // 4. ƯU TIÊN SỐ 4: Bất kỳ cột nào chứa 'phong' hoặc 'buong' nhưng TUYỆT ĐỐI không chứa 'ma'
  for (const [rawKey, val] of Object.entries(row)) {
    const k = normalizeVietnameseString(rawKey);
    const strVal = String(val ?? '').trim();
    if (!strVal) continue;
    if (k.startsWith('ma') || k.includes('maphong') || k.includes('ma phong') || k.includes('mabuong')) {
      continue;
    }
    if (k.includes('phong') || k.includes('buong')) {
      return strVal;
    }
  }

  return '';
}

/**
 * Trích xuất chuẩn xác giá trị giường từ dòng Excel.
 * Ưu tiên cột 'sogiuong', 'giuong', 'tengiuong' thay vì 'magiuong' (mã giường nội bộ 286, 44...).
 */
export function findBedValue(row: Record<string, any>): string {
  // 1. Ưu tiên cột 'sogiuong', 'giuong', 'tengiuong'
  for (const [rawKey, val] of Object.entries(row)) {
    const k = normalizeVietnameseString(rawKey).replace(/[^a-z0-9]/g, '');
    const strVal = String(val ?? '').trim();
    if (!strVal) continue;
    if (k.startsWith('ma') || k.includes('magiuong') || k.includes('magiuongth')) continue;
    if (k === 'sogiuong' || k === 'giuong' || k === 'tengiuong' || k === 'bed') {
      return strVal;
    }
  }

  // 2. Cột chứa 'giuong' hoặc 'bed' nhưng không chứa 'ma'
  for (const [rawKey, val] of Object.entries(row)) {
    const k = normalizeVietnameseString(rawKey);
    const strVal = String(val ?? '').trim();
    if (!strVal) continue;
    if (k.startsWith('ma') || k.includes('magiuong') || k.includes('magiuongth')) continue;
    if (k.includes('giuong') || k.includes('bed')) {
      return strVal;
    }
  }

  return '';
}

/**
 * Làm sạch số giường từ HIS/Excel (vd: "G743-4_H0516...", "G705-1_H0526..." -> "G743-4" hoặc "Giường 01")
 */
export function extractCleanBedNumber(bedRaw?: string): string {
  if (!bedRaw) return 'Giường 01';
  const str = String(bedRaw).trim();
  const gMatch = str.match(/(G\d+[\-_]\d+|G\d+)/i);
  if (gMatch) return gMatch[1].replace('_', '-');
  if (str.includes('_')) {
    const first = str.split('_')[0].trim();
    if (first) return first;
  }
  const cleaned = str.replace(/^(giường|g\.?)\s*/i, 'Giường ').trim();
  return cleaned || 'Giường 01';
}

/**
 * Parses binary/arraybuffer Excel/CSV file content into structured ExcelPatientRow list
 */
export function parseExcelFile(fileBuffer: ArrayBuffer | Uint8Array): {
  rows: ExcelPatientRow[];
  detectedHeaders: string[];
  sheetNames: string[];
} {
  // Bật cellDates: true để SheetJS tự động nhận diện ngày tháng nếu ô được format là Date
  const workbook = XLSX.read(fileBuffer, { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0] || 'Sheet1';
  const worksheet = workbook.Sheets[firstSheetName];
  
  if (!worksheet) {
    return { rows: [], detectedHeaders: [], sheetNames: workbook.SheetNames };
  }

  const jsonRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  // Lấy danh sách các cột thực tế có trong file
  const detectedHeadersSet = new Set<string>();
  jsonRows.slice(0, 10).forEach(row => {
    Object.keys(row).forEach(k => detectedHeadersSet.add(k));
  });
  const detectedHeaders = Array.from(detectedHeadersSet);

  const rows: ExcelPatientRow[] = [];
  const currentYear = new Date().getFullYear();

  jsonRows.forEach((row, rowIndex) => {
    let patientCode = '';
    let nameVal = '';
    let ageVal: any = '';
    let birthYearVal: any = '';
    let genderVal = '';
    // Lấy số phòng chuẩn từ cột 'tenphong' và số giường từ 'sogiuong'/'giuong'
    let roomVal = findRoomValue(row);
    let bedVal = findBedValue(row);
    let admissionDateVal: any = null;
    let fallbackDateVal: any = null;
    let icdCodeVal = '';
    let icdDiagVal = '';
    let doctorVal = '';
    let vitalsVal = '';
    let historyVal = '';
    let planVal = '';
    let phoneVal = '';
    let addressVal = '';
    let insuranceNumberVal = '';
    let insuranceTypeVal = '';
    let treatmentDaysVal: number | undefined = undefined;

    // Duyệt qua từng cột trong dòng để lấy các thông tin hành chính khác
    Object.entries(row).forEach(([rawKey, val]) => {
      const key = normalizeVietnameseString(rawKey);
      const strVal = String(val ?? '').trim();

      // 1. Mã BN / Mã HSBA / Mã vào viện
      if (
        key.includes('ma bn') || 
        key.includes('ma benh nhan') || 
        key.includes('ma hsba') || 
        key.includes('ma vao vien') || 
        key.includes('ma nguoi benh') ||
        key.includes('so hsba') ||
        key === 'mabn'
      ) {
        if (strVal && !patientCode) patientCode = strVal;
      }

      // 2. Họ và tên bệnh nhân
      else if (
        key.includes('ho ten') || 
        key.includes('ho va ten') || 
        key.includes('ten benh nhan') || 
        key.includes('ten nguoi benh') || 
        key === 'ten' || 
        key.includes('full name') || 
        key.includes('benh nhan') ||
        key.includes('nguoi benh')
      ) {
        if (strVal && !nameVal) nameVal = strVal;
      }

      // 3. Tuổi
      else if (key === 'tuoi' || key.includes('tuoi') || key === 'age') {
        if (strVal && !ageVal) ageVal = strVal;
      }

      // 4. Năm sinh / Ngày sinh
      else if (
        key.includes('nam sinh') || 
        key.includes('yob') || 
        key.includes('birth year')
      ) {
        if (strVal && !birthYearVal) birthYearVal = strVal;
      } else if (
        key.includes('ngay sinh') || 
        key.includes('dob') || 
        key.includes('date of birth')
      ) {
        // Có thể trích xuất năm sinh từ ngày sinh nếu chưa có tuổi
        if (strVal && !birthYearVal) {
          const matchYear = strVal.match(/\b(19\d{2}|20\d{2})\b/);
          if (matchYear) birthYearVal = matchYear[1];
        }
      }

      // 5. Giới tính
      else if (
        key.includes('gioi tinh') || 
        key.includes('gioi') || 
        key.includes('gender') || 
        key.includes('nam/nu') || 
        key === 'phai'
      ) {
        if (strVal && !genderVal) genderVal = strVal;
      }

      // 6. Số phòng / buồng dự phòng nếu findRoomValue chưa tìm thấy (TUYỆT ĐỐI BỎ QUA maphong)
      else if (
        !roomVal &&
        (key.includes('phong') || key.includes('buong')) &&
        !key.startsWith('ma') &&
        !key.includes('maphong')
      ) {
        if (strVal) roomVal = strVal;
      }

      // 7. Số giường dự phòng nếu findBedValue chưa tìm thấy (TUYỆT ĐỐI BỎ QUA magiuong)
      else if (
        !bedVal &&
        (key.includes('giuong') || key.includes('bed')) &&
        !key.startsWith('ma') &&
        !key.includes('magiuong')
      ) {
        if (strVal) bedVal = strVal;
      }

      // 8. NGÀY NHẬP VIỆN / NGÀY VÀO VIỆN (Ưu tiên tuyệt đối các cột có chữ "vao vien" hoặc "nhap vien")
      // LOẠI TRỪ: "sinh", "ra vien", "xuat vien", "so ngay", "hen"
      else if (
        (key.includes('vao vien') || key.includes('nhap vien') || key.includes('ngay vao') || key.includes('ngay nhap') || key.includes('thoi gian vao') || key.includes('thoi gian nhap') || key.includes('admission') || key.includes('admitted') || key === 'ngayvao') &&
        !key.includes('sinh') &&
        !key.includes('ra vien') &&
        !key.includes('xuat vien') &&
        !key.includes('so ngay') &&
        !key.includes('hen')
      ) {
        if (val !== '' && val !== undefined && val !== null) {
          admissionDateVal = val;
        }
      }

      // 9. Ngày khám / tiếp nhận dự phòng (chỉ dùng nếu không tìm thấy ngày vào viện cụ thể)
      else if (
        (key === 'ngay' || key.includes('ngay tiep nhan') || key.includes('ngay kcb')) &&
        !key.includes('sinh') &&
        !key.includes('ra vien') &&
        !key.includes('xuat vien') &&
        !key.includes('so ngay')
      ) {
        if (val !== '' && val !== undefined && val !== null && !fallbackDateVal) {
          fallbackDateVal = val;
        }
      }

      // 10. Chẩn đoán ICD (mã hoặc tên ICD) - CHỈ LƯU VÀO icdDiagnosis, KHÔNG đưa vào diagnosis lâm sàng
      else if (
        key.includes('icd') || 
        key.includes('ma benh') || 
        key.includes('ma icd')
      ) {
        if (strVal && !icdCodeVal) icdCodeVal = strVal;
      } else if (
        key.includes('chan doan') || 
        key.includes('diagnosis') || 
        key.includes('benh chinh') || 
        key.includes('benh kem theo')
      ) {
        if (strVal && !icdDiagVal) icdDiagVal = strVal;
      }

      // 11. Bác sĩ điều trị trong file
      else if (
        key.includes('bac si') || 
        key.includes('bs dieu tri') || 
        key.includes('bs phu trach') || 
        key.includes('doctor')
      ) {
        if (strVal && !doctorVal) doctorVal = strVal;
      }

      // 12. Sinh hiệu (nếu có)
      else if (
        key.includes('sinh hieu') || 
        key.includes('mach') || 
        key.includes('huyet ap') || 
        key.includes('vitals')
      ) {
        if (strVal && !vitalsVal) vitalsVal = strVal;
      }

      // 13. Tiền sử
      else if (key.includes('tien su') || key.includes('history')) {
        if (strVal && !historyVal) historyVal = strVal;
      }

      // 14. Hướng xử trí / Y lệnh
      else if (
        key.includes('huong xu tri') || 
        key.includes('ke hoach') || 
        key.includes('y lenh') || 
        key.includes('plan')
      ) {
        if (strVal && !planVal) planVal = strVal;
      }

      // 15. Số điện thoại (Điện thoại / SĐT)
      else if (
        key.includes('dien thoai') || 
        key.includes('sdt') || 
        key.includes('phone')
      ) {
        if (strVal && !phoneVal) phoneVal = strVal;
      }

      // 16. Địa chỉ
      else if (
        key.includes('dia chi') || 
        key.includes('address')
      ) {
        if (strVal && !addressVal) addressVal = strVal;
      }

      // 17. Số thẻ BHYT
      else if (
        key.includes('so the') || 
        key.includes('sothe') || 
        key.includes('bhyt') || 
        key.includes('insurance')
      ) {
        if (strVal && !insuranceNumberVal) insuranceNumberVal = strVal;
      }

      // 18. Đối tượng khám chữa bệnh (BHYT / Viện phí...)
      else if (
        key.includes('doi tuong') || 
        key.includes('doituong')
      ) {
        if (strVal && !insuranceTypeVal) insuranceTypeVal = strVal;
      }

      // 19. Số ngày điều trị (SNĐT / ngaydieutri)
      else if (
        key.includes('sndt') || 
        key.includes('so ngay dieu tri') || 
        key.includes('ngay dieu tri') ||
        key.includes('ngaydieutri')
      ) {
        const numDays = parseInt(strVal.replace(/\D/g, ''), 10);
        if (!isNaN(numDays) && treatmentDaysVal === undefined) {
          treatmentDaysVal = numDays;
        }
      }
    });

    // Chuẩn hóa tuổi (nếu chuỗi có kèm "tuổi", vd: "78 tuổi" -> 78)
    if (ageVal) {
      const parsedAge = parseAgeNumber(ageVal);
      if (parsedAge) ageVal = parsedAge;
    }

    // Tính tuổi nếu chỉ có năm sinh
    if (!ageVal && birthYearVal) {
      const parsedYear = parseInt(String(birthYearVal).replace(/\D/g, ''), 10);
      if (parsedYear && parsedYear > 1900 && parsedYear <= currentYear) {
        ageVal = currentYear - parsedYear;
      }
    }

    // Xử lý ngày nhập viện chuẩn xác
    const targetDateVal = admissionDateVal !== null ? admissionDateVal : fallbackDateVal;
    const { formatted: parsedAdmissionDate, raw: rawAdmissionDateStr } = parseExcelAdmissionDate(targetDateVal);

    // Chuẩn hóa giới tính
    let normalizedGender = 'Nam';
    const lowerGender = String(genderVal).toLowerCase();
    if (lowerGender.includes('nu') || lowerGender === 'f' || lowerGender === 'female' || lowerGender === '2') {
      normalizedGender = 'Nữ';
    }

    // Chuẩn hóa phòng & giường
    const cleanedRoom = extractCleanRoomNumber(roomVal);
    const cleanedBed = extractCleanBedNumber(bedVal);

    // Chỉ nhận dòng nếu có tên hoặc có phòng (bỏ qua dòng tiêu đề phụ/dòng trống)
    if (nameVal || roomVal) {
      rows.push({
        id: `EXCEL-ROW-${rowIndex + 1}`,
        patientCode: patientCode || undefined,
        patientName: nameVal || `Bệnh Nhân Dòng ${rowIndex + 1}`,
        patientAge: ageVal || 60,
        patientGender: normalizedGender,
        patientRoom: cleanedRoom,
        bedNumber: cleanedBed,
        admissionDate: parsedAdmissionDate || undefined,
        admissionDateRaw: rawAdmissionDateStr || undefined,
        icdCode: icdCodeVal || undefined,
        icdDiagnosis: icdDiagVal || undefined,
        // Theo yêu cầu BS: Không lấy chẩn đoán trong file vì đó chỉ là ICD, để trống cho lâm sàng
        diagnosis: '',
        doctorName: doctorVal || undefined,
        phoneNumber: phoneVal || undefined,
        address: addressVal || undefined,
        insuranceNumber: insuranceNumberVal || undefined,
        insuranceType: insuranceTypeVal || undefined,
        treatmentDays: treatmentDaysVal,
        vitalSigns: vitalsVal || undefined,
        medicalHistory: historyVal || undefined,
        treatmentPlan: planVal || undefined,
        rawRow: row,
      });
    }
  });

  return {
    rows,
    detectedHeaders,
    sheetNames: workbook.SheetNames,
  };
}

/**
 * Match Excel rows with incomplete satellite records
 */
export function matchExcelWithSatelliteRecords(
  excelRows: ExcelPatientRow[],
  satelliteRecords: ClinicalRecord[]
): MatchedSatelliteRecord[] {
  const matches: MatchedSatelliteRecord[] = [];

  satelliteRecords.forEach((satRec) => {
    const satNameNorm = normalizeVietnameseString(satRec.patientName || satRec.fullName || '');
    const satRoomNorm = normalizeVietnameseString(satRec.patientRoom || satRec.roomNumber || '');
    const satAge = parseAgeNumber(satRec.patientAge || satRec.age);

    let bestMatch: ExcelPatientRow | null = null;
    let matchedField = '';

    for (const excelRow of excelRows) {
      const excelNameNorm = normalizeVietnameseString(excelRow.patientName);
      const excelRoomNorm = normalizeVietnameseString(excelRow.patientRoom);

      // 1. Exact or fuzzy name match
      if (satNameNorm && excelNameNorm && (satNameNorm === excelNameNorm || satNameNorm.includes(excelNameNorm) || excelNameNorm.includes(satNameNorm))) {
        bestMatch = excelRow;
        matchedField = 'Tên bệnh nhân';
        break;
      }

      // 2. Room match if name is missing or satellite name matches
      if (satRoomNorm && excelRoomNorm && satRoomNorm === excelRoomNorm) {
        bestMatch = excelRow;
        matchedField = 'Số buồng/phòng';
        break;
      }
    }

    if (bestMatch) {
      const missingFields: string[] = [];
      if (!satNameNorm) missingFields.push('Họ tên');
      if (!satAge) missingFields.push('Tuổi');
      if (!satRoomNorm || satRoomNorm === 'chua xep phong') missingFields.push('Số buồng/phòng');

      const proposedRoom = extractCleanRoomNumber(bestMatch.patientRoom || satRec.patientRoom || satRec.roomNumber);
      const proposedAge = parseAgeNumber(bestMatch.patientAge) || satAge || 60;

      matches.push({
        satelliteRecord: satRec,
        matchedExcelRow: bestMatch,
        matchedField,
        missingFields,
        proposedRoom,
        proposedAge,
      });
    }
  });

  return matches;
}

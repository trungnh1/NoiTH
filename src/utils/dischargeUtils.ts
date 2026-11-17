import { Patient } from '../types/patient';
import { extractCleanRoomNumber, parseExcelAdmissionDate } from './excelParser';

/**
 * Trích xuất chuỗi so sánh ngày chuẩn (YYYY-MM-DD) từ ngày nhập viện bất kỳ
 */
export function getAdmissionDateComparisonString(rawDate?: string): string {
  if (!rawDate) return '';
  const parsed = parseExcelAdmissionDate(rawDate).formatted || String(rawDate).trim();

  // 1. Dạng YYYY-MM-DD
  const ymdMatch = parsed.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. Dạng DD/MM/YYYY
  const dmyMatch = parsed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // 3. Dạng DD/MM (gán năm 2026 hiện tại)
  const dmMatch = parsed.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (dmMatch) {
    const d = dmMatch[1].padStart(2, '0');
    const m = dmMatch[2].padStart(2, '0');
    return `2026-${m}-${d}`;
  }

  // 4. Date object fallback
  try {
    const dObj = new Date(parsed.replace(' ', 'T'));
    if (!isNaN(dObj.getTime())) {
      const y = dObj.getFullYear();
      const m = String(dObj.getMonth() + 1).padStart(2, '0');
      const d = String(dObj.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  } catch {}

  return '';
}

/**
 * Kiểm tra xem một bệnh nhân có ngày vào viện trước ngày 10/11 (trước ngày 10/11/2026) hay không.
 */
export function isAdmittedBeforeNov10(p: Patient): boolean {
  const compDate = getAdmissionDateComparisonString(p.admissionDate);
  if (!compDate) return false;
  return compDate < '2026-11-10';
}

/**
 * Chuyển trạng thái bệnh nhân sang Đã Ra Viện (DISCHARGED)
 */
export function dischargePatientRecord(p: Patient, dischargeIsoDate?: string): Patient {
  const nowIso = dischargeIsoDate || new Date().toISOString();
  return {
    ...p,
    status: 'DISCHARGED',
    admissionStatus: 'DISCHARGE_TODAY',
    dischargeDate: nowIso,
    dischargeTomorrowSetDate: undefined,
  };
}

/**
 * Kiểm tra xem một bệnh nhân có phải ca bị cho ra viện ngày 16/11/2026 không.
 */
export function isDischargedOnNov16(p: Patient): boolean {
  if (p.status !== 'DISCHARGED') return false;
  const dDate = p.dischargeDate;
  if (!dDate) return false;
  return dDate.includes('2026-11-16') || dDate.includes('16/11/2026') || dDate.includes('16-11-2026');
}

/**
 * Kiểm tra xem có phải là bệnh nhân đã ra viện nói chung không
 */
export function isAnyDischargedPatient(p: Patient): boolean {
  return p.status === 'DISCHARGED';
}

/**
 * Khôi phục hồ sơ bệnh nhân từ trạng thái Ra Viện (DISCHARGED)
 * trở về trạng thái Điều Trị Nội Trú (ACTIVE / STABLE_INPATIENT) trong buồng bệnh.
 * Đồng thời chuẩn hóa số phòng thành dạng 3 chữ số sạch (ví dụ: '743') để hiển thị ngay trong buồng phòng.
 */
export function restoreDischargedPatient(p: Patient, targetRoom?: string): Patient {
  const roomToUse = targetRoom || p.roomNumber || '743';
  const cleanRoom = extractCleanRoomNumber(roomToUse) || '743';

  return {
    ...p,
    status: 'ACTIVE',
    admissionStatus: 'STABLE_INPATIENT',
    dischargeDate: undefined,
    dischargeTomorrowSetDate: undefined,
    roomNumber: cleanRoom,
    bedNumber: p.bedNumber || 'Giường 01',
  };
}

/**
 * Định dạng ngày giờ ra viện hiển thị thân thiện tiếng Việt.
 */
export function formatDischargeDateDisplay(dateStr?: string): string {
  if (!dateStr) return 'Tự động';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return dateStr;
    }
    const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
    const dayStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' });
    return `${timeStr} ngày ${dayStr}`;
  } catch {
    return dateStr;
  }
}

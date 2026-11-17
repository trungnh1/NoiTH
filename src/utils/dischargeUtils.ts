import { Patient } from '../types/patient';
import { extractCleanRoomNumber } from './excelParser';

/**
 * Kiểm tra xem một bệnh nhân có đang ở trạng thái Ra Viện (DISCHARGED) cần khôi phục hay không.
 * Bao gồm các ca bị cho ra viện ngày 16/11/2026, ngày 17/11/2026 (hôm nay khi import/đối soát Excel),
 * hoặc bất kỳ ca nào đang ở trạng thái DISCHARGED trong khoa.
 */
export function isDischargedOnNov16(p: Patient): boolean {
  if (p.status !== 'DISCHARGED') return false;

  // Nếu bệnh nhân đang có status là DISCHARGED, coi như thuộc đối tượng cần khôi phục
  // để đảm bảo không bỏ sót bất kỳ ca nào bị ra viện ngoài ý muốn
  return true;
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
  if (!dateStr) return 'Ngày 16/11/2026 (Tự động)';
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

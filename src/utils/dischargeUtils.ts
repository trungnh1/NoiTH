import { Patient } from '../types/patient';

/**
 * Kiểm tra xem một bệnh nhân có bị cho ra viện vào ngày 16/11/2026 hay không.
 * Xử lý đa dạng định dạng: ISO string, YYYY-MM-DD, DD/MM/YYYY, múi giờ Việt Nam (UTC+7),
 * hoặc trường hợp mất dischargeDate do mapping trước đó nhưng có updatedAt/thao tác ngày 16/11/2026.
 */
export function isDischargedOnNov16(p: Patient): boolean {
  if (p.status !== 'DISCHARGED') return false;

  const datesToCheck: (string | undefined)[] = [
    p.dischargeDate,
    (p as any).updatedAt,
    (p as any).modifiedAt,
  ];

  // Kiểm tra nhật ký diễn tiến gần nhất nếu có ghi nhận xuất viện / ra viện
  if (p.evolutions && p.evolutions.length > 0) {
    const lastEvo = p.evolutions[p.evolutions.length - 1];
    const text = `${lastEvo.clinicalNote || ''} ${lastEvo.treatmentAction || ''}`.toLowerCase();
    if (text.includes('ra viện') || text.includes('xuất viện') || text.includes('cho về')) {
      datesToCheck.push(lastEvo.date);
      datesToCheck.push(lastEvo.timestamp);
    }
  }

  for (const raw of datesToCheck) {
    if (!raw) continue;
    if (
      raw.includes('2026-11-16') ||
      raw.includes('16/11/2026') ||
      raw.includes('16-11-2026') ||
      raw.includes('16/11')
    ) {
      return true;
    }
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      const vnDate = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
      if (vnDate === '2026-11-16') return true;
    }
  }

  // Nếu bệnh nhân đang ở trạng thái DISCHARGED mà không có ngày ra viện cụ thể,
  // do phiên bản trước omit dischargeDate khi map từ Firestore vào ngày 16/11,
  // chúng ta cũng coi đây là đối tượng thuộc đợt auto-discharge ngày 16/11/2026
  if (!p.dischargeDate) {
    return true;
  }

  return false;
}

/**
 * Khôi phục hồ sơ bệnh nhân từ trạng thái Ra Viện (DISCHARGED)
 * trở về trạng thái Điều Trị Nội Trú (ACTIVE / STABLE_INPATIENT) trong buồng bệnh.
 */
export function restoreDischargedPatient(p: Patient, targetRoom?: string): Patient {
  return {
    ...p,
    status: 'ACTIVE',
    admissionStatus: 'STABLE_INPATIENT',
    dischargeDate: undefined,
    dischargeTomorrowSetDate: undefined,
    roomNumber: targetRoom || p.roomNumber || '743',
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

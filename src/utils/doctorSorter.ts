import { Doctor } from '../types/patient';

/**
 * Trích xuất tên chính của Bác sĩ (chữ cuối cùng trong họ tên)
 * Ví dụ:
 * - "BS. Đặng Thị Ngọc Ánh" -> "Ánh" (chữ A)
 * - "BS. Nguyễn Hữu Trung" -> "Trung" (chữ T)
 */
export function getDoctorGivenName(fullName: string): string {
  if (!fullName) return '';
  const cleanName = fullName
    .replace(/^(bs\.?ckii|ths\.?bs|bs\.?cki|bs\.?|bác sĩ)\s*/i, '')
    .trim();
  const parts = cleanName.split(/\s+/);
  const lastWord = parts[parts.length - 1] || cleanName;
  if (parts.length >= 2 && /chi/i.test(lastWord) && /bình|phương/i.test(parts[parts.length - 2])) {
    return `${parts[parts.length - 2]} ${lastWord}`;
  }
  return lastWord;
}

/**
 * Sắp xếp danh sách Bác sĩ theo thứ tự bảng chữ cái ABC của tên chính
 */
export function sortDoctorsAlphabetically<T extends { name: string }>(doctorsList: T[]): T[] {
  if (!Array.isArray(doctorsList)) return [];
  return [...doctorsList].sort((a, b) => {
    const nameA = getDoctorGivenName(a.name || '');
    const nameB = getDoctorGivenName(b.name || '');
    return nameA.localeCompare(nameB, 'vi', { sensitivity: 'base' });
  });
}

/**
 * Định dạng tên bệnh nhân: chuyển đổi chữ in hoa toàn bộ thành dạng viết hoa chữ cái đầu (Title Case)
 */
export function formatPatientName(name: string): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (trimmed === trimmed.toUpperCase() && trimmed.length > 3) {
    return trimmed
      .toLowerCase()
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  return trimmed;
}


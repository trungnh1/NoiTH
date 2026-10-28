import { Doctor } from '../types/patient';

export const DOCTOR_DEFAULT_PASSWORD = '123';
const SESSION_KEY = 'HVGL_CURRENT_DOCTOR_SESSION';
const PASSWORD_PREFIX = 'HVGL_DOCTOR_PWD_';

/**
 * Load current authenticated doctor session from localStorage
 */
export function getSavedDoctorSession(doctors: Doctor[]): Doctor | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.id) return null;

    // Prevent obsolete accounts (Tuế 00101, Quyên 00199) from retaining active session
    if (['00101', '00199'].includes(parsed.id) || /tuế|quyên/i.test(parsed.name || '')) {
      clearDoctorSession();
      return null;
    }

    // Match with current registered doctor list
    const matched = doctors.find((d) => d.id === parsed.id);
    return matched || parsed;
  } catch (e) {
    console.error('Error loading doctor session:', e);
    return null;
  }
}

/**
 * Save doctor login session
 */
export function saveDoctorSession(doctor: Doctor): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(doctor));
  } catch (e) {
    console.error('Error saving doctor session:', e);
  }
}

/**
 * Clear doctor login session (Logout)
 */
export function clearDoctorSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (e) {
    console.error('Error clearing doctor session:', e);
  }
}

/**
 * Validate doctor credentials (username = doctor ID, password = default '123' or custom set password)
 */
export function verifyDoctorLogin(
  doctorIdInput: string,
  passwordInput: string,
  doctors: Doctor[]
): { success: boolean; doctor?: Doctor; error?: string } {
  const trimmedId = doctorIdInput.trim();
  const trimmedPassword = passwordInput.trim();

  if (!trimmedId) {
    return { success: false, error: 'Vui lòng nhập Mã Bác Sĩ (ví dụ: 00979)' };
  }

  if (!trimmedPassword) {
    return { success: false, error: 'Vui lòng nhập mật khẩu (mặc định: 123)' };
  }

  // Prevent Tuế & Quyên
  if (['00101', '00199'].includes(trimmedId)) {
    return { success: false, error: 'Tài khoản Bác sĩ không khả dụng hoặc đã chuyển công tác.' };
  }

  // Find doctor by exact ID, or formatted ID
  const doctor = doctors.find(
    (d) =>
      d.id === trimmedId ||
      d.id.replace(/^0+/, '') === trimmedId.replace(/^0+/, '') ||
      d.id.padStart(5, '0') === trimmedId.padStart(5, '0')
  );

  if (!doctor || /tuế|quyên/i.test(doctor.name)) {
    return {
      success: false,
      error: `Không tìm thấy Bác sĩ với Mã "${trimmedId}". Vui lòng kiểm tra lại mã (VD: 00979 cho BS. Trung).`,
    };
  }

  // Check custom password if set, otherwise default is '123'
  let correctPassword = DOCTOR_DEFAULT_PASSWORD;
  try {
    const custom = localStorage.getItem(`${PASSWORD_PREFIX}${doctor.id}`);
    if (custom) correctPassword = custom;
  } catch {
    // fallback
  }

  if (trimmedPassword !== correctPassword) {
    return {
      success: false,
      error: 'Mật khẩu không chính xác! (Mật khẩu mặc định ban đầu là 123).',
    };
  }

  return { success: true, doctor };
}

/**
 * Optional: Change doctor password
 */
export function changeDoctorPassword(doctorId: string, newPassword: string): boolean {
  try {
    if (!newPassword || newPassword.trim().length < 3) return false;
    localStorage.setItem(`${PASSWORD_PREFIX}${doctorId}`, newPassword.trim());
    return true;
  } catch {
    return false;
  }
}

import { Doctor } from '../types/patient';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { initializeFirebaseFirestore } from '../services/firebaseSync';

export const DOCTOR_DEFAULT_PASSWORD = '123';
const SESSION_KEY = 'HVGL_CURRENT_DOCTOR_SESSION';
const PASSWORD_PREFIX = 'HVGL_DOCTOR_PWD_';
const CREDENTIALS_COLLECTION = 'doctor_credentials';

export interface DoctorCredential {
  doctorId: string;
  doctorName: string;
  password: string;
  isFirstLogin: boolean;
  updatedAt: string;
}

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
 * Fetch doctor credential from Firestore with local caching
 */
export async function getDoctorCredentialFromFirestore(doctorId: string): Promise<DoctorCredential | null> {
  try {
    const db = initializeFirebaseFirestore();
    if (!db) return null;

    const docRef = doc(db, CREDENTIALS_COLLECTION, doctorId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as DoctorCredential;
    }
  } catch (e) {
    console.warn('Lỗi đọc doctor_credentials từ Firestore:', e);
  }
  return null;
}

/**
 * Save / Update doctor password credential on Firestore & localStorage
 */
export async function saveDoctorPasswordToFirestore(
  doctorId: string,
  doctorName: string,
  newPassword: string,
  isFirstLogin: boolean = false
): Promise<boolean> {
  const pwd = newPassword.trim();
  try {
    // 1. Cache to localStorage
    localStorage.setItem(`${PASSWORD_PREFIX}${doctorId}`, pwd);
    localStorage.setItem(`HVGL_DOCTOR_FIRST_LOGIN_${doctorId}`, isFirstLogin ? 'true' : 'false');

    // 2. Save to Firestore
    const db = initializeFirebaseFirestore();
    if (db) {
      const docRef = doc(db, CREDENTIALS_COLLECTION, doctorId);
      const payload: DoctorCredential = {
        doctorId,
        doctorName,
        password: pwd,
        isFirstLogin,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(docRef, payload, { merge: true });
    }
    return true;
  } catch (e) {
    console.warn('Lỗi lưu doctor_credentials lên Firestore:', e);
    return false;
  }
}

/**
 * Validate doctor credentials (username = doctor ID, password = default '123' or custom set password)
 * Synchronous version for fallback
 */
export function verifyDoctorLogin(
  doctorIdInput: string,
  passwordInput: string,
  doctors: Doctor[]
): { success: boolean; doctor?: Doctor; isFirstLogin?: boolean; error?: string } {
  const trimmedId = doctorIdInput.trim();
  const trimmedPassword = passwordInput.trim();

  if (!trimmedId) {
    return { success: false, error: 'Vui lòng nhập Mã Bác Sĩ (ví dụ: 00979)' };
  }

  if (!trimmedPassword) {
    return { success: false, error: 'Vui lòng nhập mật khẩu (mặc định: 123)' };
  }

  if (['00101', '00199'].includes(trimmedId)) {
    return { success: false, error: 'Tài khoản Bác sĩ không khả dụng hoặc đã chuyển công tác.' };
  }

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

  const isFirstLogin = trimmedPassword === DOCTOR_DEFAULT_PASSWORD;

  return { success: true, doctor, isFirstLogin };
}

/**
 * Validate doctor credentials asynchronously using Firestore
 */
export async function verifyDoctorLoginAsync(
  doctorIdInput: string,
  passwordInput: string,
  doctors: Doctor[]
): Promise<{ success: boolean; doctor?: Doctor; isFirstLogin?: boolean; error?: string }> {
  const trimmedId = doctorIdInput.trim();
  const trimmedPassword = passwordInput.trim();

  if (!trimmedId) {
    return { success: false, error: 'Vui lòng nhập Mã Bác Sĩ (ví dụ: 00979)' };
  }

  if (!trimmedPassword) {
    return { success: false, error: 'Vui lòng nhập mật khẩu (mặc định: 123)' };
  }

  if (['00101', '00199'].includes(trimmedId)) {
    return { success: false, error: 'Tài khoản Bác sĩ không khả dụng hoặc đã chuyển công tác.' };
  }

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

  let correctPassword = DOCTOR_DEFAULT_PASSWORD;
  let isFirstLogin = true;

  try {
    const remoteCred = await getDoctorCredentialFromFirestore(doctor.id);
    if (remoteCred && remoteCred.password) {
      correctPassword = remoteCred.password;
      isFirstLogin = remoteCred.isFirstLogin ?? (remoteCred.password === DOCTOR_DEFAULT_PASSWORD);
    } else {
      const customLocal = localStorage.getItem(`${PASSWORD_PREFIX}${doctor.id}`);
      if (customLocal) {
        correctPassword = customLocal;
        isFirstLogin = customLocal === DOCTOR_DEFAULT_PASSWORD;
      }
    }
  } catch (e) {
    console.warn(e);
  }

  if (trimmedPassword !== correctPassword) {
    return {
      success: false,
      error: 'Mật khẩu không chính xác! (Mật khẩu mặc định lần đầu là 123).',
    };
  }

  if (trimmedPassword === DOCTOR_DEFAULT_PASSWORD) {
    isFirstLogin = true;
  }

  return { success: true, doctor, isFirstLogin };
}

/**
 * Change doctor password and store to Firestore + LocalStorage
 */
export async function changeDoctorPassword(
  doctor: Doctor,
  newPassword: string
): Promise<boolean> {
  if (!newPassword || newPassword.trim().length < 3) return false;
  return await saveDoctorPasswordToFirestore(doctor.id, doctor.name, newPassword.trim(), false);
}

import { Doctor } from '../types/patient';
import { INITIAL_DOCTORS } from '../data/mockData';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  initializeFirebaseFirestore, 
  executeFirestoreOp, 
  getActiveFirebaseConfig 
} from '../services/firebaseSync';

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
 * Parse raw Firestore REST document into DoctorCredential
 */
function parseFirestoreDoc(raw: any): DoctorCredential | null {
  if (!raw || !raw.fields) return null;
  const f = raw.fields;
  const parseVal = (v: any) => {
    if (!v) return undefined;
    if (v.stringValue !== undefined) return v.stringValue;
    if (v.booleanValue !== undefined) return v.booleanValue;
    if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
    if (v.timestampValue !== undefined) return v.timestampValue;
    return undefined;
  };

  return {
    doctorId: parseVal(f.doctorId) || (raw.name ? raw.name.split('/').pop() : ''),
    doctorName: parseVal(f.doctorName) || '',
    password: parseVal(f.password) || '',
    isFirstLogin: parseVal(f.isFirstLogin) ?? false,
    updatedAt: parseVal(f.updatedAt) || ''
  };
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

    // Match with current registered doctor list or INITIAL_DOCTORS
    const matched = doctors.find((d) => d.id === parsed.id) || INITIAL_DOCTORS.find((d) => d.id === parsed.id);
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
 * Fetch doctor credential from Firestore using ultra-fast direct REST API with Firebase SDK fallback.
 * Checks ID variants ('00979', '979') in parallel with a strict 2000ms timeout.
 */
export async function getDoctorCredentialFromFirestore(doctorId: string): Promise<DoctorCredential | null> {
  const cleanId = doctorId.trim();
  if (!cleanId) return null;

  const idVariants = Array.from(
    new Set([cleanId, cleanId.replace(/^0+/, ''), cleanId.padStart(5, '0')])
  ).filter(Boolean);

  const config = getActiveFirebaseConfig();

  // 1. First attempt: Direct Firestore REST API (resolves in ~100-150ms without WebChannel overhead)
  const restPromises = idVariants.map(async (id) => {
    try {
      const restUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.databaseId}/documents/${CREDENTIALS_COLLECTION}/${id}?key=${config.apiKey}`;
      const res = await fetch(restUrl, { method: 'GET' });
      if (res.ok) {
        const raw = await res.json();
        const cred = parseFirestoreDoc(raw);
        if (cred && cred.password) {
          return cred;
        }
      }
    } catch {
      // ignore
    }
    return null;
  });

  // 2. Secondary fallback: Firebase Web SDK getDoc
  const sdkPromises = idVariants.map(async (id) => {
    try {
      const db = initializeFirebaseFirestore();
      if (db) {
        const docRef = doc(db, CREDENTIALS_COLLECTION, id);
        const snap = await getDoc(docRef);
        if (snap && snap.exists()) {
          const data = snap.data() as DoctorCredential;
          if (data && (data.password || data.doctorName)) {
            return data;
          }
        }
      }
    } catch {
      // ignore
    }
    return null;
  });

  try {
    const winner = await Promise.race([
      (async () => {
        // Check REST first as it is lightning fast
        const restResults = await Promise.all(restPromises);
        const foundRest = restResults.find((r) => r !== null);
        if (foundRest) return foundRest;

        // Then check SDK
        const sdkResults = await Promise.all(sdkPromises);
        return sdkResults.find((r) => r !== null) || null;
      })(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);
    return winner;
  } catch {
    return null;
  }
}

/**
 * Save / Update doctor password credential on Firestore & localStorage.
 * Writes via REST API for instant sync and Firebase SDK in parallel.
 */
export async function saveDoctorPasswordToFirestore(
  doctorId: string,
  doctorName: string,
  newPassword: string,
  isFirstLogin: boolean = false
): Promise<boolean> {
  const cleanId = doctorId.trim();
  const pwd = newPassword.trim();
  if (!cleanId || !pwd) {
    throw new Error('Mã Bác sĩ và Mật khẩu không được để trống.');
  }

  const idVariants = Array.from(
    new Set([cleanId, cleanId.replace(/^0+/, ''), cleanId.padStart(5, '0')])
  ).filter(Boolean);

  // 1. Immediately cache to localStorage on this device
  for (const id of idVariants) {
    try {
      localStorage.setItem(`${PASSWORD_PREFIX}${id}`, pwd);
      localStorage.setItem(`HVGL_DOCTOR_FIRST_LOGIN_${id}`, isFirstLogin ? 'true' : 'false');
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }

  const payload: DoctorCredential = {
    doctorId: cleanId,
    doctorName,
    password: pwd,
    isFirstLogin,
    updatedAt: new Date().toISOString(),
  };

  const config = getActiveFirebaseConfig();

  // 2. Parallel write: REST API + Firebase SDK with 2500ms timeout
  try {
    await Promise.race([
      Promise.all([
        // REST write (super fast)
        ...idVariants.map(async (id) => {
          try {
            const restUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.databaseId}/documents/${CREDENTIALS_COLLECTION}/${id}?key=${config.apiKey}`;
            const restBody = {
              fields: {
                doctorId: { stringValue: id },
                doctorName: { stringValue: doctorName },
                password: { stringValue: pwd },
                isFirstLogin: { booleanValue: isFirstLogin },
                updatedAt: { stringValue: payload.updatedAt }
              }
            };
            await fetch(restUrl, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(restBody)
            });
          } catch (e) {
            console.warn('[Auth] REST save error:', e);
          }
        }),
        // SDK write
        (async () => {
          try {
            await executeFirestoreOp(async (db) => {
              for (const id of idVariants) {
                const docRef = doc(db, CREDENTIALS_COLLECTION, id);
                await setDoc(docRef, { ...payload, doctorId: id }, { merge: true });
              }
            });
          } catch (e) {
            console.warn('[Auth] SDK save error:', e);
          }
        })()
      ]),
      new Promise<void>((resolve) => setTimeout(() => resolve(), 2500))
    ]);
  } catch (err: any) {
    console.warn('[Auth] Lưu mật khẩu lên Firestore thất bại hoặc timeout:', err);
  }

  return true;
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

  let doctor = doctors.find(
    (d) =>
      d.id === trimmedId ||
      d.id.replace(/^0+/, '') === trimmedId.replace(/^0+/, '') ||
      d.id.padStart(5, '0') === trimmedId.padStart(5, '0')
  );

  if (!doctor) {
    doctor = INITIAL_DOCTORS.find(
      (d) =>
        d.id === trimmedId ||
        d.id.replace(/^0+/, '') === trimmedId.replace(/^0+/, '') ||
        d.id.padStart(5, '0') === trimmedId.padStart(5, '0')
    );
  }

  if (!doctor || /tuế|quyên/i.test(doctor.name)) {
    return {
      success: false,
      error: `Không tìm thấy Bác sĩ với Mã "${trimmedId}". Vui lòng kiểm tra lại mã (VD: 00979 cho BS. Trung).`,
    };
  }

  let correctPassword = DOCTOR_DEFAULT_PASSWORD;
  try {
    const custom = localStorage.getItem(`${PASSWORD_PREFIX}${doctor.id}`) ||
                   localStorage.getItem(`${PASSWORD_PREFIX}${doctor.id.replace(/^0+/, '')}`);
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
 * Validate doctor credentials asynchronously using Firestore with ultra-fast REST + SDK
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

  // 1. Match doctor against loaded doctors or INITIAL_DOCTORS
  let doctor = doctors.find(
    (d) =>
      d.id === trimmedId ||
      d.id.replace(/^0+/, '') === trimmedId.replace(/^0+/, '') ||
      d.id.padStart(5, '0') === trimmedId.padStart(5, '0')
  ) || INITIAL_DOCTORS.find(
    (d) =>
      d.id === trimmedId ||
      d.id.replace(/^0+/, '') === trimmedId.replace(/^0+/, '') ||
      d.id.padStart(5, '0') === trimmedId.padStart(5, '0')
  );

  if (doctor && /tuế|quyên/i.test(doctor.name)) {
    return {
      success: false,
      error: 'Tài khoản Bác sĩ không khả dụng hoặc đã chuyển công tác.',
    };
  }

  // Check local cached password immediately
  const localPwd = doctor
    ? (localStorage.getItem(`${PASSWORD_PREFIX}${doctor.id}`) ||
       localStorage.getItem(`${PASSWORD_PREFIX}${doctor.id.replace(/^0+/, '')}`))
    : null;

  // 2. Query Firestore credential (ultra-fast REST: ~100ms)
  const queryId = doctor ? doctor.id : trimmedId;
  let remoteCred: DoctorCredential | null = null;
  try {
    remoteCred = await getDoctorCredentialFromFirestore(queryId);
  } catch (e) {
    console.warn('[Auth] Lỗi kiểm tra remote credential:', e);
  }

  // 3. If doctor was not found in static list, check if Firestore holds valid doctor credentials
  if (!doctor) {
    if (remoteCred && remoteCred.doctorName) {
      doctor = {
        id: trimmedId.padStart(5, '0'),
        name: remoteCred.doctorName,
        title: '',
        role: '',
        avatarColor: 'bg-[#0b4d8c]',
        shiftStatus: 'Hành chính',
      };
    } else {
      return {
        success: false,
        error: `Không tìm thấy Bác sĩ với Mã "${trimmedId}". Vui lòng kiểm tra lại mã (VD: 00979 cho BS. Trung).`,
      };
    }
  }

  // 4. Compare credentials
  // Case A: Remote credential exists in Firestore
  if (remoteCred && remoteCred.password) {
    if (trimmedPassword === remoteCred.password) {
      // Sync to local storage for subsequent instant logins
      localStorage.setItem(`${PASSWORD_PREFIX}${doctor.id}`, remoteCred.password);
      localStorage.setItem(`HVGL_DOCTOR_FIRST_LOGIN_${doctor.id}`, remoteCred.isFirstLogin ? 'true' : 'false');
      return {
        success: true,
        doctor,
        isFirstLogin: remoteCred.isFirstLogin ?? (remoteCred.password === DOCTOR_DEFAULT_PASSWORD),
      };
    }

    // What if doctor set custom password locally while offline?
    if (localPwd && trimmedPassword === localPwd) {
      saveDoctorPasswordToFirestore(doctor.id, doctor.name, localPwd, false).catch(() => {});
      return { success: true, doctor, isFirstLogin: false };
    }

    // What if remote credential is default '123'?
    if (remoteCred.password === DOCTOR_DEFAULT_PASSWORD && trimmedPassword === DOCTOR_DEFAULT_PASSWORD) {
      return { success: true, doctor, isFirstLogin: true };
    }

    return {
      success: false,
      error: 'Mật khẩu không chính xác! Vui lòng nhập mật khẩu bạn đã tạo (hoặc liên hệ quản trị viên).',
    };
  }

  // Case B: No remote credential in Firestore (offline or never synced)
  if (localPwd) {
    if (trimmedPassword === localPwd) {
      saveDoctorPasswordToFirestore(doctor.id, doctor.name, localPwd, false).catch(() => {});
      return { success: true, doctor, isFirstLogin: false };
    }
    return {
      success: false,
      error: 'Mật khẩu không chính xác! Vui lòng thử lại.',
    };
  }

  // Case C: Brand new first-time login with default password '123'
  if (trimmedPassword === DOCTOR_DEFAULT_PASSWORD) {
    return { success: true, doctor, isFirstLogin: true };
  }

  return {
    success: false,
    error: 'Mật khẩu không chính xác! (Mật khẩu mặc định lần đầu là 123).',
  };
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

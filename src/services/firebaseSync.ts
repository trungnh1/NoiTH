import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc,
  query, 
  where, 
  onSnapshot, 
  getDocs, 
  addDoc, 
  serverTimestamp, 
  DocumentData, 
  Firestore 
} from 'firebase/firestore';
import { Patient, SeverityLevel, VitalSign } from '../types/patient';
import { isRealAllergy } from '../utils/clinicalTextParser';

import firebaseAppletConfig from '../../firebase-applet-config.json';

// Target Firebase Project configuration
// Supports manual user config in localStorage, Vercel env vars, or applet config
export function getActiveFirebaseConfig() {
  const appletConfig = (firebaseAppletConfig || {}) as Record<string, string>;

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId || "crucial-kayak-481415-h1";
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey || "AIzaSyDMS-VQIRC9BL0aIjJPtqHfQFRO4sfSQ1E";
  const appId = import.meta.env.VITE_FIREBASE_APP_ID || appletConfig.appId || "1:936936305554:web:7d0283e9fbbaf37566c74b";
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain || `${projectId}.firebaseapp.com`;
  const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || appletConfig.firestoreDatabaseId || "(default)";

  return {
    projectId,
    apiKey,
    appId,
    authDomain,
    databaseId,
  };
}

// Smart parser for Firebase Config snippet (from Firebase Console or .env)
export function parseFirebaseSnippet(snippet: string): Partial<ReturnType<typeof getActiveFirebaseConfig>> {
  const result: Partial<ReturnType<typeof getActiveFirebaseConfig>> = {};
  if (!snippet) return result;

  const clean = snippet.trim();

  // Try JSON parse first
  try {
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      // Replace unquoted keys if from JS object
      const validJsonStr = jsonMatch[0]
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":')
        .replace(/'/g, '"')
        .replace(/,\s*}/g, '}');
      try {
        const parsed = JSON.parse(validJsonStr);
        if (parsed.projectId) result.projectId = parsed.projectId;
        if (parsed.apiKey) result.apiKey = parsed.apiKey;
        if (parsed.appId) result.appId = parsed.appId;
        if (parsed.authDomain) result.authDomain = parsed.authDomain;
        if (parsed.databaseId || parsed.firestoreDatabaseId) result.databaseId = parsed.databaseId || parsed.firestoreDatabaseId;
        return result;
      } catch {
        // Continue to regex matching
      }
    }
  } catch {
    // Continue
  }

  // Regex extraction for JS object or ENV
  const projectMatch = clean.match(/(?:projectId|VITE_FIREBASE_PROJECT_ID)["':=\s]+(["']?)([a-zA-Z0-9_-]+)\1/i);
  if (projectMatch && projectMatch[2]) result.projectId = projectMatch[2];

  const apiKeyMatch = clean.match(/(?:apiKey|VITE_FIREBASE_API_KEY)["':=\s]+(["']?)([a-zA-Z0-9_-]+)\1/i);
  if (apiKeyMatch && apiKeyMatch[2]) result.apiKey = apiKeyMatch[2];

  const appIdMatch = clean.match(/(?:appId|VITE_FIREBASE_APP_ID)["':=\s]+(["']?)([a-zA-Z0-9_:-]+)\1/i);
  if (appIdMatch && appIdMatch[2]) result.appId = appIdMatch[2];

  const authDomainMatch = clean.match(/(?:authDomain|VITE_FIREBASE_AUTH_DOMAIN)["':=\s]+(["']?)([a-zA-Z0-9_.-]+)\1/i);
  if (authDomainMatch && authDomainMatch[2]) result.authDomain = authDomainMatch[2];

  const dbMatch = clean.match(/(?:databaseId|firestoreDatabaseId|VITE_FIREBASE_DATABASE_ID)["':=\s]+(["']?)([a-zA-Z0-9_()/-]+)\1/i);
  if (dbMatch && dbMatch[2]) result.databaseId = dbMatch[2];

  return result;
}

let appInstance: any = null;
let dbInstance: Firestore | null = null;

export function initializeFirebaseFirestore(forceReset = false): Firestore | null {
  const config = getActiveFirebaseConfig();
  try {
    if (forceReset) {
      const existingApps = getApps();
      for (const app of existingApps) {
        deleteApp(app).catch(() => {});
      }
      appInstance = null;
      dbInstance = null;
    }

    if (!appInstance || getApps().length === 0) {
      appInstance = initializeApp({
        projectId: config.projectId,
        apiKey: config.apiKey,
        appId: config.appId,
        authDomain: config.authDomain,
      });
    } else {
      appInstance = getApp();
    }

    if (config.databaseId && config.databaseId !== '(default)') {
      try {
        dbInstance = getFirestore(appInstance, config.databaseId);
      } catch (namedErr) {
        console.warn(`Không thể mở Firestore database [${config.databaseId}], sử dụng (default):`, namedErr);
        dbInstance = getFirestore(appInstance);
      }
    } else {
      dbInstance = getFirestore(appInstance);
    }
    return dbInstance;
  } catch (e) {
    console.warn('Firebase init warning:', e);
    return null;
  }
}

// Auto init on module load
initializeFirebaseFirestore();

export interface SyncStatus {
  connected: boolean;
  lastSyncTime: string | null;
  receivedCount: number;
  errorMessage: string | null;
}

// Convert firestore record into Patient format
export function mapFirestoreRecordToPatient(docId: string, record: DocumentData): Patient {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  // If record already has Patient structure from department_patients:
  if (record.fullName && record.roomNumber && record.severity) {
    return {
      id: record.id || docId,
      patientCode: record.patientCode || `BN-${docId.substring(0, 6)}`,
      medicalRecordNumber: record.medicalRecordNumber || `HS-${docId.substring(0, 6)}`,
      fullName: record.fullName,
      gender: record.gender || 'Nam',
      age: Number(record.age || 50),
      dateOfBirth: record.dateOfBirth || `${now.getFullYear() - Number(record.age || 50)}-01-01`,
      address: record.address || 'Gia Lai',
      insuranceNumber: record.insuranceNumber,
      admissionDate: record.admissionDate || dateStr,
      department: record.department || 'Khoa Nội Tổng Hợp',
      roomNumber: record.roomNumber,
      bedNumber: record.bedNumber || 'Giường 01',
      attendingDoctorId: record.attendingDoctorId || '00161',
      primaryNurse: record.primaryNurse || 'ĐD. Tua trực',
      primaryDiagnosis: record.primaryDiagnosis || 'Chưa ghi rõ chẩn đoán',
      icd10Primary: record.icd10Primary,
      secondaryDiagnosis: record.secondaryDiagnosis,
      allergies: isRealAllergy(record.allergies) ? record.allergies : undefined,
      medicalHistory: record.medicalHistory || 'Chưa ghi nhận bệnh lý nền đặc biệt',
      severity: record.severity as SeverityLevel,
      admissionStatus: record.admissionStatus || 'ADMITTED_TODAY',
      tags: record.tags || [],
      importantNotes: record.importantNotes || '',
      handoverNotes: record.handoverNotes || '',
      initialLabsText: record.initialLabsText || '',
      initialMedicationsText: record.initialMedicationsText || '',
      status: record.status || 'ACTIVE',
      vitals: record.vitals || [],
      evolutions: record.evolutions || [],
      labs: record.labs || [],
      medications: record.medications || [],
      aiAnalysis: record.aiAnalysis,
    };
  }

  // Extract from Khoa Cấp Cứu unstructured record
  const fullName = record.patientName || record.fullName || record.name || 'Bệnh nhân Cấp cứu';
  const age = Number(record.age || record.tuoi || 55);
  const gender = (record.gender === 'Nữ' || record.gioiTinh === 'Nữ') ? 'Nữ' : 'Nam';
  const diagnosis = record.diagnosis || record.primaryDiagnosis || record.chanDoan || record.trieuChung || 'Theo dõi nhập khoa từ Cấp cứu';
  
  let severity: SeverityLevel = 'MODERATE';
  const rawSev = (record.severity || record.mucDo || '').toString().toLowerCase();
  if (rawSev.includes('nặng') || rawSev.includes('critical') || rawSev.includes('cấp cứu') || rawSev.includes('đỏ')) {
    severity = 'CRITICAL';
  } else if (rawSev.includes('nhẹ') || rawSev.includes('ổn') || rawSev.includes('stable') || rawSev.includes('xanh')) {
    severity = 'STABLE';
  }

  const roomNumber = record.roomNumber || record.phong || '733';
  const bedNumber = record.bedNumber || record.giuong || 'Giường 01';

  const initialVital: VitalSign = {
    id: `V-EMR-${docId}-${Date.now()}`,
    timestamp: record.admissionDate || dateStr,
    bpSystolic: Number(record.bpSystolic || record.huyetApTamThu || 120),
    bpDiastolic: Number(record.bpDiastolic || record.huyetApTamTruong || 80),
    heartRate: Number(record.heartRate || record.mach || 82),
    temperature: Number(record.temperature || record.nhietDo || 37.0),
    spO2: Number(record.spO2 || 96),
    respiratoryRate: Number(record.respiratoryRate || record.nhipTho || 19),
    notes: 'Sinh hiệu chuyển giao từ Khoa Cấp Cứu',
  };

  const patientTags: any[] = [];
  if (initialVital.spO2 < 95 || (record.tags && record.tags.includes('O2_CANULA'))) {
    patientTags.push('O2_CANULA');
  }
  if (severity === 'CRITICAL') {
    patientTags.push('CLOSE_MONITORING');
  }
  if (record.hasVasopressor || rawSev.includes('vận mạch')) {
    patientTags.push('VASOPRESSOR');
  }

  return {
    id: `PAT-EMR-${docId}`,
    fullName,
    gender,
    age,
    dateOfBirth: record.dateOfBirth || `${now.getFullYear() - age}-01-01`,
    admissionDate: record.admissionDate || record.createdAt || dateStr,
    department: 'Khoa Nội Tổng Hợp - Tim Mạch',
    roomNumber,
    bedNumber,
    attendingDoctorId: record.doctorId || '00161',
    primaryNurse: record.nurse || 'ĐD. Tua trực tiếp nhận',
    primaryDiagnosis: diagnosis,
    icd10Primary: record.icd10 || 'N/A',
    secondaryDiagnosis: record.secondaryDiagnosis || record.benhKemTheo || undefined,
    allergies: isRealAllergy(record.allergies || record.diUng) ? (record.allergies || record.diUng) : undefined,
    medicalHistory: record.medicalHistory || record.tienSu || 'Tiền sử ghi nhận từ Cấp cứu',
    severity,
    admissionStatus: 'ADMITTED_TODAY',
    tags: patientTags,
    importantNotes: record.notes || `Bệnh nhân chuyển từ Khoa Cấp Cứu vào khoa lúc ${dateStr.split(' ')[1]}.`,
    handoverNotes: record.handover || 'Theo dõi sinh hiệu và chỉ định điều trị ban đầu.',
    initialLabsText: record.labsText || record.initialLabsText || '',
    initialMedicationsText: record.medsText || record.initialMedicationsText || '',
    status: 'ACTIVE',
    vitals: [initialVital],
    evolutions: [
      {
        id: `EV-EMR-${Date.now()}`,
        timestamp: dateStr,
        doctorName: 'BS. Tua trực tiếp nhận',
        shift: 'Sáng',
        clinicalNote: `Tiếp nhận bệnh nhân từ Khoa Cấp Cứu vào buồng ${roomNumber} - ${bedNumber}. Chẩn đoán: ${diagnosis}.`,
        treatmentAction: 'Tiếp nhận hồ sơ, y lệnh thuốc và xét nghiệm ban đầu, theo dõi sát sinh hiệu.',
      },
    ],
    labs: record.labs || [],
    medications: record.medications || [],
  };
}

// Tạm thời tắt tính năng nhận dữ liệu từ Khoa Cấp Cứu theo yêu cầu của Admin
const ENABLE_EMERGENCY_SYNC = false;

// Subscribe to real-time additions from Khoa Cấp Cứu
export function subscribeToEmergencyRecords(
  onPatientAdded: (patient: Patient) => void,
  onStatusChange?: (status: SyncStatus) => void
): () => void {
  if (!ENABLE_EMERGENCY_SYNC) {
    console.info('Tính năng nhận dữ liệu tự động từ Khoa Cấp Cứu đang được tạm thời tắt.');
    if (onStatusChange) {
      onStatusChange({
        connected: false,
        lastSyncTime: null,
        receivedCount: 0,
        errorMessage: 'Tạm thời tắt tính năng nhận dữ liệu từ Khoa Cấp Cứu',
      });
    }
    return () => {};
  }

  if (!dbInstance) {
    dbInstance = initializeFirebaseFirestore();
  }
  if (!dbInstance) {
    if (onStatusChange) {
      onStatusChange({
        connected: false,
        lastSyncTime: null,
        receivedCount: 0,
        errorMessage: 'Firestore chưa được kết nối',
      });
    }
    return () => {};
  }

  try {
    const q = query(
      collection(dbInstance, 'clinical_records'),
      where('deptCode', '==', 'KHOA_CAP_CUU')
    );

    let count = 0;

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            const patient = mapFirestoreRecordToPatient(change.doc.id, data);
            count++;
            console.log('Bệnh nhân mới từ Khoa Cấp Cứu:', patient.fullName);
            onPatientAdded(patient);
          }
        });

        if (onStatusChange) {
          onStatusChange({
            connected: true,
            lastSyncTime: new Date().toLocaleTimeString('vi-VN'),
            receivedCount: count,
            errorMessage: null,
          });
        }
      },
      (error) => {
        const isPermissionError = error.code === 'permission-denied' || (error.message && error.message.includes('permissions'));
        if (onStatusChange) {
          onStatusChange({
            connected: false,
            lastSyncTime: null,
            receivedCount: count,
            errorMessage: isPermissionError 
              ? 'Firestore yêu cầu xác thực hoặc mở quyền Rules (allow read, write)'
              : (error.message || 'Lỗi kết nối Firestore'),
          });
        }
      }
    );

    return unsubscribe;
  } catch (err: any) {
    console.error('Lỗi thiết lập onSnapshot Firestore:', err);
    if (onStatusChange) {
      onStatusChange({
        connected: false,
        lastSyncTime: null,
        receivedCount: 0,
        errorMessage: err.message || 'Không thể tạo kết nối',
      });
    }
    return () => {};
  }
}

/**
 * Real-time continuous 2-way sync for department patients.
 * Listens to collection 'department_patients'.
 * Any change from any browser or device immediately updates the application state.
 * If Firestore is empty on first run, it automatically boots up by saving initial fallback patients.
 */
export function subscribeToDepartmentPatients(
  onPatientsChange: (patients: Patient[]) => void,
  onStatusChange?: (status: SyncStatus) => void,
  initialFallbackPatients?: Patient[]
): () => void {
  if (!dbInstance) {
    dbInstance = initializeFirebaseFirestore();
  }
  if (!dbInstance) {
    if (onStatusChange) {
      onStatusChange({
        connected: false,
        lastSyncTime: null,
        receivedCount: 0,
        errorMessage: 'Firestore chưa được kết nối',
      });
    }
    return () => {};
  }

  try {
    const colRef = collection(dbInstance, 'department_patients');

    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        if (snapshot.empty) {
          onPatientsChange([]);
          if (onStatusChange) {
            onStatusChange({
              connected: true,
              lastSyncTime: new Date().toLocaleTimeString('vi-VN'),
              receivedCount: 0,
              errorMessage: null,
            });
          }
          return;
        }

        const patientsList: Patient[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          patientsList.push(mapFirestoreRecordToPatient(docSnap.id, data));
        });

        // Natural sort by Room and Bed Number
        patientsList.sort((a, b) => {
          const roomComp = a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
          if (roomComp !== 0) return roomComp;
          return a.bedNumber.localeCompare(b.bedNumber, undefined, { numeric: true });
        });

        onPatientsChange(patientsList);

        if (onStatusChange) {
          onStatusChange({
            connected: true,
            lastSyncTime: new Date().toLocaleTimeString('vi-VN'),
            receivedCount: patientsList.length,
            errorMessage: null,
          });
        }
      },
      (error) => {
        console.warn('Lỗi lắng nghe dữ liệu department_patients:', error);
        if (onStatusChange) {
          onStatusChange({
            connected: false,
            lastSyncTime: null,
            receivedCount: 0,
            errorMessage: error.message || 'Lỗi kết nối Firestore',
          });
        }
      }
    );

    return unsubscribe;
  } catch (err: any) {
    console.error('Lỗi onSnapshot department_patients:', err);
    return () => {};
  }
}

/**
 * Recursively strips 'undefined' values from an object/array so Firestore setDoc does not fail.
 */
export function sanitizeObjectForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObjectForFirestore(item)) as any;
  }
  
  const cleanObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj as Record<string, any>)) {
    if (value !== undefined) {
      cleanObj[key] = sanitizeObjectForFirestore(value);
    }
  }
  return cleanObj as T;
}

/**
 * Executes a Firestore operation with automatic fallback to standard (default) database
 * if a custom named database ID encounters connection or permission issues.
 */
async function executeFirestoreOp<T>(op: (db: Firestore) => Promise<T>): Promise<T> {
  let db = initializeFirebaseFirestore();
  if (!db) {
    throw new Error('Không thể khởi tạo Firebase Firestore SDK.');
  }
  try {
    return await op(db);
  } catch (err: any) {
    const config = getActiveFirebaseConfig();
    if (config.databaseId && config.databaseId !== '(default)' && appInstance) {
      console.warn(`[Firestore Sync] Thử lại thao tác trên (default) DB do lỗi với database [${config.databaseId}]:`, err);
      try {
        const defaultDb = getFirestore(appInstance);
        return await op(defaultDb);
      } catch (fallbackErr: any) {
        throw fallbackErr;
      }
    }
    throw err;
  }
}

// Sync single patient to Cloud Firestore collection 'department_patients'
export async function syncPatientToCloud(patient: Patient): Promise<{ success: boolean; error?: string; details?: string }> {
  const config = getActiveFirebaseConfig();
  try {
    await executeFirestoreOp(async (db) => {
      const docRef = doc(db, 'department_patients', patient.id);
      const payload = sanitizeObjectForFirestore({
        ...patient,
        cloudSyncedAt: serverTimestamp(),
        updatedAt: new Date().toISOString(),
      });
      await setDoc(docRef, payload, { merge: true });
    });
    return { success: true };
  } catch (e: any) {
    console.warn('Lỗi lưu bệnh nhân lên Cloud Firestore:', e);
    const code = e?.code ? `[Mã lỗi: ${e.code}] ` : '';
    const msg = e?.message || String(e);
    return { 
      success: false, 
      error: `${code}${msg}`,
      details: `Project: ${config.projectId} | Database: ${config.databaseId}`
    };
  }
}

// Delete single patient document from Cloud Firestore collection 'department_patients'
export async function deletePatientFromCloud(patientId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await executeFirestoreOp(async (db) => {
      const docRef = doc(db, 'department_patients', patientId);
      await deleteDoc(docRef);
    });
    return { success: true };
  } catch (e: any) {
    console.warn('Lỗi xóa bệnh nhân khỏi Cloud Firestore:', e);
    return { success: false, error: e?.message || String(e) };
  }
}

// Delete all patient documents from Cloud Firestore collection 'department_patients'
export async function deleteAllPatientsFromCloud(): Promise<{ success: boolean; error?: string }> {
  try {
    await executeFirestoreOp(async (db) => {
      const colRef = collection(db, 'department_patients');
      const snap = await getDocs(colRef);
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
    });
    return { success: true };
  } catch (e: any) {
    console.warn('Lỗi xóa toàn bộ bệnh nhân trên Cloud Firestore:', e);
    return { success: false, error: e?.message || String(e) };
  }
}

// Sync all patients to Cloud Firestore collection 'department_patients'
export async function syncAllPatientsToCloud(patients: Patient[]): Promise<{ success: boolean; count: number; error?: string; details?: string }> {
  const config = getActiveFirebaseConfig();
  if (!patients || patients.length === 0) {
    return { success: false, count: 0, error: 'Danh sách bệnh nhân rỗng, không có dữ liệu để đẩy lên Cloud' };
  }
  try {
    let synced = 0;
    await executeFirestoreOp(async (db) => {
      for (const p of patients) {
        const docRef = doc(db, 'department_patients', p.id);
        const payload = sanitizeObjectForFirestore({
          ...p,
          cloudSyncedAt: serverTimestamp(),
          updatedAt: new Date().toISOString(),
        });
        await setDoc(docRef, payload, { merge: true });
        synced++;
      }
    });
    return { success: true, count: synced };
  } catch (e: any) {
    console.warn('Lỗi lưu danh sách bệnh nhân lên Cloud Firestore:', e);
    const code = e?.code ? `[Mã lỗi: ${e.code}] ` : '';
    const msg = e?.message || String(e);
    return { 
      success: false, 
      count: 0, 
      error: `${code}${msg}`,
      details: `Project: ${config.projectId} | Database: ${config.databaseId}`
    };
  }
}

// Fetch all patients stored in Cloud Firestore
export async function fetchPatientsFromCloud(): Promise<{ success: boolean; patients?: Patient[]; error?: string; details?: string }> {
  const config = getActiveFirebaseConfig();
  try {
    const fetchedPatients = await executeFirestoreOp(async (db) => {
      const colRef = collection(db, 'department_patients');
      const snapshot = await getDocs(colRef);
      if (snapshot.empty) {
        const emrCol = collection(db, 'clinical_records');
        const emrSnap = await getDocs(emrCol);
        if (emrSnap.empty) {
          return [];
        }
        const fetched: Patient[] = [];
        emrSnap.forEach((d) => {
          fetched.push(mapFirestoreRecordToPatient(d.id, d.data()));
        });
        return fetched;
      }

      const fetched: Patient[] = [];
      snapshot.forEach((d) => {
        fetched.push(mapFirestoreRecordToPatient(d.id, d.data()));
      });
      return fetched;
    });

    return { success: true, patients: fetchedPatients };
  } catch (e: any) {
    console.error('Lỗi tải dữ liệu bệnh nhân từ Cloud:', e);
    const code = e?.code ? `[Mã lỗi: ${e.code}] ` : '';
    const msg = e?.message || String(e);
    return { 
      success: false, 
      error: `${code}${msg}`,
      details: `Project: ${config.projectId} | Database: ${config.databaseId}`
    };
  }
}

// Test writing data online to Firestore with full diagnostic details
export async function testCloudWrite(): Promise<{ success: boolean; id?: string; error?: string; details?: string }> {
  const config = getActiveFirebaseConfig();
  try {
    const docId = await executeFirestoreOp(async (db) => {
      const docRef = await addDoc(collection(db, 'clinical_records'), {
        deptCode: 'KHOA_CAP_CUU',
        patientName: 'BN Kiểm Tra Kết Nối Cloud (Gia Lai)',
        age: 58,
        gender: 'Nam',
        diagnosis: `Thử nghiệm ghi thành công vào Firestore [Project: ${config.projectId}]`,
        roomNumber: '733',
        bedNumber: 'Giường 01',
        severity: 'STABLE',
        createdAt: serverTimestamp(),
        testCheck: true,
        timestamp: new Date().toISOString()
      });
      return docRef.id;
    });

    return { 
      success: true, 
      id: docId,
      details: `Đã kết nối & ghi probe thành công [ID: ${docId}] vào Project: "${config.projectId}", DB: "${config.databaseId}"!`
    };
  } catch (err: any) {
    console.error('Lỗi test ghi dữ liệu online:', err);
    const code = err?.code ? `[Mã lỗi: ${err.code}] ` : '';
    const msg = err?.message || String(err);
    return { 
      success: false, 
      error: `${code}${msg}`,
      details: `Thông số thử nghiệm: Project [${config.projectId}], Database [${config.databaseId}], AuthDomain [${config.authDomain}].`
    };
  }
}


/**
 * Đồng bộ bản ghi vệ tinh đã bỏ qua (Dismissed Satellite Record) lên Cloud Firestore của Khoa
 * Giúp các máy tính khác trong khoa tự động đồng bộ và không hiển thị lại các ca đã bỏ qua
 */
export async function syncDismissedSatelliteRecordToCloud(recordId: string, patientName?: string): Promise<void> {
  try {
    await executeFirestoreOp(async (db) => {
      const docRef = doc(db, 'department_satellite_dismissed', recordId);
      await setDoc(docRef, {
        recordId,
        patientName: patientName || '',
        dismissedAt: serverTimestamp(),
      }, { merge: true });
    });
  } catch (err) {
    console.warn('Lỗi đồng bộ bản ghi vệ tinh đã bỏ qua lên Cloud:', err);
  }
}

/**
 * Lắng nghe thời gian thực danh sách các bản ghi vệ tinh đã bị bỏ qua từ Cloud Firestore của Khoa
 */
export function subscribeToDismissedSatelliteRecords(
  onUpdate: (dismissedIds: string[]) => void
): () => void {
  try {
    const db = initializeFirebaseFirestore();
    if (!db) return () => {};

    const colRef = collection(db, 'department_satellite_dismissed');
    return onSnapshot(colRef, (snapshot) => {
      const ids: string[] = [];
      snapshot.forEach((docSnap) => {
        ids.push(docSnap.id);
        const data = docSnap.data();
        if (data.recordId && !ids.includes(data.recordId)) ids.push(data.recordId);
        if (data.patientName) ids.push(data.patientName.trim().toLowerCase());
      });
      onUpdate(ids);
    }, (error) => {
      console.warn('Lỗi lắng nghe department_satellite_dismissed:', error);
    });
  } catch (err) {
    console.warn('Lỗi khởi tạo lắng nghe department_satellite_dismissed:', err);
    return () => {};
  }
}


/**
 * Trích xuất phần ngày chuẩn (YYYY-MM-DD) từ bất kỳ chuỗi ngày nào
 */
function extractDateOnly(dateStr?: string): string {
  if (!dateStr) return '';
  const clean = String(dateStr).trim();
  const ymdMatch = clean.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (ymdMatch && ymdMatch[1] && ymdMatch[2] && ymdMatch[3]) {
    return `${ymdMatch[1]}-${String(ymdMatch[2]).padStart(2, '0')}-${String(ymdMatch[3]).padStart(2, '0')}`;
  }
  const dmyMatch = clean.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (dmyMatch && dmyMatch[1] && dmyMatch[2] && dmyMatch[3]) {
    return `${dmyMatch[3]}-${String(dmyMatch[2]).padStart(2, '0')}-${String(dmyMatch[1]).padStart(2, '0')}`;
  }
  const timeDmyMatch = clean.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (timeDmyMatch && timeDmyMatch[1] && timeDmyMatch[2] && timeDmyMatch[3]) {
    return `${timeDmyMatch[3]}-${String(timeDmyMatch[2]).padStart(2, '0')}-${String(timeDmyMatch[1]).padStart(2, '0')}`;
  }
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return '';
}

/**
 * Chuyển đổi an toàn giá trị ngày (Date, Firestore Timestamp, ISO string, DD/MM/YYYY, YYYY-MM-DD) sang epoch timestamp (ms).
 * Ưu tiên nhận diện đúng định dạng ngày Việt Nam DD/MM/YYYY để tránh bị nhầm lẫn tháng/ngày.
 */
export function parseDateToTimestamp(val: any): number | null {
  if (!val) return null;
  if (typeof val === 'object' && typeof (val as any).toDate === 'function') {
    return (val as any).toDate().getTime();
  }
  if (typeof val === 'object' && typeof (val as any).seconds === 'number') {
    return (val as any).seconds * 1000;
  }
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val.getTime();
  }
  if (typeof val === 'number') {
    return val > 1000000000 ? val : null;
  }
  if (typeof val === 'string') {
    const clean = val.trim();
    if (!clean) return null;

    // ISO format với T (vd: 2026-11-09T05:03:11Z)
    if (/^\d{4}-\d{2}-\d{2}T/i.test(clean)) {
      const parsed = Date.parse(clean);
      if (!isNaN(parsed)) return parsed;
    }

    // Định dạng ngày Việt Nam hoặc chuẩn YYYY-MM-DD
    const dOnly = extractDateOnly(clean);
    if (dOnly) {
      const timeMatch = clean.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
      if (timeMatch && timeMatch[1] && timeMatch[2]) {
        const hh = String(timeMatch[1]).padStart(2, '0');
        const mm = String(timeMatch[2]).padStart(2, '0');
        const ss = String(timeMatch[3] || '00').padStart(2, '0');
        const dt = new Date(`${dOnly}T${hh}:${mm}:${ss}`);
        if (!isNaN(dt.getTime())) return dt.getTime();
      }
      const dt = new Date(`${dOnly}T00:00:00`);
      if (!isNaN(dt.getTime())) return dt.getTime();
    }

    const parsed = Date.parse(clean);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
}

export interface FirestoreCleanupResult {
  success: boolean;
  deletedPatientsCount: number;
  deletedDismissedCount: number;
  deletedProbeCount: number;
  deletedSatelliteCount: number;
  totalDeleted: number;
  prunedVitalsCount: number;
  details?: string;
  error?: string;
}

/**
 * Tự động xóa dữ liệu trên Cloud Firestore nếu dữ liệu cũ quá 15 ngày
 * (hoặc số ngày tùy chỉnh qua daysThreshold)
 * Nhằm tránh dầy dữ liệu, tiết kiệm dung lượng Firestore và tối ưu hiệu suất truy vấn.
 * 
 * Phạm vi dọn dẹp:
 * 1. Collection 'department_patients':
 *    - Bệnh nhân đã ra viện (status === 'DISCHARGED') mà ngày ra viện hoặc hoạt động cuối cũ quá 15 ngày.
 *    - Bản ghi test probe hoặc bệnh nhân thử nghiệm cũ > 15 ngày.
 *    - Bệnh nhân không còn trong trạng thái điều trị tích cực và không có hoạt động trong > 15 ngày.
 *    - Bệnh nhân điều trị dài ngày: Tỉa bớt các chỉ số sinh hiệu quá 15 ngày để giữ document gọn nhẹ, không vượt hạn mức 1MB của Firestore.
 * 2. Collection 'clinical_records':
 *    - Các bản ghi probe/test từ hàm testCloudWrite() cũ > 15 ngày.
 * 3. Collection 'department_satellite_dismissed':
 *    - Các ID ca vệ tinh đã bấm bỏ qua cũ > 15 ngày.
 */
export async function cleanupOldFirestoreData(daysThreshold = 15): Promise<FirestoreCleanupResult> {
  const thresholdMs = daysThreshold * 24 * 60 * 60 * 1000;
  const cutoffTime = Date.now() - thresholdMs;

  let deletedPatientsCount = 0;
  let deletedDismissedCount = 0;
  let deletedProbeCount = 0;
  const deletedSatelliteCount = 0;
  let prunedVitalsCount = 0;

  try {
    await executeFirestoreOp(async (db) => {
      // 1. Dọn dẹp collection 'department_patients'
      const patientsCol = collection(db, 'department_patients');
      const patientsSnap = await getDocs(patientsCol);

      for (const docSnap of patientsSnap.docs) {
        const data = docSnap.data();
        const docId = docSnap.id;

        const admissionTime = parseDateToTimestamp(data.admissionDate);
        const updatedTime = parseDateToTimestamp(data.updatedAt) || parseDateToTimestamp(data.cloudSyncedAt);
        const dischargeTime = parseDateToTimestamp(data.dischargeDate);

        let latestVitalTime: number | null = null;
        if (Array.isArray(data.vitals) && data.vitals.length > 0) {
          for (const v of data.vitals) {
            const vt = parseDateToTimestamp(v.timestamp);
            if (vt && (!latestVitalTime || vt > latestVitalTime)) latestVitalTime = vt;
          }
        }

        let latestEvolutionTime: number | null = null;
        if (Array.isArray(data.evolutions) && data.evolutions.length > 0) {
          for (const ev of data.evolutions) {
            const et = parseDateToTimestamp(ev.timestamp);
            if (et && (!latestEvolutionTime || et > latestEvolutionTime)) latestEvolutionTime = et;
          }
        }

        const latestActivityTime = Math.max(
          admissionTime || 0,
          updatedTime || 0,
          dischargeTime || 0,
          latestVitalTime || 0,
          latestEvolutionTime || 0
        );

        const isDischarged = data.status === 'DISCHARGED' || data.admissionStatus === 'DISCHARGE_TODAY';
        const isProbeTest = data.testCheck === true || docId.startsWith('PAT-TEST-') || (data.fullName && data.fullName.includes('BN Kiểm Tra'));
        const isOlderThanLimit = latestActivityTime > 0 && latestActivityTime < cutoffTime;

        // Nếu bệnh nhân đã ra viện và cũ hơn 15 ngày -> XÓA KHỎI FIRESTORE
        // Nếu là bản ghi probe/test thử nghiệm cũ hơn 15 ngày -> XÓA
        // Nếu không ở trạng thái ACTIVE và toàn bộ hoạt động cũ hơn 15 ngày -> XÓA
        // Nếu không có phòng buồng và toàn bộ hoạt động cũ hơn 15 ngày -> XÓA
        if (
          (isDischarged && isOlderThanLimit) ||
          (isProbeTest && isOlderThanLimit) ||
          (data.status !== 'ACTIVE' && isOlderThanLimit) ||
          (isOlderThanLimit && (!data.roomNumber || data.roomNumber === '' || data.roomNumber === 'CHƯA PHÂN BUỒNG'))
        ) {
          try {
            const docRef = doc(db, 'department_patients', docId);
            await deleteDoc(docRef);
            deletedPatientsCount++;
          } catch (delErr) {
            console.warn('[Firestore Cleanup] Lỗi xóa department_patients:', docId, delErr);
          }
        } else if (data.status === 'ACTIVE' && Array.isArray(data.vitals) && data.vitals.length > 15) {
          // Bệnh nhân đang nằm viện dài ngày:
          // Giữ lại sinh hiệu trong vòng 15 ngày, tỉa bớt sinh hiệu cũ hơn 15 ngày để giữ document gọn nhẹ
          const filteredVitals = data.vitals.filter((v: any) => {
            const vt = parseDateToTimestamp(v.timestamp);
            return !vt || vt >= cutoffTime;
          });
          if (filteredVitals.length < data.vitals.length) {
            prunedVitalsCount += (data.vitals.length - filteredVitals.length);
            try {
              const docRef = doc(db, 'department_patients', docId);
              const payload = sanitizeObjectForFirestore({ vitals: filteredVitals });
              await setDoc(docRef, payload, { merge: true });
            } catch (pruneErr) {
              console.warn('[Firestore Cleanup] Lỗi tỉa sinh hiệu cũ:', docId, pruneErr);
            }
          }
        }
      }

      // 2. Dọn dẹp collection 'clinical_records' (bản ghi test probe)
      try {
        const recordsCol = collection(db, 'clinical_records');
        const recordsSnap = await getDocs(recordsCol);
        for (const docSnap of recordsSnap.docs) {
          const data = docSnap.data();
          const recTime = parseDateToTimestamp(data.createdAt || data.timestamp || data.admissionDate);
          if (recTime && recTime < cutoffTime) {
            try {
              const docRef = doc(db, 'clinical_records', docSnap.id);
              await deleteDoc(docRef);
              deletedProbeCount++;
            } catch (delErr) {
              console.warn('[Firestore Cleanup] Lỗi xóa clinical_records cũ:', docSnap.id, delErr);
            }
          }
        }
      } catch (err) {
        console.warn('[Firestore Cleanup] Lỗi dọn dẹp clinical_records:', err);
      }

      // 3. Dọn dẹp collection 'department_satellite_dismissed' (danh sách bỏ qua cũ)
      try {
        const dismissedCol = collection(db, 'department_satellite_dismissed');
        const dismissedSnap = await getDocs(dismissedCol);
        for (const docSnap of dismissedSnap.docs) {
          const data = docSnap.data();
          const dTime = parseDateToTimestamp(data.dismissedAt);
          if (dTime && dTime < cutoffTime) {
            try {
              const docRef = doc(db, 'department_satellite_dismissed', docSnap.id);
              await deleteDoc(docRef);
              deletedDismissedCount++;
            } catch (delErr) {
              console.warn('[Firestore Cleanup] Lỗi xóa department_satellite_dismissed cũ:', docSnap.id, delErr);
            }
          }
        }
      } catch (err) {
        console.warn('[Firestore Cleanup] Lỗi dọn dẹp department_satellite_dismissed:', err);
      }
    });

    const totalDeleted = deletedPatientsCount + deletedDismissedCount + deletedProbeCount;
    return {
      success: true,
      deletedPatientsCount,
      deletedDismissedCount,
      deletedProbeCount,
      deletedSatelliteCount: 0,
      prunedVitalsCount,
      totalDeleted,
      details: `Đã dọn dẹp thành công ${totalDeleted} bản ghi cũ quá ${daysThreshold} ngày trên Cloud Firestore (BN ra viện: ${deletedPatientsCount}, Vệ tinh đã xóa: ${deletedDismissedCount}, Thử nghiệm: ${deletedProbeCount}).`,
    };
  } catch (err: any) {
    console.error('[Firestore Cleanup] Thất bại:', err);
    return {
      success: false,
      deletedPatientsCount,
      deletedDismissedCount,
      deletedProbeCount,
      deletedSatelliteCount: 0,
      prunedVitalsCount,
      totalDeleted: 0,
      error: err.message || String(err),
    };
  }
}

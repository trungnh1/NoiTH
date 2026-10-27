import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
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

// Target Firebase Project configuration
// Supports manual user config in localStorage, Vercel env vars, or defaults
export function getActiveFirebaseConfig() {
  const localProject = typeof window !== 'undefined' ? localStorage.getItem('CUSTOM_FIREBASE_PROJECT_ID') : null;
  const localDb = typeof window !== 'undefined' ? localStorage.getItem('CUSTOM_FIREBASE_DATABASE_ID') : null;
  const localApiKey = typeof window !== 'undefined' ? localStorage.getItem('CUSTOM_FIREBASE_API_KEY') : null;
  const localAppId = typeof window !== 'undefined' ? localStorage.getItem('CUSTOM_FIREBASE_APP_ID') : null;
  const localAuthDomain = typeof window !== 'undefined' ? localStorage.getItem('CUSTOM_FIREBASE_AUTH_DOMAIN') : null;

  const projectId = localProject || import.meta.env.VITE_FIREBASE_PROJECT_ID || "iron-foundation-kbcxw";
  const apiKey = localApiKey || import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC9FUny98eUFmOW2v06hpezo37F_Rg4o9Q";
  const appId = localAppId || import.meta.env.VITE_FIREBASE_APP_ID || "1:692966572750:web:5e06d6560890da7676469f";
  const authDomain = localAuthDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`;
  const databaseId = localDb || import.meta.env.VITE_FIREBASE_DATABASE_ID || "(default)";

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
      allergies: record.allergies || 'Không ghi nhận',
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
    allergies: record.allergies || record.diUng || 'Chưa ghi nhận',
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

// Subscribe to real-time additions from Khoa Cấp Cứu
export function subscribeToEmergencyRecords(
  onPatientAdded: (patient: Patient) => void,
  onStatusChange?: (status: SyncStatus) => void
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

// Sync single patient to Cloud Firestore collection 'department_patients'
export async function syncPatientToCloud(patient: Patient): Promise<{ success: boolean; error?: string }> {
  if (!dbInstance) {
    dbInstance = initializeFirebaseFirestore();
  }
  if (!dbInstance) {
    return { success: false, error: 'Firestore chưa được khởi tạo' };
  }
  try {
    const docRef = doc(dbInstance, 'department_patients', patient.id);
    await setDoc(docRef, {
      ...patient,
      cloudSyncedAt: serverTimestamp(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return { success: true };
  } catch (e: any) {
    console.warn('Lỗi lưu bệnh nhân lên Cloud Firestore:', e);
    return { success: false, error: e.message || 'Lỗi ghi Firestore' };
  }
}

// Sync all patients to Cloud Firestore collection 'department_patients'
export async function syncAllPatientsToCloud(patients: Patient[]): Promise<{ success: boolean; count: number; error?: string }> {
  if (!dbInstance) {
    dbInstance = initializeFirebaseFirestore();
  }
  if (!dbInstance || !patients || patients.length === 0) {
    return { success: false, count: 0, error: 'Không có dữ liệu hoặc Firestore chưa kết nối' };
  }
  try {
    let synced = 0;
    for (const p of patients) {
      const docRef = doc(dbInstance, 'department_patients', p.id);
      await setDoc(docRef, {
        ...p,
        cloudSyncedAt: serverTimestamp(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      synced++;
    }
    return { success: true, count: synced };
  } catch (e: any) {
    console.warn('Lỗi lưu danh sách bệnh nhân lên Cloud Firestore:', e);
    return { success: false, count: 0, error: e.message || 'Lỗi ghi Firestore' };
  }
}

// Fetch all patients stored in Cloud Firestore project iron-foundation-kbcxw
export async function fetchPatientsFromCloud(): Promise<{ success: boolean; patients?: Patient[]; error?: string }> {
  if (!dbInstance) {
    dbInstance = initializeFirebaseFirestore();
  }
  if (!dbInstance) {
    return { success: false, error: 'Firestore chưa được khởi tạo' };
  }
  try {
    const colRef = collection(dbInstance, 'department_patients');
    const snapshot = await getDocs(colRef);
    if (snapshot.empty) {
      // Also check clinical_records
      const emrCol = collection(dbInstance, 'clinical_records');
      const emrSnap = await getDocs(emrCol);
      if (emrSnap.empty) {
        return { success: true, patients: [] };
      }
      const fetched: Patient[] = [];
      emrSnap.forEach((d) => {
        fetched.push(mapFirestoreRecordToPatient(d.id, d.data()));
      });
      return { success: true, patients: fetched };
    }

    const fetched: Patient[] = [];
    snapshot.forEach((d) => {
      fetched.push(mapFirestoreRecordToPatient(d.id, d.data()));
    });
    return { success: true, patients: fetched };
  } catch (e: any) {
    console.error('Lỗi tải dữ liệu bệnh nhân từ Cloud:', e);
    return { success: false, error: e.message || 'Không thể lấy dữ liệu từ Cloud Firestore' };
  }
}

// Test writing data online to Firestore
export async function testCloudWrite(): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!dbInstance) {
    dbInstance = initializeFirebaseFirestore();
  }
  if (!dbInstance) {
    return { success: false, error: 'Firestore chưa được khởi tạo' };
  }
  try {
    const config = getActiveFirebaseConfig();
    const docRef = await addDoc(collection(dbInstance, 'clinical_records'), {
      deptCode: 'KHOA_CAP_CUU',
      patientName: 'BN Kiểm Tra Kết Nối Cloud (Gia Lai)',
      age: 58,
      gender: 'Nam',
      diagnosis: `Kết nối thành công tới Firebase Project [${config.projectId}]`,
      roomNumber: '733',
      bedNumber: 'Giường 01',
      severity: 'STABLE',
      createdAt: serverTimestamp(),
      testCheck: true,
      timestamp: new Date().toISOString()
    });
    return { success: true, id: docRef.id };
  } catch (err: any) {
    console.error('Lỗi test ghi dữ liệu online:', err);
    return { success: false, error: err.message || 'Không thể ghi dữ liệu lên Cloud' };
  }
}

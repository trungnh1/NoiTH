import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  onSnapshot,
  DocumentData
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { Patient, Doctor, DepartmentRoom, VitalSign, ClinicalEvolution, SeverityLevel } from '../types/patient';

// 1. Cấu hình kết nối Firebase vệ tinh
const firebaseConfig = {
  apiKey: "AIzaSyCnWsWf_3S-mCXd9CY_yaf8mldvXy-Zx7o",
  authDomain: "iron-foundation-kbcxw.firebaseapp.com",
  projectId: "iron-foundation-kbcxw",
  storageBucket: "iron-foundation-kbcxw.firebasestorage.app",
  messagingSenderId: "1074090936675",
  appId: "1:1074090936675:web:bfb5aee03beef58baceb56"
};

export const clinicalApp = getApps().some(app => app.name === 'clinicalRemoteApp')
  ? getApp('clinicalRemoteApp')
  : initializeApp(firebaseConfig, 'clinicalRemoteApp');

// 2. Khởi tạo Firestore với Database ID cụ thể
export const CLINICAL_DATABASE_ID = "ai-studio-clinicaldataform-1c5181d9-a5e0-4c0f-9dc7-144aaa297796";
export const db = getFirestore(clinicalApp, CLINICAL_DATABASE_ID);
export const CLINICAL_COLLECTION = "clinical_records";

// Firebase Auth cho dự án vệ tinh
export const clinicalAuth = getAuth(clinicalApp);
export const clinicalGoogleProvider = new GoogleAuthProvider();

export async function loginSatelliteGoogle(): Promise<User> {
  const result = await signInWithPopup(clinicalAuth, clinicalGoogleProvider);
  return result.user;
}

export async function logoutSatelliteGoogle(): Promise<void> {
  await signOut(clinicalAuth);
}

export function subscribeSatelliteAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(clinicalAuth, callback);
}

// 3. Kiểu dữ liệu TypeScript khớp chính xác Schema
export interface ClinicalRecord {
  id: string;
  patientName: string;
  patientAge?: string;
  patientGender?: string;
  patientRoom?: string;
  admissionDate?: string;
  vitalSigns?: string;
  medicalHistory?: string;
  clinicalCourse?: string;
  clsHtml?: string;
  diagnosis?: string;
  treatmentPlan?: string;
  clinicalDataJson?: string;
  createdAt: string;
  updatedAt?: string;
  status?: string;

  // Trường hỗ trợ chuyển đổi ngược tương thích
  fullName?: string;
  age?: number | string;
  gender?: string;
  roomNumber?: string;
  bedNumber?: string;
  bp?: string;
  vitals?: any;
  clinicalNote?: string;
  labsHtml?: string;
}

/**
 * Trích xuất text thuần từ chuỗi HTML
 */
export function stripHtmlTags(htmlStr?: string): string {
  if (!htmlStr) return '';
  return htmlStr
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

// 4. Hàm lấy danh sách bệnh án mới nhất
export const fetchClinicalRecords = async (): Promise<ClinicalRecord[]> => {
  const recordsRef = collection(db, CLINICAL_COLLECTION);
  try {
    const q = query(recordsRef, orderBy('createdAt', 'desc'), limit(50));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    } as ClinicalRecord));
  } catch (err) {
    // Trường hợp không có index orderBy
    const snapshot = await getDocs(recordsRef);
    const records = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    } as ClinicalRecord));
    records.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return records;
  }
};

// 5. Hàm lắng nghe thời gian thực (Realtime)
export const subscribeToClinicalRecords = (onUpdate: (records: ClinicalRecord[]) => void, onError?: (err: Error) => void) => {
  const recordsRef = collection(db, CLINICAL_COLLECTION);
  
  const handleSnapshot = (snapshot: any) => {
    const records = snapshot.docs.map((docSnap: any) => ({
      id: docSnap.id,
      ...docSnap.data()
    } as ClinicalRecord));
    records.sort((a: ClinicalRecord, b: ClinicalRecord) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    onUpdate(records);
  };

  try {
    const q = query(recordsRef, orderBy('createdAt', 'desc'), limit(50));
    return onSnapshot(q, handleSnapshot, (err) => {
      console.warn('Realtime listener with query failed, falling back to collection listener:', err.message);
      return onSnapshot(recordsRef, handleSnapshot, (err2) => {
        if (onError) onError(err2);
      });
    });
  } catch {
    return onSnapshot(recordsRef, handleSnapshot, (err) => {
      if (onError) onError(err);
    });
  }
};

/**
 * Trích xuất chỉ số sinh hiệu từ chuỗi text sinh hiệu (ví dụ: "HA: 130/80 mmHg, Mạch: 85 l/p, Nhiệt độ: 37°C, SpO2: 98%")
 */
export function parseVitalSignsText(vitalText?: string): {
  bpSystolic: number;
  bpDiastolic: number;
  heartRate: number;
  temperature: number;
  spO2: number;
  respiratoryRate: number;
} {
  let bpSystolic = 120;
  let bpDiastolic = 80;
  let heartRate = 80;
  let temperature = 37.0;
  let spO2 = 98;
  let respiratoryRate = 20;

  if (!vitalText) {
    return { bpSystolic, bpDiastolic, heartRate, temperature, spO2, respiratoryRate };
  }

  // Huyết áp
  const bpMatch = vitalText.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (bpMatch) {
    bpSystolic = Number(bpMatch[1]) || 120;
    bpDiastolic = Number(bpMatch[2]) || 80;
  }

  // Mạch
  const pulseMatch = vitalText.match(/(?:Mạch|M|HR|Pulse)[:\s]*(\d{2,3})/i) || vitalText.match(/(\d{2,3})\s*(?:l\/p|bpm|lần\/phút)/i);
  if (pulseMatch) {
    heartRate = Number(pulseMatch[1]) || 80;
  }

  // Nhiệt độ
  const tempMatch = vitalText.match(/(?:Nhiệt|Sốt|Temp|T)[:\s]*(\d{2}(?:\.\d)?)/i) || vitalText.match(/(\d{2}\.\d)\s*°?C/i);
  if (tempMatch) {
    temperature = Number(tempMatch[1]) || 37.0;
  }

  // SpO2
  const spo2Match = vitalText.match(/(?:SpO2|SpO₂|O2)[:\s]*(\d{2,3})/i) || vitalText.match(/(\d{2,3})\s*%/i);
  if (spo2Match) {
    spO2 = Number(spo2Match[1]) || 98;
  }

  // Nhịp thở
  const respMatch = vitalText.match(/(?:Nhịp thở|Thở|NT)[:\s]*(\d{2})/i);
  if (respMatch) {
    respiratoryRate = Number(respMatch[1]) || 20;
  }

  return { bpSystolic, bpDiastolic, heartRate, temperature, spO2, respiratoryRate };
}

/**
 * Chuyển đổi an toàn từ 1 bản ghi vệ tinh chuẩn Schema sang đối tượng Patient bệnh viện
 */
export function mapClinicalRecordToPatient(
  record: ClinicalRecord,
  doctors: Doctor[],
  rooms: DepartmentRoom[],
  defaultDoctorId?: string
): Patient {
  const now = new Date();
  const defaultDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Họ tên
  const fullName = (record.patientName || record.fullName || 'Bệnh Nhân Vệ Tinh').trim();

  // Tuổi
  let age = Number(record.patientAge || record.age || 60);
  if (isNaN(age) || age < 1 || age > 125) age = 60;

  // Giới tính
  let gender: 'Nam' | 'Nữ' = 'Nam';
  const rawGender = String(record.patientGender || record.gender || '').toLowerCase();
  if (rawGender.includes('nữ') || rawGender.includes('nu') || rawGender.includes('female') || rawGender === 'f') {
    gender = 'Nữ';
  }

  // Buồng / Phòng
  let rawRoom = String(record.patientRoom || record.roomNumber || '').trim();
  let bedNumber = 'Giường 01';
  
  if (rawRoom.includes('-') || rawRoom.includes('/')) {
    const parts = rawRoom.split(/[-/]/);
    rawRoom = parts[0].trim();
    if (parts[1]) bedNumber = parts[1].trim().toLowerCase().startsWith('giường') ? parts[1].trim() : `Giường ${parts[1].trim()}`;
  }
  rawRoom = rawRoom.replace(/^(phòng|p\.?|buồng)\s*/i, '').trim();
  
  const matchedRoom = rooms.find(r => r.number === rawRoom || r.number.replace(/\D/g, '') === rawRoom.replace(/\D/g, ''));
  const roomNumber = matchedRoom ? matchedRoom.number : (rawRoom || (rooms[0]?.number || '703'));

  // Bác sĩ phụ trách
  const doctor = doctors.find(d => d.id === defaultDoctorId) || doctors[0];
  const attendingDoctorId = doctor?.id || '00979';

  // Sinh hiệu
  const vitalsText = record.vitalSigns || '';
  const parsedVitals = parseVitalSignsText(vitalsText);

  if (record.bp && record.bp.includes('/')) {
    const [s, d] = record.bp.split('/').map(Number);
    if (!isNaN(s) && s > 0) parsedVitals.bpSystolic = s;
    if (!isNaN(d) && d > 0) parsedVitals.bpDiastolic = d;
  }

  const vitalsList: VitalSign[] = [{
    id: `V-SAT-${Date.now()}`,
    timestamp: record.admissionDate || record.createdAt || defaultDateStr,
    bpSystolic: parsedVitals.bpSystolic,
    bpDiastolic: parsedVitals.bpDiastolic,
    heartRate: parsedVitals.heartRate,
    temperature: parsedVitals.temperature,
    spO2: parsedVitals.spO2,
    respiratoryRate: parsedVitals.respiratoryRate,
    notes: vitalsText || 'Sinh hiệu tiếp nhận từ Cloud vệ tinh',
  }];

  // Tiền sử
  const medicalHistory = (record.medicalHistory || '').trim();

  // Chẩn đoán & Y lệnh
  const primaryDiagnosis = (record.diagnosis || 'Theo dõi bệnh nội khoa').trim();
  const treatmentPlan = (record.treatmentPlan || 'Duy trì phác đồ điều trị nội khoa.').trim();

  // Cận lâm sàng nổi bật (HTML & Plain text)
  const clsHtml = record.clsHtml || record.labsHtml || '';
  const initialLabsText = stripHtmlTags(clsHtml);

  // Diễn tiến lâm sàng
  const clinicalCourse = (record.clinicalCourse || record.clinicalNote || '').trim();
  const evolutionsList: ClinicalEvolution[] = [];
  if (clinicalCourse) {
    evolutionsList.push({
      id: `EV-SAT-${Date.now()}`,
      timestamp: record.admissionDate || record.createdAt || defaultDateStr,
      doctorName: doctor?.name || 'BS Điều trị',
      shift: 'Sáng',
      clinicalNote: clinicalCourse,
      treatmentAction: treatmentPlan,
      orders: initialLabsText ? `CLS: ${initialLabsText.slice(0, 80)}...` : undefined,
    });
  }

  // Mức độ
  let severity: SeverityLevel = 'STABLE';
  if (parsedVitals.bpSystolic >= 160 || parsedVitals.spO2 < 93) {
    severity = 'CRITICAL';
  }

  const newPatient: Patient = {
    id: record.id || `SAT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    fullName,
    age,
    gender,
    dateOfBirth: `${now.getFullYear() - age}-01-01`,
    roomNumber,
    bedNumber,
    admissionDate: record.admissionDate || record.createdAt || defaultDateStr,
    attendingDoctorId,
    primaryNurse: 'Điều dưỡng phụ trách phòng',
    primaryDiagnosis,
    medicalHistory: medicalHistory || undefined,
    severity,
    admissionStatus: 'ADMITTED_TODAY',
    tags: parsedVitals.spO2 < 95 ? ['O2_CANULA'] : [],
    treatmentPlan,
    importantNotes: `[Hồ sơ vệ tinh Cloud Firestore] Đồng bộ từ ${record.id}`,
    initialLabsText: initialLabsText || undefined,
    vitals: vitalsList,
    evolutions: evolutionsList,
    labs: [],
    medications: [],
    status: 'ACTIVE',
  };

  return newPatient;
}

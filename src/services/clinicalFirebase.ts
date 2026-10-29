import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  onSnapshot,
  doc,
  deleteDoc,
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
  medicalRecordNumber?: string;
  doctorName?: string;
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

/**
 * Format ISO datetime string (e.g. 2026-10-28T14:13:32.038Z) into readable format: "14:13 28-10-2026"
 */
export function formatSatelliteDateTime(dateTimeStr?: string): string {
  if (!dateTimeStr) return 'N/A';
  try {
    const isoMatch = dateTimeStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})[T\s](\d{1,2}):(\d{1,2})/);
    if (isoMatch) {
      const [, y, m, d, hh, mm] = isoMatch;
      return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')} ${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
    }
    const date = new Date(dateTimeStr.replace(' ', 'T'));
    if (!isNaN(date.getTime())) {
      const hh = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const y = date.getFullYear();
      return `${hh}:${mm} ${d}-${m}-${y}`;
    }
  } catch {
    // fallback
  }
  return dateTimeStr;
}

/**
 * Xóa bản ghi vệ tinh khỏi Cloud Firestore và lưu bộ lọc DELETED_SATELLITE_IDS
 */
export async function deleteSatelliteRecord(recordId: string): Promise<boolean> {
  // 1. Lưu ID đã xóa vào localStorage để lọc vĩnh viễn không hiển thị lại
  try {
    const deletedIds: string[] = JSON.parse(localStorage.getItem('DELETED_SATELLITE_IDS') || '[]');
    if (!deletedIds.includes(recordId)) {
      deletedIds.push(recordId);
      localStorage.setItem('DELETED_SATELLITE_IDS', JSON.stringify(deletedIds));
    }
  } catch (e) {
    console.warn('Lỗi lưu DELETED_SATELLITE_IDS:', e);
  }

  // 2. Thử xóa khỏi Cloud Firestore
  try {
    const docRef = doc(db, CLINICAL_COLLECTION, recordId);
    await deleteDoc(docRef);
  } catch (err: any) {
    console.warn('Lỗi xóa Firestore vệ tinh (đã lưu bộ lọc địa phương):', err);
  }
  return true;
}

function filterOutDeletedSatelliteRecords(records: ClinicalRecord[]): ClinicalRecord[] {
  try {
    const deletedIds: string[] = JSON.parse(localStorage.getItem('DELETED_SATELLITE_IDS') || '[]');
    if (deletedIds.length > 0) {
      return records.filter((r) => !deletedIds.includes(r.id));
    }
  } catch (e) {
    console.warn(e);
  }
  return records;
}

// 4. Hàm lấy danh sách bệnh án mới nhất
export const fetchClinicalRecords = async (): Promise<ClinicalRecord[]> => {
  const recordsRef = collection(db, CLINICAL_COLLECTION);
  let records: ClinicalRecord[] = [];
  try {
    const q = query(recordsRef, orderBy('createdAt', 'desc'), limit(50));
    const snapshot = await getDocs(q);
    records = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    } as ClinicalRecord));
  } catch (err) {
    const snapshot = await getDocs(recordsRef);
    records = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    } as ClinicalRecord));
    records.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }
  return filterOutDeletedSatelliteRecords(records);
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
    onUpdate(filterOutDeletedSatelliteRecords(records));
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
 * Trích xuất số tuổi an toàn từ chuỗi (ví dụ: "45T", "45t", "45 tuổi", 45)
 */
export function parseAgeNumber(ageInput?: any): number {
  if (ageInput === null || ageInput === undefined) return 0;
  if (typeof ageInput === 'number' && !isNaN(ageInput) && ageInput > 0) return Math.round(ageInput);
  const str = String(ageInput).trim();
  const match = str.match(/(\d{1,3})/);
  if (match) {
    const val = parseInt(match[1], 10);
    if (!isNaN(val) && val > 0 && val <= 125) return val;
  }
  return 0;
}

/**
 * Kiểm tra xem bản ghi vệ tinh có ĐỦ thông tin quan trọng để tự động nhập viện nội trú không
 * (Bao gồm: Tên bệnh nhân, Tuổi, Số phòng)
 */
export function checkSatelliteRecordCompleteness(record: ClinicalRecord): {
  isComplete: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  // 1. Kiểm tra Họ tên
  const name = (record.patientName || record.fullName || '').trim();
  if (!name || name.length < 2 || name.toLowerCase() === 'bệnh nhân vệ tinh') {
    missingFields.push('Họ tên bệnh nhân');
  }

  // 2. Kiểm tra Tuổi
  const age = parseAgeNumber(record.patientAge || record.age);
  if (!age) {
    missingFields.push('Tuổi bệnh nhân');
  }

  // 3. Kiểm tra Số phòng
  let rawRoom = String(record.patientRoom || record.roomNumber || '').trim();
  rawRoom = rawRoom.replace(/^(phòng|p\.?|buồng)\s*/i, '').trim();
  if (!rawRoom || rawRoom === 'Chưa xếp phòng' || !/\d/.test(rawRoom)) {
    missingFields.push('Số buồng / phòng');
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
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
  let age = parseAgeNumber(record.patientAge || record.age);
  if (!age) age = 60;

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
  let severity: SeverityLevel = 'UNCLASSIFIED';
  if (parsedVitals.bpSystolic >= 160 || parsedVitals.spO2 < 93) {
    severity = 'CRITICAL';
  } else if (parsedVitals.spO2 < 95 || parsedVitals.bpSystolic >= 140) {
    severity = 'MODERATE';
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
    importantNotes: 'Hồ sơ lấy từ App tạo slide giao ban',
    initialLabsText: initialLabsText || undefined,
    vitals: vitalsList,
    evolutions: evolutionsList,
    labs: [],
    medications: [],
    status: 'ACTIVE',
  };

  return newPatient;
}

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
import { DEFAULT_ROOM_DOCTORS } from '../data/mockData';
import { isRealAllergy } from '../utils/clinicalTextParser';

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
    const filtered = filterOutDeletedSatelliteRecords(records);
    try {
      localStorage.setItem('CACHED_SATELLITE_RECORDS', JSON.stringify(filtered));
    } catch (e) {
      console.warn(e);
    }
    onUpdate(filtered);
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
 * Danh sách mẫu các bệnh nhân vệ tinh chờ bổ sung thông tin (chưa xếp buồng phòng hoặc thiếu tuổi)
 */
export const INITIAL_SAMPLE_PENDING_SATELLITE_RECORDS: ClinicalRecord[] = [
  {
    id: 'SAT-PENDING-001',
    patientName: 'Nguyễn Văn Hưng',
    patientAge: '62',
    patientGender: 'Nam',
    patientRoom: 'Chưa xếp phòng',
    admissionDate: new Date().toISOString(),
    vitalSigns: 'HA: 135/85 mmHg, Mạch: 82 l/p, SpO2: 96%, T: 37.2°C',
    diagnosis: 'Đợt cấp Bệnh phổi tắc nghẽn mạn tính (COPD) / Tăng huyết áp',
    treatmentPlan: 'Kế hoạch: Khí dung Salbutamol + Pulmicort, Ceftriaxone 2g/ngày, kiểm soát huyết áp.',
    clinicalCourse: 'Bệnh nhân khó thở tăng dần 2 ngày nay, ho khạc đờm vàng đục, ran rít ngáy 2 phế trường.',
    medicalHistory: 'COPD 5 năm, Tăng huyết áp 7 năm',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'SAT-PENDING-002',
    patientName: 'Trần Thị Mai',
    patientAge: '58',
    patientGender: 'Nữ',
    patientRoom: '',
    admissionDate: new Date().toISOString(),
    vitalSigns: 'HA: 150/90 mmHg, Mạch: 90 l/p, SpO2: 98%, T: 36.8°C',
    diagnosis: 'Cơn đau thắt ngực không ổn định / Đái tháo đường type 2',
    treatmentPlan: 'Kế hoạch: Kháng ngưng tập tiểu cầu kép, Atorvastatin 40mg, siêu âm tim, theo dõi Troponin T.',
    clinicalCourse: 'Đau thắt sau xương ức khi gắng sức lan vai trái, kéo dài 15 phút.',
    medicalHistory: 'ĐTĐ type 2 điều trị Metformin, THA 4 năm',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'SAT-PENDING-003',
    patientName: 'Lê Văn Tuấn',
    patientAge: '',
    patientGender: 'Nam',
    patientRoom: 'Chưa xếp phòng',
    admissionDate: new Date().toISOString(),
    vitalSigns: 'HA: 115/75 mmHg, Mạch: 80 l/p, SpO2: 99%, T: 37.0°C',
    diagnosis: 'Viêm dạ dày ruột cấp / Rối loạn tiêu hóa',
    treatmentPlan: 'Kế hoạch: Bù nước điện giải Oresol, giảm đau chống co thắt No-spa, men vi sinh.',
    clinicalCourse: 'Đau quặn bụng quanh rốn kèm đi ngoài phân lỏng nhiều lần trong ngày, không sốt.',
    medicalHistory: 'Chưa ghi nhận bệnh lý mạn tính',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  }
];

/**
 * Đọc danh sách bệnh nhân vệ tinh chờ bổ sung thông tin từ LocalStorage
 */
export function loadPendingSatelliteRecords(): ClinicalRecord[] {
  try {
    const deletedIds: string[] = JSON.parse(localStorage.getItem('DELETED_SATELLITE_IDS') || '[]');
    const processedIds: string[] = JSON.parse(localStorage.getItem('PROCESSED_SATELLITE_IDS') || '[]');
    const saved = localStorage.getItem('PENDING_SATELLITE_RECORDS');
    if (saved) {
      const parsed: ClinicalRecord[] = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.filter(r => !deletedIds.includes(r.id) && !processedIds.includes(r.id));
      }
    } else {
      // Khởi tạo lần đầu tiên với dữ liệu mẫu chờ bổ sung
      const filtered = INITIAL_SAMPLE_PENDING_SATELLITE_RECORDS.filter(
        r => !deletedIds.includes(r.id) && !processedIds.includes(r.id)
      );
      localStorage.setItem('PENDING_SATELLITE_RECORDS', JSON.stringify(filtered));
      return filtered;
    }
  } catch (e) {
    console.warn('Lỗi đọc PENDING_SATELLITE_RECORDS:', e);
  }
  return [];
}

/**
 * Lưu danh sách bệnh nhân vệ tinh chờ bổ sung thông tin vào LocalStorage
 */
export function savePendingSatelliteRecords(records: ClinicalRecord[]): void {
  try {
    localStorage.setItem('PENDING_SATELLITE_RECORDS', JSON.stringify(records));
  } catch (e) {
    console.warn('Lỗi ghi PENDING_SATELLITE_RECORDS:', e);
  }
}

/**
 * Đánh dấu đã tiếp nhận hoặc bỏ qua một bệnh nhân vệ tinh khỏi danh sách Chờ Bổ Sung
 */
export function dismissPendingSatelliteRecord(recordId: string): ClinicalRecord[] {
  try {
    const current = loadPendingSatelliteRecords();
    const updated = current.filter(r => r.id !== recordId);
    savePendingSatelliteRecords(updated);

    const processedIds: string[] = JSON.parse(localStorage.getItem('PROCESSED_SATELLITE_IDS') || '[]');
    if (!processedIds.includes(recordId)) {
      processedIds.push(recordId);
      localStorage.setItem('PROCESSED_SATELLITE_IDS', JSON.stringify(processedIds));
    }
    return updated;
  } catch (e) {
    console.warn(e);
    return [];
  }
}

/**
 * Xóa vĩnh viễn bản ghi vệ tinh khỏi Chờ Bổ Sung và lưu vào DELETED_SATELLITE_IDS
 */
export function deletePendingSatelliteRecord(recordId: string): ClinicalRecord[] {
  try {
    const deletedIds: string[] = JSON.parse(localStorage.getItem('DELETED_SATELLITE_IDS') || '[]');
    if (!deletedIds.includes(recordId)) {
      deletedIds.push(recordId);
      localStorage.setItem('DELETED_SATELLITE_IDS', JSON.stringify(deletedIds));
    }
    return dismissPendingSatelliteRecord(recordId);
  } catch (e) {
    console.warn(e);
    return [];
  }
}

/**
 * Làm sạch và trích xuất riêng phần Kế hoạch điều trị từ dữ liệu bệnh án vệ tinh.
 * Loại bỏ danh sách thuốc ("Điều trị: ...") và chỉ giữ lại nội dung sau "Kế hoạch:" (ví dụ: "Bù dịch - hạ sốt - đeo holter ECG khi đỡ sốt").
 */
export function cleanSatelliteTreatmentPlan(rawPlan?: string): string {
  if (!rawPlan) return '';
  let str = rawPlan.trim();

  // 1. Nếu có từ khóa "Kế hoạch:" hoặc "Kế hoạch :-" hoặc "Kế hoạch" (không phân biệt hoa thường)
  const planMatch = str.match(/kế\s*hoạch\s*[:\-–—]\s*([\s\S]+)/i);
  if (planMatch && planMatch[1]?.trim()) {
    return planMatch[1].trim();
  }

  // 2. Tìm biểu tượng phân cách "• Kế hoạch:" hoặc "- Kế hoạch:"
  const bulletPlanMatch = str.match(/(?:[•\-\*\n]|\b)kế\s*hoạch\b[:\s\-–—]*([\s\S]+)/i);
  if (bulletPlanMatch && bulletPlanMatch[1]?.trim()) {
    return bulletPlanMatch[1].trim();
  }

  // 3. Nếu chuỗi bắt đầu bằng "Điều trị:" nhưng có ký tự "•" chia đoạn
  if (/^điều\s*trị\s*:/i.test(str) && str.includes('•')) {
    const parts = str.split('•');
    const lastPart = parts[parts.length - 1].trim();
    if (lastPart && !/^điều\s*trị/i.test(lastPart)) {
      return lastPart.replace(/^kế\s*hoạch\s*[:\-–—]\s*/i, '').trim();
    }
  }

  // 4. Nếu toàn bộ chuỗi bắt đầu bằng "Điều trị:", loại bỏ prefix "Điều trị:"
  if (/^điều\s*trị\s*:/i.test(str)) {
    return str.replace(/^điều\s*trị\s*:\s*/i, '').trim();
  }

  return str;
}

/**
 * Chuyển đổi an toàn từ 1 bản ghi vệ tinh chuẩn Schema sang đối tượng Patient bệnh viện
 */

/**
 * Trích xuất đầy đủ Diễn tiến lâm sàng và Thăm khám từ bệnh án vệ tinh.
 * Bao gồm: Thăm khám lâm sàng (toàn thân, các cơ quan, triệu chứng) và diễn tiến bệnh.
 */
export function extractFullClinicalCourse(record: ClinicalRecord): string {
  const parts: string[] = [];
  const anyRec = record as any;

  // 1. Thu thập thông tin Thăm khám lâm sàng (Physical Examination)
  const examItems: string[] = [];

  const directExam = (anyRec.physicalExam || anyRec.examination || anyRec.kham || anyRec.khamLamSang || anyRec.thamKham || anyRec.examNote || '').trim();
  if (directExam) {
    examItems.push(directExam);
  }

  if (anyRec.khamToanThan && typeof anyRec.khamToanThan === 'string' && anyRec.khamToanThan.trim()) {
    examItems.push(`- Toàn thân: ${anyRec.khamToanThan.trim()}`);
  }
  if (anyRec.khamCacCoQuan && typeof anyRec.khamCacCoQuan === 'string' && anyRec.khamCacCoQuan.trim()) {
    examItems.push(`- Các cơ quan: ${anyRec.khamCacCoQuan.trim()}`);
  }

  // Đọc từ clinicalDataJson nếu có
  if (record.clinicalDataJson) {
    try {
      const parsed = typeof record.clinicalDataJson === 'string'
        ? JSON.parse(record.clinicalDataJson)
        : record.clinicalDataJson;

      if (parsed && typeof parsed === 'object') {
        const jsonExam = (parsed.physicalExam || parsed.examination || parsed.khamLamSang || parsed.thamKham || parsed.examNote || parsed.kham || '').trim();
        if (jsonExam && !examItems.some(i => i.includes(jsonExam))) {
          examItems.push(jsonExam);
        }
        if (parsed.toanThan && !examItems.some(i => i.includes(parsed.toanThan))) {
          examItems.push(`- Toàn thân: ${String(parsed.toanThan).trim()}`);
        }
        if (parsed.cacCoQuan && !examItems.some(i => i.includes(parsed.cacCoQuan))) {
          examItems.push(`- Các cơ quan: ${String(parsed.cacCoQuan).trim()}`);
        }
        if (parsed.trieuChung && !examItems.some(i => i.includes(parsed.trieuChung))) {
          examItems.push(`- Triệu chứng: ${String(parsed.trieuChung).trim()}`);
        }

        // Diễn tiến từ JSON nếu có
        const jsonCourse = (parsed.clinicalCourse || parsed.dienTien || parsed.clinicalNote || '').trim();
        if (jsonCourse && !parts.includes(jsonCourse)) {
          parts.push(jsonCourse);
        }
      }
    } catch {
      // ignore JSON parse error
    }
  }

  // 2. Diễn tiến lâm sàng chính
  const mainCourse = (record.clinicalCourse || record.clinicalNote || anyRec.dienTien || anyRec.dienTienLamSang || '').trim();

  // Ghép Thăm khám vào đầu
  if (examItems.length > 0) {
    const examCombined = examItems.join('\n');
    parts.unshift(`【Thăm Khám Lâm Sàng】:\n${examCombined}`);
  }

  // Ghép Diễn tiến lâm sàng
  if (mainCourse && !parts.some(p => p.includes(mainCourse))) {
    if (examItems.length > 0) {
      parts.push(`【Diễn Tiến Lâm Sàng】:\n${mainCourse}`);
    } else {
      parts.push(mainCourse);
    }
  }

  return parts.join('\n\n').trim();
}
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
  // Bác sĩ phụ trách: Bác sĩ điều trị là bác sĩ có sẵn ở buồng phòng đó
  let attendingDoctorId = '';
  if (matchedRoom && (matchedRoom as any).assignedDoctorId) {
    attendingDoctorId = (matchedRoom as any).assignedDoctorId;
  } else if (DEFAULT_ROOM_DOCTORS[roomNumber]) {
    attendingDoctorId = DEFAULT_ROOM_DOCTORS[roomNumber];
  } else if (defaultDoctorId) {
    attendingDoctorId = defaultDoctorId;
  }
  const doctor = doctors.find(d => d.id === attendingDoctorId) || doctors.find(d => d.id === defaultDoctorId);

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
  const primaryDiagnosis = (record.diagnosis || '').trim();
  const rawTreatmentPlan = (record.treatmentPlan || '').trim();
  const treatmentPlan = cleanSatelliteTreatmentPlan(rawTreatmentPlan);

  // Cận lâm sàng nổi bật (HTML & Plain text)
  const clsHtml = record.clsHtml || record.labsHtml || '';
  const initialLabsText = stripHtmlTags(clsHtml);

    // Khám lâm sàng & Diễn tiến đầy đủ
  const clinicalCourseText = extractFullClinicalCourse(record);

  // Kết hợp Khám lâm sàng và Sinh hiệu vào Nhật Ký Diễn Tiến Lâm Sàng & Sinh Hiệu
  const fullEvoNoteParts: string[] = [];
  
  if (clinicalCourseText) {
    fullEvoNoteParts.push(clinicalCourseText);
  } else {
    fullEvoNoteParts.push('Khám lâm sàng: Bệnh nhân tiếp nhận vào khoa điều trị nội trú, tỉnh táo, tiếp xúc tốt.');
  }

  if (vitalsText) {
    fullEvoNoteParts.push(`[Sinh hiệu: ${vitalsText}]`);
  } else {
    fullEvoNoteParts.push(`[Sinh hiệu: Mạch ${parsedVitals.heartRate} l/p • HA ${parsedVitals.bpSystolic}/${parsedVitals.bpDiastolic} mmHg • SpO2 ${parsedVitals.spO2}% • T° ${parsedVitals.temperature}°C]`);
  }

  const combinedEvoNote = fullEvoNoteParts.join('\n\n');

  const evolutionsList: ClinicalEvolution[] = [{
    id: `EV-SAT-${Date.now()}`,
    timestamp: record.admissionDate || record.createdAt || defaultDateStr,
    doctorName: doctor?.name || 'BS Điều trị',
    shift: 'Sáng',
    clinicalNote: combinedEvoNote,
    treatmentAction: treatmentPlan || '',
    orders: initialLabsText ? `CLS: ${initialLabsText.slice(0, 120)}...` : undefined,
  }];

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
    allergies: isRealAllergy(record.allergies) ? record.allergies : undefined,
    severity,
    admissionStatus: 'ADMITTED_TODAY',
    tags: parsedVitals.spO2 < 95 ? ['O2_CANULA'] : [],
    treatmentPlan: treatmentPlan || undefined,
    importantNotes: '',
    initialLabsText: initialLabsText || undefined,
    vitals: vitalsList,
    evolutions: evolutionsList,
    labs: [],
    medications: [],
    status: 'ACTIVE',
  };

  return newPatient;
}

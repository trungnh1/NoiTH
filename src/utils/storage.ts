import { Doctor, DepartmentRoom, Patient, AdmissionDischargeStatus } from '../types/patient';
import { INITIAL_DOCTORS, INITIAL_ROOMS } from '../data/mockData';

const PATIENTS_KEY = 'hvg_internal_med_patients_v4';
const DOCTORS_KEY = 'hvg_internal_med_doctors_v6';
const ROOMS_KEY = 'hvg_internal_med_rooms_v4';


/**
 * Định dạng tên bệnh nhân hiển thị: Chuyển tên viết hoa toàn bộ (ALL CAPS)
 * thành chữ thường viết hoa chữ cái đầu tự nhiên (Title Case), ví dụ 'NGUYỄN VĂN AN' -> 'Nguyễn Văn An'.
 */
export function formatPatientDisplayName(fullName: string): string {
  if (!fullName) return '';
  const trimmed = fullName.trim();
  if (trimmed === trimmed.toUpperCase() && trimmed.length > 1) {
    return trimmed
      .toLowerCase()
      .split(' ')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  return trimmed;
}
export function shortenPatientName(fullName: string): string {
  if (!fullName) return '';
  return fullName
    .replace(/Thị/gu, 'T.')
    .replace(/Văn/gu, 'V.')
    .replace(/Nguyễn/gu, 'Ng.');
}

export function loadPatients(): Patient[] {
  try {
    // Clear legacy mock data keys if existing
    localStorage.removeItem('hvg_internal_med_patients_v3');
    localStorage.removeItem('hvg_internal_med_patients_v2');
    localStorage.removeItem('hvg_internal_med_patients');

    const saved = localStorage.getItem(PATIENTS_KEY);
    let list: Patient[] = [];
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          list = parsed;
        }
      } catch (e) {
        console.error("Error parsing saved patients", e);
      }
    }

    // Ensure all required fields exist for every patient
    return list.map((p) => {
      const pCode = p.patientCode || (p.medicalRecordNumber ? p.medicalRecordNumber.replace('HS-', 'BN-') : `BN-${p.id}`);
      const dept = p.department || 'Khoa Nội Tổng Hợp';
      const notes = p.importantNotes || (
        p.tags.includes('VASOPRESSOR')
          ? 'Đang duy trì vận mạch, cần theo dõi huyết áp liên tục.'
          : p.tags.includes('O2')
          ? 'Đang hỗ trợ thở oxy, kiểm tra SpO2 định kỳ.'
          : p.tags.includes('CLOSE_MONITORING')
          ? 'Bệnh diễn biến phức tạp, cần theo dõi sát sinh hiệu.'
          : 'Tình trạng hiện tại ổn định, tiếp tục theo dõi thường quy.'
      );

      const enrichedMeds = (p.medications || []).map((m) => ({
        ...m,
        endDate: m.endDate || (m.status === 'active' ? 'Đang duy trì' : 'Đã ngưng'),
      }));

      const enrichedLabs = (p.labs || []).map((l) => ({
        ...l,
        testDate: l.testDate || l.timestamp,
      }));

      let admStatus: AdmissionDischargeStatus = p.admissionStatus || 'STABLE_INPATIENT';
      let dsSetDate = p.dischargeTomorrowSetDate;
      const todayStr = new Date().toISOString().split('T')[0];

      if (admStatus === 'DISCHARGE_TOMORROW') {
        if (!dsSetDate || dsSetDate !== todayStr) {
          admStatus = 'DISCHARGE_TODAY';
          dsSetDate = undefined;
        }
      }

      // Filter out auto-generated doctor assignment timeline items so clinical timeline stays strictly medical
      const cleanedEvolutions = (p.evolutions || []).filter(
        (e) =>
          !e.clinicalNote?.startsWith('Phân công Bác sĩ điều trị buồng:') &&
          !e.clinicalNote?.startsWith('Chuyển phân công Bác sĩ điều trị chính sang:')
      );

      return {
        ...p,
        roomNumber: p.roomNumber === '704' ? '707' : p.roomNumber,
        fullName: shortenPatientName(p.fullName),
        patientCode: pCode,
        department: dept,
        importantNotes: notes,
        admissionStatus: admStatus,
        dischargeTomorrowSetDate: dsSetDate,
        evolutions: cleanedEvolutions,
        medications: enrichedMeds,
        labs: enrichedLabs,
      };
    });
  } catch (e) {
    console.error('Error loading patients from storage:', e);
  }
  return [];
}

export function savePatients(patients: Patient[]): void {
  try {
    localStorage.setItem(PATIENTS_KEY, JSON.stringify(patients));
  } catch (e) {
    console.error('Error saving patients to storage:', e);
  }
}

import { sortDoctorsAlphabetically } from './doctorSorter';

export function loadDoctors(): Doctor[] {
  try {
    // Clean legacy keys
    localStorage.removeItem('hvg_internal_med_doctors_v5');
    localStorage.removeItem('hvg_internal_med_doctors_v4');

    const saved = localStorage.getItem(DOCTORS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length >= 5) {
        const filtered = parsed
          .filter((d: any) => d.id !== '00101' && d.id !== '00199' && !/tuế|quyên/i.test(d.name || ''))
          .map((d: any) => {
            const { phone, ...cleanDoctor } = d;
            return cleanDoctor as Doctor;
          });
        if (filtered.length >= 10) {
          return sortDoctorsAlphabetically(filtered);
        }
      }
    }
  } catch (e) {
    console.error('Error loading doctors from storage:', e);
  }
  return sortDoctorsAlphabetically(INITIAL_DOCTORS);
}

export function saveDoctors(doctors: Doctor[]): void {
  try {
    const cleaned = doctors.map((d: any) => {
      const { phone, ...cleanDoctor } = d;
      return cleanDoctor;
    });
    localStorage.setItem(DOCTORS_KEY, JSON.stringify(cleaned));
  } catch (e) {
    console.error('Error saving doctors to storage:', e);
  }
}

export function loadRooms(): DepartmentRoom[] {
  try {
    const saved = localStorage.getItem(ROOMS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length >= 20) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading rooms from storage:', e);
  }
  return INITIAL_ROOMS;
}

export function resetAllData(): { patients: Patient[]; doctors: Doctor[]; rooms: DepartmentRoom[] } {
  localStorage.removeItem(PATIENTS_KEY);
  localStorage.removeItem('hvg_internal_med_patients_v3');
  localStorage.removeItem('hvg_internal_med_patients_v2');
  localStorage.removeItem('hvg_internal_med_patients');
  localStorage.removeItem(DOCTORS_KEY);
  localStorage.removeItem('hvg_internal_med_doctors_v4');
  localStorage.removeItem(ROOMS_KEY);
  return {
    patients: [],
    doctors: INITIAL_DOCTORS,
    rooms: INITIAL_ROOMS,
  };
}

export function clearAllPatients(): void {
  localStorage.removeItem(PATIENTS_KEY);
  localStorage.removeItem('hvg_internal_med_patients_v3');
  localStorage.removeItem('hvg_internal_med_patients_v2');
  localStorage.removeItem('hvg_internal_med_patients');
}


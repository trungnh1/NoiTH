import { Patient, Doctor } from '../types/patient';

/**
 * Normalizes a string for fast, accent-insensitive and case-insensitive comparison.
 * Removes Vietnamese diacritics, converts 'đ/Đ' to 'd', lowercases, and trims.
 */
export function normalizeSearchText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/**
 * Extracts a target room number from a query if the user is typing a room reference.
 * Examples:
 * - "735" -> "735"
 * - "phòng 735", "phong 735" -> "735"
 * - "P735", "P.735", "p 735" -> "735"
 * - "buồng 735", "buong 735" -> "735"
 * - "b735", "B.735" -> "735"
 * - "735-1", "735.2" -> "735"
 */
export function extractSearchRoomNumber(searchTerm: string): string | null {
  if (!searchTerm) return null;
  const clean = searchTerm.trim();

  // Exact 2-4 digit string: "735", "705", "747"
  if (/^\d{2,4}$/.test(clean)) {
    return clean;
  }

  // Common room prefixes in Vietnamese: "phòng 735", "phong 735", "p735", "p.735", "buong 735", "b735"
  const prefixMatch = clean.match(/^(?:phòng|phong|p\.?|buồng|buong|b\.?)\s*(\d{2,4})$/i);
  if (prefixMatch) {
    return prefixMatch[1];
  }

  // Bed formatted as Room-Bed: "735-1", "735/2", "735.1"
  const roomBedMatch = clean.match(/^(\d{2,4})[\-\/\.](?:\d+|[a-zA-Z]+)$/);
  if (roomBedMatch) {
    return roomBedMatch[1];
  }

  // Any isolated 3-digit room number in the search string (e.g. "xem phòng 735")
  const isolatedMatch = clean.match(/\b\d{3}\b/);
  if (isolatedMatch) {
    return isolatedMatch[0];
  }

  return null;
}

/**
 * Checks whether a room number matches a given search query.
 * Matches:
 * - Direct room number match (e.g. "735" matches "735", "P735", "Phòng 735")
 * - Extracted room number match
 * - Partial room number match
 * - Room text match ("phong 735", "p.735")
 */
export function isRoomNumberMatch(roomNumber: string, searchTerm: string): boolean {
  if (!searchTerm.trim()) return true;

  const cleanRoom = roomNumber.replace(/^(phòng|p\.?|buồng|b\.?)\s*/i, '').trim();
  const extractedRoom = extractSearchRoomNumber(searchTerm);

  // If search term directly specifies a room number
  if (extractedRoom) {
    if (cleanRoom === extractedRoom) return true;
    if (cleanRoom.toLowerCase().includes(extractedRoom.toLowerCase())) return true;
  }

  const normQuery = normalizeSearchText(searchTerm);
  const normRoom = normalizeSearchText(roomNumber);
  const normCleanRoom = normalizeSearchText(cleanRoom);

  if (normCleanRoom === normQuery) return true;
  if (normCleanRoom.startsWith(normQuery)) return true;
  if (normRoom.includes(normQuery)) return true;
  if (`phong ${normCleanRoom}`.includes(normQuery)) return true;
  if (`p${normCleanRoom}`.includes(normQuery)) return true;
  if (`p.${normCleanRoom}`.includes(normQuery)) return true;

  return false;
}

/**
 * Checks if a patient matches the search query across:
 * - Room number & Bed number
 * - Full name (accent-insensitive)
 * - Patient code / Mã BN / Medical record number
 * - Diagnoses (primary, secondary, icd10)
 * - Attending Doctor name & code
 * - Treatment plan & Notes
 */
export function matchesPatientSearch(
  patient: Patient,
  searchTerm: string,
  doctorMap?: Map<string, Doctor>
): boolean {
  if (!searchTerm.trim()) return true;

  const rawQuery = searchTerm.trim();
  const normQuery = normalizeSearchText(rawQuery);
  const targetRoom = extractSearchRoomNumber(rawQuery);

  // 1. Room number matching
  const cleanPatientRoom = (patient.roomNumber || '').replace(/^(phòng|p\.?|buồng|b\.?)\s*/i, '').trim();
  if (targetRoom) {
    if (cleanPatientRoom === targetRoom || cleanPatientRoom.includes(targetRoom)) {
      return true;
    }
  }

  if (isRoomNumberMatch(patient.roomNumber || '', rawQuery)) {
    return true;
  }

  // 2. Bed number matching (e.g. "G1", "giuong 1", "01")
  const bedNum = (patient.bedNumber || '').toLowerCase().trim();
  if (bedNum) {
    if (bedNum.includes(normQuery)) return true;
    const cleanBed = bedNum.replace(/^(giường|giuong|g\.?|b\.?)\s*/i, '').trim();
    if (cleanBed && normQuery === cleanBed) return true;
  }

  // 3. Full name (accent-insensitive)
  if (normalizeSearchText(patient.fullName).includes(normQuery)) {
    return true;
  }

  // 4. Patient Code / Mã BN / Medical Record Number
  const pCode = (patient.patientCode || '').toLowerCase();
  const mrn = (patient.medicalRecordNumber || '').toLowerCase();
  const mabn = ((patient as unknown as { mabn?: string }).mabn || '').toLowerCase();
  const pId = (patient.id || '').toLowerCase();

  if (pCode.includes(normQuery) || mrn.includes(normQuery) || mabn.includes(normQuery) || pId.includes(normQuery)) {
    return true;
  }

  // 5. Diagnoses & ICD codes
  const primaryDiag = normalizeSearchText(patient.primaryDiagnosis);
  const secondaryDiag = normalizeSearchText(patient.secondaryDiagnosis);
  const icd1 = (patient.icd10Primary || '').toLowerCase();
  const icd2 = (patient.icd10Secondary || '').toLowerCase();

  if (primaryDiag.includes(normQuery) || secondaryDiag.includes(normQuery) || icd1.includes(normQuery) || icd2.includes(normQuery)) {
    return true;
  }

  // 6. Doctor Name
  const doc = doctorMap?.get(patient.attendingDoctorId);
  if (doc) {
    const docFullName = normalizeSearchText(doc.name);
    if (docFullName.includes(normQuery)) return true;
    if (`bs ${docFullName}`.includes(normQuery)) return true;
    if (`bac si ${docFullName}`.includes(normQuery)) return true;
  }

  // 7. Clinical notes / Treatment plan
  const plan = normalizeSearchText(patient.treatmentPlan);
  const notes = normalizeSearchText(patient.importantNotes || patient.handoverNotes);
  const evoAction = normalizeSearchText(patient.evolutions?.[0]?.treatmentAction);

  if (plan.includes(normQuery) || notes.includes(normQuery) || evoAction.includes(normQuery)) {
    return true;
  }

  return false;
}

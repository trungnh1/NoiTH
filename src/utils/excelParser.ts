import * as XLSX from 'xlsx';
import { ClinicalRecord, parseAgeNumber } from '../services/clinicalFirebase';

export interface ExcelPatientRow {
  id?: string;
  patientName: string;
  patientAge: string | number;
  patientGender: string;
  patientRoom: string;
  bedNumber?: string;
  admissionDate?: string;
  diagnosis?: string;
  vitalSigns?: string;
  medicalHistory?: string;
  treatmentPlan?: string;
  rawRow: Record<string, any>;
}

export interface MatchedSatelliteRecord {
  satelliteRecord: ClinicalRecord;
  matchedExcelRow: ExcelPatientRow;
  matchedField: string; // e.g., 'Tên bệnh nhân'
  missingFields: string[];
  proposedRoom: string;
  proposedAge: number;
}

/**
 * Remove Vietnamese accents and trim string for fuzzy matching
 */
export function normalizeVietnameseString(str?: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses binary/arraybuffer Excel/CSV file content into structured ExcelPatientRow list
 */
export function parseExcelFile(fileBuffer: ArrayBuffer | Uint8Array): ExcelPatientRow[] {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  const result: ExcelPatientRow[] = [];

  jsonRows.forEach((row) => {
    // Find matching key case-insensitively
    let nameVal = '';
    let ageVal: any = '';
    let genderVal = '';
    let roomVal = '';
    let bedVal = '';
    let dateVal = '';
    let diagVal = '';
    let vitalsVal = '';
    let historyVal = '';
    let planVal = '';

    Object.entries(row).forEach(([rawKey, val]) => {
      const key = normalizeVietnameseString(rawKey);
      const strVal = String(val).trim();

      if (key.includes('ho ten') || key.includes('ten benh nhan') || key === 'ten' || key.includes('full name') || key.includes('benh nhan')) {
        if (strVal) nameVal = strVal;
      } else if (key.includes('tuoi') || key.includes('age')) {
        if (strVal) ageVal = strVal;
      } else if (key.includes('gioi tinh') || key.includes('gioi') || key.includes('gender') || key.includes('nam/nu')) {
        if (strVal) genderVal = strVal;
      } else if (key.includes('phong') || key.includes('buong') || key.includes('room')) {
        if (strVal) roomVal = strVal;
      } else if (key.includes('giuong') || key.includes('bed')) {
        if (strVal) bedVal = strVal;
      } else if (key.includes('ngay') || key.includes('nhap vien') || key.includes('date')) {
        if (strVal) dateVal = strVal;
      } else if (key.includes('chan doan') || key.includes('diagnosis')) {
        if (strVal) diagVal = strVal;
      } else if (key.includes('sinh hieu') || key.includes('mach') || key.includes('ha') || key.includes('vitals')) {
        if (strVal) vitalsVal = strVal;
      } else if (key.includes('tien su') || key.includes('history')) {
        if (strVal) historyVal = strVal;
      } else if (key.includes('huong xu tri') || key.includes('ke hoach') || key.includes('plan')) {
        if (strVal) planVal = strVal;
      }
    });

    if (nameVal || roomVal) {
      result.push({
        patientName: nameVal || 'Bệnh Nhân Excel',
        patientAge: ageVal || 60,
        patientGender: genderVal || 'Nam',
        patientRoom: roomVal || '703',
        bedNumber: bedVal || 'Giường 01',
        admissionDate: dateVal,
        diagnosis: diagVal,
        vitalSigns: vitalsVal,
        medicalHistory: historyVal,
        treatmentPlan: planVal,
        rawRow: row,
      });
    }
  });

  return result;
}

/**
 * Match Excel rows with incomplete satellite records
 */
export function matchExcelWithSatelliteRecords(
  excelRows: ExcelPatientRow[],
  satelliteRecords: ClinicalRecord[]
): MatchedSatelliteRecord[] {
  const matches: MatchedSatelliteRecord[] = [];

  satelliteRecords.forEach((satRec) => {
    const satNameNorm = normalizeVietnameseString(satRec.patientName || satRec.fullName || '');
    const satRoomNorm = normalizeVietnameseString(satRec.patientRoom || satRec.roomNumber || '');
    const satAge = parseAgeNumber(satRec.patientAge || satRec.age);

    let bestMatch: ExcelPatientRow | null = null;
    let matchedField = '';

    for (const excelRow of excelRows) {
      const excelNameNorm = normalizeVietnameseString(excelRow.patientName);
      const excelRoomNorm = normalizeVietnameseString(excelRow.patientRoom);

      // 1. Exact or fuzzy name match
      if (satNameNorm && excelNameNorm && (satNameNorm === excelNameNorm || satNameNorm.includes(excelNameNorm) || excelNameNorm.includes(satNameNorm))) {
        bestMatch = excelRow;
        matchedField = 'Tên bệnh nhân';
        break;
      }

      // 2. Room match if name is missing or satellite name matches
      if (satRoomNorm && excelRoomNorm && satRoomNorm === excelRoomNorm) {
        bestMatch = excelRow;
        matchedField = 'Số buồng/phòng';
        break;
      }
    }

    if (bestMatch) {
      const missingFields: string[] = [];
      if (!satNameNorm) missingFields.push('Họ tên');
      if (!satAge) missingFields.push('Tuổi');
      if (!satRoomNorm || satRoomNorm === 'chua xep phong') missingFields.push('Số buồng/phòng');

      const proposedRoom = String(bestMatch.patientRoom || satRec.patientRoom || satRec.roomNumber || '703').replace(/^(phòng|p\.?|buồng)\s*/i, '').trim();
      const proposedAge = parseAgeNumber(bestMatch.patientAge) || satAge || 60;

      matches.push({
        satelliteRecord: satRec,
        matchedExcelRow: bestMatch,
        matchedField,
        missingFields,
        proposedRoom,
        proposedAge,
      });
    }
  });

  return matches;
}

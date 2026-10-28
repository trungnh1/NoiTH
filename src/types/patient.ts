export type SeverityLevel = 'CRITICAL' | 'MODERATE' | 'STABLE' | 'UNCLASSIFIED';

export type AdmissionDischargeStatus = 
  | 'ADMITTED_TODAY' // Mới nhập hôm nay
  | 'ADMITTED_YESTERDAY' // Mới nhập tua trực hôm qua
  | 'DISCHARGE_TODAY' // Chuẩn bị ra viện hôm nay
  | 'DISCHARGE_TOMORROW' // Dự kiến ra viện ngày mai
  | 'STABLE_INPATIENT'; // Đang điều trị

export const ADMISSION_STATUS_META: Record<AdmissionDischargeStatus, {
  label: string;
  badgeBg: string;
  badgeBorder: string;
  textColor: string;
  shortLabel: string;
  badgeClass: string;
}> = {
  ADMITTED_TODAY: {
    label: 'Mới',
    shortLabel: 'Mới',
    badgeBg: 'bg-emerald-600',
    badgeBorder: 'border-emerald-600',
    textColor: 'text-white',
    badgeClass: 'bg-emerald-600 text-white border-emerald-700',
  },
  ADMITTED_YESTERDAY: {
    label: 'Mới',
    shortLabel: 'Mới',
    badgeBg: 'bg-amber-500',
    badgeBorder: 'border-amber-600',
    textColor: 'text-white',
    badgeClass: 'bg-amber-500 text-white border-amber-600',
  },
  DISCHARGE_TODAY: {
    label: 'RV hôm nay',
    shortLabel: 'RV hôm nay',
    badgeBg: 'bg-purple-600',
    badgeBorder: 'border-purple-700',
    textColor: 'text-white',
    badgeClass: 'bg-purple-600 text-white border-purple-700',
  },
  DISCHARGE_TOMORROW: {
    label: 'Dự kiến RV mai',
    shortLabel: 'Dự kiến RV mai',
    badgeBg: 'bg-blue-600',
    badgeBorder: 'border-blue-700',
    textColor: 'text-white',
    badgeClass: 'bg-blue-600 text-white border-blue-700',
  },
  STABLE_INPATIENT: {
    label: 'Đang điều trị',
    shortLabel: 'Đang điều trị',
    badgeBg: 'bg-slate-500',
    badgeBorder: 'border-slate-600',
    textColor: 'text-white',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
  },
};

export type ClinicalTag =
  | 'O2_CANULA' // Thở Canula
  | 'O2_MASK' // Thở Mask
  | 'O2' // Thở Oxy chung (backwards-compatible)
  | 'VASOPRESSOR' // Dùng vận mạch
  | 'CLOSE_MONITORING' // Cần theo dõi sát
  | 'FASTING' // Nhịn ăn
  | 'FALL_RISK' // Nguy cơ té ngã
  | 'ALLERGY' // Dị ứng thuốc
  | 'NG_TUBE' // Sonde dạ dày
  | 'FOLEY' // Sonde tiểu
  | 'FLUID_BALANCE' // TD dịch nhập/xuất
  | 'ISOLATION'; // Cách ly

export interface TagMeta {
  id: ClinicalTag;
  label: string;
  shortLabel: string;
  color: string;
  badgeBg: string;
  textColor: string;
  iconName: string;
  description: string;
}

export const CLINICAL_TAGS_META: Record<ClinicalTag, TagMeta> = {
  O2_CANULA: {
    id: 'O2_CANULA',
    label: 'Thở Canula',
    shortLabel: 'Canula',
    color: 'border-cyan-500 text-cyan-700 bg-cyan-50',
    badgeBg: 'bg-cyan-600',
    textColor: 'text-white',
    iconName: 'Wind',
    description: 'Bệnh nhân đang hỗ trợ oxy qua gọng kính (Canula)',
  },
  O2_MASK: {
    id: 'O2_MASK',
    label: 'Thở Mask',
    shortLabel: 'Mask',
    color: 'border-blue-500 text-blue-700 bg-blue-50',
    badgeBg: 'bg-blue-600',
    textColor: 'text-white',
    iconName: 'Wind',
    description: 'Bệnh nhân đang hỗ trợ oxy qua mặt nạ (Mask)',
  },
  O2: {
    id: 'O2',
    label: 'Thở Oxy',
    shortLabel: 'O₂',
    color: 'border-cyan-500 text-cyan-700 bg-cyan-50',
    badgeBg: 'bg-cyan-600',
    textColor: 'text-white',
    iconName: 'Wind',
    description: 'Bệnh nhân đang hỗ trợ oxy kính/mask',
  },
  VASOPRESSOR: {
    id: 'VASOPRESSOR',
    label: 'Dùng vận mạch',
    shortLabel: 'Vận mạch',
    color: 'border-rose-500 text-rose-700 bg-rose-50',
    badgeBg: 'bg-rose-600',
    textColor: 'text-white',
    iconName: 'HeartPulse',
    description: 'Đang duy trì Noradrenalin, Dopamin, Dobutamin hoặc Adrenalin',
  },
  CLOSE_MONITORING: {
    id: 'CLOSE_MONITORING',
    label: 'Theo dõi sát',
    shortLabel: 'Theo dõi sát',
    color: 'border-amber-500 text-amber-800 bg-amber-50',
    badgeBg: 'bg-amber-600',
    textColor: 'text-white',
    iconName: 'Eye',
    description: 'Diễn biến nguy cơ trở nặng, cần đo sinh hiệu & theo dõi mỗi 1-2h',
  },
  FASTING: {
    id: 'FASTING',
    label: 'Nhịn ăn uống',
    shortLabel: 'Nhịn ăn',
    color: 'border-purple-500 text-purple-700 bg-purple-50',
    badgeBg: 'bg-purple-600',
    textColor: 'text-white',
    iconName: 'Ban',
    description: 'Chuẩn bị can thiệp/phẫu thuật hoặc viêm tụy cấp/XHTH',
  },
  FALL_RISK: {
    id: 'FALL_RISK',
    label: 'Nguy cơ ngã cao',
    shortLabel: 'Nguy cơ ngã',
    color: 'border-orange-500 text-orange-700 bg-orange-50',
    badgeBg: 'bg-orange-500',
    textColor: 'text-white',
    iconName: 'AlertTriangle',
    description: 'Người cao tuổi, tri giác lú lẫn, yếu liệt chi',
  },
  ALLERGY: {
    id: 'ALLERGY',
    label: 'Dị ứng thuốc',
    shortLabel: 'Dị ứng',
    color: 'border-red-600 text-red-700 bg-red-100',
    badgeBg: 'bg-red-700',
    textColor: 'text-white',
    iconName: 'ShieldAlert',
    description: 'Tiền sử dị ứng kháng sinh, thuốc giảm đau...',
  },
  NG_TUBE: {
    id: 'NG_TUBE',
    label: 'Sonde dạ dày',
    shortLabel: 'Sonde DD',
    color: 'border-indigo-500 text-indigo-700 bg-indigo-50',
    badgeBg: 'bg-indigo-600',
    textColor: 'text-white',
    iconName: 'Activity',
    description: 'Nuôi ăn qua sonde hoặc hút dịch dạ dày',
  },
  FOLEY: {
    id: 'FOLEY',
    label: 'Sonde tiểu',
    shortLabel: 'Sonde tiểu',
    color: 'border-teal-500 text-teal-700 bg-teal-50',
    badgeBg: 'bg-teal-600',
    textColor: 'text-white',
    iconName: 'FileText',
    description: 'Đặt sonde tiểu lưu theo dõi lượng nước tiểu',
  },
  FLUID_BALANCE: {
    id: 'FLUID_BALANCE',
    label: 'TD dịch nhập/xuất',
    shortLabel: 'TD Dịch',
    color: 'border-blue-600 text-blue-800 bg-blue-50',
    badgeBg: 'bg-blue-700',
    textColor: 'text-white',
    iconName: 'Droplets',
    description: 'Theo dõi tổng lượng dịch vào/ra (nhập/xuất) 24h',
  },
  ISOLATION: {
    id: 'ISOLATION',
    label: 'Cách ly y tế',
    shortLabel: 'Cách ly',
    color: 'border-yellow-600 text-yellow-800 bg-yellow-100',
    badgeBg: 'bg-yellow-600',
    textColor: 'text-white',
    iconName: 'Lock',
    description: 'Nghi ngờ lây nhiễm vi khuẩn kháng thuốc / hô hấp',
  },
};

export interface Doctor {
  id: string;
  name: string;
  title: string; // BS.CKII, ThS.BS, BS.CKI, BS...
  role: string; // Trưởng khoa, Phó khoa, Bác sĩ điều trị
  specialty?: string;
  phone?: string;
  avatarColor: string;
  email?: string;
  shiftStatus: 'Trực chính' | 'Trực phụ' | 'Hành chính' | 'Nghỉ';
}

export interface VitalSign {
  id: string;
  timestamp: string;
  bpSystolic: number; // mmHg
  bpDiastolic: number; // mmHg
  heartRate: number; // bpm
  temperature: number; // °C
  spO2: number; // %
  respiratoryRate: number; // l/p
  glasgow?: number; // 3-15
  bloodSugar?: number; // mmol/L
  notes?: string;
}

export interface ClinicalEvolution {
  id: string;
  timestamp: string;
  doctorName: string;
  shift: 'Sáng' | 'Chiều' | 'Đêm / Trực';
  clinicalNote: string;
  vitalSummary?: string;
  treatmentAction: string;
  orders?: string;
  notes?: string;
}

export interface LabResult {
  id: string;
  timestamp: string; // Ngày giờ thực hiện
  testDate?: string; // Ngày thực hiện
  category: 'Huyết học' | 'Sinh hóa' | 'Điện giải' | 'Khí máu' | 'CĐHA' | 'Khác';
  testName: string;
  value: string;
  unit: string;
  normalRange: string;
  isAbnormal: boolean;
  isPanicValue?: boolean;
}

export interface Medication {
  id: string;
  name: string;
  activeIngredient: string;
  dosage: string;
  route: 'Uống' | 'Tiêm TM' | 'Truyền TM' | 'Khí dung' | 'Tiêm dưới da' | 'Đặt hậu môn';
  frequency: string;
  timing: string; // 08:00 - 16:00
  instructions?: string;
  status: 'active' | 'completed' | 'discontinued';
  startDate: string; // Ngày bắt đầu
  endDate?: string; // Ngày kết thúc (hoặc đang dùng)
}

export interface AIAnalysisResult {
  lastUpdated: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  summary: string;
  differentialDiagnosis: string[];
  clinicalAlerts: {
    type: 'critical' | 'warning' | 'info';
    message: string;
    evidence: string;
  }[];
  drugInteractions?: string[];
  recommendations: string[];
  suggestedMonitoring: string[];
}

export interface Patient {
  id: string;
  patientCode?: string; // Mã bệnh nhân (không bắt buộc)
  medicalRecordNumber?: string; // Số HSBA (không bắt buộc)
  fullName: string;
  gender: 'Nam' | 'Nữ';
  age: number;
  dateOfBirth: string; // Ngày sinh
  address?: string; // Địa chỉ (không bắt buộc)
  insuranceNumber?: string; // BHYT (không bắt buộc)
  admissionDate: string; // Ngày nhập viện YYYY-MM-DD HH:mm
  department?: string; // Khoa (Nội Tổng Hợp)
  roomNumber: string; // Buồng bệnh e.g. "P.301"
  bedNumber: string; // Giường bệnh e.g. "Giường 01"
  attendingDoctorId: string; // Bác sĩ điều trị phụ trách
  primaryNurse: string;
  primaryDiagnosis: string; // Chẩn đoán
  icd10Primary?: string;
  secondaryDiagnosis?: string;
  icd10Secondary?: string;
  allergies?: string;
  medicalHistory?: string;
  severity: SeverityLevel; // Tình trạng: Nặng / Trung bình / Nhẹ
  admissionStatus?: AdmissionDischargeStatus; // Mới nhập hôm nay, hôm qua, ra viện hôm nay, ngày mai
  tags: ClinicalTag[]; // Nhãn đặc biệt: Thở Oxy, Dùng vận mạch, Cần theo dõi sát...
  importantNotes?: string; // Ghi chú quan trọng
  treatmentPlan?: string; // Kế hoạch điều trị
  vitals: VitalSign[];
  evolutions: ClinicalEvolution[]; // Diễn tiến bệnh (với ngày cập nhật)
  labs: LabResult[]; // Kết quả xét nghiệm (tên, kết quả, ngày thực hiện)
  medications: Medication[]; // Danh sách thuốc (tên, liều, tần suất, ngày bắt đầu, ngày kết thúc)
  aiAnalysis?: AIAnalysisResult;
  status: 'ACTIVE' | 'DISCHARGED' | 'TRANSFERRED';
  dischargeDate?: string;
  dischargeTomorrowSetDate?: string;
  handoverNotes?: string;
  initialLabsText?: string; // Dán trực tiếp kết quả cận lâm sàng ban đầu
  initialMedicationsText?: string; // Dán trực tiếp y lệnh thuốc ban đầu
}

export interface DepartmentRoom {
  id: string;
  number: string;
  name: string;
  type: 'ICU' | 'ACUTE' | 'STANDARD' | 'VIP';
  totalBeds: number;
  description: string;
  nurseStation?: string;
  group?: 'CARDIO' | 'GROUP_2' | 'GROUP_1' | 'ICU';
}

export type WardRoomGroup = 'CARDIO' | 'GROUP_2' | 'GROUP_1';

export const WARD_GROUPS_META: Record<WardRoomGroup, {
  id: WardRoomGroup;
  name: string;
  shortName: string;
  rooms: string[];
  badgeColor: string;
  borderColor: string;
  bgLight: string;
  description: string;
}> = {
  CARDIO: {
    id: 'CARDIO',
    name: 'Nhóm Tim Mạch',
    shortName: 'Nhóm Tim Mạch',
    rooms: ['733', '735', '737', '739', '741', '743', '745'],
    badgeColor: 'bg-rose-600 text-white',
    borderColor: 'border-rose-400',
    bgLight: 'bg-rose-50/70',
    description: 'Phòng 733, 735, 737, 739, 741, 743, 745',
  },
  GROUP_2: {
    id: 'GROUP_2',
    name: 'Nhóm 2',
    shortName: 'Nhóm 2',
    rooms: ['747', '749', '751', '753', '755', '757'],
    badgeColor: 'bg-indigo-600 text-white',
    borderColor: 'border-indigo-400',
    bgLight: 'bg-indigo-50/70',
    description: 'Phòng 747, 749, 751, 753, 755, 757',
  },
  GROUP_1: {
    id: 'GROUP_1',
    name: 'Nhóm 1',
    shortName: 'Nhóm 1',
    rooms: ['703', '707', '705', '709', '711', '713', '715', '717', '718', '721', '725', '727', '729', '731'],
    badgeColor: 'bg-blue-600 text-white',
    borderColor: 'border-blue-400',
    bgLight: 'bg-blue-50/70',
    description: 'Phòng 703, 707, 705, 709, 711, 713, 715, 717, 718, 721, 725, 727, 729, 731',
  },
};

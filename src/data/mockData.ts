import { DepartmentRoom, Doctor, Patient } from '../types/patient';

// Rooms matching the physical whiteboard at Khoa Nội Tổng Hợp - Tim Mạch (Lầu 7) & Sub-ICU (Lầu 3)
export const INITIAL_ROOMS: DepartmentRoom[] = [
  // ==========================================
  // NHÓM TIM MẠCH (733, 735, 737, 739, 741, 743, 745)
  // Tối đa 3 giường 1 phòng, CHỈ 743 & 735 tối đa 6 giường
  // ==========================================
  {
    id: "R733",
    number: "733",
    name: "Phòng 733",
    type: "ACUTE",
    totalBeds: 3,
    group: "GROUP_1",
    description: "Bệnh nhân tim mạch, cấp cứu nội tiếp nhận theo dõi (Nhóm 1)",
    nurseStation: "Trạm ĐD Dãy 2 (Lầu 7)",
  },
  {
    id: "R735",
    number: "735",
    name: "Phòng 735",
    type: "STANDARD",
    totalBeds: 6,
    group: "CARDIO",
    description: "SXH Dengue cảnh báo, nhiễm siêu vi, sốt cao (Tối đa 6 giường)",
    nurseStation: "Trạm ĐD Dãy 2 (Lầu 7)",
  },
  {
    id: "R737",
    number: "737",
    name: "Phòng 737",
    type: "STANDARD",
    totalBeds: 3,
    group: "CARDIO",
    description: "Huyết khối tĩnh mạch sâu, thuyên tắc phổi ổn định",
    nurseStation: "Trạm ĐD Dãy 2 (Lầu 7)",
  },
  {
    id: "R739",
    number: "739",
    name: "Phòng 739",
    type: "STANDARD",
    totalBeds: 3,
    group: "CARDIO",
    description: "Hội chứng tim thận, đái tháo đường typ 2, THA",
    nurseStation: "Trạm ĐD Dãy 2 (Lầu 7)",
  },
  {
    id: "R741",
    number: "741",
    name: "Phòng 741",
    type: "STANDARD",
    totalBeds: 3,
    group: "CARDIO",
    description: "Viêm đa khớp, thoái hóa khớp, đau thần kinh tọa",
    nurseStation: "Trạm ĐD Dãy 2 (Lầu 7)",
  },
  {
    id: "R743",
    number: "743",
    name: "Phòng 743",
    type: "STANDARD",
    totalBeds: 6,
    group: "CARDIO",
    description: "Bệnh lý tuyến giáp, đái tháo đường biến chứng (Tối đa 6 giường)",
    nurseStation: "Trạm ĐD Dãy 2 (Lầu 7)",
  },
  {
    id: "R745",
    number: "745",
    name: "Phòng 745",
    type: "STANDARD",
    totalBeds: 3,
    group: "CARDIO",
    description: "Viêm tụy cấp nhẹ - vừa, xuất huyết tiêu hóa đã cầm",
    nurseStation: "Trạm ĐD Dãy 2 (Lầu 7)",
  },

  // ==========================================
  // NHÓM 2 (747, 749, 751, 753, 755, 757)
  // 757, 749 tối đa 6 giường, còn lại 3 giường
  // ==========================================
  {
    id: "R747",
    number: "747",
    name: "Phòng 747",
    type: "STANDARD",
    totalBeds: 3,
    group: "GROUP_2",
    description: "Giãn phế quản bội nhiễm, viêm phế quản phổi",
    nurseStation: "Trạm ĐD Dãy 2 (Lầu 7)",
  },
  {
    id: "R749",
    number: "749",
    name: "Phòng 749",
    type: "ACUTE",
    totalBeds: 6,
    group: "GROUP_2",
    description: "Bệnh nhân nguy cơ diễn biến nhanh, cần đo sinh hiệu mỗi 2h (Tối đa 6 giường)",
    nurseStation: "Trạm ĐD Dãy 2 (Lầu 7)",
  },
  {
    id: "R751",
    number: "751",
    name: "Phòng 751",
    type: "STANDARD",
    totalBeds: 3,
    group: "GROUP_2",
    description: "Người cao tuổi đa bệnh lý, ăn qua sonde",
    nurseStation: "Trạm ĐD Dãy 2 (Lầu 7)",
  },
  {
    id: "R753",
    number: "753",
    name: "Phòng 753",
    type: "STANDARD",
    totalBeds: 3,
    group: "GROUP_2",
    description: "Điều trị nội trú theo dõi thường quy",
    nurseStation: "Trạm ĐD Dãy 2 (Lầu 7)",
  },
  {
    id: "R755",
    number: "755",
    name: "Phòng 755",
    type: "STANDARD",
    totalBeds: 3,
    group: "GROUP_2",
    description: "Bệnh mạch máu ngoại biên, suy van tĩnh mạch chi dưới",
    nurseStation: "Trạm ĐD Dãy 2 (Lầu 7)",
  },
  {
    id: "R757",
    number: "757",
    name: "Phòng 757",
    type: "VIP",
    totalBeds: 6,
    group: "GROUP_2",
    description: "Buồng bệnh yêu cầu tiện nghi cao (Tối đa 6 giường)",
    nurseStation: "Trạm ĐD Dãy 2 (Lầu 7)",
  },

  // ==========================================
  // NHÓM 1 (703, 707, 705, 709, 711, 713, 715, 717, 718, 721, 725, 727, 729, 731)
  // Mỗi phòng tối đa 3 giường
  // ==========================================
  {
    id: "R703",
    number: "703",
    name: "Phòng 703",
    type: "STANDARD",
    totalBeds: 3,
    group: "GROUP_1",
    description: "Bệnh tim thiếu máu cục bộ, Tăng huyết áp, ĐTĐ typ 2",
    nurseStation: "Trạm ĐD Dãy 1 (Lầu 7)",
  },
  {
    id: "R704",
    number: "704",
    name: "Phòng 704",
    type: "STANDARD",
    totalBeds: 3,
    group: "GROUP_1",
    description: "Điều trị nội khoa chung",
    nurseStation: "Trạm ĐD Dãy 1 (Lầu 7)",
  },
  {
    id: "R707",
    number: "707",
    name: "Phòng 707",
    type: "STANDARD",
    totalBeds: 3,
    group: "GROUP_1",
    description: "Bệnh cơ tim, xơ vữa động mạch, rối loạn lipid máu",
    nurseStation: "Trạm ĐD Dãy 1 (Lầu 7)",
  },
  {
    id: "R705",
    number: "705",
    name: "Phòng 705",
    type: "ACUTE",
    totalBeds: 3,
    group: "GROUP_1",
    description: "Bệnh nhân sau can thiệp mạch vành, nong mạch, đặt máy tạo nhịp",
    nurseStation: "Trạm ĐD Dãy 1 (Lầu 7)",
  },
  {
    id: "R709",
    number: "709",
    name: "Phòng 709",
    type: "STANDARD",
    totalBeds: 3,
    group: "GROUP_1",
    description: "ĐTĐ biến chứng bàn chân, Basedow, rối loạn chuyển hóa",
    nurseStation: "Trạm ĐD Dãy 1 (Lầu 7)",
  },
  {
    id: "R711",
    number: "711",
    name: "Phòng 711",
    type: "STANDARD",
    totalBeds: 3,
    group: "GROUP_1",
    description: "Viêm gan virus mạn, xơ gan còn bù, viêm dạ dày tá tràng",
    nurseStation: "Trạm ĐD Dãy 1 (Lầu 7)",
  },
  {
    id: "R713",
    number: "713",
    name: "Phòng 713",
    type: "STANDARD",
    totalBeds: 3,
    group: "GROUP_1",
    description: "Suy thận mạn, hội chứng thận hư, nhiễm khuẩn tiết niệu",
    nurseStation: "Trạm ĐD Dãy 1 (Lầu 7)",
  },
  {
    id: "R715",
    number: "715",
    name: "Phòng 715",
    type: "STANDARD",
    totalBeds: 3,
    group: "GROUP_1",
    description: "Viêm phổi cộng đồng, COPD đợt cấp, Hen phế quản",
    nurseStation: "Trạm ĐD Dãy 1 (Lầu 7)",
  },
  {
    id: "R717",
    number: "717",
    name: "Phòng 717",
    type: "STANDARD",
    totalBeds: 3,
    group: "GROUP_1",
    description: "Bệnh nhân cao tuổi, thoái hóa khớp, đau nhức xương",
    nurseStation: "Trạm ĐD Dãy 1 (Lầu 7)",
  },
  {
    id: "R718",
    number: "718",
    name: "Phòng 718",
    type: "STANDARD",
    totalBeds: 3,
    group: "GROUP_1",
    description: "Bệnh đa bệnh lý người cao tuổi, sa sút trí tuệ nhẹ",
    nurseStation: "Trạm ĐD Dãy 1 (Lầu 7)",
  },
  {
    id: "R721",
    number: "721",
    name: "Phòng 721",
    type: "STANDARD",
    totalBeds: 3,
    group: "GROUP_1",
    description: "Gout cấp và mạn, thoái hóa đa khớp, viêm khớp dạng thấp",
    nurseStation: "Trạm ĐD Dãy 1 (Lầu 7)",
  },
  {
    id: "R725",
    number: "725",
    name: "Phòng 725",
    type: "STANDARD",
    totalBeds: 3,
    group: "GROUP_1",
    description: "Bệnh lý nội khoa chung, sốt chưa rõ nguyên nhân",
    nurseStation: "Trạm ĐD Dãy 1 (Lầu 7)",
  },
  {
    id: "R727",
    number: "727",
    name: "Phòng 727",
    type: "VIP",
    totalBeds: 3,
    group: "GROUP_1",
    description: "Phòng điều trị yêu cầu chất lượng cao",
    nurseStation: "Trạm ĐD Dãy 1 (Lầu 7)",
  },
  {
    id: "R729",
    number: "729",
    name: "Phòng 729",
    type: "VIP",
    totalBeds: 3,
    group: "GROUP_1",
    description: "Phòng điều trị yêu cầu tiện nghi cao",
    nurseStation: "Trạm ĐD Dãy 1 (Lầu 7)",
  },
  {
    id: "R731",
    number: "731",
    name: "Phòng 731",
    type: "ICU",
    totalBeds: 3,
    group: "GROUP_1",
    description: "Bệnh nhân tim mạch nặng, monitor theo dõi liên tục",
    nurseStation: "Trạm ĐD Dãy 2 (Hồi sức Lầu 7)",
  },
];

// Group 1 Configuration (Nhóm 1): Phòng 703 -> 731 và bổ sung phòng 733
export const GROUP_1_ROOM_NUMBERS = [
  '703', '707', '705', '709', '711', '713', '715', '717', '718', '721', '725', '727', '729', '731', '733'
];

// Danh sách 6 Bác sĩ phụ trách Nhóm 1: Ngọc, Trung, Huyền, Thiên, Ánh, Bình Chi
export const GROUP_1_DOCTOR_IDS = [
  '00708', // BS. Trần Hữu Ngọc (Ngọc)
  '00979', // BS. Nguyễn Hữu Trung (Trung)
  '00257', // BS. Đỗ Thị Vân Huyền (Huyền)
  '00144', // BS. Phạm Cao Thiên (Thiên)
  '00226', // BS. Đặng Thị Ngọc Ánh (Ánh)
  '00943', // BS. Trần Bùi Bình Chi (Bình Chi)
];

// Danh sách Bác sĩ Nhóm 2: Linh, Hoài, Mai, Ngoan, Chi
export const GROUP_2_DOCTOR_IDS = [
  '00161', // BS. Thái Thị Thùy Linh (Linh)
  '00146', // BS. Dương Thị Hoài (Hoài)
  '00318', // BS. Nguyễn Thị Ngọc Mai (Mai)
  '00176', // BS. Đỗ Thị Ngoan (Ngoan)
  '00769', // BS. Nguyễn Thị Phương Chi (Chi)
];

// Danh sách Bác sĩ Tim Mạch (còn lại sau khi bỏ Tuế, Quyên): Nhật, Thọ, Thịnh, Lam, Luận
export const CARDIO_DOCTOR_IDS = [
  '00020', // BS. Nguyễn Văn Phương Nhật (Nhật)
  '00355', // BS. Võ Văn Thọ (Thọ)
  '00818', // BS. Võ Hồng Thịnh (Thịnh)
  '00929', // BS. Trương Hoài Lam (Lam)
  '00871', // BS. Đồng Văn Luận (Luận)
];

// Doctors matching the official staff list at Khoa Nội Tổng Hợp - Bệnh viện Hùng Vương Gia Lai
export const INITIAL_DOCTORS: Doctor[] = [
  // Nhóm 1 (Ngọc, Trung, Huyền, Thiên, Ánh, Bình Chi)
  {
    id: '00708',
    name: 'Trần Hữu Ngọc',
    title: '',
    role: '',
    avatarColor: 'bg-rose-700',
    shiftStatus: 'Trực chính',
  },
  {
    id: '00979',
    name: 'Nguyễn Hữu Trung',
    title: '',
    role: '',
    avatarColor: 'bg-amber-600',
    shiftStatus: 'Trực phụ',
  },
  {
    id: '00257',
    name: 'Đỗ Thị Vân Huyền',
    title: '',
    role: '',
    avatarColor: 'bg-indigo-700',
    shiftStatus: 'Trực phụ',
  },
  {
    id: '00144',
    name: 'Phạm Cao Thiên',
    title: '',
    role: '',
    avatarColor: 'bg-blue-700',
    shiftStatus: 'Trực chính',
  },
  {
    id: '00226',
    name: 'Đặng Thị Ngọc Ánh',
    title: '',
    role: '',
    avatarColor: 'bg-emerald-600',
    shiftStatus: 'Trực phụ',
  },
  {
    id: '00943',
    name: 'Trần Bùi Bình Chi',
    title: '',
    role: '',
    avatarColor: 'bg-teal-700',
    shiftStatus: 'Hành chính',
  },

  // Nhóm 2 (Linh, Hoài, Mai, Ngoan, Chi)
  {
    id: '00161',
    name: 'Thái Thị Thùy Linh',
    title: '',
    role: '',
    avatarColor: 'bg-rose-600',
    shiftStatus: 'Trực chính',
  },
  {
    id: '00146',
    name: 'Dương Thị Hoài',
    title: '',
    role: '',
    avatarColor: 'bg-pink-700',
    shiftStatus: 'Hành chính',
  },
  {
    id: '00318',
    name: 'Nguyễn Thị Ngọc Mai',
    title: '',
    role: '',
    avatarColor: 'bg-blue-600',
    shiftStatus: 'Trực chính',
  },
  {
    id: '00176',
    name: 'Đỗ Thị Ngoan',
    title: '',
    role: '',
    avatarColor: 'bg-emerald-700',
    shiftStatus: 'Hành chính',
  },
  {
    id: '00769',
    name: 'Nguyễn Thị Phương Chi',
    title: '',
    role: '',
    avatarColor: 'bg-cyan-600',
    shiftStatus: 'Hành chính',
  },

  // Tim Mạch (Còn lại: Nhật, Thọ, Thịnh, Lam)
  {
    id: '00020',
    name: 'Nguyễn Văn Phương Nhật',
    title: '',
    role: '',
    avatarColor: 'bg-blue-600',
    shiftStatus: 'Trực chính',
  },
  {
    id: '00355',
    name: 'Võ Văn Thọ',
    title: '',
    role: '',
    avatarColor: 'bg-amber-700',
    shiftStatus: 'Hành chính',
  },
  {
    id: '00818',
    name: 'Võ Hồng Thịnh',
    title: '',
    role: '',
    avatarColor: 'bg-red-700',
    shiftStatus: 'Trực chính',
  },
  {
    id: '00929',
    name: 'Trương Hoài Lam',
    title: '',
    role: '',
    avatarColor: 'bg-violet-600',
    shiftStatus: 'Trực chính',
  },
  {
    id: '00871',
    name: 'Đồng Văn Luận',
    title: '',
    role: '',
    avatarColor: 'bg-indigo-600',
    shiftStatus: 'Hành chính',
  },
];

// Inpatient records directly matching the hospital whiteboard and clinical requirements
export const INITIAL_PATIENTS: Patient[] = [];

// Bác sĩ phụ trách mặc định theo sơ đồ bảng trực thực tế tại viện
export const DEFAULT_ROOM_DOCTORS: Record<string, string> = {
  // Nhóm 1 (703 - 731 & 733) - BS: Ngọc, Trung, Huyền, Thiên, Ánh, Bình Chi
  "703": "00708",    // Trần Hữu Ngọc
  "704": "00979",    // Nguyễn Hữu Trung
  "707": "00257",    // Đỗ Thị Vân Huyền
  "705": "00943",    // Trần Bùi Bình Chi
  "709": "00144",    // Phạm Cao Thiên
  "711": "00226",    // Đặng Thị Ngọc Ánh
  "713": "00144",    // Phạm Cao Thiên
  "715": "00708",    // Trần Hữu Ngọc
  "717": "00979",    // Nguyễn Hữu Trung
  "718": "00257",    // Đỗ Thị Vân Huyền
  "721": "00943",    // Trần Bùi Bình Chi
  "725": "00226",    // Đặng Thị Ngọc Ánh
  "727": "00708",    // Trần Hữu Ngọc
  "729": "00979",    // Nguyễn Hữu Trung
  "731": "00144",    // Phạm Cao Thiên
  "733": "00226",    // Đặng Thị Ngọc Ánh

  // Nhóm Tim Mạch (735 - 745) - BS: Nhật, Thọ, Thịnh, Lam, Luận
  "735": "00020",    // Nguyễn Văn Phương Nhật
  "737": "00355",    // Võ Văn Thọ
  "739": "00818",    // Võ Hồng Thịnh
  "741": "00929",    // Trương Hoài Lam
  "743": "00871",    // Đồng Văn Luận
  "745": "00818",    // Võ Hồng Thịnh

  // Nhóm 2 (747 - 757) - BS: Linh, Hoài, Mai, Ngoan, Chi
  "747": "00161",    // Thái Thị Thùy Linh
  "749": "00146",    // Dương Thị Hoài
  "751": "00318",    // Nguyễn Thị Ngọc Mai
  "753": "00176",    // Đỗ Thị Ngoan
  "755": "00769",    // Nguyễn Thị Phương Chi
  "757": "00161",    // Thái Thị Thùy Linh
};

/**
 * Trích xuất tên Bác sĩ ngắn gọn (chỉ hiển thị tên gọi để vừa vặn ô thẻ buồng bệnh)
 */
export function getDoctorShortName(nameOrDoctor?: string | Doctor | null): string {
  if (!nameOrDoctor) return "Chưa phân";
  const fullName = typeof nameOrDoctor === "string" ? nameOrDoctor : nameOrDoctor.name;
  if (!fullName) return "Chưa phân";
  
  if (fullName.includes("Bình Chi") || fullName.includes("B.Chi")) return "Bình Chi";
  if (fullName.includes("Phương Chi") || fullName.includes("P.Chi")) return "Chi";
  if (fullName.includes("Phương Nhật")) return "Nhật";
  if (fullName.includes("Vân Huyền")) return "Huyền";
  if (fullName.includes("Ngọc Ánh")) return "Ánh";
  if (fullName.includes("Thùy Linh")) return "Linh";
  if (fullName.includes("Ngọc Mai")) return "Mai";
  if (fullName.includes("Hữu Ngọc")) return "Ngọc";
  if (fullName.includes("Hữu Trung")) return "Trung";
  if (fullName.includes("Cao Thiên")) return "Thiên";
  if (fullName.includes("Hoài Lam")) return "Lam";
  if (fullName.includes("Hồng Thịnh")) return "Thịnh";
  if (fullName.includes("Văn Thọ")) return "Thọ";
  if (fullName.includes("Dương Thị Hoài")) return "Hoài";
  if (fullName.includes("Đỗ Thị Ngoan")) return "Ngoan";

  const clean = fullName
    .replace(/^BS\.CKII\s+/i, "")
    .replace(/^BS\.CKI\s+/i, "")
    .replace(/^ThS\.BS\s+/i, "")
    .replace(/^BS\s+/i, "")
    .replace(/^ThS\s+/i, "")
    .replace(/^Bác sĩ\s+/i, "")
    .trim();
  
  const parts = clean.split(/\s+/);
  return parts[parts.length - 1] || clean;
}

import React, { useState, useMemo } from 'react';
import { 
  Patient, 
  Doctor, 
  SeverityLevel, 
  ClinicalTag, 
  CLINICAL_TAGS_META 
} from '../types/patient';
import { 
  Search, 
  Filter, 
  FileText, 
  ArrowRightLeft, 
  Wind, 
  HeartPulse, 
  Eye, 
  AlertCircle, 
  SlidersHorizontal, 
  ChevronDown, 
  UserCheck,
  ShieldAlert,
  AlertTriangle
} from 'lucide-react';
import { DiseaseStatisticsBar, DiseaseFilterType, matchPatientDisease } from './DiseaseStatisticsBar';

interface PatientTableViewProps {
  patients: Patient[];
  doctors: Doctor[];
  onSelectPatient: (patient: Patient) => void;
  onTransferPatient: (patient: Patient) => void;
  onReassignDoctor?: (patientId: string, newDoctorId: string) => void;
}

export const PatientTableView: React.FC<PatientTableViewProps> = ({
  patients,
  doctors,
  onSelectPatient,
  onTransferPatient,
  onReassignDoctor,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<SeverityLevel | 'ALL'>('ALL');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('ALL');
  const [selectedTag, setSelectedTag] = useState<ClinicalTag | 'ALL'>('ALL');
  const [selectedRoom, setSelectedRoom] = useState<string>('ALL');
  const [selectedDiseaseFilter, setSelectedDiseaseFilter] = useState<DiseaseFilterType>('ALL');

  const doctorMap = useMemo(() => {
    return new Map<string, Doctor>(doctors.map((d) => [d.id, d]));
  }, [doctors]);

  // Extract unique room numbers
  const roomsList = useMemo(() => {
    const list = Array.from(new Set(patients.map((p) => p.roomNumber))).sort();
    return list;
  }, [patients]);

  // Filtered patients
  const filteredPatients = useMemo(() => {
    return patients.filter((patient) => {
      // Must be active
      if (patient.status !== 'ACTIVE') return false;

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchName = patient.fullName.toLowerCase().includes(term);
        const matchDiag = patient.primaryDiagnosis.toLowerCase().includes(term);
        const matchRoom = patient.roomNumber.toLowerCase().includes(term);
        const doctor = doctorMap.get(patient.attendingDoctorId);
        const matchDoctor = doctor?.name.toLowerCase().includes(term);

        if (!matchName && !matchDiag && !matchRoom && !matchDoctor) {
          return false;
        }
      }

      // Disease & elderly filter (Viêm gan B, Viêm gan A, Sốt xuất huyết, Cúm, COVID, Lao, Thủy đậu, Sởi, >70 tuổi)
      if (selectedDiseaseFilter !== 'ALL' && !matchPatientDisease(patient, selectedDiseaseFilter)) {
        return false;
      }

      // Severity
      if (selectedSeverity !== 'ALL' && patient.severity !== selectedSeverity) {
        return false;
      }

      // Doctor
      if (selectedDoctorId !== 'ALL' && patient.attendingDoctorId !== selectedDoctorId) {
        return false;
      }

      // Tag
      if (selectedTag !== 'ALL' && !patient.tags.includes(selectedTag)) {
        return false;
      }

      // Room
      if (selectedRoom !== 'ALL' && patient.roomNumber !== selectedRoom) {
        return false;
      }

      return true;
    });
  }, [patients, searchTerm, selectedSeverity, selectedDoctorId, selectedTag, selectedRoom, selectedDiseaseFilter, doctorMap]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
      
      {/* 1. DOCTOR FILTER BAR (Front and center for easy doctor selection) */}
      <div className="p-4 bg-slate-900 text-white border-b border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-rose-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-rose-200">
              Lọc Nhanh Theo Bác Sĩ Điều Trị
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Click vào tên bác sĩ để xem danh sách bệnh nhân đang phụ trách
          </span>
        </div>

        {/* Doctor Chips Grid */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedDoctorId('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              selectedDoctorId === 'ALL'
                ? 'bg-rose-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <span>Tất cả Bác sĩ</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/30 text-white font-extrabold">
              {patients.filter((p) => p.status === 'ACTIVE').length}
            </span>
          </button>

          {doctors.map((doc) => {
            const count = patients.filter(
              (p) => p.status === 'ACTIVE' && p.attendingDoctorId === doc.id
            ).length;
            const isSelected = selectedDoctorId === doc.id;

            return (
              <button
                key={doc.id}
                onClick={() => setSelectedDoctorId(doc.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  isSelected
                    ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-400'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <div className={`w-4 h-4 rounded-full ${doc.avatarColor} text-white flex items-center justify-center text-[9px] font-black`}>
                  {doc.name.split(' ').pop()?.[0]}
                </div>
                <span>{doc.name}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  isSelected ? 'bg-black/30 text-white' : 'bg-slate-700 text-slate-300'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. SEARCH & ADVANCED FILTERS TOOLBAR */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo Mã bệnh nhân, Họ tên, Bác sĩ điều trị, Chẩn đoán, Địa chỉ, Phòng..."
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Quick Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Room filter */}
            <div className="relative">
              <select
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                className="pl-3 pr-8 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 appearance-none text-slate-700"
              >
                <option value="ALL">Tất cả buồng bệnh</option>
                {roomsList.map((rm) => (
                  <option key={rm} value={rm}>
                    Buồng {rm}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Tag filter */}
            <div className="relative">
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value as any)}
                className="pl-3 pr-8 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 appearance-none text-slate-700"
              >
                <option value="ALL">Tất cả nhãn lâm sàng</option>
                <option value="O2">Thở Oxy (O₂)</option>
                <option value="VASOPRESSOR">Dùng vận mạch</option>
                <option value="CLOSE_MONITORING">Cần theo dõi sát</option>
                <option value="FASTING">Nhịn ăn</option>
                <option value="DIALYSIS">Lọc máu</option>
                <option value="ALLERGY">Dị ứng thuốc</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* 3. SEVERITY & SPECIAL TAGS QUICK STRIP */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-black text-slate-500 mr-1 flex items-center gap-1 uppercase tracking-wider text-[10px]">
              <SlidersHorizontal className="w-3 h-3" /> Mức độ:
            </span>

            <button
              onClick={() => setSelectedSeverity('ALL')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                selectedSeverity === 'ALL'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Tất cả ({patients.filter((p) => p.status === 'ACTIVE').length})
            </button>

            <button
              onClick={() => setSelectedSeverity('CRITICAL')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                selectedSeverity === 'CRITICAL'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 border border-rose-300 text-rose-800 hover:bg-rose-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping inline-block" />
              Nặng ({patients.filter((p) => p.status === 'ACTIVE' && p.severity === 'CRITICAL').length})
            </button>

            <button
              onClick={() => setSelectedSeverity('MODERATE')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                selectedSeverity === 'MODERATE'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100'
              }`}
            >
              Trung bình ({patients.filter((p) => p.status === 'ACTIVE' && p.severity === 'MODERATE').length})
            </button>

            <button
              onClick={() => setSelectedSeverity('STABLE')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                selectedSeverity === 'STABLE'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              Nhẹ / Ổn định ({patients.filter((p) => p.status === 'ACTIVE' && p.severity === 'STABLE').length})
            </button>
          </div>

          {/* Quick special tag toggles */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-black uppercase text-slate-400 mr-1">
              Nhãn đặc biệt:
            </span>

            <button
              onClick={() => setSelectedTag(selectedTag === 'O2' ? 'ALL' : 'O2')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-all flex items-center gap-1 ${
                selectedTag === 'O2'
                  ? 'bg-cyan-600 text-white border-cyan-700 shadow-xs'
                  : 'bg-cyan-50 border-cyan-200 text-cyan-800 hover:bg-cyan-100'
              }`}
            >
              <Wind className="w-3 h-3" />
              <span>Thở Oxy</span>
            </button>

            <button
              onClick={() => setSelectedTag(selectedTag === 'VASOPRESSOR' ? 'ALL' : 'VASOPRESSOR')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-all flex items-center gap-1 ${
                selectedTag === 'VASOPRESSOR'
                  ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                  : 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100'
              }`}
            >
              <HeartPulse className="w-3 h-3 text-rose-600" />
              <span>Dùng Vận Mạch</span>
            </button>

            <button
              onClick={() => setSelectedTag(selectedTag === 'CLOSE_MONITORING' ? 'ALL' : 'CLOSE_MONITORING')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-all flex items-center gap-1 ${
                selectedTag === 'CLOSE_MONITORING'
                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                  : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
              }`}
            >
              <Eye className="w-3 h-3 text-amber-600" />
              <span>Cần Theo Dõi Sát</span>
            </button>

            {(searchTerm || selectedSeverity !== 'ALL' || selectedDoctorId !== 'ALL' || selectedTag !== 'ALL' || selectedRoom !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedSeverity('ALL');
                  setSelectedDoctorId('ALL');
                  setSelectedTag('ALL');
                  setSelectedRoom('ALL');
                }}
                className="text-xs text-rose-600 hover:underline font-bold ml-1"
              >
                Xóa lọc
              </button>
            )}
          </div>
        </div>

        {/* Disease Surveillance & Age > 70 Statistics Bar */}
        <div className="pt-2">
          <DiseaseStatisticsBar
            patients={patients}
            selectedFilter={selectedDiseaseFilter}
            onSelectFilter={setSelectedDiseaseFilter}
          />
        </div>
      </div>

      {/* TABLE VIEW */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100/90 text-slate-700 text-xs font-black uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Buồng / Giường</th>
              <th className="py-3 px-4">Bệnh nhân</th>
              <th className="py-3 px-4">Chẩn đoán ban đầu</th>
              <th className="py-3 px-4">Tình trạng & Nhãn đặc biệt</th>
              <th className="py-3 px-4">Bác sĩ điều trị phụ trách</th>
              <th className="py-3 px-4">Ghi chú & Sinh hiệu</th>
              <th className="py-3 px-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredPatients.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-14 text-center text-slate-400">
                  <AlertCircle className="w-9 h-9 mx-auto mb-2 text-slate-300" />
                  <p className="font-bold text-slate-600 text-sm">
                    Không tìm thấy bệnh nhân nào phù hợp với bộ lọc hiện tại.
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Hãy thử đổi bác sĩ hoặc xóa bớt tiêu chí lọc tìm kiếm.
                  </p>
                </td>
              </tr>
            ) : (
              filteredPatients.map((patient) => {
                const doctor = doctorMap.get(patient.attendingDoctorId);
                const latestVital = patient.vitals?.[0];
                const isCritical = patient.severity === 'CRITICAL';
                const isModerate = patient.severity === 'MODERATE';

                return (
                  <tr
                    key={patient.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isCritical ? 'bg-rose-50/30' : ''
                    }`}
                  >
                    {/* Room & Bed */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs border border-slate-200 block w-fit">
                          {patient.roomNumber}
                        </span>
                        <span className="font-extrabold text-rose-700 text-xs block">
                          {patient.bedNumber}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          Khoa Nội TH
                        </span>
                      </div>
                    </td>

                    {/* Patient Name & Demographics (No address, no MRN) */}
                    <td className="py-3.5 px-4">
                      <div 
                        onClick={() => onSelectPatient(patient)}
                        className="cursor-pointer group"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 group-hover:text-rose-600 transition-colors text-sm">
                            {patient.fullName}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          <span>{patient.gender}, {patient.age}t ({patient.dateOfBirth})</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Vào viện: {patient.admissionDate.split(' ')[0]}
                        </div>
                      </div>
                    </td>

                    {/* Primary Diagnosis */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <p className="font-bold text-slate-900 text-xs line-clamp-2" title={patient.primaryDiagnosis}>
                        {patient.primaryDiagnosis}
                      </p>
                      {patient.icd10Primary && (
                        <span className="text-[10px] font-mono font-bold text-slate-500">
                          ICD-10: {patient.icd10Primary}
                        </span>
                      )}
                      {patient.secondaryDiagnosis && (
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5" title={patient.secondaryDiagnosis}>
                          Kèm: {patient.secondaryDiagnosis}
                        </p>
                      )}
                    </td>

                    {/* Severity & Clinical Tags */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1">
                          {/* Severity Badge */}
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                            isCritical
                              ? 'bg-rose-600 text-white shadow-xs'
                              : isModerate
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-emerald-600 text-white'
                          }`}>
                            {isCritical && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />}
                            {isCritical ? 'NẶNG' : isModerate ? 'TRUNG BÌNH' : 'NHẸ / ỔN ĐỊNH'}
                          </span>

                          {/* Admission / Discharge Status Badge */}
                          {patient.admissionStatus && patient.admissionStatus !== 'STABLE_INPATIENT' && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                              patient.admissionStatus === 'ADMITTED_TODAY' ? 'bg-emerald-600 text-white' :
                              patient.admissionStatus === 'ADMITTED_YESTERDAY' ? 'bg-amber-500 text-white' :
                              patient.admissionStatus === 'DISCHARGE_TODAY' ? 'bg-purple-600 text-white' :
                              'bg-blue-600 text-white'
                            }`}>
                              {patient.admissionStatus === 'ADMITTED_TODAY' && '🟢 Nhập hôm nay'}
                              {patient.admissionStatus === 'ADMITTED_YESTERDAY' && '🟡 Nhập hôm qua'}
                              {patient.admissionStatus === 'DISCHARGE_TODAY' && '🟣 Ra viện hôm nay'}
                              {patient.admissionStatus === 'DISCHARGE_TOMORROW' && '🔵 Ra viện mai'}
                            </span>
                          )}
                        </div>

                        {/* Special Badges: Thở Oxy, Vận mạch, Theo dõi sát */}
                        <div className="flex flex-wrap gap-1">
                          {patient.tags.includes('O2') && (
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-cyan-600 text-white flex items-center gap-0.5 shadow-2xs">
                              <Wind className="w-2.5 h-2.5" />
                              <span>Thở Oxy</span>
                            </span>
                          )}

                          {patient.tags.includes('VASOPRESSOR') && (
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-rose-600 text-white flex items-center gap-0.5 shadow-2xs animate-pulse">
                              <HeartPulse className="w-2.5 h-2.5" />
                              <span>Vận mạch</span>
                            </span>
                          )}

                          {patient.tags.includes('CLOSE_MONITORING') && (
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500 text-white flex items-center gap-0.5 shadow-2xs">
                              <Eye className="w-2.5 h-2.5" />
                              <span>Theo dõi sát</span>
                            </span>
                          )}

                          {/* Secondary badges */}
                          {patient.tags
                            .filter((t) => t !== 'O2' && t !== 'VASOPRESSOR' && t !== 'CLOSE_MONITORING')
                            .slice(0, 2)
                            .map((tagKey) => {
                              const meta = CLINICAL_TAGS_META[tagKey];
                              if (!meta) return null;
                              return (
                                <span
                                  key={tagKey}
                                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${meta.color}`}
                                >
                                  {meta.shortLabel}
                                </span>
                              );
                            })}
                        </div>
                      </div>
                    </td>

                    {/* Attending Doctor (With fast in-row re-assign dropdown!) */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full ${doctor?.avatarColor || 'bg-slate-400'} text-white flex items-center justify-center text-[10px] font-black shadow-xs`}>
                            {doctor ? doctor.name.split(' ').pop()?.[0] : '?'}
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900 text-xs">
                              {doctor?.name || 'Chưa phân công'}
                            </p>
                            
                          </div>
                        </div>

                        {/* Inline Re-assign Selector */}
                        {onReassignDoctor && (
                          <div className="pt-0.5">
                            <select
                              value={doctor?.id || ''}
                              onChange={(e) => onReassignDoctor(patient.id, e.target.value)}
                              className="text-[11px] font-bold bg-white border border-slate-300 rounded-md px-1.5 py-0.5 text-slate-700 hover:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-500 cursor-pointer"
                              title="Thay đổi bác sĩ điều trị cho bệnh nhân này"
                            >
                              <option value="" disabled>Đổi bác sĩ...</option>
                              {doctors.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Important Notes & Vitals */}
                    <td className="py-3.5 px-4 max-w-xs">
                      {patient.importantNotes && (
                        <p className="text-xs font-semibold text-rose-800 line-clamp-2 bg-rose-50/80 p-1.5 rounded border border-rose-200 mb-1" title={patient.importantNotes}>
                          ⚠️ {patient.importantNotes}
                        </p>
                      )}
                      {latestVital ? (
                        <div className="text-[11px] text-slate-600">
                          <span>HA: <b className={latestVital.bpSystolic > 150 || latestVital.bpSystolic < 90 ? 'text-rose-600 font-black' : 'text-slate-800'}>{latestVital.bpSystolic}/{latestVital.bpDiastolic}</b> mmHg</span>
                          <span className="ml-2">SpO₂: <b className={latestVital.spO2 < 94 ? 'text-rose-600 font-black' : 'text-emerald-700'}>{latestVital.spO2}%</b></span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Chưa đo</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => onTransferPatient(patient)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          title="Chuyển buồng / giường"
                        >
                          <ArrowRightLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onSelectPatient(patient)}
                          className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-600 hover:text-white rounded-lg border border-rose-200 hover:border-transparent transition-all shadow-xs"
                        >
                          Xem hồ sơ
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

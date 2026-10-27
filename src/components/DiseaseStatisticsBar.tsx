import React from 'react';
import { Patient } from '../types/patient';
import { 
  Activity, 
  AlertCircle, 
  Flame, 
  ShieldCheck, 
  Users, 
  CheckCircle,
  ThermometerSnowflake,
  Filter
} from 'lucide-react';

export type DiseaseFilterType = 
  | 'ALL'
  | 'HEPATITIS_B'
  | 'HEPATITIS_A'
  | 'DENGUE'
  | 'FLU'
  | 'COVID'
  | 'TB'
  | 'CHICKENPOX'
  | 'MEASLES'
  | 'AGE_OVER_70';

interface DiseaseStatisticsBarProps {
  patients: Patient[];
  selectedFilter: DiseaseFilterType;
  onSelectFilter: (filter: DiseaseFilterType) => void;
}

// Helper to check match
export function matchPatientDisease(patient: Patient, disease: DiseaseFilterType): boolean {
  if (disease === 'ALL') return true;
  
  if (disease === 'AGE_OVER_70') {
    return patient.age >= 70;
  }

  const text = `${patient.primaryDiagnosis} ${patient.secondaryDiagnosis || ''} ${patient.icd10Primary || ''} ${patient.icd10Secondary || ''}`.toLowerCase();

  switch (disease) {
    case 'HEPATITIS_B':
      return text.includes('viêm gan b') || text.includes('hbv') || text.includes('b18.1') || text.includes('b16');
    case 'HEPATITIS_A':
      return text.includes('viêm gan a') || text.includes('hav') || text.includes('b15');
    case 'DENGUE':
      return text.includes('sốt xuất huyết') || text.includes('dengue') || text.includes('sxh') || text.includes('a97');
    case 'FLU':
      return text.includes('cúm') || text.includes('influenza') || text.includes('j10') || text.includes('j11');
    case 'COVID':
      return text.includes('covid') || text.includes('sars-cov-2') || text.includes('u07.1');
    case 'TB':
      return text.includes('lao') || text.includes('tuberculosis') || text.includes('a15') || text.includes('a16');
    case 'CHICKENPOX':
      return text.includes('thủy đậu') || text.includes('chickenpox') || text.includes('varicella') || text.includes('b01');
    case 'MEASLES':
      return text.includes('sởi') || text.includes('measles') || text.includes('b05');
    default:
      return false;
  }
}

export const DiseaseStatisticsBar: React.FC<DiseaseStatisticsBarProps> = ({
  patients,
  selectedFilter,
  onSelectFilter,
}) => {
  const activePatients = patients.filter((p) => p.status === 'ACTIVE');

  // Compute statistics
  const countHepB = activePatients.filter((p) => matchPatientDisease(p, 'HEPATITIS_B')).length;
  const countHepA = activePatients.filter((p) => matchPatientDisease(p, 'HEPATITIS_A')).length;
  const countDengue = activePatients.filter((p) => matchPatientDisease(p, 'DENGUE')).length;
  const countFlu = activePatients.filter((p) => matchPatientDisease(p, 'FLU')).length;
  const countCovid = activePatients.filter((p) => matchPatientDisease(p, 'COVID')).length;
  const countTB = activePatients.filter((p) => matchPatientDisease(p, 'TB')).length;
  const countChickenpox = activePatients.filter((p) => matchPatientDisease(p, 'CHICKENPOX')).length;
  const countMeasles = activePatients.filter((p) => matchPatientDisease(p, 'MEASLES')).length;
  const countAgeOver70 = activePatients.filter((p) => matchPatientDisease(p, 'AGE_OVER_70')).length;

  const totalInfectious = countHepB + countHepA + countDengue + countFlu + countCovid + countTB + countChickenpox + countMeasles;

  const diseaseItems: {
    id: DiseaseFilterType;
    label: string;
    count: number;
    badgeBg: string;
    borderCol: string;
    textColor: string;
    activeClass: string;
    icon: string;
  }[] = [
    {
      id: 'HEPATITIS_B',
      label: 'Viêm gan B',
      count: countHepB,
      badgeBg: 'bg-amber-500',
      borderCol: 'border-amber-300',
      textColor: 'text-amber-900',
      activeClass: 'bg-amber-600 text-white border-amber-700 shadow-sm ring-2 ring-amber-300',
      icon: '🟡',
    },
    {
      id: 'HEPATITIS_A',
      label: 'Viêm gan A',
      count: countHepA,
      badgeBg: 'bg-orange-500',
      borderCol: 'border-orange-300',
      textColor: 'text-orange-900',
      activeClass: 'bg-orange-600 text-white border-orange-700 shadow-sm ring-2 ring-orange-300',
      icon: '🟠',
    },
    {
      id: 'DENGUE',
      label: 'Sốt xuất huyết',
      count: countDengue,
      badgeBg: 'bg-rose-600',
      borderCol: 'border-rose-300',
      textColor: 'text-rose-900',
      activeClass: 'bg-rose-600 text-white border-rose-700 shadow-sm ring-2 ring-rose-300 animate-pulse',
      icon: '🔴',
    },
    {
      id: 'FLU',
      label: 'Cúm (A/B)',
      count: countFlu,
      badgeBg: 'bg-blue-600',
      borderCol: 'border-blue-300',
      textColor: 'text-blue-900',
      activeClass: 'bg-blue-600 text-white border-blue-700 shadow-sm ring-2 ring-blue-300',
      icon: '🔵',
    },
    {
      id: 'COVID',
      label: 'COVID-19',
      count: countCovid,
      badgeBg: 'bg-purple-600',
      borderCol: 'border-purple-300',
      textColor: 'text-purple-900',
      activeClass: 'bg-purple-600 text-white border-purple-700 shadow-sm ring-2 ring-purple-300',
      icon: '🟣',
    },
    {
      id: 'TB',
      label: 'Lao',
      count: countTB,
      badgeBg: 'bg-amber-700',
      borderCol: 'border-amber-400',
      textColor: 'text-amber-950',
      activeClass: 'bg-amber-800 text-white border-amber-900 shadow-sm ring-2 ring-amber-400',
      icon: '🟤',
    },
    {
      id: 'CHICKENPOX',
      label: 'Thủy đậu',
      count: countChickenpox,
      badgeBg: 'bg-emerald-600',
      borderCol: 'border-emerald-300',
      textColor: 'text-emerald-900',
      activeClass: 'bg-emerald-600 text-white border-emerald-700 shadow-sm ring-2 ring-emerald-300',
      icon: '🟢',
    },
    {
      id: 'MEASLES',
      label: 'Sởi',
      count: countMeasles,
      badgeBg: 'bg-red-600',
      borderCol: 'border-red-300',
      textColor: 'text-red-900',
      activeClass: 'bg-red-700 text-white border-red-800 shadow-sm ring-2 ring-red-300',
      icon: '🔴',
    },
    {
      id: 'AGE_OVER_70',
      label: 'Bệnh nhân > 70 tuổi',
      count: countAgeOver70,
      badgeBg: 'bg-slate-700',
      borderCol: 'border-slate-300',
      textColor: 'text-slate-900',
      activeClass: 'bg-slate-900 text-white border-slate-950 shadow-sm ring-2 ring-slate-400',
      icon: '👴',
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-2 mb-2 space-y-1.5">
      {/* Header of the Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-100 pb-1 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-black uppercase tracking-wide text-slate-800 flex items-center gap-1.5">
            📊 Dịch Bệnh Truyền Nhiễm & &gt;70 Tuổi
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              Tổng ca dịch: {totalInfectious}
            </span>
          </span>
        </div>

        {selectedFilter !== 'ALL' && (
          <button
            onClick={() => onSelectFilter('ALL')}
            className="text-[10px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-1.5 py-0.2 rounded border border-rose-200 flex items-center gap-1 transition-colors"
          >
            <span>✕ Đang lọc theo dịch (Xem tất cả)</span>
          </button>
        )}
      </div>

      {/* Grid of Chips - Compact */}
      <div className="flex flex-wrap items-center gap-1 text-[11px]">
        {/* All Button */}
        <button
          onClick={() => onSelectFilter('ALL')}
          className={`px-2 py-0.5 rounded-md font-bold transition-all flex items-center gap-1 ${
            selectedFilter === 'ALL'
              ? 'bg-slate-800 text-white shadow-2xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <span>Tất cả</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 text-white font-extrabold">
            {activePatients.length}
          </span>
        </button>

        {/* 9 Specific Disease & Elderly Chips */}
        {diseaseItems.map((item) => {
          const isSelected = selectedFilter === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectFilter(isSelected ? 'ALL' : item.id)}
              className={`px-1.5 py-0.5 rounded-md font-bold transition-all flex items-center gap-1 border ${
                isSelected
                  ? item.activeClass
                  : item.count > 0
                  ? `bg-white ${item.borderCol} ${item.textColor} hover:bg-slate-50 shadow-2xs`
                  : 'bg-slate-50/70 border-slate-200 text-slate-400 hover:bg-slate-100'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
              <span className={`px-1 py-0.2 rounded-full text-[10px] font-black ${
                isSelected
                  ? 'bg-white/30 text-white'
                  : item.count > 0
                  ? `${item.badgeBg} text-white`
                  : 'bg-slate-200 text-slate-500'
              }`}>
                {item.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

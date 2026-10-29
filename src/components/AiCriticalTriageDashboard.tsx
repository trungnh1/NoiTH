import React, { useState, useMemo, useEffect } from 'react';
import { 
  Patient, 
  Doctor, 
  CLINICAL_TAGS_META 
} from '../types/patient';
import { 
  ShieldAlert, 
  AlertTriangle, 
  HeartPulse, 
  Wind, 
  Activity, 
  Zap, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  ArrowUpRight, 
  CheckCircle2, 
  Clock, 
  Flame,
  Stethoscope,
  Filter,
  Eye,
  BellRing
} from 'lucide-react';
import { getDoctorShortName } from '../data/mockData';
import { formatPatientDisplayName } from '../utils/storage';

interface AiCriticalPatientAnalysis {
  patientId: string;
  triageTier: 'P1_CRITICAL' | 'P2_HIGH_RISK' | 'P3_WATCH';
  clinicalHeadline: string;
  rapidAssessment: string;
  imminentRisks: string[];
  urgentActions: string[];
  vitalWarning: string;
  handoverNote: string;
}

interface AiCohortResult {
  summary: string;
  overallRiskLevel: string;
  keyUrgentActions: string[];
  patientAnalyses: AiCriticalPatientAnalysis[];
  analyzedAt: string;
}

interface AiCriticalTriageDashboardProps {
  patients: Patient[];
  doctors: Doctor[];
  onSelectPatient: (patient: Patient) => void;
}

export const AiCriticalTriageDashboard: React.FC<AiCriticalTriageDashboardProps> = ({
  patients,
  doctors,
  onSelectPatient,
}) => {
  // Collapse/Expand state (expanded by default so doctors see it immediately)
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'P1' | 'VASOPRESSOR' | 'O2' | 'CARDIO'>('ALL');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiCohortData, setAiCohortData] = useState<AiCohortResult | null>(null);
  const [lastAnalyzedTime, setLastAnalyzedTime] = useState<string | null>(null);
  const [selectedPatientTab, setSelectedPatientTab] = useState<string | null>(null);

  const doctorMap = useMemo(() => {
    return new Map<string, Doctor>(doctors.map((d) => [d.id, d]));
  }, [doctors]);

  // Identify Critical / High-Risk / Close-Monitoring cohort
  const criticalCohort = useMemo(() => {
    return patients.filter((p) => {
      if (p.status !== 'ACTIVE') return false;
      const isCrit = p.severity === 'CRITICAL';
      const isVaso = p.tags.includes('VASOPRESSOR');
      const isCloseMon = p.tags.includes('CLOSE_MONITORING');
      const isO2Mask = p.tags.includes('O2_MASK');
      const isO2Canula = p.tags.includes('O2_CANULA') || p.tags.includes('O2');
      const isFluid = p.tags.includes('FLUID_BALANCE');
      const hasPanicLab = (p.labs || []).some((l) => l.isPanicValue);

      // Vital checks
      const latestVital = p.vitals?.[0];
      let hasAbnormalVital = false;
      if (latestVital) {
        const sbp = latestVital.bpSystolic;
        const hr = latestVital.heartRate;
        const spo2 = latestVital.spO2;
        const rr = latestVital.respiratoryRate;
        if (sbp && (sbp < 90 || sbp > 180)) hasAbnormalVital = true;
        if (hr && (hr < 50 || hr > 115)) hasAbnormalVital = true;
        if (spo2 && spo2 < 92) hasAbnormalVital = true;
        if (rr && rr > 24) hasAbnormalVital = true;
        if (sbp && hr && (hr / sbp) >= 0.85) hasAbnormalVital = true;
      }

      return isCrit || isVaso || isCloseMon || isO2Mask || hasPanicLab || hasAbnormalVital || (isFluid && isO2Canula);
    });
  }, [patients]);

  // Helper function to calculate clinical indices
  const getClinicalIndices = (patient: Patient) => {
    const v = patient.vitals?.[0];
    if (!v) return null;

    const sbp = v.bpSystolic;
    const dbp = v.bpDiastolic;
    const hr = v.heartRate;
    const spo2 = v.spO2;
    const rr = v.respiratoryRate;

    // Shock Index = HR / SBP
    const shockIndex = sbp && hr ? (hr / sbp).toFixed(2) : null;
    const isShockIndexAlarm = shockIndex ? parseFloat(shockIndex) >= 0.9 : false;

    // Mean Arterial Pressure (MAP) = (2*DBP + SBP) / 3
    const mapVal = sbp && dbp ? Math.round((2 * dbp + sbp) / 3) : null;
    const isMapLow = mapVal !== null && mapVal < 65;

    // qSOFA score (SBP <= 100, RR >= 22, GCS < 15)
    let qsofa = 0;
    if (sbp && sbp <= 100) qsofa += 1;
    if (rr && rr >= 22) qsofa += 1;
    if (v.glasgow && v.glasgow < 15) qsofa += 1;

    return {
      shockIndex,
      isShockIndexAlarm,
      mapVal,
      isMapLow,
      qsofa,
      spo2,
      isHypoxia: spo2 ? spo2 < 92 : false,
      isSevereTachy: hr ? hr > 110 : false,
      isBrady: hr ? hr < 50 : false,
      isHypotensive: sbp ? sbp < 90 : false,
      isHypertensiveCrisis: sbp ? sbp >= 180 : false,
    };
  };

  // Heuristic Triage Tier for instant presentation
  const getHeuristicTriageTier = (p: Patient) => {
    const indices = getClinicalIndices(p);
    const isVaso = p.tags.includes('VASOPRESSOR');
    const isCrit = p.severity === 'CRITICAL';
    const isCloseMon = p.tags.includes('CLOSE_MONITORING');
    const hasPanicLab = p.labs.some((l) => l.isPanicValue);

    if (isCrit || isVaso || (indices && (indices.isMapLow || indices.isShockIndexAlarm || indices.qsofa >= 2))) {
      return {
        tier: 'P1' as const,
        label: 'P1 - Báo Động Đỏ',
        color: 'from-rose-600 to-red-700',
        badgeBg: 'bg-rose-600 text-white',
        border: 'border-rose-400',
        shadow: 'shadow-rose-100',
      };
    }
    if (isCloseMon || hasPanicLab || (indices && (indices.isHypoxia || indices.isHypotensive))) {
      return {
        tier: 'P2' as const,
        label: 'P2 - Theo Dõi Sát',
        color: 'from-amber-500 to-orange-600',
        badgeBg: 'bg-amber-600 text-white',
        border: 'border-amber-400',
        shadow: 'shadow-amber-100',
      };
    }
    return {
      tier: 'P3' as const,
      label: 'P3 - Cần Lưu Ý',
      color: 'from-yellow-500 to-amber-500',
      badgeBg: 'bg-yellow-500 text-slate-900',
      border: 'border-yellow-400',
      shadow: 'shadow-yellow-100',
    };
  };

  // Run Gemini AI Cohort Analysis
  const handleTriggerAiAnalysis = async () => {
    if (criticalCohort.length === 0) return;
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/ai/critical-triage-cohort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criticalPatients: criticalCohort }),
      });
      const res = await response.json();
      if (res.success && res.data) {
        setAiCohortData(res.data);
        const now = new Date();
        setLastAnalyzedTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`);
      }
    } catch (err) {
      console.error('Error fetching AI critical cohort triage:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Filtered patients for the dashboard
  const displayedPatients = useMemo(() => {
    return criticalCohort.filter((p) => {
      const tierInfo = getHeuristicTriageTier(p);
      if (activeFilter === 'P1') return tierInfo.tier === 'P1';
      if (activeFilter === 'VASOPRESSOR') return p.tags.includes('VASOPRESSOR');
      if (activeFilter === 'O2') return p.tags.includes('O2_MASK') || p.tags.includes('O2_CANULA') || p.tags.includes('O2');
      if (activeFilter === 'CARDIO') return ['733', '735', '737', '739', '741', '743', '745'].includes(p.roomNumber);
      return true;
    });
  }, [criticalCohort, activeFilter]);

  // Overall quick statistics
  const p1Count = criticalCohort.filter((p) => getHeuristicTriageTier(p).tier === 'P1').length;
  const vasoCount = criticalCohort.filter((p) => p.tags.includes('VASOPRESSOR')).length;
  const o2Count = criticalCohort.filter((p) => p.tags.includes('O2_MASK') || p.tags.includes('O2_CANULA') || p.tags.includes('O2')).length;

  if (criticalCohort.length === 0) {
    return (
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 rounded-2xl border border-emerald-200 p-3 sm:px-5 flex items-center justify-between text-xs shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <span className="font-black text-emerald-900 uppercase text-[11px] tracking-wide">
              Bảng Giám Sát Lâm Sàng AI:
            </span>
            <span className="text-emerald-700 ml-1.5 font-semibold">
              Hiện tại khoa không có ca báo động đỏ hoặc suy hô hấp/tuần hoàn nguy kịch. Mọi chỉ số đang trong giới hạn kiểm soát.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-rose-400 shadow-md overflow-hidden transition-all duration-200">
      {/* Top Banner Header: Always visible */}
      <div className="bg-gradient-to-r from-slate-950 via-rose-950 to-slate-900 text-white p-3 sm:px-5 flex flex-wrap items-center justify-between gap-3 border-b border-rose-900/60">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white shadow-md">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900 animate-ping" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider bg-rose-500/30 text-rose-200 px-2 py-0.5 rounded border border-rose-400/40">
                AI Clinical Triage • Giám Sát Ca Nguy Kịch
              </span>
              <span className="text-[11px] font-bold text-rose-300">
                Phát hiện <strong className="text-white underline">{criticalCohort.length} ca</strong> cần theo dõi sát sao
              </span>
              {p1Count > 0 && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-rose-600 text-white flex items-center gap-1 shadow-2xs">
                  <Flame className="w-3 h-3 animate-bounce" />
                  {p1Count} ca P1 Báo Động Đỏ
                </span>
              )}
              {vasoCount > 0 && (
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500 text-slate-950">
                  {vasoCount} Vận mạch
                </span>
              )}
            </div>
            <h2 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-2 mt-0.5">
              <span>BẢNG ĐIỀU KHIỂN AI PHÂN TÍCH NHANH CÁC CA NGUY KỊCH & BÁO ĐỘNG ĐỎ</span>
              <span className="text-[10px] text-slate-400 font-normal hidden lg:inline">
                (Tự động tính Chỉ số sốc, MAP, qSOFA & Khuyến nghị cấp cứu AI)
              </span>
            </h2>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={handleTriggerAiAnalysis}
            disabled={isAnalyzing}
            className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-extrabold text-xs shadow-md transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
            title="Sử dụng mô hình AI Gemini phân tích toàn diện rủi ro lâm sàng và hành động khẩn cấp cho tất cả ca nguy kịch"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>AI Đang Phân Tích...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-300 group-hover:rotate-12 transition-transform" />
                <span>⚡ AI Phân Tích Chuyên Sâu</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            title={isExpanded ? 'Thu gọn bảng điều khiển' : 'Mở rộng bảng điều khiển'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Content View */}
      {isExpanded && (
        <div className="p-3 sm:p-4 bg-slate-50/70 space-y-3">
          {/* AI Cohort Overall Summary (When AI has run) */}
          {aiCohortData && (
            <div className="bg-gradient-to-br from-rose-50 via-amber-50 to-white rounded-xl border border-rose-300 p-3 sm:p-4 shadow-xs animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                    <span className="text-xs font-black uppercase text-rose-900 tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-rose-600" />
                      Nhận định AI Cố Vấn Lâm Sàng BV Hùng Vương Gia Lai:
                    </span>
                    {lastAnalyzedTime && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        (Cập nhật lúc {lastAnalyzedTime})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-800 font-bold leading-relaxed">
                    {aiCohortData.summary}
                  </p>
                </div>

                {/* Key Urgent Actions list */}
                {aiCohortData.keyUrgentActions && aiCohortData.keyUrgentActions.length > 0 && (
                  <div className="bg-white/90 rounded-lg p-2.5 border border-rose-200 shadow-2xs md:max-w-md w-full shrink-0">
                    <span className="text-[10px] font-black uppercase text-rose-800 flex items-center gap-1 mb-1">
                      <BellRing className="w-3 h-3 text-rose-600" />
                      Hành động cấp bách kíp trực cần làm ngay:
                    </span>
                    <ul className="space-y-1 text-[11px] text-slate-700 font-semibold list-disc list-inside">
                      {aiCohortData.keyUrgentActions.slice(0, 3).map((act, i) => (
                        <li key={i} className="line-clamp-1">{act}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Filter Sub-Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase mr-1">Phân loại:</span>
              
              <button
                type="button"
                onClick={() => setActiveFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeFilter === 'ALL'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Tất cả ca nguy kịch ({criticalCohort.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('P1')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  activeFilter === 'P1'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                }`}
              >
                <Flame className="w-3 h-3" />
                <span>P1 Báo Động Đỏ ({p1Count})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('VASOPRESSOR')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  activeFilter === 'VASOPRESSOR'
                    ? 'bg-red-700 text-white shadow-2xs'
                    : 'bg-red-50 text-red-800 border border-red-200 hover:bg-red-100'
                }`}
              >
                <HeartPulse className="w-3 h-3" />
                <span>Vận Mạch ({vasoCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('O2')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  activeFilter === 'O2'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
                }`}
              >
                <Wind className="w-3 h-3" />
                <span>Thở Oxy ({o2Count})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('CARDIO')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeFilter === 'CARDIO'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100'
                }`}
              >
                Khu Tim Mạch (P.733-745)
              </button>
            </div>

            <div className="text-[11px] text-slate-500 font-medium">
              Nhấp vào từng bệnh nhân để mở bệnh án & hội chẩn
            </div>
          </div>

          {/* Cards Grid: 1 to 3 columns depending on screen size */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {displayedPatients.map((patient) => {
              const tierInfo = getHeuristicTriageTier(patient);
              const indices = getClinicalIndices(patient);
              const doc = doctorMap.get(patient.attendingDoctorId);
              const docShort = doc ? getDoctorShortName(doc) : 'Chưa phân công';
              const aiAnalysis = aiCohortData?.patientAnalyses?.find((a) => a.patientId === patient.id);
              const panicLabs = (patient.labs || []).filter((l) => l.isPanicValue || l.isAbnormal);
              const latestVital = patient.vitals?.[0];

              return (
                <div
                  key={patient.id}
                  className={`bg-white rounded-xl border-2 ${tierInfo.border} shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden relative group`}
                >
                  {/* Card Header */}
                  <div className={`p-2.5 bg-gradient-to-r ${tierInfo.color} text-white flex items-center justify-between`}>
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="px-2 py-0.5 rounded bg-black/30 font-black text-xs shrink-0 tracking-tight">
                        P.{patient.roomNumber} - {patient.bedNumber}
                      </span>
                      <span className="font-black text-sm truncate" title={patient.fullName}>
                        {formatPatientDisplayName(patient.fullName)}
                      </span>
                      <span className="text-xs opacity-90 shrink-0 font-medium">
                        ({patient.gender === 'Nam' ? '♂ Nam' : '♀ Nữ'}, {patient.age}t)
                      </span>
                    </div>

                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white text-slate-900 shrink-0 shadow-2xs">
                      {tierInfo.label}
                    </span>
                  </div>

                  {/* Body Content */}
                  <div className="p-3 space-y-2.5 flex-1">
                    {/* Diagnosis & Attending Doctor */}
                    <div className="space-y-1">
                      <p className="text-xs font-black text-slate-900 leading-snug line-clamp-2">
                        {patient.primaryDiagnosis}
                      </p>
                      {patient.secondaryDiagnosis && (
                        <p className="text-[10px] text-slate-500 font-medium truncate">
                          Kèm: {patient.secondaryDiagnosis}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                        <span className="flex items-center gap-1">
                          <Stethoscope className="w-3 h-3 text-rose-600" />
                          <span>BS ĐT: <strong className="text-slate-800">{docShort}</strong></span>
                        </span>
                        <span className="font-mono text-slate-400">{patient.medicalRecordNumber}</span>
                      </div>
                    </div>

                    {/* Real-time Vital & Warning Indicators Bar */}
                    {latestVital && (
                      <div className="grid grid-cols-4 gap-1 p-2 rounded-lg bg-slate-100 border border-slate-200 text-center">
                        <div className="space-y-0.5">
                          <span className="text-[9px] text-slate-500 block">Huyết áp</span>
                          <span className={`text-[11px] font-black ${
                            indices?.isHypotensive || indices?.isHypertensiveCrisis ? 'text-rose-700 underline font-extrabold' : 'text-slate-900'
                          }`}>
                            {latestVital.bpSystolic}/{latestVital.bpDiastolic}
                          </span>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[9px] text-slate-500 block">Mạch</span>
                          <span className={`text-[11px] font-black ${
                            indices?.isSevereTachy || indices?.isBrady ? 'text-rose-700 underline font-extrabold' : 'text-slate-900'
                          }`}>
                            {latestVital.heartRate} l/p
                          </span>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[9px] text-slate-500 block">SpO2</span>
                          <span className={`text-[11px] font-black ${
                            indices?.isHypoxia ? 'text-rose-700 underline font-extrabold' : 'text-cyan-800'
                          }`}>
                            {latestVital.spO2}%
                          </span>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[9px] text-slate-500 block" title="Chỉ số sốc = Mạch / HA tâm thu (Báo động khi >= 0.9)">
                            Chỉ số sốc
                          </span>
                          <span className={`text-[11px] font-black ${
                            indices?.isShockIndexAlarm ? 'text-rose-700 bg-rose-100 px-1 rounded animate-pulse' : 'text-slate-700'
                          }`}>
                            {indices?.shockIndex || '--'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Specific Clinical Tags */}
                    <div className="flex flex-wrap items-center gap-1">
                      {patient.tags.includes('VASOPRESSOR') && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-600 text-white flex items-center gap-0.5 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          Vận mạch (Vasopressor)
                        </span>
                      )}
                      {patient.tags.includes('O2_MASK') && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-600 text-white">
                          Thở Mask
                        </span>
                      )}
                      {(patient.tags.includes('O2_CANULA') || patient.tags.includes('O2')) && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-cyan-600 text-white">
                          Thở Canula
                        </span>
                      )}
                      {patient.tags.includes('FLUID_BALANCE') && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-indigo-600 text-white">
                          TD Dịch Vào/Ra
                        </span>
                      )}
                      {indices?.isMapLow && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500 text-slate-950">
                          MAP &lt; 65 mmHg
                        </span>
                      )}
                    </div>

                    {/* Panic Labs Warning */}
                    {panicLabs.length > 0 && (
                      <div className="text-[10px] bg-rose-50 border border-rose-200 text-rose-900 rounded-md p-1.5 space-y-0.5">
                        <span className="font-extrabold flex items-center gap-1 text-[10px] text-rose-700">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          Cận lâm sàng báo động:
                        </span>
                        <div className="text-slate-800 font-semibold line-clamp-2">
                          {panicLabs.map((l) => `${l.testName}: ${l.value} ${l.unit}`).join(' • ')}
                        </div>
                      </div>
                    )}

                    {/* AI Personalized Insight Block (If generated) */}
                    {aiAnalysis ? (
                      <div className="bg-gradient-to-br from-amber-50 to-rose-50 border border-amber-300 rounded-lg p-2 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-rose-900 font-black text-[11px]">
                          <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                          <span className="truncate">{aiAnalysis.clinicalHeadline}</span>
                        </div>
                        <p className="text-[10px] text-slate-800 leading-tight">
                          {aiAnalysis.rapidAssessment}
                        </p>
                        {aiAnalysis.urgentActions && aiAnalysis.urgentActions.length > 0 && (
                          <div className="pt-1 border-t border-amber-200/80">
                            <span className="text-[9px] font-black uppercase text-amber-900 block mb-0.5">
                              Xử trí khuyến nghị tức thì:
                            </span>
                            <ul className="text-[10px] text-slate-700 list-disc list-inside font-semibold space-y-0.5">
                              {aiAnalysis.urgentActions.slice(0, 2).map((act, i) => (
                                <li key={i}>{act}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Heuristic Quick Guidance before AI trigger */
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-[10px] text-slate-600 space-y-1">
                        <span className="font-bold text-slate-800 flex items-center gap-1">
                          <Activity className="w-3 h-3 text-rose-600" />
                          Hướng dẫn theo dõi trọng tâm ca trực:
                        </span>
                        <p className="leading-tight text-slate-700">
                          {patient.tags.includes('VASOPRESSOR')
                            ? 'Duy trì đường truyền TW, đo HA xâm lấn hoặc đo HA mỗi 15-30p, kiểm tra tưới máu đầu chi.'
                            : patient.tags.includes('O2_MASK')
                            ? 'Theo dõi sát độ bão hòa oxy máu, tần số thở, khí máu động mạch nếu SpO2 không cải thiện.'
                            : 'Theo dõi sát diễn tiến tri giác, SpO2, nước tiểu và báo ngay BS trực khi sinh hiệu bất thường.'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Button to open full patient file */}
                  <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-slate-500 truncate">
                      {patient.evolutions?.[0] ? `Diễn tiến: ${patient.evolutions[0].treatmentAction}` : 'Đang điều trị nội trú'}
                    </span>

                    <button
                      type="button"
                      onClick={() => onSelectPatient(patient)}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[11px] flex items-center gap-1 shrink-0 shadow-2xs transition-colors cursor-pointer"
                    >
                      <span>Hồ sơ & Y lệnh</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

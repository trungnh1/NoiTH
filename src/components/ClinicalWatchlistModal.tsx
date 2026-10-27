import React from 'react';
import { Patient, Doctor, CLINICAL_TAGS_META } from '../types/patient';
import { 
  X, 
  ShieldAlert, 
  AlertTriangle, 
  HeartPulse, 
  Wind, 
  Eye, 
  FileText,
  Activity
} from 'lucide-react';

interface ClinicalWatchlistModalProps {
  patients: Patient[];
  doctors: Doctor[];
  onClose: () => void;
  onSelectPatient: (patient: Patient) => void;
}

export const ClinicalWatchlistModal: React.FC<ClinicalWatchlistModalProps> = ({
  patients,
  doctors,
  onClose,
  onSelectPatient,
}) => {
  const doctorMap = React.useMemo(() => {
    return new Map<string, Doctor>(doctors.map((d) => [d.id, d]));
  }, [doctors]);

  // High-risk patients: CRITICAL, or VASOPRESSOR, or PANIC LABS
  const highRiskPatients = patients.filter((p) => {
    if (p.status !== 'ACTIVE') return false;
    const isCrit = p.severity === 'CRITICAL';
    const isVaso = p.tags.includes('VASOPRESSOR');
    const hasPanicLab = p.labs.some((l) => l.isPanicValue);
    const isCloseMon = p.tags.includes('CLOSE_MONITORING');
    return isCrit || isVaso || hasPanicLab || isCloseMon;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-2xl w-full max-w-7xl w-[96vw] shadow-2xl border border-rose-300 overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in">
        
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-rose-900 via-rose-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white shadow-md animate-pulse">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase bg-rose-500/30 text-rose-200 px-2 py-0.5 rounded border border-rose-400/30">
                  Giám sát trọng điểm
                </span>
                <span className="text-xs text-rose-200">
                  {highRiskPatients.length} ca nguy cơ cao
                </span>
              </div>
              <h2 className="text-lg font-black tracking-tight">
                Cảnh Báo Đỏ & Danh Sách Bệnh Nhân Cần Theo Dõi Sát
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Watchlist Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 bg-slate-50/50">
          {highRiskPatients.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <p className="text-sm font-bold text-slate-600">
                Hiện tại không có ca bệnh nặng hoặc báo động đỏ trong khoa.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {highRiskPatients.map((patient) => {
                const doctor = doctorMap.get(patient.attendingDoctorId);
                const latestVital = patient.vitals?.[0];
                const panicLabs = patient.labs.filter((l) => l.isPanicValue);

                return (
                  <div
                    key={patient.id}
                    className="bg-white rounded-xl p-4 border border-rose-200 shadow-xs hover:border-rose-400 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-black text-xs">
                          {patient.roomNumber} - {patient.bedNumber}
                        </span>
                        <h4
                          onClick={() => {
                            onClose();
                            onSelectPatient(patient);
                          }}
                          className="font-black text-slate-900 hover:text-rose-600 cursor-pointer text-sm"
                        >
                          {patient.fullName} ({patient.gender}, {patient.age}t)
                        </h4>
                        <span className="text-xs font-mono text-slate-400">
                          {patient.medicalRecordNumber}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          patient.severity === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          {patient.severity === 'CRITICAL' ? 'NẶNG' : 'TRUNG BÌNH'}
                        </span>
                      </div>

                      <p className="text-xs font-bold text-slate-800">
                        {patient.primaryDiagnosis}
                      </p>

                      {/* Doctor info */}
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span>BS điều trị: <b className="text-slate-800">{doctor?.name}</b></span>
                        <span>• ĐD: <b className="text-slate-700">{patient.primaryNurse}</b></span>
                      </div>

                      {/* Panic lab values alert */}
                      {panicLabs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {panicLabs.map((l) => (
                            <span
                              key={l.id}
                              className="text-[10px] font-black px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1"
                            >
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              Báo động: {l.testName} = {l.value} {l.unit}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Clinical tags */}
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {patient.tags.map((tagKey) => {
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

                    {/* Vitals + Action */}
                    <div className="flex items-center justify-between md:flex-col md:items-end gap-2 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100 shrink-0">
                      {latestVital && (
                        <div className="text-xs text-right">
                          <div className="font-extrabold text-slate-900">
                            HA: <span className={latestVital.bpSystolic < 90 || latestVital.bpSystolic > 160 ? 'text-rose-600 font-black' : ''}>{latestVital.bpSystolic}/{latestVital.bpDiastolic}</span> mmHg
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Mạch: <b>{latestVital.heartRate}</b> | SpO₂: <b className={latestVital.spO2 < 94 ? 'text-rose-600 font-black' : 'text-emerald-700'}>{latestVital.spO2}%</b>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          onClose();
                          onSelectPatient(patient);
                        }}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Mở bệnh án</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

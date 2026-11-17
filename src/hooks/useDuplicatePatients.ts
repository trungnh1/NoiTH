import { useState, useMemo, useCallback } from 'react';
import { Patient } from '../types/patient';
import { findDuplicatePatientGroups } from '../utils/excelParser';

interface UseDuplicatePatientsProps {
  patients: Patient[];
  onUpdatePatient: (patient: Patient) => Promise<void>;
  onDeletePatient: (patient: Patient) => Promise<void>;
}

export function useDuplicatePatients({
  patients,
  onUpdatePatient,
  onDeletePatient,
}: UseDuplicatePatientsProps) {
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

  const [dismissedDuplicatePairs, setDismissedDuplicatePairs] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('HUNG_VUONG_DISMISSED_DUPLICATE_PAIRS');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const handleDismissDuplicatePair = useCallback((idA: string, idB: string) => {
    const pairKey = [idA, idB].sort().join('::');
    setDismissedDuplicatePairs((prev) => {
      const next = new Set(prev).add(pairKey);
      try {
        localStorage.setItem('HUNG_VUONG_DISMISSED_DUPLICATE_PAIRS', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }, []);

  const duplicatePatientGroups = useMemo(() => {
    return findDuplicatePatientGroups(patients, dismissedDuplicatePairs);
  }, [patients, dismissedDuplicatePairs]);

  const handleMergePatients = useCallback(async (primary: Patient, duplicate: Patient) => {
    const existingEvoIds = new Set((primary.evolutions || []).map((e) => e.id));
    const newEvolutions = (duplicate.evolutions || []).filter((e) => !existingEvoIds.has(e.id));

    const existingVitalIds = new Set((primary.vitals || []).map((v) => v.id));
    const newVitals = (duplicate.vitals || []).filter((v) => !existingVitalIds.has(v.id));

    const existingLabIds = new Set((primary.labs || []).map((l) => l.id));
    const newLabs = (duplicate.labs || []).filter((l) => !existingLabIds.has(l.id));

    const updatedPrimary: Patient = {
      ...primary,
      evolutions: [...(primary.evolutions || []), ...newEvolutions],
      vitals: [...(primary.vitals || []), ...newVitals],
      labs: [...(primary.labs || []), ...newLabs],
      primaryDiagnosis: primary.primaryDiagnosis || duplicate.primaryDiagnosis,
      attendingDoctorId: primary.attendingDoctorId || duplicate.attendingDoctorId,
      treatmentPlan: primary.treatmentPlan || duplicate.treatmentPlan,
    };

    await onUpdatePatient(updatedPrimary);
    await onDeletePatient(duplicate);
  }, [onUpdatePatient, onDeletePatient]);

  return {
    isDuplicateModalOpen,
    setIsDuplicateModalOpen,
    duplicatePatientGroups,
    handleDismissDuplicatePair,
    handleMergePatients,
  };
}

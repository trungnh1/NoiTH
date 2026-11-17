import { useState, useEffect, useMemo, useCallback } from 'react';
import { Patient, Doctor, DepartmentRoom } from '../types/patient';
import { 
  loadPatients, 
  savePatients, 
  loadDoctors, 
  loadRooms, 
  formatPatientDisplayName 
} from '../utils/storage';
import { isRealAllergy } from '../utils/clinicalTextParser';
import { isSameClinicalPatient, extractCleanRoomNumber } from '../utils/excelParser';
import { normalizeSearchText } from '../utils/searchUtils';
import { 
  isDischargedOnNov16, 
  restoreDischargedPatient, 
  isAdmittedBeforeNov10, 
  dischargePatientRecord 
} from '../utils/dischargeUtils';
import { 
  subscribeToClinicalRecords, 
  checkSatelliteRecordCompleteness, 
  mapClinicalRecordToPatient, 
  ClinicalRecord,
  loadPendingSatelliteRecords,
  savePendingSatelliteRecords,
  dismissPendingSatelliteRecord,
  deletePendingSatelliteRecord,
  deleteSatelliteRecord,
  parseAgeNumber
} from '../services/clinicalFirebase';
import { 
  subscribeToDepartmentPatients,
  syncPatientToCloud,
  deletePatientFromCloud,
  deleteAllPatientsFromCloud,
  syncAllPatientsToCloud, 
  SyncStatus,
  syncDismissedSatelliteRecordToCloud,
  subscribeToDismissedSatelliteRecords,
  cleanupOldFirestoreData
} from '../services/firebaseSync';
import { AppSettings } from '../utils/settings';

interface UseWardDataProps {
  authenticatedDoctor: Doctor | null;
  appSettings: AppSettings;
  onPatientRemoved?: (patientId: string) => void;
  onPatientUpdated?: (patient: Patient) => void;
}

export function useWardData({
  authenticatedDoctor,
  appSettings,
  onPatientRemoved,
  onPatientUpdated,
}: UseWardDataProps) {
  // 1. Initial State
  const [patients, setPatients] = useState<Patient[]>(() => {
    let list = loadPatients();

    // Tự động cho ra viện tất cả bệnh nhân vào viện trước ngày 10/11 theo yêu cầu
    const beforeNov10Pats = list.filter((p) => p.status !== 'DISCHARGED' && isAdmittedBeforeNov10(p));
    if (beforeNov10Pats.length > 0) {
      const dischargeIds = new Set(beforeNov10Pats.map((p) => p.id));
      const nowIso = new Date().toISOString();
      list = list.map((p) => {
        if (dischargeIds.has(p.id)) {
          return dischargePatientRecord(p, nowIso);
        }
        return p;
      });
      savePatients(list);
      beforeNov10Pats.forEach((p) => {
        syncPatientToCloud(dischargePatientRecord(p, nowIso)).catch(() => {});
      });
    }

    return list;
  });

  const [doctors, setDoctors] = useState<Doctor[]>(() => loadDoctors());
  const [rooms, setRooms] = useState<DepartmentRoom[]>(() => loadRooms());

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    connected: false,
    lastSyncTime: null,
    receivedCount: 0,
    errorMessage: null,
  });
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [lastAutoSyncTime, setLastAutoSyncTime] = useState<string | null>(null);
  const [emergencyAlert, setEmergencyAlert] = useState<{ message: string; patient: Patient } | null>(null);
  const [pendingSatelliteRecords, setPendingSatelliteRecords] = useState<ClinicalRecord[]>(() => loadPendingSatelliteRecords());
  const [manualPushMessage, setManualPushMessage] = useState<string | null>(null);

  const [roomDoctorAssignments, setRoomDoctorAssignments] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('ROOM_DOCTOR_ASSIGNMENTS') || '{}');
    } catch {
      return {};
    }
  });

  // 2. Computed Discharged Patients
  const dischargedPatients = useMemo(() => {
    return patients.filter((p) => p.status === 'DISCHARGED');
  }, [patients]);

  const beforeNov10DischargedCount = useMemo(() => {
    return dischargedPatients.filter(isAdmittedBeforeNov10).length;
  }, [dischargedPatients]);

  const activeBeforeNov10Count = useMemo(() => {
    return patients.filter((p) => p.status !== 'DISCHARGED' && isAdmittedBeforeNov10(p)).length;
  }, [patients]);

  const nov16DischargedCount = useMemo(() => {
    return dischargedPatients.filter(isDischargedOnNov16).length;
  }, [dischargedPatients]);

  // 3. Cleanup Old Firestore Data (older than 15 days)
  const handleCleanupOldFirestoreData = useCallback(async () => {
    try {
      const res = await cleanupOldFirestoreData(15);
      if (res.success) {
        localStorage.setItem('HVG_LAST_FIRESTORE_CLEANUP_TS', String(Date.now()));
        if (res.totalDeleted > 0 || res.prunedVitalsCount > 0) {
          let isDoc00979 = authenticatedDoctor?.id === '00979';
          if (!isDoc00979) {
            try {
              const raw = localStorage.getItem('HVGL_CURRENT_DOCTOR_SESSION');
              if (raw) {
                const session = JSON.parse(raw);
                if (session?.id === '00979') isDoc00979 = true;
              }
            } catch {
              // ignore
            }
          }

          if (isDoc00979) {
            const parts: string[] = [];
            if (res.deletedPatientsCount > 0) parts.push(`${res.deletedPatientsCount} BN ra viện`);
            if (res.deletedDismissedCount > 0) parts.push(`${res.deletedDismissedCount} ca vệ tinh đã xử lý`);
            if (res.deletedProbeCount > 0) parts.push(`${res.deletedProbeCount} dữ liệu thử nghiệm`);
            if (res.prunedVitalsCount > 0) parts.push(`${res.prunedVitalsCount} chỉ số sinh hiệu cũ`);
            
            setManualPushMessage(`🧹 Đã dọn dẹp Firestore: Đã xóa ${res.totalDeleted} bản ghi cũ (> 15 ngày) (${parts.join(', ')}) để tối ưu dung lượng!`);
            setTimeout(() => setManualPushMessage(null), 8000);
          }
        }
      }
    } catch (err: any) {
      console.warn('Lỗi dọn dẹp dữ liệu cũ Firestore:', err);
    }
  }, [authenticatedDoctor?.id]);

  // 4. Realtime 2-way Cloud Firestore Sync & Background Satellite Listener
  useEffect(() => {
    // 1. Automatic continuous 2-way sync for Inpatients in Khoa Nội Tổng Hợp
    const unsubDept = subscribeToDepartmentPatients(
      (cloudPatients) => {
        if (!cloudPatients) {
          setPatients([]);
          return;
        }
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        
        let normalized = cloudPatients.map((p) => {
          if (p.admissionStatus === 'DISCHARGE_TOMORROW' && p.dischargeTomorrowSetDate && p.dischargeTomorrowSetDate < todayStr) {
            const updated: Patient = {
              ...p,
              admissionStatus: 'DISCHARGE_TODAY',
              dischargeTomorrowSetDate: undefined,
            };
            syncPatientToCloud(updated).catch(() => {});
            return updated;
          }
          return p;
        });

        // Tự động cho ra viện tất cả bệnh nhân vào viện trước ngày 10/11 theo yêu cầu
        const beforeNov10Cloud = normalized.filter((p) => p.status !== 'DISCHARGED' && isAdmittedBeforeNov10(p));
        if (beforeNov10Cloud.length > 0) {
          console.info(`[Auto-Discharge] Phát hiện ${beforeNov10Cloud.length} ca vào viện trước ngày 10/11. Đang cho ra viện...`);
          const dischargeIds = new Set(beforeNov10Cloud.map((p) => p.id));
          const nowIso = new Date().toISOString();
          normalized = normalized.map((p) => {
            if (dischargeIds.has(p.id)) {
              return dischargePatientRecord(p, nowIso);
            }
            return p;
          });
          beforeNov10Cloud.forEach((p) => {
            syncPatientToCloud(dischargePatientRecord(p, nowIso)).catch(() => {});
          });
          const names = beforeNov10Cloud.slice(0, 3).map((p) => p.fullName).join(', ') + 
            (beforeNov10Cloud.length > 3 ? ` và ${beforeNov10Cloud.length - 3} BN khác` : '');
          setManualPushMessage(`🚪 Đã cho ra viện ${beforeNov10Cloud.length} bệnh nhân vào viện trước ngày 10/11 (${names})!`);
          setTimeout(() => setManualPushMessage(null), 8000);
        }

        setPatients(normalized);
        savePatients(normalized);
        setLastAutoSyncTime(new Date().toLocaleTimeString('vi-VN'));
      },
      (status) => {
        setSyncStatus(status);
        if (status.connected && status.lastSyncTime) {
          setLastAutoSyncTime(status.lastSyncTime);
        }
      }
    );

    // 2. Lắng nghe thời gian thực danh sách ca vệ tinh đã bấm Bỏ Qua / Đã Xóa từ Cloud Firestore của Khoa
    let unsubDismissed: (() => void) | undefined;
    try {
      if (typeof subscribeToDismissedSatelliteRecords === 'function') {
        unsubDismissed = subscribeToDismissedSatelliteRecords((cloudDismissedIds) => {
          if (!cloudDismissedIds || cloudDismissedIds.length === 0) return;
          try {
            const localDeleted: string[] = JSON.parse(localStorage.getItem('DELETED_SATELLITE_IDS') || '[]');
            let changed = false;
            cloudDismissedIds.forEach((id) => {
              if (!localDeleted.includes(id)) {
                localDeleted.push(id);
                changed = true;
              }
            });
            if (changed) {
              localStorage.setItem('DELETED_SATELLITE_IDS', JSON.stringify(localDeleted));
            }

            // Lọc ngay khỏi pendingSatelliteRecords trong bộ nhớ
            setPendingSatelliteRecords((prev) => {
              return prev.filter((r) => {
                const rId = r.id;
                const rName = (r.patientName || r.fullName || '').trim().toLowerCase();
                const normName = normalizeSearchText(rName);
                if (cloudDismissedIds.includes(rId) || (rName && cloudDismissedIds.includes(rName)) || (normName && cloudDismissedIds.includes(normName))) {
                  return false;
                }
                return true;
              });
            });
          } catch (e) {
            console.warn('Lỗi đồng bộ dismissed satellite từ Cloud:', e);
          }
        });
      }
    } catch (e) {
      console.warn('Lỗi khởi tạo subscribeToDismissedSatelliteRecords:', e);
    }

    // 3. Tự động kiểm tra và dọn dẹp dữ liệu Cloud Firestore cũ quá 15 ngày định kỳ
    const lastCleanupTs = Number(localStorage.getItem('HVG_LAST_FIRESTORE_CLEANUP_TS') || '0');
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
    let timerCleanup: any;
    if (Date.now() - lastCleanupTs > TWELVE_HOURS_MS) {
      timerCleanup = setTimeout(() => {
        handleCleanupOldFirestoreData();
      }, 5000);
    }

    // 4. Real-time background subscriber to Satellite Cloud Firestore
    let unsubSatellite: (() => void) | undefined;
    const timerSatellite = setTimeout(() => {
      unsubSatellite = subscribeToClinicalRecords((satelliteRecords) => {
        if (!satelliteRecords || satelliteRecords.length === 0) {
          return;
        }

        try {
          localStorage.setItem('CACHED_SATELLITE_RECORDS', JSON.stringify(satelliteRecords));
        } catch (e) {
          console.warn(e);
        }

        let processedIds: string[] = [];
        try {
          processedIds = JSON.parse(localStorage.getItem('PROCESSED_SATELLITE_IDS') || '[]');
        } catch (e) {
          console.warn(e);
        }

        let deletedIds: string[] = [];
        try {
          deletedIds = JSON.parse(localStorage.getItem('DELETED_SATELLITE_IDS') || '[]');
        } catch (e) {
          console.warn(e);
        }

        const currentPatientsList = loadPatients();
        const activeInpatients = currentPatientsList.filter((p) => p.status === 'ACTIVE');
        const pendingQueue: ClinicalRecord[] = [];

        satelliteRecords.forEach((rec) => {
          const recordId = rec.id;
          const nameRaw = (rec.patientName || rec.fullName || '').trim();
          const nameKey = nameRaw.toLowerCase();
          const normRecName = normalizeSearchText(nameRaw);

          if (
            deletedIds.includes(recordId) ||
            processedIds.includes(recordId) ||
            (nameKey && (deletedIds.includes(nameKey) || processedIds.includes(nameKey))) ||
            (normRecName && (deletedIds.includes(normRecName) || processedIds.includes(normRecName)))
          ) {
            return;
          }

          const recAge = parseAgeNumber(rec.patientAge || rec.age);
          const alreadyInDeptPatient = activeInpatients.find((p) => {
            const normPName = normalizeSearchText(p.fullName);
            if (!normPName || !normRecName) return false;

            if (normPName === normRecName) return true;
            if (p.id === recordId || (p.patientCode && p.patientCode === recordId)) return true;

            if (normRecName.length >= 5 && (normPName.includes(normRecName) || normRecName.includes(normPName))) {
              if (!recAge || !p.age || Math.abs(recAge - p.age) <= 3) {
                return true;
              }
            }
            return false;
          });

          if (alreadyInDeptPatient) {
            if (!processedIds.includes(recordId)) processedIds.push(recordId);
            if (nameKey && !processedIds.includes(nameKey)) processedIds.push(nameKey);
            if (normRecName && !processedIds.includes(normRecName)) processedIds.push(normRecName);
            return;
          }

          const completeness = checkSatelliteRecordCompleteness(rec);

          if (completeness.isComplete) {
            const name = nameKey;
            const rawRoom = String(rec.patientRoom || rec.roomNumber || '').replace(/\D/g, '');

            const alreadyInDept = currentPatientsList.some((p) => {
              const pName = p.fullName.toLowerCase().trim();
              const pRoom = p.roomNumber.replace(/\D/g, '');
              return pName === name && (pRoom === rawRoom || !rawRoom);
            });

            if (!alreadyInDept) {
              const currentDocs = loadDoctors();
              const currentDocSession = authenticatedDoctor;
              const mappedPatient = mapClinicalRecordToPatient(rec, currentDocs, loadRooms(), currentDocSession?.id);
              
              setPatients((prev) => {
                if (prev.some((p) => p.id === mappedPatient.id || p.fullName.toLowerCase() === name)) {
                  return prev;
                }
                const updated = [mappedPatient, ...prev];
                savePatients(updated);
                syncPatientToCloud(mappedPatient).catch(console.warn);
                return updated;
              });

              processedIds.push(recordId);
              try {
                localStorage.setItem('PROCESSED_SATELLITE_IDS', JSON.stringify(processedIds));
              } catch (e) {
                console.warn(e);
              }

              setEmergencyAlert({
                message: `🎉 Tự động tiếp nhận Bệnh nhân mới từ Vệ Tinh: ${mappedPatient.fullName} (${mappedPatient.age}t, ${mappedPatient.gender}) -> Phòng ${mappedPatient.roomNumber}`,
                patient: mappedPatient,
              });
            }
          } else {
            pendingQueue.push(rec);
          }
        });

        try {
          localStorage.setItem('PROCESSED_SATELLITE_IDS', JSON.stringify(processedIds));
        } catch (e) {
          console.warn(e);
        }

        setPendingSatelliteRecords(pendingQueue);
        savePendingSatelliteRecords(pendingQueue);
      });
    }, 1200);

    return () => {
      if (timerCleanup) clearTimeout(timerCleanup);
      clearTimeout(timerSatellite);
      unsubDept();
      if (typeof unsubSatellite === 'function') unsubSatellite();
      if (typeof unsubDismissed === 'function') unsubDismissed();
    };
  }, [handleCleanupOldFirestoreData, authenticatedDoctor]);

  // 5. Unload guard & periodic refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isAutoSyncing || syncStatus.errorMessage) {
        e.preventDefault();
        e.returnValue = 'Dữ liệu chưa đồng bộ hoàn tất lên Cloud. Bạn có chắc chắn muốn rời khỏi trang không?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isAutoSyncing, syncStatus.errorMessage]);

  useEffect(() => {
    if (!appSettings.autoRefreshInterval || appSettings.autoRefreshInterval <= 0) return;
    const timer = setInterval(() => {
      setPendingSatelliteRecords(loadPendingSatelliteRecords());
    }, appSettings.autoRefreshInterval * 1000);
    return () => clearInterval(timer);
  }, [appSettings.autoRefreshInterval]);

  // 6. Core Patient Mutation Methods
  const updatePatientsList = useCallback(async (newPatients: Patient[]) => {
    setPatients(newPatients);
    savePatients(newPatients);
    setIsAutoSyncing(true);
    try {
      await syncAllPatientsToCloud(newPatients);
      setLastAutoSyncTime(new Date().toLocaleTimeString('vi-VN'));
    } catch (err: any) {
      console.warn('Auto sync cloud error:', err);
      setManualPushMessage(`❌ Lỗi đồng bộ Cloud tự động: ${err.message || String(err)}`);
      setTimeout(() => setManualPushMessage(null), 10000);
    } finally {
      setIsAutoSyncing(false);
    }
  }, []);

  const handleUpdatePatient = useCallback(async (updatedPatient: Patient) => {
    setPatients((prev) => {
      const updated = prev.map((p) => (p.id === updatedPatient.id ? updatedPatient : p));
      savePatients(updated);
      return updated;
    });
    if (onPatientUpdated) onPatientUpdated(updatedPatient);

    setIsAutoSyncing(true);
    try {
      await syncPatientToCloud(updatedPatient);
      setLastAutoSyncTime(new Date().toLocaleTimeString('vi-VN'));
    } catch (err: any) {
      console.warn('Auto sync single patient error:', err);
      setManualPushMessage(`❌ Lỗi đồng bộ bệnh nhân lên Cloud: ${err.message || String(err)}`);
      setTimeout(() => setManualPushMessage(null), 10000);
    } finally {
      setIsAutoSyncing(false);
    }
  }, [onPatientUpdated]);

  const handleAddPatient = useCallback(async (newPatient: Patient) => {
    const duplicate = patients.find((p) => isSameClinicalPatient(p, newPatient));
    if (duplicate) {
      if (duplicate.status === 'DISCHARGED') {
        const newRoomClean = extractCleanRoomNumber(newPatient.roomNumber);
        const reactivated: Patient = {
          ...duplicate,
          ...newPatient,
          id: duplicate.id,
          status: 'ACTIVE',
          admissionStatus: newPatient.admissionStatus || 'ADMITTED_TODAY',
          roomNumber: newRoomClean || duplicate.roomNumber,
          bedNumber: newPatient.bedNumber || duplicate.bedNumber,
          dischargeDate: undefined,
          dischargeTomorrowSetDate: undefined,
        };
        const updated = patients.map((p) => (p.id === duplicate.id ? reactivated : p));
        setPatients(updated);
        savePatients(updated);
        setIsAutoSyncing(true);
        try {
          await syncPatientToCloud(reactivated);
          setLastAutoSyncTime(new Date().toLocaleTimeString('vi-VN'));
        } catch (err) {
          console.warn('Auto sync reactivated patient error:', err);
        } finally {
          setIsAutoSyncing(false);
        }
        setManualPushMessage(`🔄 Đã khôi phục bệnh nhân "${reactivated.fullName}" vào Phòng ${reactivated.roomNumber}!`);
        setTimeout(() => setManualPushMessage(null), 5000);
        return;
      }

      const newRoomClean = extractCleanRoomNumber(newPatient.roomNumber);
      const oldRoomClean = extractCleanRoomNumber(duplicate.roomNumber);
      if (newRoomClean && oldRoomClean && newRoomClean !== oldRoomClean) {
        const moved: Patient = {
          ...duplicate,
          roomNumber: newRoomClean,
          bedNumber: newPatient.bedNumber || duplicate.bedNumber,
        };
        const updated = patients.map((p) => (p.id === duplicate.id ? moved : p));
        setPatients(updated);
        savePatients(updated);
        syncPatientToCloud(moved).catch(console.warn);
        setManualPushMessage(`🔄 Đã cập nhật chuyển buồng cho BN "${moved.fullName}": P.${oldRoomClean} ➔ P.${newRoomClean}!`);
        setTimeout(() => setManualPushMessage(null), 5000);
        return;
      }

      console.warn('Patient already exists in ward, skipping duplicate:', newPatient.fullName, duplicate.id);
      setManualPushMessage(`⚠️ Bệnh nhân "${newPatient.fullName}" đã có trong danh sách khoa (${duplicate.roomNumber ? `P.${duplicate.roomNumber}` : ''}), tự động bỏ qua để tránh trùng.`);
      setTimeout(() => setManualPushMessage(null), 6000);
      return;
    }

    const updated = [newPatient, ...patients];
    setPatients(updated);
    savePatients(updated);
    setIsAutoSyncing(true);
    try {
      await syncPatientToCloud(newPatient);
      setLastAutoSyncTime(new Date().toLocaleTimeString('vi-VN'));
    } catch (err: any) {
      console.warn('Auto sync new patient error:', err);
      setManualPushMessage(`❌ Lỗi đồng bộ tiếp nhận bệnh nhân mới lên Cloud: ${err.message || String(err)}`);
      setTimeout(() => setManualPushMessage(null), 10000);
    } finally {
      setIsAutoSyncing(false);
    }
  }, [patients]);

  const handleImportMultiplePatients = useCallback(async (newPatients: Patient[]) => {
    if (newPatients.length === 0) return;
    
    let currentList = [...patients];
    const affectedToSync: Patient[] = [];

    newPatients.forEach((newP) => {
      const duplicateIdx = currentList.findIndex((p) => isSameClinicalPatient(p, newP));
      if (duplicateIdx !== -1) {
        const dup = currentList[duplicateIdx];
        if (dup.status === 'DISCHARGED') {
          const reactivated: Patient = {
            ...dup,
            ...newP,
            id: dup.id,
            status: 'ACTIVE',
            admissionStatus: newP.admissionStatus || 'ADMITTED_TODAY',
            roomNumber: extractCleanRoomNumber(newP.roomNumber) || dup.roomNumber,
            bedNumber: newP.bedNumber || dup.bedNumber,
            dischargeDate: undefined,
            dischargeTomorrowSetDate: undefined,
          };
          currentList[duplicateIdx] = reactivated;
          affectedToSync.push(reactivated);
        } else {
          const newRoomClean = extractCleanRoomNumber(newP.roomNumber);
          const oldRoomClean = extractCleanRoomNumber(dup.roomNumber);
          if (newRoomClean && oldRoomClean && newRoomClean !== oldRoomClean) {
            const moved: Patient = {
              ...dup,
              roomNumber: newRoomClean,
              bedNumber: newP.bedNumber || dup.bedNumber,
            };
            currentList[duplicateIdx] = moved;
            affectedToSync.push(moved);
          }
        }
      } else {
        currentList = [newP, ...currentList];
        affectedToSync.push(newP);
      }
    });

    setPatients(currentList);
    savePatients(currentList);
    if (affectedToSync.length > 0) {
      setIsAutoSyncing(true);
      try {
        for (const p of affectedToSync) {
          await syncPatientToCloud(p);
        }
        setLastAutoSyncTime(new Date().toLocaleTimeString('vi-VN'));
      } catch (err) {
        console.warn('Auto sync multiple patients error:', err);
      } finally {
        setIsAutoSyncing(false);
      }
    }
  }, [patients]);

  const handleAutoDischargePatients = useCallback(async (dischargedPats: Patient[]) => {
    if (!dischargedPats || dischargedPats.length === 0) return;
    const dischargeIds = new Set(dischargedPats.map((p) => p.id));
    const nowIso = new Date().toISOString();

    const updatedList = patients.map((p) => {
      if (dischargeIds.has(p.id)) {
        return {
          ...p,
          status: 'DISCHARGED' as const,
          admissionStatus: 'DISCHARGE_TODAY' as const,
          dischargeDate: nowIso,
        };
      }
      return p;
    });

    setPatients(updatedList);
    savePatients(updatedList);

    const names = dischargedPats.slice(0, 3).map((p) => p.fullName).join(', ') + 
      (dischargedPats.length > 3 ? ` và ${dischargedPats.length - 3} BN khác` : '');
    setManualPushMessage(`🚪 Đã tự động cho ra viện ${dischargedPats.length} bệnh nhân không có trong file Excel (${names})!`);
    setTimeout(() => setManualPushMessage(null), 7000);

    setIsAutoSyncing(true);
    try {
      for (const pat of dischargedPats) {
        const updatedPat: Patient = {
          ...pat,
          status: 'DISCHARGED' as const,
          admissionStatus: 'DISCHARGE_TODAY' as const,
          dischargeDate: nowIso,
        };
        await syncPatientToCloud(updatedPat);
      }
      setLastAutoSyncTime(new Date().toLocaleTimeString('vi-VN'));
    } catch (err) {
      console.warn('Lỗi sync cloud khi tự động cho ra viện:', err);
    } finally {
      setIsAutoSyncing(false);
    }
  }, [patients]);

  const handleRestoreSinglePatient = useCallback(async (patient: Patient, targetRoom?: string) => {
    const restored = restoreDischargedPatient(patient, targetRoom);
    const updated = patients.map((p) => (p.id === patient.id ? restored : p));
    setPatients(updated);
    savePatients(updated);

    setManualPushMessage(`🎉 Đã khôi phục BN "${formatPatientDisplayName(patient.fullName)}" trở lại buồng P.${restored.roomNumber}!`);
    setTimeout(() => setManualPushMessage(null), 6000);

    try {
      await syncPatientToCloud(restored);
      setLastAutoSyncTime(new Date().toLocaleTimeString('vi-VN'));
    } catch (e) {
      console.warn('Lỗi sync cloud khi khôi phục BN:', e);
    }
  }, [patients]);

  const handleRestoreNov16Discharged = useCallback(async (patientsToRestore?: Patient[]) => {
    const targetList = patientsToRestore || dischargedPatients.filter(isDischargedOnNov16);
    if (!targetList || targetList.length === 0) return;

    const targetIds = new Set(targetList.map((p) => p.id));
    const updated = patients.map((p) => {
      if (targetIds.has(p.id)) {
        return restoreDischargedPatient(p);
      }
      return p;
    });

    setPatients(updated);
    savePatients(updated);

    const names = targetList.slice(0, 3).map((p) => p.fullName).join(', ') + 
      (targetList.length > 3 ? ` và ${targetList.length - 3} BN khác` : '');
    setManualPushMessage(`🎉 Đã khôi phục thành công ${targetList.length} ca ngày 16/11/2026 (${names}) trở lại buồng phòng!`);
    setTimeout(() => setManualPushMessage(null), 8000);

    setIsAutoSyncing(true);
    try {
      for (const pat of targetList) {
        const restored = restoreDischargedPatient(pat);
        await syncPatientToCloud(restored);
      }
      setLastAutoSyncTime(new Date().toLocaleTimeString('vi-VN'));
    } catch (err) {
      console.warn('Lỗi sync cloud khi khôi phục ca ngày 16/11:', err);
    } finally {
      setIsAutoSyncing(false);
    }
  }, [patients, dischargedPatients]);

  const handleDischargeBeforeNov10 = useCallback(async () => {
    const targetList = patients.filter((p) => p.status !== 'DISCHARGED' && isAdmittedBeforeNov10(p));
    if (!targetList || targetList.length === 0) {
      setManualPushMessage('✅ Không có bệnh nhân nào vào viện trước ngày 10/11 cần cho ra viện.');
      setTimeout(() => setManualPushMessage(null), 4000);
      return;
    }

    const dischargeIds = new Set(targetList.map((p) => p.id));
    const nowIso = new Date().toISOString();
    const updated = patients.map((p) => {
      if (dischargeIds.has(p.id)) {
        return dischargePatientRecord(p, nowIso);
      }
      return p;
    });

    setPatients(updated);
    savePatients(updated);

    const names = targetList.slice(0, 3).map((p) => p.fullName).join(', ') + 
      (targetList.length > 3 ? ` và ${targetList.length - 3} BN khác` : '');
    setManualPushMessage(`🚪 Đã cho ra viện ${targetList.length} bệnh nhân vào viện trước ngày 10/11 (${names})!`);
    setTimeout(() => setManualPushMessage(null), 8000);

    setIsAutoSyncing(true);
    try {
      for (const pat of targetList) {
        await syncPatientToCloud(dischargePatientRecord(pat, nowIso));
      }
      setLastAutoSyncTime(new Date().toLocaleTimeString('vi-VN'));
    } catch (err) {
      console.warn('Lỗi sync cloud khi cho ra viện ca trước 10/11:', err);
    } finally {
      setIsAutoSyncing(false);
    }
  }, [patients]);

  const confirmDeletePatient = useCallback(async (patient: Patient) => {
    const pId = patient.id;
    const pName = patient.fullName;

    const updated = patients.filter((p) => p.id !== pId);
    setPatients(updated);
    savePatients(updated);
    if (onPatientRemoved) onPatientRemoved(pId);

    setManualPushMessage(`✅ Đã xóa bệnh nhân ${pName} thành công khỏi hệ thống!`);
    setTimeout(() => setManualPushMessage(null), 5000);

    setIsAutoSyncing(true);
    try {
      const res = await deletePatientFromCloud(pId);
      if (!res.success) {
        console.warn('Lỗi xóa cloud:', res.error);
      }
      setLastAutoSyncTime(new Date().toLocaleTimeString('vi-VN'));
    } catch (err) {
      console.warn('Lỗi xóa patient cloud:', err);
    } finally {
      setIsAutoSyncing(false);
    }
  }, [patients, onPatientRemoved]);

  const confirmDischargePatient = useCallback(async (patient: Patient) => {
    const pId = patient.id;
    const pName = patient.fullName;

    const updatedPat: Patient = {
      ...patient,
      status: 'DISCHARGED' as const,
      admissionStatus: 'DISCHARGE_TODAY' as const,
    };

    const updatedList = patients.map((p) => (p.id === pId ? updatedPat : p));
    setPatients(updatedList);
    savePatients(updatedList);
    if (onPatientRemoved) onPatientRemoved(pId);

    setManualPushMessage(`✅ Bệnh nhân ${pName} đã ra viện (rời khỏi danh sách buồng phòng hiện tại)!`);
    setTimeout(() => setManualPushMessage(null), 5000);

    setIsAutoSyncing(true);
    try {
      const res = await syncPatientToCloud(updatedPat);
      if (!res.success) {
        console.warn('Lỗi sync discharge cloud:', res.error);
      }
      setLastAutoSyncTime(new Date().toLocaleTimeString('vi-VN'));
    } catch (err) {
      console.warn('Lỗi sync discharge cloud:', err);
    } finally {
      setIsAutoSyncing(false);
    }
  }, [patients, onPatientRemoved]);

  const confirmDeleteAllPatients = useCallback(async () => {
    setIsAutoSyncing(true);
    try {
      await deleteAllPatientsFromCloud();
      setPatients([]);
      savePatients([]);
      if (onPatientRemoved) onPatientRemoved('');
      setManualPushMessage('🗑️ Đã xóa vĩnh viễn toàn bộ bệnh nhân khỏi hệ thống và Cloud Firestore!');
      setTimeout(() => setManualPushMessage(null), 7000);
    } catch (err: any) {
      alert(`Lỗi khi xóa toàn bộ bệnh nhân: ${err.message || String(err)}`);
    } finally {
      setIsAutoSyncing(false);
    }
  }, [onPatientRemoved]);

  const handleManualPushCloud = useCallback(async () => {
    setIsAutoSyncing(true);
    setManualPushMessage('Đang kết nối & đẩy toàn bộ danh sách bệnh nhân lên Cloud Firestore...');
    try {
      const res = await syncAllPatientsToCloud(patients);
      if (res.success) {
        setLastAutoSyncTime(new Date().toLocaleTimeString('vi-VN'));
        setManualPushMessage(`✅ Đã đẩy thành công ${res.count} bệnh nhân lên Cloud Firestore (${new Date().toLocaleTimeString('vi-VN')})!`);
        setTimeout(() => setManualPushMessage(null), 5000);
      } else {
        const detailStr = res.details ? ` [${res.details}]` : '';
        setManualPushMessage(`❌ Lỗi đẩy Cloud: ${res.error}${detailStr}`);
        setTimeout(() => setManualPushMessage(null), 12000);
      }
    } catch (err: any) {
      setManualPushMessage(`❌ Lỗi kết nối Cloud: ${err.message || String(err)}`);
      setTimeout(() => setManualPushMessage(null), 12000);
    } finally {
      setIsAutoSyncing(false);
    }
  }, [patients]);

  const handleTransferPatient = useCallback((
    patientId: string,
    newRoomNumber: string,
    newBedNumber: string
  ) => {
    const target = patients.find((p) => p.id === patientId);
    if (!target) return;

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const transferEvolution = {
      id: `EV-${Date.now()}`,
      timestamp: timeStr,
      doctorName: doctors.find((d) => d.id === target.attendingDoctorId)?.name || 'Bác sĩ điều trị',
      shift: 'Sáng' as const,
      clinicalNote: `Điều chuyển buồng phòng: Từ Phòng ${target.roomNumber} sang Phòng ${newRoomNumber}.`,
      treatmentAction: 'Bàn giao hồ sơ bệnh án và thuốc cho kíp buồng mới.',
    };

    const updated = patients.map((p) => {
      if (p.id === patientId) {
        return {
          ...p,
          roomNumber: newRoomNumber,
          bedNumber: newBedNumber,
          evolutions: [transferEvolution, ...p.evolutions],
        };
      }
      return p;
    });

    updatePatientsList(updated);
  }, [patients, doctors, updatePatientsList]);

  const handleReassignDoctor = useCallback((patientId: string, newDoctorId: string) => {
    const updated = patients.map((p) => {
      if (p.id === patientId) {
        return {
          ...p,
          attendingDoctorId: newDoctorId,
        };
      }
      return p;
    });
    updatePatientsList(updated);
  }, [patients, updatePatientsList]);

  const handleAssignRoomDoctor = useCallback(async (roomNumber: string, doctorId: string) => {
    const cleanRoom = roomNumber.replace(/^(phòng|p\.?)\s*/i, '').trim();
    
    setRoomDoctorAssignments((prev) => {
      const updated = { ...prev, [cleanRoom]: doctorId };
      try {
        localStorage.setItem('ROOM_DOCTOR_ASSIGNMENTS', JSON.stringify(updated));
      } catch (e) {
        console.warn(e);
      }
      return updated;
    });

    const affectedPatients: Patient[] = [];
    const updatedPatients = patients.map((p) => {
      const pRoom = (p.roomNumber || '').replace(/^(phòng|p\.?)\s*/i, '').trim();
      if (pRoom === cleanRoom && p.status === 'ACTIVE') {
        const patUpdated: Patient = {
          ...p,
          attendingDoctorId: doctorId,
        };
        affectedPatients.push(patUpdated);
        return patUpdated;
      }
      return p;
    });

    setPatients(updatedPatients);
    savePatients(updatedPatients);

    if (affectedPatients.length > 0) {
      setIsAutoSyncing(true);
      try {
        for (const pat of affectedPatients) {
          await syncPatientToCloud(pat);
        }
        setLastAutoSyncTime(new Date().toLocaleTimeString('vi-VN'));
      } catch (err) {
        console.warn('Auto sync room doctor error:', err);
      } finally {
        setIsAutoSyncing(false);
      }
    }
  }, [patients]);

  const handleOpenSatelliteDraft = useCallback((record: ClinicalRecord) => {
    const mapped = mapClinicalRecordToPatient(record, doctors, rooms, authenticatedDoctor?.id);
    if (!isRealAllergy(mapped.allergies)) {
      mapped.allergies = undefined;
      mapped.tags = (mapped.tags || []).filter((t) => t !== 'ALLERGY');
    }
    return mapped;
  }, [doctors, rooms, authenticatedDoctor?.id]);

  const handleDismissPendingSatellite = useCallback((recordId: string) => {
    const target = pendingSatelliteRecords.find((r) => r.id === recordId);
    const targetName = (target?.patientName || target?.fullName || '').trim();

    const remaining = dismissPendingSatelliteRecord(recordId);
    setPendingSatelliteRecords(remaining);

    try {
      if (typeof syncDismissedSatelliteRecordToCloud === 'function') {
        syncDismissedSatelliteRecordToCloud(recordId, targetName).catch(console.warn);
      }
    } catch (err) {
      console.warn('Lỗi syncDismissedSatelliteRecordToCloud:', err);
    }

    deleteSatelliteRecord(recordId).catch(console.warn);
  }, [pendingSatelliteRecords]);

  const handleDeletePendingSatellite = useCallback((recordId: string) => {
    const target = pendingSatelliteRecords.find((r) => r.id === recordId);
    const targetName = (target?.patientName || target?.fullName || '').trim();

    const remaining = deletePendingSatelliteRecord(recordId);
    setPendingSatelliteRecords(remaining);

    syncDismissedSatelliteRecordToCloud(recordId, targetName).catch(console.warn);
    deleteSatelliteRecord(recordId).catch(console.warn);
  }, [pendingSatelliteRecords]);

  return {
    patients,
    setPatients,
    doctors,
    setDoctors,
    rooms,
    setRooms,
    roomDoctorAssignments,
    syncStatus,
    isAutoSyncing,
    lastAutoSyncTime,
    emergencyAlert,
    setEmergencyAlert,
    pendingSatelliteRecords,
    setPendingSatelliteRecords,
    manualPushMessage,
    setManualPushMessage,
    dischargedPatients,
    nov16DischargedCount,
    beforeNov10DischargedCount,
    activeBeforeNov10Count,
    updatePatientsList,
    handleUpdatePatient,
    handleAddPatient,
    handleImportMultiplePatients,
    handleAutoDischargePatients,
    handleRestoreSinglePatient,
    handleRestoreNov16Discharged,
    handleDischargeBeforeNov10,
    confirmDeletePatient,
    confirmDischargePatient,
    confirmDeleteAllPatients,
    handleManualPushCloud,
    handleTransferPatient,
    handleReassignDoctor,
    handleAssignRoomDoctor,
    handleOpenSatelliteDraft,
    handleDismissPendingSatellite,
    handleDeletePendingSatellite,
  };
}

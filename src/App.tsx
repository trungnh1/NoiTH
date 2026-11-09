import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { Trash2, LogOut, AlertTriangle } from 'lucide-react';
import { 
  Patient, 
  Doctor, 
  DepartmentRoom 
} from './types/patient';
import { 
  loadPatients, 
  savePatients, 
  loadDoctors, 
  saveDoctors, 
  loadRooms, 
  resetAllData 
} from './utils/storage';
import { Header } from './components/Header';
import { DetailedPatientListView } from './components/DetailedPatientListView';
import { DoctorLoginScreen } from './components/DoctorLoginScreen';
import { getSavedDoctorSession, saveDoctorSession, clearDoctorSession } from './utils/auth';
import { loadAppSettings, saveAppSettings, getFontSizeScale, AppSettings, FONT_FAMILY_MAP } from './utils/settings';
import { isRealAllergy } from './utils/clinicalTextParser';
import { isSameClinicalPatient, findDuplicatePatientGroups, DuplicatePatientGroup } from './utils/excelParser';
import { normalizeSearchText } from './utils/searchUtils';
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
} from './services/clinicalFirebase';
import { 
  subscribeToEmergencyRecords, 
  subscribeToDepartmentPatients,
  syncPatientToCloud,
  deletePatientFromCloud,
  deleteAllPatientsFromCloud,
  testCloudWrite, 
  syncAllPatientsToCloud, 
  SyncStatus,
  syncDismissedSatelliteRecordToCloud,
  subscribeToDismissedSatelliteRecords,
  cleanupOldFirestoreData
} from './services/firebaseSync';

// Lazy load secondary views and modals to minimize initial bundle size and enable instant load
const SimplifiedNewPatientModal = React.lazy(() => import('./components/SimplifiedNewPatientModal').then(m => ({ default: m.SimplifiedNewPatientModal })));
const QuickEvolutionModal = React.lazy(() => import('./components/QuickEvolutionModal').then(m => ({ default: m.QuickEvolutionModal })));
const PatientPrintModal = React.lazy(() => import('./components/PatientPrintModal').then(m => ({ default: m.PatientPrintModal })));
const SatelliteClinicalSyncModal = React.lazy(() => import('./components/SatelliteClinicalSyncModal').then(m => ({ default: m.SatelliteClinicalSyncModal })));
const AppSettingsModal = React.lazy(() => import('./components/AppSettingsModal').then(m => ({ default: m.AppSettingsModal })));
const ExcelDataSyncModal = React.lazy(() => import('./components/ExcelDataSyncModal').then(m => ({ default: m.ExcelDataSyncModal })));
const ChangePasswordModal = React.lazy(() => import('./components/ChangePasswordModal').then(m => ({ default: m.ChangePasswordModal })));
const WardRoomMap = React.lazy(() => import('./components/WardRoomMap').then(m => ({ default: m.WardRoomMap })));
const PatientTableView = React.lazy(() => import('./components/PatientTableView').then(m => ({ default: m.PatientTableView })));
const DoctorAllocationView = React.lazy(() => import('./components/DoctorAllocationView').then(m => ({ default: m.DoctorAllocationView })));
const ClinicalKardexView = React.lazy(() => import('./components/ClinicalKardexView').then(m => ({ default: m.ClinicalKardexView })));
const PatientDetailModal = React.lazy(() => import('./components/PatientDetailModal').then(m => ({ default: m.PatientDetailModal })));
const NewPatientModal = React.lazy(() => import('./components/NewPatientModal').then(m => ({ default: m.NewPatientModal })));
const BedTransferModal = React.lazy(() => import('./components/BedTransferModal').then(m => ({ default: m.BedTransferModal })));
const ShiftHandoverModal = React.lazy(() => import('./components/ShiftHandoverModal').then(m => ({ default: m.ShiftHandoverModal })));
const ClinicalWatchlistModal = React.lazy(() => import('./components/ClinicalWatchlistModal').then(m => ({ default: m.ClinicalWatchlistModal })));
const DutyRosterModal = React.lazy(() => import('./components/DutyRosterModal').then(m => ({ default: m.DutyRosterModal })));
const DuplicatePatientsModal = React.lazy(() => import('./components/DuplicatePatientsModal').then(m => ({ default: m.DuplicatePatientsModal })));

export default function App() {
  const [patients, setPatients] = useState<Patient[]>(() => loadPatients());
  const [doctors, setDoctors] = useState<Doctor[]>(() => loadDoctors());
  const [rooms, setRooms] = useState<DepartmentRoom[]>(() => loadRooms());
  const [authenticatedDoctor, setAuthenticatedDoctor] = useState<Doctor | null>(() => {
    const loadedDocs = loadDoctors();
    return getSavedDoctorSession(loadedDocs);
  });
  const [isLoaded, setIsLoaded] = useState(true);
  const [isAuthChecked, setIsAuthChecked] = useState(true);

  // Firestore Sync State & Auto-save status
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

  // Main active view: 'detailed_list' (Default and primary screen)
  const [activeView, setActiveView] = useState<'detailed_list' | 'kardex' | 'map' | 'table' | 'doctors'>('detailed_list');
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Quick room doctor assignments map (persisted in localStorage)
  const [roomDoctorAssignments, setRoomDoctorAssignments] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('ROOM_DOCTOR_ASSIGNMENTS') || '{}');
    } catch {
      return {};
    }
  });

  // App UI & Theme settings
  const [appSettings, setAppSettings] = useState<AppSettings>(loadAppSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);

  // Đối soát & Phát hiện trùng lặp bệnh nhân hàng ngày
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [dismissedDuplicatePairs, setDismissedDuplicatePairs] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('HUNG_VUONG_DISMISSED_DUPLICATE_PAIRS');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const handleDismissDuplicatePair = (idA: string, idB: string) => {
    const pairKey = [idA, idB].sort().join('::');
    setDismissedDuplicatePairs((prev) => {
      const next = new Set(prev).add(pairKey);
      try {
        localStorage.setItem('HUNG_VUONG_DISMISSED_DUPLICATE_PAIRS', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const duplicatePatientGroups = useMemo(() => {
    return findDuplicatePatientGroups(patients, dismissedDuplicatePairs);
  }, [patients, dismissedDuplicatePairs]);

  const handleMergePatients = async (primary: Patient, duplicate: Patient) => {
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

    await handleUpdatePatient(updatedPrimary);
    await confirmDeletePatient(duplicate);
  };

  const handleUpdateSettings = (newSettings: AppSettings) => {
    setAppSettings(newSettings);
    saveAppSettings(newSettings);
  };

  // Modal states: Core workflow
  const [isSimplifiedNewPatientOpen, setIsSimplifiedNewPatientOpen] = useState(false);
  const [evolutionPatient, setEvolutionPatient] = useState<Patient | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isSatelliteSyncOpen, setIsSatelliteSyncOpen] = useState(false);
  const [satelliteImportDraft, setSatelliteImportDraft] = useState<Patient | null>(null);

  // Legacy modal states preserved in codebase
  const [transferringPatient, setTransferringPatient] = useState<Patient | null>(null);
  const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);
  const [prefilledRoom, setPrefilledRoom] = useState<string | undefined>(undefined);
  const [prefilledBed, setPrefilledBed] = useState<string | undefined>(undefined);
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [isWatchlistModalOpen, setIsWatchlistModalOpen] = useState(false);
  const [isDutyModalOpen, setIsDutyModalOpen] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTestingCloud, setIsTestingCloud] = useState(false);

  const handleCleanupOldFirestoreData = async () => {
    try {
      const res = await cleanupOldFirestoreData(15);
      if (res.success) {
        localStorage.setItem('HVG_LAST_FIRESTORE_CLEANUP_TS', String(Date.now()));
        if (res.totalDeleted > 0 || res.prunedVitalsCount > 0) {
          const parts: string[] = [];
          if (res.deletedPatientsCount > 0) parts.push(`${res.deletedPatientsCount} BN ra viện`);
          if (res.deletedDismissedCount > 0) parts.push(`${res.deletedDismissedCount} ca vệ tinh đã xử lý`);
          if (res.deletedProbeCount > 0) parts.push(`${res.deletedProbeCount} dữ liệu thử nghiệm`);
          if (res.prunedVitalsCount > 0) parts.push(`${res.prunedVitalsCount} chỉ số sinh hiệu cũ`);
          
          setManualPushMessage(`🧹 Đã dọn dẹp Firestore: Đã xóa ${res.totalDeleted} bản ghi cũ (> 15 ngày) (${parts.join(', ')}) để tối ưu dung lượng!`);
          setTimeout(() => setManualPushMessage(null), 8000);
        }
      }
    } catch (err: any) {
      console.warn('Lỗi dọn dẹp dữ liệu cũ Firestore:', err);
    }
  };

  const handleTestCloudConnection = async () => {
    setIsTestingCloud(true);
    setTestResult({ success: true, message: 'Đang kết nối Firestore và ghi thử dữ liệu...' });
    const res = await testCloudWrite();
    setIsTestingCloud(false);
    if (res.success) {
      setTestResult({
        success: true,
        message: `Thành công! Đã ghi dữ liệu test lên Firebase Firestore online (Document ID: ${res.id}). Dữ liệu lưu trữ cloud hoạt động hoàn hảo!`,
      });
    } else {
      setTestResult({
        success: false,
        message: `Lỗi ghi Cloud: ${res.error}`,
      });
    }
  };

  // Initial load & Realtime 2-way Cloud Firestore Sync
  useEffect(() => {
    // 1. Automatic continuous 2-way sync for Inpatients in Khoa Nội Tổng Hợp
    const unsubDept = subscribeToDepartmentPatients(
      (cloudPatients) => {
        setPatients(cloudPatients || []);
        savePatients(cloudPatients || []);
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

    // 4. Tự động kiểm tra và dọn dẹp dữ liệu Cloud Firestore cũ quá 15 ngày định kỳ (mỗi 12 - 24 giờ)
    const lastCleanupTs = Number(localStorage.getItem('HVG_LAST_FIRESTORE_CLEANUP_TS') || '0');
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
    let timerCleanup: any;
    if (Date.now() - lastCleanupTs > TWELVE_HOURS_MS) {
      timerCleanup = setTimeout(() => {
        handleCleanupOldFirestoreData();
      }, 5000);
    }

    // 3. Real-time background subscriber to Satellite Cloud Firestore (iron-foundation-kbcxw)
    // Defer 1200ms để ưu tiên toàn bộ tài nguyên CPU/Network cho first paint & tương tác ban đầu
    let unsubSatellite: (() => void) | undefined;
    const timerSatellite = setTimeout(() => {
      unsubSatellite = subscribeToClinicalRecords((satelliteRecords) => {
      if (!satelliteRecords || satelliteRecords.length === 0) {
        return;
      }

      // Lưu cache danh sách bệnh án vệ tinh
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

        // A. Kiểm tra nếu đã bị bỏ qua hoặc đã xử lý trước đó
        if (
          deletedIds.includes(recordId) ||
          processedIds.includes(recordId) ||
          (nameKey && (deletedIds.includes(nameKey) || processedIds.includes(nameKey))) ||
          (normRecName && (deletedIds.includes(normRecName) || processedIds.includes(normRecName)))
        ) {
          return;
        }

        // B. KIỂM TRA ĐẶC BIỆT: Bệnh nhân ĐÃ CÓ MẶT trong danh sách bệnh của Khoa (như Siu Hoách, Trần Đà)
        const recAge = parseAgeNumber(rec.patientAge || rec.age);
        const alreadyInDeptPatient = activeInpatients.find((p) => {
          const normPName = normalizeSearchText(p.fullName);
          if (!normPName || !normRecName) return false;

          // Khớp họ tên tuyệt đối (đã bỏ dấu tiếng Việt)
          if (normPName === normRecName) return true;

          // Khớp mã bệnh án hoặc ID
          if (p.id === recordId || (p.patientCode && p.patientCode === recordId)) return true;

          // Khớp họ tên gần đúng (độ dài >= 5 ký tự) và tuổi tương đồng
          if (normRecName.length >= 5 && (normPName.includes(normRecName) || normRecName.includes(normPName))) {
            if (!recAge || !p.age || Math.abs(recAge - p.age) <= 3) {
              return true;
            }
          }

          return false;
        });

        if (alreadyInDeptPatient) {
          // Bệnh nhân đã được tiếp nhận / nhập viện vào khoa rồi!
          // Tự động đánh dấu đã xử lý, KHÔNG BAO GIỜ hiển thị trong Chờ bổ sung!
          if (!processedIds.includes(recordId)) processedIds.push(recordId);
          if (nameKey && !processedIds.includes(nameKey)) processedIds.push(nameKey);
          if (normRecName && !processedIds.includes(normRecName)) processedIds.push(normRecName);
          return;
        }

        const completeness = checkSatelliteRecordCompleteness(rec);

        if (completeness.isComplete) {
          // Tự động nhập viện nếu đầy đủ thông tin (Họ tên, tuổi, số phòng)
          const name = nameKey;
          const rawRoom = String(rec.patientRoom || rec.roomNumber || '').replace(/\D/g, '');

          const alreadyInDept = currentPatientsList.some((p) => {
            const pName = p.fullName.toLowerCase().trim();
            const pRoom = p.roomNumber.replace(/\D/g, '');
            return pName === name && (pRoom === rawRoom || !rawRoom);
          });

          if (!alreadyInDept) {
            const currentDocs = loadDoctors();
            const currentDocSession = getSavedDoctorSession(currentDocs);
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
          // Hồ sơ thiếu thông tin và CHƯA có trong khoa -> Đưa vào hàng đợi 'Chờ bổ sung'
          pendingQueue.push(rec);
        }
      });

      // Lưu lại danh sách đã xử lý
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
  }, []);

  // 3. Warn user when closing tab/browser if data is currently syncing or cloud sync has error
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
  // Periodic Auto-Refresh for Satellite Records if configured in Settings
  useEffect(() => {
    if (!appSettings.autoRefreshInterval || appSettings.autoRefreshInterval <= 0) return;
    const timer = setInterval(() => {
      setPendingSatelliteRecords(loadPendingSatelliteRecords());
    }, appSettings.autoRefreshInterval * 1000);
    return () => clearInterval(timer);
  }, [appSettings.autoRefreshInterval]);


  // Sync patients changes to storage and cloud automatically in real-time
  const updatePatientsList = async (newPatients: Patient[]) => {
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
  };

  // Handle single patient update (evolution, notes, vital signs)
  const handleUpdatePatient = async (updatedPatient: Patient) => {
    const updated = patients.map((p) =>
      p.id === updatedPatient.id ? updatedPatient : p
    );
    setPatients(updated);
    savePatients(updated);
    if (selectedPatient?.id === updatedPatient.id) {
      setSelectedPatient(updatedPatient);
    }
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
  };

  // Handle new patient admission (automatic upload to Firestore)
  const handleAddPatient = async (newPatient: Patient) => {
    // Chặn trùng lặp bệnh nhân: trùng họ tên, tuổi, ngày nhập viện hoặc mã BN
    const duplicate = patients.find((p) => isSameClinicalPatient(p, newPatient));
    if (duplicate) {
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
  };

  // Import nhieu benh nhan cung luc tu Cloud ve tinh
  const handleImportMultiplePatients = async (newPatients: Patient[]) => {
    if (newPatients.length === 0) return;
    // Lọc bỏ các bệnh nhân đã có sẵn trong danh sách khoa (trùng họ tên, tuổi, ngày nhập viện hoặc mã BN)
    const nonDuplicates = newPatients.filter((newP) => !patients.some((p) => isSameClinicalPatient(p, newP)));
    if (nonDuplicates.length === 0) {
      setManualPushMessage('⚠️ Tất cả bệnh nhân vừa nạp đều đã có trong danh sách khoa, không có bệnh nhân mới nào được thêm.');
      setTimeout(() => setManualPushMessage(null), 6000);
      return;
    }

    const updated = [...nonDuplicates, ...patients];
    setPatients(updated);
    savePatients(updated);
    setIsAutoSyncing(true);
    try {
      for (const p of nonDuplicates) {
        await syncPatientToCloud(p);
      }
      setLastAutoSyncTime(new Date().toLocaleTimeString('vi-VN'));
    } catch (err: any) {
      console.warn('Auto sync multiple patients error:', err);
    } finally {
      setIsAutoSyncing(false);
    }
  };

  // Tự động cho ra viện các bệnh nhân có trong danh sách nhưng không có trong file Excel vừa tải
  const handleAutoDischargePatients = async (dischargedPats: Patient[]) => {
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

    // Đồng bộ trạng thái ra viện lên Cloud Firestore
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
  };

  // Mở hồ sơ bệnh nhân vệ tinh chờ bổ sung để hoàn thiện thông tin và tiếp nhận
  const handleOpenSatelliteDraft = (record: ClinicalRecord) => {
    const mapped = mapClinicalRecordToPatient(record, doctors, rooms, authenticatedDoctor?.id);
    if (!isRealAllergy(mapped.allergies)) {
      mapped.allergies = undefined;
      mapped.tags = (mapped.tags || []).filter((t) => t !== 'ALLERGY');
    }
    setSatelliteImportDraft(mapped);
  };

    // Bỏ qua hoặc đánh dấu đã xử lý ca vệ tinh chờ bổ sung
  const handleDismissPendingSatellite = (recordId: string) => {
    const target = pendingSatelliteRecords.find((r) => r.id === recordId);
    const targetName = (target?.patientName || target?.fullName || '').trim();

    // 1. Cập nhật local state & localStorage ngay lập tức
    const remaining = dismissPendingSatelliteRecord(recordId);
    setPendingSatelliteRecords(remaining);

    // 2. Đồng bộ trạng thái bỏ qua lên Cloud Firestore của Khoa (để máy tính khác cập nhật tức thì)
    try {
      if (typeof syncDismissedSatelliteRecordToCloud === 'function') {
        syncDismissedSatelliteRecordToCloud(recordId, targetName).catch(console.warn);
      }
    } catch (err) {
      console.warn('Lỗi syncDismissedSatelliteRecordToCloud:', err);
    }

    // 3. Xóa trực tiếp khỏi Firestore vệ tinh (iron-foundation-kbcxw)
    deleteSatelliteRecord(recordId).catch(console.warn);
  };

  // Xóa vĩnh viễn ca vệ tinh khỏi danh sách chờ bổ sung
  const handleDeletePendingSatellite = (recordId: string) => {
    const target = pendingSatelliteRecords.find((r) => r.id === recordId);
    const targetName = (target?.patientName || target?.fullName || '').trim();

    // 1. Cập nhật local state & localStorage ngay lập tức
    const remaining = deletePendingSatelliteRecord(recordId);
    setPendingSatelliteRecords(remaining);

    // 2. Đồng bộ trạng thái bỏ qua lên Cloud Firestore của Khoa (để máy tính khác cập nhật tức thì)
    syncDismissedSatelliteRecordToCloud(recordId, targetName).catch(console.warn);

    // 3. Xóa trực tiếp khỏi Firestore vệ tinh
    deleteSatelliteRecord(recordId).catch(console.warn);
  };

  // Manual push on demand button handler
  const [manualPushMessage, setManualPushMessage] = useState<string | null>(null);

  const handleManualPushCloud = async () => {
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
  };

  // Handle bed transfer
  const handleTransferPatient = (
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
  };

  // Action Confirm Modal state for Delete and Discharge
  const [actionConfirmModal, setActionConfirmModal] = useState<{
    type: 'DELETE' | 'DISCHARGE';
    patient: Patient;
  } | null>(null);

  // Trigger delete modal
  const handleDeletePatient = (patient: Patient) => {
    setActionConfirmModal({ type: 'DELETE', patient });
  };

  // Trigger discharge modal
  const handleDischargePatient = (patient: Patient) => {
    setActionConfirmModal({ type: 'DISCHARGE', patient });
  };

  // Confirm execution of patient deletion
  const confirmDeletePatient = async (patient: Patient) => {
    const pId = patient.id;
    const pName = patient.fullName;
    setActionConfirmModal(null);

    // 1. Immediate local state update
    const updated = patients.filter((p) => p.id !== pId);
    setPatients(updated);
    savePatients(updated);
    if (selectedPatient?.id === pId) {
      setSelectedPatient(null);
    }

    // 2. Clear visual banner feedback
    setManualPushMessage(`✅ Đã xóa bệnh nhân ${pName} thành công khỏi hệ thống!`);
    setTimeout(() => setManualPushMessage(null), 5000);

    // 3. Delete from Cloud Firestore
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
  };

  // Delete All Patients Modal state (Exclusive for Doctor ID 00979 - BS. Nguyễn Hữu Trung)
  const [showDeleteAllConfirmModal, setShowDeleteAllConfirmModal] = useState(false);

  const handleDeleteAllPatients = () => {
    setShowDeleteAllConfirmModal(true);
  };

  const confirmDeleteAllPatients = async () => {
    setShowDeleteAllConfirmModal(false);
    setIsAutoSyncing(true);
    try {
      await deleteAllPatientsFromCloud();
      setPatients([]);
      savePatients([]);
      setSelectedPatient(null);
      setManualPushMessage('🗑️ Đã xóa vĩnh viễn toàn bộ bệnh nhân khỏi hệ thống và Cloud Firestore!');
      setTimeout(() => setManualPushMessage(null), 7000);
    } catch (err: any) {
      alert(`Lỗi khi xóa toàn bộ bệnh nhân: ${err.message || String(err)}`);
    } finally {
      setIsAutoSyncing(false);
    }
  };

  // Confirm execution of patient discharge (xóa khỏi buồng phòng)
  const confirmDischargePatient = async (patient: Patient) => {
    const pId = patient.id;
    const pName = patient.fullName;
    setActionConfirmModal(null);

    // 1. Immediately mark as DISCHARGED
    const updatedPat: Patient = {
      ...patient,
      status: 'DISCHARGED' as const,
      admissionStatus: 'DISCHARGE_TODAY' as const,
    };

    const updatedList = patients.map((p) => (p.id === pId ? updatedPat : p));
    setPatients(updatedList);
    savePatients(updatedList);
    if (selectedPatient?.id === pId) {
      setSelectedPatient(null);
    }

    // 2. Visual banner feedback
    setManualPushMessage(`✅ Bệnh nhân ${pName} đã ra viện (rời khỏi danh sách buồng phòng hiện tại)!`);
    setTimeout(() => setManualPushMessage(null), 5000);

    // 3. Sync update to Cloud Firestore
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
  };

  // Handle doctor reassignment
  const handleReassignDoctor = (patientId: string, newDoctorId: string) => {
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
  };

  // Handle quick doctor assignment for a room
  const handleAssignRoomDoctor = async (roomNumber: string, doctorId: string) => {
    const cleanRoom = roomNumber.replace(/^(phòng|p\.?)\s*/i, '').trim();
    
    // 1. Update assignment map
    setRoomDoctorAssignments((prev) => {
      const updated = { ...prev, [cleanRoom]: doctorId };
      try {
        localStorage.setItem('ROOM_DOCTOR_ASSIGNMENTS', JSON.stringify(updated));
      } catch (e) {
        console.warn(e);
      }
      return updated;
    });

    // 2. Update all active patients in this room without adding into Clinical Timeline
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

    // 3. Sync affected patients to Firestore
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
  };

  const handleLoginSuccess = (doctor: Doctor) => {
    setAuthenticatedDoctor(doctor);
    saveDoctorSession(doctor);
  };

  const handleLogout = () => {
    setAuthenticatedDoctor(null);
    clearDoctorSession();
  };

  if (!isLoaded || !isAuthChecked) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-300">Đang khởi tạo hệ thống Khoa Nội Tổng Hợp - Tim Mạch...</p>
        </div>
      </div>
    );
  }

  // Doctor Authentication Gate: Must log in with doctor ID before accessing app
  if (!authenticatedDoctor) {
    return (
      <DoctorLoginScreen
        doctors={doctors}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  const fontSizeScaleClass = getFontSizeScale(appSettings.fontSize);
  const isDark = appSettings.themeMode === 'dark';
  const isEyeCare = appSettings.themeMode === 'eye-care';

  return (
    <div 
      className={`min-h-screen ${fontSizeScaleClass} ${
        isDark ? 'bg-slate-950 text-slate-100 dark' : isEyeCare ? 'bg-[#fbf8f1] text-[#2c2825]' : 'bg-slate-100/70 text-slate-900'
      } flex flex-col selection:bg-rose-500 selection:text-white transition-colors duration-200`}
      style={{ fontFamily: FONT_FAMILY_MAP[appSettings.fontFamily || 'plus-jakarta'] }}
    >
      {/* Streamlined Header */}
      <Header
        patients={patients}
        activeView={activeView}
        onViewChange={setActiveView}
        onOpenNewPatient={() => {
          setPrefilledRoom(undefined);
          setPrefilledBed(undefined);
          setIsSimplifiedNewPatientOpen(true);
        }}
        onOpenHandover={() => setIsHandoverModalOpen(true)}
        onOpenWatchlist={() => setIsWatchlistModalOpen(true)}
        onOpenPrintModal={() => setIsPrintModalOpen(true)}
        syncStatus={syncStatus}
        currentDoctor={authenticatedDoctor}
        onLogout={handleLogout}
        onManualPushToCloud={handleManualPushCloud}
        onOpenDutySchedule={() => setIsDutyModalOpen(true)}
        onOpenSatelliteSync={() => setIsSatelliteSyncOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
        duplicateGroupCount={duplicatePatientGroups.length}
        onOpenDuplicateModal={() => setIsDuplicateModalOpen(true)}
        pendingSatelliteCount={pendingSatelliteRecords.length}
        isAutoSyncing={isAutoSyncing}
        lastAutoSyncTime={lastAutoSyncTime}
      />

      {/* CẢNH BÁO ĐỐI SOÁT PHÁT HIỆN TRÙNG LẶP HÀNG NGÀY */}
      {duplicatePatientGroups.length > 0 && !isDuplicateModalOpen && (
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 text-white px-3 sm:px-5 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2 max-w-4xl truncate">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping shrink-0" />
            <span className="font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded text-[10.5px]">
              Đối soát hàng ngày
            </span>
            <span className="font-extrabold truncate">
              Phát hiện {duplicatePatientGroups.length} trường hợp bệnh nhân nghi vấn trùng lặp trong khoa ({duplicatePatientGroups.map(g => g.patientName).slice(0, 3).join(', ')}{duplicatePatientGroups.length > 3 ? ` và ${duplicatePatientGroups.length - 3} ca khác` : ''})!
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsDuplicateModalOpen(true)}
              className="px-3 py-1 bg-white hover:bg-amber-50 text-slate-950 font-black rounded-xl text-xs shadow-xs transition-transform active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
              <span>Xem & Chọn Xóa Trùng ({duplicatePatientGroups.reduce((acc, g) => acc + g.patients.length, 0)} ca)</span>
            </button>
          </div>
        </div>
      )}

      {/* Manual Push Feedback Banner */}
      {manualPushMessage && (
        <div className="bg-slate-900 text-white px-4 py-2 shadow-md flex items-center justify-between text-xs font-bold animate-in fade-in slide-in-from-top-2 border-b border-blue-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
            <span>{manualPushMessage}</span>
          </div>
          <button
            onClick={() => setManualPushMessage(null)}
            className="text-slate-400 hover:text-white cursor-pointer px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Real-time Emergency Ingestion Notification Banner */}
      {emergencyAlert && (
        <div className="bg-gradient-to-r from-rose-600 via-rose-700 to-amber-600 text-white px-4 py-2.5 shadow-md flex items-center justify-between text-xs sm:text-sm animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2 max-w-4xl truncate">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping shrink-0" />
            <span className="font-extrabold uppercase tracking-wide">Cấp cứu chuyển khoa:</span>
            <span className="font-bold truncate">{emergencyAlert.message}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setSelectedPatient(emergencyAlert.patient);
                setEmergencyAlert(null);
              }}
              className="px-2.5 py-1 bg-white text-rose-700 font-black rounded-lg text-xs shadow-xs hover:bg-rose-50 transition-colors cursor-pointer"
            >
              Mở hồ sơ ngay
            </button>
            <button
              onClick={() => setEmergencyAlert(null)}
              className="text-white/80 hover:text-white p-1 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area - Dynamic View Based on Tab */}
      <main className="flex-1 w-full px-2 sm:px-4 py-3">
        {activeView === 'detailed_list' && (
          <DetailedPatientListView
            patients={patients}
            doctors={doctors}
            rooms={rooms}
            roomDoctorAssignments={roomDoctorAssignments}
            onAssignRoomDoctor={handleAssignRoomDoctor}
            onUpdatePatient={handleUpdatePatient}
            onOpenNewPatient={() => {
              setPrefilledRoom(undefined);
              setPrefilledBed(undefined);
              setIsSimplifiedNewPatientOpen(true);
            }}
            onOpenNewPatientForRoom={(roomNum) => {
              setPrefilledRoom(roomNum);
              setPrefilledBed(undefined);
              setIsSimplifiedNewPatientOpen(true);
            }}
            onOpenEvolution={(patient) => setEvolutionPatient(patient)}
            onSelectPatient={(patient) => setSelectedPatient(patient)}
            onEditPatient={(patient) => setEditingPatient(patient)}
            onTransferPatient={(patient) => setTransferringPatient(patient)}
            onDischargePatient={handleDischargePatient}
            onDeletePatient={handleDeletePatient}
            currentUser={authenticatedDoctor}
            appSettings={appSettings}
            onDeleteAllPatients={handleDeleteAllPatients}
            onOpenPrintModal={() => setIsPrintModalOpen(true)}
            onAddPatient={handleAddPatient}
            onOpenSatelliteSync={() => setIsSatelliteSyncOpen(true)}
            pendingSatelliteCount={pendingSatelliteRecords.length}
            pendingSatelliteRecords={pendingSatelliteRecords}
            onOpenSatelliteDraft={handleOpenSatelliteDraft}
            onDismissPendingSatelliteRecord={handleDeletePendingSatellite}
            onOpenExcelImport={() => setIsExcelImportOpen(true)}
            initialLayoutMode="cards"
          />
        )}

        {activeView === 'map' && (
          <Suspense fallback={<div className="p-8 text-center text-slate-500 font-medium">Đang tải Sơ Đồ Buồng Bệnh...</div>}>
            <WardRoomMap
              rooms={rooms}
              patients={patients}
              doctors={doctors}
              onSelectPatient={(p) => setSelectedPatient(p)}
              onTransferPatient={(p) => setTransferringPatient(p)}
              onAdmitToBed={(rNum, bNum) => {
                setPrefilledRoom(rNum);
                setPrefilledBed(bNum);
                setIsSimplifiedNewPatientOpen(true);
              }}
              onDeletePatient={(pId) => {
                const target = patients.find((p) => p.id === pId);
                if (target) handleDeletePatient(target);
              }}
              onReassignDoctorForRoom={handleAssignRoomDoctor}
              onUpdatePatient={handleUpdatePatient}
            />
          </Suspense>
        )}

        {activeView === 'table' && (
          <Suspense fallback={<div className="p-8 text-center text-slate-500 font-medium">Đang tải Danh Sách Bệnh Nhân...</div>}>
            <PatientTableView
              patients={patients}
              doctors={doctors}
              onSelectPatient={(p) => setSelectedPatient(p)}
              onTransferPatient={(p) => setTransferringPatient(p)}
              onUpdatePatient={handleUpdatePatient}
            />
          </Suspense>
        )}

        {activeView === 'kardex' && (
          <Suspense fallback={<div className="p-8 text-center text-slate-500 font-medium">Đang tải Bảng Theo Dõi Điều Trị (Kardex)...</div>}>
            <ClinicalKardexView
              patients={patients}
              doctors={doctors}
              roomDoctorAssignments={roomDoctorAssignments}
              onSelectPatient={(p) => setSelectedPatient(p)}
              onOpenEvolution={(p) => setEvolutionPatient(p)}
              onTransferPatient={(p) => setTransferringPatient(p)}
              onUpdatePatient={handleUpdatePatient}
            />
          </Suspense>
        )}

        {activeView === 'doctors' && (
          <Suspense fallback={<div className="p-8 text-center text-slate-500 font-medium">Đang tải Phân Bổ Bác Sĩ...</div>}>
            <DoctorAllocationView
              rooms={rooms}
              doctors={doctors}
              patients={patients}
              onSelectPatient={(p) => setSelectedPatient(p)}
              onReassignDoctor={(patientId, newDoctorId) => {
                const target = patients.find((p) => p.id === patientId);
                if (target) {
                  handleUpdatePatient({ ...target, attendingDoctorId: newDoctorId });
                }
              }}
              onReassignDoctorForRoom={handleAssignRoomDoctor}
              onUpdatePatient={handleUpdatePatient}
            />
          </Suspense>
        )}
      </main>

      {/* Standard Clean Footer */}
      <footer className="bg-white border-t border-slate-200 py-3 mt-auto no-print">
        <div className="w-full px-3 sm:px-6 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-700">BỆNH VIỆN HÙNG VƯƠNG GIA LAI</span>
            <span>• Khoa Nội Tổng Hợp - Tim Mạch</span>
          </div>
          <div className="text-slate-400 font-medium">
            Hệ thống Quản lý Bệnh nhân Nội trú
          </div>
        </div>
      </footer>

      {/* Action Confirm Modal for Delete and Discharge */}
      {actionConfirmModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 overflow-hidden p-5 space-y-4 animate-in fade-in">
            {actionConfirmModal.type === 'DELETE' ? (
              <>
                <div className="flex items-center gap-3 text-rose-600">
                  <div className="p-2.5 rounded-full bg-rose-100 shrink-0">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">Xóa Bệnh Nhân</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Không thể hoàn tác thao tác này</p>
                  </div>
                </div>
                <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                  <p className="font-semibold">Bạn có chắc chắn muốn xóa vĩnh viễn bệnh nhân:</p>
                  <p className="font-black text-rose-700 text-sm uppercase">{actionConfirmModal.patient.fullName}</p>
                  <p className="text-[11px] text-slate-500 font-semibold">
                    Phòng {actionConfirmModal.patient.roomNumber}
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActionConfirmModal(null)}
                    className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl text-xs cursor-pointer transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmDeletePatient(actionConfirmModal.patient)}
                    className="px-4 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md text-xs cursor-pointer transition-colors"
                  >
                    Xóa Ngay
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 text-emerald-600">
                  <div className="p-2.5 rounded-full bg-emerald-100 shrink-0">
                    <LogOut className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">Xác Nhận Ra Viện</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Rời khỏi danh sách buồng phòng hiện tại</p>
                  </div>
                </div>
                <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                  <p className="font-semibold">Xác nhận ghi nhận ra viện cho bệnh nhân:</p>
                  <p className="font-black text-emerald-800 text-sm uppercase">{actionConfirmModal.patient.fullName}</p>
                  <p className="text-[11px] text-slate-500 font-semibold">
                    Phòng {actionConfirmModal.patient.roomNumber}
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActionConfirmModal(null)}
                    className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl text-xs cursor-pointer transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmDischargePatient(actionConfirmModal.patient)}
                    className="px-4 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md text-xs cursor-pointer transition-colors"
                  >
                    Xác Nhận Ra Viện
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Lazy-loaded Dialogs & Modals */}
      <Suspense fallback={null}>
        {/* 1. Simplified New Patient Admission Modal */}
        {isSimplifiedNewPatientOpen && (
        <SimplifiedNewPatientModal
          rooms={rooms}
          doctors={doctors}
          patients={patients}
          prefilledRoom={prefilledRoom}
          prefilledBed={prefilledBed}
          currentUser={authenticatedDoctor}
          onClose={() => setIsSimplifiedNewPatientOpen(false)}
          onAddPatient={(newPatient) => {
            handleAddPatient(newPatient);
            setIsSimplifiedNewPatientOpen(false);
          }}
        />
      )}

      {/* 1b. Edit Patient Modal using the same convenient, comprehensive form */}
      {editingPatient && (
        <SimplifiedNewPatientModal
          rooms={rooms}
          doctors={doctors}
          patients={patients}
          patientToEdit={editingPatient}
          currentUser={authenticatedDoctor}
          onClose={() => setEditingPatient(null)}
          onUpdatePatient={(updatedPatient) => {
            handleUpdatePatient(updatedPatient);
            setEditingPatient(null);
          }}
        />
      )}

      {/* 2. Simplified Daily Progress Note & Treatment Plan Modal */}
      {evolutionPatient && (
        <QuickEvolutionModal
          patient={evolutionPatient}
          doctors={doctors}
          currentUser={authenticatedDoctor}
          onClose={() => setEvolutionPatient(null)}
          onSaveEvolution={(updatedPatient) => {
            handleUpdatePatient(updatedPatient);
            setEvolutionPatient(null);
          }}
        />
      )}

      {/* 3. Patient Full Detail Modal (When user clicks "Chi tiết") */}
      {selectedPatient && (
        <PatientDetailModal
          patient={selectedPatient}
          doctors={doctors}
          currentUser={authenticatedDoctor}
          onClose={() => setSelectedPatient(null)}
          onUpdatePatient={handleUpdatePatient}
        />
      )}

      {/* 5. Printable Patient List Modal */}
      {isPrintModalOpen && (
        <PatientPrintModal
          patients={patients}
          doctors={doctors}
          rooms={rooms}
          settings={appSettings}
          onClose={() => setIsPrintModalOpen(false)}
        />
      )}

      {/* 6. Satellite Clinical Cloud Firestore Sync Modal */}
      {isSatelliteSyncOpen && (
        <SatelliteClinicalSyncModal
          currentPatients={patients}
          doctors={doctors}
          rooms={rooms}
          currentUser={authenticatedDoctor}
          onClose={() => setIsSatelliteSyncOpen(false)}
          onImportPatientDirect={(newPat) => {
            handleAddPatient(newPat);
            if (newPat.patientCode) {
              handleDismissPendingSatellite(newPat.patientCode);
            }
          }}
          onImportMultiplePatients={(newPatientsList) => {
            handleImportMultiplePatients(newPatientsList);
            newPatientsList.forEach(p => {
              if (p.patientCode) handleDismissPendingSatellite(p.patientCode);
            });
          }}
          onOpenEditAdmission={(prefilledPatient) => {
            setSatelliteImportDraft(prefilledPatient);
            setIsSatelliteSyncOpen(false);
          }}
          onOpenExcelImport={() => setIsExcelImportOpen(true)}
          pendingSatelliteRecords={pendingSatelliteRecords}
          onDismissPendingRecord={handleDeletePendingSatellite}
        />
      )}

      {/* 7. Review & Edit Satellite Imported Case Before Admission */}
      {satelliteImportDraft && (
        <SimplifiedNewPatientModal
          rooms={rooms}
          doctors={doctors}
          patients={patients}
          patientToEdit={satelliteImportDraft}
          isImportMode={true}
          currentUser={authenticatedDoctor}
          onClose={() => setSatelliteImportDraft(null)}
          onAddPatient={(newPatient) => {
            handleAddPatient(newPatient);
            if (newPatient.patientCode) {
              handleDismissPendingSatellite(newPatient.patientCode);
            }
            if (satelliteImportDraft.id) {
              handleDismissPendingSatellite(satelliteImportDraft.id);
            }
            if (satelliteImportDraft.fullName) {
              const cleanName = satelliteImportDraft.fullName.trim().toLowerCase();
              const remaining = loadPendingSatelliteRecords().filter(
                (r) => (r.patientName || r.fullName || '').trim().toLowerCase() !== cleanName
              );
              savePendingSatelliteRecords(remaining);
              setPendingSatelliteRecords(remaining);
            }
            setSatelliteImportDraft(null);
          }}
        />
      )}

      {/* 8. App Settings Modal */}
      {isSettingsOpen && (
        <AppSettingsModal
          settings={appSettings}
          onUpdateSettings={handleUpdateSettings}
          onOpenExcelImport={() => setIsExcelImportOpen(true)}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {/* 9. Excel File Data Import & Auto Match Modal */}
      {isExcelImportOpen && (
        <ExcelDataSyncModal
          existingPatients={patients}
          pendingSatelliteRecords={pendingSatelliteRecords}
          doctors={doctors}
          rooms={rooms}
          currentUser={authenticatedDoctor}
          onClose={() => setIsExcelImportOpen(false)}
          onImportPatientDirect={(newPat) => {
            handleAddPatient(newPat);
            if (newPat.patientCode) {
              handleDismissPendingSatellite(newPat.patientCode);
            }
          }}
          onImportMultiplePatients={handleImportMultiplePatients}
          onAutoDischargePatients={handleAutoDischargePatients}
          onReactivatePatient={(pat) => {
            handleUpdatePatient(pat);
          }}
          onDismissPendingSatelliteRecord={handleDismissPendingSatellite}
        />
      )}

      {/* 10. Change Password Modal */}
      {isChangePasswordOpen && authenticatedDoctor && (
        <ChangePasswordModal
          doctor={authenticatedDoctor}
          onClose={() => setIsChangePasswordOpen(false)}
          onSuccess={(msg) => {
            setManualPushMessage(msg);
            setTimeout(() => setManualPushMessage(null), 4000);
          }}
        />
      )}

      {/* 11. Duplicate Patients Daily Detection & Resolution Modal */}
      {isDuplicateModalOpen && (
        <Suspense fallback={null}>
          <DuplicatePatientsModal
            isOpen={isDuplicateModalOpen}
            duplicateGroups={duplicatePatientGroups}
            doctors={doctors}
            onClose={() => setIsDuplicateModalOpen(false)}
            onDeletePatient={(patient) => confirmDeletePatient(patient)}
            onMergePatients={handleMergePatients}
            onDismissPair={handleDismissDuplicatePair}
            onSelectPatient={(patient) => setSelectedPatient(patient)}
          />
        </Suspense>
      )}

      {/* Legacy Modals Preserved (Not deleted) */}
      {transferringPatient && (
        <BedTransferModal
          patient={transferringPatient}
          rooms={rooms}
          patients={patients}
          onClose={() => setTransferringPatient(null)}
          onTransfer={handleTransferPatient}
        />
      )}

      {isNewPatientModalOpen && (
        <NewPatientModal
          rooms={rooms}
          doctors={doctors}
          patients={patients}
          prefilledRoom={prefilledRoom}
          prefilledBed={prefilledBed}
          onClose={() => setIsNewPatientModalOpen(false)}
          onAddPatient={handleAddPatient}
        />
      )}

      {isHandoverModalOpen && (
        <ShiftHandoverModal
          patients={patients}
          doctors={doctors}
          onClose={() => setIsHandoverModalOpen(false)}
        />
      )}

      {isWatchlistModalOpen && (
        <ClinicalWatchlistModal
          patients={patients}
          doctors={doctors}
          onClose={() => setIsWatchlistModalOpen(false)}
          onSelectPatient={(p) => setSelectedPatient(p)}
        />
      )}

      {isDutyModalOpen && (
        <DutyRosterModal
          onClose={() => setIsDutyModalOpen(false)}
          onSelectDoctor={() => setIsDutyModalOpen(false)}
        />
      )}
      </Suspense>

      {/* Delete All Patients Confirmation Modal (BS ID 00979 Exclusive) */}
      {showDeleteAllConfirmModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border-2 border-rose-500 overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 rounded-2xl bg-rose-100 shrink-0">
                <Trash2 className="w-7 h-7 text-rose-600" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 px-2 py-0.5 rounded border border-rose-200">
                  Quyền Hạn Đặc Biệt (BS. Nguyễn Hữu Trung - ID: 00979)
                </span>
                <h3 className="font-black text-slate-900 text-base sm:text-lg leading-tight mt-1">
                  XÁC NHẬN XÓA TẤT CẢ BỆNH NHÂN
                </h3>
              </div>
            </div>

            <div className="text-xs text-slate-700 bg-rose-50/80 p-3.5 rounded-xl border border-rose-200 space-y-2">
              <p className="font-extrabold text-rose-900">
                ⚠️ CẢNH BÁO NGUY HẠI TỐI CAO:
              </p>
              <p className="font-semibold text-slate-800 leading-relaxed">
                Bác sĩ <strong className="text-rose-700">{authenticatedDoctor?.name || 'Nguyễn Hữu Trung'}</strong> có chắc chắn muốn <strong className="text-rose-700 uppercase">XÓA VĨNH VIỄN TOÀN BỘ</strong> tất cả ({patients.filter((p) => p.status === 'ACTIVE').length}) bệnh nhân nội trú khỏi hệ thống?
              </p>
              <p className="text-[11px] text-rose-800 font-bold italic">
                Thao tác này sẽ xóa sạch danh sách bệnh nhân trên máy và trên Cloud Firestore. Thao tác không thể hoàn tác!
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeleteAllConfirmModal(false)}
                className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl text-xs cursor-pointer transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmDeleteAllPatients}
                className="px-5 py-2 font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md text-xs cursor-pointer transition-colors flex items-center gap-1.5 active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xác Nhận Xóa Sạch Dữ Liệu</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

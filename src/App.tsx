import React, { useState, useEffect } from 'react';
import { Trash2, LogOut } from 'lucide-react';
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
import { SimplifiedNewPatientModal } from './components/SimplifiedNewPatientModal';
import { QuickEvolutionModal } from './components/QuickEvolutionModal';
import { PatientPrintModal } from './components/PatientPrintModal';
import { DoctorLoginScreen } from './components/DoctorLoginScreen';
import { SatelliteClinicalSyncModal } from './components/SatelliteClinicalSyncModal';
import { getSavedDoctorSession, saveDoctorSession, clearDoctorSession } from './utils/auth';
import { loadAppSettings, saveAppSettings, getFontSizeScale, AppSettings } from './utils/settings';
import { AppSettingsModal } from './components/AppSettingsModal';
import { ExcelDataSyncModal } from './components/ExcelDataSyncModal';
import { isRealAllergy } from './utils/clinicalTextParser';
import { 
  subscribeToClinicalRecords, 
  checkSatelliteRecordCompleteness, 
  mapClinicalRecordToPatient, 
  ClinicalRecord,
  loadPendingSatelliteRecords,
  savePendingSatelliteRecords,
  dismissPendingSatelliteRecord,
  deletePendingSatelliteRecord
} from './services/clinicalFirebase';

import { ChangePasswordModal } from './components/ChangePasswordModal';
import { WardRoomMap } from './components/WardRoomMap';
import { PatientTableView } from './components/PatientTableView';
import { DoctorAllocationView } from './components/DoctorAllocationView';
import { PatientDetailModal } from './components/PatientDetailModal';
import { NewPatientModal } from './components/NewPatientModal';
import { BedTransferModal } from './components/BedTransferModal';
import { ShiftHandoverModal } from './components/ShiftHandoverModal';
import { ClinicalWatchlistModal } from './components/ClinicalWatchlistModal';
import { DutyRosterModal } from './components/DutyRosterModal';
import { 
  subscribeToEmergencyRecords, 
  subscribeToDepartmentPatients,
  syncPatientToCloud,
  deletePatientFromCloud,
  deleteAllPatientsFromCloud,
  testCloudWrite, 
  syncAllPatientsToCloud, 
  SyncStatus 
} from './services/firebaseSync';

export default function App() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [rooms, setRooms] = useState<DepartmentRoom[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [authenticatedDoctor, setAuthenticatedDoctor] = useState<Doctor | null>(null);
  const [isAuthChecked, setIsAuthChecked] = useState(false);

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
  const [activeView, setActiveView] = useState<'detailed_list' | 'map' | 'table' | 'doctors'>('detailed_list');
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
    const initialPatients = loadPatients();
    const loadedDocs = loadDoctors();
    setPatients(initialPatients);
    setDoctors(loadedDocs);
    setRooms(loadRooms());

    // Restore saved authenticated doctor session
    const savedDoc = getSavedDoctorSession(loadedDocs);
    if (savedDoc) {
      setAuthenticatedDoctor(savedDoc);
    }
    setIsAuthChecked(true);
    setIsLoaded(true);

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

    // 2. Real-time background subscriber to Satellite Cloud Firestore (iron-foundation-kbcxw)
    const unsubSatellite = subscribeToClinicalRecords((satelliteRecords) => {
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

      const pendingQueue: ClinicalRecord[] = [];

      satelliteRecords.forEach((rec) => {
        const recordId = rec.id;
        if (deletedIds.includes(recordId) || processedIds.includes(recordId)) {
          return;
        }

        const completeness = checkSatelliteRecordCompleteness(rec);

        if (completeness.isComplete) {
          // Tự động nhập viện nếu đầy đủ thông tin (Họ tên, tuổi, số phòng)
          const name = (rec.patientName || rec.fullName || '').toLowerCase().trim();
          const rawRoom = String(rec.patientRoom || rec.roomNumber || '').replace(/\D/g, '');

          const currentPatientsList = loadPatients();
          const alreadyInDept = currentPatientsList.some((p) => {
            const pName = p.fullName.toLowerCase().trim();
            const pRoom = p.roomNumber.replace(/\D/g, '');
            return pName === name && (pRoom === rawRoom || !rawRoom);
          });

          if (!alreadyInDept) {
            const mappedPatient = mapClinicalRecordToPatient(rec, loadedDocs, loadRooms(), savedDoc?.id);
            
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
              message: `🎉 Tự động tiếp nhận Bệnh nhân mới từ Vệ Tinh: ${mappedPatient.fullName} (${mappedPatient.age}t, ${mappedPatient.gender}) -> Phòng ${mappedPatient.roomNumber} - ${mappedPatient.bedNumber}`,
              patient: mappedPatient,
            });
          }
        } else {
          // Hồ sơ thiếu thông tin -> Đưa vào hàng đợi 'Chờ bổ sung'
          pendingQueue.push(rec);
        }
      });

      if (pendingQueue.length > 0) {
        setPendingSatelliteRecords(pendingQueue);
        savePendingSatelliteRecords(pendingQueue);
      }
    });

    return () => {
      unsubDept();
      if (typeof unsubSatellite === 'function') unsubSatellite();
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
    const updated = [...newPatients, ...patients];
    setPatients(updated);
    savePatients(updated);
    setIsAutoSyncing(true);
    try {
      for (const p of newPatients) {
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
    const remaining = dismissPendingSatelliteRecord(recordId);
    setPendingSatelliteRecords(remaining);
  };

  // Xóa vĩnh viễn ca vệ tinh khỏi danh sách chờ bổ sung
  const handleDeletePendingSatellite = (recordId: string) => {
    const remaining = deletePendingSatelliteRecord(recordId);
    setPendingSatelliteRecords(remaining);
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
      clinicalNote: `Điều chuyển giường bệnh: Từ ${target.roomNumber} - ${target.bedNumber} sang ${newRoomNumber} - ${newBedNumber}.`,
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

  return (
    <div className={`min-h-screen ${fontSizeScaleClass} ${
      isDark ? 'bg-slate-950 text-slate-100 dark' : 'bg-slate-100/70 text-slate-900'
    } flex flex-col font-sans selection:bg-rose-500 selection:text-white transition-colors duration-200`}>
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
        pendingSatelliteCount={pendingSatelliteRecords.length}
        isAutoSyncing={isAutoSyncing}
        lastAutoSyncTime={lastAutoSyncTime}
      />

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
            onDeleteAllPatients={handleDeleteAllPatients}
            onOpenPrintModal={() => setIsPrintModalOpen(true)}
            onAddPatient={handleAddPatient}
            onOpenSatelliteSync={() => setIsSatelliteSyncOpen(true)}
            pendingSatelliteCount={pendingSatelliteRecords.length}
            pendingSatelliteRecords={pendingSatelliteRecords}
            onOpenSatelliteDraft={handleOpenSatelliteDraft}
            onDismissPendingSatelliteRecord={handleDeletePendingSatellite}
            onOpenExcelImport={() => setIsExcelImportOpen(true)}
          />
        )}

        {activeView === 'map' && (
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
        )}

        {activeView === 'table' && (
          <PatientTableView
            patients={patients}
            doctors={doctors}
            onSelectPatient={(p) => setSelectedPatient(p)}
            onTransferPatient={(p) => setTransferringPatient(p)}
            onUpdatePatient={handleUpdatePatient}
          />
        )}

        {activeView === 'doctors' && (
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
                    Phòng {actionConfirmModal.patient.roomNumber} - {actionConfirmModal.patient.bedNumber}
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
                    Phòng {actionConfirmModal.patient.roomNumber} - {actionConfirmModal.patient.bedNumber}
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

import React, { useState, useEffect } from 'react';
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
import { CloudSyncModal } from './components/CloudSyncModal';

// Preserve existing feature components (kept in codebase, not deleted)
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
  testCloudWrite, 
  syncAllPatientsToCloud, 
  SyncStatus 
} from './services/firebaseSync';

export default function App() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [rooms, setRooms] = useState<DepartmentRoom[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

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

  // Main active view: 'detailed_list' (Default and primary screen)
  const [activeView, setActiveView] = useState<'map' | 'table' | 'doctors'>('table');

  // Quick room doctor assignments map (persisted in localStorage)
  const [roomDoctorAssignments, setRoomDoctorAssignments] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('ROOM_DOCTOR_ASSIGNMENTS') || '{}');
    } catch {
      return {};
    }
  });

  // Modal states: Core workflow
  const [isSimplifiedNewPatientOpen, setIsSimplifiedNewPatientOpen] = useState(false);
  const [evolutionPatient, setEvolutionPatient] = useState<Patient | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isCloudSyncModalOpen, setIsCloudSyncModalOpen] = useState(false);

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
    setPatients(initialPatients);
    setDoctors(loadDoctors());
    setRooms(loadRooms());
    setIsLoaded(true);

    // 1. Automatic continuous 2-way sync for Inpatients in Khoa Nội Tổng Hợp
    const unsubDept = subscribeToDepartmentPatients(
      (cloudPatients) => {
        if (cloudPatients && cloudPatients.length > 0) {
          setPatients(cloudPatients);
          savePatients(cloudPatients);
          setLastAutoSyncTime(new Date().toLocaleTimeString('vi-VN'));
        }
      },
      (status) => {
        setSyncStatus(status);
        if (status.connected && status.lastSyncTime) {
          setLastAutoSyncTime(status.lastSyncTime);
        }
      },
      initialPatients
    );

    // 2. Subscribe to Khoa Cấp Cứu Firestore clinical_records
    const unsubEmergency = subscribeToEmergencyRecords(
      (newEmrPatient) => {
        setPatients((prev) => {
          const exists = prev.some((p) => p.id === newEmrPatient.id);
          const updated = exists
            ? prev.map((p) => (p.id === newEmrPatient.id ? newEmrPatient : p))
            : [newEmrPatient, ...prev];
          savePatients(updated);
          syncPatientToCloud(newEmrPatient);
          return updated;
        });

        setEmergencyAlert({
          message: `Tiếp nhận ca mới từ Cấp Cứu: ${newEmrPatient.fullName} • ${newEmrPatient.primaryDiagnosis}`,
          patient: newEmrPatient,
        });
      }
    );

    return () => {
      unsubDept();
      unsubEmergency();
    };
  }, []);

  // Sync patients changes to storage and cloud automatically in real-time
  const updatePatientsList = async (newPatients: Patient[]) => {
    setPatients(newPatients);
    savePatients(newPatients);
    setIsAutoSyncing(true);
    try {
      await syncAllPatientsToCloud(newPatients);
      setLastAutoSyncTime(new Date().toLocaleTimeString('vi-VN'));
    } catch (err) {
      console.warn('Auto sync cloud error:', err);
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
    } catch (err) {
      console.warn('Auto sync single patient error:', err);
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
    } catch (err) {
      console.warn('Auto sync new patient error:', err);
    } finally {
      setIsAutoSyncing(false);
    }
  };

  // Manual push on demand button handler
  const [manualPushMessage, setManualPushMessage] = useState<string | null>(null);

  const handleManualPushCloud = async () => {
    setIsAutoSyncing(true);
    setManualPushMessage('Đang đẩy toàn bộ danh sách bệnh nhân lên Cloud Firestore...');
    try {
      const res = await syncAllPatientsToCloud(patients);
      if (res.success) {
        setLastAutoSyncTime(new Date().toLocaleTimeString('vi-VN'));
        setManualPushMessage(`Đã đẩy thành công ${res.count} bệnh nhân lên Cloud Firestore (${new Date().toLocaleTimeString('vi-VN')})!`);
        setTimeout(() => setManualPushMessage(null), 4500);
      } else {
        setManualPushMessage(`Lỗi đẩy dữ liệu Cloud: ${res.error}`);
        setTimeout(() => setManualPushMessage(null), 5000);
      }
    } catch (err) {
      setManualPushMessage('Lỗi kết nối khi đẩy dữ liệu lên Cloud Firestore.');
      setTimeout(() => setManualPushMessage(null), 5000);
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

  // Handle doctor reassignment
  const handleReassignDoctor = (patientId: string, newDoctorId: string) => {
    const newDoc = doctors.find((d) => d.id === newDoctorId);
    const updated = patients.map((p) => {
      if (p.id === patientId) {
        const now = new Date();
        const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        return {
          ...p,
          attendingDoctorId: newDoctorId,
          evolutions: [
            {
              id: `EV-${Date.now()}`,
              timestamp: timeStr,
              doctorName: newDoc?.name || 'Trưởng khoa',
              shift: 'Sáng' as const,
              clinicalNote: `Chuyển phân công Bác sĩ điều trị chính sang: ${newDoc?.name || ''}.`,
              treatmentAction: 'Tiếp nhận ca bệnh và rà soát phác đồ.',
            },
            ...p.evolutions,
          ],
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

    // 2. Update all active patients in this room
    const targetDoc = doctors.find((d) => d.id === doctorId);
    const affectedPatients: Patient[] = [];

    const updatedPatients = patients.map((p) => {
      const pRoom = (p.roomNumber || '').replace(/^(phòng|p\.?)\s*/i, '').trim();
      if (pRoom === cleanRoom && p.status === 'ACTIVE') {
        const now = new Date();
        const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        const docEvolution = {
          id: `EV-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          timestamp: timeStr,
          doctorName: targetDoc?.name || 'BS Điều trị',
          shift: 'Sáng' as const,
          clinicalNote: `Phân công Bác sĩ điều trị buồng: BS. ${targetDoc?.name || ''}.`,
          treatmentAction: 'Tiếp nhận phụ trách buồng và rà soát phác đồ.',
        };

        const patUpdated: Patient = {
          ...p,
          attendingDoctorId: doctorId,
          evolutions: [docEvolution, ...(p.evolutions || [])],
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

  // Reset demo data
  const handleResetData = () => {
    const data = resetAllData();
    setPatients(data.patients);
    setDoctors(data.doctors);
    setRooms(data.rooms);
    setSelectedPatient(null);
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 border-4 border-rose-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-700">Đang tải dữ liệu Khoa Nội Tổng Hợp...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans selection:bg-rose-500 selection:text-white">
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
        onOpenCloudSync={() => setIsCloudSyncModalOpen(true)}
        onManualPushToCloud={handleManualPushCloud}
        onOpenDutySchedule={() => setIsDutyModalOpen(true)}
        onResetData={handleResetData}
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

      {/* Main Content Area - Core Detailed Patient List View */}
      <main className="flex-1 w-full px-2 sm:px-4 py-3">
        <DetailedPatientListView
          patients={patients}
          doctors={doctors}
          rooms={rooms}
          roomDoctorAssignments={roomDoctorAssignments}
          onAssignRoomDoctor={handleAssignRoomDoctor}
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
        />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-2.5 mt-auto no-print">
        <div className="w-full px-3 sm:px-6 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-700">BỆNH VIỆN HÙNG VƯƠNG GIA LAI</span>
            <span>• Khoa Nội Tổng Hợp - Tim Mạch</span>
            <span className="hidden md:inline">• Hệ thống Quản lý Bệnh nhân Nội trú & Nhập Diễn Tiến Hàng Ngày</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-50 border border-slate-200">
              <span className={`inline-block w-2 h-2 rounded-full ${syncStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-blue-400'}`} />
              <span className="font-medium text-[11px] text-slate-700">
                {syncStatus.connected 
                  ? `Realtime Cấp Cứu (Firestore) • Đã nhận: ${syncStatus.receivedCount}` 
                  : 'Lưu Trữ An Toàn & Sẵn Sàng Đồng Bộ Cloud'}
              </span>
            </div>
            <button
              onClick={() => setIsCloudSyncModalOpen(true)}
              className="font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
            >
              Quản lý Cloud
            </button>
          </div>
        </div>
      </footer>

      {/* 1. Simplified New Patient Admission Modal */}
      {isSimplifiedNewPatientOpen && (
        <SimplifiedNewPatientModal
          rooms={rooms}
          doctors={doctors}
          patients={patients}
          prefilledRoom={prefilledRoom}
          prefilledBed={prefilledBed}
          onClose={() => setIsSimplifiedNewPatientOpen(false)}
          onAddPatient={(newPatient) => {
            handleAddPatient(newPatient);
            setIsSimplifiedNewPatientOpen(false);
          }}
        />
      )}

      {/* 2. Simplified Daily Progress Note & Treatment Plan Modal */}
      {evolutionPatient && (
        <QuickEvolutionModal
          patient={evolutionPatient}
          doctors={doctors}
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
          onClose={() => setSelectedPatient(null)}
          onUpdatePatient={handleUpdatePatient}
        />
      )}

      {/* 4. Cloud Sync Modal */}
      {isCloudSyncModalOpen && (
        <CloudSyncModal
          patients={patients}
          syncStatus={syncStatus}
          onClose={() => setIsCloudSyncModalOpen(false)}
          onPatientsLoadedFromCloud={(loaded) => {
            setPatients(loaded);
            savePatients(loaded);
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
    </div>
  );
}

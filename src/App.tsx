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
import { subscribeToEmergencyRecords, testCloudWrite, syncAllPatientsToCloud, SyncStatus } from './services/firebaseSync';

export default function App() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [rooms, setRooms] = useState<DepartmentRoom[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Firestore Sync State
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    connected: false,
    lastSyncTime: null,
    receivedCount: 0,
    errorMessage: null,
  });
  const [emergencyAlert, setEmergencyAlert] = useState<{ message: string; patient: Patient } | null>(null);

  // Main active view: 'detailed_list' (Default and primary screen)
  const [activeView, setActiveView] = useState<'map' | 'table' | 'doctors'>('table');

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

  // Initial load
  useEffect(() => {
    setPatients(loadPatients());
    setDoctors(loadDoctors());
    setRooms(loadRooms());
    setIsLoaded(true);

    // Subscribe to Khoa Cấp Cứu Firestore clinical_records
    const unsubscribe = subscribeToEmergencyRecords(
      (newEmrPatient) => {
        setPatients((prev) => {
          const exists = prev.some((p) => p.id === newEmrPatient.id);
          const updated = exists
            ? prev.map((p) => (p.id === newEmrPatient.id ? newEmrPatient : p))
            : [newEmrPatient, ...prev];
          savePatients(updated);
          return updated;
        });

        setEmergencyAlert({
          message: `Tiếp nhận ca mới từ Cấp Cứu: ${newEmrPatient.fullName} • ${newEmrPatient.primaryDiagnosis}`,
          patient: newEmrPatient,
        });
      },
      (status) => {
        setSyncStatus(status);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Sync patients changes to storage and cloud
  const updatePatientsList = (newPatients: Patient[]) => {
    setPatients(newPatients);
    savePatients(newPatients);
    syncAllPatientsToCloud(newPatients);
  };

  // Handle single patient update
  const handleUpdatePatient = (updatedPatient: Patient) => {
    const updated = patients.map((p) =>
      p.id === updatedPatient.id ? updatedPatient : p
    );
    updatePatientsList(updated);
    if (selectedPatient?.id === updatedPatient.id) {
      setSelectedPatient(updatedPatient);
    }
  };

  // Handle new patient admission
  const handleAddPatient = (newPatient: Patient) => {
    const updated = [newPatient, ...patients];
    updatePatientsList(updated);
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
        onOpenDutySchedule={() => setIsDutyModalOpen(true)}
        onResetData={handleResetData}
      />

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
          onOpenNewPatient={() => setIsSimplifiedNewPatientOpen(true)}
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

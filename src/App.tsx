import React, { useState, Suspense } from 'react';
import { Patient, Doctor } from './types/patient';
import { loadDoctors } from './utils/storage';
import { Header } from './components/Header';
import { DetailedPatientListView } from './components/DetailedPatientListView';
import { DoctorLoginScreen } from './components/DoctorLoginScreen';
import { getSavedDoctorSession, saveDoctorSession, clearDoctorSession } from './utils/auth';
import { loadAppSettings, saveAppSettings, getFontSizeScale, AppSettings, FONT_FAMILY_MAP } from './utils/settings';
import { ClinicalRecord } from './services/clinicalFirebase';
import { useWardData } from './hooks/useWardData';
import { useDuplicatePatients } from './hooks/useDuplicatePatients';
import { WardBanners } from './components/WardBanners';
import { WardModals } from './components/WardModals';

// Lazy load secondary main view tabs to keep initial bundle size lean
const WardRoomMap = React.lazy(() => import('./components/WardRoomMap').then(m => ({ default: m.WardRoomMap })));
const PatientTableView = React.lazy(() => import('./components/PatientTableView').then(m => ({ default: m.PatientTableView })));
const DoctorAllocationView = React.lazy(() => import('./components/DoctorAllocationView').then(m => ({ default: m.DoctorAllocationView })));
const ClinicalKardexView = React.lazy(() => import('./components/ClinicalKardexView').then(m => ({ default: m.ClinicalKardexView })));

export default function App() {
  // 1. Doctor Authentication State
  const [authenticatedDoctor, setAuthenticatedDoctor] = useState<Doctor | null>(() => {
    const loadedDocs = loadDoctors();
    return getSavedDoctorSession(loadedDocs);
  });
  const [isLoaded] = useState(true);
  const [isAuthChecked] = useState(true);

  // 2. App Settings & Theme
  const [appSettings, setAppSettings] = useState<AppSettings>(loadAppSettings);
  const handleUpdateSettings = (newSettings: AppSettings) => {
    setAppSettings(newSettings);
    saveAppSettings(newSettings);
  };

  // 3. Navigation View Mode
  const [activeView, setActiveView] = useState<'detailed_list' | 'kardex' | 'map' | 'table' | 'doctors'>('detailed_list');

  // 4. Modal Visibility & Prefill States
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [evolutionPatient, setEvolutionPatient] = useState<Patient | null>(null);
  const [isSimplifiedNewPatientOpen, setIsSimplifiedNewPatientOpen] = useState(false);
  const [prefilledRoom, setPrefilledRoom] = useState<string | undefined>(undefined);
  const [prefilledBed, setPrefilledBed] = useState<string | undefined>(undefined);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isSatelliteSyncOpen, setIsSatelliteSyncOpen] = useState(false);
  const [satelliteImportDraft, setSatelliteImportDraft] = useState<Patient | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isDischargedModalOpen, setIsDischargedModalOpen] = useState(false);

  // Legacy modals preserved
  const [transferringPatient, setTransferringPatient] = useState<Patient | null>(null);
  const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [isWatchlistModalOpen, setIsWatchlistModalOpen] = useState(false);
  const [isDutyModalOpen, setIsDutyModalOpen] = useState(false);

  // Confirm dialogs
  const [actionConfirmModal, setActionConfirmModal] = useState<{
    type: 'DELETE' | 'DISCHARGE';
    patient: Patient;
  } | null>(null);
  const [showDeleteAllConfirmModal, setShowDeleteAllConfirmModal] = useState(false);

  // 5. Core Ward Data Hook (patients, realtime sync, mutations)
  const {
    patients,
    doctors,
    rooms,
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
    handleUpdatePatient,
    handleAddPatient,
    handleImportMultiplePatients,
    handleAutoDischargePatients,
    handleRestoreSinglePatient,
    handleRestoreNov16Discharged,
    confirmDeletePatient,
    confirmDischargePatient,
    confirmDeleteAllPatients,
    handleManualPushCloud,
    handleTransferPatient,
    handleAssignRoomDoctor,
    handleOpenSatelliteDraft: createSatelliteDraft,
    handleDismissPendingSatellite,
    handleDeletePendingSatellite,
  } = useWardData({
    authenticatedDoctor,
    appSettings,
    onPatientRemoved: (pId) => {
      if (selectedPatient?.id === pId) {
        setSelectedPatient(null);
      }
    },
    onPatientUpdated: (updated) => {
      if (selectedPatient?.id === updated.id) {
        setSelectedPatient(updated);
      }
    },
  });

  // 6. Daily Duplicate Patient Audit Hook
  const {
    isDuplicateModalOpen,
    setIsDuplicateModalOpen,
    duplicatePatientGroups,
    handleDismissDuplicatePair,
    handleMergePatients,
  } = useDuplicatePatients({
    patients,
    onUpdatePatient: handleUpdatePatient,
    onDeletePatient: confirmDeletePatient,
  });

  // 7. Action Confirm Handlers
  const handleDeletePatient = (patient: Patient) => {
    setActionConfirmModal({ type: 'DELETE', patient });
  };

  const handleDischargePatient = (patient: Patient) => {
    setActionConfirmModal({ type: 'DISCHARGE', patient });
  };

  const handleDeleteAllPatients = () => {
    setShowDeleteAllConfirmModal(true);
  };

  const handleOpenSatelliteDraft = (record: ClinicalRecord) => {
    const draft = createSatelliteDraft(record);
    setSatelliteImportDraft(draft);
  };

  // 8. Auth handlers
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
        dischargedCount={dischargedPatients.length}
        nov16DischargedCount={nov16DischargedCount}
        onOpenDischargedModal={() => setIsDischargedModalOpen(true)}
        pendingSatelliteCount={pendingSatelliteRecords.length}
        isAutoSyncing={isAutoSyncing}
        lastAutoSyncTime={lastAutoSyncTime}
      />

      {/* Top Warning & Notification Banners */}
      <WardBanners
        duplicatePatientGroups={duplicatePatientGroups}
        isDuplicateModalOpen={isDuplicateModalOpen}
        onOpenDuplicateModal={() => setIsDuplicateModalOpen(true)}
        dischargedPatients={dischargedPatients}
        isDischargedModalOpen={isDischargedModalOpen}
        onOpenDischargedModal={() => setIsDischargedModalOpen(true)}
        onRestoreNov16Discharged={handleRestoreNov16Discharged}
        isAutoSyncing={isAutoSyncing}
        manualPushMessage={manualPushMessage}
        onClearManualPushMessage={() => setManualPushMessage(null)}
        emergencyAlert={emergencyAlert}
        onSelectPatient={(p) => setSelectedPatient(p)}
        onClearEmergencyAlert={() => setEmergencyAlert(null)}
      />

      {/* Main Content Area - Dynamic View Based on Tab */}
      <main className="flex-1 w-full px-1 sm:px-4 py-2 sm:py-3">
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
            onOpenEvolution={(patient) => setEditingPatient(patient)}
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
              onOpenEvolution={(p) => setEditingPatient(p)}
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

      {/* All Dialogs & Modals Container */}
      <WardModals
        patients={patients}
        doctors={doctors}
        rooms={rooms}
        currentUser={authenticatedDoctor}
        appSettings={appSettings}
        onUpdateSettings={handleUpdateSettings}
        isSimplifiedNewPatientOpen={isSimplifiedNewPatientOpen}
        setIsSimplifiedNewPatientOpen={setIsSimplifiedNewPatientOpen}
        prefilledRoom={prefilledRoom}
        prefilledBed={prefilledBed}
        editingPatient={editingPatient}
        setEditingPatient={setEditingPatient}
        evolutionPatient={evolutionPatient}
        setEvolutionPatient={setEvolutionPatient}
        selectedPatient={selectedPatient}
        setSelectedPatient={setSelectedPatient}
        isPrintModalOpen={isPrintModalOpen}
        setIsPrintModalOpen={setIsPrintModalOpen}
        isSatelliteSyncOpen={isSatelliteSyncOpen}
        setIsSatelliteSyncOpen={setIsSatelliteSyncOpen}
        satelliteImportDraft={satelliteImportDraft}
        setSatelliteImportDraft={setSatelliteImportDraft}
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        isExcelImportOpen={isExcelImportOpen}
        setIsExcelImportOpen={setIsExcelImportOpen}
        isChangePasswordOpen={isChangePasswordOpen}
        setIsChangePasswordOpen={setIsChangePasswordOpen}
        isDuplicateModalOpen={isDuplicateModalOpen}
        setIsDuplicateModalOpen={setIsDuplicateModalOpen}
        duplicatePatientGroups={duplicatePatientGroups}
        isDischargedModalOpen={isDischargedModalOpen}
        setIsDischargedModalOpen={setIsDischargedModalOpen}
        transferringPatient={transferringPatient}
        setTransferringPatient={setTransferringPatient}
        isNewPatientModalOpen={isNewPatientModalOpen}
        setIsNewPatientModalOpen={setIsNewPatientModalOpen}
        isHandoverModalOpen={isHandoverModalOpen}
        setIsHandoverModalOpen={setIsHandoverModalOpen}
        isWatchlistModalOpen={isWatchlistModalOpen}
        setIsWatchlistModalOpen={setIsWatchlistModalOpen}
        isDutyModalOpen={isDutyModalOpen}
        setIsDutyModalOpen={setIsDutyModalOpen}
        actionConfirmModal={actionConfirmModal}
        setActionConfirmModal={setActionConfirmModal}
        showDeleteAllConfirmModal={showDeleteAllConfirmModal}
        setShowDeleteAllConfirmModal={setShowDeleteAllConfirmModal}
        pendingSatelliteRecords={pendingSatelliteRecords}
        setPendingSatelliteRecords={setPendingSatelliteRecords}
        onAddPatient={handleAddPatient}
        onUpdatePatient={handleUpdatePatient}
        onDeletePatient={confirmDeletePatient}
        onDischargePatient={confirmDischargePatient}
        onDeleteAllPatients={confirmDeleteAllPatients}
        onTransferPatient={handleTransferPatient}
        onImportMultiplePatients={handleImportMultiplePatients}
        onAutoDischargePatients={handleAutoDischargePatients}
        onRestorePatient={handleRestoreSinglePatient}
        onRestoreMultiplePatients={handleRestoreNov16Discharged}
        onMergePatients={handleMergePatients}
        onDismissDuplicatePair={handleDismissDuplicatePair}
        onDismissPendingSatellite={handleDismissPendingSatellite}
        onDeletePendingSatellite={handleDeletePendingSatellite}
        onSetManualPushMessage={(msg) => {
          setManualPushMessage(msg);
          if (msg) setTimeout(() => setManualPushMessage(null), 5000);
        }}
      />
    </div>
  );
}

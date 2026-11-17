import React, { Suspense } from 'react';
import { Trash2, LogOut } from 'lucide-react';
import { Patient, Doctor, DepartmentRoom } from '../types/patient';
import { AppSettings } from '../utils/settings';
import { ClinicalRecord, loadPendingSatelliteRecords, savePendingSatelliteRecords } from '../services/clinicalFirebase';
import { DuplicatePatientGroup } from '../utils/excelParser';

// Lazy loaded modals
const SimplifiedNewPatientModal = React.lazy(() => import('./SimplifiedNewPatientModal').then(m => ({ default: m.SimplifiedNewPatientModal })));
const QuickEvolutionModal = React.lazy(() => import('./QuickEvolutionModal').then(m => ({ default: m.QuickEvolutionModal })));
const PatientPrintModal = React.lazy(() => import('./PatientPrintModal').then(m => ({ default: m.PatientPrintModal })));
const SatelliteClinicalSyncModal = React.lazy(() => import('./SatelliteClinicalSyncModal').then(m => ({ default: m.SatelliteClinicalSyncModal })));
const AppSettingsModal = React.lazy(() => import('./AppSettingsModal').then(m => ({ default: m.AppSettingsModal })));
const ExcelDataSyncModal = React.lazy(() => import('./ExcelDataSyncModal').then(m => ({ default: m.ExcelDataSyncModal })));
const ChangePasswordModal = React.lazy(() => import('./ChangePasswordModal').then(m => ({ default: m.ChangePasswordModal })));
const PatientDetailModal = React.lazy(() => import('./PatientDetailModal').then(m => ({ default: m.PatientDetailModal })));
const NewPatientModal = React.lazy(() => import('./NewPatientModal').then(m => ({ default: m.NewPatientModal })));
const BedTransferModal = React.lazy(() => import('./BedTransferModal').then(m => ({ default: m.BedTransferModal })));
const ShiftHandoverModal = React.lazy(() => import('./ShiftHandoverModal').then(m => ({ default: m.ShiftHandoverModal })));
const ClinicalWatchlistModal = React.lazy(() => import('./ClinicalWatchlistModal').then(m => ({ default: m.ClinicalWatchlistModal })));
const DutyRosterModal = React.lazy(() => import('./DutyRosterModal').then(m => ({ default: m.DutyRosterModal })));
const DuplicatePatientsModal = React.lazy(() => import('./DuplicatePatientsModal').then(m => ({ default: m.DuplicatePatientsModal })));
const DischargedPatientsModal = React.lazy(() => import('./DischargedPatientsModal').then(m => ({ default: m.DischargedPatientsModal })));

export interface WardModalsProps {
  patients: Patient[];
  doctors: Doctor[];
  rooms: DepartmentRoom[];
  currentUser: Doctor | null;
  appSettings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;

  // Modal states
  isSimplifiedNewPatientOpen: boolean;
  setIsSimplifiedNewPatientOpen: (open: boolean) => void;
  prefilledRoom?: string;
  prefilledBed?: string;
  editingPatient: Patient | null;
  setEditingPatient: (p: Patient | null) => void;
  evolutionPatient: Patient | null;
  setEvolutionPatient: (p: Patient | null) => void;
  selectedPatient: Patient | null;
  setSelectedPatient: (p: Patient | null) => void;
  isPrintModalOpen: boolean;
  setIsPrintModalOpen: (open: boolean) => void;
  isSatelliteSyncOpen: boolean;
  setIsSatelliteSyncOpen: (open: boolean) => void;
  satelliteImportDraft: Patient | null;
  setSatelliteImportDraft: (draft: Patient | null) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  isExcelImportOpen: boolean;
  setIsExcelImportOpen: (open: boolean) => void;
  isChangePasswordOpen: boolean;
  setIsChangePasswordOpen: (open: boolean) => void;
  isDuplicateModalOpen: boolean;
  setIsDuplicateModalOpen: (open: boolean) => void;
  duplicatePatientGroups: DuplicatePatientGroup[];
  isDischargedModalOpen: boolean;
  setIsDischargedModalOpen: (open: boolean) => void;

  // Legacy modals
  transferringPatient: Patient | null;
  setTransferringPatient: (p: Patient | null) => void;
  isNewPatientModalOpen: boolean;
  setIsNewPatientModalOpen: (open: boolean) => void;
  isHandoverModalOpen: boolean;
  setIsHandoverModalOpen: (open: boolean) => void;
  isWatchlistModalOpen: boolean;
  setIsWatchlistModalOpen: (open: boolean) => void;
  isDutyModalOpen: boolean;
  setIsDutyModalOpen: (open: boolean) => void;

  // Confirmations
  actionConfirmModal: { type: 'DELETE' | 'DISCHARGE'; patient: Patient } | null;
  setActionConfirmModal: (val: { type: 'DELETE' | 'DISCHARGE'; patient: Patient } | null) => void;
  showDeleteAllConfirmModal: boolean;
  setShowDeleteAllConfirmModal: (show: boolean) => void;

  // Satellite pending
  pendingSatelliteRecords: ClinicalRecord[];
  setPendingSatelliteRecords: React.Dispatch<React.SetStateAction<ClinicalRecord[]>>;

  // Handlers
  onAddPatient: (p: Patient) => Promise<void>;
  onUpdatePatient: (p: Patient) => Promise<void>;
  onDeletePatient: (p: Patient) => Promise<void>;
  onDischargePatient: (p: Patient) => Promise<void>;
  onDeleteAllPatients: () => Promise<void>;
  onTransferPatient: (patientId: string, newRoom: string, newBed: string) => void;
  onImportMultiplePatients: (patients: Patient[]) => Promise<void>;
  onAutoDischargePatients: (patients: Patient[]) => Promise<void>;
  onRestorePatient: (patient: Patient, targetRoom?: string) => Promise<void>;
  onRestoreMultiplePatients: (patients?: Patient[]) => Promise<void>;
  onMergePatients: (primary: Patient, duplicate: Patient) => Promise<void>;
  onDismissDuplicatePair: (idA: string, idB: string) => void;
  onDismissPendingSatellite: (recordId: string) => void;
  onDeletePendingSatellite: (recordId: string) => void;
  onSetManualPushMessage: (msg: string | null) => void;
}

export const WardModals: React.FC<WardModalsProps> = ({
  patients,
  doctors,
  rooms,
  currentUser,
  appSettings,
  onUpdateSettings,
  isSimplifiedNewPatientOpen,
  setIsSimplifiedNewPatientOpen,
  prefilledRoom,
  prefilledBed,
  editingPatient,
  setEditingPatient,
  evolutionPatient,
  setEvolutionPatient,
  selectedPatient,
  setSelectedPatient,
  isPrintModalOpen,
  setIsPrintModalOpen,
  isSatelliteSyncOpen,
  setIsSatelliteSyncOpen,
  satelliteImportDraft,
  setSatelliteImportDraft,
  isSettingsOpen,
  setIsSettingsOpen,
  isExcelImportOpen,
  setIsExcelImportOpen,
  isChangePasswordOpen,
  setIsChangePasswordOpen,
  isDuplicateModalOpen,
  setIsDuplicateModalOpen,
  duplicatePatientGroups,
  isDischargedModalOpen,
  setIsDischargedModalOpen,
  transferringPatient,
  setTransferringPatient,
  isNewPatientModalOpen,
  setIsNewPatientModalOpen,
  isHandoverModalOpen,
  setIsHandoverModalOpen,
  isWatchlistModalOpen,
  setIsWatchlistModalOpen,
  isDutyModalOpen,
  setIsDutyModalOpen,
  actionConfirmModal,
  setActionConfirmModal,
  showDeleteAllConfirmModal,
  setShowDeleteAllConfirmModal,
  pendingSatelliteRecords,
  setPendingSatelliteRecords,
  onAddPatient,
  onUpdatePatient,
  onDeletePatient,
  onDischargePatient,
  onDeleteAllPatients,
  onTransferPatient,
  onImportMultiplePatients,
  onAutoDischargePatients,
  onRestorePatient,
  onRestoreMultiplePatients,
  onMergePatients,
  onDismissDuplicatePair,
  onDismissPendingSatellite,
  onDeletePendingSatellite,
  onSetManualPushMessage,
}) => {
  return (
    <>
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
                    onClick={async () => {
                      const p = actionConfirmModal.patient;
                      setActionConfirmModal(null);
                      await onDeletePatient(p);
                    }}
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
                    onClick={async () => {
                      const p = actionConfirmModal.patient;
                      setActionConfirmModal(null);
                      await onDischargePatient(p);
                    }}
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
            currentUser={currentUser}
            onClose={() => setIsSimplifiedNewPatientOpen(false)}
            onAddPatient={(newPatient) => {
              onAddPatient(newPatient);
              setIsSimplifiedNewPatientOpen(false);
            }}
          />
        )}

        {/* 1b. Edit Patient Modal */}
        {editingPatient && (
          <SimplifiedNewPatientModal
            rooms={rooms}
            doctors={doctors}
            patients={patients}
            patientToEdit={editingPatient}
            currentUser={currentUser}
            onClose={() => setEditingPatient(null)}
            onUpdatePatient={(updatedPatient) => {
              onUpdatePatient(updatedPatient);
              setEditingPatient(null);
            }}
          />
        )}

        {/* 2. Simplified Daily Progress Note Modal */}
        {evolutionPatient && (
          <QuickEvolutionModal
            patient={evolutionPatient}
            doctors={doctors}
            currentUser={currentUser}
            onClose={() => setEvolutionPatient(null)}
            onSaveEvolution={(updatedPatient) => {
              onUpdatePatient(updatedPatient);
              setEvolutionPatient(null);
            }}
          />
        )}

        {/* 3. Patient Full Detail Modal */}
        {selectedPatient && (
          <PatientDetailModal
            patient={selectedPatient}
            doctors={doctors}
            currentUser={currentUser}
            onClose={() => setSelectedPatient(null)}
            onUpdatePatient={onUpdatePatient}
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
            currentUser={currentUser}
            onClose={() => setIsSatelliteSyncOpen(false)}
            onImportPatientDirect={(newPat) => {
              onAddPatient(newPat);
              if (newPat.patientCode) {
                onDismissPendingSatellite(newPat.patientCode);
              }
            }}
            onImportMultiplePatients={(newPatientsList) => {
              onImportMultiplePatients(newPatientsList);
              newPatientsList.forEach(p => {
                if (p.patientCode) onDismissPendingSatellite(p.patientCode);
              });
            }}
            onOpenEditAdmission={(prefilledPatient) => {
              setSatelliteImportDraft(prefilledPatient);
              setIsSatelliteSyncOpen(false);
            }}
            onOpenExcelImport={() => setIsExcelImportOpen(true)}
            pendingSatelliteRecords={pendingSatelliteRecords}
            onDismissPendingRecord={onDeletePendingSatellite}
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
            currentUser={currentUser}
            onClose={() => setSatelliteImportDraft(null)}
            onAddPatient={(newPatient) => {
              onAddPatient(newPatient);
              if (newPatient.patientCode) {
                onDismissPendingSatellite(newPatient.patientCode);
              }
              if (satelliteImportDraft.id) {
                onDismissPendingSatellite(satelliteImportDraft.id);
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
            onUpdateSettings={onUpdateSettings}
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
            currentUser={currentUser}
            onClose={() => setIsExcelImportOpen(false)}
            onImportPatientDirect={(newPat) => {
              onAddPatient(newPat);
              if (newPat.patientCode) {
                onDismissPendingSatellite(newPat.patientCode);
              }
            }}
            onImportMultiplePatients={onImportMultiplePatients}
            onAutoDischargePatients={onAutoDischargePatients}
            onReactivatePatient={(pat) => {
              onUpdatePatient(pat);
            }}
            onDismissPendingSatelliteRecord={onDismissPendingSatellite}
          />
        )}

        {/* 10. Change Password Modal */}
        {isChangePasswordOpen && currentUser && (
          <ChangePasswordModal
            doctor={currentUser}
            onClose={() => setIsChangePasswordOpen(false)}
            onSuccess={(msg) => {
              onSetManualPushMessage(msg);
              setTimeout(() => onSetManualPushMessage(null), 4000);
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
              onDeletePatient={(patient) => onDeletePatient(patient)}
              onMergePatients={onMergePatients}
              onDismissPair={onDismissDuplicatePair}
              onSelectPatient={(patient) => setSelectedPatient(patient)}
            />
          </Suspense>
        )}

        {/* 12. Discharged Patients & Restoration Modal */}
        {isDischargedModalOpen && (
          <Suspense fallback={null}>
            <DischargedPatientsModal
              patients={patients}
              rooms={rooms}
              onClose={() => setIsDischargedModalOpen(false)}
              onRestorePatient={onRestorePatient}
              onRestoreMultiplePatients={onRestoreMultiplePatients}
            />
          </Suspense>
        )}

        {/* Legacy Modals Preserved */}
        {transferringPatient && (
          <BedTransferModal
            patient={transferringPatient}
            rooms={rooms}
            patients={patients}
            onClose={() => setTransferringPatient(null)}
            onTransfer={onTransferPatient}
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
            onAddPatient={onAddPatient}
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
                Bác sĩ <strong className="text-rose-700">{currentUser?.name || 'Nguyễn Hữu Trung'}</strong> có chắc chắn muốn <strong className="text-rose-700 uppercase">XÓA VĨNH VIỄN TOÀN BỘ</strong> tất cả ({patients.filter((p) => p.status === 'ACTIVE').length}) bệnh nhân nội trú khỏi hệ thống?
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
                onClick={async () => {
                  setShowDeleteAllConfirmModal(false);
                  await onDeleteAllPatients();
                }}
                className="px-5 py-2 font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md text-xs cursor-pointer transition-colors flex items-center gap-1.5 active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xác Nhận Xóa Sạch Dữ Liệu</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

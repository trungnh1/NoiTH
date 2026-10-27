import React, { useState } from 'react';
import { DepartmentRoom, Patient } from '../types/patient';
import { X, ArrowRightLeft } from 'lucide-react';
import { GROUP_1_ROOM_NUMBERS } from './DetailedPatientListView';

interface BedTransferModalProps {
  patient: Patient;
  rooms: DepartmentRoom[];
  patients: Patient[];
  onClose: () => void;
  onTransfer: (patientId: string, newRoomNumber: string, newBedNumber: string) => void;
}

export const BedTransferModal: React.FC<BedTransferModalProps> = ({
  patient,
  rooms,
  patients,
  onClose,
  onTransfer,
}) => {
  const currentRoomClean = patient.roomNumber ? patient.roomNumber.replace(/^(phòng|p\.?)\s*/i, '').trim() : '703';
  const [selectedRoomNumber, setSelectedRoomNumber] = useState(currentRoomClean);

  // Group 1 room numbers vs Other room numbers
  const group1Rooms = GROUP_1_ROOM_NUMBERS;
  const otherRooms = rooms
    .map((r) => (r.number || '').replace(/^(phòng|p\.?)\s*/i, '').trim())
    .filter((num) => num && !group1Rooms.includes(num));

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    onTransfer(patient.id, selectedRoomNumber, patient.bedNumber || 'Giường 01');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-rose-400" />
            <h3 className="text-base font-extrabold tracking-tight">
              Chuyển Buồng Phòng Bệnh
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleConfirm} className="p-5 space-y-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Bệnh nhân
            </span>
            <div className="font-extrabold text-slate-900 text-sm mt-0.5">
              {patient.fullName} ({patient.medicalRecordNumber || patient.patientCode})
            </div>
            <div className="text-slate-600 mt-0.5">
              Vị trí hiện tại: <b className="text-rose-700">Phòng {currentRoomClean}</b>
            </div>
          </div>

          <div>
            <label className="font-extrabold text-slate-800 block mb-1.5 text-xs">
              Chọn buồng phòng bệnh mới
            </label>
            <select
              value={selectedRoomNumber}
              onChange={(e) => setSelectedRoomNumber(e.target.value)}
              className="w-full p-3 bg-white border border-slate-300 rounded-xl font-extrabold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500 cursor-pointer text-sm"
            >
              <optgroup label="Nhóm 1 (Khoa Nội TH)" className="font-bold text-slate-900 bg-white">
                {group1Rooms.map((roomNum) => (
                  <option key={roomNum} value={roomNum}>
                    Phòng {roomNum}
                  </option>
                ))}
              </optgroup>
              {otherRooms.length > 0 && (
                <optgroup label="Nhóm phòng khác" className="font-bold text-slate-900 bg-white">
                  {otherRooms.map((roomNum) => (
                    <option key={roomNum} value={roomNum}>
                      Phòng {roomNum}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 font-extrabold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>Xác Nhận Chuyển Phòng</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

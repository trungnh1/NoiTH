import React, { useState } from 'react';
import { DepartmentRoom, Patient } from '../types/patient';
import { X, ArrowRightLeft, CheckCircle2 } from 'lucide-react';

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
  const [selectedRoomNumber, setSelectedRoomNumber] = useState(patient.roomNumber);
  const [selectedBedNumber, setSelectedBedNumber] = useState(patient.bedNumber);

  const targetRoom = rooms.find((r) => r.number === selectedRoomNumber);
  const beds = Array.from({ length: targetRoom?.totalBeds || 4 }, (_, i) => {
    const num = i + 1;
    return `Giường ${num < 10 ? '0' + num : num}`;
  });

  // Check if a bed in selected room is occupied by someone else
  const isBedOccupiedByOther = (roomNum: string, bedNum: string) => {
    return patients.some(
      (p) =>
        p.status === 'ACTIVE' &&
        p.id !== patient.id &&
        p.roomNumber === roomNum &&
        p.bedNumber === bedNum
    );
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    onTransfer(patient.id, selectedRoomNumber, selectedBedNumber);
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
              Điều Chuyển Buồng / Giường Bệnh
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
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
              {patient.fullName} ({patient.medicalRecordNumber})
            </div>
            <div className="text-slate-500 mt-0.5">
              Vị trí hiện tại: <b className="text-rose-700">{patient.roomNumber} - {patient.bedNumber}</b>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Chọn buồng bệnh đích
            </label>
            <select
              value={selectedRoomNumber}
              onChange={(e) => {
                setSelectedRoomNumber(e.target.value);
                setSelectedBedNumber('Giường 01');
              }}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              {rooms.map((room) => (
                <option key={room.id} value={room.number}>
                  {room.number} - {room.name} ({room.description})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Chọn số giường tại {selectedRoomNumber}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {beds.map((b) => {
                const occupied = isBedOccupiedByOther(selectedRoomNumber, b);
                const isSelected = selectedBedNumber === b;

                return (
                  <button
                    type="button"
                    key={b}
                    disabled={occupied}
                    onClick={() => setSelectedBedNumber(b)}
                    className={`p-2.5 rounded-xl border font-bold text-left transition-all ${
                      isSelected
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : occupied
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-rose-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{b}</span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                    <span className="block text-[10px] font-normal mt-0.5">
                      {occupied ? 'Đã có người nằm' : 'Giường trống'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-all flex items-center gap-1.5"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>Xác Nhận Chuyển</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

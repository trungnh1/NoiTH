import React, { useState } from 'react';
import { 
  Building2, 
  Stethoscope, 
  Lock, 
  User, 
  KeyRound, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight
} from 'lucide-react';
import { Doctor } from '../types/patient';
import { verifyDoctorLogin } from '../utils/auth';

interface DoctorLoginScreenProps {
  doctors: Doctor[];
  onLoginSuccess: (doctor: Doctor) => void;
}

export const DoctorLoginScreen: React.FC<DoctorLoginScreenProps> = ({
  doctors,
  onLoginSuccess,
}) => {
  const [doctorIdInput, setDoctorIdInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedDoctorPreview, setSelectedDoctorPreview] = useState<Doctor | null>(null);

  // Exclude any obsolete doctors (Tuế, Quyên)
  const validDoctors = doctors.filter(
    (d) => !['00101', '00199'].includes(d.id) && !/tuế|quyên/i.test(d.name)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const result = verifyDoctorLogin(doctorIdInput, passwordInput, validDoctors);
    if (result.success && result.doctor) {
      onLoginSuccess(result.doctor);
    } else {
      setErrorMessage(result.error || 'Đăng nhập không thành công.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-800">
      <div className="w-full max-w-md space-y-6">
        
        {/* Hospital Branding Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 shadow-sm text-xs font-bold uppercase tracking-wider">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span>Bệnh Viện Hùng Vương Gia Lai</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center justify-center gap-2">
            <span>Khoa Nội Tổng Hợp - Tim Mạch</span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Hệ thống Quản lý Bệnh nhân Nội trú & Diễn tiến Lâm sàng
          </p>
        </div>

        {/* Centered Clean Login Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 sm:p-8 space-y-5">
          
          <div>
            <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider mb-1">
              <Stethoscope className="w-4 h-4" />
              <span>Xác thực Bác sĩ</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              Đăng Nhập
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Nhập mã Bác sĩ để truy cập hồ sơ bệnh nhân nội trú.
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Doctor ID */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Mã Bác Sĩ <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  value={doctorIdInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDoctorIdInput(val);
                    setErrorMessage(null);
                    const trimmed = val.trim();
                    const matched = validDoctors.find(
                      d => d.id === trimmed || d.id.replace(/^0+/, '') === trimmed
                    );
                    setSelectedDoctorPreview(matched || null);
                  }}
                  placeholder="VD: 00979"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all placeholder:font-normal placeholder:text-slate-400"
                />
              </div>
              {selectedDoctorPreview && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-semibold bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Bác sĩ: {selectedDoctorPreview.name}</span>
                </div>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Mật Khẩu <span className="text-red-500">*</span>
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="Mật khẩu"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all placeholder:font-normal placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              className="w-full py-2.5 px-4 mt-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm rounded-xl shadow-sm hover:shadow transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              <span>Đăng Nhập</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

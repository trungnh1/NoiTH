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
  ArrowRight,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { Doctor } from '../types/patient';
import { verifyDoctorLoginAsync, saveDoctorPasswordToFirestore } from '../utils/auth';

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
  const [isVerifying, setIsVerifying] = useState(false);

  // First time password change state
  const [pendingFirstLoginDoctor, setPendingFirstLoginDoctor] = useState<Doctor | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Exclude any obsolete doctors (Tuế, Quyên)
  const validDoctors = doctors.filter(
    (d) => !['00101', '00199'].includes(d.id) && !/tuế|quyên/i.test(d.name)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsVerifying(true);

    try {
      const result = await verifyDoctorLoginAsync(doctorIdInput, passwordInput, validDoctors);
      if (result.success && result.doctor) {
        if (result.isFirstLogin) {
          setPendingFirstLoginDoctor(result.doctor);
        } else {
          onLoginSuccess(result.doctor);
        }
      } else {
        setErrorMessage(result.error || 'Đăng nhập không thành công.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi kiểm tra đăng nhập.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingFirstLoginDoctor) return;
    setChangeError(null);

    const pwd = newPassword.trim();
    const conf = confirmPassword.trim();

    if (!pwd || pwd.length < 3) {
      setChangeError('Mật khẩu mới phải có ít nhất 3 ký tự!');
      return;
    }

    if (pwd === '123') {
      setChangeError('Vui lòng chọn mật khẩu mới khác mật khẩu mặc định (123)!');
      return;
    }

    if (pwd !== conf) {
      setChangeError('Mật khẩu nhập lại không trùng khớp với mật khẩu mới!');
      return;
    }

    setIsSavingPassword(true);
    try {
      await saveDoctorPasswordToFirestore(
        pendingFirstLoginDoctor.id,
        pendingFirstLoginDoctor.name,
        pwd,
        false
      );
      onLoginSuccess(pendingFirstLoginDoctor);
    } catch (err: any) {
      setChangeError('Lỗi khi lưu mật khẩu lên Firestore: ' + (err.message || String(err)));
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-800">
      <div className="w-full max-w-md space-y-6">
        
        {/* Hospital Branding Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 shadow-xs text-xs font-bold uppercase tracking-wider">
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

        {/* First-Time Password Change Form */}
        {pendingFirstLoginDoctor ? (
          <div className="bg-white rounded-2xl shadow-xl border-2 border-indigo-400 p-6 sm:p-8 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 pb-3 border-b border-indigo-100">
              <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-black uppercase text-amber-800 tracking-wider">
                  Yêu Cầu Đổi Mật Khẩu Lần Đầu
                </span>
                <h2 className="text-base font-black text-slate-900 leading-tight">
                  {pendingFirstLoginDoctor.name} ({pendingFirstLoginDoctor.id})
                </h2>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Tài khoản của Bác sĩ đang sử dụng mật khẩu mặc định ban đầu (<strong className="font-extrabold text-amber-900">123</strong>). Để bảo mật thông tin hồ sơ bệnh nhân, vui lòng tạo mật khẩu mới. Thông tin đăng nhập mới sẽ được lưu trữ đồng bộ lên Cloud Firestore.
            </p>

            {changeError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{changeError}</span>
              </div>
            )}

            <form onSubmit={handleSaveNewPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Mật Khẩu Mới <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4 text-indigo-600" />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setChangeError(null);
                    }}
                    placeholder="Nhập mật khẩu mới (khác 123)"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Nhập Lại Mật Khẩu Mới <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4 text-indigo-600" />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setChangeError(null);
                    }}
                    placeholder="Xác nhận lại mật khẩu mới"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingPassword}
                className="w-full py-2.5 px-4 mt-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSavingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang lưu mật khẩu lên Firestore...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Lưu Mật Khẩu Mới & Đăng Nhập Ngay</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* Centered Clean Login Card */
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
                Nhập mã Bác sĩ và mật khẩu (mặc định lần đầu là <strong className="font-extrabold text-slate-800">123</strong>).
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
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-500 focus:bg-white transition-all placeholder:font-normal placeholder:text-slate-400"
                  />
                </div>
                {selectedDoctorPreview && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-800 font-semibold bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-700 shrink-0" />
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
                    placeholder="Mật khẩu (mặc định: 123)"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-500 focus:bg-white transition-all placeholder:font-normal placeholder:text-slate-400"
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
                disabled={isVerifying}
                className="w-full py-2.5 px-4 mt-2 bg-[#0b4d8c] hover:bg-[#083a69] active:bg-[#062c52] text-white font-bold text-sm rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang xác thực trên Firestore...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Đăng Nhập</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};

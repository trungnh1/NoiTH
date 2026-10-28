import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  RefreshCw, 
  Search, 
  Database, 
  Cloud, 
  CloudDownload, 
  CheckCircle2, 
  AlertCircle, 
  Stethoscope, 
  Activity, 
  HeartPulse, 
  User, 
  Building2, 
  Calendar, 
  FileText, 
  FlaskConical, 
  Check, 
  ShieldAlert,
  Lock,
  KeyRound,
  LogOut,
  ShieldCheck,
  FileSpreadsheet,
  Trash2
} from 'lucide-react';
import { Patient, Doctor, DepartmentRoom } from '../types/patient';
import { 
  ClinicalRecord, 
  subscribeToClinicalRecords, 
  fetchClinicalRecords, 
  mapClinicalRecordToPatient, 
  CLINICAL_DATABASE_ID,
  CLINICAL_COLLECTION,
  loginSatelliteGoogle,
  logoutSatelliteGoogle,
  subscribeSatelliteAuth,
  parseVitalSignsText,
  checkSatelliteRecordCompleteness,
  parseAgeNumber,
  deleteSatelliteRecord,
  formatSatelliteDateTime
} from '../services/clinicalFirebase';
import { User as FirebaseUser } from 'firebase/auth';

interface SatelliteClinicalSyncModalProps {
  currentPatients: Patient[];
  doctors: Doctor[];
  rooms: DepartmentRoom[];
  currentUser?: Doctor | null;
  onClose: () => void;
  onImportPatientDirect: (patient: Patient) => void;
  onOpenEditAdmission: (prefilledPatient: Patient) => void;
  onOpenExcelImport?: () => void;
}

export const SatelliteClinicalSyncModal: React.FC<SatelliteClinicalSyncModalProps> = ({
  currentPatients,
  doctors,
  rooms,
  currentUser,
  onClose,
  onImportPatientDirect,
  onOpenEditAdmission,
  onOpenExcelImport,
}) => {
  const [records, setRecords] = useState<ClinicalRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'critical'>('all');

  // Count pending records that are incomplete (missing name, age, or room)
  const pendingRecordsCount = useMemo(() => {
    return records.filter((rec) => !checkSatelliteRecordCompleteness(rec).isComplete).length;
  }, [records]);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  
  // Satellite Firebase Auth user
  const [satelliteAuthUser, setSatelliteAuthUser] = useState<FirebaseUser | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Subscribe to satellite Firebase Auth
  useEffect(() => {
    const unsubAuth = subscribeSatelliteAuth((user) => {
      setSatelliteAuthUser(user);
    });
    return () => unsubAuth();
  }, []);

  // Subscribe to real-time updates via onSnapshot
  useEffect(() => {
    setIsLoading(true);
    setErrorMessage(null);

    const unsubscribe = subscribeToClinicalRecords(
      (data) => {
        setIsLoading(false);
        setIsRefreshing(false);
        setRecords(data || []);
        setErrorMessage(null);
      },
      (err: any) => {
        setIsLoading(false);
        setIsRefreshing(false);
        console.warn('Satellite Firestore sync listener warning:', err.message);
        setRecords([]);
        if (err.code === 'permission-denied' || err.message?.includes('permission')) {
          setErrorMessage('Lỗi phân quyền Cloud (permission-denied). Firestore vệ tinh yêu cầu tài khoản đã đăng nhập.');
        } else {
          setErrorMessage(err.message || 'Lỗi kết nối tới Cloud Firestore vệ tinh.');
        }
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [satelliteAuthUser]);

  // Handle Google Sign-in to satellite project
  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setErrorMessage(null);
    try {
      const user = await loginSatelliteGoogle();
      setNotification({
        message: `Đã đăng nhập xác thực tài khoản Google (${user.email}) trên Cloud Vệ Tinh!`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('Satellite Google Login error:', err);
      setErrorMessage(`Lỗi đăng nhập Google: ${err.message || String(err)}`);
    } finally {
      setIsLoggingIn(false);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  // Handle Logout satellite Google
  const handleGoogleLogout = async () => {
    try {
      await logoutSatelliteGoogle();
      setNotification({
        message: 'Đã đăng xuất khỏi tài khoản Google vệ tinh.',
        type: 'info',
      });
    } catch (err: any) {
      console.error('Satellite logout error:', err);
    }
  };

  // Manual on-demand fetch
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    setErrorMessage(null);
    try {
      const fetched = await fetchClinicalRecords();
      setRecords(fetched || []);
      setNotification({
        message: `Đã kết nối và tải về ${fetched?.length || 0} bản ghi trực tiếp từ Cloud Firestore vệ tinh!`,
        type: 'success',
      });
    } catch (err: any) {
      console.warn('Manual fetch error:', err.message);
      setRecords([]);
      if (err.code === 'permission-denied' || err.message?.includes('permission')) {
        setErrorMessage('Lỗi phân quyền Firestore (permission-denied): Bấm Đăng nhập Google để mở khóa.');
      } else {
        setErrorMessage(err.message || 'Lỗi kết nối Firestore vệ tinh.');
      }
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  // Hotkey Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Check if patient already exists in current department
  const checkIsAlreadyInDept = (rec: ClinicalRecord) => {
    const name = (rec.patientName || rec.fullName || '').toLowerCase().trim();
    const mrn = (rec.medicalRecordNumber || '').toLowerCase().trim();
    return currentPatients.some((p) => {
      const pName = p.fullName.toLowerCase().trim();
      const pMrn = (p.medicalRecordNumber || '').toLowerCase().trim();
      if (mrn && pMrn && mrn === pMrn) return true;
      if (name && pName && pName === name) return true;
      return false;
    });
  };

  // Filter and search
  const filteredRecords = useMemo(() => {
    let deletedIds: string[] = [];
    try {
      deletedIds = JSON.parse(localStorage.getItem('DELETED_SATELLITE_IDS') || '[]');
    } catch {
      deletedIds = [];
    }

    return records.filter((rec) => {
      if (deletedIds.includes(rec.id)) return false;
      if (checkIsAlreadyInDept(rec)) return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const name = (rec.patientName || rec.fullName || '').toLowerCase();
        const room = String(rec.patientRoom || rec.roomNumber || '').toLowerCase();
        const date = String(rec.admissionDate || rec.createdAt || '').toLowerCase();
        const diag = String(rec.diagnosis || '').toLowerCase();
        const mrn = String(rec.medicalRecordNumber || '').toLowerCase();
        const doc = String(rec.doctorName || '').toLowerCase();
        const idStr = String(rec.id || '').toLowerCase();

        const matches = 
          name.includes(q) || 
          room.includes(q) || 
          date.includes(q) || 
          diag.includes(q) || 
          mrn.includes(q) ||
          doc.includes(q) ||
          idStr.includes(q);

        if (!matches) return false;
      }

      // Filter tabs
      if (filterMode === 'pending') {
        const comp = checkSatelliteRecordCompleteness(rec);
        if (comp.isComplete) return false;
      } else if (filterMode === 'critical') {
        const parsedVitals = parseVitalSignsText(rec.vitalSigns);
        const isCritical = parsedVitals.bpSystolic >= 160 || parsedVitals.spO2 < 94;
        if (!isCritical) return false;
      }

      return true;
    });
  }, [records, searchTerm, filterMode, currentPatients]);

  // Action: Direct Import
  const handleImportDirect = (record: ClinicalRecord) => {
    const patientObj = mapClinicalRecordToPatient(record, doctors, rooms, currentUser?.id);
    onImportPatientDirect(patientObj);
    setImportedIds((prev) => new Set(prev).add(record.id));
    setNotification({
      message: `Đã nhập thành công bệnh nhân "${patientObj.fullName}" vào Phòng ${patientObj.roomNumber} - ${patientObj.bedNumber}!`,
      type: 'success',
    });
    setTimeout(() => setNotification(null), 4000);
  };

  // Action: Review & Edit before Admission
  const handleReviewAndEdit = (record: ClinicalRecord) => {
    const patientObj = mapClinicalRecordToPatient(record, doctors, rooms, currentUser?.id);
    onOpenEditAdmission(patientObj);
    onClose();
  };

  // Action: Delete inappropriate satellite record
  const handleDeleteSatelliteRecord = async (record: ClinicalRecord) => {
    const name = record.patientName || record.fullName || 'Bệnh nhân';
    const confirmDelete = window.confirm(
      `Bạn có chắc chắn muốn xóa bản ghi vệ tinh của bệnh nhân "${name}" (${record.id}) không?\n\nBản ghi này sẽ bị loại bỏ khỏi danh sách vệ tinh và không xuất hiện lại.`
    );
    if (!confirmDelete) return;

    // 1. Immediate local UI update
    setRecords((prev) => prev.filter((r) => r.id !== record.id));

    // 2. Persist deletion in localStorage & Firestore
    await deleteSatelliteRecord(record.id);

    setNotification({
      message: `Đã xóa thành công bản ghi bệnh nhân "${name}" (${record.id}) khỏi danh sách vệ tinh!`,
      type: 'success',
    });
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black tracking-tight text-white uppercase">
                  Đồng Bộ Bệnh Án Từ Cloud Lâm Sàng Vệ Tinh
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Real-time OnSnapshot</span>
                </span>
              </div>
              <p className="text-xs text-indigo-200/90 font-mono mt-0.5 flex items-center gap-1.5 truncate max-w-xl">
                <span>Database:</span>
                <span className="text-white font-bold bg-white/10 px-1.5 py-0.2 rounded text-[11px] truncate">
                  {CLINICAL_DATABASE_ID}
                </span>
                <span>• Collection:</span>
                <span className="text-emerald-300 font-bold bg-emerald-950/40 px-1.5 py-0.2 rounded text-[11px]">
                  {CLINICAL_COLLECTION}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {satelliteAuthUser ? (
              <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-xl border border-white/15 text-xs text-indigo-100">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-bold truncate max-w-[130px]">{satelliteAuthUser.email}</span>
                <button
                  type="button"
                  onClick={handleGoogleLogout}
                  className="text-rose-300 hover:text-white p-0.5 ml-1 cursor-pointer"
                  title="Đăng xuất tài khoản Google"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                title="Đăng nhập Google nếu Firestore yêu cầu xác thực người dùng"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{isLoggingIn ? 'Đang xác thực...' : 'Đăng Nhập Google Vệ Tinh'}</span>
              </button>
            )}

            {onOpenExcelImport && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenExcelImport();
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Tải file Excel để ghép nối tự động số phòng với bệnh nhân vệ tinh"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Nhập File Excel</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 border border-white/15"
              title="Lấy dữ liệu mới nhất từ Firestore vệ tinh (Fetch on demand)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-300' : ''}`} />
              <span className="hidden sm:inline">{isRefreshing ? 'Đang tải...' : 'Làm mới'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Đóng (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div className={`px-4 py-2 text-xs font-bold flex items-center justify-between shrink-0 animate-in fade-in ${
            notification.type === 'success' 
              ? 'bg-emerald-600 text-white' 
              : notification.type === 'error'
              ? 'bg-rose-600 text-white'
              : 'bg-indigo-600 text-white'
          }`}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{notification.message}</span>
            </div>
            <button 
              onClick={() => setNotification(null)}
              className="text-white/80 hover:text-white cursor-pointer ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          
          {/* Search Input */}
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo Tên bệnh nhân, Buồng/Phòng, Ngày vào viện..."
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div className="inline-flex bg-slate-200/80 p-0.5 rounded-xl text-xs font-bold text-slate-700">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  filterMode === 'all' 
                    ? 'bg-white text-indigo-700 font-extrabold shadow-2xs' 
                    : 'hover:text-slate-900'
                }`}
              >
                Tất cả ({records.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('pending')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  filterMode === 'pending' 
                    ? 'bg-amber-500 text-white font-extrabold shadow-2xs' 
                    : 'hover:text-slate-900 text-amber-800'
                }`}
              >
                <span>Chờ bổ sung</span>
                {pendingRecordsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-900 text-amber-100 text-[10px] font-black">
                    {pendingRecordsCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('critical')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  filterMode === 'critical' 
                    ? 'bg-rose-600 text-white font-extrabold shadow-2xs' 
                    : 'hover:text-slate-900'
                }`}
              >
                Ca Nặng / Cấp cứu
              </button>
            </div>

            <span className="text-[11px] text-slate-500 font-medium hidden md:inline">
              Hiển thị: <strong className="text-slate-900 font-bold">{filteredRecords.length}</strong> ca
            </span>
          </div>

        </div>

        {/* Content list */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 bg-slate-100/60">
          
          {/* Permission error warning banner */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 space-y-3 animate-in fade-in">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <h4 className="font-extrabold text-amber-900 text-sm">
                    Cảnh báo phân quyền từ Cloud Firestore Vệ Tinh (Permission Denied)
                  </h4>
                  <p className="font-medium text-amber-800 leading-relaxed">
                    {errorMessage}
                  </p>
                  <p className="text-[11px] text-amber-700 font-mono">
                    Để ứng dụng đọc trực tiếp không cần đăng nhập, quy tắc phân quyền (Firestore Rules) trên dự án <strong className="font-bold">iron-foundation-kbcxw</strong> cần thêm:
                  </p>
                  <pre className="p-2 bg-amber-100/80 rounded-lg text-[10.5px] font-mono text-amber-900 border border-amber-300/60 font-bold">
                    match /clinical_records/&#123;doc=**&#125; &#123; allow read: if true; &#125;
                  </pre>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-amber-200/80">
                {!satelliteAuthUser ? (
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isLoggingIn}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Đăng Nhập Google Để Mở Khóa Truy Cập Ngay</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleManualRefresh}
                    className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Thử Tải Lại</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="p-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-700">
                Đang kết nối thời gian thực tới Cloud Firestore vệ tinh...
              </p>
              <p className="text-[11px] text-slate-400 font-mono">
                Collection: {CLINICAL_COLLECTION} • DB: {CLINICAL_DATABASE_ID}
              </p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-3 my-6">
              <Database className="w-10 h-10 text-slate-400 mx-auto" />
              <h4 className="text-sm font-bold text-slate-800">
                Chưa có bản ghi bệnh án nào trong collection <span className="font-mono text-indigo-700">{CLINICAL_COLLECTION}</span>
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Hệ thống đang sẵn sàng lắng nghe trực tiếp từ Cloud Firestore <span className="font-mono">{CLINICAL_DATABASE_ID}</span>. Khi app vệ tinh vừa đẩy slide hoặc bệnh án lên, dữ liệu thực tế sẽ xuất hiện ngay lập tức tại đây.
              </p>
              <button
                type="button"
                onClick={handleManualRefresh}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer inline-flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Thử Làm Mới Lại Dữ Liệu</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredRecords.map((record) => {
                const name = record.patientName || record.fullName || 'Bệnh Nhân Vệ Tinh';
                const parsedAgeNum = parseAgeNumber(record.patientAge || record.age);
                const age = parsedAgeNum ? `${parsedAgeNum}` : (record.patientAge || record.age || '60');
                const rawGender = String(record.patientGender || record.gender || 'Nam');
                const isFemale = rawGender.toLowerCase().includes('nữ') || rawGender.toLowerCase().includes('nu') || rawGender.toLowerCase().includes('female');
                const room = record.patientRoom || record.roomNumber || 'Chưa xếp phòng';
                const admissionDate = record.admissionDate || record.createdAt || 'Hôm nay';
                const diagnosis = record.diagnosis || 'Theo dõi bệnh nội khoa';
                const history = record.medicalHistory;
                const clinicalCourse = record.clinicalCourse || record.clinicalNote;
                const treatmentPlan = record.treatmentPlan;
                const clsHtml = record.clsHtml || record.labsHtml;
                const vitalSignsText = record.vitalSigns || '';

                const parsedVitals = parseVitalSignsText(vitalSignsText);
                const completeness = checkSatelliteRecordCompleteness(record);

                const isAlreadyInDept = checkIsAlreadyInDept(record);
                const isJustImported = importedIds.has(record.id);

                return (
                  <div
                    key={record.id}
                    className={`bg-white rounded-2xl border transition-all shadow-xs hover:shadow-md overflow-hidden ${
                      !completeness.isComplete
                        ? 'border-amber-300 bg-amber-50/20'
                        : isJustImported 
                        ? 'border-emerald-400 ring-2 ring-emerald-300' 
                        : isAlreadyInDept 
                        ? 'border-slate-300 bg-slate-50/70' 
                        : 'border-slate-200'
                    }`}
                  >
                    {/* Incomplete Record Notice */}
                    {!completeness.isComplete && (
                      <div className="bg-amber-100 border-b border-amber-200 px-4 py-1.5 text-amber-900 text-xs font-bold flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Dữ liệu chưa đủ điều kiện tự động tiếp nhận: <strong className="font-extrabold text-amber-950">Thiếu {completeness.missingFields.join(', ')}</strong></span>
                        </div>
                        <span className="text-[10.5px] text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-full font-bold">
                          Cần nhập bổ sung thủ công
                        </span>
                      </div>
                    )}

                    {/* Top Case Bar */}
                    <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100">
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">
                            {name}
                          </h4>
                          <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-700">
                            {age} tuổi • {isFemale ? 'Nữ' : 'Nam'}
                          </span>
                          <span className={`text-xs px-2.5 py-0.5 rounded-md font-black flex items-center gap-1 ${
                            !room || room === 'Chưa xếp phòng'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-indigo-50 border border-indigo-200 text-indigo-700'
                          }`}>
                            <Building2 className="w-3.5 h-3.5" />
                            <span>{room}</span>
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{formatSatelliteDateTime(admissionDate)}</span>
                          </span>
                          {isAlreadyInDept && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Đã có trong khoa</span>
                            </span>
                          )}
                          {isJustImported && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold animate-in fade-in">
                              ✓ Vừa nhập thành công
                            </span>
                          )}
                        </div>

                        {/* Primary Diagnosis */}
                        <p className="text-xs font-bold text-slate-800 flex items-start gap-1.5 pt-0.5">
                          <Stethoscope className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                          <span>Chẩn đoán: <strong className="text-indigo-900 font-black">{diagnosis}</strong></span>
                        </p>
                      </div>

                      {/* Import Action Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteSatelliteRecord(record)}
                          className="px-2 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
                          title="Xóa bản ghi không phù hợp khỏi dữ liệu vệ tinh"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>Xóa</span>
                        </button>

                        {!completeness.isComplete ? (
                          <button
                            type="button"
                            onClick={() => handleReviewAndEdit(record)}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-black text-[11px] transition-all cursor-pointer flex items-center gap-1 shadow-xs hover:shadow active:scale-95"
                            title="Bổ sung các thông tin còn thiếu (Họ tên, Tuổi, Buồng phòng) và tiếp nhận bệnh nhân vào nội trú"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Bổ Sung & Nhập Viện</span>
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleReviewAndEdit(record)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
                              title="Mở biểu mẫu nhập viện hoàn chỉnh với dữ liệu đã điền sẵn để rà soát trước khi lưu"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Xem & Sửa</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleImportDirect(record)}
                              className={`px-3 py-1.5 rounded-lg text-white font-black text-[11px] transition-all cursor-pointer flex items-center gap-1 shadow-xs hover:shadow active:scale-95 ${
                                isJustImported
                                  ? 'bg-emerald-600 hover:bg-emerald-700'
                                  : 'bg-indigo-600 hover:bg-indigo-700'
                              }`}
                              title="Nhập trực tiếp ca bệnh này vào danh sách bệnh nhân nội trú của khoa"
                            >
                              <CloudDownload className="w-3.5 h-3.5" />
                              <span>{isJustImported ? 'Nhập Lại' : 'Nhập Bệnh Án'}</span>
                            </button>
                          </>
                        )}
                      </div>

                    </div>

                    {/* Case Details Body */}
                    <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
                      
                      {/* Left: Vitals, History & Evolution (7 cols) */}
                      <div className="md:col-span-7 space-y-3">
                        
                        {/* Vitals Bar */}
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10.5px] font-black uppercase text-slate-500 flex items-center gap-1">
                              <Activity className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Sinh hiệu tiếp nhận:</span>
                            </span>
                            <span className="text-[11px] font-mono text-slate-600 font-bold">
                              {vitalSignsText || `HA: ${parsedVitals.bpSystolic}/${parsedVitals.bpDiastolic} mmHg • Mạch: ${parsedVitals.heartRate} l/p • SpO2: ${parsedVitals.spO2}%`}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 flex-wrap text-xs pt-1 border-t border-slate-200/60">
                            <span className="font-bold text-slate-800">
                              HA: <strong className="font-black text-indigo-700">{parsedVitals.bpSystolic}/{parsedVitals.bpDiastolic}</strong> mmHg
                            </span>
                            <span className="font-bold text-slate-800">
                              Mạch: <strong className="font-black text-rose-700">{parsedVitals.heartRate}</strong> l/p
                            </span>
                            <span className="font-bold text-slate-800">
                              Nhiệt độ: <strong className="font-black text-amber-700">{parsedVitals.temperature}°C</strong>
                            </span>
                            <span className="font-bold text-slate-800">
                              SpO₂: <strong className={`font-black ${parsedVitals.spO2 < 95 ? 'text-rose-600' : 'text-emerald-700'}`}>{parsedVitals.spO2}%</strong>
                            </span>
                          </div>
                        </div>

                        {/* Medical History */}
                        {history && (
                          <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/80 space-y-1">
                            <p className="text-slate-800">
                              <strong className="font-bold text-amber-950">Tiền sử & Bệnh nền:</strong> {history}
                            </p>
                          </div>
                        )}

                        {/* Clinical Course / Evolution */}
                        {clinicalCourse && (
                          <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-200">
                            <div className="text-[11px] font-black uppercase text-indigo-700 flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Diễn tiến lâm sàng (clinicalCourse):</span>
                            </div>
                            <p className="text-slate-700 leading-relaxed font-medium">
                              {clinicalCourse}
                            </p>
                          </div>
                        )}

                        {/* Treatment Plan */}
                        {treatmentPlan && (
                          <div className="space-y-1 bg-indigo-50/50 p-3 rounded-xl border border-indigo-200">
                            <div className="text-[11px] font-black uppercase text-indigo-900 flex items-center gap-1.5">
                              <HeartPulse className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Hướng xử trí & Kế hoạch điều trị:</span>
                            </div>
                            <p className="text-indigo-950 font-bold leading-relaxed">
                              {treatmentPlan}
                            </p>
                          </div>
                        )}

                      </div>

                      {/* Right: Featured Labs & Tests (5 cols) */}
                      <div className="md:col-span-5 space-y-2 bg-slate-50/80 p-3 rounded-xl border border-slate-200 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                            <span className="text-[11px] font-black uppercase text-slate-800 flex items-center gap-1.5">
                              <FlaskConical className="w-3.5 h-3.5 text-rose-600" />
                              <span>Cận Lâm Sàng (clsHtml)</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Kết quả thực tế
                            </span>
                          </div>

                          {clsHtml ? (
                            <div 
                              className="text-xs text-slate-800 leading-relaxed max-h-48 overflow-y-auto space-y-1 font-mono bg-white p-2.5 rounded-lg border border-slate-200/80"
                              dangerouslySetInnerHTML={{ __html: clsHtml }}
                            />
                          ) : (
                            <p className="text-xs text-slate-400 italic py-4 text-center">
                              Không có bảng HTML cận lâm sàng đính kèm.
                            </p>
                          )}
                        </div>

                        {/* Summary badge */}
                        <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                          <span>Mã định danh: <strong className="font-mono text-slate-700">{record.id}</strong></span>
                          <span className="text-emerald-700 font-bold">Thời gian: {formatSatelliteDateTime(record.createdAt || record.admissionDate)}</span>
                        </div>
                      </div>

                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <Cloud className="w-4 h-4 text-indigo-600" />
            <span>Kết nối trực tiếp Cloud Firestore {CLINICAL_DATABASE_ID} ({CLINICAL_COLLECTION}).</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
            >
              Đóng (Esc)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

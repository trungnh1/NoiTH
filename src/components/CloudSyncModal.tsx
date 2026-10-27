import React, { useState } from 'react';
import { 
  X, 
  Cloud, 
  UploadCloud, 
  DownloadCloud, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  ExternalLink, 
  Settings, 
  Database, 
  Server,
  RefreshCw,
  Sparkles,
  Key,
  ShieldCheck,
  Code2,
  HelpCircle,
  FileText
} from 'lucide-react';
import { Patient } from '../types/patient';
import { 
  getActiveFirebaseConfig, 
  parseFirebaseSnippet,
  syncAllPatientsToCloud, 
  fetchPatientsFromCloud, 
  testCloudWrite, 
  initializeFirebaseFirestore,
  SyncStatus 
} from '../services/firebaseSync';

interface CloudSyncModalProps {
  patients: Patient[];
  syncStatus: SyncStatus;
  onClose: () => void;
  onPatientsLoadedFromCloud: (patients: Patient[]) => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  patients,
  syncStatus,
  onClose,
  onPatientsLoadedFromCloud,
}) => {
  const currentConfig = getActiveFirebaseConfig();
  const [activeTab, setActiveTab] = useState<'sync' | 'config'>('sync');

  // Sync actions state
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Custom config states
  const [rawSnippet, setRawSnippet] = useState('');
  const [customProjectId, setCustomProjectId] = useState(currentConfig.projectId);
  const [customDbId, setCustomDbId] = useState(currentConfig.databaseId);
  const [customApiKey, setCustomApiKey] = useState(currentConfig.apiKey);
  const [customAppId, setCustomAppId] = useState(currentConfig.appId);
  const [customAuthDomain, setCustomAuthDomain] = useState(currentConfig.authDomain);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleParseSnippet = () => {
    if (!rawSnippet.trim()) {
      setActionMessage({ type: 'error', text: 'Vui lòng dán đoạn mã firebaseConfig vào ô trước khi phân tích.' });
      return;
    }
    const parsed = parseFirebaseSnippet(rawSnippet);
    let count = 0;
    if (parsed.projectId) { setCustomProjectId(parsed.projectId); count++; }
    if (parsed.apiKey) { setCustomApiKey(parsed.apiKey); count++; }
    if (parsed.appId) { setCustomAppId(parsed.appId); count++; }
    if (parsed.authDomain) { setCustomAuthDomain(parsed.authDomain); count++; }
    if (parsed.databaseId) { setCustomDbId(parsed.databaseId); count++; }

    if (count > 0) {
      setActionMessage({ 
        type: 'success', 
        text: `Đã tự động trích xuất thành công ${count} thông số cấu hình Firebase! Nhấn "Lưu & Kết Nối Lại" bên dưới để áp dụng.` 
      });
    } else {
      setActionMessage({ 
        type: 'error', 
        text: 'Không tìm thấy thông số hợp lệ trong đoạn mã đã dán. Vui lòng kiểm tra lại định dạng hoặc nhập thủ công.' 
      });
    }
  };

  const handleUploadAll = async () => {
    setIsUploading(true);
    setActionMessage({ type: 'info', text: `Đang kết nối & đẩy toàn bộ ${patients.length} bệnh nhân lên Cloud Firestore...` });
    const res = await syncAllPatientsToCloud(patients);
    setIsUploading(false);
    if (res.success) {
      setActionMessage({
        type: 'success',
        text: `✅ ĐÃ LƯU THÀNH CÔNG ${res.count} BỆNH NHÂN LÊN CLOUD FIRESTORE!\nDữ liệu bệnh nhân đã an toàn trên đám mây (Project: ${currentConfig.projectId}).`,
      });
    } else {
      setActionMessage({
        type: 'error',
        text: `❌ LỖI ĐỒNG BỘ CLOUD:\n${res.error}\n${res.details ? `\nChi tiết kết nối: ${res.details}` : ''}`,
      });
    }
  };

  const handleDownloadAll = async () => {
    setIsDownloading(true);
    setActionMessage({ type: 'info', text: 'Đang tải hồ sơ bệnh nhân từ Firebase Cloud...' });
    const res = await fetchPatientsFromCloud();
    setIsDownloading(false);
    if (res.success) {
      if (res.patients && res.patients.length > 0) {
        onPatientsLoadedFromCloud(res.patients);
        setActionMessage({
          type: 'success',
          text: `✅ Đã tải về thành công ${res.patients.length} bệnh nhân từ Cloud Firestore (${currentConfig.projectId})!`,
        });
      } else {
        setActionMessage({
          type: 'info',
          text: `Cloud Firestore (${currentConfig.projectId}) chưa có hồ sơ nào. Bạn có thể nhấn 'Lưu Tất Cả Lên Cloud' để khởi tạo dữ liệu.`,
        });
      }
    } else {
      setActionMessage({
        type: 'error',
        text: `❌ LỖI TẢI DỮ LIỆU:\n${res.error}\n${res.details ? `\nChi tiết: ${res.details}` : ''}`,
      });
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setActionMessage({ type: 'info', text: 'Đang gửi bản ghi probe thử nghiệm lên Cloud Firestore...' });
    const res = await testCloudWrite();
    setIsTesting(false);
    if (res.success) {
      setActionMessage({
        type: 'success',
        text: `✅ KẾT NỐI & GHI THỦ THÀNH CÔNG!\n${res.details || ''}`,
      });
    } else {
      setActionMessage({
        type: 'error',
        text: `❌ KIỂM TRA KẾT NỐI THẤT BẠI:\n${res.error}\n${res.details ? `\nChi tiết kỹ thuật: ${res.details}` : ''}`,
      });
    }
  };

  const handleSaveCustomConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('CUSTOM_FIREBASE_PROJECT_ID', customProjectId.trim());
    localStorage.setItem('CUSTOM_FIREBASE_DATABASE_ID', customDbId.trim() || '(default)');
    localStorage.setItem('CUSTOM_FIREBASE_API_KEY', customApiKey.trim());
    localStorage.setItem('CUSTOM_FIREBASE_APP_ID', customAppId.trim());
    localStorage.setItem('CUSTOM_FIREBASE_AUTH_DOMAIN', customAuthDomain.trim() || `${customProjectId.trim()}.firebaseapp.com`);
    initializeFirebaseFirestore(true);
    setActionMessage({
      type: 'success',
      text: `Đã lưu và kết nối lại tới Firebase Project [${customProjectId.trim()}]! Hãy nhấn nút "Kiểm Tra Kết Nối Cloud" để thử nghiệm.`,
    });
  };

  const firestoreRulesCode = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Cho phép ứng dụng Khoa Nội Tổng Hợp đọc và ghi hồ sơ bệnh nhân
    match /department_patients/{document=**} {
      allow read, write: if true;
    }
    // Cho phép nhận ca cấp cứu và ghi kiểm tra kết nối
    match /clinical_records/{document=**} {
      allow read, write: if true;
    }
    // Mở quyền chung cho các bản ghi kiểm tra hệ thống
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`;

  const vercelEnvSnippet = `VITE_FIREBASE_PROJECT_ID=${customProjectId || "iron-foundation-kbcxw"}
VITE_FIREBASE_AUTH_DOMAIN=${customAuthDomain || `${customProjectId || "iron-foundation-kbcxw"}.firebaseapp.com`}
VITE_FIREBASE_API_KEY=${customApiKey || "AIzaSyC9FUny98eUFmOW2v06hpezo37F_Rg4o9Q"}
VITE_FIREBASE_APP_ID=${customAppId || "1:692966572750:web:5e06d6560890da7676469f"}
VITE_FIREBASE_DATABASE_ID=${customDbId || "(default)"}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight">
                  Hướng Dẫn Cài Đặt Thủ Công & Quản Lý Cloud Firestore
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/30 text-emerald-200 border border-emerald-400/40">
                  {currentConfig.projectId}
                </span>
              </div>
              <p className="text-xs text-blue-200/80">
                Lưu trữ vĩnh viễn hồ sơ bệnh nhân, y lệnh và buồng giường trên Google Cloud Firestore
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 text-xs font-bold gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('sync')}
            className={`py-3 px-4 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'sync'
                ? 'border-blue-600 text-blue-700 bg-white font-black'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <UploadCloud className="w-4 h-4 text-rose-600" />
            <span>⚡ Đẩy & Đồng Bộ Dữ Liệu Cloud</span>
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`py-3 px-4 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'config'
                ? 'border-blue-600 text-blue-700 bg-white font-black'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="w-4 h-4 text-blue-600" />
            <span>⚙️ Cài Đặt Cấu Hình Firebase (Admin)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* Automatic Sync Banner */}
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 flex items-start gap-3 text-xs text-emerald-900 shadow-2xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h4 className="font-black text-emerald-950 text-sm">
                Tính Năng Tự Động Lưu Trữ Đám Mây Đang Hoạt Động (Không Cần Bấm Thủ Công)
              </h4>
              <p className="text-emerald-800 leading-relaxed font-medium">
                Mọi thao tác <strong>Nhập Mới Bệnh Nhân</strong>, <strong>Ghi Diễn Tiến Hàng Ngày</strong>, <strong>Kế Hoạch Điều Trị</strong> hay <strong>Đổi Trạng Thái Ra Viện</strong> đều được hệ thống <strong>TỰ ĐỘNG ĐẨY LÊN CLOUD FIRESTORE NGAY LẬP TỨC</strong> theo thời gian thực. Bác sĩ và điều dưỡng chỉ cần thao tác nhập liệu như bình thường, dữ liệu sẽ tự động an toàn trên đám mây!
              </p>
            </div>
          </div>
          
          {/* Action Notification Message */}
          {actionMessage && (
            <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs font-semibold animate-in fade-in ${
              actionMessage.type === 'success' 
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
                : actionMessage.type === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-blue-50 border-blue-300 text-blue-900'
            }`}>
              {actionMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : actionMessage.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <RefreshCw className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 animate-spin" />
              )}
              <div className="flex-1 leading-relaxed whitespace-pre-line font-medium text-xs">
                {actionMessage.text}
              </div>
            </div>
          )}

          {/* TAB: FIRESTORE SETUP GUIDE (Hidden as admin manages cloud setup) */}
          {false && (
            <div className="space-y-4 text-xs">
              <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-emerald-50 border border-blue-200 rounded-xl p-4 text-slate-800">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  <h3 className="font-black text-sm text-slate-900">
                    Quy Trình 6 Bước Cài Đặt Thủ Công Cloud Firestore Cho Ứng Dụng
                  </h3>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Bạn có thể dùng tài khoản Google miễn phí để tạo cơ sở dữ liệu Firestore trên đám mây, giúp toàn bộ khoa (bác sĩ, điều dưỡng) xem chung và cập nhật hồ sơ bệnh nhân theo thời gian thực từ mọi thiết bị.
                </p>
              </div>

              {/* Step 1 */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-xs">1</span>
                    <h4 className="font-extrabold text-slate-900 text-sm">
                      Tạo Dự Án (Project) trên Firebase Console
                    </h4>
                  </div>
                  <a
                    href="https://console.firebase.google.com"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs border border-blue-200 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Mở Firebase Console</span>
                  </a>
                </div>
                <ol className="list-disc pl-5 space-y-1 text-slate-600 leading-relaxed">
                  <li>Truy cập <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-blue-600 underline font-semibold">console.firebase.google.com</a> và đăng nhập bằng tài khoản Google.</li>
                  <li>Nhấn nút <strong>Add project</strong> (Thêm dự án).</li>
                  <li>Nhập tên dự án (ví dụ: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold text-blue-700">bv-hungvuong-gialai</code> hoặc tên bạn muốn) ➔ Bấm <strong>Continue</strong>.</li>
                  <li>Google Analytics: Có thể bật hoặc tắt (tùy chọn) ➔ Nhấn <strong>Create project</strong> và chờ 10 giây để Firebase hoàn tất khởi tạo.</li>
                </ol>
              </div>

              {/* Step 2 */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-xs">2</span>
                  <h4 className="font-extrabold text-slate-900 text-sm">
                    Kích Hoạt Cloud Firestore Database
                  </h4>
                </div>
                <ol className="list-disc pl-5 space-y-1 text-slate-600 leading-relaxed">
                  <li>Ở menu bên trái Firebase Console, chọn <strong>Build</strong> ➔ Nhấn vào <strong>Firestore Database</strong>.</li>
                  <li>Nhấn nút <strong>Create database</strong> (Tạo cơ sở dữ liệu).</li>
                  <li><strong>Database ID:</strong> Để mặc định là <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">(default)</code>.</li>
                  <li><strong>Location (Vị trí máy chủ):</strong> Chọn khu vực gần Việt Nam nhất như <strong className="text-indigo-700">asia-east1 (Tokyo)</strong> hoặc <strong className="text-indigo-700">asia-southeast1 (Singapore)</strong> để đạt tốc độ truy xuất nhanh nhất ➔ Bấm <strong>Next</strong>.</li>
                  <li><strong>Security Rules:</strong> Chọn <strong>Start in test mode</strong> (hoặc production mode đều được, ta sẽ cập nhật rules ở Bước 3) ➔ Nhấn <strong>Create</strong>.</li>
                </ol>
              </div>

              {/* Step 3 */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-xs">3</span>
                    <h4 className="font-extrabold text-slate-900 text-sm">
                      Cập Nhật Quy Tắc Bảo Mật (Firestore Security Rules)
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(firestoreRulesCode, 'rules')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-300 transition-colors cursor-pointer"
                  >
                    {copiedKey === 'rules' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'rules' ? 'Đã sao chép Rules!' : 'Sao chép Rules'}</span>
                  </button>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Chuyển sang tab <strong>Rules (Quy tắc)</strong> trong Firestore Database, xóa toàn bộ nội dung cũ và dán đoạn mã quy tắc bảo mật này vào, sau đó nhấn <strong>Publish (Xuất bản)</strong>:
                </p>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
                  {firestoreRulesCode}
                </pre>
                <div className="p-2.5 rounded-lg bg-emerald-50/80 text-emerald-900 border border-emerald-200 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Quy tắc này cấp quyền cho ứng dụng đọc/ghi dữ liệu vào collection <code className="font-bold">department_patients</code> (hồ sơ nội trú) và <code className="font-bold">clinical_records</code> (tiếp nhận ca cấp cứu) mà không bị lỗi <code className="font-bold text-rose-700">Missing or insufficient permissions</code>.
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-xs">4</span>
                  <h4 className="font-extrabold text-slate-900 text-sm">
                    Tạo Web App & Lấy Mã Cấu Hình (firebaseConfig)
                  </h4>
                </div>
                <ol className="list-disc pl-5 space-y-1.5 text-slate-600 leading-relaxed">
                  <li>Ở góc trên bên trái menu Firebase Console, bấm vào biểu tượng bánh răng ⚙️ ➔ Chọn <strong>Project settings (Cài đặt dự án)</strong>.</li>
                  <li>Trong tab <strong>General</strong>, cuộn xuống phần <strong>Your apps (Ứng dụng của bạn)</strong>.</li>
                  <li>Bấm vào biểu tượng Web <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold text-blue-600">&lt;/&gt;</code> để thêm ứng dụng web.</li>
                  <li>Nhập tên ứng dụng (ví dụ: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">Khoa Noi Tong Hop</code>) ➔ Bấm <strong>Register app</strong>.</li>
                  <li>Firebase sẽ hiển thị đoạn mã JavaScript <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">const firebaseConfig = &#123; ... &#125;;</code>. <strong>Hãy sao chép toàn bộ đoạn mã này</strong>!</li>
                </ol>
              </div>

              {/* Step 5 */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-xs">5</span>
                    <h4 className="font-extrabold text-slate-900 text-sm">
                      Dán Cấu Hình Vào Ứng Dụng (2 Cách)
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('config')}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    <span>Mở Tab Cài Đặt Ngay ➔</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 space-y-1.5">
                    <span className="font-black text-blue-900 block">Cách 1: Trực tiếp trên giao diện (Nhanh nhất)</span>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      Chuyển sang tab <strong>⚙️ Cài Đặt Cấu Hình & Dán Mã</strong> ngay trong cửa sổ này, dán toàn bộ đoạn mã <code className="font-mono">const firebaseConfig = ...</code> và nhấn <strong>Phân Tích & Điền Form</strong> ➔ Nhấn <strong>Lưu & Kết Nối Lại</strong>. Ứng dụng sẽ kết nối ngay mà không cần build lại code!
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-200 space-y-1.5">
                    <span className="font-black text-purple-900 block">Cách 2: Khi deploy Vercel / Production</span>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      Chuyển sang tab <strong>🚀 Cài Đặt Vercel Deploy</strong>, sao chép 5 biến môi trường và dán vào mục <em>Settings &gt; Environment Variables</em> trên Vercel của dự án.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 6 */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center text-xs">6</span>
                  <h4 className="font-extrabold text-slate-900 text-sm">
                    Kiểm Tra & Đồng Bộ Dữ Liệu Lên Cloud
                  </h4>
                </div>
                <ol className="list-disc pl-5 space-y-1 text-slate-600 leading-relaxed">
                  <li>Chuyển sang tab <strong>🔄 Đồng Bộ & Sao Lưu</strong>, bấm <strong>Kiểm Tra Kết Nối Cloud</strong> để gửi bản ghi probe thử nghiệm.</li>
                  <li>Bấm <strong>Lưu Tất Cả Lên Cloud Firestore</strong> để đồng bộ toàn bộ {patients.length} hồ sơ bệnh nhân nội trú hiện tại.</li>
                  <li>Mở lại Firebase Console tab <strong>Firestore Database</strong> ➔ Bạn sẽ thấy collection <strong className="text-blue-700 font-mono">department_patients</strong> đã xuất hiện đầy đủ danh sách bệnh nhân, buồng giường và chỉ định!</li>
                </ol>
              </div>

            </div>
          )}

          {/* TAB: ADVANCED CONFIG & QUICK PASTE */}
          {activeTab === 'config' && (
            <div className="space-y-4 text-xs">
              
              {/* Quick Parser Box */}
              <div className="bg-gradient-to-br from-indigo-50/80 to-blue-50/60 p-4 rounded-xl border border-indigo-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-indigo-600" />
                    <h4 className="font-extrabold text-slate-900 text-sm">
                      Dán Nhanh Đoạn Mã Firebase Config
                    </h4>
                  </div>
                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                    Tự Động Phân Tích Thông Số
                  </span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Bạn chỉ cần copy toàn bộ đoạn mã <code className="bg-indigo-100/70 text-indigo-900 px-1 py-0.5 rounded font-mono font-semibold">const firebaseConfig = &#123; ... &#125;;</code> từ Firebase Console và dán vào ô bên dưới, hệ thống sẽ tự động bóc tách từng giá trị:
                </p>
                <textarea
                  rows={4}
                  value={rawSnippet}
                  onChange={(e) => setRawSnippet(e.target.value)}
                  placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "my-project.firebaseapp.com",\n  projectId: "my-project",\n  storageBucket: "...",\n  messagingSenderId: "...",\n  appId: "1:..."\n};`}
                  className="w-full p-2.5 bg-white border border-indigo-200 rounded-lg font-mono text-[11px] text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">
                    Hỗ trợ định dạng: JS Object, JSON hoặc danh sách biến .env
                  </span>
                  <button
                    type="button"
                    onClick={handleParseSnippet}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>⚡ Phân Tích & Điền Form</span>
                  </button>
                </div>
              </div>

              {/* Manual Input Form */}
              <form onSubmit={handleSaveCustomConfig} className="bg-white p-4 rounded-xl border border-slate-200 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">
                      Chi Tiết Các Trường Cấu Hình Firebase
                    </h4>
                    <p className="text-slate-500 text-[11px]">
                      Kiểm tra hoặc điều chỉnh chi tiết các giá trị kết nối Firestore:
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomProjectId('crucial-kayak-481415-h1');
                        setCustomDbId('ai-studio-khoanitnghpbvhng-de948f06-b995-4e80-9a0c-53f09a50ec05');
                        setCustomApiKey('AIzaSyDMS-VQIRC9BL0aIjJPtqHfQFRO4sfSQ1E');
                        setCustomAppId('1:936936305554:web:7d0283e9fbbaf37566c74b');
                        setCustomAuthDomain('crucial-kayak-481415-h1.firebaseapp.com');
                        setActionMessage({
                          type: 'info',
                          text: 'Đã nạp thông số Firebase AI Studio. Nhấn "Lưu & Kết Nối Lại" để kích hoạt.',
                        });
                      }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-[11px] transition-colors cursor-pointer"
                      title="Nạp cấu hình AI Studio Firestore"
                    >
                      Dùng AI Studio DB
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomProjectId('iron-foundation-kbcxw');
                        setCustomDbId('(default)');
                        setCustomApiKey('AIzaSyC9FUny98eUFmOW2v06hpezo37F_Rg4o9Q');
                        setCustomAppId('1:692966572750:web:5e06d6560890da7676469f');
                        setCustomAuthDomain('iron-foundation-kbcxw.firebaseapp.com');
                        setActionMessage({
                          type: 'info',
                          text: 'Đã nạp thông số iron-foundation-kbcxw. Nhấn "Lưu & Kết Nối Lại" để kích hoạt.',
                        });
                      }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-[11px] transition-colors cursor-pointer"
                      title="Nạp cấu hình iron-foundation-kbcxw"
                    >
                      Dùng Iron Foundation
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      1. Firebase Project ID <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customProjectId}
                      onChange={(e) => setCustomProjectId(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500"
                      placeholder="vd: bv-hungvuong-gialai"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      2. Firestore Database ID (mặc định là '(default)')
                    </label>
                    <input
                      type="text"
                      value={customDbId}
                      onChange={(e) => setCustomDbId(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500"
                      placeholder="(default)"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      3. Firebase API Key <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customApiKey}
                      onChange={(e) => setCustomApiKey(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500"
                      placeholder="AIzaSy..."
                      required
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      4. Firebase App ID
                    </label>
                    <input
                      type="text"
                      value={customAppId}
                      onChange={(e) => setCustomAppId(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500"
                      placeholder="1:692966572750:web:5e06d6560890da7676469f"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="font-bold text-slate-700 block mb-1">
                      5. Auth Domain
                    </label>
                    <input
                      type="text"
                      value={customAuthDomain}
                      onChange={(e) => setCustomAuthDomain(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500"
                      placeholder="vd: bv-hungvuong-gialai.firebaseapp.com"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between pt-3 border-t border-slate-100 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem('CUSTOM_FIREBASE_PROJECT_ID');
                      localStorage.removeItem('CUSTOM_FIREBASE_DATABASE_ID');
                      localStorage.removeItem('CUSTOM_FIREBASE_API_KEY');
                      localStorage.removeItem('CUSTOM_FIREBASE_APP_ID');
                      localStorage.removeItem('CUSTOM_FIREBASE_AUTH_DOMAIN');
                      setCustomProjectId('iron-foundation-kbcxw');
                      setCustomDbId('(default)');
                      setCustomApiKey('AIzaSyC9FUny98eUFmOW2v06hpezo37F_Rg4o9Q');
                      setCustomAppId('1:692966572750:web:5e06d6560890da7676469f');
                      setCustomAuthDomain('iron-foundation-kbcxw.firebaseapp.com');
                      initializeFirebaseFirestore(true);
                      setActionMessage({
                        type: 'success',
                        text: 'Đã hoàn tác về cấu hình gốc mặc định!',
                      });
                    }}
                    className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors cursor-pointer text-xs"
                  >
                    Khôi phục mặc định
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTesting}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-xs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isTesting ? 'animate-spin' : ''}`} />
                      <span>{isTesting ? 'Đang kiểm tra...' : 'Kiểm Tra Thử'}</span>
                    </button>

                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5 text-xs"
                    >
                      <Check className="w-4 h-4" />
                      <span>Lưu & Kết Nối Lại</span>
                    </button>
                  </div>
                </div>
              </form>

            </div>
          )}

          {/* TAB: SYNC CONTROLS */}
          {activeTab === 'sync' && (
            <div className="space-y-4">
              
              {/* Status Banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-3.5 h-3.5 rounded-full ${
                    syncStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 text-sm">
                        Firebase Project Hiện Tại: {currentConfig.projectId}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded font-bold bg-slate-200 text-slate-700 font-mono">
                        DB: {currentConfig.databaseId}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Bộ nhớ ứng dụng có: <strong className="text-slate-800">{patients.length} bệnh nhân</strong>.
                      {syncStatus.lastSyncTime && (
                        <span> Lần nhận ca cấp cứu gần nhất: <strong>{syncStatus.lastSyncTime}</strong></span>
                      )}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="px-3 py-2 text-xs font-bold rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'Đang kiểm tra...' : 'Kiểm Tra Kết Nối Cloud'}</span>
                </button>
              </div>

              {/* Action Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Upload Card */}
                <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/50 p-4 rounded-xl border border-blue-200 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-blue-600 text-white shadow-2xs">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">
                        Lưu Toàn Bộ Lên Cloud
                      </h4>
                      <p className="text-xs text-slate-500">
                        Đẩy tất cả {patients.length} hồ sơ bệnh nhân lên Firestore
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Đồng bộ hồ sơ, y lệnh thuốc, cận lâm sàng, buồng giường bệnh lên collection <code className="bg-blue-100/70 text-blue-800 px-1 py-0.5 rounded font-mono font-bold">department_patients</code> trên dự án <strong className="text-blue-900">{currentConfig.projectId}</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={handleUploadAll}
                    disabled={isUploading}
                    className="w-full py-2.5 px-4 text-xs font-extrabold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>{isUploading ? 'Đang đẩy lên Cloud...' : 'Lưu Tất Cả Lên Cloud Firestore'}</span>
                  </button>
                </div>

                {/* Download Card */}
                <div className="bg-gradient-to-br from-emerald-50/70 to-teal-50/50 p-4 rounded-xl border border-emerald-200 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-emerald-600 text-white shadow-2xs">
                      <DownloadCloud className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">
                        Tải Dữ Liệu Từ Cloud Về Máy
                      </h4>
                      <p className="text-xs text-slate-500">
                        Kéo dữ liệu bệnh nhân từ Firestore về ứng dụng
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Hữu ích khi bạn mở ứng dụng trên điện thoại, máy tính bảng hoặc máy tính mới tại phòng trực, giúp đồng nhất dữ liệu toàn khoa ngay lập tức.
                  </p>
                  <button
                    type="button"
                    onClick={handleDownloadAll}
                    disabled={isDownloading}
                    className="w-full py-2.5 px-4 text-xs font-extrabold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <DownloadCloud className="w-4 h-4" />
                    <span>{isDownloading ? 'Đang tải từ Cloud...' : 'Tải Dữ Liệu Từ Cloud Về Máy'}</span>
                  </button>
                </div>

              </div>

              {/* Automatic Realtime explanation */}
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3 text-xs text-amber-900">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-extrabold">Tự Động Lưu Trực Tuyến & Tiếp Nhận Cấp Cứu:</span>
                  <p className="text-amber-800 leading-relaxed">
                    Mỗi khi bạn tiếp nhận bệnh nhân mới, đổi giường buồng, bổ sung y lệnh hay thêm sinh hiệu, hệ thống sẽ tự động cập nhật lên Firestore collection <code className="bg-amber-100 font-bold px-1 py-0.5 rounded font-mono">department_patients</code>. Đồng thời, ứng dụng liên tục lắng nghe collection <code className="bg-amber-100 font-bold px-1 py-0.5 rounded font-mono">clinical_records</code> để tiếp nhận bệnh nhân mới từ Khoa Cấp Cứu.
                  </p>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <Database className="w-3.5 h-3.5 text-blue-600" />
            <span>Dự án kết nối: <strong className="text-slate-900">{currentConfig.projectId}</strong> | Collection: <span className="font-mono text-blue-700">department_patients</span></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('config')}
              className="px-3 py-1.5 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer font-bold flex items-center gap-1"
            >
              <Settings className="w-3.5 h-3.5 text-blue-600" />
              <span>Cấu Hình</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg transition-colors cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

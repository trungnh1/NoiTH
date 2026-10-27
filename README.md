# HỆ THỐNG QUẢN LÝ BỆNH NHÂN NỘI TRÚ - KHOA NỘI TỔNG HỢP
## BỆNH VIỆN HÙNG VƯƠNG GIA LAI

Hệ thống quản lý bệnh nhân nội trú toàn diện được thiết kế riêng cho Khoa Nội Tổng Hợp - Bệnh viện Hùng Vương Gia Lai, tích hợp sơ đồ buồng giường theo thời gian thực, phân công bác sĩ trực, AI hỗ trợ chẩn đoán và đồng bộ dữ liệu thời gian thực từ Khoa Cấp Cứu qua Firebase Firestore.

---

## 🚀 Hướng dẫn Triển khai lên GitHub & Vercel

### 1. Đưa mã nguồn lên GitHub
1. Tạo một repository mới trên [GitHub](https://github.com).
2. Mở terminal tại thư mục dự án và chạy các lệnh sau:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Benh vien Hung Vuong Gia Lai - Khoa Noi Tong Hop"
   git branch -M main
   git remote add origin <URL_REPOSITORY_CUA_BAN>
   git push -u origin main
   ```

### 2. Triển khai lên Vercel
1. Đăng nhập vào [Vercel](https://vercel.com) bằng tài khoản GitHub của bạn.
2. Nhấn **Add New...** -> **Project** và chọn repository GitHub vừa tạo.
3. Vercel sẽ tự động phát hiện cấu hình Vite + React.
4. **Cấu hình Biến môi trường (Environment Variables)** trong phần cài đặt dự án trên Vercel trước khi Deploy:
   - `VITE_FIREBASE_API_KEY`: `AIzaSyCnWsWf_3S-mCXd9CY_yaf8mldvXy-Zx7o` (hoặc API Key Firebase của bạn)
   - `VITE_FIREBASE_PROJECT_ID`: `iron-foundation-kbcxw`
   - `VITE_FIREBASE_APP_ID`: `1:1074090936675:web:bfb5aee03beef58baceb56`
   - `VITE_FIREBASE_DATABASE_ID`: `ai-studio-clinicaldataform-1c5181d9-a5e0-4c0f-9dc7-144aaa297796`
5. Nhấn **Deploy** để hoàn tất.

---

## 💻 Tính năng chính
- **Sơ đồ buồng giường trực quan**: Phân chia theo 3 nhóm phòng (Tim mạch, Nhóm 2, Nhóm 1), hiển thị trạng thái sinh hiệu, nhãn đặc biệt (Thở oxy, Dùng vận mạch, Cần theo dõi sát).
- **Phân công & Quản lý Bác sĩ điều trị**: Gán bác sĩ phụ trách từng phòng hoặc từng bệnh nhân, lọc và tìm kiếm theo bác sĩ.
- **Đồng bộ tự động từ Khoa Cấp Cứu**: Lắng nghe dữ liệu thời gian thực từ Firestore (`KHOA_CAP_CUU`).
- **Thống kê chuyên khoa**: Thống kê ca bệnh Viêm gan B, A, Sốt xuất huyết, Cúm, Covid, Lao, Thủy đậu, Sởi và bệnh nhân trên 70 tuổi.
- **Hỗ trợ AI chẩn đoán & Hướng xử trí**: Tích hợp phân tích thông minh cho từng bệnh nhân.

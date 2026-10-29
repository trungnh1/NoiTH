# HƯỚNG DẪN CÀI ĐẶT & DEPLOY LÊN VERCEL (BẢO MẬT API KEY GEMINI & DEEPSEEK)

Ứng dụng quản lý buồng bệnh Bệnh viện Hùng Vương Gia Lai hỗ trợ 2 chế độ bóc tách bệnh án thông minh:
1. **Chế độ Regex Lâm Sàng Siêu Tốc (Offline / Không cần API):** Hoạt động ngay lập tức 100% trong trình duyệt, không tốn chi phí, tốc độ phản hồi 0ms.
2. **Chế độ Trí Tuệ Nhân Tạo (Gemini & DeepSeek):** Bóc tách ngữ nghĩa bệnh án qua Serverless Proxy an toàn tuyệt đối.

---

## 1. Bảo mật API Key trên Vercel (Không lộ Key ở Trình duyệt)

API Key của bạn được lưu trong biến môi trường (**Environment Variables**) trên Vercel, được gọi qua backend serverless function tại `/api/analyze-clinical-note.ts`. Trình duyệt của người dùng hay bác sĩ sẽ KHÔNG BAO GIỜ nhìn thấy API Key.

### Các bước lấy API Key:
- **Gemini API Key:** Truy cập [Google AI Studio](https://aistudio.google.com/app/apikey) -> Bấm **Create API Key**.
- **DeepSeek API Key:** Truy cập [DeepSeek Platform](https://platform.deepseek.com/api_keys) -> Đăng ký tài khoản và tạo API Key.

---

## 2. Cách Deploy Lên Vercel

### Cách 1: Deploy qua GitHub (Khuyên dùng)
1. Đẩy mã nguồn dự án lên GitHub của bạn:
   ```bash
   git init
   git add .
   git commit -m "Deploy Hospital EMR to Vercel"
   git branch -M main
   git remote add origin https://github.com/<tai-khoan-cua-ban>/<ten-repo>.git
   git push -u origin main
   ```
2. Mở trình duyệt vào [https://vercel.com](https://vercel.com) và đăng nhập bằng GitHub.
3. Bấm **Add New...** -> **Project** -> Chọn Repository bạn vừa tải lên.
4. Ở phần **Environment Variables**, thêm 2 biến sau:
   - **Tên biến:** `GEMINI_API_KEY` | **Giá trị:** Dán API key Gemini của bạn vào đây.
   - **Tên biến:** `DEEPSEEK_API_KEY` | **Giá trị:** Dán API key DeepSeek của bạn vào đây.
5. Bấm nút **Deploy**. Chờ khoảng 1-2 phút là trang web sẽ chạy online trên tên miền của Vercel (ví dụ: `https://ten-du-an.vercel.app`).

### Cách 2: Deploy trực tiếp bằng Vercel CLI (Dòng lệnh)
```bash
npm install -g vercel
vercel login
vercel
```
Sau đó vào trang quản trị Vercel Dashboard -> Chọn Project -> **Settings** -> **Environment Variables** -> Thêm `GEMINI_API_KEY` và `DEEPSEEK_API_KEY`.

---

## 3. Cấu hình Chọn Model ngay trên Giao diện Web
Trong cửa sổ Tiếp Nhận Bệnh Nhân (Mục "Dán Nhanh Bệnh Án / HIS"):
- Bác sĩ có thể bấm chuyển đổi giữa:
  - ⚡ **Thuật toán Nội khoa (Không cần mạng / 0s)**
  - 🤖 **Google Gemini AI**
  - 🧠 **DeepSeek AI**
- Bấm **"Phân tích & Tự động điền"** để hệ thống tự động bóc tách Họ tên, Tuổi, Giới tính, Chẩn đoán / Vấn đề, Kế hoạch điều trị và Tiền sử vào hồ sơ bệnh nhân!

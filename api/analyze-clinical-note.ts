// Vercel Serverless Function Proxy for Secure Gemini & DeepSeek API Calling
// Keep your GEMINI_API_KEY and DEEPSEEK_API_KEY secure in Vercel Environment Variables

const CLINICAL_EXTRACTION_SYSTEM_PROMPT = `Bạn là một bác sĩ nội khoa cao cấp chuyên phân tích và bóc tách dữ liệu bệnh án tiếp nhận vào viện tại Việt Nam.
Nhiệm vụ của bạn là đọc nội dung tóm tắt bệnh án tiếng Việt và trích xuất thành đối tượng JSON chính xác với cấu trúc sau:
{
  "fullName": "Họ và tên bệnh nhân viết hoa (nếu không có thì để rỗng hoặc BỆNH NHÂN)",
  "age": 60 (số nguyên tuổi),
  "gender": "Nam" hoặc "Nữ",
  "diagnosis": "Chẩn đoán bệnh / Vấn đề lâm sàng đầy đủ nhất (lấy từ mục Vấn đề hoặc Chẩn đoán)",
  "treatmentPlan": "Kế hoạch điều trị / Hướng xử trí / Y lệnh thuốc",
  "medicalHistory": "Tiền sử bệnh lý",
  "clinicalNote": "Tóm tắt diễn biến khám hiện tại và lý do vào viện",
  "labFindings": "Tóm tắt kết quả cận lâm sàng, X-quang, siêu âm, xét nghiệm máu nổi bật",
  "severity": "CRITICAL" (Nặng/Nguy kịch) hoặc "MODERATE" (Trung bình) hoặc "STABLE" (Ổn định),
  "suggestedTags": ["O2_CANULA", "VASOPRESSOR", "CLOSE_MONITORING", "ALLERGY", "FALL_RISK"]
}
Chỉ trả về JSON thuần túy, không bọc trong markdown hay text giải thích thừa.`;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { text, provider } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Thiếu nội dung bệnh án cần phân tích (text)' });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;

  // 1. Thử gọi DeepSeek nếu được yêu cầu hoặc có DEEPSEEK_API_KEY
  if ((provider === 'deepseek' || !geminiKey) && deepseekKey) {
    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deepseekKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: CLINICAL_EXTRACTION_SYSTEM_PROMPT },
            { role: 'user', content: `Nội dung bệnh án cần phân tích:\n${text}` }
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const rawJson = data.choices?.[0]?.message?.content;
        if (rawJson) {
          const parsed = JSON.parse(rawJson);
          return res.status(200).json({ success: true, provider: 'deepseek', data: parsed });
        }
      }
    } catch (err: any) {
      console.error('DeepSeek proxy error:', err);
    }
  }

  // 2. Thử gọi Gemini nếu có GEMINI_API_KEY
  if (geminiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: CLINICAL_EXTRACTION_SYSTEM_PROMPT },
                { text: `Nội dung bệnh án cần phân tích:\n${text}` }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawJson) {
          const parsed = JSON.parse(rawJson);
          return res.status(200).json({ success: true, provider: 'gemini', data: parsed });
        }
      }
    } catch (err: any) {
      console.error('Gemini proxy error:', err);
    }
  }

  // 3. Nếu chưa cấu hình biến môi trường trên Vercel, báo về để client dùng regex dự phòng
  return res.status(200).json({ 
    success: false, 
    message: 'Chưa cấu hình GEMINI_API_KEY hoặc DEEPSEEK_API_KEY trong Vercel Environment Variables. Client sẽ dùng thuật toán Regex offline dự phòng.' 
  });
}

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '10mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    department: 'Khoa Nội Tổng Hợp - Bệnh viện Hùng Vương Gia Lai',
    timestamp: new Date().toISOString(),
  });
});

// AI Clinical Patient Analysis
app.post('/api/ai/analyze-patient', async (req, res) => {
  try {
    const { patient } = req.body;
    if (!patient) {
      return res.status(400).json({ error: 'Dữ liệu bệnh nhân không hợp lệ' });
    }

    const prompt = `
Bạn là Trợ lý AI Cố vấn Lâm sàng Chuyên khoa Nội thuộc Bệnh viện Hùng Vương Gia Lai (Khoa Nội Tổng Hợp).
Hãy phân tích hồ sơ bệnh nhân nội trú sau và đưa ra đánh giá y khoa chuyên sâu, chuẩn mực theo Hướng dẫn chẩn đoán và điều trị của Bộ Y tế Việt Nam:

Hồ sơ bệnh nhân:
- Họ tên: ${patient.fullName}, Tuổi: ${patient.age}, Giới tính: ${patient.gender}
- Buồng bệnh: ${patient.roomNumber} - ${patient.bedNumber}
- Chẩn đoán chính: ${patient.primaryDiagnosis} (ICD-10: ${patient.icd10Primary || 'N/A'})
- Chẩn đoán kèm theo: ${patient.secondaryDiagnosis || 'Không'}
- Tiền sử / Bệnh nền: ${patient.medicalHistory || 'Không ghi nhận'}
- Dị ứng thuốc: ${patient.allergies || 'Không'}
- Mức độ hiện tại: ${patient.severity}
- Nhãn lâm sàng: ${(patient.tags || []).join(', ')}

Dấu hiệu sinh tồn gần nhất:
${(patient.vitals || []).map((v: any) => `- Lúc ${v.timestamp}: HA ${v.bpSystolic}/${v.bpDiastolic} mmHg, Mạch ${v.heartRate} l/p, Nhiệt độ ${v.temperature}°C, SpO2 ${v.spO2}%, Nhịp thở ${v.respiratoryRate} l/p, GCS: ${v.glasgow || 15}, Ghi chú: ${v.notes || 'Không'}`).join('\n')}

Diễn tiến lâm sàng gần nhất:
${(patient.evolutions || []).map((e: any) => `- [${e.timestamp} - ${e.doctorName}]: ${e.clinicalNote} | Xử trí: ${e.treatmentAction}`).join('\n')}

Xét nghiệm cận lâm sàng:
${(patient.labs || []).map((l: any) => `- ${l.testName} (${l.category}): ${l.value} ${l.unit} (BT: ${l.normalRange}) ${l.isPanicValue ? '[GIÁ TRỊ NGUY HIỂM]' : l.isAbnormal ? '[BẤT THƯỜNG]' : '[BÌNH THƯỜNG]'}`).join('\n')}

Thuốc y lệnh đang dùng:
${(patient.medications || []).map((m: any) => `- ${m.name} (${m.activeIngredient}) - Liều: ${m.dosage} - Đường: ${m.route} - Tần suất: ${m.frequency} - Giờ: ${m.timing}`).join('\n')}

Yêu cầu phân tích:
1. Đánh giá mức độ rủi ro (HIGH / MEDIUM / LOW).
2. Tóm tắt tình trạng lâm sàng cốt lõi hiện tại (khoảng 2-3 câu ngắn gọn, súc tích).
3. Đưa ra 3-4 chẩn đoán phân biệt hoặc biến chứng tiềm tàng cần tầm soát.
4. Phát hiện các cảnh báo an toàn lâm sàng (ví dụ: tương tác thuốc, xét nghiệm báo động đỏ, chống chỉ định, nguy cơ sốc/suy hô hấp/suy thận cấp/loạn nhịp tim).
5. Đề xuất can thiệp điều trị, bổ sung cận lâm sàng và hướng xử trí kế tiếp.
6. Chỉ dẫn theo dõi trọng tâm cho điều dưỡng và bác sĩ trực ca tiếp theo.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskLevel: {
              type: Type.STRING,
              description: 'HIGH, MEDIUM, hoặc LOW',
            },
            summary: {
              type: Type.STRING,
              description: 'Tóm tắt lâm sàng cốt lõi',
            },
            differentialDiagnosis: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Danh sách các chẩn đoán phân biệt và biến chứng',
            },
            clinicalAlerts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, description: 'critical, warning, hoặc info' },
                  message: { type: Type.STRING, description: 'Nội dung cảnh báo' },
                  evidence: { type: Type.STRING, description: 'Bằng chứng/chỉ số cụ thể' },
                },
                required: ['type', 'message', 'evidence'],
              },
            },
            drugInteractions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Tương tác thuốc hoặc lưu ý chỉnh liều',
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Khuyến nghị phác đồ điều trị và cận lâm sàng',
            },
            suggestedMonitoring: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Chỉ định theo dõi sát cho ca trực',
            },
          },
          required: [
            'riskLevel',
            'summary',
            'differentialDiagnosis',
            'clinicalAlerts',
            'recommendations',
            'suggestedMonitoring',
          ],
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    result.lastUpdated = new Date().toISOString();
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error analyzing patient:', error);
    res.status(500).json({
      error: 'Không thể phân tích hồ sơ bệnh nhân bằng AI lúc này.',
      details: error.message,
    });
  }
});

// AI Rapid Critical Patient Cohort Triage
app.post('/api/ai/critical-triage-cohort', async (req, res) => {
  try {
    const { criticalPatients } = req.body;
    if (!criticalPatients || !Array.isArray(criticalPatients) || criticalPatients.length === 0) {
      return res.status(400).json({ error: 'Không có dữ liệu bệnh nhân nguy kịch cần phân tích' });
    }

    const patientSummaries = criticalPatients.map((p: any) => {
      const v = p.vitals?.[0] || {};
      const panicLabs = (p.labs || []).filter((l: any) => l.isPanicValue || l.isAbnormal);
      return `
ID: ${p.id}
- Họ tên: ${p.fullName}, ${p.age}t, ${p.gender} | Buồng: P.${p.roomNumber} - ${p.bedNumber}
- Chẩn đoán: ${p.primaryDiagnosis} (kèm: ${p.secondaryDiagnosis || 'Không'})
- Mức độ: ${p.severity} | Nhãn: ${(p.tags || []).join(', ')}
- Sinh hiệu mới nhất: HA ${v.bpSystolic || '--'}/${v.bpDiastolic || '--'} mmHg, Mạch ${v.heartRate || '--'} l/p, SpO2 ${v.spO2 || '--'}%, Thở ${v.respiratoryRate || '--'} l/p, T: ${v.temperature || '--'}°C
- Cận lâm sàng bất thường: ${panicLabs.map((l: any) => `${l.testName}: ${l.value} ${l.unit} (${l.isPanicValue ? 'BÁO ĐỘNG ĐỎ' : 'BẤT THƯỜNG'})`).join('; ') || 'Chưa ghi nhận'}
- Thuốc đang dùng: ${(p.medications || []).map((m: any) => m.name + ' (' + m.dosage + ')').join(', ') || 'Chưa kê'}
- Tiền sử: ${p.medicalHistory || 'Không'}
- Ghi chú gần nhất: ${p.evolutions?.[0]?.clinicalNote || p.doctorNotes || 'Không'}
      `;
    }).join('\n---');

    const prompt = `
Bạn là Chuyên gia Cố vấn Lâm sàng Cấp Cứu & Hồi Sức Tim Mạch - Bệnh viện Hùng Vương Gia Lai.
Nhiệm vụ của bạn là phân tích NHANH TOÀN BỘ các ca bệnh nguy kịch / cần theo dõi sát sao hiện có trong Khoa Nội Tổng Hợp - Tim Mạch để hỗ trợ kíp trực phát hiện sớm nguy cơ xấu đi, phân tầng ưu tiên và can thiệp kịp thời.

Danh sách ${criticalPatients.length} bệnh nhân nguy kịch:
${patientSummaries}

Hãy phân tích toàn diện và trả về JSON theo đúng schema:
- summary: Tóm tắt 2-3 câu đánh giá tổng thể độ nguy kịch của các ca trong khoa, tình trạng sử dụng vận mạch, oxy mask/canula, và các nguy cơ tử vong tiềm ẩn.
- overallRiskLevel: "CRITICAL" | "HIGH" | "ELEVATED"
- keyUrgentActions: Danh sách 3-5 hành động cấp bách nhất kíp trực cần thực hiện ngay trong khoa.
- patientAnalyses: Danh sách đánh giá chi tiết cho TỪNG bệnh nhân (phải có đủ ${criticalPatients.length} phần tử tương ứng với mỗi ID):
  + patientId: ID chính xác của bệnh nhân.
  + triageTier: "P1_CRITICAL" (Báo động đỏ / Khẩn cấp đe dọa tính mạng) | "P2_HIGH_RISK" (Nguy cơ cao / Cần theo dõi sát từng giờ) | "P3_WATCH" (Cần lưu ý sát)
  + clinicalHeadline: Tiêu đề lâm sàng cô đọng (ví dụ: "Nguy cơ Sốc tim Killip IV / Tụt huyết áp khi giảm vận mạch")
  + rapidAssessment: Nhận định nhanh 1-2 câu về tình trạng huyết động, hô hấp và chuyển hóa của bệnh nhân.
  + imminentRisks: 2-3 biến chứng cấp có thể xảy ra trong ca trực (ví dụ: Rung thất, Phù phổi cấp, Toan hô hấp, Tụ máu xuất huyết tiêu hóa...).
  + urgentActions: 2-3 xử trí lâm sàng tức thì được khuyến cáo theo chuẩn Bộ Y tế / ESC / AHA (ví dụ: Lập monitor theo dõi liên tục, Giữ SpO2 > 94%, Đặt sonde tiểu theo dõi lượng nước tiểu / 1h, Chuẩn bị máy sốc điện...).
  + vitalWarning: Đánh giá nhanh về sinh hiệu (ví dụ: "Chỉ số sốc tăng cao (HR/SBP > 0.9), cần bù dịch thận trọng hoặc duy trì vận mạch").
  + handoverNote: 1 câu dặn dò cô đọng khi bàn giao ca trực.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            overallRiskLevel: { type: Type.STRING },
            keyUrgentActions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            patientAnalyses: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  patientId: { type: Type.STRING },
                  triageTier: { type: Type.STRING },
                  clinicalHeadline: { type: Type.STRING },
                  rapidAssessment: { type: Type.STRING },
                  imminentRisks: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  urgentActions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  vitalWarning: { type: Type.STRING },
                  handoverNote: { type: Type.STRING },
                },
                required: [
                  'patientId',
                  'triageTier',
                  'clinicalHeadline',
                  'rapidAssessment',
                  'imminentRisks',
                  'urgentActions',
                  'vitalWarning',
                  'handoverNote',
                ],
              },
            },
          },
          required: ['summary', 'overallRiskLevel', 'keyUrgentActions', 'patientAnalyses'],
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    result.analyzedAt = new Date().toISOString();
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error in critical-triage-cohort:', error);
    res.status(500).json({
      error: 'Không thể phân tích nhanh danh sách ca nguy kịch.',
      details: error.message,
    });
  }
});

// AI Clinical Chat Consultation for a specific patient
app.post('/api/ai/chat-consultation', async (req, res) => {
  try {
    const { patient, message, conversationHistory } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Vui lòng nhập câu hỏi' });
    }

    const systemInstruction = `
Bạn là Bác sĩ Trợ lý AI Lâm sàng của Khoa Nội Tổng Hợp - Bệnh viện Hùng Vương Gia Lai.
Nhiệm vụ của bạn là hỗ trợ các bác sĩ điều trị và điều dưỡng trong việc tra cứu phác đồ, đánh giá tương tác thuốc, phân tích xét nghiệm, cảnh báo an toàn và hướng dẫn xử trí ca bệnh.
Thông tin bệnh nhân hiện tại:
- Họ tên: ${patient?.fullName || 'Không rõ'}, Tuổi: ${patient?.age || 'N/A'}, Giới tính: ${patient?.gender || 'N/A'}
- Buồng: ${patient?.roomNumber || ''} - ${patient?.bedNumber || ''}
- Chẩn đoán: ${patient?.primaryDiagnosis || ''}
- Tiền sử: ${patient?.medicalHistory || 'Không ghi nhận'}
- Dị ứng: ${patient?.allergies || 'Không'}
- Mức độ: ${patient?.severity || 'STABLE'}
- Thuốc đang dùng: ${(patient?.medications || []).map((m: any) => m.name + ' (' + m.dosage + ')').join('; ')}
- Xét nghiệm mới: ${(patient?.labs || []).slice(0, 8).map((l: any) => l.testName + ': ' + l.value + ' ' + l.unit).join('; ')}

Quy tắc ứng xử:
- Trả lời bằng tiếng Việt chuyên ngành y khoa chính xác, súc tích, có dẫn chứng hướng dẫn điều trị (Bộ Y tế, ACC/AHA, KDIGO, GOLD, ESC...).
- Luôn đặt an toàn người bệnh lên hàng đầu; nhắc nhở kiểm tra lại các chống chỉ định.
- Giữ phong thái điềm tĩnh, chuyên nghiệp của một chuyên gia hội chẩn.
`;

    const contents = [];
    if (Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory) {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }],
        });
      }
    }
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contents as any,
      config: {
        systemInstruction,
        temperature: 0.3,
      },
    });

    res.json({
      success: true,
      reply: response.text,
    });
  } catch (error: any) {
    console.error('Error during clinical chat:', error);
    res.status(500).json({
      error: 'Lỗi xử lý tư vấn lâm sàng AI.',
      details: error.message,
    });
  }
});

// AI Shift Handover Report Generator
app.post('/api/ai/handover-report', async (req, res) => {
  try {
    const { patients, shift, reportingDoctor } = req.body;

    const patientSummaries = (patients || []).map((p: any) => {
      return `
[${p.roomNumber} - ${p.bedNumber}] ${p.fullName} (${p.age} tuổi, ${p.gender})
- Mức độ: ${p.severity} | Nhãn: ${(p.tags || []).join(', ')}
- Bác sĩ điều trị: ${p.attendingDoctorId}
- Chẩn đoán: ${p.primaryDiagnosis}
- Sinh hiệu mới nhất: HA ${p.vitals?.[0]?.bpSystolic || '--'}/${p.vitals?.[0]?.bpDiastolic || '--'}, Mạch ${p.vitals?.[0]?.heartRate || '--'}, SpO2 ${p.vitals?.[0]?.spO2 || '--'}%
- Thuốc chính: ${(p.medications || []).map((m: any) => m.name).join(', ')}
- Diễn biến mới: ${p.evolutions?.[0]?.clinicalNote || 'Ổn định'}
      `;
    }).join('\n');

    const prompt = `
Hãy đóng vai trò Thư ký Y khoa chuyên môn tạo "Báo Cáo Giao Ban Ca Trực" cho KHOA NỘI TỔNG HỢP - BỆNH VIỆN HÙNG VƯƠNG GIA LAI.
- Ca trực: ${shift || 'Ca Sáng / Đêm'}
- Bác sĩ báo cáo: ${reportingDoctor || 'Bác sĩ trực chính'}
- Tổng số bệnh nhân nội trú: ${(patients || []).length}

Dữ liệu bệnh nhân trong khoa:
${patientSummaries}

Hãy tạo một bản báo cáo giao ban chuẩn mực, bao gồm:
1. TIÊU ĐỀ BÁO CÁO GIAO BAN KHOA NỘI TỔNG HỢP - BỆNH VIỆN HÙNG VƯƠNG GIA LAI
2. TỔNG HỢP QUÂN SỐ VÀ TÌNH HÌNH CHUNG (Số ca hiện diện, số ca nặng, số ca thở oxy, số ca dùng vận mạch)
3. DANH SÁCH BỆNH NHÂN NẶNG & CẦN THEO DÕI ĐẶC BIỆT (Tóm tắt cô đọng từng ca: Phòng, Họ tên, Chẩn đoán, Xử trí trong ca, Những điểm kíp sau cần lưu ý đặc biệt)
4. CÁC XÉT NGHIỆM VÀ HỘI CHẨN CHƯA HOÀN TẤT / CẦN THỰC HIỆN TRONG CA TỚI
5. CẢNH BÁO AN TOÀN NGƯỜI BỆNH & CHỈ ĐẠO CỦA LÃNH ĐẠO KHOA

Trình bày định dạng Markdown sạch sẽ, rõ ràng, phân mục mạch lạc.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        temperature: 0.2,
      },
    });

    res.json({
      success: true,
      reportMarkdown: response.text,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error generating handover report:', error);
    res.status(500).json({
      error: 'Không thể tạo báo cáo giao ban lúc này.',
      details: error.message,
    });
  }
});

// Setup Vite or static serving
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Khoa Nội Tổng Hợp BV Hùng Vương Gia Lai app running on port ${PORT}`);
  });
}

startServer();

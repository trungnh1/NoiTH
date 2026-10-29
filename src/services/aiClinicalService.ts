import { ParsedClinicalNote, parseClinicalNoteRegex, CLINICAL_EXTRACTION_SYSTEM_PROMPT } from '../utils/clinicalTextParser';

export type AIProvider = 'offline_regex' | 'gemini' | 'deepseek';

export interface AIAnalysisConfig {
  provider: AIProvider;
  geminiApiKey?: string;
  deepseekApiKey?: string;
}

const LOCAL_STORAGE_KEY_AI_CONFIG = 'HUNG_VUONG_AI_CONFIG';

export function loadAIConfig(): AIAnalysisConfig {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_AI_CONFIG);
    if (saved) return JSON.parse(saved);
  } catch {
    // fallback
  }
  return {
    provider: 'offline_regex',
  };
}

export function saveAIConfig(config: AIAnalysisConfig): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_AI_CONFIG, JSON.stringify(config));
  } catch {
    // ignore
  }
}

/**
 * Gọi API Gemini (Google AI)
 */
async function callGeminiAPI(text: string, apiKey: string): Promise<ParsedClinicalNote> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
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

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Lỗi Gemini API HTTP ${response.status}`);
  }

  const data = await response.json();
  const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawJson) throw new Error('Gemini không phản hồi dữ liệu');

  const parsed = JSON.parse(rawJson);
  return {
    fullName: parsed.fullName || '',
    age: Number(parsed.age) || 50,
    gender: parsed.gender === 'Nữ' ? 'Nữ' : 'Nam',
    diagnosis: parsed.diagnosis || 'Theo dõi nội khoa',
    treatmentPlan: parsed.treatmentPlan || 'Theo dõi và điều trị nội khoa.',
    medicalHistory: parsed.medicalHistory,
    clinicalNote: parsed.clinicalNote,
    labFindings: parsed.labFindings,
    severity: parsed.severity || 'STABLE',
    suggestedTags: parsed.suggestedTags || [],
    rawText: text,
    confidence: 0.98,
  };
}

/**
 * Gọi API DeepSeek (https://api.deepseek.com/chat/completions)
 */
async function callDeepSeekAPI(text: string, apiKey: string): Promise<ParsedClinicalNote> {
  const url = 'https://api.deepseek.com/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
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

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Lỗi DeepSeek API HTTP ${response.status}`);
  }

  const data = await response.json();
  const rawJson = data.choices?.[0]?.message?.content;
  if (!rawJson) throw new Error('DeepSeek không phản hồi dữ liệu');

  const parsed = JSON.parse(rawJson);
  return {
    fullName: parsed.fullName || '',
    age: Number(parsed.age) || 50,
    gender: parsed.gender === 'Nữ' ? 'Nữ' : 'Nam',
    diagnosis: parsed.diagnosis || 'Theo dõi nội khoa',
    treatmentPlan: parsed.treatmentPlan || 'Theo dõi và điều trị nội khoa.',
    medicalHistory: parsed.medicalHistory,
    clinicalNote: parsed.clinicalNote,
    labFindings: parsed.labFindings,
    severity: parsed.severity || 'STABLE',
    suggestedTags: parsed.suggestedTags || [],
    rawText: text,
    confidence: 0.98,
  };
}

/**
 * Phân tích dữ liệu lâm sàng:
 * Thử qua Backend Proxy (/api/analyze-clinical-note) trước (bảo mật API key cho Vercel),
 * nếu không có backend thì gọi trực tiếp hoặc dùng bộ phân tích Regex tiếng Việt cực nhạy.
 */
export async function analyzeClinicalNote(
  text: string, 
  config?: AIAnalysisConfig
): Promise<ParsedClinicalNote> {
  const activeConfig = config || loadAIConfig();

  // 1. Nếu dùng Backend Vercel Serverless Function bảo mật API key
  try {
    const serverProxyRes = await fetch('/api/analyze-clinical-note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        provider: activeConfig.provider,
      }),
    });

    if (serverProxyRes.ok) {
      const result = await serverProxyRes.json();
      if (result.success && result.data) {
        return result.data;
      }
    }
  } catch {
    // Không có server proxy hoặc đang dev local -> Tiếp tục gọi trực tiếp
  }

  // 2. Chế độ Gemini API nếu có key
  if (activeConfig.provider === 'gemini' && activeConfig.geminiApiKey?.trim()) {
    try {
      return await callGeminiAPI(text, activeConfig.geminiApiKey.trim());
    } catch (err: any) {
      console.warn('Lỗi gọi Gemini API, chuyển sang phân tích Regex nội bộ:', err);
    }
  }

  // 3. Chế độ DeepSeek API nếu có key
  if (activeConfig.provider === 'deepseek' && activeConfig.deepseekApiKey?.trim()) {
    try {
      return await callDeepSeekAPI(text, activeConfig.deepseekApiKey.trim());
    } catch (err: any) {
      console.warn('Lỗi gọi DeepSeek API, chuyển sang phân tích Regex nội bộ:', err);
    }
  }

  // 4. Mặc định: Bộ phân tích Regex lâm sàng tiếng Việt thông minh (0 latency, 100% offline, cực chuẩn)
  return parseClinicalNoteRegex(text);
}

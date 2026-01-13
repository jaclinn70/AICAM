
import { GoogleGenAI } from "@google/genai";

/**
 * Сервис обработки фото через Gemini 2.5 Flash Image.
 * Оптимизирован для работы в Telegram WebView.
 */
export const processImage = async (base64Image: string, prompt: string): Promise<string | null> => {
  try {
    if (!base64Image || !base64Image.includes(',')) return null;

    // Инициализация прямо перед вызовом гарантирует использование актуального ключа из окружения
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const [header, data] = base64Image.split(',');
    const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data, mimeType } },
          { text: `Transform this image into: ${prompt}. Return ONLY the edited image as inline data.` }
        ],
      },
    });

    const candidates = response.candidates;
    if (candidates?.[0]?.content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData?.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("Gemini Service Error:", error);
    return null;
  }
};

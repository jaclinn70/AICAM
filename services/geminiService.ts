
import { GoogleGenAI } from "@google/genai";

// Инициализация AI с использованием ключа из переменных окружения
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

/**
 * Основная функция для обработки изображения через Gemini.
 * @param base64Image - изображение в формате base64 (data:image/jpeg;base64,...)
 * @param prompt - текстовая инструкция для нейросети
 * @returns - обработанное изображение в формате base64 или null при ошибке
 */
export const processImage = async (base64Image: string, prompt: string): Promise<string | null> => {
  try {
    if (!base64Image || !base64Image.includes(',')) {
      console.error("Gemini Service: Некорректные данные изображения");
      return null;
    }

    const ai = getAI();
    const [header, data] = base64Image.split(',');
    const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';

    // Используем модель gemini-2.5-flash-image (Nano Banana) для быстрой обработки фото
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: data,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    const candidate = response.candidates?.[0];
    if (!candidate || !candidate.content?.parts) {
      console.warn("Gemini Service: Пустой ответ от нейросети");
      return null;
    }

    // Ищем часть с изображением в ответе (нейросеть может вернуть текст + картинку)
    for (const part of candidate.content.parts) {
      if (part.inlineData?.data) {
        const resultData = part.inlineData.data.trim();
        if (resultData.length > 100) {
          // Возвращаем результат как PNG для стабильного отображения в Telegram
          return `data:image/png;base64,${resultData}`;
        }
      }
    }

    return null;
  } catch (error) {
    console.error("Gemini Service Error:", error);
    return null;
  }
};

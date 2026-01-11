
import { GoogleGenAI } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please configure your environment.");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Сервис обработки фото через Gemini 2.5 Flash Image.
 */
export const processImage = async (base64Image: string, prompt: string): Promise<string | null> => {
  try {
    if (!base64Image || !base64Image.includes(',')) return null;

    const ai = getAI();
    const [header, data] = base64Image.split(',');
    const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data, mimeType } },
          { text: `Act as a professional photo editor. Apply the following effect: ${prompt}. Return ONLY the edited image.` }
        ],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) return null;

    for (const part of parts) {
      if (part.inlineData?.data) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
};

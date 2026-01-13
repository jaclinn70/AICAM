
export type PresetCategory = 'Улучшения' | 'Цвет и Тон' | 'Арт-стили' | 'Свой' | 'Enhance' | 'Color & Tone' | 'Artistic' | 'Custom';
export type AspectRatio = '9:16' | '16:9';
export type Language = 'ru' | 'en';

export interface Preset {
  id: string;
  name: {
    ru: string;
    en: string;
  };
  category: string; // Будем маппить категории динамически
  prompt: string;
  icon: string;
}

export interface HistoryItem {
  id: string;
  original: string;
  processed: string;
  presetName: string;
  timestamp: number;
  ratio: AspectRatio;
}

export type AppMode = 'CAMERA' | 'PREVIEW' | 'GALLERY' | 'LOADING';


export type PresetCategory = 'Улучшения' | 'Цвет и Тон' | 'Арт-стили';

export interface Preset {
  id: string;
  name: string;
  category: PresetCategory;
  prompt: string;
  icon: string;
}

export type AppMode = 'CAMERA' | 'PREVIEW' | 'EDITING' | 'LOADING';

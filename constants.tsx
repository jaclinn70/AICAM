
import { Preset } from './types';

export const PRESETS: Preset[] = [
  // Улучшения
  {
    id: 'masterpiece',
    name: 'Шедевр',
    category: 'Улучшения',
    prompt: 'Transform this photo into a professional masterpiece. Enhance dynamic range, optimize lighting, improve clarity, and make details pop while keeping it realistic.',
    icon: '✨'
  },
  {
    id: 'crystal',
    name: 'Кристалл',
    category: 'Улучшения',
    prompt: 'Enhance details and sharpness. Make every texture clear and crisp. Professional photography style.',
    icon: '💎'
  },
  {
    id: 'portrait_pro',
    name: 'Портрет+',
    category: 'Улучшения',
    prompt: 'Optimize for portrait. Soften skin naturally, enhance eyes, and add a subtle professional studio lighting effect.',
    icon: '👤'
  },
  // Цвет и Тон
  {
    id: 'golden_hour',
    name: 'Золотой Час',
    category: 'Цвет и Тон',
    prompt: 'Apply a warm, sunset-like golden hour glow. Enhance oranges and yellows, soften shadows.',
    icon: '🌅'
  },
  {
    id: 'cyberpunk',
    name: 'Киберпанк',
    category: 'Цвет и Тон',
    prompt: 'Futuristic cyberpunk vibes. Deep blues and vibrant neon pink/purple highlights. High contrast night city look.',
    icon: '🌆'
  },
  {
    id: 'noir',
    name: 'Нуар',
    category: 'Цвет и Тон',
    prompt: 'Cinematic black and white. Deep blacks, dramatic highlights, fine grain. Classic 40s film noir style.',
    icon: '🎬'
  },
  // Арт-стили
  {
    id: 'anime',
    name: 'Аниме Сон',
    category: 'Арт-стили',
    prompt: 'Transform into a beautiful Studio Ghibli anime style painting. Soft colors, painterly textures, magical atmosphere.',
    icon: '⛩️'
  },
  {
    id: 'oil_paint',
    name: 'Масло',
    category: 'Арт-стили',
    prompt: 'Convert into a rich oil painting on canvas. Visible brushstrokes, vibrant colors, impressionist style.',
    icon: '🎨'
  },
  {
    id: 'blueprint',
    name: 'Чертеж',
    category: 'Арт-стили',
    prompt: 'Turn this into a futuristic architectural blueprint or a detailed technical sketch on blueprint paper.',
    icon: '📐'
  }
];

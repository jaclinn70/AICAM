
import { Preset } from './types';

export const PRESETS: Preset[] = [
  // Enhance / Улучшения
  {
    id: 'masterpiece',
    name: { ru: 'Шедевр', en: 'Masterpiece' },
    category: 'Enhance',
    prompt: 'Transform this photo into a professional masterpiece. Enhance dynamic range, optimize lighting, improve clarity, and make details pop while keeping it realistic.',
    icon: '✨'
  },
  {
    id: 'crystal',
    name: { ru: 'Кристалл', en: 'Crystal' },
    category: 'Enhance',
    prompt: 'Enhance details and sharpness. Make every texture clear and crisp. Professional photography style.',
    icon: '💎'
  },
  {
    id: 'portrait_pro',
    name: { ru: 'Портрет+', en: 'Portrait+' },
    category: 'Enhance',
    prompt: 'Optimize for portrait. Soften skin naturally, enhance eyes, and add a subtle professional studio lighting effect.',
    icon: '👤'
  },
  // Color & Tone / Цвет и Тон
  {
    id: 'golden_hour',
    name: { ru: 'Золотой Час', en: 'Golden Hour' },
    category: 'Color & Tone',
    prompt: 'Apply a warm, sunset-like golden hour glow. Enhance oranges and yellows, soften shadows.',
    icon: '🌅'
  },
  {
    id: 'cyberpunk',
    name: { ru: 'Киберпанк', en: 'Cyberpunk' },
    category: 'Color & Tone',
    prompt: 'Futuristic cyberpunk vibes. Deep blues and vibrant neon pink/purple highlights. High contrast night city look.',
    icon: '🌆'
  },
  {
    id: 'noir',
    name: { ru: 'Нуар', en: 'Noir' },
    category: 'Color & Tone',
    prompt: 'Cinematic black and white. Deep blacks, dramatic highlights, fine grain. Classic 40s film noir style.',
    icon: '🎬'
  },
  // Artistic / Арт-стили
  {
    id: 'anime',
    name: { ru: 'Аниме', en: 'Anime' },
    category: 'Artistic',
    prompt: 'Transform into a beautiful Studio Ghibli anime style painting. Soft colors, painterly textures, magical atmosphere.',
    icon: '⛩️'
  },
  {
    id: 'oil_paint',
    name: { ru: 'Масло', en: 'Oil Paint' },
    category: 'Artistic',
    prompt: 'Convert into a rich oil painting on canvas. Visible brushstrokes, vibrant colors, impressionist style.',
    icon: '🎨'
  },
  {
    id: 'blueprint',
    name: { ru: 'Чертеж', en: 'Blueprint' },
    category: 'Artistic',
    prompt: 'Turn this into a futuristic architectural blueprint or a detailed technical sketch on blueprint paper.',
    icon: '📐'
  }
];

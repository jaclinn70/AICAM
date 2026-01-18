import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AppMode, HistoryItem, AspectRatio, Language } from './types';
import { PRESETS } from './constants';
import { processImage } from './services/geminiService';

declare global {
  interface Window {
    Telegram: any;
  }
}

// Премиальная иконка приложения
const AppIcon = ({ size = 64, className = "", idPrefix = "" }: { size?: number, className?: string, idPrefix?: string }) => (
  <svg width={size} height={size} viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id={`grad_${idPrefix}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1E40AF" />
        <stop offset="50%" stopColor="#3B82F6" />
        <stop offset="100%" stopColor="#60A5FA" />
      </linearGradient>
      <filter id={`blur_${idPrefix}`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="20" />
      </filter>
    </defs>
    <rect width="1024" height="1024" rx="220" fill={`url(#grad_${idPrefix})`} />
    <circle cx="200" cy="200" r="150" fill="white" fillOpacity="0.05" filter={`url(#blur_${idPrefix})`} />
    <circle cx="824" cy="824" r="180" fill="white" fillOpacity="0.08" filter={`url(#blur_${idPrefix})`} />
    <rect x="212" y="312" width="600" height="400" rx="80" stroke="white" strokeWidth="40" strokeOpacity="0.2" />
    <path d="M412 312L440 240H584L612 312" stroke="white" strokeWidth="40" strokeOpacity="0.2" strokeLinejoin="round" />
    <circle cx="512" cy="512" r="160" fill="white" fillOpacity="0.1" stroke="white" strokeWidth="20" />
    <circle cx="512" cy="512" r="100" fill="white" fillOpacity="0.15" stroke="white" strokeWidth="10" />
    <circle cx="512" cy="512" r="40" fill="white" />
    <circle cx="750" cy="380" r="30" fill="#FDE047">
      <animate attributeName="opacity" values="0.4;1;0.4" dur="3s" repeatCount="indefinite" />
    </circle>
    <path d="M750 330V430M700 380H800" stroke="#FDE047" strokeWidth="15" strokeLinecap="round" opacity="0.8" />
  </svg>
);

const UI_STRINGS = {
  ru: {
    onboarding_title: 'Умная ИИ-камера',
    step1_t: 'Снимай', step1_d: 'Обычное фото.',
    step2_t: 'Стили', step2_d: 'Готовые фильтры.',
    step3_t: 'Энергия', step3_d: '1 заряд = 1 обработка.',
    go_btn: 'Погнали',
    action_download: 'Скачать в фото',
    action_back: 'Назад',
    support_title: 'Сделать подарок 💎',
    support_desc: 'Ваша поддержка помогает развивать ИИ и оплачивать сервера!',
    energy_title: 'Энергия ⚡️',
    energy_desc: 'Пополни заряды для творчества!',
    energy_pack: 'Пакет',
    energy_recharge: 'Зарядить энергию',
    energy_recharge_sub: 'Пакеты от 5 звезд ⭐️',
    energy_low: 'Мало энергии!',
    energy_limit: 'Безлимит 24ч',
    cancel: 'Отмена',
    done: 'ГОТОВО',
    archive: 'АРХИВ',
    empty_history: 'Ваша история пуста',
    original: 'Оригинал',
    drawing: 'Рисуем...',
    custom_style: 'Свой',
    custom_placeholder: 'Опишите стиль...',
    saved: 'Сохранено!',
    ai_thinking: 'Ой! Нейросеть задумалась. Попробуйте еще раз.',
    error_processing: 'Произошла ошибка при обработке.',
    categories: ['Улучшения', 'Цвет и Тон', 'Арт-стили', 'Свой'],
    mirror: 'Зеркало',
    enable_camera: 'Включить камеру',
    camera_error: 'Нет доступа к камере'
  },
  en: {
    onboarding_title: 'Smart AI Camera',
    step1_t: 'Capture', step1_d: 'Take a photo.',
    step2_t: 'Styles', step2_d: 'AI filters.',
    step3_t: 'Energy', step3_d: '1 charge = 1 edit.',
    go_btn: 'Let\'s Go',
    action_download: 'Save to Photos',
    action_back: 'Back',
    support_title: 'Support Project 💎',
    support_desc: 'Your support helps us improve AI and keep servers running!',
    energy_title: 'Energy ⚡️',
    energy_desc: 'Get more charges to create!',
    energy_pack: 'Pack',
    energy_recharge: 'Recharge Energy',
    energy_recharge_sub: 'Starting from 5 stars ⭐️',
    energy_low: 'Low energy!',
    energy_limit: 'Unlimited 24h',
    cancel: 'Cancel',
    done: 'DONE',
    archive: 'ARCHIVE',
    empty_history: 'Your history is empty',
    original: 'Original',
    drawing: 'Painting...',
    custom_style: 'Custom',
    custom_placeholder: 'Describe style...',
    saved: 'Saved!',
    ai_thinking: 'AI is thinking too long. Try again.',
    error_processing: 'Processing error occurred.',
    categories: ['Enhance', 'Color & Tone', 'Artistic', 'Custom'],
    mirror: 'Mirror',
    enable_camera: 'Enable Camera',
    camera_error: 'Camera access denied'
  }
};

const compressImage = async (base64: string, ratio: AspectRatio): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const base = 800;
      if (ratio === '9:16') {
        canvas.width = base * (9/16); canvas.height = base;
      } else {
        canvas.width = base; canvas.height = base * (9/16);
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject();
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = base64;
  });
};

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('ru');
  const [mode, setMode] = useState<AppMode>('CAMERA');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isMirrored, setIsMirrored] = useState<boolean>(false);
  const aspectRatio: AspectRatio = '9:16';
  const [originalPhoto, setOriginalPhoto] = useState<string | null>(null);
  const [displayImage, setDisplayImage] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [shutterActive, setShutterActive] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [credits, setCredits] = useState(10);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [activeActionSheet, setActiveActionSheet] = useState<'NONE' | 'SAVE' | 'SUPPORT' | 'RECHARGE'>('NONE');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [tgHeight, setTgHeight] = useState<number | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tg = window.Telegram?.WebApp;

  const t = useMemo(() => UI_STRINGS[lang], [lang]);

  // Telegram Main Button Management
useEffect(() => {
  if (!tg) return;

  tg.ready();
  tg.expand();

  // 🔑 Фиксируем реальную высоту Telegram WebApp
  const updateHeight = () => {
    const h =
      tg.viewportStableHeight ||
      tg.viewportHeight ||
      window.innerHeight;

    setTgHeight(h);
  };

  updateHeight();
  tg.onEvent('viewportChanged', updateHeight);

  const onBack = () => {
    if (mode !== 'CAMERA') {
      setMode('CAMERA');
      setDisplayImage(null);
      setOriginalPhoto(null);
      setActiveActionSheet('NONE');
    }
  };

  tg.BackButton.onClick(onBack);
  if (mode !== 'CAMERA') tg.BackButton.show();
  else tg.BackButton.hide();

  return () => {
    tg.offEvent('viewportChanged', updateHeight);
    tg.BackButton.offClick(onBack);
  };
}, [tg, mode]);

  // Language & Onboarding
  useEffect(() => {
    const savedLang = localStorage.getItem('ai_cam_lang') as Language;
    if (savedLang) setLang(savedLang);
    else {
      const tgLang = tg?.initDataUnsafe?.user?.language_code;
      if (tgLang && tgLang.startsWith('en')) setLang('en');
    }
    const seen = localStorage.getItem('ai_cam_onboarding_seen');
    if (!seen) setShowOnboarding(true);
  }, [tg]);

  useEffect(() => { setActiveCategory(t.categories[0]); }, [lang, t.categories]);
  useEffect(() => { setIsMirrored(facingMode === 'user'); }, [facingMode]);

  // Camera Logic
 const startCamera = useCallback(async () => {
  if (mode !== 'CAMERA' || showOnboarding) return;

  setIsCameraReady(false);
  setCameraError(false);

  try {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode,
        aspectRatio: 9 / 16,
        width: { ideal: 1080 },
        height: { ideal: 1920 }
      },
      audio: false
    });

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute('playsinline', 'true');
      videoRef.current.muted = true;

      videoRef.current.onloadedmetadata = async () => {
        try {
          await videoRef.current?.play();
          setIsCameraReady(true);
        } catch {
          setCameraError(true);
        }
      };
    }
  } catch (err) {
    console.error(err);
    setCameraError(true);
  }
}, [facingMode, mode, showOnboarding]);

  useEffect(() => {
    startCamera();
    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [startCamera]);

  // TG specific layout fixes
 useEffect(() => {
  if (!tg) return;

  tg.ready();

  // 🔥 КЛЮЧЕВОЕ
  tg.expand();
  tg.setHeaderColor('#000000');
  tg.setBackgroundColor('#000000');

  document.body.style.backgroundColor = '#000';
  document.body.style.overflow = 'hidden';

  const onBack = () => {
    if (mode !== 'CAMERA') {
      setMode('CAMERA');
      setDisplayImage(null);
      setOriginalPhoto(null);
      setActiveActionSheet('NONE');
    }
  };

  tg.BackButton.onClick(onBack);
  if (mode !== 'CAMERA') tg.BackButton.show();
  else tg.BackButton.hide();

  return () => tg.BackButton.offClick(onBack);
}, [tg, mode]);

  const capture = useCallback(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (v && c && isCameraReady) {
      const targetRatio = aspectRatio === '9:16' ? 9 / 16 : 16 / 9;
      const vWidth = v.videoWidth;
      const vHeight = v.videoHeight;
      const vRatio = vWidth / vHeight;
      let sWidth, sHeight, sx, sy;
      
      if (vRatio > targetRatio) {
        sHeight = vHeight; sWidth = vHeight * targetRatio; sx = (vWidth - sWidth) / 2; sy = 0;
      } else {
        sWidth = vWidth; sHeight = vWidth / targetRatio; sx = 0; sy = (vHeight - sHeight) / 2;
      }
      
      c.width = aspectRatio === '9:16' ? 1080 : 1920;
      c.height = aspectRatio === '9:16' ? 1920 : 1080;
      const ctx = c.getContext('2d');
      if (ctx) {
        setShutterActive(true);
        setTimeout(() => setShutterActive(false), 150);
        if (isMirrored) { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
        ctx.drawImage(v, sx, sy, sWidth, sHeight, 0, 0, c.width, c.height);
        const url = c.toDataURL('image/jpeg', 0.95);
        setOriginalPhoto(url); setDisplayImage(url); setMode('PREVIEW');
        tg?.HapticFeedback?.impactOccurred('medium');
      }
    }
  }, [isMirrored, tg, isCameraReady, aspectRatio]);

  const runAI = async (prompt: string, name: string) => {
    if (isProcessing || !originalPhoto) return;
    if (credits <= 0) {
      tg?.HapticFeedback?.notificationOccurred('error');
      setActiveActionSheet('RECHARGE');
      return;
    }
    setIsProcessing(true);
    tg?.HapticFeedback?.impactOccurred('light');
    try {
      const small = await compressImage(originalPhoto, aspectRatio);
      const res = await processImage(small, prompt);
      if (res) {
        setDisplayImage(res);
        setCredits(c => Math.max(0, c - 1));
        setHistory(h => [{ 
          id: Date.now().toString(), original: originalPhoto, processed: res, presetName: name, timestamp: Date.now(), ratio: aspectRatio
        }, ...h].slice(0, 20));
        tg?.HapticFeedback?.notificationOccurred('success');
      } else if (tg?.initData) tg.showAlert(t.ai_thinking);
    } catch (error) { 
      if (tg?.initData) tg.showAlert(t.error_processing);
    } finally { setIsProcessing(false); }
  };

  const handleAction = (type: 'PAYPAL' | 'YOOMONEY' | 'SAVE') => {
    tg?.HapticFeedback?.impactOccurred('light');
    if (type === 'SAVE' && displayImage) {
      const a = document.createElement('a');
      a.href = displayImage; a.download = `AICAM_${Date.now()}.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      if (tg?.initData) tg.showAlert(t.saved); 
    } else if (type === 'PAYPAL') {
      const url = 'https://paypal.me/lorenn70';
      if (tg?.initData) tg.openLink(url); else window.open(url, '_blank');
    } else if (type === 'YOOMONEY') {
      const url = 'https://yoomoney.ru/to/410014450299235';
      if (tg?.initData) tg.openLink(url); else window.open(url, '_blank');
    }
    setActiveActionSheet('NONE');
  };

  return (
    // Fix: Removed duplicate height property from style object as it is not allowed in JSX. Using 100dvh for better mobile layout.
    <div className="fixed inset-0 bg-black text-white font-['Inter'] select-none overflow-hidden touch-none" style={{
  height: '100dvh',
  paddingTop: 'env(safe-area-inset-top)',
}}
>
      <div className={`fixed inset-0 z-[100] bg-white transition-opacity duration-150 pointer-events-none ${shutterActive ? 'opacity-100' : 'opacity-0'}`} />
      
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 h-24 flex justify-between items-end px-6 pb-4 z-[250] pointer-events-none">
         <div className="font-black italic text-xl tracking-tighter pointer-events-auto flex items-center gap-2">
            <AppIcon size={24} idPrefix="header" />
            <span>AI<span className="text-blue-500">.</span>CAM</span>
         </div>
         <div className="flex items-center gap-2 pointer-events-auto">
            <button onClick={() => { setLang(l => l === 'ru' ? 'en' : 'ru'); tg?.HapticFeedback?.impactOccurred('light'); }} className="glass px-3 py-1.5 rounded-full text-[10px] font-black border border-white/10 uppercase">{lang}</button>
            <button onClick={() => setActiveActionSheet('RECHARGE')} className="glass px-3 py-1.5 rounded-full text-[10px] font-black border border-white/10">⚡️ {credits}</button>
            <button onClick={() => setActiveActionSheet('SUPPORT')} className="glass w-8 h-8 rounded-full flex items-center justify-center border border-white/10 text-base">💎</button>
         </div>
      </div>

      {showOnboarding && (
        <div className="fixed inset-0 z-[500] bg-black flex flex-col items-center justify-center p-8 text-center animate-in">
          <div className="mb-8"><AppIcon size={100} idPrefix="onboard" className="shadow-[0_0_60px_rgba(59,130,246,0.5)] rounded-[35px]" /></div>
          <h2 className="text-2xl font-black italic mb-8 uppercase">{t.onboarding_title}</h2>
          <div className="space-y-4 text-left w-full max-w-xs mb-10">
            {[{ i: '📸', t: t.step1_t, d: t.step1_d }, { i: '🪄', t: t.step2_t, d: t.step2_d }, { i: '⚡️', t: t.step3_t, d: t.step3_d }].map((s, idx) => (
              <div key={idx} className="flex items-center gap-4 bg-white/5 p-4 rounded-3xl border border-white/10">
                <span className="text-xl">{s.i}</span><div><div className="text-[10px] font-black uppercase text-blue-400">{s.t}</div><div className="text-[11px] text-white/40">{s.d}</div></div>
              </div>
            ))}
          </div>
          <button onClick={() => { setShowOnboarding(false); localStorage.setItem('ai_cam_onboarding_seen', 'true'); startCamera(); }} className="w-full max-w-xs py-4 bg-blue-600 rounded-2xl text-[11px] font-black uppercase tracking-widest">{t.go_btn}</button>
        </div>
      )}

      {activeActionSheet !== 'NONE' && (
        <div className="fixed inset-0 z-[400] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setActiveActionSheet('NONE')} />
          <div className="relative bg-zinc-900 rounded-t-[2.5rem] p-6 pb-12 border-t border-white/10 animate-in">
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6" />
            {activeActionSheet === 'SAVE' && <button onClick={() => handleAction('SAVE')} className="w-full py-5 bg-blue-500 rounded-2xl font-black uppercase text-[10px] tracking-widest">{t.action_download}</button>}
            {activeActionSheet === 'SUPPORT' && (
              <div className="space-y-4 text-center">
                 <h3 className="font-black uppercase text-[10px] tracking-widest">{t.support_title}</h3>
                 <p className="text-white/40 text-[11px] px-4">{t.support_desc}</p>
                 <div className="grid grid-cols-1 gap-3 pt-4">
                    <button onClick={() => handleAction('PAYPAL')} className="w-full py-4 bg-[#0070ba] rounded-2xl font-black uppercase text-[10px] tracking-widest">PayPal</button>
                    <button onClick={() => handleAction('YOOMONEY')} className="w-full py-4 bg-[#8b3ffc] rounded-2xl font-black uppercase text-[10px] tracking-widest">ЮMoney</button>
                 </div>
              </div>
            )}
            {activeActionSheet === 'RECHARGE' && (
              <div className="space-y-4">
                <div className="text-center"><h3 className="font-black uppercase text-[10px] tracking-widest">{t.energy_title}</h3><p className="text-white/40 text-[11px]">{t.energy_desc}</p></div>
                {[{ s: 5, a: "30" }, { s: 15, a: "100", p: true }, { s: 49, a: t.energy_limit }].map((pkg, i) => (
                    <button key={i} className={`w-full p-4 rounded-2xl border flex items-center justify-between ${pkg.p ? 'bg-blue-500/10 border-blue-500' : 'bg-white/5 border-white/10'}`}>
                      <div className="text-left"><div className="text-[9px] font-black uppercase text-white/40">{t.energy_pack}</div><div className="text-sm font-bold text-blue-400">+{pkg.a}</div></div>
                      <div className="bg-white/10 px-3 py-1 rounded-full font-black text-[10px]">{pkg.s} ⭐️</div>
                    </button>
                ))}
              </div>
            )}
            <button onClick={() => setActiveActionSheet('NONE')} className="w-full py-4 mt-4 bg-white/5 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white/40">{t.action_back}</button>
          </div>
        </div>
      )}

     {mode === 'CAMERA' && (
  <div className="fixed inset-0 bg-black overflow-hidden">

    {/* Camera */}
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
    className={`absolute left-1/2 top-1/2 min-w-full min-h-full -translate-x-1/2 -translate-y-1/2 object-cover transition-opacity duration-300 ${
  isCameraReady ? 'opacity-100' : 'opacity-0'
} ${isMirrored ? 'scale-x-[-1]' : ''}`}
    />

{/* DEBUG 9:16 MASK */}
<div
  className="absolute inset-0 flex items-center justify-center z-[9999]"
  style={{ pointerEvents: 'none' }}
>
  <div
    style={{
      aspectRatio: '9 / 16',
      height: '100%',
      background: 'rgba(255,0,0,0.15)',
      border: '4px solid red',
      borderRadius: '24px'
    }}
  >
    {/* left mask */}
    <div
      style={{
        position: 'absolute',
        left: '-100vw',
        top: 0,
        width: '100vw',
        height: '100%',
        background: 'rgba(0,0,0,0.7)'
      }}
    />
    {/* right mask */}
    <div
      style={{
        position: 'absolute',
        right: '-100vw',
        top: 0,
        width: '100vw',
        height: '100%',
        background: 'rgba(0,0,0,0.7)'
      }}
    />
  </div>
</div>
    
    {!isCameraReady && !cameraError && (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )}

    {cameraError && (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
        <div className="text-4xl mb-4">🚫</div>
        <div className="text-xs font-black uppercase opacity-40 mb-6">
          {t.camera_error}
        </div>
        <button
          onClick={startCamera}
          className="px-6 py-3 bg-white text-black rounded-full font-black uppercase text-xs tracking-widest"
        >
          {t.enable_camera}
        </button>
      </div>
    )}

  </div>
)}

      {mode === 'PREVIEW' && displayImage && (
        <div className="h-full flex flex-col bg-black animate-in">
          <div className="flex-grow flex items-center justify-center p-6 pt-24 pb-4 relative overflow-hidden" onPointerDown={() => setShowOriginal(true)} onPointerUp={() => setShowOriginal(false)}>
            <img src={showOriginal ? originalPhoto! : displayImage} className={`rounded-[2rem] shadow-2xl transition-all duration-300 object-cover ${aspectRatio === '9:16' ? 'h-full w-auto' : 'w-full h-auto'}`} alt="Preview" />
            {showOriginal && <div className="absolute top-28 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-1.5 rounded-full text-[9px] font-black uppercase border border-white/10 z-10">{t.original}</div>}
            {isProcessing && <div className="absolute inset-0 bg-black/50 backdrop-blur-md flex flex-col items-center justify-center z-50"><div className="w-10 h-10 border-4 border-t-blue-500 border-white/10 rounded-full animate-spin mb-4" /><div className="text-[9px] font-black uppercase tracking-widest">{t.drawing}</div></div>}
          </div>
          <div className="bg-zinc-900 rounded-t-[3rem] p-6 pb-12 border-t border-white/10">
            <div className="flex gap-4 mb-6 overflow-x-auto no-scrollbar">
              {t.categories.map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)} className={`text-[9px] font-black uppercase tracking-widest pb-2 min-w-max transition-all ${activeCategory === cat ? 'text-white border-b-2 border-blue-500' : 'text-white/20 border-b-2 border-transparent'}`}>{cat}</button>
              ))}
            </div>
            <div className="min-h-[90px]">
              {activeCategory === t.categories[3] ? (
                <div className="relative">
                  <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} placeholder={t.custom_placeholder} rows={2} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 pr-12 resize-none text-white" />
                  <button onClick={() => runAI(customPrompt, t.custom_style)} disabled={!customPrompt.trim() || isProcessing} className="absolute right-2 bottom-2 w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-base active:scale-90 transition-all">🪄</button>
                </div>
              ) : (
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {PRESETS.filter(p => p.category === UI_STRINGS.en.categories[t.categories.indexOf(activeCategory)]).map(p => (
                    <button key={p.id} onClick={() => runAI(p.prompt, p.name[lang])} className="glass px-4 py-3 rounded-xl min-w-max flex flex-col items-center gap-1 border border-white/5 active:bg-blue-500/20 transition-all">
                      <span className="text-xl">{p.icon}</span><span className="text-[8px] font-black uppercase">{p.name[lang]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {mode === 'GALLERY' && (
        <div className="h-full p-6 pt-24 bg-black overflow-y-auto no-scrollbar animate-in">
          <div className="flex justify-between items-center mb-8"><h2 className="text-4xl font-black italic">{t.archive}</h2><button onClick={() => setMode('CAMERA')} className="w-10 h-10 rounded-full glass flex items-center justify-center">✕</button></div>
          {history.length === 0 ? <div className="py-20 text-center opacity-20 uppercase text-[9px] font-black tracking-[0.5em]">{t.empty_history}</div> : (
            <div className="grid grid-cols-2 gap-3 pb-20">
              {history.map(item => (
                <div key={item.id} onClick={() => { setDisplayImage(item.processed); setOriginalPhoto(item.original); setAspectRatio(item.ratio); setMode('PREVIEW'); }} className={`rounded-2xl overflow-hidden border border-white/5 active:scale-95 transition-all bg-zinc-900 relative ${item.ratio === '9:16' ? 'aspect-[9/16]' : 'aspect-[16/9] col-span-2'}`}>
                  <img src={item.processed} className="w-full h-full object-cover" />
                  <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-[7px] font-bold uppercase">{item.presetName}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;

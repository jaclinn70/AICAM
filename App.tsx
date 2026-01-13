
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AppMode, HistoryItem, AspectRatio, Language } from './types';
import { PRESETS } from './constants';
import { processImage } from './geminiService';

declare global {
  interface Window {
    Telegram: any;
  }
}

const UI_STRINGS = {
  ru: {
    onboarding_title: 'Твоя AI Камера',
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
    mirror: 'Зеркало'
  },
  en: {
    onboarding_title: 'Your AI Camera',
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
    mirror: 'Mirror'
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
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
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
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tg = window.Telegram?.WebApp;

  const t = useMemo(() => UI_STRINGS[lang], [lang]);

  // MainButton Control
  useEffect(() => {
    if (tg?.MainButton) {
      if (mode === 'PREVIEW' && !isProcessing) {
        tg.MainButton.setText(t.done);
        tg.MainButton.show();
      } else {
        tg.MainButton.hide();
      }
    }
  }, [mode, isProcessing, t.done, tg]);

  useEffect(() => {
    const onMainClick = () => {
      if (mode === 'PREVIEW') setActiveActionSheet('SAVE');
    };
    tg?.MainButton?.onClick(onMainClick);
    return () => tg?.MainButton?.offClick(onMainClick);
  }, [mode, tg]);

  useEffect(() => {
    const savedLang = localStorage.getItem('ai_cam_lang') as Language;
    if (savedLang) {
      setLang(savedLang);
    } else {
      const tgLang = tg?.initDataUnsafe?.user?.language_code;
      if (tgLang && tgLang.startsWith('en')) setLang('en');
    }
  }, []);

  useEffect(() => {
    setActiveCategory(t.categories[0]);
  }, [lang, t.categories]);

  useEffect(() => {
    setIsMirrored(facingMode === 'user');
  }, [facingMode]);

  useEffect(() => {
    const isTg = !!(tg?.initData && tg?.initData !== "");
    if (isTg) {
      tg.ready();
      tg.expand();
      const color = tg.themeParams?.bg_color || '#000000';
      tg.headerColor = color;
      tg.backgroundColor = color;
      
      const onBack = () => {
        if (mode !== 'CAMERA') {
          setMode('CAMERA');
          setDisplayImage(null);
          setOriginalPhoto(null);
          setActiveActionSheet('NONE');
        }
      };
      tg.BackButton.onClick(onBack);
      if (mode !== 'CAMERA') tg.BackButton.show(); else tg.BackButton.hide();
      return () => tg.BackButton.offClick(onBack);
    }
    const seen = localStorage.getItem('ai_cam_onboarding_seen');
    if (!seen) setShowOnboarding(true);
  }, [tg, mode]);

  const startCamera = useCallback(async () => {
    if (mode !== 'CAMERA') return;
    setIsCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setIsCameraReady(true);
          videoRef.current?.play();
        };
      }
    } catch (e) { console.error(e); }
  }, [facingMode, mode]);

  useEffect(() => { startCamera(); }, [startCamera]);

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
      } else {
        if (tg?.initData) tg.showAlert(t.ai_thinking);
      }
    } catch (error) { 
      if (tg?.initData) tg.showAlert(t.error_processing);
    } finally { setIsProcessing(false); }
  };

  const handleAction = (type: 'PAYPAL' | 'YOOMONEY' | 'SAVE') => {
    tg?.HapticFeedback?.impactOccurred('light');
    if (type === 'SAVE' && displayImage) {
      const a = document.createElement('a');
      a.href = displayImage;
      a.download = `AICAM_${Date.now()}.png`;
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
    <div className="fixed inset-0 bg-black text-white font-['Inter'] select-none overflow-hidden" style={{ backgroundColor: tg?.themeParams?.bg_color || '#000000' }}>
      <div className={`fixed inset-0 z-[100] bg-white transition-opacity duration-150 pointer-events-none ${shutterActive ? 'opacity-100' : 'opacity-0'}`} />
      
      {showOnboarding && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500 overflow-y-auto no-scrollbar">
          <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-2xl">📸</div>
          <h2 className="text-2xl font-black italic tracking-tighter mb-6 uppercase">{t.onboarding_title}</h2>
          <div className="space-y-4 text-left w-full max-w-xs mb-8">
            {[{ icon: '📸', t: t.step1_t, d: t.step1_d }, { icon: '🪄', t: t.step2_t, d: t.step2_d }, { icon: '⚡️', t: t.step3_t, d: t.step3_d }].map((step, i) => (
              <div key={i} className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl">
                <div className="text-xl">{step.icon}</div>
                <div><div className="text-[10px] font-black uppercase text-blue-500">{step.t}</div><div className="text-[11px] text-white/50">{step.d}</div></div>
              </div>
            ))}
          </div>
          <button onClick={() => { setShowOnboarding(false); localStorage.setItem('ai_cam_onboarding_seen', 'true'); }} className="w-full max-w-xs py-4 bg-white text-black rounded-xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-transform">{t.go_btn}</button>
        </div>
      )}

      {activeActionSheet !== 'NONE' && (
        <>
          <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm animate-in fade-in" onClick={() => setActiveActionSheet('NONE')} />
          <div className="fixed inset-x-0 bottom-0 z-[160] bg-zinc-900 rounded-t-[2.5rem] p-6 pb-12 animate-in slide-in-from-bottom duration-300 border-t border-white/10 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: tg?.themeParams?.secondary_bg_color || '#18181b' }}>
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-8" />
            {activeActionSheet === 'SAVE' && <button onClick={() => handleAction('SAVE')} className="w-full py-5 bg-blue-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-[0.98] transition-all">{t.action_download}</button>}
            {activeActionSheet === 'SUPPORT' && (
              <div className="space-y-4 text-center">
                 <h3 className="font-black uppercase text-[10px] tracking-widest mb-1">{t.support_title}</h3>
                 <p className="text-white/40 text-[11px] mb-6">{t.support_desc}</p>
                 <div className="grid grid-cols-1 gap-3">
                    <button onClick={() => handleAction('PAYPAL')} className="w-full py-5 bg-[#0070ba] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest active:opacity-90">PayPal</button>
                    <button onClick={() => handleAction('YOOMONEY')} className="w-full py-5 bg-[#8b3ffc] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest active:opacity-90">ЮMoney</button>
                 </div>
              </div>
            )}
            {activeActionSheet === 'RECHARGE' && (
              <div className="space-y-4">
                <div className="text-center mb-6"><h3 className="font-black uppercase text-[10px] tracking-widest mb-1">{t.energy_title}</h3><p className="text-white/40 text-[11px]">{t.energy_desc}</p></div>
                <div className="grid grid-cols-1 gap-3">
                  {[{ stars: 5, amount: "30" }, { stars: 15, amount: "100", popular: true }, { stars: 49, amount: t.energy_limit }].map((pkg, i) => (
                    <button key={i} className={`w-full p-5 rounded-2xl border flex items-center justify-between active:scale-[0.98] transition-all ${pkg.popular ? 'bg-blue-500/10 border-blue-500' : 'bg-white/5 border-white/10'}`}>
                      <div className="text-left"><div className="text-[10px] font-black uppercase">{t.energy_pack}</div><div className="text-sm font-bold text-blue-400">+{pkg.amount}</div></div>
                      <div className="bg-white/10 px-3 py-1.5 rounded-full font-black text-xs">{pkg.stars} ⭐️</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => setActiveActionSheet('NONE')} className="w-full py-5 mt-4 bg-white/5 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white/40">{t.action_back}</button>
          </div>
        </>
      )}

      {mode === 'CAMERA' && (
        <div className="h-full relative flex flex-col bg-black">
          <div className="fixed top-12 left-6 right-6 flex justify-between items-center z-[60]">
             <div className="font-black italic text-2xl tracking-tighter">AI<span className="text-blue-500">.</span>CAM</div>
             <div className="flex items-center gap-2">
                <button onClick={() => { const next = lang === 'ru' ? 'en' : 'ru'; setLang(next); localStorage.setItem('ai_cam_lang', next); tg?.HapticFeedback?.impactOccurred('light'); }} className="glass px-3 py-2 rounded-full text-[10px] font-black border border-white/10 uppercase">{lang}</button>
                <button onClick={() => { setIsMirrored(!isMirrored); tg?.HapticFeedback?.impactOccurred('light'); }} className={`glass px-3 py-2 rounded-full text-[10px] font-black border border-white/10 ${isMirrored ? 'bg-white text-black' : 'text-white/40'}`}>🪞</button>
                <button onClick={() => setActiveActionSheet('RECHARGE')} className="glass px-3 py-2 rounded-full text-[10px] font-black border border-white/10">⚡️ {credits}</button>
                <button onClick={() => setActiveActionSheet('SUPPORT')} className="glass w-9 h-9 rounded-full flex items-center justify-center border border-white/10 text-lg">💎</button>
             </div>
          </div>
          <div className="flex-grow w-full relative overflow-hidden bg-zinc-950 flex items-center justify-center">
             <video ref={videoRef} autoPlay playsInline muted className={`absolute transition-all duration-300 object-cover ${isMirrored ? 'scale-x-[-1]' : 'scale-x-[1]'}`} style={{ width: '100%', height: '100%', aspectRatio: aspectRatio === '9:16' ? '9/16' : '16/9' }} />
          </div>
          <div className="fixed inset-x-0 bottom-12 flex justify-center items-center gap-8 z-[60]">
            <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} className="w-14 h-14 rounded-full glass flex items-center justify-center text-2xl border border-white/10 active:scale-90 transition-transform">🔄</button>
            <button onClick={capture} disabled={!isCameraReady} className="w-24 h-24 rounded-full border-[6px] border-white/20 p-1.5 active:scale-95 transition-all"><div className="w-full h-full bg-white rounded-full shadow-2xl"/></button>
            <button onClick={() => setMode('GALLERY')} className="w-14 h-14 rounded-2xl glass overflow-hidden border border-white/10 active:scale-90 transition-transform flex items-center justify-center">{history[0] ? <img src={history[0].processed} className="w-full h-full object-cover" /> : <span className="text-xl">🎞️</span>}</button>
          </div>
        </div>
      )}

      {mode === 'PREVIEW' && displayImage && (
        <div className="h-full flex flex-col bg-black relative">
          <div className="flex-grow flex items-center justify-center p-4 pt-16 relative overflow-hidden touch-none" onPointerDown={() => setShowOriginal(true)} onPointerUp={() => setShowOriginal(false)} onPointerLeave={() => setShowOriginal(false)}>
            <img src={showOriginal ? originalPhoto! : displayImage} className={`rounded-3xl shadow-2xl transition-all duration-200 object-cover ${aspectRatio === '9:16' ? 'h-full w-auto aspect-[9/16]' : 'w-full h-auto aspect-[16/9]'}`} alt="Preview" />
            {showOriginal && <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20 z-10">{t.original}</div>}
            {isProcessing && <div className="absolute inset-0 bg-black/40 backdrop-blur-md flex flex-col items-center justify-center z-50"><div className="w-12 h-12 border-4 border-t-blue-500 border-white/10 rounded-full animate-spin mb-6" /><div className="text-[10px] font-black uppercase tracking-widest animate-pulse">{t.drawing}</div></div>}
          </div>
          <div className="bg-zinc-900/90 backdrop-blur-2xl rounded-t-[3rem] p-6 pb-20 border-t border-white/10" style={{ backgroundColor: tg?.themeParams?.secondary_bg_color || '#18181b' }}>
            <div className="flex gap-5 mb-6 overflow-x-auto no-scrollbar px-2">
              {t.categories.map(cat => (
                <button key={cat} onClick={() => { setActiveCategory(cat); tg?.HapticFeedback?.impactOccurred('light'); }} className={`text-[10px] font-black uppercase tracking-widest transition-all relative pb-2 min-w-max ${activeCategory === cat ? 'text-white' : 'text-white/30'}`}>{cat} {activeCategory === cat && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />}</button>
              ))}
            </div>
            <div className="min-h-[100px] mb-4">
              {activeCategory === t.categories[t.categories.length-1] ? (
                <div className="relative animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} placeholder={t.custom_placeholder} rows={3} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-blue-500 pr-14 resize-none leading-relaxed block" />
                  <button onClick={() => runAI(customPrompt, t.custom_style)} disabled={!customPrompt.trim() || isProcessing} className="absolute right-3 bottom-3 w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-lg active:scale-90 transition-all disabled:opacity-50 shadow-lg">🪄</button>
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto no-scrollbar py-2">
                  {PRESETS.filter(p => p.category === UI_STRINGS.en.categories[t.categories.indexOf(activeCategory)]).map(p => (
                    <button key={p.id} onClick={() => runAI(p.prompt, p.name[lang])} className="glass px-5 py-4 rounded-2xl min-w-max flex flex-col items-center gap-2 border border-white/5 active:bg-blue-500/20 transition-all">
                      <span className="text-2xl">{p.icon}</span><span className="text-[9px] font-black uppercase tracking-wider">{p.name[lang]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {mode === 'GALLERY' && (
        <div className="h-full p-8 pt-16 bg-black overflow-y-auto no-scrollbar" style={{ backgroundColor: tg?.themeParams?.bg_color || '#000000' }}>
          <div className="flex justify-between items-center mb-10"><h2 className="text-5xl font-black italic tracking-tighter">{t.archive}</h2><button onClick={() => setMode('CAMERA')} className="w-10 h-10 rounded-full glass flex items-center justify-center">✕</button></div>
          {history.length === 0 ? <div className="py-20 text-center opacity-20 uppercase text-[9px] font-black tracking-[0.5em]">{t.empty_history}</div> : (
            <div className="grid grid-cols-2 gap-4 pb-32">
              {history.map(item => (
                <div key={item.id} onClick={() => { setDisplayImage(item.processed); setOriginalPhoto(item.original); setAspectRatio(item.ratio); setMode('PREVIEW'); }} className={`rounded-[2rem] overflow-hidden border border-white/5 active:scale-95 transition-all bg-zinc-900 relative ${item.ratio === '9:16' ? 'aspect-[9/16]' : 'aspect-[16/9] col-span-2'}`}>
                  <img src={item.processed} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-md px-2 py-1 rounded-lg text-[8px] font-bold uppercase">{item.presetName}</div>
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

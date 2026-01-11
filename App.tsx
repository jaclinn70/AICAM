
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AppMode, HistoryItem } from './types';
import { PRESETS } from './constants';
import { processImage } from './services/geminiService';

declare global {
  interface Window {
    Telegram: any;
  }
}

/**
 * Оптимизированное сжатие. 
 * Для Telegram WebApp критически важно держать размер строки минимальным.
 */
const compressForAI = async (base64: string, quality: number = 0.6): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!base64 || !base64.startsWith('data:image')) {
      return reject("Invalid base64");
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 700; // Уменьшаем еще немного для стабильности
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject("Canvas failure");
      
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'medium';
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality)); 
    };
    img.onerror = () => reject("Image load failed");
    img.src = base64;
  });
};

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('CAMERA');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  
  // Храним изображения
  const [originalPhoto, setOriginalPhoto] = useState<string | null>(null);
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [displayImage, setDisplayImage] = useState<string | null>(null);
  
  const [activeCategory, setActiveCategory] = useState<string>('Улучшения');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [shutterActive, setShutterActive] = useState(false);
  const [loadingText, setLoadingText] = useState('Магия...');
  
  // ИСТОРИЯ: Теперь только в памяти и максимум 5 штук!
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [credits, setCredits] = useState<number>(() => {
    const saved = localStorage.getItem('ai_camera_credits');
    return saved ? parseInt(saved) : 10;
  });
  const [showStore, setShowStore] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tg = window.Telegram?.WebApp;

  useEffect(() => {
    localStorage.setItem('ai_camera_credits', credits.toString());
  }, [credits]);

  useEffect(() => {
    if (isProcessing) {
      const texts = ["Синтезируем...", "Добавляем стиль...", "Рисуем...", "Финальный штрих..."];
      let i = 0;
      const interval = setInterval(() => {
        setLoadingText(texts[i % texts.length]);
        i++;
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isProcessing]);

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      tg.headerColor = '#000000';
      tg.backgroundColor = '#000000';
      
      const handleBack = () => {
        if (showStore) {
          setShowStore(false);
        } else if (mode !== 'CAMERA') {
          setMode('CAMERA');
          setOriginalPhoto(null);
          setBaseImage(null);
          setDisplayImage(null);
          setCustomPrompt('');
        }
      };
      tg.BackButton.onClick(handleBack);
      return () => tg.BackButton.offClick(handleBack);
    }
  }, [tg, mode, showStore]);

  useEffect(() => {
    if (tg) {
      if (mode !== 'CAMERA' || showStore) tg.BackButton.show();
      else tg.BackButton.hide();
    }
  }, [mode, tg, showStore]);

  const startCamera = useCallback(async () => {
    if (mode !== 'CAMERA') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error("Camera error:", err);
    }
  }, [facingMode, mode]);

  useEffect(() => {
    startCamera();
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, [startCamera]);

  const captureFrame = () => {
    if (credits <= 0) { setShowStore(true); return; }
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.videoWidth === 0) return;

      setShutterActive(true);
      setTimeout(() => setShutterActive(false), 80);
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (facingMode === 'user') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Первый снимок делаем в нормальном качестве
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setOriginalPhoto(dataUrl);
        setBaseImage(dataUrl);
        setDisplayImage(dataUrl);
        setMode('PREVIEW');
        tg?.HapticFeedback.impactOccurred('medium');
      }
    }
  }

  const handleProcess = async (prompt: string, presetName: string = 'Свой стиль') => {
    if (isProcessing || !displayImage) return;
    if (credits <= 0) { setShowStore(true); return; }

    setIsProcessing(true);
    tg?.HapticFeedback.impactOccurred('light');
    
    try {
      // Сжимаем перед отправкой еще сильнее
      const optimizedSource = await compressForAI(displayImage, 0.5);
      const result = await processImage(optimizedSource, prompt);
      
      // Жесткая проверка: строка должна быть длинной и начинаться с data:image
      if (result && result.startsWith('data:image') && result.length > 1000) { 
        setDisplayImage(result);
        setCredits(prev => Math.max(0, prev - 1));
        
        const newItem: HistoryItem = {
          id: Date.now().toString(),
          original: optimizedSource,
          processed: result,
          presetName: presetName,
          timestamp: Date.now()
        };
        // Храним только 5 последних в памяти!
        setHistory(prev => [newItem, ...prev].slice(0, 5));
        tg?.HapticFeedback.notificationOccurred('success');
      } else {
        throw new Error("Invalid API response");
      }
    } catch (err) {
      console.error(err);
      tg?.showPopup({ title: 'Ошибка', message: 'Не удалось обработать. Попробуй еще раз или смени промпт.' });
      tg?.HapticFeedback.notificationOccurred('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const fixResult = () => {
    if (displayImage) {
      setBaseImage(displayImage);
      tg?.HapticFeedback.impactOccurred('medium');
      tg?.showAlert('Закреплено! Теперь эффекты будут накладываться поверх этого результата.');
    }
  };

  const resetToOriginal = () => {
    if (!originalPhoto) return;
    setBaseImage(originalPhoto);
    setDisplayImage(originalPhoto);
    setCustomPrompt('');
    tg?.HapticFeedback.impactOccurred('light');
  };

  const downloadImage = () => {
    if (!displayImage) return;
    const link = document.createElement('a');
    link.href = displayImage;
    link.download = `aicam-${Date.now()}.jpg`;
    link.click();
    tg?.HapticFeedback.notificationOccurred('success');
  };

  return (
    <div className="fixed inset-0 bg-black text-white font-['Inter'] select-none overflow-hidden">
      
      <div className={`fixed inset-0 z-[100] bg-white transition-opacity duration-150 pointer-events-none ${shutterActive ? 'opacity-100' : 'opacity-0'}`} />

      <div className="fixed top-0 left-0 right-0 z-[60] px-6 pt-10 pb-10 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
        <h1 className="text-xl font-black italic tracking-tighter">AI.CAM</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => setMode('GALLERY')} className="w-10 h-10 rounded-full glass flex items-center justify-center text-lg active:scale-90 transition-transform">🖼️</button>
          <button onClick={() => setShowStore(true)} className="glass flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 active:scale-90 transition-transform">
            <span className="text-yellow-400 font-bold">⚡️</span>
            <span className="text-sm font-bold">{credits}</span>
          </button>
        </div>
      </div>

      <div className="relative h-full w-full">
        
        {/* CAMERA */}
        <div className={`absolute inset-0 z-10 transition-opacity duration-300 ${mode === 'CAMERA' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <video ref={videoRef} autoPlay playsInline muted className={`h-full w-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} />
          <div className="absolute inset-x-0 bottom-12 flex flex-col items-center gap-6">
            <div className="flex items-center justify-center gap-10">
               <button onClick={() => { setFacingMode(f => f === 'user' ? 'environment' : 'user'); tg?.HapticFeedback.impactOccurred('light'); }} className="w-12 h-12 rounded-full glass flex items-center justify-center text-xl">🔄</button>
               <button onClick={captureFrame} className="w-20 h-20 rounded-full border-4 border-white/30 p-1 active:scale-95 transition-transform">
                  <div className="w-full h-full rounded-full bg-white shadow-lg" />
               </button>
               <button onClick={() => setMode('GALLERY')} className="w-12 h-12 rounded-xl glass overflow-hidden flex items-center justify-center">
                  {history.length > 0 ? <img src={history[0].processed} className="w-full h-full object-cover opacity-60" /> : <div className="text-white/20 text-xs">🎞️</div>}
               </button>
            </div>
          </div>
        </div>

        {/* PREVIEW & EDITOR */}
        <div className={`absolute inset-0 z-20 bg-zinc-950 transition-all duration-500 ease-out flex flex-col ${mode === 'PREVIEW' ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
          <div className="flex-grow flex items-center justify-center p-4 pt-24 pb-4 overflow-hidden relative">
            {displayImage ? (
              <img 
                key={displayImage.slice(-10)} 
                src={displayImage} 
                className="max-h-full max-w-full rounded-2xl shadow-2xl object-contain bg-black" 
              />
            ) : (
              <div className="w-12 h-12 border-2 border-white/10 rounded-full animate-pulse" />
            )}
            
            {isProcessing && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center z-50">
                <div className="w-10 h-10 border-4 border-white/10 border-t-white rounded-full animate-spin mb-6" />
                <p className="text-[10px] uppercase font-black tracking-widest animate-pulse">{loadingText}</p>
              </div>
            )}
          </div>

          <div className="bg-zinc-900 rounded-t-[2.5rem] p-6 pb-12 shadow-[0_-20px_60px_rgba(0,0,0,0.6)] border-t border-white/5">
            <div className="flex flex-col gap-5">
              
              <div className="flex justify-between items-center px-1">
                <div className="flex gap-4">
                  <button onClick={fixResult} className={`text-[10px] font-black uppercase tracking-widest transition-all ${displayImage !== baseImage ? 'text-green-400' : 'text-white/20'}`}>
                    ✅ Оставить
                  </button>
                  <button onClick={resetToOriginal} className={`text-[10px] font-black uppercase tracking-widest transition-all ${displayImage !== originalPhoto ? 'text-red-500' : 'text-white/20'}`}>
                    🔄 Сброс
                  </button>
                </div>
                <button onClick={downloadImage} className="text-[10px] font-black uppercase tracking-widest text-blue-400 active:scale-90 transition-transform">
                  💾 Скачать
                </button>
              </div>

              <div className="relative">
                <textarea 
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Добавь детали к фото..."
                  className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl p-4 pr-16 text-sm focus:border-white/30 focus:outline-none transition-all resize-none placeholder:text-white/20"
                />
                <button 
                  onClick={() => handleProcess(customPrompt)}
                  disabled={!customPrompt.trim() || isProcessing}
                  className="absolute right-3 bottom-2 w-12 h-12 bg-white text-black rounded-2xl flex items-center justify-center disabled:opacity-20 active:scale-90 transition-all shadow-xl"
                >
                  🚀
                </button>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex gap-5 overflow-x-auto no-scrollbar">
                  {['Улучшения', 'Цвет и Тон', 'Арт-стили'].map(cat => (
                    <button key={cat} onClick={() => setActiveCategory(cat)} className={`text-[9px] uppercase font-black tracking-[0.2em] transition-all whitespace-nowrap ${activeCategory === cat ? 'text-white' : 'text-white/20'}`}>{cat}</button>
                  ))}
                </div>
                
                <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                  {PRESETS.filter(p => p.category === activeCategory).map(p => (
                    <button 
                      key={p.id} 
                      onClick={() => handleProcess(p.prompt, p.name)}
                      disabled={isProcessing}
                      className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/5 rounded-xl min-w-max active:bg-white/10 transition-colors"
                    >
                      <span className="text-base">{p.icon}</span>
                      <span className="text-[10px] font-bold uppercase tracking-tight">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={() => { setMode('CAMERA'); setDisplayImage(null); }} 
                className="w-full py-4 mt-1 bg-zinc-800/30 text-white/20 rounded-2xl font-black text-[9px] uppercase tracking-[0.4em] active:bg-zinc-800 active:text-white transition-all"
              >
                Закрыть редактор
              </button>
            </div>
          </div>
        </div>

        {/* GALLERY (Session only) */}
        <div className={`absolute inset-0 z-30 bg-black transition-all duration-300 ${mode === 'GALLERY' ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full pointer-events-none'}`}>
          <div className="p-8 pt-28 h-full flex flex-col">
            <h2 className="text-3xl font-black italic tracking-tighter mb-8">СЕССИЯ</h2>
            <p className="text-[9px] text-white/30 uppercase tracking-widest mb-6">История очищается при выходе</p>
            {history.length === 0 ? (
              <div className="flex-grow flex flex-col items-center justify-center text-white/10 uppercase font-black text-[10px] tracking-[0.5em]">Пусто</div>
            ) : (
              <div className="grid grid-cols-2 gap-4 overflow-y-auto no-scrollbar pb-24">
                {history.map(item => (
                  <div key={item.id} className="aspect-[4/5] rounded-2xl overflow-hidden border border-white/5 active:scale-95 transition-transform" onClick={() => { 
                    setOriginalPhoto(item.original); 
                    setBaseImage(item.processed); 
                    setDisplayImage(item.processed); 
                    setMode('PREVIEW'); 
                  }}>
                    <img src={item.processed} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* STORE */}
      {showStore && (
        <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-xl p-10 flex flex-col pt-24">
           <div className="flex justify-between items-center mb-12">
              <h2 className="text-3xl font-black italic tracking-tighter">ЭНЕРГИЯ</h2>
              <button onClick={() => setShowStore(false)} className="w-10 h-10 glass rounded-full flex items-center justify-center">✕</button>
           </div>
           <div className="flex flex-col gap-4">
              {[ { n: 10, p: 50, i: '🔋' }, { n: 50, p: 190, i: '🔥' } ].map(pkg => (
                <button key={pkg.n} className="glass p-6 rounded-3xl border border-white/5 flex justify-between items-center active:bg-white/5 transition-colors">
                   <div className="flex items-center gap-4">
                     <span className="text-2xl">{pkg.i}</span>
                     <span className="text-xl font-black italic">{pkg.n} ⚡️</span>
                   </div>
                   <span className="bg-white text-black px-4 py-2 rounded-xl text-[10px] font-black">{pkg.p} STARS</span>
                </button>
              ))}
              <p className="text-[10px] text-white/30 text-center mt-6">Приложение находится в режиме Beta</p>
           </div>
        </div>
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .animate-pulse { animation: pulse 1.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default App;


import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AppMode, HistoryItem } from './types';
import { PRESETS } from './constants';
import { processImage } from './geminiService';

declare global {
  interface Window {
    Telegram: any;
  }
}

const compressImage = async (base64: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 800; 
      let w = img.width;
      let h = img.height;
      if (w > h) { if (w > MAX_SIZE) { h *= MAX_SIZE / w; w = MAX_SIZE; } }
      else { if (h > MAX_SIZE) { w *= MAX_SIZE / h; h = MAX_SIZE; } }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject();
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = base64;
  });
};

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('CAMERA');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [originalPhoto, setOriginalPhoto] = useState<string | null>(null);
  const [displayImage, setDisplayImage] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [shutterActive, setShutterActive] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('Улучшения');
  const [credits, setCredits] = useState(10);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tg = window.Telegram?.WebApp;

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      tg.headerColor = '#000000';
      tg.backgroundColor = '#000000';
      
      const handleBack = () => {
        if (mode !== 'CAMERA') {
          setMode('CAMERA');
          setDisplayImage(null);
          setOriginalPhoto(null);
        }
      };
      
      tg.BackButton.onClick(handleBack);
      if (mode !== 'CAMERA') tg.BackButton.show(); else tg.BackButton.hide();
      return () => tg.BackButton.offClick(handleBack);
    }
  }, [tg, mode]);

  const startCamera = useCallback(async () => {
    if (mode !== 'CAMERA') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (e) { 
      tg?.showAlert("Ошибка камеры. Проверьте разрешения в настройках.");
    }
  }, [facingMode, mode, tg]);

  useEffect(() => { startCamera(); }, [startCamera]);

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const v = videoRef.current;
      const c = canvasRef.current;
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const ctx = c.getContext('2d');
      if (ctx) {
        setShutterActive(true);
        setTimeout(() => setShutterActive(false), 100);
        if (facingMode === 'user') { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
        ctx.drawImage(v, 0, 0);
        const url = c.toDataURL('image/jpeg', 0.9);
        setOriginalPhoto(url);
        setDisplayImage(url);
        setMode('PREVIEW');
        tg?.HapticFeedback.impactOccurred('heavy');
      }
    }
  };

  const runAI = async (prompt: string, name: string) => {
    if (isProcessing || !originalPhoto) return;
    setIsProcessing(true);
    tg?.HapticFeedback.impactOccurred('medium');

    try {
      const small = await compressImage(originalPhoto);
      const res = await processImage(small, prompt);
      
      if (res) {
        setDisplayImage(res);
        setCredits(c => Math.max(0, c - 1));
        setHistory(h => [{ 
          id: Date.now().toString(), 
          original: originalPhoto, 
          processed: res, 
          presetName: name, 
          timestamp: Date.now() 
        }, ...h].slice(0, 10));
        tg?.HapticFeedback.notificationOccurred('success');
      } else {
        tg?.showAlert("Не удалось обработать. Попробуйте другой фильтр.");
      }
    } catch (e) { 
      tg?.showAlert("Ошибка связи с ИИ. Проверьте интернет.");
    } finally {
      setIsProcessing(false);
    }
  };

  const sharePhoto = () => {
    if (!displayImage) return;
    tg?.showPopup({
      title: 'Поделиться',
      message: 'Вы можете сохранить изображение или отправить его в чат.',
      buttons: [
        { id: 'save', type: 'default', text: 'Скачать' },
        { id: 'cancel', type: 'destructive', text: 'Отмена' }
      ]
    }, (id: string) => {
      if (id === 'save') {
        const a = document.createElement('a');
        a.href = displayImage;
        a.download = 'ai_photo.png';
        a.click();
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black text-white font-['Inter'] select-none overflow-hidden">
      <div className={`fixed inset-0 z-[100] bg-white transition-opacity duration-150 pointer-events-none ${shutterActive ? 'opacity-100' : 'opacity-0'}`} />
      
      {mode === 'CAMERA' && (
        <div className="h-full relative flex flex-col">
          <div className="absolute top-12 left-6 right-6 flex justify-between items-center z-50">
             <div className="font-black italic text-2xl tracking-tighter drop-shadow-2xl">AI<span className="text-blue-500">.</span>CAM</div>
             <div className="glass px-4 py-2 rounded-full text-xs font-bold border border-white/10 shadow-xl">⚡️ {credits}</div>
          </div>
          
          <video ref={videoRef} autoPlay playsInline muted className={`flex-grow w-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} />

          <div className="absolute inset-x-0 bottom-12 flex justify-center items-center gap-10 z-50">
            <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} className="w-14 h-14 rounded-full glass flex items-center justify-center text-2xl border border-white/10 active:scale-90 transition-transform">🔄</button>
            <button onClick={capture} className="w-24 h-24 rounded-full border-[6px] border-white/20 p-1.5 active:scale-95 transition-transform"><div className="w-full h-full bg-white rounded-full shadow-2xl"/></button>
            <button onClick={() => setMode('GALLERY')} className="w-14 h-14 rounded-2xl glass overflow-hidden border border-white/10 active:scale-90 transition-transform flex items-center justify-center">
              {history[0] ? <img src={history[0].processed} className="w-full h-full object-cover" /> : <span className="text-xl">🖼️</span>}
            </button>
          </div>
        </div>
      )}

      {mode === 'PREVIEW' && displayImage && (
        <div className="h-full flex flex-col bg-black">
          <div 
            className="flex-grow flex items-center justify-center p-4 pt-16 relative overflow-hidden touch-none"
            onPointerDown={() => setShowOriginal(true)}
            onPointerUp={() => setShowOriginal(false)}
            onPointerLeave={() => setShowOriginal(false)}
          >
            <img 
              src={showOriginal ? originalPhoto! : displayImage} 
              className="max-h-full max-w-full rounded-3xl shadow-2xl object-contain transition-all duration-200" 
              alt="Preview"
            />
            
            {showOriginal && (
              <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20">Оригинал</div>
            )}

            {isProcessing && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-md flex flex-col items-center justify-center z-50">
                <div className="w-12 h-12 border-4 border-t-blue-500 border-white/10 rounded-full animate-spin mb-6" />
                <div className="text-[11px] uppercase font-black tracking-[0.3em] animate-pulse">Нейросеть думает...</div>
              </div>
            )}
          </div>

          <div className="bg-zinc-900/80 backdrop-blur-2xl rounded-t-[3rem] p-6 pb-12 border-t border-white/10">
            <div className="flex gap-6 mb-6 overflow-x-auto no-scrollbar justify-start px-2">
              {['Улучшения', 'Цвет и Тон', 'Арт-стили'].map(cat => (
                <button 
                  key={cat} 
                  onClick={() => setActiveCategory(cat)} 
                  className={`text-[10px] font-black uppercase tracking-[0.15em] transition-all relative pb-2 ${activeCategory === cat ? 'text-white' : 'text-white/30'}`}
                >
                  {cat}
                  {activeCategory === cat && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />}
                </button>
              ))}
            </div>

            <div className="flex gap-3 overflow-x-auto no-scrollbar mb-8 py-2">
              {PRESETS.filter(p => p.category === activeCategory).map(p => (
                <button 
                  key={p.id} 
                  onClick={() => runAI(p.prompt, p.name)} 
                  className="glass px-5 py-4 rounded-2xl min-w-max flex flex-col items-center gap-2 border border-white/5 active:bg-blue-500/20 active:border-blue-500/40 transition-all shadow-lg"
                >
                  <span className="text-2xl">{p.icon}</span> 
                  <span className="text-[9px] font-black uppercase tracking-wider">{p.name}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => { setMode('CAMERA'); setDisplayImage(null); }} 
                className="flex-grow py-5 bg-white/5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] active:bg-white/10 border border-white/5"
              >
                Отмена
              </button>
              <button 
                onClick={sharePhoto} 
                className="flex-grow py-5 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] active:opacity-80 shadow-[0_10px_30px_rgba(255,255,255,0.1)]"
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === 'GALLERY' && (
        <div className="h-full p-8 pt-24 bg-black overflow-y-auto no-scrollbar">
          <div className="flex justify-between items-center mb-12">
            <h2 className="text-5xl font-black italic tracking-tighter">АРХИВ</h2>
            <button onClick={() => setMode('CAMERA')} className="w-10 h-10 rounded-full glass flex items-center justify-center">✕</button>
          </div>
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-40 opacity-20">
              <span className="text-6xl mb-4">🎞️</span>
              <div className="uppercase text-[10px] font-black tracking-[0.5em]">Нет снимков</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-5 pb-32">
              {history.map(item => (
                <div key={item.id} onClick={() => { setDisplayImage(item.processed); setOriginalPhoto(item.original); setMode('PREVIEW'); }} className="group relative aspect-[3/4] rounded-3xl overflow-hidden border border-white/5 active:scale-95 transition-all shadow-2xl bg-zinc-900">
                  <img src={item.processed} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-[8px] font-bold uppercase border border-white/10">{item.presetName}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.98); } }
        .animate-pulse { animation: pulse 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default App;

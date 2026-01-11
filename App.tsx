
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AppMode, Preset } from './types';
import { PRESETS } from './constants';
import { processImage } from './services/geminiService';

declare global {
  interface Window {
    Telegram: any;
  }
}

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('CAMERA');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('Улучшения');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Состояние экономики приложения
  const [credits, setCredits] = useState<number>(() => {
    const saved = localStorage.getItem('ai_camera_credits');
    return saved ? parseInt(saved) : 5;
  });
  const [lastBonus, setLastBonus] = useState<number>(() => {
    const saved = localStorage.getItem('ai_camera_last_bonus');
    return saved ? parseInt(saved) : 0;
  });
  const [showStore, setShowStore] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const tg = window.Telegram?.WebApp;
  const isVip = credits >= 100;

  useEffect(() => {
    localStorage.setItem('ai_camera_credits', credits.toString());
    localStorage.setItem('ai_camera_last_bonus', lastBonus.toString());
  }, [credits, lastBonus]);

  // Управление нативным интерфейсом Telegram
  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      tg.enableClosingConfirmation();
      
      tg.BackButton.onClick(() => {
        if (showStore) {
            setShowStore(false);
            tg.HapticFeedback.impactOccurred('light');
        }
        else if (mode !== 'CAMERA') resetCamera();
      });

      tg.MainButton.setParams({
        text: 'ОТПРАВИТЬ В ЧАТ',
        color: isVip ? '#FACC15' : '#24A1DE',
        text_color: isVip ? '#000000' : '#ffffff'
      });
      
      tg.MainButton.onClick(() => sendToChat());
    }
  }, [tg, mode, showStore, isVip]);

  useEffect(() => {
    if (tg) {
      if (mode !== 'CAMERA' || showStore) tg.BackButton.show();
      else tg.BackButton.hide();

      if ((mode === 'PREVIEW' || mode === 'EDITING') && (processedImage || capturedImage) && !showStore) {
        tg.MainButton.show();
      } else {
        tg.MainButton.hide();
      }
    }
  }, [mode, processedImage, capturedImage, tg, showStore]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setError("Доступ к камере ограничен");
    }
  }, []);

  useEffect(() => {
    if (mode === 'CAMERA') startCamera();
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, [mode, startCamera]);

  const claimDailyBonus = () => {
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    if (now - lastBonus > dayInMs) {
      setCredits(prev => prev + 3);
      setLastBonus(now);
      tg?.HapticFeedback.notificationOccurred('success');
      tg?.showPopup({ title: 'Бонус!', message: '+3 нейро-заряда получено' });
    } else {
      tg?.HapticFeedback.notificationOccurred('error');
      const hoursLeft = Math.ceil((dayInMs - (now - lastBonus)) / (1000 * 60 * 60));
      tg?.showPopup({ title: 'Рано!', message: `Вернитесь через ${hoursLeft} ч.` });
    }
  };

  const captureFrame = () => {
    if (credits <= 0) {
      setShowStore(true);
      tg?.HapticFeedback.notificationOccurred('warning');
      return;
    }

    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        setCapturedImage(dataUrl);
        setProcessedImage(null);
        setPromptHistory([]);
        tg?.HapticFeedback.impactOccurred('heavy');
        handleApplyPreset(PRESETS.find(p => p.id === 'masterpiece')!, dataUrl);
      }
    }
  };

  const handleApplyPreset = async (preset: Preset, sourceImage: string | null = null) => {
    if (credits <= 0) {
        setShowStore(true);
        return;
    }
    const imgToProcess = sourceImage || processedImage || capturedImage;
    if (!imgToProcess) return;

    setIsProcessing(true);
    setMode('LOADING');
    tg?.MainButton.showProgress();
    
    const result = await processImage(imgToProcess, preset.prompt);
    
    if (result) {
      setProcessedImage(result);
      setPromptHistory(prev => [...prev, preset.name]);
      setCredits(prev => prev - 1);
      setMode('PREVIEW');
      tg?.HapticFeedback.notificationOccurred('success');
    } else {
      setError("AI Ошибка");
      setMode('PREVIEW');
      tg?.HapticFeedback.notificationOccurred('error');
    }
    setIsProcessing(false);
    tg?.MainButton.hideProgress();
  };

  const handleCustomRequest = async () => {
    if (credits <= 0) { setShowStore(true); return; }
    if (!customPrompt.trim()) return;
    const imgToProcess = processedImage || capturedImage;
    if (!imgToProcess) return;

    setIsProcessing(true);
    setMode('LOADING');
    tg?.MainButton.showProgress();
    
    const result = await processImage(imgToProcess, customPrompt);
    
    if (result) {
      setProcessedImage(result);
      setPromptHistory(prev => [...prev, customPrompt.substring(0, 15) + '...']);
      setCredits(prev => prev - 1);
      setMode('PREVIEW');
      tg?.HapticFeedback.notificationOccurred('success');
    } else {
      setError("AI не справился");
      setMode('PREVIEW');
    }
    setIsProcessing(false);
    tg?.MainButton.hideProgress();
  };

  const handlePurchase = (amount: number, stars: number) => {
    tg?.HapticFeedback.impactOccurred('medium');
    
    // В реальном TMA: tg.openInvoice(url, callback)
    // Здесь имитируем подтверждение платежа Telegram Stars
    tg?.showConfirm(`Купить ${amount} нейро-зарядов за ${stars} ⭐️?`, (ok: boolean) => {
      if (ok) {
        setCredits(prev => prev + amount);
        setShowStore(false);
        tg.HapticFeedback.notificationOccurred('success');
        tg.showPopup({ title: 'Оплата прошла', message: `Ваш баланс: ${credits + amount} зарядов` });
      }
    });
  };

  const resetCamera = () => {
    setCapturedImage(null);
    setProcessedImage(null);
    setCustomPrompt('');
    setPromptHistory([]);
    setMode('CAMERA');
    setError(null);
    tg?.HapticFeedback.impactOccurred('light');
  };

  const sendToChat = () => {
    tg?.HapticFeedback.impactOccurred('medium');
    tg?.showPopup({
        title: 'Шедевр готов!',
        message: 'Фотография сохранена в галерею вашего устройства.',
        buttons: [{ type: 'ok', text: 'Круто' }]
    });
  };

  return (
    <div className={`relative h-screen w-screen bg-black overflow-hidden select-none text-white ${isVip ? 'border-4 border-yellow-500/20' : ''}`}>
      
      {/* HUD: Баланс и Статус */}
      <div className="absolute top-0 left-0 right-0 z-[60] p-6 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col pointer-events-auto">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tighter italic">AI.CAM</h1>
            {isVip && <span className="bg-yellow-400 text-black text-[8px] font-bold px-1.5 py-0.5 rounded shadow-lg shadow-yellow-400/20">VIP</span>}
          </div>
          <span className="text-[8px] text-white/30 tracking-[0.5em] uppercase">Nano Banana Engine</span>
        </div>
        
        <div className="flex flex-col gap-2 pointer-events-auto items-end">
          <button 
            onClick={() => { setShowStore(true); tg?.HapticFeedback.impactOccurred('medium'); }}
            className={`glass flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all active:scale-90 ${isVip ? 'border-yellow-400/30' : 'border-white/10'}`}
          >
            <span className="animate-pulse">⚡️</span>
            <span className="text-sm font-black">{credits}</span>
            <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] ml-1">+</div>
          </button>
          <button 
            onClick={claimDailyBonus}
            className="text-[8px] uppercase tracking-widest text-white/40 hover:text-white transition-colors"
          >
            Ежедневный бонус
          </button>
        </div>
      </div>

      {/* Камера */}
      <div className={`absolute inset-0 transition-all duration-700 ${mode === 'CAMERA' ? 'opacity-100 scale-100' : 'opacity-0 scale-110 pointer-events-none'}`}>
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />
        
        <div className="absolute inset-x-0 bottom-20 flex flex-col items-center pointer-events-auto">
             <button onClick={captureFrame} className="group relative">
               <div className={`absolute -inset-4 rounded-full border border-white/10 transition-all duration-500 group-active:scale-150 group-active:opacity-0`} />
               <div className="absolute -inset-1 rounded-full border-2 border-white/20 group-active:scale-90 transition-all" />
               <div className="w-20 h-20 rounded-full bg-white group-active:scale-95 transition-all shadow-[0_0_40px_rgba(255,255,255,0.4)]" />
             </button>
             <p className="mt-6 text-[10px] text-white/40 tracking-[0.4em] uppercase">Нажмите для магии</p>
        </div>
      </div>

      {/* Лаборатория обработки */}
      {(mode === 'PREVIEW' || mode === 'EDITING' || mode === 'LOADING') && (
        <div className="absolute inset-0 bg-black flex flex-col animate-fade-in">
          <div className="relative flex-grow flex items-center justify-center bg-zinc-900/50 pt-24 overflow-hidden">
            {isProcessing && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center glass">
                <div className="relative">
                    <div className="w-16 h-16 border-2 border-white/5 rounded-full" />
                    <div className="absolute inset-0 border-t-2 border-white rounded-full animate-spin" />
                </div>
                <p className="mt-6 text-[10px] tracking-[0.5em] font-light animate-pulse uppercase text-white/60">Генерация стиля...</p>
              </div>
            )}
            
            <img src={processedImage || capturedImage || ''} className="max-h-full max-w-full object-contain shadow-2xl" alt="Preview" />
            
            <div className="absolute top-28 left-6 right-6 flex flex-wrap gap-2 pointer-events-none">
              {promptHistory.map((h, i) => (
                <div key={i} className="glass px-4 py-2 rounded-xl border border-white/10 text-[9px] uppercase tracking-widest text-white shadow-2xl animate-fade-in">
                   {h}
                </div>
              ))}
            </div>
          </div>

          <div className="glass p-6 pb-12 rounded-t-[3.5rem] border-t border-white/10 flex flex-col gap-6 shadow-[0_-30px_60px_rgba(0,0,0,0.9)]">
            <div className="flex flex-col gap-3">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCustomRequest()}
                  placeholder="Опишите изменение (напр. 'в стиле киберпанк')"
                  className="w-full bg-white/5 border border-white/10 rounded-[1.5rem] py-4.5 pl-7 pr-16 text-sm text-white placeholder:text-white/20 focus:outline-none focus:bg-white/10 transition-all"
                />
                <button
                  onClick={handleCustomRequest}
                  disabled={!customPrompt.trim() || isProcessing}
                  className={`absolute right-2 w-12 h-12 flex items-center justify-center rounded-2xl transition-all ${customPrompt.trim() ? 'bg-white text-black' : 'text-white/5'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex gap-8 overflow-x-auto no-scrollbar border-b border-white/5">
              {['Улучшения', 'Цвет и Тон', 'Арт-стили'].map(cat => (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); tg?.HapticFeedback.impactOccurred('light'); }}
                  className={`text-[10px] uppercase tracking-[0.25em] pb-4 transition-all whitespace-nowrap ${activeCategory === cat ? 'text-white font-bold border-b-2 border-white' : 'text-white/20'}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
              {PRESETS.filter(p => p.category === activeCategory).map(preset => (
                <button
                  key={preset.id}
                  onClick={() => handleApplyPreset(preset)}
                  disabled={isProcessing}
                  className="flex flex-col items-center gap-3 min-w-[90px] group"
                >
                  <div className="w-16 h-16 rounded-[1.8rem] glass border border-white/10 flex items-center justify-center text-3xl group-active:scale-90 transition-all shadow-xl">
                    {preset.icon}
                  </div>
                  <span className="text-[9px] uppercase tracking-wider text-white/30 text-center font-medium">
                    {preset.name}
                  </span>
                </button>
              ))}
            </div>

            {!tg?.initData && (
              <div className="flex gap-4">
                 <button onClick={resetCamera} className="w-16 h-16 glass rounded-2xl flex items-center justify-center border border-white/10 text-white/40">✕</button>
                 <button onClick={sendToChat} className="flex-grow bg-white text-black font-black rounded-2xl text-[12px] uppercase tracking-widest shadow-xl">Сохранить</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Магазин Кредитов */}
      {showStore && (
        <div className="absolute inset-0 z-[100] bg-zinc-950/95 backdrop-blur-3xl flex flex-col p-10 animate-fade-in overflow-y-auto">
           <div className="flex justify-between items-center mb-14">
              <div className="flex flex-col">
                <h2 className="text-4xl font-black italic tracking-tighter">REFILL</h2>
                <span className="text-yellow-400 text-[10px] font-bold tracking-[0.5em] uppercase">Нейро-Заряды</span>
              </div>
              <button onClick={() => setShowStore(false)} className="w-12 h-12 glass rounded-full flex items-center justify-center text-white/40 border border-white/10">✕</button>
           </div>

           <div className="flex flex-col gap-6 mb-12">
              {[
                { amount: 10, stars: 50, label: 'Новичок', icon: '✨', color: 'bg-blue-500' },
                { amount: 50, stars: 190, label: 'Творец', icon: '🚀', hot: true, color: 'bg-yellow-400' },
                { amount: 200, stars: 500, label: 'Легенда', icon: '👑', color: 'bg-purple-600' }
              ].map((pkg, idx) => (
                <button 
                  key={idx}
                  onClick={() => handlePurchase(pkg.amount, pkg.stars)}
                  className={`relative overflow-hidden glass p-7 rounded-[2.5rem] border transition-all active:scale-95 flex justify-between items-center ${pkg.hot ? 'border-yellow-400/40 bg-yellow-400/5' : 'border-white/5'}`}
                >
                   {pkg.hot && <span className="absolute top-0 right-0 bg-yellow-400 text-black text-[9px] font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-widest shadow-lg">Популярно</span>}
                   <div className="flex items-center gap-5">
                      <div className={`w-14 h-14 rounded-2xl ${pkg.color} flex items-center justify-center text-3xl shadow-2xl shadow-black/50`}>{pkg.icon}</div>
                      <div className="flex flex-col items-start">
                         <span className="text-2xl font-black">{pkg.amount}</span>
                         <span className="text-[10px] uppercase text-white/30 tracking-[0.2em] font-bold">{pkg.label}</span>
                      </div>
                   </div>
                   <div className="flex items-center gap-2 bg-white/10 px-5 py-2.5 rounded-2xl border border-white/10 shadow-inner">
                      <span className="text-base font-black">{pkg.stars}</span>
                      <span className="text-sm">⭐️</span>
                   </div>
                </button>
              ))}
           </div>

           <div className="mt-auto flex flex-col items-center gap-6 pb-4">
                <div className="glass p-5 rounded-3xl border border-white/5 text-center">
                    <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] leading-relaxed">
                        Приложение использует <span className="text-white font-bold">Gemini 2.5 Nano Banana</span>.<br/>Каждая генерация требует вычислительной мощности.
                    </p>
                </div>
                <button onClick={claimDailyBonus} className="text-[11px] font-bold text-yellow-400 uppercase tracking-widest underline decoration-yellow-400/20 underline-offset-8">
                    Получить +3 заряда бесплатно
                </button>
           </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in { animation: fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
};

export default App;

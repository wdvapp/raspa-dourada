'use client';

import { useRef, useEffect, useState } from 'react';

// 1. ADICIONAMOS 'coverImage' AQUI PARA PARAR O ERRO
interface ScratchCardProps {
  isRevealed: boolean;
  onReveal: () => void;
  coverImage?: string; 
}

export default function ScratchCard({ isRevealed, onReveal, coverImage }: ScratchCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const scratchAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const motionCountRef = useRef(0);
  const hasRevealedRef = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      scratchAudioRef.current = new Audio('/scratch_v2.mp3');
      scratchAudioRef.current.volume = 0.5;
    }
  }, []);

  // 2. ADICIONAMOS coverImage NAS DEPENDÊNCIAS PARA ATUALIZAR QUANDO MUDAR
  useEffect(() => {
    if (!isRevealed) {
      hasRevealedRef.current = false;
      motionCountRef.current = 0;
      initCanvas(); 
    } else {
      clearCanvas();
    }
  }, [isRevealed, coverImage]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // 3. NOVA FUNÇÃO QUE DECIDE: DESENHAR IMAGEM OU DOURADO?
  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Limpa antes de desenhar
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over'; // Garante modo de pintura normal

    // Se tiver imagem válida (Base64 geralmente é grande), desenha ela
    if (coverImage && coverImage.length > 50) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = coverImage;
        
        img.onload = () => {
            // Desenha a imagem ocupando todo o quadrado
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            addTextOverlay(ctx, canvas.width, canvas.height);
        };
        
        // Se der erro ao carregar a imagem, usa o dourado como fallback
        img.onerror = () => drawGoldGradient(ctx, canvas.width, canvas.height);
    } else {
        // Se não tiver imagem, usa o padrão Dourado
        drawGoldGradient(ctx, canvas.width, canvas.height);
    }
  };

  const drawGoldGradient = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, '#BF953F');
    gradient.addColorStop(0.25, '#FCF6BA'); 
    gradient.addColorStop(0.5, '#B38728'); 
    gradient.addColorStop(0.75, '#FBF5B7'); 
    gradient.addColorStop(1, '#AA771C'); 
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // Adiciona brilhos aleatórios
    ctx.fillStyle = '#FFF';
    for(let i=0; i<20; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        ctx.fillRect(x, y, 2, 2);
    }

    addTextOverlay(ctx, w, h);
  };

  const addTextOverlay = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.textAlign = 'center';
    ctx.fillText('RASPE AQUI', (w / 2) + 2, (h / 2) + 2);

    ctx.fillStyle = '#FFF';
    ctx.fillText('RASPE AQUI', w / 2, h / 2);
  };

  const playScratchSound = () => {
    if (scratchAudioRef.current && scratchAudioRef.current.paused) {
        scratchAudioRef.current.play().catch(() => {});
    }
  };

  const checkProgress = () => {
    if (hasRevealedRef.current) return;
    motionCountRef.current += 1;
    if (motionCountRef.current > 100) {
        finishGame();
    }
  };

  const finishGame = () => {
    if (hasRevealedRef.current) return;
    hasRevealedRef.current = true;
    if (scratchAudioRef.current) scratchAudioRef.current.pause();
    clearCanvas();
    setTimeout(() => { onReveal(); }, 50);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing || isRevealed || hasRevealedRef.current) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    if (!clientX || !clientY) return;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.globalCompositeOperation = 'destination-out'; // Modo Borracha
      ctx.beginPath();
      ctx.arc(x, y, 25, 0, Math.PI * 2); 
      ctx.fill();
      playScratchSound();
      checkProgress();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (scratchAudioRef.current) {
        scratchAudioRef.current.pause();
        scratchAudioRef.current.currentTime = 0;
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={320}
      className="absolute inset-0 z-20 cursor-crosshair touch-none rounded-xl"
      onMouseDown={() => setIsDrawing(true)}
      onTouchStart={() => setIsDrawing(true)}
      onMouseMove={handleMouseMove}
      onTouchMove={handleMouseMove}
      onMouseUp={stopDrawing}
      onTouchEnd={stopDrawing}
      onMouseLeave={stopDrawing}
    />
  );
}
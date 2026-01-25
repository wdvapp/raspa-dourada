// @ts-nocheck
'use client';

import React, { useRef, useEffect, useState } from 'react';

interface ScratchCardProps {
  coverImage: string;
  onReveal: () => void;
  isRevealed: boolean;
}

export default function ScratchCard({ coverImage, onReveal, isRevealed }: ScratchCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const scratchAudioRef = useRef<HTMLAudioElement | null>(null);

  // --- CONFIGURAÇÃO DO ÁUDIO ---
  useEffect(() => {
    // Carrega o som
    const audio = new Audio('/scratch_v2.mp3');
    audio.volume = 0.6; 
    audio.loop = true; // IMPORTANTE: Deixa em loop para não acabar no meio da raspada
    scratchAudioRef.current = audio;

    return () => {
      // Limpeza ao sair da tela
      audio.pause();
      audio.src = '';
    };
  }, []);

  // --- CONFIGURAÇÃO DO CANVAS ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;

    const img = new window.Image();
    img.src = coverImage;
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [coverImage]);

  // --- CONTROLE DE SOM INTELIGENTE ---
  const startSound = () => {
    if (scratchAudioRef.current && scratchAudioRef.current.paused && !isRevealed) {
        scratchAudioRef.current.play().catch(() => {});
    }
  };

  const stopSound = () => {
    if (scratchAudioRef.current) {
        scratchAudioRef.current.pause();
        // Não zeramos o currentTime para dar efeito de continuidade
    }
  };

  // Se o jogo acabou, CORTA O SOM NA HORA
  useEffect(() => {
    if (isRevealed && scratchAudioRef.current) {
        scratchAudioRef.current.pause();
        scratchAudioRef.current.currentTime = 0;
    }
  }, [isRevealed]);


  // --- LÓGICA DE RASPAR ---
  const getPosition = (event: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in event) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = (event as MouseEvent).clientX;
      clientY = (event as MouseEvent).clientY;
    }
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const scratch = (event: any) => {
    if (isRevealed) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { x, y } = getPosition(event.nativeEvent || event);

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 25, 0, 2 * Math.PI);
    ctx.fill();

    checkReveal();
  };

  // --- EVENTOS DE INTERAÇÃO ---
  
  const handleStart = (e: any) => {
      setIsDrawing(true);
      startSound(); // Começa som ao tocar
      scratch(e);
  };

  const handleMove = (e: any) => {
      if (!isDrawing) return;
      startSound(); // Garante que o som toca enquanto mexe
      scratch(e);
  };

  const handleEnd = () => {
      setIsDrawing(false);
      stopSound(); // PAUSA IMEDIATAMENTE AO SOLTAR
  };

  const checkReveal = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    let transparentPixels = 0;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] === 0) transparentPixels++;
    }
    const percent = (transparentPixels / (pixels.length / 4)) * 100;
    
    if (percent > 45) {
      stopSound(); // Garante silêncio
      onReveal();
    }
  };

  return (
    <div ref={containerRef} className={`absolute inset-0 w-full h-full transition-opacity duration-700 ${isRevealed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full touch-none cursor-grab active:cursor-grabbing"
        
        // MOUSE (PC)
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        
        // TOUCH (Celular)
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      />
    </div>
  );
}
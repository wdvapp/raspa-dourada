// @ts-nocheck
'use client';

import React, { useRef, useEffect, useState } from 'react';
import Image from 'next/image';

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

  useEffect(() => {
    // Carrega o som de raspar (garanta que scratch.mp3 está na pasta public)
    scratchAudioRef.current = new Audio('/scratch.mp3');
    scratchAudioRef.current.volume = 0.5; // Volume a 50% para não estourar

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configura o tamanho do canvas igual ao container
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;

    // Desenha a capa (Imagem ou Cor Dourada)
    const img = new window.Image();
    img.src = coverImage;
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    // Se a imagem falhar ou demorar, pinta de dourado
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

  }, [coverImage, isRevealed]); // Reinicia se a capa mudar ou o jogo resetar

  // Função que toca o som (com proteção para não travar)
  const playScratchSound = () => {
    if (scratchAudioRef.current) {
        if (scratchAudioRef.current.paused) {
            scratchAudioRef.current.play().catch(() => {});
        }
    }
  };

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

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const scratch = (event: any) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { x, y } = getPosition(event.nativeEvent || event);

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 25, 0, 2 * Math.PI); // Tamanho do "Dedo"
    ctx.fill();

    // Toca o som enquanto raspa
    playScratchSound();

    checkReveal();
  };

  const checkReveal = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Verifica quantos pixels foram apagados
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    let transparentPixels = 0;

    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] === 0) transparentPixels++;
    }

    const percent = (transparentPixels / (pixels.length / 4)) * 100;
    
    // Se raspou mais de 45%, revela tudo
    if (percent > 45) {
      onReveal();
    }
  };

  return (
    <div ref={containerRef} className={`absolute inset-0 w-full h-full transition-opacity duration-700 ${isRevealed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full touch-none cursor-grab active:cursor-grabbing"
        onMouseDown={(e) => { setIsDrawing(true); scratch(e); }}
        onMouseMove={(e) => { if (isDrawing) scratch(e); }}
        onMouseUp={() => setIsDrawing(false)}
        onMouseLeave={() => setIsDrawing(false)}
        onTouchStart={(e) => { setIsDrawing(true); scratch(e); }}
        onTouchMove={(e) => { if (isDrawing) scratch(e); }}
        onTouchEnd={() => setIsDrawing(false)}
      />
    </div>
  );
}
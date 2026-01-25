'use client';

import { useEffect, useRef, useState } from 'react';

interface ScratchCardProps {
  isRevealed: boolean;
  onReveal: () => void;
  coverImage?: string; // Essa é a linha que faltava
}

const ScratchCard = ({ isRevealed, onReveal, coverImage }: ScratchCardProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScratched, setIsScratched] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configura tamanho
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.offsetWidth;
      canvas.height = parent.offsetHeight;
    }

    // Pinta a capa
    if (coverImage) {
        const img = new Image();
        img.src = coverImage;
        img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
    } else {
        // Cor dourada padrão se não tiver imagem
        ctx.fillStyle = '#FFC700'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Função de raspar
    const scratch = (x: number, y: number) => {
      if (isRevealed) return;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, 25, 0, Math.PI * 2);
      ctx.fill();
      
      // Verifica o quanto já raspou (lógica simplificada)
      // Se quiser ser rigoroso, pode contar pixels transparentes aqui
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (e.buttons !== 1) return;
      const rect = canvas.getBoundingClientRect();
      scratch(e.clientX - rect.left, e.clientY - rect.top);
      setIsScratched(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      scratch(touch.clientX - rect.left, touch.clientY - rect.top);
      setIsScratched(true);
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('touchmove', handleTouchMove);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('touchmove', handleTouchMove);
    };
  }, [coverImage]); // Recarrega se a imagem mudar

  // Se o jogo acabou (isRevealed = true), a gente esconde o canvas para mostrar o premio
  if (isRevealed) return null;

  // Se o usuário soltar o mouse depois de raspar um pouco, revela tudo
  const finishScratch = () => {
      if(isScratched) onReveal();
  }

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full z-20 cursor-crosshair touch-none"
      onMouseUp={finishScratch}
      onTouchEnd={finishScratch}
    />
  );
};

export default ScratchCard;
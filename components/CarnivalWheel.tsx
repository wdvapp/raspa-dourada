'use client';

import React from 'react';
import { Theater, Music } from 'lucide-react';

// --- LISTA DE PRÊMIOS (Mantida apenas para a lógica matemática da Home funcionar) ---
// Importante: A ordem desses prêmios deve bater com a ordem da sua imagem (sentido horário)
export const WHEEL_PRIZES = [
  { label: 'Prêmio 1', value: 10, type: 'scratch' },
  { label: 'Prêmio 2', value: 2, type: 'money' },
  { label: 'Prêmio 3', value: 5, type: 'scratch' },
  { label: 'Prêmio 4', value: 0, type: 'loss' },
  { label: 'Prêmio 5', value: 2, type: 'money' },
  { label: 'Prêmio 6', value: 5, type: 'scratch' },
  { label: 'Prêmio 7', value: 10, type: 'scratch' },
  { label: 'Prêmio 8', value: 0, type: 'loss' },
];

interface CarnivalWheelProps {
  isSpinning: boolean;
  rotationAngle: number;
  onSpinClick: () => void;
  hasFreeSpin: boolean;
}

export default function CarnivalWheel({ isSpinning, rotationAngle, onSpinClick, hasFreeSpin }: CarnivalWheelProps) {
  return (
    <div className="relative w-[340px] h-[340px] md:w-[420px] md:h-[420px] mx-auto my-6 group">
      
      {/* 1. Efeito de Fundo (Brilho atrás da imagem) */}
      <div className="absolute inset-[-20px] rounded-full animate-pulse blur-xl z-0"
        style={{ background: 'radial-gradient(circle, #FFD700 0%, transparent 70%)' }}
      ></div>

      {/* 2. Seta Indicadora (Topo) */}
      <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-30 drop-shadow-lg">
        <Theater size={54} fill="#FFD700" stroke="#FFF" strokeWidth={2} />
      </div>

      {/* 3. A IMAGEM DA ROLETA (Girando) */}
      <div
        className="w-full h-full rounded-full relative z-10 shadow-2xl transition-transform duration-[5000ms] cubic-bezier(0.15, 0, 0.15, 1)"
        style={{
          transform: `rotate(${rotationAngle}deg)`,
          // Aqui puxamos a sua imagem da pasta public
          backgroundImage: 'url(/roulette_wheel.png)', 
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center'
        }}
      >
        {/* A div fica vazia pois a imagem de fundo faz todo o trabalho visual */}
      </div>

      {/* 4. Botão Central (Fixo) */}
      <button
        onClick={!isSpinning ? onSpinClick : undefined}
        disabled={isSpinning}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full z-30 flex flex-col items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.6)] border-[4px] border-[#FFD700] active:scale-95 transition-transform"
        style={{ background: 'linear-gradient(135deg, #FFD700 0%, #FF8C00 100%)' }}
      >
        <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse"></div>
        
        {isSpinning ? (
           <Music className="animate-spin text-white relative z-10" size={32} />
        ) : (
          <div className="relative z-10 text-center">
            <span className="block text-white font-black text-xl uppercase drop-shadow-md leading-none">GIRAR</span>
            <span className="block text-white text-[10px] font-bold uppercase mt-1 bg-black/20 px-2 py-0.5 rounded-full">
               {hasFreeSpin ? 'Grátis' : 'R$ 1,00'}
            </span>
          </div>
        )}
      </button>
    </div>
  );
}
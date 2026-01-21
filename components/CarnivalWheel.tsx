'use client';

import React from 'react';
import { Theater, Music } from 'lucide-react';

// A constante WHEEL_PRIZES foi removida daqui pois agora é visual.
// A lógica de qual prêmio cai continua no page.tsx.

interface CarnivalWheelProps {
  isSpinning: boolean;
  rotationAngle: number;
  onSpinClick: () => void;
  hasFreeSpin: boolean;
}

export default function CarnivalWheel({ isSpinning, rotationAngle, onSpinClick, hasFreeSpin }: CarnivalWheelProps) {
  return (
    <div className="relative w-[320px] h-[320px] md:w-[400px] md:h-[400px] mx-auto my-6 group">
      
      {/* 1. Efeito de Fundo (Brilho Carnaval) */}
      <div className="absolute inset-[-15px] rounded-full animate-pulse blur-xl z-0"
        style={{ background: 'conic-gradient(from 0deg, #FFD700, #ff4444, #aa66cc, #00C851, #FFD700)' }}
      ></div>

      {/* 2. Seta Indicadora (Topo) */}
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-30 drop-shadow-lg">
        <Theater size={48} fill="#FFD700" stroke="#FFF" strokeWidth={2} />
      </div>

      {/* 3. A Imagem da Roleta Giratória */}
      <div
        className="w-full h-full rounded-full relative overflow-hidden z-10 shadow-2xl transition-transform duration-[5000ms] cubic-bezier(0.15, 0, 0.15, 1) border-4 border-[#FFD700]"
        style={{
          transform: `rotate(${rotationAngle}deg)`,
          // A imagem deve estar na pasta "public" com este nome
          backgroundImage: 'url(/roulette_wheel.png)', 
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        {/* Não há mais código de fatias aqui, apenas a imagem de fundo gira */}
      </div>

      {/* 4. Botão Central (Fixo) */}
      <button
        onClick={!isSpinning ? onSpinClick : undefined}
        disabled={isSpinning}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full z-30 flex flex-col items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.5)] border-[4px] border-white active:scale-95 transition-transform"
        style={{ background: 'linear-gradient(135deg, #FFD700 0%, #FF8C00 100%)' }}
      >
        <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse"></div>
        
        {isSpinning ? (
           <Music className="animate-spin text-white relative z-10" size={32} />
        ) : (
          <div className="relative z-10 text-center">
            <span className="block text-white font-black text-xl uppercase drop-shadow-md leading-none">GIRAR</span>
            <span className="block text-white text-[9px] font-bold uppercase mt-1 bg-black/20 px-2 py-0.5 rounded-full">
               {hasFreeSpin ? 'Grátis' : 'R$ 1,00'}
            </span>
          </div>
        )}
      </button>
    </div>
  );
}
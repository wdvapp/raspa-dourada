'use client';

import React from 'react';
import { Theater, Coins, Ticket, XCircle, PartyPopper, Music, Star } from 'lucide-react';

// --- 1. LISTA DE PRÊMIOS (O page.tsx precisa disso exportado) ---
export const WHEEL_PRIZES = [
  { label: 'R$ 5', value: 5, type: 'money', color: '#00C851', textColor: 'white', icon: <Coins size={24} /> }, // Verde
  { label: '10 Giros', value: 10, type: 'scratch', color: '#ff4444', textColor: 'white', icon: <Ticket size={24} /> }, // Vermelho
  { label: 'Não foi', value: 0, type: 'loss', color: '#33b5e5', textColor: 'white', icon: <XCircle size={24} /> }, // Azul
  { label: 'R$ 2', value: 2, type: 'money', color: '#FFD700', textColor: 'black', icon: <Coins size={24} /> }, // Dourado
  { label: 'Bônus', value: 0, type: 'bonus', color: '#aa66cc', textColor: 'white', icon: <PartyPopper size={24} /> }, // Roxo
  { label: '5 Giros', value: 5, type: 'scratch', color: '#FF8800', textColor: 'white', icon: <Ticket size={24} /> }, // Laranja
  { label: 'Tente+', value: 0, type: 'loss', color: '#2BBBAD', textColor: 'white', icon: <Theater size={24} /> }, // Turquesa
  { label: 'R$ 1', value: 1, type: 'money', color: '#ffbb33', textColor: 'black', icon: <Coins size={24} /> }, // Amarelo
];

const SEGMENT_ANGLE = 360 / WHEEL_PRIZES.length;

interface CarnivalWheelProps {
  isSpinning: boolean;
  rotationAngle: number;
  onSpinClick: () => void;
  hasFreeSpin: boolean;
}

export default function CarnivalWheel({ isSpinning, rotationAngle, onSpinClick, hasFreeSpin }: CarnivalWheelProps) {
  return (
    <div className="relative w-[320px] h-[320px] md:w-[400px] md:h-[400px] mx-auto my-6 group">
      
      {/* 1. Brilho de Fundo (Carnaval) */}
      <div className="absolute inset-[-15px] rounded-full animate-pulse blur-xl z-0"
        style={{ background: 'conic-gradient(from 0deg, #FFD700, #ff4444, #aa66cc, #00C851, #FFD700)' }}
      ></div>

      {/* 2. Seta Indicadora (Topo) */}
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-30 drop-shadow-lg">
        {/* Triângulo invertido Dourado */}
        <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[30px] border-t-[#FFD700]"></div>
      </div>

      {/* 3. A Roleta Giratória (Desenhada via Código) */}
      <div
        className="w-full h-full rounded-full relative overflow-hidden z-10 shadow-2xl transition-transform duration-[5000ms] cubic-bezier(0.15, 0, 0.15, 1) border-4 border-[#FFD700]"
        style={{
          transform: `rotate(${rotationAngle}deg)`,
          background: '#333' // Fundo de segurança
        }}
      >
        {/* Renderiza as Fatias Coloridas Automaticamente */}
        {WHEEL_PRIZES.map((prize, index) => {
          const rotation = index * SEGMENT_ANGLE;
          return (
            <div
              key={index}
              className="absolute top-0 left-1/2 w-1/2 h-1/2 origin-bottom-left"
              style={{
                transform: `rotate(${rotation}deg) skewY(-${90 - SEGMENT_ANGLE}deg)`,
                background: prize.color, // Cor vinda da lista
                borderRight: '2px solid rgba(255,255,255,0.2)' // Divisória sutil
              }}
            >
              {/* Conteúdo da Fatia (Texto e Ícone) - Centralizado */}
              <div 
                className="absolute flex flex-col items-center justify-center text-center w-full h-full"
                style={{ 
                    // Ajuste fino para centralizar o texto na parte mais larga da fatia
                    transform: `skewY(${90 - SEGMENT_ANGLE}deg) rotate(${SEGMENT_ANGLE / 2}deg) translate(35px, 45px)`, 
                }}
              >
                {/* Ícone girado para ficar em pé */}
                <div style={{ color: prize.textColor, transform: 'rotate(-90deg)' }} className="mb-1 drop-shadow-md">
                    {prize.icon}
                </div>
                {/* Texto girado */}
                <span 
                    className="font-black text-[11px] uppercase whitespace-nowrap drop-shadow-sm leading-none"
                    style={{ color: prize.textColor, transform: 'rotate(-90deg)' }}
                >
                  {prize.label}
                </span>
              </div>
            </div>
          );
        })}
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
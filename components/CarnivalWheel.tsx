'use client';

import React from 'react';
import { Zap, Gift, XCircle, Ticket, PartyPopper, Theater, Star } from 'lucide-react';

// --- CONFIGURAÇÃO DOS PRÊMIOS (PROFISSIONAL) ---
// Usamos gradientes CSS para um look metálico e rico.
const GOLD_GRADIENT = 'linear-gradient(135deg, #bf953f, #fcf6ba, #b38728, #fbf5b7, #aa771c)';
const DARK_GRADIENT = 'linear-gradient(135deg, #4a0e0e, #800020, #2c041d)'; // Vinho profundo/Roxo

export const WHEEL_PRIZES = [
  { label: '10 Raspadas Grátis', value: 10, type: 'scratch', bg: GOLD_GRADIENT, text: '#4a0e0e', icon: <Ticket size={26} /> },
  { label: 'Tente Novamente', value: 0, type: 'loss', bg: DARK_GRADIENT, text: '#bf953f', icon: <XCircle size={26} /> },
  { label: '2 Raspadas Grátis', value: 2, type: 'scratch', bg: GOLD_GRADIENT, text: '#4a0e0e', icon: <Ticket size={26} /> },
  { label: 'Bônus Folia', value: 5, type: 'bonus', bg: DARK_GRADIENT, text: '#bf953f', icon: <PartyPopper size={26} /> },
  { label: '5 Raspadas Grátis', value: 5, type: 'scratch', bg: GOLD_GRADIENT, text: '#4a0e0e', icon: <Ticket size={26} /> },
  { label: 'Volte Amanhã', value: 0, type: 'loss', bg: DARK_GRADIENT, text: '#bf953f', icon: <Theater size={26} /> },
  { label: '1 Raspada Grátis', value: 1, type: 'scratch', bg: GOLD_GRADIENT, text: '#4a0e0e', icon: <Ticket size={26} /> },
  { label: 'Prêmio Surpresa', value: 3, type: 'gift', bg: DARK_GRADIENT, text: '#bf953f', icon: <Gift size={26} /> },
];

const SEGMENT_ANGLE = 360 / WHEEL_PRIZES.length;

interface CarnivalWheelProps {
  isSpinning: boolean;
  rotationAngle: number;
  onSpinClick: () => void;
  hasFreeSpin: boolean; // Nova propriedade para controlar o texto do botão
}

export default function CarnivalWheel({ isSpinning, rotationAngle, onSpinClick, hasFreeSpin }: CarnivalWheelProps) {
  return (
    <div className="relative w-[340px] h-[340px] md:w-[420px] md:h-[420px] mx-auto my-10 group">
      
      {/* --- Camada de Fundo "Folia Dourada" (Brilho externo) --- */}
      <div className="absolute inset-[-30px] rounded-full opacity-40 animate-pulse blur-2xl z-0"
        style={{ background: 'conic-gradient(from 0deg, #bf953f, transparent, #fcf6ba, transparent, #bf953f)' }}
      ></div>

      {/* --- Indicador do Topo (Máscara Dourada) --- */}
      <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-30 drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">
        <Theater size={48} fill="#bf953f" stroke="#fcf6ba" strokeWidth={1.5} />
      </div>

      {/* --- A Roda --- */}
      <div
        className="w-full h-full rounded-full relative overflow-hidden z-10 shadow-[0_0_30px_rgba(191,149,63,0.5)] transition-transform duration-[5000ms] cubic-bezier(0.15, 0, 0.15, 1)"
        style={{
          transform: `rotate(${rotationAngle}deg)`,
          border: '12px solid #bf953f', // Borda dourada grossa
          backgroundImage: 'radial-gradient(circle at center, rgba(0,0,0,0) 30%, rgba(0,0,0,0.4)), conic-gradient(from 0deg, ' + 
            WHEEL_PRIZES.map((_, i) => `${i % 2 === 0 ? '#bf953f' : '#4a0e0e'} ${i * SEGMENT_ANGLE}deg ${(i + 1) * SEGMENT_ANGLE}deg`).join(', ') + 
          ')'
        }}
      >
        {/* Borda interna metálica para acabamento premium */}
        <div className="absolute inset-0 rounded-full border-[4px] border-[#fcf6ba] opacity-50 pointer-events-none"></div>

        {/* Segmentos */}
        {WHEEL_PRIZES.map((segment, index) => (
          <div
            key={index}
            className="absolute top-0 left-1/2 w-1/2 h-1/2 origin-bottom-left flex flex-col items-center justify-center pt-8"
            style={{
              transform: `rotate(${index * SEGMENT_ANGLE + SEGMENT_ANGLE / 2}deg) skewY(-${90 - SEGMENT_ANGLE}deg)`,
            }}
          >
            <div 
                className="flex flex-col items-center justify-center -rotate-90"
                style={{ 
                  transform: `skewY(${90 - SEGMENT_ANGLE}deg) rotate(${SEGMENT_ANGLE / 2}deg) translate(50px, -20px)`,
                  color: segment.text
                }}
            >
                <div className="mb-1 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">{segment.icon}</div>
                <span className="font-black text-[11px] uppercase text-center leading-tight max-w-[80px] drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">
                  {segment.label}
                </span>
            </div>
          </div>
        ))}
      </div>

      {/* --- Botão Central "GIRAR" (Premium) --- */}
      <button
        onClick={!isSpinning ? onSpinClick : undefined}
        disabled={isSpinning}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full z-30 flex flex-col items-center justify-center overflow-hidden active:scale-95 transition-transform disabled:opacity-90 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(0,0,0,0.8)] border-[6px] border-[#fcf6ba]"
        style={{ background: GOLD_GRADIENT }}
      >
        <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
        
        {isSpinning ? (
           <Star className="animate-spin text-[#4a0e0e]" size={32} fill="currentColor" />
        ) : (
          <>
            <span className="text-[#4a0e0e] font-black text-xl uppercase tracking-wider leading-none drop-shadow-sm">GIRAR</span>
            {hasFreeSpin ? (
               <span className="text-[#4a0e0e] text-[10px] font-bold uppercase mt-1 bg-[#fcf6ba] px-2 py-0.5 rounded-full animate-pulse">Grátis Hoje!</span>
            ) : (
               <span className="text-[#4a0e0e] text-xs font-bold uppercase mt-1">Por R$ 1,00</span>
            )}
          </>
        )}
      </button>
       {/* Anel decorativo externo do botão */}
       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-[2px] border-[#bf953f] opacity-50 z-20 pointer-events-none animate-spin-slow"></div>
    </div>
  );
}
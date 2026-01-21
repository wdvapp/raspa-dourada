'use client';

import React from 'react';
import { Zap, Gift, XCircle, Ticket, PartyPopper, Theater, Star, Coins, Music } from 'lucide-react';

// --- CONFIGURAÇÃO DOS PRÊMIOS (TEMA CARNAVAL) ---
// Cores vibrantes e festivas
const CARNIVAL_COLORS = [
  '#9400D3', // Roxo
  '#FFD700', // Dourado
  '#008000', // Verde
  '#FF0000', // Vermelho
  '#0000FF', // Azul
  '#FF4500', // Laranja
  '#C71585', // Rosa
  '#00CED1', // Turquesa
];

export const WHEEL_PRIZES = [
  { label: 'R$ 5,00', value: 5, type: 'money', color: CARNIVAL_COLORS[0], icon: <Coins size={32} className="drop-shadow-md" /> },
  { label: '10 Giros', value: 10, type: 'scratch', color: CARNIVAL_COLORS[1], text: '#000', icon: <Ticket size={32} className="drop-shadow-md" /> },
  { label: 'Não foi dessa vez', value: 0, type: 'loss', color: CARNIVAL_COLORS[2], icon: <XCircle size={32} className="drop-shadow-md" /> },
  { label: 'R$ 2,00', value: 2, type: 'money', color: CARNIVAL_COLORS[3], icon: <Coins size={32} className="drop-shadow-md" /> },
  { label: 'Bônus Folia', value: 0, type: 'bonus', color: CARNIVAL_COLORS[4], icon: <PartyPopper size={32} className="drop-shadow-md" /> },
  { label: '5 Giros', value: 5, type: 'scratch', color: CARNIVAL_COLORS[5], icon: <Ticket size={32} className="drop-shadow-md" /> },
  { label: 'Tente de Novo', value: 0, type: 'loss', color: CARNIVAL_COLORS[6], icon: <Theater size={32} className="drop-shadow-md" /> },
  { label: 'R$ 1,00', value: 1, type: 'money', color: CARNIVAL_COLORS[7], icon: <Coins size={32} className="drop-shadow-md" /> },
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
    <div className="relative w-[340px] h-[340px] md:w-[420px] md:h-[420px] mx-auto my-10 group">
      
      {/* --- Camada de Fundo "Explosão de Confete" --- */}
      <div className="absolute inset-[-40px] rounded-full opacity-60 animate-pulse blur-2xl z-0"
        style={{ background: 'radial-gradient(circle, #FFD700 0%, transparent 70%)' }}
      ></div>

      {/* --- Indicador do Topo (Máscara de Carnaval) --- */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-30 drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">
        <Theater size={54} fill="#FFD700" stroke="#FFF" strokeWidth={2} />
      </div>

      {/* --- A Roda --- */}
      <div
        className="w-full h-full rounded-full relative overflow-hidden z-10 shadow-[0_0_30px_rgba(255,215,0,0.8)] transition-transform duration-[5000ms] cubic-bezier(0.15, 0, 0.15, 1)"
        style={{
          transform: `rotate(${rotationAngle}deg)`,
          border: '8px solid #FFD700',
          background: `conic-gradient(from 0deg, ${WHEEL_PRIZES.map((p, i) => `${p.color} ${i * SEGMENT_ANGLE}deg ${(i + 1) * SEGMENT_ANGLE}deg`).join(', ')})`
        }}
      >
        {/* Efeito de brilho metálico sobre os segmentos */}
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,_transparent_30%,_rgba(255,255,255,0.2)_70%)] pointer-events-none"></div>

        {/* Divisórias dos Segmentos */}
        {WHEEL_PRIZES.map((_, index) => (
            <div
                key={`divider-${index}`}
                className="absolute top-0 left-1/2 w-[2px] h-1/2 bg-[#FFD700] origin-bottom"
                style={{ transform: `rotate(${index * SEGMENT_ANGLE}deg)` }}
            ></div>
        ))}

        {/* Segmentos com Conteúdo */}
        {WHEEL_PRIZES.map((segment, index) => (
          <div
            key={index}
            className="absolute top-0 left-1/2 w-1/2 h-1/2 origin-bottom-left flex flex-col items-center justify-center pt-10"
            style={{
              transform: `rotate(${index * SEGMENT_ANGLE + SEGMENT_ANGLE / 2}deg) skewY(-${90 - SEGMENT_ANGLE}deg)`,
            }}
          >
            <div 
                className="flex flex-col items-center justify-center -rotate-90 text-white"
                style={{ 
                  transform: `skewY(${90 - SEGMENT_ANGLE}deg) rotate(${SEGMENT_ANGLE / 2}deg) translate(60px, -25px)`,
                  color: segment.text || '#FFF'
                }}
            >
                <div className="mb-2 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">{segment.icon}</div>
                <span className="font-black text-[13px] uppercase text-center leading-tight max-w-[90px] drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">
                  {segment.label}
                </span>
            </div>
          </div>
        ))}
      </div>

      {/* --- Botão Central "GIRAR" (Decorado) --- */}
      <button
        onClick={!isSpinning ? onSpinClick : undefined}
        disabled={isSpinning}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full z-30 flex flex-col items-center justify-center overflow-hidden active:scale-95 transition-transform disabled:opacity-90 disabled:cursor-not-allowed shadow-[0_0_25px_rgba(0,0,0,0.5)] border-[6px] border-[#FFD700]"
        style={{ background: 'linear-gradient(135deg, #FFD700, #FF4500)' }}
      >
        <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
        
        {isSpinning ? (
           <Music className="animate-spin text-[#FFF]" size={36} />
        ) : (
          <>
            <span className="text-[#FFF] font-black text-2xl uppercase tracking-wider leading-none drop-shadow-md">GIRAR</span>
            {hasFreeSpin ? (
               <span className="text-[#9400D3] text-[11px] font-bold uppercase mt-1 bg-[#FFF] px-3 py-1 rounded-full animate-pulse">Grátis!</span>
            ) : (
               <span className="text-[#FFF] text-xs font-bold uppercase mt-1 drop-shadow-sm">R$ 1,00</span>
            )}
          </>
        )}
      </button>
       {/* Anel decorativo externo do botão com brilho */}
       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 rounded-full border-[3px] border-[#FFD700] border-dashed opacity-70 z-20 pointer-events-none animate-[spin_10s_linear_infinite]"></div>
    </div>
  );
}
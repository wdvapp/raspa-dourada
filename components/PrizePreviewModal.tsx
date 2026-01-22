'use client';

import { X, Trophy, Zap } from 'lucide-react';

interface PrizePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: any; // <--- O SEGREDO: 'any' aceita tudo e para de dar erro de conflito
  onPlay: (game: any) => void;
  layoutColor: string;
}

export default function PrizePreviewModal({ isOpen, onClose, game, onPlay, layoutColor }: PrizePreviewModalProps) {
  if (!isOpen || !game) return null;

  // Ordena os prêmios do maior valor para o menor
  // O ?. evita erro se prizes vier vazio
  const sortedPrizes = [...(game.prizes || [])].sort((a: any, b: any) => Number(b.value) - Number(a.value));

  // --- PROTEÇÃO TOTAL DE PREÇO ---
  // 1. Transforma em texto (String)
  // 2. Troca vírgula por ponto (caso venha "2,00")
  // 3. Transforma em Número
  // 4. Se der erro (NaN), assume 0
  const priceRaw = String(game.price || '0').replace(',', '.');
  const priceNumber = Number(priceRaw) || 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-zinc-950 w-full max-w-sm rounded-3xl border border-zinc-800 flex flex-col shadow-2xl relative overflow-hidden">
        
        {/* Fundo Decorativo */}
        <div className="absolute top-0 left-0 w-full h-32 opacity-20 pointer-events-none" style={{ background: `linear-gradient(to bottom, ${layoutColor}, transparent)` }}></div>

        {/* Cabeçalho */}
        <div className="p-5 flex items-center justify-between relative z-10">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
              <Trophy size={12} style={{ color: layoutColor }} /> Tabela de Prêmios
            </span>
            <h3 className="text-white font-black text-xl italic uppercase leading-none mt-1">{game.name}</h3>
          </div>
          <button onClick={onClose} className="p-2 bg-zinc-900 rounded-full border border-zinc-800 text-zinc-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Lista de Prêmios */}
        <div className="px-5 pb-4 overflow-y-auto max-h-[60vh] relative z-10 custom-scrollbar">
          {sortedPrizes.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {sortedPrizes.map((prize: any, index: number) => (
                <div key={index} className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-2 flex flex-col items-center justify-center gap-1 min-h-[90px] relative group hover:border-zinc-600 transition-colors">
                  {/* Brilho no Hover */}
                  <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"></div>
                  
                  <div className="w-10 h-10 flex items-center justify-center mb-1">
                    {prize.image ? (
                       <img src={prize.image} alt={prize.name} className="w-full h-full object-contain drop-shadow-md" />
                    ) : (
                       <Trophy className="text-zinc-600" size={24} />
                    )}
                  </div>
                  <span className="text-[9px] text-zinc-400 font-bold leading-tight line-clamp-1 text-center w-full">
                    {prize.name}
                  </span>
                  <span className="text-xs font-black" style={{ color: layoutColor }}>
                    {Number(prize.value) > 0 
                      ? Number(prize.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) 
                      : 'ITEM'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
              <p className="text-xs">Nenhum prêmio cadastrado.</p>
            </div>
          )}
        </div>

        {/* Rodapé com botão de Jogar */}
        <div className="p-5 border-t border-zinc-800 bg-zinc-900/50 relative z-10">
          <button 
            onClick={() => {
                onPlay(game);
                onClose();
            }}
            className="w-full text-black font-black py-4 rounded-xl text-lg shadow-lg transition-transform active:scale-95 uppercase italic flex items-center justify-center gap-2"
            style={{ backgroundColor: layoutColor, boxShadow: `0 0 20px ${layoutColor}40` }}
          >
            <Zap size={20} className="fill-current" />
            JOGAR POR {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(priceNumber)}
          </button>
          <p className="text-center text-[10px] text-zinc-600 mt-3 font-medium">
            Ao clicar você concorda com os termos de uso.
          </p>
        </div>

      </div>
    </div>
  );
}
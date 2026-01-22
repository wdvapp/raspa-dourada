'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface WinnersCarouselProps {
  images: string[]; // <--- Agora ele recebe a lista real via props
}

export default function WinnersCarousel({ images }: WinnersCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Se a lista mudar, volta pro inicio
  useEffect(() => {
    setCurrentIndex(0);
  }, [images]);

  // Troca de slide automática (3 segundos)
  useEffect(() => {
    if (!images || images.length === 0) return;
    
    const interval = setInterval(() => {
      nextSlide();
    }, 3000);

    return () => clearInterval(interval);
  }, [currentIndex, images]);

  const nextSlide = () => {
    if (!images || images.length === 0) return;
    setCurrentIndex((prevIndex) => 
      prevIndex === images.length - 1 ? 0 : prevIndex + 1
    );
  };

  const prevSlide = () => {
    if (!images || images.length === 0) return;
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? images.length - 1 : prevIndex - 1
    );
  };

  // Se não tiver imagem nenhuma, não mostra nada (ou mostra um placeholder preto)
  if (!images || images.length === 0) {
      return (
          <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-600 font-bold text-sm">
              Mural de Ganhadores
          </div>
      );
  }

  return (
    <div className="w-full h-full relative group cursor-pointer" onClick={nextSlide}>
      {/* Imagem de Fundo */}
      <div 
        className="w-full h-full bg-cover bg-center transition-all duration-700 ease-in-out"
        style={{ backgroundImage: `url(${images[currentIndex]})` }}
      >
        <div className="w-full h-full bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
      </div>

      {/* Setinhas (Só aparecem se tiver mais de 1 foto) */}
      {images.length > 1 && (
          <>
            <button 
                onClick={(e) => { e.stopPropagation(); prevSlide(); }}
                className="hidden md:flex absolute top-1/2 -translate-y-1/2 left-4 bg-black/30 hover:bg-black/60 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
            >
                <ChevronLeft size={24} />
            </button>
            <button 
                onClick={(e) => { e.stopPropagation(); nextSlide(); }}
                className="hidden md:flex absolute top-1/2 -translate-y-1/2 right-4 bg-black/30 hover:bg-black/60 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
            >
                <ChevronRight size={24} />
            </button>
          </>
      )}

      {/* Indicadores */}
      {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_, idx) => (
            <div 
                key={idx}
                className={`transition-all duration-300 rounded-full h-1.5 shadow-sm ${
                idx === currentIndex ? 'w-6 bg-[#ffc700]' : 'w-1.5 bg-white/50'
                }`}
            />
            ))}
          </div>
      )}
    </div>
  );
}
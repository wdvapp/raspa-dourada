'use client';

import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detecta se já está instalado (modo app)
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);

    // Detecta se é iOS (iPhone/iPad)
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    // Captura o evento de instalação no Android/Chrome
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      // No iOS não dá para forçar o botão, tem que ensinar o usuário
      alert("Para instalar no iPhone:\n1. Clique no botão 'Compartilhar' lá embaixo ⬆️\n2. Selecione 'Adicionar à Tela de Início' 📱");
    } else if (deferredPrompt) {
      // No Android, dispara o prompt nativo
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
        alert("Para instalar, procure a opção 'Adicionar à Tela Inicial' no menu do seu navegador.");
    }
  };

  // Se já estiver instalado, não mostra o botão
  if (isStandalone) return null;

  return (
    <button 
      onClick={handleInstallClick}
      className="flex flex-col items-center gap-1 text-zinc-500 hover:text-[#ffc700] transition-colors"
    >
      <div className="bg-zinc-800 p-3 rounded-xl border border-zinc-700 shadow-lg animate-bounce">
        <Download size={24} className="text-[#ffc700]" />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wide">Baixar App</span>
    </button>
  );
}
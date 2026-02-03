'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { app } from '@/lib/firebase'; // Certifique-se que o caminho está certo

// --- LISTA VIP (Modo Fantasma Automático) ---
const ADMIN_EMAILS = [
  'wallacevale20@gmail.com',       // <--- COLOQUE SEU EMAIL AQUI
  'thiagodesouzateles@gmail.com'   // <--- COLOQUE O EMAIL DELE AQUI
];

export default function GoogleAnalytics({ gaId }: { gaId: string }) {
  const pathname = usePathname();
  const [allowTracking, setAllowTracking] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    // 1. Bloqueio imediato se estiver na URL do admin
    if (window.location.pathname.startsWith('/admin')) {
      setAllowTracking(false);
      setIsCheckingAuth(false);
      return;
    }

    // 2. Pergunta ao Firebase: "Quem está aí?"
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email && ADMIN_EMAILS.includes(user.email)) {
        // É O DONO! BLOQUEIA TUDO.
        console.log(`👻 Modo Fantasma Automático: Olá ${user.email}, Analytics Bloqueado.`);
        setAllowTracking(false);
      } else {
        // É um usuário comum (ou não logado) -> LIBERA O RASTREIO
        setAllowTracking(true);
      }
      setIsCheckingAuth(false);
    });

    return () => unsubscribe();
  }, [pathname]);

  // Enquanto o Firebase não responde, ou se o rastreio for negado -> NÃO RENDERIZA NADA
  if (!gaId || isCheckingAuth || !allowTracking) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          gtag('config', '${gaId}', {
            page_path: window.location.pathname,
          });
        `}
      </Script>
    </>
  );
}
'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function GoogleAnalytics({ gaId }: { gaId: string }) {
  const pathname = usePathname();
  const [isInternalUser, setIsInternalUser] = useState(false);

  useEffect(() => {
    // Verifica se existe a "marca" de desenvolvedor no navegador
    const checkInternal = localStorage.getItem('RASPA_INTERNAL_USER');
    if (checkInternal === 'true') {
      setIsInternalUser(true);
      console.log('👻 Modo Fantasma Ativo: Analytics Bloqueado');
    }
  }, []);

  // SE NÃO TIVER ID, SE FOR ADMIN, OU SE FOR USUÁRIO INTERNO -> NÃO RASTREIA
  if (!gaId) return null;
  if (pathname?.startsWith('/admin')) return null;
  if (isInternalUser) return null; // <--- AQUI ESTÁ O TRUQUE

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
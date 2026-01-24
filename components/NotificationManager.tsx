'use client';
import { useEffect } from 'react';
import { getMessaging, getToken } from 'firebase/messaging';
import { app } from '../lib/firebase';

export default function NotificationManager() {
  useEffect(() => {
    async function requestPermission() {
      try {
        // 1. Só roda no navegador e se tiver suporte
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
          
          // 2. Pede Permissão ao Usuário
          const permission = await Notification.requestPermission();
          
          if (permission === 'granted') {
            console.log('🔔 Permissão concedida!');
            
            const messaging = getMessaging(app);
            
            // 3. Pega o Token (O endereço do celular)
            // IMPORTANTE: Pegue sua chave "Key pair" no Firebase Console > Cloud Messaging > Web Push
            // Se não tiver, pode tentar sem, mas com a chave é garantido.
            const token = await getToken(messaging, {
                vapidKey: "BPUZpe5BR6m4HTKyE2USvr1_WLDzGIktfSMOTgvC004hQXJz52_0pAX1jV8MXV1l2CEhmoz75-zpTb1aAjqp6s" 
            });

            if (token) {
              console.log('Token gerado:', token);
              
              // 4. Manda o Token para o servidor inscrever no grupo "all_users"
              // (Essa era a parte que faltava no seu código!)
              await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
              });
              
              console.log('✅ Token enviado para inscrição!');
            }
          }
        }
      } catch (error) {
        console.error('Erro na notificação:', error);
      }
    }

    requestPermission();
  }, []);

  return null;
}
'use client';
import { useEffect } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { app } from '../lib/firebase';

export default function NotificationManager() {
  useEffect(() => {
    async function requestPermission() {
      try {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
          
          // 1. REGISTRA O SERVICE WORKER
          const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          
          // 2. PEDE PERMISSÃO
          const permission = await Notification.requestPermission();
          
          if (permission === 'granted') {
            console.log('🔔 Permissão concedida!');
            const messaging = getMessaging(app);
            
            // 3. PEGA O TOKEN
            const token = await getToken(messaging, {
              vapidKey: "BPUZpe5BR6m4HTKyE2USvr1_WLDzGIktfSMOTgvC004hQXJz52_0pAX1jV8MXV1l2CEhmoz75-zpTb1aAjqp6s",
              serviceWorkerRegistration: registration
            });

            if (token) {
              // Salva no banco (backend)
              await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
              });
            }

            // --- NOVO: RECEBER MENSAGEM COM APP ABERTO ---
            onMessage(messaging, (payload) => {
              console.log('📩 Mensagem recebida em 1º plano:', payload);
              
              // Extrai os dados da notificação
              // (O Firebase às vezes manda em 'notification' ou em 'data')
              const title = payload.notification?.title || payload.data?.title || "Nova Mensagem";
              const options = {
                body: payload.notification?.body || payload.data?.body,
                icon: '/icon-192x192.png',
                image: payload.notification?.image || payload.data?.image, // Banner grande
              };

              // FORÇA O BANNER APARECER NA TELA
              new Notification(title, options);
            });
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
'use client';
import { useEffect } from 'react';
import { getMessaging, getToken } from 'firebase/messaging';
import { app } from '../lib/firebase';

export default function NotificationManager() {
  useEffect(() => {
    async function requestPermission() {
      try {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
          
          // 1. REGISTRAR O SERVICE WORKER PRIMEIRO
          const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          console.log('✅ Service Worker registrado:', registration.scope);

          // 2. PEDIR PERMISSÃO
          const permission = await Notification.requestPermission();
          
          if (permission === 'granted') {
            console.log('🔔 Permissão concedida!');
            
            const messaging = getMessaging(app);
            
            // 3. GERAR O TOKEN VINCULADO AO SW
            const token = await getToken(messaging, {
              vapidKey: "BPUZpe5BR6m4HTKyE2USvr1_WLDzGIktfSMOTgvC004hQXJz52_0pAX1jV8MXV1l2CEhmoz75-zpTb1aAjqp6s",
              serviceWorkerRegistration: registration
            });

            if (token) {
              console.log('Token gerado:', token);
              
              // 4. SALVAR NO BANCO
              await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
              });
              
              console.log('✅ Token enviado para o servidor!');
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
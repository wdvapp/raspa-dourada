'use client';

import { useEffect } from 'react';
import { getMessaging, getToken } from 'firebase/messaging';
import { app } from '../lib/firebase'; // Importa seu app já inicializado

export default function NotificationManager() {

  async function requestPermission() {
    console.log('Pedindo permissão...');
    
    // 1. Pede permissão ao navegador
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('Permissão concedida!');
      
      const messaging = getMessaging(app);
      
      // 2. Pega o Token (O "CPF" desse celular para receber mensagem)
      const token = await getToken(messaging, {
        // COLE SUA CHAVE "BPU..." AQUI EMBAIXO:
        vapidKey: "BPUzpe58R6mf4HTkyE2USvrJ_WLDzGIktfSMOTgvCOQ4hQXJzS2_0pAXljY8MXV112CEhmoz75-zpTbiaAJqe6s"
      });
      
      if (token) {
        console.log('SEU TOKEN DE TESTE:', token);
        // Aqui futuramente salvaremos no banco de dados para enviar promoções
        // Por enquanto, só mostra no console para testar
      }
      
    } else {
      console.log('Permissão negada.');
    }
  }

  // Tenta pedir assim que o componente carrega (só para teste)
  useEffect(() => {
    // Só roda no navegador
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        requestPermission();
    }
  }, []);

  return null; // Esse componente não mostra nada na tela, ele roda escondido
}
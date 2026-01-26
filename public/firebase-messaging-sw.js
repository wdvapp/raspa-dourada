importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCqWPVoFbyBTcVwxjy1s8ZZFAFEZK_UOSE",
  authDomain: "raspa-dourada.firebaseapp.com",
  projectId: "raspa-dourada",
  storageBucket: "raspa-dourada.appspot.com",
  messagingSenderId: "1035486868104",
  appId: "1:1035486868104:web:ef76b9e56ac89825cde53d"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 1. RECEBER E MOSTRAR (SIMPLES E DIRETO)
messaging.onBackgroundMessage((payload) => {
  console.log('Notificação recebida:', payload);

  // Pega os dados que mandamos da API
  const { title, body, link } = payload.data;

  const notificationOptions = {
    body: body,
    icon: '/icon-192x192.png', // OBRIGATÓRIO: Seu logo
    badge: '/icon-192x192.png', // O íconezinho branco na barra de status (Android)
    data: { url: link || '/' }, // Guarda o link para usar no clique
    vibrate: [200, 100, 200],
    requireInteraction: true // Faz a notificação ficar na tela até clicar
  };

  // Mostra a notificação
  return self.registration.showNotification(title, notificationOptions);
});

// 2. CLICAR E ABRIR
self.addEventListener('notificationclick', function(event) {
  event.notification.close(); // Fecha a notificação
  
  // Pega o link que guardamos acima
  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Tenta focar numa aba já aberta
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Se não tiver, abre uma nova
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
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

messaging.onBackgroundMessage((payload) => {
  console.log('Notificação em Background:', payload);

  // 1. Tenta pegar do bloco 'notification' (Padrão do Firebase Console)
  // 2. Se não tiver, tenta pegar do bloco 'data' (Backend personalizado)
  const title = payload.notification?.title || payload.data?.title || 'Raspa Dourada';
  const body = payload.notification?.body || payload.data?.body || 'Nova mensagem!';
  const image = payload.notification?.image || payload.data?.image || '/icon-512x512.png';
  const icon = '/icon-192x192.png';
  const link = payload.data?.link || payload.data?.url || '/';

  const notificationOptions = {
    body: body,
    icon: icon,
    image: image, // Banner grande (estilo YouTube)
    badge: '/badge.png', // Ícone pequeno na barra
    vibrate: [200, 100, 200],
    requireInteraction: true, // Obriga o usuário a interagir para sumir
    data: { url: link }
  };

  return self.registration.showNotification(title, notificationOptions);
});

// Ao clicar na notificação, abre o app
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se já tiver uma aba aberta, foca nela
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // Se não, abre uma nova
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
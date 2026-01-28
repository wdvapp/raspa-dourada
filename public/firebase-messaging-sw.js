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
  console.log('Notificação no SW:', payload);

  const title = payload.notification?.title || payload.data?.title || 'Raspa Dourada';
  const body = payload.notification?.body || payload.data?.body || 'Nova mensagem';
  const image = payload.notification?.image || payload.data?.image || '';
  const link = payload.data?.url || payload.data?.link || '/';

  const notificationOptions = {
    body: body,
    icon: '/icon-192x192.png',
    image: image,
    badge: '/badge.png',
    vibrate: [200, 100, 200, 100, 200], // Vibração mais longa e chata
    requireInteraction: true,
    
    // --- O SEGREDO DO POP-UP ---
    tag: 'push-notification-' + Date.now(), // Cria uma tag única para forçar ser "nova"
    renotify: true, // Obriga o celular a tocar e vibrar de novo mesmo se tiver outra
    // ---------------------------

    data: { url: link }
  };

  return self.registration.showNotification(title, notificationOptions);
});

// Clique na notificação
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});
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
  console.log('Notificação recebida:', payload);

  // Pegamos a imagem que veio nos dados
  const { title, body, image, link } = payload.data;

  const notificationOptions = {
    body: body,
    icon: '/icon-192x192.png', // Logo colorida na direita/expandida
    badge: '/badge.png',        // O ÍCONE TRANSPARENTE (ESQUERDA)
    image: image,               // <--- O BANNER GRANDE (YOUTUBE STYLE)
    data: { url: link || '/' },
    vibrate: [200, 100, 200],
    requireInteraction: true
  };

  return self.registration.showNotification(title, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});
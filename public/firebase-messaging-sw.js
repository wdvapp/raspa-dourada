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

// 1. DESENHA A NOTIFICAÇÃO MANUALMENTE (Modo Background)
messaging.onBackgroundMessage((payload) => {
  console.log('Recebido no background:', payload);

  // Pegamos os dados que vêm dentro da gaveta "data"
  const { title, body, image, link } = payload.data;

  const notificationTitle = title;
  const notificationOptions = {
    body: body,
    icon: '/icon-192x192.png', // O ícone do app
    image: image,               // A Imagem Grande (Banner)
    data: { url: link },        // O Link para clicar
    vibrate: [200, 100, 200],   // Vibração
    requireInteraction: true    // Fica na tela até a pessoa clicar ou fechar
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// 2. O CLIQUE (Abre o link)
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data.url || '/';

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
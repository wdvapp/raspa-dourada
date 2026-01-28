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
  console.log('Notificação SW:', payload);

  const title = payload.notification?.title || payload.data?.title || 'Raspa Dourada';
  const body = payload.notification?.body || payload.data?.body || 'Nova notificação';
  const image = payload.notification?.image || payload.data?.image || '';
  const link = payload.data?.url || payload.data?.link || '/';

  // TRUQUE PARA O J7: Usar o caminho completo (URL) para o ícone
  const iconUrl = self.location.origin + '/icon-192x192.png';

  const notificationOptions = {
    body: body,
    icon: iconUrl, // Caminho absoluto para não ter erro de "não encontrado"
    image: image,
    // Removemos 'badge', 'tag' e 'renotify' que bugam Android antigo
    vibrate: [200, 100, 200], 
    data: { url: link }
  };

  return self.registration.showNotification(title, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      if (windowClients.length > 0) {
        return windowClients[0].focus();
      }
      return clients.openWindow(urlToOpen);
    })
  );
});
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
  // Esse código tenta mostrar o banner se o sistema Android falhar
  const title = payload.notification?.title || payload.data?.title || 'Raspa Dourada';
  const body = payload.notification?.body || payload.data?.body || 'Nova mensagem';
  const image = payload.notification?.image || payload.data?.image || '/icon-192x192.png';
  const link = payload.data?.url || payload.data?.link || '/';

  return self.registration.showNotification(title, {
    body: body,
    icon: '/icon-192x192.png',
    image: image,
    data: { url: link }
  });
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data.url || '/';
  event.waitUntil(clients.openWindow(urlToOpen));
});
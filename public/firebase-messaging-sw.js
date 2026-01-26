importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// --- SUA CONFIGURAÇÃO (Mantenha a que você já tem ou use esta se for a mesma) ---
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

// 1. RECEBER A NOTIFICAÇÃO NO BACKGROUND
messaging.onBackgroundMessage((payload) => {
  console.log('Notificação recebida no background:', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192x192.png', // Seu ícone oficial (certifique-se que ele existe na pasta public)
    image: payload.notification.image, // A imagem grande (Banner)
    data: {
      url: payload.data?.url || '/' // O link para onde vamos levar o usuário
    },
    vibrate: [200, 100, 200, 100, 200, 100, 200], // Vibração mais longa e chamativa
    actions: [
      { action: 'open_url', title: 'Ver Agora' } // Botão de ação
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 2. O QUE FAZER QUANDO CLICAR NA NOTIFICAÇÃO
self.addEventListener('notificationclick', function(event) {
  console.log('Notificação clicada!');
  event.notification.close(); // Fecha a notificação da barra

  // Pega o link que enviamos junto (ou vai para a home)
  const urlToOpen = event.notification.data.url || '/';

  // Abre o navegador no link certo
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se já tiver uma aba aberta, foca nela
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
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
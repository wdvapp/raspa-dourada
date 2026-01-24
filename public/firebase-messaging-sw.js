importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCqWPVoFbyBTcVwxjy1s8ZZFAFEZK_UOSE", // Peguei do seu .env.local
  authDomain: "raspa-dourada.firebaseapp.com",      // Peguei do seu .env.local
  projectId: "raspa-dourada",                       // Peguei do seu .env.local
  storageBucket: "raspa-dourada.appspot.com",       // Padrão do projeto
  messagingSenderId: "1035486868104",               // Do seu print
  appId: "1:1035486868104:web:ef76b9e56ac89825cde53d" // O NOVO QUE VOCÊ PEGOU AGORA
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('Notificação recebida:', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
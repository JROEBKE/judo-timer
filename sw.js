const CACHE_NAME = 'judo-timer-v1';
const assets = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './bluetooth.js',
  './sounds.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Überspringt das Warten und installiert das Update sofort
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim()); // Übernimmt sofort die Kontrolle über alle offenen Tabs/PWAs
});
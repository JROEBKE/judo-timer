# Judo Timer Training App

Eine lokale HTML-/CSS-/JavaScript-Timer-App mit vier Modi und bis zu zwei BLE-Buzzern.

## Dateien
- `index.html` – Struktur
- `style.css` – reduziertes responsives Design
- `app.js` – Modi, Zeitmessung, Session-Ergebnisse
- `bluetooth.js` – Web-Bluetooth-Verbindungen
- `sounds.js` – Signaltöne

## Starten
Web Bluetooth funktioniert nur in unterstützten Browsern und in einem sicheren Kontext (HTTPS oder localhost). Öffne die App daher nicht einfach als `file://`, wenn der Browser Web Bluetooth dort blockiert. Du kannst sie lokal über einen kleinen Webserver oder über eine HTTPS-Seite bereitstellen.

## Buzzer-Kompatibilität
Die App verwendet dieselben UUIDs wie das bisherige Judo-Buzzer-Projekt:
- Service: `8b7e1000-1234-4567-890a-bcdef0123456`
- Characteristic: `8b7e1001-1234-4567-890a-bcdef0123456`

Die Characteristic muss Notifications mit einem erkennbaren Tastendruck-Ereignis senden. `bluetooth.js` erkennt u. a. `1`, `true`, `press`, `pressed`, `click` sowie einfache JSON-Ereignisse mit `pressed: true`. Wenn deine aktuelle ESP32-Firmware ein anderes Datenformat sendet, muss die Funktion `parseButtonEvent()` entsprechend angepasst werden.

## Bedienlogik
- **Stoppuhr:** Buzzer startet und stoppt; Ergebnis bleibt stehen; nächster Druck startet einen neuen Versuch.
- **Race:** GO startet die Zeit. Buzzer 1/2 konkurrieren. Ereignisse innerhalb von 50 ms werden als DRAW gewertet.
- **Countdown Single Round:** Countdown läuft einmal ab. Reset ist über Bildschirm und nach aktuellem Entwurf auch als Aktion sichtbar.
- **Countdown Loop:** Nach jeder Runde außer der letzten folgt eine Pause. Ein Buzzer-Druck während einer Runde bricht ab und kehrt zur Konfiguration zurück.
- **Reps Counter:** Beide Buzzer und die Bildschirm-Schaltfläche `+1 REP` zählen. Reset ist nur über die Bildschirm-Schaltfläche möglich.

## Zeitmessung
Gemessen wird intern mit `performance.now()` und damit unabhängig von der Bildwiederholrate. Die Stoppuhr zeigt Hundertstelsekunden an. Die Anzeige von Countdown und Break zeigt Minuten und Sekunden.

## Hinweis zum Race-Gleichstand
Die 50-ms-Regel bewertet die Empfangszeitpunkte der Bluetooth-Ereignisse im Browser. Bluetooth-Latenzen können dazu führen, dass sie nicht exakt dem physischen Tastendruck-Zeitpunkt entsprechen.

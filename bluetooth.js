/*
 * Web Bluetooth adapter for the ESP32-S3 Judo buzzer with Auto-Reconnect & Battery Status.
 */
(() => {
  const SERVICE_UUID = "8b7e1000-1234-4567-890a-bcdef0123456";
  const CHARACTERISTIC_UUID = "8b7e1001-1234-4567-890a-bcdef0123456";
  const BATTERY_SERVICE_UUID = 0x180F;
  const BATTERY_CHAR_UUID = 0x2A19;

  const slots = [
    { device: null, server: null, characteristic: null, wasPressed: false, listener: null, manualDisconnect: false, reconnectTimer: null },
    { device: null, server: null, characteristic: null, wasPressed: false, listener: null, manualDisconnect: false, reconnectTimer: null }
  ];
  const handlers = { event: () => {}, status: () => {}, battery: () => {} };

  function status(index, message, connected) {
    handlers.status(index, message, connected);
  }
  function updateBattery(index, level) {
    handlers.battery(index, level);
  }

  function parseButtonEvent(value) {
    let raw = "";
    try { raw = new TextDecoder().decode(value).trim().toLowerCase(); } catch { raw = ""; }
    if (!raw && value && value.byteLength) raw = String(value.getUint8(0));
    if (raw.startsWith("{")) {
      try {
        const obj = JSON.parse(raw);
        const v = String(obj.event ?? obj.type ?? obj.state ?? obj.button ?? "").toLowerCase();
        if (obj.pressed === true || ["press","pressed","down","click","clicked","button_pressed"].includes(v)) return "press";
        if (obj.pressed === false || ["release","released","up"].includes(v)) return "release";
      } catch {}
    }
    if (["1","true","press","pressed","down","click","clicked","button_pressed","taster gedrueckt","taster gedrückt"].includes(raw)) return "press";
    if (["0","false","release","released","up","taster losgelassen"].includes(raw)) return "release";
    if (raw.includes("gedrueckt") || raw.includes("gedrückt") || raw.includes("pressed")) return "press";
    if (raw.includes("losgelassen") || raw.includes("released")) return "release";
    return null;
  }

  function onNotification(index, event) {
    const slot = slots[index - 1];
    if (!slot) return;
    const action = parseButtonEvent(event.target.value);
    if (action === "press" && !slot.wasPressed) {
      slot.wasPressed = true;
      handlers.event(index, performance.now());
    } else if (action === "release") {
      slot.wasPressed = false;
    }
  }

  async function connectDevice(index, existingDevice = null) {
    if (!navigator.bluetooth) throw new Error("Web Bluetooth is not supported.");
    const slot = slots[index - 1];
    slot.manualDisconnect = false;

    let device = existingDevice;
    if (!device) {
      status(index, "Device selection open …", false);
      device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [SERVICE_UUID] }],
        optionalServices: [SERVICE_UUID, BATTERY_SERVICE_UUID]
      });
    }

    slot.device = device;

    // Event-Listener für unerwarteten Verbindungsabbruch (Auto-Reconnect)
    device.removeEventListener("gattserverdisconnected", slot.disconnectListener);
    slot.disconnectListener = () => {
      slots[index - 1].server = null;
      slots[index - 1].characteristic = null;
      if (!slot.manualDisconnect) {
        status(index, "Verbindung verloren. Verbinde neu...", false);
        // Automatischer Wiederverbindungsversuch nach 3 Sekunden
        clearTimeout(slot.reconnectTimer);
        slot.reconnectTimer = setTimeout(() => {
          if (!slot.manualDisconnect && slot.device) {
            connectDevice(index, slot.device).catch(() => {});
          }
        }, 3000);
      } else {
        status(index, "Nicht verbunden", false);
      }
    };
    device.addEventListener("gattserverdisconnected", slot.disconnectListener);

    status(index, "Connecting …", false);
    try {
      slot.server = await device.gatt.connect();
      const service = await slot.server.getPrimaryService(SERVICE_UUID);
      slot.characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
      slot.listener = e => onNotification(index, e);
      slot.characteristic.addEventListener("characteristicvaluechanged", slot.listener);
      await slot.characteristic.startNotifications();

      // Versuche den Batteriestand auszulesen
      try {
        const battService = await slot.server.getPrimaryService(BATTERY_SERVICE_UUID);
        const battChar = await battService.getCharacteristic(BATTERY_CHAR_UUID);
        
        // Entweder einmalig lesen:
        const battValue = await battChar.readValue();
        updateBattery(index, battValue.getUint8(0));

        // ODER (falls Notification gewünscht):
        // await battChar.startNotifications();
        // battChar.addEventListener('characteristicvaluechanged', (e) => {
        //   updateBattery(index, e.target.value.getUint8(0));
        // });

      } catch (error) {
        console.error("Fehler beim Abrufen des Batteriestands:", error);
      }

      status(index, `Connected: ${device.name || "Buzzer"}`, true);
      return device.name || "Buzzer";
    } catch (error) {
      if (!slot.manualDisconnect) {
        // Erneuter Versuch bei Fehlschlag
        slot.reconnectTimer = setTimeout(() => {
          if (!slot.manualDisconnect && slot.device) {
            connectDevice(index, slot.device).catch(() => {});
          }
        }, 3000);
      }
      throw error;
    }
  }

  async function disconnect(index) {
    const slot = slots[index - 1];
    if (!slot) return;
    slot.manualDisconnect = true;
    clearTimeout(slot.reconnectTimer);
    try {
      if (slot.characteristic && slot.listener) slot.characteristic.removeEventListener("characteristicvaluechanged", slot.listener);
      if (slot.device && slot.device.gatt.connected) slot.device.gatt.disconnect();
    } finally {
      slots[index - 1] = { device: null, server: null, characteristic: null, wasPressed: false, listener: null, manualDisconnect: true, reconnectTimer: null };
      status(index, "Not connected", false);
      updateBattery(index, null);
    }
  }

  window.TimerBluetooth = {
    isSupported: () => !!navigator.bluetooth,
    connect: index => connectDevice(index, null),
    disconnect,
    setHandlers(eventHandler, statusHandler, batteryHandler) {
      handlers.event = eventHandler || (() => {});
      handlers.status = statusHandler || (() => {});
      handlers.battery = batteryHandler || (() => {});
    },
    isConnected(index) { return !!slots[index - 1]?.device?.gatt?.connected; }
  };
})();
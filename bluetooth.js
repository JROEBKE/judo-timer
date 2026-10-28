/*
 * Web Bluetooth adapter for the ESP32-S3 Judo buzzer.
 * UUIDs match the existing judo-throws BLE sketch.
 *
 * Event payload parsing accepts common notify formats (1/0, press, pressed,
 * button, JSON with pressed/ event) and de-duplicates repeated "pressed" states.
 * If the firmware sends a different payload, adapt parseButtonEvent().
 */
(() => {
  const SERVICE_UUID = "8b7e1000-1234-4567-890a-bcdef0123456";
  const CHARACTERISTIC_UUID = "8b7e1001-1234-4567-890a-bcdef0123456";
  const slots = [null, null];
  const handlers = { event: () => {}, status: () => {} };

  function status(index, message, connected) {
    handlers.status(index, message, connected);
  }
  function parseButtonEvent(value, slot) {
    let raw = "";
    try { raw = new TextDecoder().decode(value).trim().toLowerCase(); }
    catch { raw = ""; }
    // Binary payloads sometimes carry a single byte.
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
    // A few sketches emit human-readable serial-like messages.
    if (raw.includes("gedrueckt") || raw.includes("gedrückt") || raw.includes("pressed")) return "press";
    if (raw.includes("losgelassen") || raw.includes("released")) return "release";
    // Empty/unknown payloads are not treated as presses to avoid false counts.
    return null;
  }
  function onNotification(index, event) {
    const slot = slots[index - 1];
    if (!slot) return;
    const value = event.target.value;
    const action = parseButtonEvent(value, slot);
    if (action === "press" && !slot.wasPressed) {
      slot.wasPressed = true;
      handlers.event(index, performance.now());
    } else if (action === "release") {
      slot.wasPressed = false;
    }
  }
  async function connect(index) {
    if (!navigator.bluetooth) throw new Error("Web Bluetooth wird von diesem Browser nicht unterstützt.");
    if (slots[index - 1]) await disconnect(index);
    status(index, "Geräteauswahl öffnen …", false);
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }],
      optionalServices: [SERVICE_UUID]
    });
    const slot = { device, server: null, characteristic: null, wasPressed: false, listener: null };
    slots[index - 1] = slot;
    device.addEventListener("gattserverdisconnected", () => {
      if (slots[index - 1] === slot) {
        slots[index - 1] = null;
        status(index, "Verbindung getrennt", false);
      }
    });
    status(index, "Verbinde …", false);
    try {
      slot.server = await device.gatt.connect();
      const service = await slot.server.getPrimaryService(SERVICE_UUID);
      slot.characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
      slot.listener = e => onNotification(index, e);
      slot.characteristic.addEventListener("characteristicvaluechanged", slot.listener);
      await slot.characteristic.startNotifications();
      status(index, `Verbunden: ${device.name || "Buzzer"}`, true);
      return device.name || "Buzzer";
    } catch (error) {
      slots[index - 1] = null;
      try { if (device.gatt.connected) device.gatt.disconnect(); } catch {}
      throw error;
    }
  }
  async function disconnect(index) {
    const slot = slots[index - 1];
    if (!slot) return;
    slots[index - 1] = null;
    try {
      if (slot.characteristic && slot.listener) slot.characteristic.removeEventListener("characteristicvaluechanged", slot.listener);
      if (slot.device.gatt.connected) slot.device.gatt.disconnect();
    } finally { status(index, "Nicht verbunden", false); }
  }
  window.TimerBluetooth = {
    isSupported: () => !!navigator.bluetooth,
    connect, disconnect,
    setHandlers(eventHandler, statusHandler) {
      handlers.event = eventHandler || (() => {});
      handlers.status = statusHandler || (() => {});
    },
    isConnected(index) { return !!slots[index - 1]?.device?.gatt?.connected; }
  };
})();

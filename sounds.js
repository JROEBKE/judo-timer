/* Web Audio sounds. AudioContext is resumed on the first user interaction. */
(() => {
  let ctx;
  function audio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!ctx) ctx = new AudioContextClass();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function tone(freq, start, duration, type = "sine", volume = 0.16) {
    const c = audio();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime + start);
    gain.gain.setValueAtTime(0.0001, c.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(volume, c.currentTime + start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + duration);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(c.currentTime + start); osc.stop(c.currentTime + start + duration + 0.02);
  }
  window.TimerSounds = {
    go() { tone(880, 0, .12, "square", .13); tone(1175, .13, .18, "square", .13); },
    stop() { tone(660, 0, .18, "triangle", .16); tone(440, .2, .3, "triangle", .16); },
    ready() { tone(520, 0, .12, "sine", .14); tone(740, .16, .16, "sine", .14); },
    tick() { tone(900, 0, .07, "square", .09); },
    win() { tone(660, 0, .1, "triangle", .15); tone(880, .12, .1, "triangle", .15); tone(1175, .24, .24, "triangle", .15); },
    draw() { tone(500, 0, .18, "triangle", .14); tone(500, .22, .18, "triangle", .14); },
    rep() { tone(1000, 0, .055, "sine", .08); }
  };
})();

(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const state = {
    mode: "stopwatch", phase: "ready", running: false,
    duration: 180, repsDuration: 300, breakDuration: 15, roundMode: "single", rounds: 5,
    round: 1, reps: 0, startAt: 0, deadline: 0, elapsedMs: 0, tickTimer: null,
    last: null, best: null, session: { stopwatch: {last:null,best:null}, race:{last:null,best:null}, countdown:{last:null,best:null}, reps:{last:null,best:null} },
    racePresses: [], raceTimeout: null, lastSecond: null, resetDebounceAt: 0
  };

  const fmt = (seconds, hundredths = false) => {
    seconds = Math.max(0, seconds);
    const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60);
    if (hundredths) return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${String(Math.floor((seconds % 1) * 100)).padStart(2,"0")}`;
    return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  };
  const modeName = () => ({stopwatch:"STOPPUHR",race:"RACE",countdown:"COUNTDOWN",reps:"REPS COUNTER"})[state.mode];
  const stats = () => state.session[state.mode];
  function toast(message) {
    const el = $("toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2800);
  }
  function renderSetup() {
    $("modeSelect").value = state.mode;
    $("countdownSettings").classList.toggle("hidden", state.mode !== "countdown");
    $("repsSettings").classList.toggle("hidden", state.mode !== "reps");
    $("roundMode").value = state.roundMode;
    $("loopSettings").classList.toggle("hidden", state.roundMode !== "loop" || state.mode !== "countdown");
    $("durationDisplay").textContent = fmt(state.duration);
    $("repsDurationDisplay").textContent = fmt(state.repsDuration);
    $("breakDisplay").textContent = fmt(state.breakDuration);
    $("roundsDisplay").textContent = state.rounds;
    updateStats();
  }
  function updateStats() {
    const s = stats();
    const formatResult = val => val == null ? "—" : (state.mode === "reps" ? `${val} REPS` : fmt(val / 1000, true));
    $("setupLast").textContent = formatResult(s.last);
    $("setupBest").textContent = formatResult(s.best);
  }
  function setStatus(text) { $("trainingStatus").textContent = text; }
  function setTime(text) { $("heroTime").textContent = text; }
  function setSecondary(text) { $("secondaryReadout").textContent = text; }
  function setWinner(text) { $("winnerReadout").textContent = text; }
  function setActions(actions) {
    const area = $("actionArea"); area.replaceChildren();
    actions.forEach(a => {
      const b = document.createElement("button");
      b.className = `action-button ${a.className || ""}`.trim();
      b.textContent = a.label; b.addEventListener("click", a.onClick);
      area.appendChild(b);
    });
  }
  function showTraining() {
    $("setupView").classList.add("hidden");
    $("trainingView").classList.remove("hidden");
    document.body.classList.add("training");
    $("resetButton").classList.add("hidden");
    $("resultStats").replaceChildren();
  }
  function showSetup() {
    stopTick();
    state.running = false;
    $("trainingView").classList.add("hidden");
    $("setupView").classList.remove("hidden");
    document.body.classList.remove("training");
    renderSetup();
  }
  function stopTick() { if (state.tickTimer) clearInterval(state.tickTimer); state.tickTimer = null; }
  function setResultStats(last, best, reps = false) {
    const el = $("resultStats"); el.replaceChildren();
    const add = (label, value) => {
      const span = document.createElement("span"); span.append(`${label} `);
      const strong = document.createElement("strong"); strong.textContent = value;
      span.appendChild(strong); el.appendChild(span);
    };
    const format = v => v == null ? "—" : reps ? String(v) : fmt(v / 1000, true);
    add("LAST", format(last)); add("BEST", format(best));
  }
  function finishToSetup() { showSetup(); }
  function activateResetButton(show) { $("resetButton").classList.toggle("hidden", !show); }
  function resetToSetup() {
    stopTick(); state.running = false; state.phase = "ready";
    if (state.raceTimeout) clearTimeout(state.raceTimeout);
    state.raceTimeout = null; state.racePresses = [];
    TimerSounds.ready(); showSetup();
  }
  function startCurrent() {
    state.mode = $("modeSelect").value;
    if (state.mode === "stopwatch") startStopwatch();
    else if (state.mode === "race") startRace();
    else if (state.mode === "countdown") startCountdown();
    else startReps();
  }

  // Stopwatch
  function startStopwatch() {
    if (state.phase === "running") return;
    state.phase = "running"; state.running = true; state.startAt = performance.now();
    state.elapsedMs = 0; state.lastSecond = null;
    showTraining(); setStatus("STOPPUHR"); setTime("00:00.00"); setSecondary(""); setWinner("");
    setActions([{label:"STOP", onClick: stopStopwatch}]);
    TimerSounds.go();
    state.tickTimer = setInterval(() => {
      state.elapsedMs = performance.now() - state.startAt;
      setTime(fmt(state.elapsedMs / 1000, true));
    }, 16);
  }
  function stopStopwatch() {
    if (state.phase !== "running") return;
    state.elapsedMs = performance.now() - state.startAt;
    stopTick(); state.phase = "result"; state.running = false;
    const s = state.session.stopwatch; s.last = Math.round(state.elapsedMs);
    if (s.best == null || s.last < s.best) s.best = s.last;
    setTime(fmt(s.last / 1000, true)); setStatus("ERGEBNIS"); setSecondary(""); setWinner("");
    setActions([{label:"GO", onClick: startStopwatch}]);
    setResultStats(s.last, s.best); TimerSounds.stop(); updateStats();
  }

  // Race: both press timestamps are evaluated within a 50 ms event-arrival window.
  function startRace() {
    if (state.phase === "running") return;
    state.phase = "running"; state.running = true; state.startAt = performance.now();
    state.elapsedMs = 0; state.racePresses = []; state.lastSecond = null;
    if (state.raceTimeout) clearTimeout(state.raceTimeout);
    showTraining(); setStatus("RACE"); setTime("00:00.00"); setSecondary("WER DRÜCKT ZUERST?"); setWinner("");
    setActions([
      {label:"BUZZER 1", onClick:() => racePress(1, performance.now())},
      {label:"BUZZER 2", onClick:() => racePress(2, performance.now())}
    ]);
    TimerSounds.go();
    state.tickTimer = setInterval(() => setTime(fmt((performance.now() - state.startAt) / 1000, true)), 16);
  }
  function racePress(index, at) {
    if (state.phase !== "running") return;
    if (state.racePresses.some(p => p.index === index)) return;
    state.racePresses.push({index, at, elapsed: Math.max(0, at - state.startAt)});
    if (state.racePresses.length === 1) {
      state.raceTimeout = setTimeout(() => resolveRace(), 50);
    } else {
      const delta = Math.abs(state.racePresses[0].at - state.racePresses[1].at);
      if (delta <= 50) resolveRace();
      else resolveRace();
    }
  }
  function resolveRace() {
    if (state.phase !== "running" || !state.racePresses.length) return;
    stopTick(); if (state.raceTimeout) clearTimeout(state.raceTimeout);
    state.raceTimeout = null; state.phase = "result"; state.running = false;
    const sorted = [...state.racePresses].sort((a,b) => a.at - b.at);
    const draw = sorted.length > 1 && Math.abs(sorted[0].at - sorted[1].at) <= 50;
    const elapsed = Math.round(sorted[0].elapsed);
    const s = state.session.race; s.last = elapsed;
    if (s.best == null || elapsed < s.best) s.best = elapsed;
    setTime(fmt(elapsed / 1000, true)); setStatus("RACE ENDE");
    setWinner(draw ? "DRAW" : `BUZZER ${sorted[0].index} WINS`);
    setSecondary(""); setActions([{label:"GO", onClick:startRace}]);
    setResultStats(s.last, s.best); draw ? TimerSounds.draw() : TimerSounds.win(); updateStats();
  }

  // Countdown single round / loop.
  function startCountdown() {
    if (state.phase === "running" || state.phase === "break") return;
    state.roundMode = $("roundMode").value;
    state.round = 1; state.phase = "running"; state.running = true;
    showTraining(); activateResetButton(state.roundMode === "loop");
    beginRound();
  }
  function beginRound() {
    state.phase = "running"; state.running = true;
    state.startAt = performance.now(); state.deadline = state.startAt + state.duration * 1000;
    state.lastSecond = null;
    setStatus(state.roundMode === "loop" ? `ROUND ${state.round}` : "GO");
    setTime(fmt(state.duration)); setSecondary(""); setWinner("");
    setActions([{label:"RESET", className:"danger-action", onClick:resetToSetup}]);
    TimerSounds.go();
    stopTick();
    state.tickTimer = setInterval(() => updateCountdown(), 40);
    updateCountdown();
  }
  function updateCountdown() {
    if (state.phase !== "running" && state.phase !== "break") return;
    const remaining = Math.max(0, (state.deadline - performance.now()) / 1000);
    setTime(fmt(remaining));
    const sec = Math.ceil(remaining);
    if (remaining <= 5 && remaining > 0 && sec !== state.lastSecond) {
      state.lastSecond = sec; TimerSounds.tick();
    }
    if (remaining <= 0) {
      if (state.phase === "running") roundFinished();
      else breakFinished();
    }
  }
  function roundFinished() {
    stopTick();
    if (state.roundMode === "loop" && state.round < state.rounds) {
      state.phase = "break"; state.startAt = performance.now();
      state.deadline = state.startAt + state.breakDuration * 1000; state.lastSecond = null;
      setStatus("BREAK"); setTime(fmt(state.breakDuration)); setSecondary(`NEXT ROUND: ${state.round + 1}`); setWinner("");
      setActions([]); TimerSounds.stop();
      if (state.breakDuration <= 0) breakFinished();
      else { state.tickTimer = setInterval(() => updateCountdown(), 40); }
    } else {
      state.phase = "result"; state.running = false;
      const s = state.session.countdown; s.last = state.duration * 1000;
      if (s.best == null || s.last > s.best) s.best = s.last;
      setStatus("ENDE"); setTime("00:00"); setSecondary(state.roundMode === "loop" ? `${state.rounds} RUNDEN ABGESCHLOSSEN` : "RUNDE ABGESCHLOSSEN");
      setActions([{label:"GO", onClick:startCountdown}]); setResultStats(s.last, s.best); TimerSounds.stop(); updateStats();
    }
  }
  function breakFinished() {
    stopTick(); state.round += 1; beginRound();
  }

  // Reps counter. Buzzer input increments only while running; reset is screen-only.
  function startReps() {
    if (state.phase === "running") return;
    state.phase = "running"; state.running = true; state.reps = 0;
    state.startAt = performance.now(); state.deadline = state.startAt + state.repsDuration * 1000; state.lastSecond = null;
    showTraining(); activateResetButton(true);
    setStatus("REPS COUNTER"); setTime(fmt(state.repsDuration)); setSecondary("REPS: 0"); setWinner("");
    setActions([{label:"+1 REP", onClick:addRep}]);
    TimerSounds.go(); stopTick();
    state.tickTimer = setInterval(() => updateRepsCountdown(), 40);
  }
  function addRep() {
    if (state.phase !== "running") return;
    state.reps += 1; setSecondary(`REPS: ${state.reps}`); TimerSounds.rep();
  }
  function updateRepsCountdown() {
    if (state.phase !== "running") return;
    const remaining = Math.max(0, (state.deadline - performance.now()) / 1000);
    setTime(fmt(remaining));
    const sec = Math.ceil(remaining);
    if (remaining <= 5 && remaining > 0 && sec !== state.lastSecond) { state.lastSecond = sec; TimerSounds.tick(); }
    if (remaining <= 0) finishReps();
  }
  function finishReps() {
    stopTick(); state.phase = "result"; state.running = false;
    const s = state.session.reps; s.last = state.reps;
    if (s.best == null || s.last > s.best) s.best = s.last;
    setStatus("ERGEBNIS"); setTime(`${state.reps}`); setSecondary("REPS"); setWinner("");
    setActions([{label:"START", onClick:startReps}]);
    setResultStats(s.last, s.best, true); activateResetButton(false); TimerSounds.stop(); updateStats();
  }

  // Buzzer mapping per mode.
  function onBuzzer(index, timestamp) {
    // Debounce the same physical buzzer at application level.
    if (timestamp - state.resetDebounceAt < 80 && state.lastInputIndex === index) return;
    state.lastInputIndex = index; state.resetDebounceAt = timestamp;
    if (state.phase === "ready") {
      startCurrent(); return;
    }
    if (state.mode === "stopwatch" && state.phase === "running") stopStopwatch();
    else if (state.mode === "race" && state.phase === "running") racePress(index, timestamp);
    else if (state.mode === "reps" && state.phase === "running") addRep();
    else if (state.mode === "countdown" && state.phase === "running" && state.roundMode === "loop") resetToSetup();
    // In result states, a buzzer starts the next attempt.
    else if (state.phase === "result") {
      if (state.mode === "stopwatch") startStopwatch();
      else if (state.mode === "race") startRace();
      else if (state.mode === "countdown") startCountdown();
      else if (state.mode === "reps") startReps();
    }
  }

  // Controls and settings
  $("modeSelect").addEventListener("change", () => { state.mode = $("modeSelect").value; renderSetup(); });
  $("roundMode").addEventListener("change", () => { state.roundMode = $("roundMode").value; renderSetup(); });
  document.querySelectorAll("[data-target][data-delta]").forEach(button => button.addEventListener("click", () => {
    const target = button.dataset.target, delta = Number(button.dataset.delta);
    const key = target === "duration" ? "duration" : target === "break" ? "breakDuration" : "repsDuration";
    const min = target === "break" ? 0 : 1;
    state[key] = Math.max(min, Math.min(5999, state[key] + delta));
    renderSetup();
  }));
  $("roundMinus").addEventListener("click", () => { state.rounds = Math.max(1, state.rounds - 1); renderSetup(); });
  $("roundPlus").addEventListener("click", () => { state.rounds = Math.min(99, state.rounds + 1); renderSetup(); });
  $("startButton").addEventListener("click", startCurrent);
  $("settingsToggle").addEventListener("click", () => showSetup());
  $("backToSetup").addEventListener("click", () => {
    if (state.phase === "running" || state.phase === "break") {
      if (!confirm("Laufende Übung abbrechen und zur Konfiguration zurückkehren?")) return;
      resetToSetup();
    } else showSetup();
  });
  $("resetButton").addEventListener("click", resetToSetup);
  $("clearSession").addEventListener("click", () => {
    if (!confirm("Alle Ergebnisse dieser Session zurücksetzen?")) return;
    Object.keys(state.session).forEach(k => state.session[k] = {last:null,best:null});
    renderSetup(); toast("Session-Ergebnisse zurückgesetzt.");
  });

  // BLE UI
  function updateBleUi(index, message, connected) {
    $(`device${index}Status`).textContent = message;
    $(`device${index}Status`).classList.toggle("connected", !!connected);
    $(`connect${index}`).disabled = !!connected;
    $(`disconnect${index}`).disabled = !connected;
    $("bleMessage").textContent = connected ? `Buzzer ${index} verbunden.` : message;
  }
  $("bluetoothSupport").textContent = TimerBluetooth.isSupported() ? "Web Bluetooth verfügbar" : "Web Bluetooth nicht verfügbar";
  if (!TimerBluetooth.isSupported()) {
    $("bleMessage").textContent = "Bitte Chrome oder Edge auf Android/Desktop und eine sichere Verbindung (HTTPS oder localhost) verwenden.";
    $("connect1").disabled = $("connect2").disabled = true;
  }
  [1,2].forEach(index => {
    $(`connect${index}`).addEventListener("click", async () => {
      try { await TimerBluetooth.connect(index); toast(`Buzzer ${index} verbunden.`); }
      catch (e) { updateBleUi(index, "Nicht verbunden", false); toast(e.message || "Bluetooth-Verbindung fehlgeschlagen."); }
    });
    $(`disconnect${index}`).addEventListener("click", async () => {
      await TimerBluetooth.disconnect(index); toast(`Buzzer ${index} getrennt.`);
    });
  });
  TimerBluetooth.setHandlers(onBuzzer, updateBleUi);

  // Start a training session from the ready screen; first interaction unlocks Web Audio.
  state.phase = "ready"; renderSetup();
})();

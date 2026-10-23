// ===================================================================
// Audio  (Web Audio, synthesized; unlocked on the first pointer event)
// ===================================================================
const Audio = (() => {
  let ctx = null, master = null, noiseBuf = null, muted = false;
  let sfxOut = null, musicOut = null;   // per-kind volume buses, both feeding master
  // Player settings, saved under kk-audio. Music defaults a little lower than
  // the effects, since it plays continuously and effects are short events.
  const settings = { sfxOn: true, sfxVol: 1, musicOn: true, musicVol: 0.6 };
  try {
    const saved = JSON.parse(localStorage.getItem('kk-audio') || 'null');
    if (saved && typeof saved === 'object') {
      if (typeof saved.sfxOn === 'boolean') settings.sfxOn = saved.sfxOn;
      if (typeof saved.musicOn === 'boolean') settings.musicOn = saved.musicOn;
      if (Number.isFinite(saved.sfxVol)) settings.sfxVol = Math.max(0, Math.min(1, saved.sfxVol));
      if (Number.isFinite(saved.musicVol)) settings.musicVol = Math.max(0, Math.min(1, saved.musicVol));
    }
  } catch (e) { /* storage may be blocked or hold junk: keep the defaults */ }
  function saveSettings() { try { localStorage.setItem('kk-audio', JSON.stringify(settings)); } catch (e) { /* ignore */ } }
  function applySettings() {
    if (!ctx || !sfxOut || rendering) return;
    sfxOut.gain.setTargetAtTime(settings.sfxOn ? settings.sfxVol : 0, ctx.currentTime, 0.03);
    musicOut.gain.setTargetAtTime(settings.musicOn ? settings.musicVol : 0, ctx.currentTime, 0.05);
  }
  let baseDelay = 0, rendering = false;
  const recent = [];      // start times of recent voices, for crowd ducking
  const lastAt = {};      // per-key rate limiting
  const amb = { wind: null, windGain: null, drone: null, droneGain: null, birdTimer: 0 };

  function buildGraph(c) {
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 18; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.18;
    master = c.createGain();
    master.connect(comp); comp.connect(c.destination);
    sfxOut = c.createGain(); musicOut = c.createGain();
    sfxOut.connect(master); musicOut.connect(master);
    const len = Math.floor(c.sampleRate * 2), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseBuf = buf;
  }

  function unlock() {
    // iPhones mute web audio while the ring/silent switch is on silent;
    // iOS 17+ lets a page ask to play like media instead
    try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch (e) { /* not supported */ }
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      buildGraph(ctx);
      try { muted = localStorage.getItem('kk-muted') === '1'; } catch (e) { /* storage may be blocked */ }
      master.gain.value = muted ? 0 : 0.6;
      applySettings();
      startAmbience();
      startMusic();
    }
    // iOS reports 'interrupted' after a call or a trip to the home screen
    if (ctx.state !== 'running') { try { ctx.resume(); } catch (e) { /* retried on the next tap */ } }
  }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('kk-muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.6, ctx.currentTime, 0.02);
    return muted;
  }
  function isMuted() { return muted; }

  // Crowd ducking: many voices inside 120ms get quieter, so a volley of
  // twenty javelin hits is a patter and not a wall.
  function duck(t0) {
    if (rendering) return 1;
    while (recent.length && recent[0] < t0 - 0.12) recent.shift();
    recent.push(t0);
    return 1 / Math.sqrt(1 + recent.length * 0.45);
  }
  function limited(key, minGap) {
    if (rendering || !key) return false;
    const now = ctx.currentTime;
    if (lastAt[key] && now - lastAt[key] < minGap) return true;
    lastAt[key] = now;
    return false;
  }

  // One tonal voice: oscillator -> lowpass -> gain envelope. Slight random
  // detune keeps repeats from sounding stamped out.
  function voice({ type = 'sine', freq = 440, to = null, dur = 0.15, vol = 0.4, cutoff = 2400, delay = 0, attack = 0.008, jitter = 0.04, key = null, gap = 0.05 }) {
    if (!ctx || (!settings.sfxOn && !rendering) || limited(key, gap)) return;
    const t0 = ctx.currentTime + baseDelay + delay;
    const j = 1 + (Math.random() * 2 - 1) * jitter;
    const osc = ctx.createOscillator(), filt = ctx.createBiquadFilter(), g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq * j, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to * j), t0 + dur);
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(cutoff, t0);
    filt.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff * 0.3), t0 + dur);
    const v = vol * duck(t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(filt); filt.connect(g); g.connect(sfxOut);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }
  // A shaped noise burst: bandpass or lowpass noise with an envelope. Puffs,
  // thumps, whooshes and clicks all live here.
  function noise({ dur = 0.1, vol = 0.3, freq = 1200, to = null, q = 0.8, filter = 'bandpass', delay = 0, attack = 0.004, key = null, gap = 0.05 }) {
    if (!ctx || limited(key, gap)) return;
    const t0 = ctx.currentTime + baseDelay + delay;
    const src = ctx.createBufferSource(), filt = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    filt.type = filter; filt.Q.value = q;
    filt.frequency.setValueAtTime(freq, t0);
    if (to) filt.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const v = vol * duck(t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt); filt.connect(g); g.connect(sfxOut);
    src.start(t0, Math.random() * 1.5); src.stop(t0 + dur + 0.03);
  }

  // Ambience: a soft wind bed always, birds between waves, a low drone
  // that swells while a wave is on the road.
  function startAmbience() {
    const wind = ctx.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 320;
    const wg = ctx.createGain(); wg.gain.value = 0.0;
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 0.09; lg.gain.value = 0.02; lfo.connect(lg); lg.connect(wg.gain);
    wind.connect(wf); wf.connect(wg); wg.connect(sfxOut);
    wind.start(); lfo.start();
    wg.gain.setTargetAtTime(0.045, ctx.currentTime, 2);
    const drone = ctx.createOscillator(); drone.type = 'triangle'; drone.frequency.value = 55;
    const d2 = ctx.createOscillator(); d2.type = 'sine'; d2.frequency.value = 82.5;
    const dg = ctx.createGain(); dg.gain.value = 0;
    drone.connect(dg); d2.connect(dg); dg.connect(sfxOut);
    drone.start(); d2.start();
    amb.windGain = wg; amb.droneGain = dg; amb.birdTimer = 2 + Math.random() * 3;
  }
  function bird() {
    const base = 1900 + Math.random() * 900, n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      voice({ type: 'sine', freq: base, to: base * 1.35, dur: 0.07, vol: 0.05, cutoff: 6000, delay: i * 0.11, jitter: 0.08 });
      voice({ type: 'sine', freq: base * 1.3, to: base * 0.95, dur: 0.06, vol: 0.04, cutoff: 6000, delay: i * 0.11 + 0.06, jitter: 0.08 });
    }
  }
  function update(dt) {
    if (!ctx || muted || rendering) return;
    const s = GameState.state;
    const tense = s.phase === 'playing' && s.waveActive;
    amb.droneGain.gain.setTargetAtTime(tense ? 0.035 + Math.min(0.03, s.enemies.length * 0.003) : 0, ctx.currentTime, 1.2);
    amb.birdTimer -= dt;
    if (amb.birdTimer <= 0) {
      amb.birdTimer = 2.5 + Math.random() * 5;
      if (!tense && s.phase !== 'lost') bird();
    }
  }

  const sfx = {
    // ---- interface ----
    select() {
      voice({ type: 'triangle', freq: 520, to: 640, dur: 0.09, vol: 0.3, cutoff: 3200 });
      voice({ type: 'sine', freq: 780, to: 1040, dur: 0.14, vol: 0.24, cutoff: 3600, delay: 0.06 });
      noise({ dur: 0.03, vol: 0.12, freq: 3000, q: 1.5 });
    },
    reject() {
      voice({ type: 'triangle', freq: 190, to: 120, dur: 0.16, vol: 0.38, cutoff: 900 });
      voice({ type: 'square', freq: 140, to: 95, dur: 0.12, vol: 0.1, cutoff: 500, delay: 0.09 });
      noise({ dur: 0.08, vol: 0.14, freq: 500, filter: 'lowpass' });
    },
    place() {    // a stone thud on the dais, two quick mallet taps, then a bright "ta-da"
      noise({ dur: 0.14, vol: 0.4, freq: 320, filter: 'lowpass' });
      voice({ type: 'triangle', freq: 150, to: 80, dur: 0.14, vol: 0.45, cutoff: 700 });
      [0.1, 0.19].forEach((d) => { voice({ type: 'square', freq: 1500, to: 1300, dur: 0.03, vol: 0.08, cutoff: 5000, delay: d }); noise({ dur: 0.03, vol: 0.12, freq: 3500, q: 3, delay: d }); });
      voice({ type: 'triangle', freq: 523, to: 523, dur: 0.1, vol: 0.18, cutoff: 3000, delay: 0.3, jitter: 0 });
      voice({ type: 'triangle', freq: 784, to: 784, dur: 0.2, vol: 0.18, cutoff: 3000, delay: 0.4, jitter: 0 });
    },
    upgrade() {
      [523, 659, 784].forEach((f, i) => voice({ type: 'triangle', freq: f, to: f, dur: 0.14, vol: 0.2, cutoff: 3200, delay: i * 0.09, jitter: 0 }));
      voice({ type: 'sine', freq: 1568, to: 2093, dur: 0.25, vol: 0.14, cutoff: 6000, delay: 0.28, jitter: 0 });
      noise({ dur: 0.3, vol: 0.08, freq: 6000, q: 0.5, delay: 0.26 });
    },
    specialize() {   // a bigger moment than a plain upgrade: a rising fanfare and a sparkle tail
      [392, 523, 659, 784, 1047].forEach((f, i) => voice({ type: 'triangle', freq: f, to: f, dur: 0.16, vol: 0.2, cutoff: 3400, delay: i * 0.07, jitter: 0 }));
      voice({ type: 'sawtooth', freq: 196, to: 262, dur: 0.4, vol: 0.12, cutoff: 1400, delay: 0.02, jitter: 0 });
      [1568, 2093, 2637].forEach((f, i) => voice({ type: 'sine', freq: f, to: f * 1.06, dur: 0.22, vol: 0.1, cutoff: 7000, delay: 0.38 + i * 0.07, jitter: 0 }));
      noise({ dur: 0.45, vol: 0.08, freq: 7000, q: 0.5, delay: 0.36 });
    },
    sell() {
      [1318, 1568, 1046, 1760].forEach((f, i) => voice({ type: 'sine', freq: f, to: f, dur: 0.08, vol: 0.14, cutoff: 5000, delay: i * 0.06, jitter: 0.01 }));
      noise({ dur: 0.1, vol: 0.12, freq: 4500, q: 2 });
    },
    gameStart() {   // a proper horn fanfare from the walls
      [262, 262, 330, 392].forEach((f, i) => voice({ type: 'sawtooth', freq: f, to: f, dur: i === 3 ? 0.7 : 0.18, vol: 0.22, cutoff: 1700, delay: i * 0.2, jitter: 0.005 }));
      voice({ type: 'sawtooth', freq: 196, to: 196, dur: 0.7, vol: 0.14, cutoff: 1200, delay: 0.6, jitter: 0.005 });
      voice({ type: 'sine', freq: 784, to: 784, dur: 0.5, vol: 0.1, cutoff: 4000, delay: 0.65, jitter: 0 });
    },
    waveStart() {   // a little horn call
      voice({ type: 'sawtooth', freq: 262, to: 262, dur: 0.22, vol: 0.2, cutoff: 1600, jitter: 0.005 });
      voice({ type: 'sawtooth', freq: 262, to: 262, dur: 0.18, vol: 0.18, cutoff: 1600, delay: 0.24, jitter: 0.005 });
      voice({ type: 'sawtooth', freq: 392, to: 392, dur: 0.45, vol: 0.22, cutoff: 1800, delay: 0.44, jitter: 0.005 });
    },
    waveEnd() {
      [523, 659, 784].forEach((f, i) => voice({ type: 'sine', freq: f, to: f, dur: i === 2 ? 0.3 : 0.14, vol: 0.24, cutoff: 3000, delay: i * 0.12, jitter: 0 }));
    },
    bonus() {
      [784, 988, 1175].forEach((f, i) => voice({ type: 'sine', freq: f, to: f, dur: 0.16, vol: 0.18, cutoff: 4000, delay: i * 0.08, jitter: 0 }));
    },
    tick() {     // the last seconds before a wave auto-starts
      voice({ type: 'sine', freq: 880, to: 880, dur: 0.06, vol: 0.16, cutoff: 4000, jitter: 0 });
      noise({ dur: 0.02, vol: 0.08, freq: 4000, q: 2 });
    },
    tickLast() {
      voice({ type: 'sine', freq: 1320, to: 1320, dur: 0.12, vol: 0.2, cutoff: 5000, jitter: 0 });
    },
    win() {      // a brass fanfare with a sparkle tail over a warm chord
      [523, 659, 784, 1047].forEach((f, i) => voice({ type: 'triangle', freq: f, to: f, dur: i === 3 ? 1.1 : 0.2, vol: 0.28, cutoff: 3200, delay: i * 0.15, jitter: 0 }));
      [262, 392, 523].forEach((f, i) => voice({ type: 'sawtooth', freq: f, to: f, dur: 1.1, vol: 0.09, cutoff: 1300, delay: 0.45 + i * 0.03, jitter: 0.004 }));
      [1568, 1976, 2349, 2637, 3136].forEach((f, i) => voice({ type: 'sine', freq: f, to: f, dur: 0.28, vol: 0.09, cutoff: 6000, delay: 0.7 + i * 0.07, jitter: 0 }));
      noise({ dur: 0.8, vol: 0.1, freq: 7000, q: 0.5, delay: 0.5 });
    },
    star(i = 0) {   // a bell for each star as it lands, rising with every one
      const f = [784, 988, 1319][i % 3];
      voice({ type: 'sine', freq: f, to: f, dur: 0.7, vol: 0.26, cutoff: 5000, jitter: 0 });
      voice({ type: 'triangle', freq: f * 2, to: f * 2, dur: 0.4, vol: 0.1, cutoff: 6000, jitter: 0 });
      voice({ type: 'sine', freq: f * 3, to: f * 3, dur: 0.18, vol: 0.05, cutoff: 7000, delay: 0.02, jitter: 0 });
      noise({ dur: 0.1, vol: 0.07, freq: 6500, q: 1.5 });
    },
    firework() {    // a rising whistle, a boom and a crackle
      voice({ type: 'sine', freq: 520 + Math.random() * 200, to: 1700, dur: 0.28, vol: 0.07, cutoff: 5000, key: 'firework', gap: 0.12, jitter: 0 });
      noise({ dur: 0.55, vol: 0.2, freq: 2600, to: 500, q: 0.6, delay: 0.28 });
      voice({ type: 'triangle', freq: 130, to: 55, dur: 0.35, vol: 0.2, cutoff: 500, delay: 0.28, jitter: 0 });
      for (let i = 0; i < 5; i++) noise({ dur: 0.03, vol: 0.09, freq: 4500 + Math.random() * 2500, q: 2, delay: 0.5 + i * 0.07 + Math.random() * 0.05 });
    },
    finale() {   // the campaign is won: two rising phrases, a held chord and a bell run
      const phrase = (notes, t0, last) => notes.forEach((f, i) => voice({ type: 'triangle', freq: f, to: f, dur: i === notes.length - 1 ? last : 0.2, vol: 0.28, cutoff: 3400, delay: t0 + i * 0.17, jitter: 0 }));
      phrase([392, 523, 659, 784], 0, 0.6);
      phrase([523, 659, 784, 1047, 1319], 1.1, 1.6);
      [[262, 330, 392], [330, 392, 523], [392, 523, 659]].forEach((ch, k) => ch.forEach((f) => voice({ type: 'sawtooth', freq: f, to: f, dur: k === 2 ? 2.4 : 1.0, vol: 0.075, cutoff: 1400, delay: k === 2 ? 2.0 : k * 1.1 + 0.4, jitter: 0.004 })));
      [1319, 1568, 1976, 2349, 2637, 3136, 2637, 3136, 3951].forEach((f, i) => voice({ type: 'sine', freq: f, to: f, dur: 0.45, vol: 0.09, cutoff: 7000, delay: 2.2 + i * 0.13, jitter: 0 }));
      noise({ dur: 1.6, vol: 0.12, freq: 7000, q: 0.5, delay: 1.9 });
      voice({ type: 'triangle', freq: 98, to: 98, dur: 2.6, vol: 0.2, cutoff: 400, delay: 2.0, jitter: 0 });
    },
    lose() {
      [330, 311, 294, 220].forEach((f, i) => voice({ type: 'sawtooth', freq: f, to: f * 0.97, dur: i === 3 ? 1.0 : 0.3, vol: 0.18, cutoff: 1100, delay: i * 0.28, jitter: 0.005 }));
      noise({ dur: 1.2, vol: 0.12, freq: 200, filter: 'lowpass', delay: 0.8 });
    },
    // ---- enemies arriving ----
    spawn() {    // a gruff little brigand "oi-oi!"
      voice({ type: 'sawtooth', freq: 170, to: 240, dur: 0.1, vol: 0.12, cutoff: 900, key: 'spawn', gap: 0.08 });
      voice({ type: 'sawtooth', freq: 230, to: 180, dur: 0.13, vol: 0.11, cutoff: 900, delay: 0.13 });
      noise({ dur: 0.06, vol: 0.05, freq: 700, q: 1, delay: 0.02 });
    },
    trickster() {   // a quick snicker
      [700, 880, 760, 990].forEach((f, i) => voice({ type: 'square', freq: f, to: f * 1.1, dur: 0.05, vol: 0.11, cutoff: 2500, delay: i * 0.06, jitter: 0.08 }));
    },
    troll() {    // a black knight on the march: two clanking steps of plate and a low grunt
      [0, 0.32].forEach((d) => {
        noise({ dur: 0.07, vol: 0.2, freq: 3200, q: 4, delay: d, key: d ? null : 'troll', gap: 0.2 });
        voice({ type: 'triangle', freq: 70, to: 45, dur: 0.18, vol: 0.32, cutoff: 400, delay: d });
      });
      voice({ type: 'sawtooth', freq: 110, to: 80, dur: 0.3, vol: 0.14, cutoff: 500, delay: 0.12 });
    },
    bat() {      // a gargoyle: a grind of stone, a screech and a flap
      noise({ dur: 0.12, vol: 0.14, freq: 260, filter: 'lowpass', key: 'bat', gap: 0.1 });
      voice({ type: 'square', freq: 1100, to: 1500, dur: 0.08, vol: 0.08, cutoff: 3000, delay: 0.08 });
      [0.1, 0.18].forEach((d) => noise({ dur: 0.05, vol: 0.12, freq: 1800, q: 1.2, delay: d }));
    },
    bossArrive(type) {   // a dark chord and a rumble, then each boss's own voice
      [110, 131, 165].forEach((f) => voice({ type: 'sawtooth', freq: f, to: f * 0.98, dur: 1.4, vol: 0.14, cutoff: 700, jitter: 0.005 }));
      noise({ dur: 1.4, vol: 0.18, freq: 150, filter: 'lowpass' });
      if (type === 'ram') {
        // war drums: three heavy beats and a creak of timber
        [0.4, 0.75, 1.1].forEach((d) => { voice({ type: 'triangle', freq: 70, to: 40, dur: 0.25, vol: 0.5, cutoff: 400, delay: d }); noise({ dur: 0.12, vol: 0.3, freq: 300, filter: 'lowpass', delay: d }); });
        voice({ type: 'square', freq: 180, to: 140, dur: 0.4, vol: 0.06, cutoff: 700, delay: 1.3 });
      } else if (type === 'siegetower') {
        // timber groaning and iron-bound wheels grinding
        voice({ type: 'square', freq: 150, to: 110, dur: 0.6, vol: 0.06, cutoff: 600, delay: 0.35 });
        voice({ type: 'square', freq: 130, to: 170, dur: 0.5, vol: 0.05, cutoff: 600, delay: 0.95 });
        noise({ dur: 1.0, vol: 0.2, freq: 260, filter: 'lowpass', delay: 0.4 });
      } else if (type === 'giant') {
        // three ground-shaking footsteps and a bellow
        [0.35, 0.8, 1.25].forEach((d) => { voice({ type: 'sine', freq: 60, to: 32, dur: 0.35, vol: 0.55, cutoff: 300, delay: d }); noise({ dur: 0.15, vol: 0.3, freq: 200, filter: 'lowpass', delay: d }); });
        voice({ type: 'sawtooth', freq: 130, to: 90, dur: 0.9, vol: 0.18, cutoff: 700, delay: 1.5 });
      } else if (type === 'baron') {
        // a war-horn call over galloping hooves
        voice({ type: 'sawtooth', freq: 196, to: 196, dur: 0.5, vol: 0.14, cutoff: 1400, delay: 0.3 });
        voice({ type: 'sawtooth', freq: 262, to: 262, dur: 0.9, vol: 0.14, cutoff: 1400, delay: 0.75 });
        for (let i = 0; i < 6; i++) noise({ dur: 0.05, vol: 0.18, freq: 500, q: 1.5, delay: 0.3 + i * 0.16 + (i % 2) * 0.05 });
      } else if (type === 'dragon' || type === 'wyvern') {
        // a long roar with a crackle of flame
        voice({ type: 'sawtooth', freq: 240, to: 85, dur: 1.1, vol: 0.22, cutoff: 1200, delay: 0.35 });
        voice({ type: 'sawtooth', freq: 180, to: 70, dur: 1.1, vol: 0.16, cutoff: 900, delay: 0.38 });
        noise({ dur: 0.9, vol: 0.22, freq: 900, to: 300, q: 0.6, delay: 0.45 });
      } else {
        // grinding stone and two rasping screeches
        noise({ dur: 0.5, vol: 0.2, freq: 220, filter: 'lowpass', delay: 0.3 });
        voice({ type: 'sawtooth', freq: 620, to: 380, dur: 0.3, vol: 0.14, cutoff: 1800, delay: 0.5 });
        voice({ type: 'sawtooth', freq: 560, to: 340, dur: 0.35, vol: 0.14, cutoff: 1800, delay: 0.85 });
      }
    },
    // ---- towers firing ----
    shoot() {    // a javelin: a grunt of effort and a quick whoosh
      noise({ dur: 0.1, vol: 0.2, freq: 2200, to: 900, q: 1, key: 'shoot', gap: 0.04 });
      voice({ type: 'triangle', freq: 260, to: 200, dur: 0.05, vol: 0.12, cutoff: 1400 });
      voice({ type: 'sine', freq: 700, to: 420, dur: 0.08, vol: 0.08, cutoff: 2400, delay: 0.02 });
    },
    shootWarden() {   // the pot leaves the ladle: a gloopy glug and a lobbing whoosh
      voice({ type: 'sine', freq: 320, to: 150, dur: 0.12, vol: 0.22, cutoff: 900, key: 'warden', gap: 0.08 });
      voice({ type: 'sine', freq: 260, to: 120, dur: 0.1, vol: 0.16, cutoff: 900, delay: 0.08 });
      noise({ dur: 0.22, vol: 0.18, freq: 1200, to: 300, q: 0.7, delay: 0.05 });
    },
    shootDruid() {    // a crystalline ting with a cold breath
      voice({ type: 'sine', freq: 1760, to: 2200, dur: 0.12, vol: 0.15, cutoff: 6000, key: 'druid', gap: 0.06 });
      voice({ type: 'sine', freq: 2637, to: 2500, dur: 0.2, vol: 0.07, cutoff: 6000, delay: 0.05 });
      noise({ dur: 0.12, vol: 0.08, freq: 5000, q: 0.6 });
    },
    shootGolem() {    // the hammer flies: a heavy whoosh and a ringing clang of steel
      noise({ dur: 0.2, vol: 0.3, freq: 600, to: 200, filter: 'lowpass', key: 'golem', gap: 0.1 });
      voice({ type: 'triangle', freq: 75, to: 40, dur: 0.3, vol: 0.45, cutoff: 500 });
      voice({ type: 'square', freq: 660, to: 640, dur: 0.05, vol: 0.08, cutoff: 3000, delay: 0.02 });
      voice({ type: 'sine', freq: 1320, to: 1300, dur: 0.4, vol: 0.06, cutoff: 5000, delay: 0.02 });
    },
    shootArtillery() {   // a longbow: a deep string twang, then a hiss of arrows overhead
      voice({ type: 'triangle', freq: 196, to: 180, dur: 0.16, vol: 0.4, cutoff: 1400, key: 'artillery', gap: 0.1 });
      voice({ type: 'sawtooth', freq: 392, to: 370, dur: 0.08, vol: 0.06, cutoff: 1800 });
      noise({ dur: 0.45, vol: 0.12, freq: 3200, to: 1800, q: 0.8, delay: 0.08 });
    },
    // ---- hits and effects ----
    hit() {      // a woody tok
      voice({ type: 'square', freq: 620, to: 300, dur: 0.05, vol: 0.13, cutoff: 1800, key: 'hit', gap: 0.04 });
      voice({ type: 'triangle', freq: 180, to: 120, dur: 0.07, vol: 0.18, cutoff: 900 });
      noise({ dur: 0.03, vol: 0.14, freq: 1800, q: 1 });
    },
    clink() {    // armor shrugging off a hit
      voice({ type: 'square', freq: 2400, to: 1800, dur: 0.04, vol: 0.12, cutoff: 6000, key: 'clink', gap: 0.05 });
      noise({ dur: 0.04, vol: 0.18, freq: 5200, q: 3 });
    },
    splash() {   // a soft wide thud for area hits
      noise({ dur: 0.26, vol: 0.28, freq: 600, to: 200, filter: 'lowpass', key: 'splash', gap: 0.08 });
      voice({ type: 'triangle', freq: 120, to: 70, dur: 0.2, vol: 0.3, cutoff: 700 });
    },
    chill() {    // frost taking hold, a tiny glass tinkle
      voice({ type: 'sine', freq: 3200, to: 3600, dur: 0.06, vol: 0.06, cutoff: 8000, key: 'chill', gap: 0.15 });
      voice({ type: 'sine', freq: 4100, to: 3900, dur: 0.09, vol: 0.05, cutoff: 8000, delay: 0.05 });
    },
    root() {     // stuck in pitch: a sticky splorch
      noise({ dur: 0.1, vol: 0.2, freq: 450, filter: 'lowpass', key: 'root', gap: 0.12 });
      voice({ type: 'sine', freq: 220, to: 90, dur: 0.14, vol: 0.2, cutoff: 700, delay: 0.02 });
    },
    death() {    // a surprised bwoop sliding down, then a soft pop
      voice({ type: 'square', freq: 520, to: 160, dur: 0.28, vol: 0.14, cutoff: 1500, key: 'death', gap: 0.06 });
      noise({ dur: 0.06, vol: 0.22, freq: 900, q: 0.8, delay: 0.24 });
      voice({ type: 'triangle', freq: 90, to: 60, dur: 0.12, vol: 0.28, cutoff: 700, delay: 0.24 });
    },
    bossDeath() {
      voice({ type: 'sawtooth', freq: 400, to: 60, dur: 0.9, vol: 0.3, cutoff: 1400 });
      noise({ dur: 0.9, vol: 0.3, freq: 300, to: 80, filter: 'lowpass' });
      voice({ type: 'triangle', freq: 80, to: 40, dur: 0.5, vol: 0.5, cutoff: 400, delay: 0.3 });
      [523, 659, 784, 1047].forEach((f, i) => voice({ type: 'triangle', freq: f, to: f, dur: 0.25, vol: 0.2, cutoff: 3000, delay: 0.9 + i * 0.12, jitter: 0 }));
    },
    gold() {     // two bright coin notes
      voice({ type: 'sine', freq: 1318, to: 1318, dur: 0.09, vol: 0.16, cutoff: 5000, delay: 0.28, jitter: 0.01, key: 'gold', gap: 0.08 });
      voice({ type: 'sine', freq: 1760, to: 1760, dur: 0.16, vol: 0.16, cutoff: 5000, delay: 0.36, jitter: 0.01 });
    },
    leak() {     // a bonk on the gate, a crunch and a sad two-note slide
      voice({ type: 'triangle', freq: 120, to: 55, dur: 0.28, vol: 0.5, cutoff: 600 });
      noise({ dur: 0.12, vol: 0.3, freq: 700, to: 200, filter: 'lowpass' });
      voice({ type: 'sawtooth', freq: 392, to: 370, dur: 0.16, vol: 0.13, cutoff: 1200, delay: 0.05 });
      voice({ type: 'sawtooth', freq: 311, to: 250, dur: 0.3, vol: 0.13, cutoff: 1000, delay: 0.22 });
    },
    crumble() {  // stone giving way
      noise({ dur: 0.7, vol: 0.34, freq: 260, to: 90, filter: 'lowpass' });
      voice({ type: 'sawtooth', freq: 90, to: 40, dur: 0.6, vol: 0.3, cutoff: 500 });
      voice({ type: 'square', freq: 300, to: 120, dur: 0.2, vol: 0.08, cutoff: 900, delay: 0.1 });
    },
  };

  // Offline render of every sound in a row, for listening outside the game.
  async function renderBoard() {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const names = Object.keys(sfx), step = 1.4, rate = 44100;
    const off = new OAC(1, Math.ceil(rate * (names.length * step + 1)), rate);
    const saved = { ctx, master, noiseBuf, sfxOut, musicOut };
    ctx = off; buildGraph(off); master.gain.value = 0.6; rendering = true;
    const marks = names.map((name, i) => { baseDelay = i * step; sfx[name](); return { name, at: i * step }; });
    baseDelay = 0;
    const buffer = await off.startRendering();
    rendering = false;
    ctx = saved.ctx; master = saved.master; noiseBuf = saved.noiseBuf; sfxOut = saved.sfxOut; musicOut = saved.musicOut;
    return { buffer, marks };
  }

  function init() {
    GameState.on('tileSelected', () => sfx.select());
    GameState.on('towerSelected', () => sfx.select());
    GameState.on('tileRejected', () => sfx.reject());
    GameState.on('placeRejected', () => sfx.reject());
    GameState.on('towerPlaced', () => sfx.place());
    GameState.on('towerUpgraded', (t) => (t.branch ? sfx.specialize() : sfx.upgrade()));
    GameState.on('towerSold', () => sfx.sell());
    GameState.on('gameStarted', () => sfx.gameStart());
    GameState.on('waveStarted', () => sfx.waveStart());
    GameState.on('waveEnded', () => { sfx.waveEnd(); sfx.bonus(); });
    GameState.on('earlyBonus', () => sfx.bonus());
    GameState.on('prepTick', (n) => (n === 1 ? sfx.tickLast() : sfx.tick()));
    GameState.on('enemySpawned', (e) => { if (e.boss) sfx.bossArrive(e.type); else if (e.flying) sfx.bat(); else if (e.type === 'troll') sfx.troll(); else if (e.type === 'trickster') sfx.trickster(); else sfx.spawn(); });
    const shootBy = { slinger: () => sfx.shoot(), warden: () => sfx.shootWarden(), druid: () => sfx.shootDruid(), golem: () => sfx.shootGolem(), artillery: () => sfx.shootArtillery() };
    GameState.on('towerFired', ({ tower }) => shootBy[tower.type]());
    GameState.on('projectileHit', ({ projectile }) => { if (projectile.splash > 0) sfx.splash(); });
    GameState.on('enemyHit', ({ armored }) => (armored ? sfx.clink() : sfx.hit()));
    GameState.on('enemyChilled', () => sfx.chill());
    GameState.on('enemyRooted', () => sfx.root());
    GameState.on('enemyKilled', (e) => { if (e.boss) sfx.bossDeath(); else sfx.death(); sfx.gold(); });
    GameState.on('enemyLeaked', () => sfx.leak());
    GameState.on('endpointStateChanged', () => sfx.crumble());
    GameState.on('gameWon', () => { if (LEVELS.some((l) => l.index === GameState.currentLevel().index + 1)) sfx.win(); else sfx.finale(); });
    GameState.on('gameLost', () => sfx.lose());
    GameState.on('paused', () => { if (ctx && ctx.state === 'running') ctx.suspend(); });
    GameState.on('resumed', () => { if (ctx && ctx.state === 'suspended') ctx.resume(); });
    GameState.on('speedChanged', () => sfx.select());
  }


  // ===================================================================
  // Music: layered, generative, synthesized. A pastoral pad and plucked arpeggio
  // while the player builds, then bass, war drums and a lead fade in when a wave
  // is live, and a faster, heavier mix for a boss. Five layers (pad, arp, bass,
  // drums, lead) crossfade with game state. Notes are scheduled on the audio
  // clock a short way ahead (never on the frame loop), each level has its own
  // key, and the melody is seeded so it repeats like a tune instead of wandering.
  // ===================================================================
  const MUSIC_KEYS = {
    'hollybrook':       { root: 38, minor: false },
    'ravensford':       { root: 43, minor: false },
    'st-wendels':       { root: 45, minor: true },
    'castle-aldermere': { root: 41, minor: false },
    'highcrag-pass':    { root: 40, minor: true },
    'wickham-fair':     { root: 45, minor: false },
    'saltmarsh-quay':   { root: 42, minor: true },
    'amberlea-vineyards': { root: 44, minor: false },
    'blackmoor-lines':  { root: 39, minor: true },
    'black-keep':       { root: 38, minor: true },
  };
  // chord = [semitones above the key root, 'maj' | 'min']; one chord per bar
  const PROG = {
    major: { calm: [[0, 'maj'], [9, 'min'], [5, 'maj'], [7, 'maj']], war: [[9, 'min'], [5, 'maj'], [0, 'maj'], [7, 'maj']] },
    minor: { calm: [[0, 'min'], [8, 'maj'], [3, 'maj'], [10, 'maj']], war: [[0, 'min'], [5, 'min'], [8, 'maj'], [10, 'maj']] },
  };
  const PENTA = { major: [0, 2, 4, 7, 9], minor: [0, 3, 5, 7, 10] };
  const TRIAD = { maj: [0, 4, 7], min: [0, 3, 7] };
  // per-state mix: layer gains, tempo and which chord order to play
  const MIX = {
    calm:   { pad: 0.55, arp: 0.55, bass: 0.22, drums: 0,    lead: 0,    bpm: 84,  prog: 'calm' },
    combat: { pad: 0.34, arp: 0.3,  bass: 0.55, drums: 0.65, lead: 0.36, bpm: 112, prog: 'war' },
    boss:   { pad: 0.4,  arp: 0.22, bass: 0.72, drums: 1,    lead: 0.6,  bpm: 128, prog: 'war' },
    end:    { pad: 0,    arp: 0,    bass: 0,    drums: 0,    lead: 0,    bpm: 84,  prog: 'calm' },
  };
  const mus = { bus: null, layers: null, timer: null, step: 0, nextTime: 0, state: 'calm', key: null, plan: null };
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function seededRand(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; }

  // the tune for one level: a fixed 4-bar arpeggio and lead phrase, built once from a seed
  function buildPlan(levelId) {
    const key = MUSIC_KEYS[levelId] || { root: 38, minor: false };
    const mode = key.minor ? 'minor' : 'major', scale = PENTA[mode];
    const r = seededRand(hashStr(levelId || 'x'));
    const arp = [], lead = [];
    for (let bar = 0; bar < 4; bar++) {
      const a = [], l = [];
      for (let i = 0; i < 8; i++) a.push(r() < 0.14 ? -1 : [0, 1, 2, 3, 2, 1, 2, 3][i]);       // -1 is a rest
      let deg = 5 + Math.floor(r() * 3);
      for (let i = 0; i < 16; i++) {
        const weight = i % 8 === 0 ? 0.95 : i % 4 === 0 ? 0.6 : i % 2 === 0 ? 0.28 : 0;
        if (r() < weight) { deg = Math.max(2, Math.min(11, deg + [-2, -1, -1, 0, 1, 1, 2][Math.floor(r() * 7)])); l.push(deg); } else l.push(-1);
      }
      arp.push(a); lead.push(l);
    }
    return { key, mode, scale, arp, lead };
  }

  function makeMusicGraph(c, dest) {
    const bus = c.createGain(); bus.gain.value = 0.32; bus.connect(dest);   // kept well under the sound effects so hits and clinks stay audible
    const layers = {};
    for (const n of ['pad', 'arp', 'bass', 'drums', 'lead']) { const g = c.createGain(); g.gain.value = 0; g.connect(bus); layers[n] = g; }
    return { bus, layers };
  }
  function mTone(dest, type, freq, t, dur, vol, o = {}) {
    const osc = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (o.detune) osc.detune.value = o.detune;
    f.type = 'lowpass'; f.frequency.setValueAtTime(o.cutoff || 2400, t);
    if (o.cutTo) f.frequency.exponentialRampToValueAtTime(o.cutTo, t + dur);
    const a = o.attack || 0.006;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(f); f.connect(g); g.connect(dest);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function mNoise(dest, t, dur, vol, freq, filter = 'bandpass', q = 1) {
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; f.type = filter; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, (t * 7.31) % 1.5, dur + 0.05);   // a moving read point, so no Math.random (the balance tests seed it)
  }
  function mKick(dest, t, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.3);
  }

  // One 16th-note step of the score. `step` counts up forever; a bar is 16 steps.
  function scheduleStep(step, t, stateName, graph, plan) {
    const mix = MIX[stateName], L = graph.layers;
    const bar = Math.floor(step / 16), i = step % 16, sd = 60 / mix.bpm / 4;
    const chord = PROG[plan.mode][mix.prog][bar % 4], root = plan.key.root + chord[0], tri = TRIAD[chord[1]];
    const war = stateName !== 'calm', boss = stateName === 'boss';
    // pad: one soft chord per bar, long attack and release
    if (i === 0 && mix.pad > 0) {
      for (const semi of [tri[0], tri[1], tri[2]]) {
        mTone(L.pad, 'sine', mtof(root + 12 + semi), t, sd * 16 + 0.6, 0.14, { attack: 0.7, cutoff: 1800, detune: -4 });
        mTone(L.pad, 'triangle', mtof(root + 12 + semi), t, sd * 16 + 0.6, 0.06, { attack: 0.9, cutoff: 1400, detune: 5 });
      }
    }
    // bass: long roots when calm, an eighth-note drive in a fight, a 16th pulse for a boss
    if (mix.bass > 0) {
      if (!war && (i === 0 || i === 8)) mTone(L.bass, 'triangle', mtof(root), t, sd * 7, 0.24, { attack: 0.02, cutoff: 500 });
      else if (war && !boss && i % 2 === 0) mTone(L.bass, 'triangle', mtof(root + (i % 8 === 6 ? 7 : 0)), t, sd * 1.7, 0.26, { attack: 0.008, cutoff: 650 });
      else if (boss && (i % 4 === 0 || i % 4 === 2 || i === 15)) mTone(L.bass, 'sawtooth', mtof(root - (i === 15 ? 12 : 0)), t, sd * 1.5, 0.15, { attack: 0.006, cutoff: 480, cutTo: 260 });
    }
    // arp: a plucked lute-like arpeggio on the eighth notes
    if (mix.arp > 0 && i % 2 === 0) {
      const idx = plan.arp[bar % 4][i / 2];
      if (idx >= 0) {
        const n = tri[idx % 3] + 12 * Math.floor(idx / 3);
        mTone(L.arp, 'triangle', mtof(root + 24 + n), t, sd * 3, 0.2, { attack: 0.004, cutoff: 3200, cutTo: 900 });
      }
    }
    // lead: the tune, a reedy pentatonic line that only plays once a wave is live
    if (mix.lead > 0) {
      const deg = plan.lead[bar % 4][i];
      if (deg >= 0) {
        const semi = plan.scale[deg % 5] + 12 * Math.floor(deg / 5);
        const f = mtof(plan.key.root + 36 + semi);
        mTone(L.lead, boss ? 'sawtooth' : 'square', f, t, sd * (boss ? 2.4 : 1.8), boss ? 0.11 : 0.085, { attack: 0.012, cutoff: boss ? 2600 : 1700 });
        mTone(L.lead, 'triangle', f * 2, t, sd * 1.6, 0.05, { attack: 0.01, cutoff: 2200 });
      }
    }
    // drums: war drums in a fight, four on the floor and rolls for a boss
    if (mix.drums > 0) {
      const kickAt = boss ? (i % 4 === 0) : (i === 0 || i === 8 || i === 10);
      if (kickAt) mKick(L.drums, t, boss ? 0.5 : 0.42);
      if (i === 4 || i === 12) { mNoise(L.drums, t, 0.14, 0.28, 1900, 'bandpass', 0.8); mTone(L.drums, 'triangle', 190, t, 0.1, 0.16, { cutoff: 900 }); }
      if (boss && i >= 14) mNoise(L.drums, t, 0.06, 0.16, 1400, 'bandpass', 0.8);
      if (i % 2 === 0) mNoise(L.drums, t, 0.035, i % 4 === 0 ? 0.07 : 0.045, 7000, 'highpass', 0.7);
    }
  }

  function musicTarget() {
    const s = GameState.state;
    if (s.phase === 'won' || s.phase === 'lost') return 'end';
    if (s.phase === 'playing' && s.waveActive) return s.enemies.some((e) => e.boss) ? 'boss' : 'combat';
    return 'calm';
  }
  function applyMix(stateName, graph, c, instant) {
    const mix = MIX[stateName], now = c.currentTime;
    for (const n in graph.layers) {
      const g = graph.layers[n].gain;
      if (instant) g.value = mix[n]; else g.setTargetAtTime(mix[n], now, stateName === 'end' ? 0.5 : 0.9);
    }
  }
  function musicTick() {
    if (!ctx || rendering) return;
    if (ctx.state !== 'running') return;
    if (muted || !settings.musicOn) { mus.nextTime = ctx.currentTime + 0.05; return; }
    const target = musicTarget();
    if (target !== mus.state) { mus.state = target; applyMix(target, mus, ctx, false); }
    if (mus.nextTime < ctx.currentTime) mus.nextTime = ctx.currentTime + 0.05;   // fell behind (tab hidden): skip the gap, never burst
    while (mus.nextTime < ctx.currentTime + 0.35) {
      scheduleStep(mus.step, mus.nextTime, mus.state === 'end' ? 'calm' : mus.state, mus, mus.plan);
      mus.nextTime += 60 / MIX[mus.state].bpm / 4;
      mus.step++;
    }
  }
  function startMusic() {
    if (mus.timer) return;
    const g = makeMusicGraph(ctx, musicOut);
    mus.bus = g.bus; mus.layers = g.layers;
    mus.plan = buildPlan(GameState.currentLevel().id);
    mus.state = musicTarget();
    applyMix(mus.state, mus, ctx, true);
    mus.nextTime = ctx.currentTime + 0.1;
    mus.timer = setInterval(musicTick, 50);
  }
  // Offline render of one music state, for checking levels and structure outside the game.
  async function renderMusic(stateName, seconds, levelId) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext, rate = 44100;
    const off = new OAC(1, Math.ceil(rate * seconds), rate);
    const saved = { ctx, master, noiseBuf, sfxOut, musicOut };
    ctx = off; buildGraph(off); master.gain.value = 0.6; rendering = true;
    const graph = makeMusicGraph(off, musicOut), plan = buildPlan(levelId || 'hollybrook');
    applyMix(stateName, graph, off, true);
    const sd = 60 / MIX[stateName].bpm / 4;
    let notes = 0;
    for (let step = 0, t = 0; t < seconds; step++, t += sd) { scheduleStep(step, t, stateName, graph, plan); notes++; }
    const buffer = await off.startRendering();
    rendering = false;
    ctx = saved.ctx; master = saved.master; noiseBuf = saved.noiseBuf; sfxOut = saved.sfxOut; musicOut = saved.musicOut;
    return { buffer, steps: notes };
  }

  const getSettings = () => ({ ...settings });
  function setSfxOn(on) { settings.sfxOn = !!on; saveSettings(); applySettings(); }
  function setMusicOn(on) { settings.musicOn = !!on; saveSettings(); applySettings(); }
  function setSfxVolume(v) { settings.sfxVol = Math.max(0, Math.min(1, +v || 0)); saveSettings(); applySettings(); }
  function setMusicVolume(v) { settings.musicVol = Math.max(0, Math.min(1, +v || 0)); saveSettings(); applySettings(); }

  return { init, unlock, update, sfx, setMuted, isMuted, getSettings, setSfxOn, setMusicOn, setSfxVolume, setMusicVolume, renderBoard, renderMusic, musicState: () => mus.state };
})();

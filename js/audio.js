// ===================================================================
// Audio  (Web Audio, synthesized; unlocked on the first pointer event)
// ===================================================================
const Audio = (() => {
  let ctx = null, master = null, noiseBuf = null, muted = false;
  let sfxOut = null, musicOut = null;   // per-kind volume buses, both feeding master
  // Player settings, saved under aa-audio. Music defaults a little lower than
  // the effects, since it plays continuously and effects are short events.
  const settings = { sfxOn: true, sfxVol: 1, musicOn: true, musicVol: 0.6 };
  try {
    const saved = JSON.parse(localStorage.getItem('aa-audio') || 'null');
    if (saved && typeof saved === 'object') {
      if (typeof saved.sfxOn === 'boolean') settings.sfxOn = saved.sfxOn;
      if (typeof saved.musicOn === 'boolean') settings.musicOn = saved.musicOn;
      if (Number.isFinite(saved.sfxVol)) settings.sfxVol = Math.max(0, Math.min(1, saved.sfxVol));
      if (Number.isFinite(saved.musicVol)) settings.musicVol = Math.max(0, Math.min(1, saved.musicVol));
    }
  } catch (e) { /* storage may be blocked or hold junk: keep the defaults */ }
  function saveSettings() { try { localStorage.setItem('aa-audio', JSON.stringify(settings)); } catch (e) { /* ignore */ } }
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
      try { muted = localStorage.getItem('aa-muted') === '1'; } catch (e) { /* storage may be blocked */ }
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
    try { localStorage.setItem('aa-muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
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
  // fm: { ratio, depth } frequency-modulates the tone (metallic, zappy sci-fi
  // timbres); vib: { rate, depth } wobbles the pitch; q gives the filter bite.
  function voice({ type = 'sine', freq = 440, to = null, dur = 0.15, vol = 0.4, cutoff = 2400, delay = 0, attack = 0.008, jitter = 0.04, key = null, gap = 0.05, fm = null, vib = null, q = 0 }) {
    if (!ctx || (!settings.sfxOn && !rendering) || limited(key, gap)) return;
    const t0 = ctx.currentTime + baseDelay + delay;
    const j = 1 + (Math.random() * 2 - 1) * jitter;
    const osc = ctx.createOscillator(), filt = ctx.createBiquadFilter(), g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq * j, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to * j), t0 + dur);
    filt.type = 'lowpass';
    if (q) filt.Q.value = q;
    filt.frequency.setValueAtTime(cutoff, t0);
    filt.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff * 0.3), t0 + dur);
    for (const mod of [fm && { rate: freq * j * fm.ratio, depth: freq * fm.depth, follow: fm.ratio }, vib && { rate: vib.rate, depth: freq * vib.depth }]) {
      if (!mod) continue;
      const m = ctx.createOscillator(), mg = ctx.createGain();
      m.frequency.setValueAtTime(mod.rate, t0);
      if (mod.follow && to) m.frequency.exponentialRampToValueAtTime(Math.max(20, to * j * mod.follow), t0 + dur);
      mg.gain.setValueAtTime(mod.depth, t0);
      if (mod.follow && to) mg.gain.exponentialRampToValueAtTime(Math.max(1, mod.depth * to / freq), t0 + dur);
      m.connect(mg); mg.connect(osc.frequency); m.start(t0); m.stop(t0 + dur + 0.03);
    }
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
  // moon critters between waves: warbling bloops that slide up and down
  function bird() {
    const base = 700 + Math.random() * 700, n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      voice({ type: 'sine', freq: base, to: base * 1.8, dur: 0.12, vol: 0.05, cutoff: 5000, delay: i * 0.16, jitter: 0.1 });
      voice({ type: 'triangle', freq: base * 1.5, to: base * 0.7, dur: 0.1, vol: 0.03, cutoff: 5000, delay: i * 0.16 + 0.09, jitter: 0.1 });
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
    place() {    // a tower beams down onto its pad: a rising shimmer, a power-up hum and a confirm chirp
      voice({ type: 'sine', freq: 300, to: 1800, dur: 0.3, vol: 0.12, cutoff: 6000, fm: { ratio: 3, depth: 0.4 } });
      noise({ dur: 0.3, vol: 0.08, freq: 2500, to: 8000, q: 0.8 });
      voice({ type: 'sawtooth', freq: 110, to: 220, dur: 0.35, vol: 0.1, cutoff: 900, q: 3, delay: 0.1 });
      [1047, 1568].forEach((f, i) => voice({ type: 'square', freq: f, to: f, dur: 0.06, vol: 0.06, cutoff: 5000, delay: 0.36 + i * 0.07, jitter: 0 }));
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
    gameStart() {   // the colony's defenses power up: a long rising sweep and a synth chord
      voice({ type: 'sawtooth', freq: 55, to: 440, dur: 1.1, vol: 0.12, cutoff: 2200, q: 5, fm: { ratio: 0.5, depth: 0.2 } });
      noise({ dur: 1.0, vol: 0.06, freq: 400, to: 6000, q: 1 });
      [262, 330, 392, 523].forEach((f, i) => voice({ type: 'sawtooth', freq: f, to: f, dur: 0.9, vol: 0.06, cutoff: 2600, delay: 1.0 + i * 0.02, jitter: 0.004 }));
      voice({ type: 'sine', freq: 1568, to: 1568, dur: 0.6, vol: 0.06, cutoff: 6000, delay: 1.05, jitter: 0 });
    },
    waveStart() {   // the colony alarm: a two-tone siren, twice
      [0, 0.3].forEach((d) => {
        voice({ type: 'square', freq: 660, to: 660, dur: 0.14, vol: 0.09, cutoff: 2400, delay: d, jitter: 0 });
        voice({ type: 'square', freq: 880, to: 880, dur: 0.14, vol: 0.09, cutoff: 2400, delay: d + 0.15, jitter: 0 });
      });
      voice({ type: 'sawtooth', freq: 110, to: 82, dur: 0.6, vol: 0.08, cutoff: 600, delay: 0.1 });
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
    spawn() {    // a blob drone: a wet little "blorp"
      voice({ type: 'sine', freq: 180, to: 420, dur: 0.12, vol: 0.14, cutoff: 1200, key: 'spawn', gap: 0.08 });
      voice({ type: 'sine', freq: 360, to: 160, dur: 0.1, vol: 0.1, cutoff: 1200, delay: 0.1 });
    },
    trickster() {   // a crawler: a dry skitter of clicks
      for (let i = 0; i < 6; i++) noise({ dur: 0.02, vol: 0.12, freq: 3800 + i * 200, q: 4, delay: i * 0.035, key: i ? null : 'trickster', gap: 0.1 });
      voice({ type: 'square', freq: 1400, to: 1900, dur: 0.05, vol: 0.05, cutoff: 3000, delay: 0.2 });
    },
    troll() {    // a brute: two heavy shell thuds and a low growl
      [0, 0.32].forEach((d) => {
        noise({ dur: 0.08, vol: 0.18, freq: 900, q: 2, delay: d, key: d ? null : 'troll', gap: 0.2 });
        voice({ type: 'triangle', freq: 70, to: 45, dur: 0.18, vol: 0.32, cutoff: 400, delay: d });
      });
      voice({ type: 'sawtooth', freq: 95, to: 70, dur: 0.35, vol: 0.12, cutoff: 450, delay: 0.12 });
    },
    bat() {      // a saucer: the classic wobbling theremin swoop
      voice({ type: 'sine', freq: 900, to: 1500, dur: 0.18, vol: 0.08, cutoff: 5000, key: 'bat', gap: 0.12 });
      voice({ type: 'sine', freq: 1500, to: 800, dur: 0.22, vol: 0.07, cutoff: 5000, delay: 0.16 });
    },
    bossArrive(type) {   // a dark chord and a rumble, then each boss's own voice
      [110, 131, 165].forEach((f) => voice({ type: 'sawtooth', freq: f, to: f * 0.98, dur: 1.4, vol: 0.14, cutoff: 700, jitter: 0.005 }));
      noise({ dur: 1.4, vol: 0.18, freq: 150, filter: 'lowpass' });
      if (type === 'drilltank' || type === 'harvester') {
        // engines revving and a grinding drill or reel
        voice({ type: 'sawtooth', freq: 60, to: 140, dur: 0.9, vol: 0.12, cutoff: 600, delay: 0.3 });
        noise({ dur: 1.0, vol: 0.2, freq: 1800, to: 900, q: 3, delay: 0.4 });
      } else if (type === 'gloopking' || type === 'tripod' || type === 'sandworm') {
        // three ground-shaking steps and a bellow
        [0.35, 0.8, 1.25].forEach((d) => { voice({ type: 'sine', freq: 60, to: 32, dur: 0.35, vol: 0.55, cutoff: 300, delay: d }); noise({ dur: 0.15, vol: 0.3, freq: 200, filter: 'lowpass', delay: d }); });
        voice({ type: 'sawtooth', freq: 130, to: 90, dur: 0.9, vol: 0.18, cutoff: 700, delay: 1.5 });
      } else if (type === 'hivequeen') {
        // a rising buzz of wings and a shriek
        voice({ type: 'sawtooth', freq: 180, to: 240, dur: 1.0, vol: 0.12, cutoff: 1500, delay: 0.3 });
        voice({ type: 'square', freq: 900, to: 1400, dur: 0.4, vol: 0.08, cutoff: 3000, delay: 1.1 });
      } else if (type === 'mothership' || type === 'manta') {
        // a huge descending hum and a sparkle
        voice({ type: 'sawtooth', freq: 240, to: 60, dur: 1.4, vol: 0.18, cutoff: 1000, delay: 0.35 });
        voice({ type: 'sine', freq: 1200, to: 2400, dur: 0.6, vol: 0.06, cutoff: 6000, delay: 0.5 });
      } else {
        // a bubbling warble
        for (let i = 0; i < 5; i++) voice({ type: 'sine', freq: 300 + i * 80, to: 600 + i * 80, dur: 0.15, vol: 0.1, cutoff: 3000, delay: 0.3 + i * 0.15 });
      }
    },
    // ---- towers firing: sci-fi weapons, each with its own voice ----
    shoot() {    // the laser turret: a classic laser "pew", a falling buzzy FM tone with a crackle
      voice({ type: 'sawtooth', freq: 2600, to: 220, dur: 0.16, vol: 0.09, cutoff: 5200, q: 6, fm: { ratio: 0.5, depth: 0.6 }, key: 'shoot', gap: 0.04, jitter: 0.06 });
      voice({ type: 'square', freq: 3400, to: 600, dur: 0.07, vol: 0.04, cutoff: 7000 });
      noise({ dur: 0.04, vol: 0.06, freq: 7000, q: 2 });
    },
    shootWarden() {   // the goo cannon: a warbling plasma "bwomp" lobbed with a bubbling gurgle
      voice({ type: 'sine', freq: 110, to: 320, dur: 0.22, vol: 0.26, cutoff: 1400, vib: { rate: 22, depth: 0.25 }, key: 'warden', gap: 0.08 });
      voice({ type: 'triangle', freq: 220, to: 640, dur: 0.18, vol: 0.08, cutoff: 1800, vib: { rate: 30, depth: 0.2 }, delay: 0.02 });
      for (let i = 0; i < 3; i++) voice({ type: 'sine', freq: 500 + i * 160, to: 900 + i * 160, dur: 0.05, vol: 0.06, cutoff: 3000, delay: 0.12 + i * 0.05 });
    },
    shootDruid() {    // the cryo beam: a freezing zap: an icy FM crackle, a hiss sweeping down, a crystal shimmer
      voice({ type: 'sine', freq: 4200, to: 1600, dur: 0.22, vol: 0.09, cutoff: 9000, fm: { ratio: 2.7, depth: 1.4 }, key: 'druid', gap: 0.06 });
      noise({ dur: 0.3, vol: 0.12, freq: 9000, to: 2200, q: 1.2, filter: 'bandpass' });
      for (let i = 0; i < 4; i++) noise({ dur: 0.015, vol: 0.08, freq: 6000 + i * 900, q: 6, delay: 0.02 + i * 0.035 });
      [3136, 4186].forEach((f, i) => voice({ type: 'sine', freq: f, to: f * 1.02, dur: 0.25, vol: 0.035, cutoff: 9000, delay: 0.08 + i * 0.06, jitter: 0 }));
    },
    shootGolem() {    // the mech walker: a hydraulic hiss, a servo whine and a rocket-fist ignition
      noise({ dur: 0.12, vol: 0.1, freq: 4000, to: 1500, q: 0.7, key: 'golem', gap: 0.1 });
      voice({ type: 'sawtooth', freq: 260, to: 1100, dur: 0.14, vol: 0.05, cutoff: 2400, q: 4 });
      voice({ type: 'square', freq: 90, to: 45, dur: 0.32, vol: 0.18, cutoff: 600, fm: { ratio: 1.5, depth: 0.8 }, delay: 0.12 });
      noise({ dur: 0.35, vol: 0.26, freq: 900, to: 180, filter: 'lowpass', delay: 0.12 });
    },
    shootArtillery() {   // the missile pod: two target-lock beeps, then a rocket whoosh
      [0, 0.06].forEach((d) => voice({ type: 'square', freq: 1760, to: 1760, dur: 0.035, vol: 0.06, cutoff: 5000, delay: d, jitter: 0, key: d ? null : 'artillery', gap: 0.1 }));
      noise({ dur: 0.55, vol: 0.24, freq: 900, to: 4200, q: 0.9, delay: 0.12 });
      voice({ type: 'sawtooth', freq: 120, to: 480, dur: 0.45, vol: 0.05, cutoff: 1600, fm: { ratio: 0.25, depth: 0.5 }, delay: 0.12 });
    },
    // ---- hits and effects ----
    hit() {      // an energy hit: a short zap and a splat
      voice({ type: 'square', freq: 900, to: 260, dur: 0.06, vol: 0.1, cutoff: 2600, fm: { ratio: 1.41, depth: 0.7 }, key: 'hit', gap: 0.04 });
      noise({ dur: 0.04, vol: 0.12, freq: 2400, q: 1.2 });
    },
    clink() {    // armor plating deflecting a shot: a ringing metallic FM ping
      voice({ type: 'sine', freq: 2100, to: 1900, dur: 0.14, vol: 0.1, cutoff: 7000, fm: { ratio: 3.53, depth: 1.2 }, key: 'clink', gap: 0.05 });
      noise({ dur: 0.03, vol: 0.14, freq: 5200, q: 3 });
    },
    splash() {   // an area blast: a low plasma boom
      noise({ dur: 0.3, vol: 0.26, freq: 700, to: 160, filter: 'lowpass', key: 'splash', gap: 0.08 });
      voice({ type: 'sine', freq: 140, to: 50, dur: 0.24, vol: 0.3, cutoff: 700, fm: { ratio: 0.5, depth: 0.6 } });
    },
    chill() {    // a target freezing: a crackle of ice forming
      for (let i = 0; i < 3; i++) noise({ dur: 0.02, vol: 0.07, freq: 7000 - i * 800, q: 5, delay: i * 0.03, key: i ? null : 'chill', gap: 0.15 });
      voice({ type: 'sine', freq: 5200, to: 4600, dur: 0.12, vol: 0.035, cutoff: 9000, fm: { ratio: 2.1, depth: 0.5 }, delay: 0.04 });
    },
    root() {     // stuck in goo: a sticky, bubbling splorch
      noise({ dur: 0.1, vol: 0.2, freq: 450, filter: 'lowpass', key: 'root', gap: 0.12 });
      voice({ type: 'sine', freq: 200, to: 90, dur: 0.16, vol: 0.2, cutoff: 700, vib: { rate: 26, depth: 0.3 }, delay: 0.02 });
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
    'greenhope':         { root: 38, minor: false },
    'crater-rim':        { root: 43, minor: false },
    'glowshroom-grove':  { root: 45, minor: true },
    'comms-ridge':       { root: 41, minor: false },
    'dune-sea':          { root: 40, minor: true },
    'spaceport':         { root: 45, minor: false },
    'glacier-shelf':     { root: 42, minor: true },
    'bloomfruit':        { root: 44, minor: false },
    'hive-front':        { root: 39, minor: true },
    'terraformer-prime': { root: 38, minor: true },
  };

  // Space, not a village fair: open suspended and added-ninth chords, a
  // lydian lift (the raised fourth, a major chord on the second) for major
  // keys and a phrygian shadow (the flat second) for minor ones.
  // chord = [semitones above the key root, shape]; one chord per bar
  const PROG = {
    major: { calm: [[0, 'add9'], [2, 'maj'], [9, 'min7'], [2, 'sus2']], war: [[0, 'sus2'], [2, 'maj'], [8, 'maj'], [10, 'sus2']] },
    minor: { calm: [[0, 'min9'], [8, 'maj7'], [3, 'add9'], [10, 'sus2']], war: [[0, 'min'], [1, 'maj'], [8, 'maj'], [7, 'sus4']] },
  };
  // the lead's scales: lydian and phrygian, seven notes each
  const SCALE = { major: [0, 2, 4, 6, 7, 9, 11], minor: [0, 1, 3, 5, 7, 8, 10] };
  const TRIAD = { maj: [0, 4, 7], min: [0, 3, 7], sus2: [0, 2, 7], sus4: [0, 5, 7], add9: [0, 4, 7, 14], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], min9: [0, 3, 7, 14] };
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
    const mode = key.minor ? 'minor' : 'major', scale = SCALE[mode];
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
    const bus = c.createGain(); bus.gain.value = 0.3; bus.connect(dest);   // kept well under the sound effects so hits and clinks stay audible
    // the space echo: a dotted-eighth delay with a darkening feedback loop,
    // fed by the pad, the arpeggio and the lead (never the drums or bass)
    const send = c.createGain(); send.gain.value = 0.42;
    const delay = c.createDelay(2), fb = c.createGain(), tone = c.createBiquadFilter();
    delay.delayTime.value = 0.42; fb.gain.value = 0.4; tone.type = 'lowpass'; tone.frequency.value = 1800;
    send.connect(delay); delay.connect(tone); tone.connect(fb); fb.connect(delay); tone.connect(bus);
    const layers = {};
    for (const n of ['pad', 'arp', 'bass', 'drums', 'lead']) {
      const g = c.createGain(); g.gain.value = 0; g.connect(bus); layers[n] = g;
      if (n === 'pad' || n === 'arp' || n === 'lead') g.connect(send);
    }
    return { bus, layers };
  }
  function mTone(dest, type, freq, t, dur, vol, o = {}) {
    const osc = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (o.detune) osc.detune.value = o.detune;
    f.type = 'lowpass'; f.frequency.setValueAtTime(o.cutoff || 2400, t);
    if (o.q) f.Q.value = o.q;
    if (o.cutTo) f.frequency.exponentialRampToValueAtTime(o.cutTo, t + dur);
    // glide in from another pitch (the theremin's portamento)
    if (o.from) { osc.frequency.setValueAtTime(o.from, t); osc.frequency.exponentialRampToValueAtTime(freq, t + (o.glide || 0.08)); }
    // vibrato: a slow wobble on the pitch
    if (o.vib) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = o.vibRate || 5.5; lg.gain.value = freq * o.vib;
      lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t); lfo.stop(t + dur + 0.05);
    }
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
    // pad: a slow, detuned synth chord per bar, its filter opening as it swells,
    // with a faint high shimmer an octave and a fifth up
    if (i === 0 && mix.pad > 0) {
      const len = sd * 16 + 0.8;
      for (const semi of tri) {
        const f = mtof(root + 12 + semi);
        mTone(L.pad, 'sawtooth', f, t, len, 0.035, { attack: 1.1, cutoff: 380, cutTo: 1300, detune: -9 });
        mTone(L.pad, 'sawtooth', f, t, len, 0.035, { attack: 1.3, cutoff: 380, cutTo: 1300, detune: 9 });
        mTone(L.pad, 'sine', f, t, len, 0.06, { attack: 0.9, cutoff: 2000 });
      }
      mTone(L.pad, 'sine', mtof(root + 31), t, len, 0.018, { attack: 1.6, cutoff: 4000, vib: 0.004, vibRate: 0.4 });
    }
    // calm: a distant beacon ping now and then, left to ring in the echo
    if (!war && i === 6 && bar % 2 === 1 && mix.arp > 0) mTone(L.arp, 'sine', mtof(root + 43), t, 0.5, 0.05, { attack: 0.003, cutoff: 6000 });
    // bass: a deep sine sub when calm, a resonant synth line in a fight, an acid pulse for a boss
    if (mix.bass > 0) {
      if (!war && (i === 0 || i === 8)) mTone(L.bass, 'sine', mtof(root), t, sd * 7, 0.3, { attack: 0.08, cutoff: 400 });
      else if (war && !boss && i % 2 === 0) mTone(L.bass, 'sawtooth', mtof(root + (i % 8 === 6 ? 7 : 0)), t, sd * 1.7, 0.16, { attack: 0.006, cutoff: 900, cutTo: 220, q: 6 });
      else if (boss && (i % 4 === 0 || i % 4 === 2 || i === 15)) mTone(L.bass, 'sawtooth', mtof(root - (i === 15 ? 12 : 0)), t, sd * 1.5, 0.14, { attack: 0.004, cutoff: 1400, cutTo: 200, q: 9 });
    }
    // arp: a synth sequencer, square blips up and down the chord on the
    // sixteenths (eighths when calm), bouncing in the echo
    if (mix.arp > 0 && (war || i % 2 === 0)) {
      const idx = plan.arp[bar % 4][Math.floor(i / 2)];
      if (idx >= 0) {
        const up = war && i % 2 === 1 ? 12 : 0;
        const n = tri[idx % tri.length] + 12 * Math.floor(idx / tri.length) + up;
        mTone(L.arp, 'square', mtof(root + 24 + n), t, sd * 1.4, war ? 0.06 : 0.08, { attack: 0.003, cutoff: 2600, cutTo: 700, q: 4 });
      }
    }
    // lead: the tune, sung by a theremin: a sine that glides into each note
    // with a wavering vibrato (a buzzier ring modulated tone for a boss)
    if (mix.lead > 0) {
      const deg = plan.lead[bar % 4][i];
      if (deg >= 0) {
        const sc = plan.scale, semi = sc[deg % sc.length] + 12 * Math.floor(deg / sc.length);
        const f = mtof(plan.key.root + 31 + semi), from = graph.lastLead || f;
        graph.lastLead = f;
        mTone(L.lead, boss ? 'triangle' : 'sine', f, t, sd * (boss ? 2.6 : 2.2), boss ? 0.12 : 0.11, { attack: 0.05, cutoff: boss ? 3200 : 2600, from, glide: 0.09, vib: 0.012, vibRate: 5.8 });
        if (boss) mTone(L.lead, 'sawtooth', f * 1.5, t, sd * 1.8, 0.02, { attack: 0.02, cutoff: 1800, from: from * 1.5, glide: 0.09 });
      }
    }
    // drums: a tight electronic kit: a sub kick, a snare that is half noise,
    // half laser zap, and ticking hats; a boss adds a falling zap fill
    if (mix.drums > 0) {
      const kickAt = boss ? (i % 4 === 0) : (i === 0 || i === 8 || i === 10);
      if (kickAt) mKick(L.drums, t, boss ? 0.5 : 0.42);
      if (i === 4 || i === 12) {
        mNoise(L.drums, t, 0.1, 0.2, 3200, 'bandpass', 1.2);
        mTone(L.drums, 'sine', 220, t, 0.12, 0.14, { cutoff: 4000, from: 1400, glide: 0.08 });
        mTone(L.drums, 'square', 900, t, 0.09, 0.05, { cutoff: 2600, cutTo: 300 });
      }
      if (boss && i >= 14) mTone(L.drums, 'sawtooth', mtof(root + 48 - (i - 14) * 7), t, 0.08, 0.06, { cutoff: 3000, cutTo: 400 });
      if (i % 2 === 0) mNoise(L.drums, t, 0.025, i % 4 === 0 ? 0.06 : 0.035, 9000, 'highpass', 0.7);
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
    const graph = makeMusicGraph(off, musicOut), plan = buildPlan(levelId || 'greenhope');
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

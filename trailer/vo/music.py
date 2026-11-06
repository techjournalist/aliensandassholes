# Synthesized music bed for the trailer: 120 bpm space synth, sections follow the edit.
import numpy as np, soundfile as sf
from scipy.signal import lfilter, butter, sosfilt

SR = 44100
LEN = 87.0
N = int(SR * LEN)
BPM = 120; BEAT = 60 / BPM; BAR = 4 * BEAT
rng = np.random.default_rng(7)
out = np.zeros((N, 2))

def midi(m): return 440 * 2 ** ((m - 69) / 12)
def env_adsr(n, a, d, s, r):
    e = np.ones(n) * s
    A, D, R = int(a * SR), int(d * SR), int(r * SR)
    A = min(A, n); e[:A] = np.linspace(0, 1, A, endpoint=False)
    D = min(D, n - A); e[A:A + D] = np.linspace(1, s, D, endpoint=False)
    if R > 0 and R < n: e[-R:] *= np.linspace(1, 0, R)
    return e
def saw(f, t, ph=0): return 2 * ((f * t + ph) % 1) - 1
def sq(f, t, duty=0.5): return np.where((f * t) % 1 < duty, 1.0, -1.0)
def lp(x, fc, order=2):
    sos = butter(order, min(fc, SR / 2 - 100) / (SR / 2), 'low', output='sos'); return sosfilt(sos, x)
def hp(x, fc, order=2):
    sos = butter(order, fc / (SR / 2), 'high', output='sos'); return sosfilt(sos, x)
def add(sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR); j = min(N, i + len(sig))
    if j <= i: return
    s = sig[: j - i] * gain
    out[i:j, 0] += s * np.sqrt(0.5 * (1 - pan)) * 1.414
    out[i:j, 1] += s * np.sqrt(0.5 * (1 + pan)) * 1.414

# Section energy curves (times in seconds, match the edit)
SECT = [  # (start, name)
    (0.0, 'intro'), (13.4, 'build'), (19.2, 'towers'), (35.8, 'groove'), (48.4, 'waves'),
    (58.4, 'break'), (64.4, 'boss'), (73.3, 'lift'), (80.3, 'end'), (87, 'x')]
def section(t):
    for (a, n), (b, _) in zip(SECT, SECT[1:]):
        if a <= t < b: return n
    return 'x'

# chords: D minor with a lydian lift (Dm9, Bbmaj7, Gm9, A7sus)
PROG = [[50, 53, 57, 60, 64], [46, 50, 53, 57, 62], [43, 46, 50, 53, 57], [45, 50, 52, 55, 59]]
BOSS = [[50, 53, 56, 60], [51, 55, 58, 62], [50, 53, 56, 60], [49, 52, 56, 59]]  # darker, flat 2
LIFT = [[46, 50, 53, 57, 62], [48, 52, 55, 59, 64], [50, 53, 57, 60, 64], [45, 49, 52, 57, 64]]

nbars = int(LEN / BAR) + 1
for b in range(nbars):
    t0 = b * BAR
    sec = section(t0 + 0.01)
    if sec in ('x',): continue
    chords = BOSS if sec == 'boss' else LIFT if sec in ('lift',) else PROG
    ch = chords[b % 4]
    n = int(SR * BAR * 1.15); t = np.arange(n) / SR
    if sec == 'end': continue
    # pad: detuned saws, filter opens with energy
    cut = {'intro': 900, 'build': 1300, 'towers': 1700, 'groove': 2000, 'waves': 2600, 'break': 700, 'boss': 1500, 'lift': 2600}[sec]
    pad = np.zeros(n)
    for m in ch:
        f = midi(m + 12)
        for d in (-0.12, 0.0, 0.11):
            pad += saw(f * 2 ** (d / 12), t, rng.random())
    pad = lp(pad, cut) * env_adsr(n, 0.5, 0.3, 0.8, 0.6) * 0.035
    shim = sum(np.sin(2 * np.pi * midi(m + 36) * t) for m in ch[2:]) * 0.006 * (1 + np.sin(2 * np.pi * 0.5 * t))
    add(pad + shim, t0, 1.0, -0.15)
    add(pad, t0 + 0.012, 1.0, 0.15)
    # bass
    root = ch[0] - 12
    if sec in ('intro', 'break'):
        nb = int(SR * BAR); tb = np.arange(nb) / SR
        bass = lp(saw(midi(root), tb) + 0.6 * np.sin(2 * np.pi * midi(root - 12) * tb), 400) * env_adsr(nb, 0.3, 0.5, 0.7, 0.4)
        add(bass * 0.12, t0)
    else:
        step = BEAT / 2
        for k in range(8):
            nb = int(SR * step * 0.9); tb = np.arange(nb) / SR
            mm = root + (12 if (sec in ('waves', 'boss') and k % 2) else 0)
            bc = 900 if sec in ('waves', 'boss', 'lift') else 600
            bass = lp(saw(midi(mm), tb) + 0.7 * sq(midi(mm - 12), tb), bc) * env_adsr(nb, 0.005, 0.12, 0.5, 0.05)
            add(bass * 0.11, t0 + k * step)
    # arp: square 16ths through the chord
    if sec in ('towers', 'groove', 'waves', 'lift', 'boss', 'build'):
        notes = ch[1:] + [ch[2] + 12]
        step = BEAT / 4
        pat = [0, 2, 4, 1, 3, 4, 2, 5 % len(notes)]
        for k in range(16):
            if sec == 'build' and k % 2: continue
            m = notes[pat[k % 8] % len(notes)] + 12
            na = int(SR * step * 0.95); ta = np.arange(na) / SR
            a = lp(sq(midi(m), ta, 0.3), 3200) * env_adsr(na, 0.003, 0.06, 0.25, 0.03)
            g = {'build': 0.022, 'towers': 0.03, 'groove': 0.032, 'waves': 0.036, 'lift': 0.036, 'boss': 0.026}[sec]
            add(a * g, t0 + k * step, 1.0, 0.35 if k % 2 else -0.35)
            add(a * g * 0.35, t0 + k * step + 3 * step, 1.0, -0.35 if k % 2 else 0.35)  # echo

# drums
def kick():
    n = int(SR * 0.45); t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) * 0.9
def snare():
    n = int(SR * 0.3); t = np.arange(n) / SR
    return (hp(rng.standard_normal(n), 1500) * np.exp(-t * 16) * 0.5 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 25) * 0.4)
def hat(open_=False):
    n = int(SR * (0.25 if open_ else 0.06)); t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 7000) * np.exp(-t * (14 if open_ else 70)) * 0.35
K, Sn, H, HO = kick(), snare(), hat(), hat(True)
for b in range(nbars):
    t0 = b * BAR; sec = section(t0 + 0.01)
    for k in range(16):
        tt = t0 + k * BEAT / 4; s = section(tt)
        if s in ('intro', 'end', 'x'): continue
        if s == 'build':
            if k == 0: add(K, tt, 0.5)
            if k % 4 == 2: add(H, tt, 0.4, 0.3)
            continue
        if s == 'break':
            if k % 8 == 0: add(K, tt, 0.45)
            if k % 2 == 0: add(H, tt, 0.25, 0.3)
            continue
        if k % 4 == 0: add(K, tt, 0.75 if s != 'boss' else 0.95)
        if s in ('waves', 'boss', 'lift') and k in (10, 14) and b % 2: add(K, tt, 0.5)
        if k % 8 == 4: add(Sn, tt, 0.55)
        if s in ('waves', 'lift', 'boss'): add(H, tt, 0.35 if k % 2 else 0.5, 0.3)
        elif k % 2 == 0: add(H, tt, 0.4, 0.3)
        if k % 4 == 2 and s in ('groove', 'waves', 'lift'): add(HO, tt, 0.2, -0.3)

# risers into the big sections and the end hit
def riser(dur):
    n = int(SR * dur); t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 2000) * (t / dur) ** 2 * 0.25
    return x + np.sin(2 * np.pi * np.cumsum(200 + 1400 * (t / dur) ** 2) / SR) * (t / dur) ** 2 * 0.05
for at in (48.4, 64.4, 80.3):
    add(riser(2.0), at - 2.0)
def boom():
    n = int(SR * 3.5); t = np.arange(n) / SR
    f = 38 + 60 * np.exp(-t * 6)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6) * 0.9 + lp(rng.standard_normal(n), 600) * np.exp(-t * 3) * 0.3
add(boom(), 80.3)
# final chord, long decay
n = int(SR * 6.5); t = np.arange(n) / SR
fin = np.zeros(n)
for m in [50, 57, 62, 64, 69, 74]:
    for d in (-0.1, 0.1): fin += saw(midi(m) * 2 ** (d / 12), t)
fin = lp(fin, 2200) * np.exp(-t * 0.45) * 0.03 * np.minimum(1, t / 0.02)
add(fin, 80.3, 1.0, -0.2); add(fin, 80.32, 1.0, 0.2)
# tail fade
fade = int(SR * 2.0); out[-fade:] *= np.linspace(1, 0, fade)[:, None]
out /= np.max(np.abs(out)) / 0.89
sf.write('music.wav', out, SR)
print('ok', LEN)

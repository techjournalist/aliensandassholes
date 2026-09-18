// Renders every synthesized sound in a row to tools/shots/soundboard.wav and
// prints level stats per sound. Dev aid for the audio pass.
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/node22/lib/node_modules/playwright'); } })();
const fs = require('fs');
const path = require('path');
const THREE_LOCAL = process.env.THREE_LOCAL || path.join(__dirname, '..', 'node_modules/three/build/three.min.js');
const PAGE = 'file://' + path.resolve(__dirname, '..', 'index.html');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.route('**/three.min.js', (route) => route.fulfill({ path: THREE_LOCAL, contentType: 'application/javascript' }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(PAGE);
  await page.waitForTimeout(1200);
  const res = await page.evaluate(async () => {
    const { buffer, marks } = await Audio.renderBoard();
    const d = buffer.getChannelData(0), rate = buffer.sampleRate;
    const stats = marks.map((m, i) => {
      const a = Math.floor(m.at * rate), b = Math.floor((marks[i + 1] ? marks[i + 1].at : buffer.duration) * rate);
      let peak = 0, sum = 0, last = a, cross = 0, prev = 0;
      for (let k = a; k < b; k++) { const v = d[k], av = Math.abs(v); if (av > peak) peak = av; sum += v * v; if (av > 0.01) last = k; if ((v >= 0) !== (prev >= 0)) cross++; prev = v; }
      const n = b - a;
      return { name: m.name, peak: +peak.toFixed(3), rms: +Math.sqrt(sum / n).toFixed(4), len: +((last - a) / rate).toFixed(2), zcHz: Math.round(cross / 2 / ((last - a) / rate || 1)) };
    });
    let peakAll = 0; for (let k = 0; k < d.length; k++) peakAll = Math.max(peakAll, Math.abs(d[k]));
    // 16-bit PCM WAV
    const out = new ArrayBuffer(44 + d.length * 2), v = new DataView(out);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + d.length * 2, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, d.length * 2, true);
    for (let k = 0; k < d.length; k++) v.setInt16(44 + k * 2, Math.max(-1, Math.min(1, d[k])) * 32767, true);
    let bin = ''; const bytes = new Uint8Array(out); for (let k = 0; k < bytes.length; k += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(k, k + 8192));
    return { stats, peakAll: +peakAll.toFixed(3), duration: +buffer.duration.toFixed(1), wav: btoa(bin) };
  });
  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'shots', 'soundboard.wav'), Buffer.from(res.wav, 'base64'));
  console.log(`soundboard: ${res.duration}s, overall peak ${res.peakAll}`);
  console.log('name'.padEnd(14) + 'peak   rms     len    zc-Hz');
  for (const s of res.stats) console.log(s.name.padEnd(14) + String(s.peak).padEnd(7) + String(s.rms).padEnd(8) + String(s.len).padEnd(7) + s.zcHz);
  const silent = res.stats.filter((s) => s.peak < 0.02).map((s) => s.name);
  console.log(silent.length ? 'SILENT: ' + silent.join(', ') : 'no silent sounds');
  console.log(res.peakAll >= 0.99 ? 'CLIPPING' : 'no clipping');
  await browser.close();
})().catch((e) => { console.error('FAILURE', e); process.exit(1); });

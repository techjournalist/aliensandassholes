// ===================================================================
// COLOR PIPELINE — authored colors are sRGB hex values (palette-config.js and
// every level file). three.js r128 treats a hex as linear, so turning on
// sRGB output would wash everything out. This shim keeps every existing call
// working unchanged: a hex is converted to linear when it enters a Color, and
// back when it is read out, so lighting math runs in linear light and the
// renderer encodes the result (see Renderer.init: outputEncoding + ACES).
// Blends and HSL tweaks still happen in sRGB so gradients keep the look the
// palette was tuned for. Add ?lin=0 to the URL to switch the shim off (old look).
// Must load right after three.js and before anything creates a Color.
// ===================================================================
(() => {
  const on = !/[?&]lin=0\b/.test(location.search);
  const C = THREE.Color.prototype;
  const setHex = C.setHex, getHex = C.getHex, getHSL = C.getHSL, setHSL = C.setHSL, lerp = C.lerp, setStyle = C.setStyle;
  if (on) {
    C.setHex = function (hex) { setHex.call(this, hex); return this.convertSRGBToLinear(); };
    C.setStyle = function (style) { setStyle.call(this, style); return this.convertSRGBToLinear(); };
    C.getHex = function () { return getHex.call(this.clone().convertLinearToSRGB()); };
    C.getHSL = function (target) { return getHSL.call(this.clone().convertLinearToSRGB(), target); };
    C.setHSL = function (h, s, l) { setHSL.call(this, h, s, l); return this.convertSRGBToLinear(); };
    C.lerp = function (color, alpha) {
      this.convertLinearToSRGB();
      lerp.call(this, color.clone().convertLinearToSRGB(), alpha);
      return this.convertSRGBToLinear();
    };
  }
  THREE.ColorPipeline = { on };
})();

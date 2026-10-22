// ===================================================================
// TOON LIGHTING — one patch to three's toon fragment shader, so every
// MeshToonMaterial in the game (props, towers, enemies, ground, road) gets
// it, including the ones that add their own onBeforeCompile tweaks:
//   - colored shadows: the shaded steps of the ramp lean cool and violet
//     instead of just going dark, the way a painted illustration does it
//   - a warm lift on the sunlit steps
//   - a faint top-light sheen on upward-facing curved edges (canopies,
//     mushroom caps, roofs), so forms read as rounded and lit
// A few multiplies per pixel, no extra passes, no textures. ?toon=0 turns it off.
// Must load after three.js and before the first material compiles.
// ===================================================================
(() => {
  if (/[?&]toon=0\b/.test(location.search)) return;
  const frag = THREE.ShaderLib.toon.fragmentShader;
  const anchor = 'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;';
  if (!frag.includes(anchor)) return;
  THREE.ShaderLib.toon.fragmentShader = frag.replace(anchor, anchor + `
	{
		float tlLit = dot(reflectedLight.directDiffuse + reflectedLight.indirectDiffuse, vec3(0.3333)) / max(dot(diffuseColor.rgb, vec3(0.3333)), 0.02);
		float tlShade = 1.0 - smoothstep(0.12, 0.34, tlLit);
		float tlWarm = smoothstep(0.38, 0.6, tlLit);
		outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.70, 0.68, 1.20), tlShade);
		outgoingLight *= mix(vec3(1.0), vec3(1.07, 1.03, 0.92), tlWarm);
		float tlUp = max(dot(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz)), 0.0);
		float tlEdge = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.5);
		outgoingLight += diffuseColor.rgb * vec3(1.0, 0.93, 0.78) * (tlEdge * tlUp * 0.55);
	}`);
})();

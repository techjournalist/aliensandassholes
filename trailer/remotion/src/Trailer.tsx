import { Audio } from "@remotion/media";
import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CAPTIONS, Cap, FLASHES, FPS, INSETS, SHOTS, SHOT_START, TOTAL, VO } from "./timeline";

const C = {
  ink: "#150f24",
  cream: "#f4f0fc",
  gold: "#ffc84a",
  teal: "#3fe0c5",
  lime: "#9dff4a",
  magic: "#b45cff",
};
const SERIF = '"Palatino Linotype", "Book Antiqua", Palatino, "URW Palladio L", Georgia, serif';
const SANS = 'Inter, "Trebuchet MS", system-ui, sans-serif';
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const f = (s: number) => Math.round(s * FPS);

// one captured clip, played as a JPEG sequence with a slow push-in
const ShotClip: React.FC<{ id: string; len: number }> = ({ id, len }) => {
  const frame = useCurrentFrame();
  const n = String(frame).padStart(4, "0");
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img
        src={staticFile(`shots/${id}/f${n}.jpg`)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          scale: interpolate(frame, [0, len], [1.0, 1.035], clamp),
        }}
      />
    </AbsoluteFill>
  );
};

const Caption: React.FC<{ cap: Cap; len: number }> = ({ cap, len }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 16, stiffness: 180 } });
  const out = interpolate(frame, [len - 7, len], [1, 0], clamp);
  const shadow = `0 4px 0 ${C.ink}, 0 0 24px rgba(0,0,0,0.6)`;

  if (cap.kind === "big") {
    return (
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 120, opacity: out }}>
        <div
          style={{
            fontFamily: SERIF,
            fontWeight: 900,
            fontSize: 88,
            color: C.gold,
            textShadow: shadow,
            letterSpacing: 1,
            scale: interpolate(enter, [0, 1], [1.25, 1]),
            opacity: enter,
            textAlign: "center",
          }}
        >
          {cap.text}
        </div>
        {cap.sub ? (
          <div
            style={{
              marginTop: 10,
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 34,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: C.cream,
              textShadow: `0 3px 0 ${C.ink}`,
              opacity: interpolate(frame, [6, 14], [0, 1], clamp),
              translate: `0px ${interpolate(frame, [6, 16], [16, 0], { ...clamp, easing: Easing.out(Easing.cubic) })}px`,
            }}
          >
            {cap.sub}
          </div>
        ) : null}
      </AbsoluteFill>
    );
  }

  if (cap.kind === "pair") {
    return (
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 130, opacity: out }}>
        <div style={{ display: "flex", alignItems: "center", gap: 36, fontFamily: SERIF, fontWeight: 900, fontSize: 84, color: C.gold, textShadow: shadow }}>
          <span style={{ translate: `${interpolate(enter, [0, 1], [-80, 0])}px 0px`, opacity: enter }}>{cap.text}</span>
          <span style={{ fontFamily: SANS, fontSize: 36, color: C.teal, letterSpacing: 4, opacity: interpolate(frame, [4, 10], [0, 1], clamp) }}>OR</span>
          <span style={{ translate: `${interpolate(enter, [0, 1], [80, 0])}px 0px`, opacity: enter }}>{cap.sub}</span>
        </div>
      </AbsoluteFill>
    );
  }

  // tag: lower-left (or top-left) label with a teal bar
  return (
    <AbsoluteFill style={{ justifyContent: cap.pos === "top" ? "flex-start" : "flex-end", alignItems: "flex-start", padding: cap.pos === "top" ? "130px 0 0 110px" : "0 0 110px 110px", opacity: out }}>
      <div style={{ display: "flex", alignItems: "stretch", gap: 22, translate: `${interpolate(enter, [0, 1], [-60, 0])}px 0px`, opacity: enter }}>
        <div style={{ width: 10, borderRadius: 5, background: C.teal, boxShadow: `0 0 18px ${C.teal}` }} />
        <div>
          <div style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 80, lineHeight: 1, color: C.gold, textShadow: shadow }}>{cap.text}</div>
          {cap.sub ? (
            <div
              style={{
                marginTop: 12,
                fontFamily: SANS,
                fontWeight: 800,
                fontSize: 30,
                letterSpacing: 5,
                textTransform: "uppercase",
                color: C.cream,
                textShadow: `0 3px 0 ${C.ink}`,
                opacity: interpolate(frame, [5, 12], [0, 1], clamp),
              }}
            >
              {cap.sub}
            </div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

type InsetDef = (typeof INSETS)[number];
// a magnified copy of part of the same frame, so small UI reads on video
const Inset: React.FC<{ d: InsetDef }> = ({ d }) => {
  const frame = useCurrentFrame(); // relative to inset start
  const { fps } = useVideoConfig();
  const src = d.from + frame;
  const len = d.to - d.from;
  const pop = spring({ frame, fps, config: { damping: 15, stiffness: 170 } });
  const out = interpolate(frame, [len - 6, len], [1, 0], clamp);
  const W = d.crop.w * d.scale, H = d.crop.h * d.scale;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "flex-end", paddingRight: 70 }}>
      <div
        style={{
          width: W,
          height: H,
          overflow: "hidden",
          borderRadius: 22,
          border: `5px solid ${C.gold}`,
          boxShadow: `0 0 0 6px ${C.ink}, 0 24px 60px rgba(0,0,0,0.6), 0 0 40px rgba(255,200,74,0.35)`,
          scale: interpolate(pop, [0, 1], [0.7, 1]),
          opacity: Math.min(pop, out),
          position: "relative",
        }}
      >
        <Img
          src={staticFile(`shots/${d.shot}/f${String(src).padStart(4, "0")}.jpg`)}
          style={{ position: "absolute", width: 1920 * d.scale, height: 1080 * d.scale, left: -d.crop.x * d.scale, top: -d.crop.y * d.scale, maxWidth: "none" }}
        />
      </div>
    </AbsoluteFill>
  );
};

const Flash: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 50%, #ffffff, ${C.magic})`,
        opacity: interpolate(frame, [0, 2, 12], [0.85, 0.6, 0], clamp),
        mixBlendMode: "screen",
      }}
    />
  );
};

const Ufo: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size * 0.62} viewBox="-60 -30 120 74">
    <path d="M -22 8 L 22 8 L 48 44 L -48 44 Z" fill={C.lime} opacity={0.12} />
    <ellipse cy={-6} rx={20} ry={16} fill="#bff4ff" opacity={0.9} />
    <ellipse rx={54} ry={13} fill="#8a94b8" />
    <ellipse cy={-3} rx={54} ry={7} fill="#c8d0e8" />
    {[-36, -12, 12, 36].map((x) => (
      <circle key={x} cx={x} cy={4} r={4} fill={C.lime} />
    ))}
  </svg>
);

const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 4, fps, config: { damping: 12, stiffness: 120 } });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 48%, rgba(21,15,36,0.55), rgba(11,8,32,0.92) 70%)`,
          opacity: interpolate(frame, [0, 10], [0, 1], clamp),
        }}
      />
      <div style={{ translate: `0px ${interpolate(frame, [0, 170], [10, -10])}px`, opacity: pop, scale: interpolate(pop, [0, 1], [0.6, 1]) }}>
        <Ufo size={170} />
      </div>
      <div
        style={{
          marginTop: 14,
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: 28,
          letterSpacing: 8,
          color: C.cream,
          textShadow: `0 3px 0 ${C.ink}, 0 0 16px rgba(63,224,197,0.8)`,
          textTransform: "uppercase",
          opacity: interpolate(frame, [10, 20], [0, 1], clamp),
        }}
      >
        A tower defense on a very small moon
      </div>
      <div
        style={{
          fontFamily: SERIF,
          fontWeight: 900,
          fontSize: 150,
          color: C.gold,
          textShadow: `0 6px 0 #7a5316, 0 12px 0 ${C.ink}, 0 20px 40px rgba(0,0,0,0.6)`,
          scale: interpolate(pop, [0, 1], [1.3, 1]),
          opacity: pop,
          marginTop: 6,
        }}
      >
        Aliens &amp; Assholes
      </div>
      <div
        style={{
          marginTop: 46,
          padding: "18px 44px",
          borderRadius: 999,
          background: `linear-gradient(${C.gold}, #e8a62a)`,
          color: C.ink,
          fontFamily: SANS,
          fontWeight: 900,
          fontSize: 40,
          boxShadow: `0 6px 0 #7a5316, 0 14px 30px rgba(0,0,0,0.5)`,
          opacity: interpolate(frame, [40, 52], [0, 1], clamp),
          translate: `0px ${interpolate(frame, [40, 56], [24, 0], { ...clamp, easing: Easing.out(Easing.back(2)) })}px`,
        }}
      >
        Defend the colony. Play free in your browser.
      </div>
    </AbsoluteFill>
  );
};

// music sits under the narration and dips while a line plays
const musicVolume = (frame: number) => {
  const t = frame / FPS;
  let duck = 0;
  for (const v of VO) {
    const k = Math.min(
      interpolate(t, [v.at - 0.25, v.at], [0, 1], clamp),
      interpolate(t, [v.at + v.len, v.at + v.len + 0.4], [1, 0], clamp),
    );
    duck = Math.max(duck, k);
  }
  const fadeIn = interpolate(t, [0, 1.2], [0, 1], clamp);
  return fadeIn * (0.62 - 0.32 * duck);
};

export const Trailer: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#0b0820" }}>
      {SHOTS.map((s) => (
        <Sequence key={s.id} name={s.id} from={f(SHOT_START[s.id])} durationInFrames={f(s.use)}>
          <ShotClip id={s.id} len={f(s.use)} />
        </Sequence>
      ))}
      {/* soft vignette for the cinematic look */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(8,4,24,0.55) 100%)" }} />
      {INSETS.map((d) => (
        <Sequence key={d.shot} name={`inset ${d.shot}`} from={f(SHOT_START[d.shot]) + d.from} durationInFrames={d.to - d.from}>
          <Inset d={d} />
        </Sequence>
      ))}
      {CAPTIONS.map((c) => (
        <Sequence key={c.text + c.from} name={`cap ${c.text}`} from={f(c.from)} durationInFrames={f(c.to - c.from)}>
          <Caption cap={c} len={f(c.to - c.from)} />
        </Sequence>
      ))}
      <Sequence name="end card" from={f(SHOT_START["s21_endbg"])}>
        <EndCard />
      </Sequence>
      {FLASHES.map((t) => (
        <Sequence key={t} name="flash" from={f(t)} durationInFrames={14}>
          <Flash />
        </Sequence>
      ))}
      <Audio src={staticFile("audio/music.wav")} volume={(fr) => musicVolume(fr)} />
      {VO.map((v) => (
        <Sequence key={v.file} name={`vo ${v.file}`} from={f(v.at)} durationInFrames={f(v.len + 0.3)}>
          <Audio src={staticFile(`audio/${v.file}.wav`)} volume={1} />
        </Sequence>
      ))}
      {/* fade to black at the very end */}
      <AbsoluteFill style={{ background: "#000", opacity: interpolate(useCurrentFrame(), [f(TOTAL) - 18, f(TOTAL)], [0, 1], clamp) }} />
    </AbsoluteFill>
  );
};

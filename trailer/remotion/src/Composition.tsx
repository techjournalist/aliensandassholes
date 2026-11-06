import { Composition } from "remotion";
import { Trailer } from "./Trailer";
import { FPS, TOTAL } from "./timeline";

export const MyComposition = () => {
  return (
    <Composition
      id="Trailer"
      component={Trailer}
      durationInFrames={Math.round(TOTAL * FPS)}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};

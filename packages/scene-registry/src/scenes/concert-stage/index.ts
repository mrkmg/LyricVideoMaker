import type { SceneDefinition } from "@lyric-video-maker/core";

export const concertStageScene: SceneDefinition = {
  id: "concert-stage",
  name: "Concert Stage",
  description:
    "Full production look with a dark gradient, mirrored equalizer, glowing lyrics, artist name, and a decorative divider line.",
  source: "built-in",
  readOnly: true,
  components: [
    {
      id: "background-color-1",
      componentId: "background-color",
      enabled: true,
      options: {
        mode: "gradient",
        direction: "180deg",
        topColor: "#0a0a1a",
        topOpacity: 100,
        bottomColor: "#050510",
        bottomOpacity: 100
      }
    },
    {
      id: "equalizer-1",
      componentId: "equalizer",
      enabled: true,
      options: {
        y: 65,
        height: 35,
        layoutMode: "mirrored",
        barCount: 48,
        primaryColor: "#ff6b35",
        secondaryColor: "#ff2d55",
        glowColor: "#ff6b35",
        glowStrength: 45,
        opacity: 75
      }
    },
    {
      id: "divider-1",
      componentId: "shape",
      enabled: true,
      options: {
        shapeType: "line",
        x: 10,
        y: 62,
        width: 80,
        height: 1,
        fillEnabled: false,
        strokeEnabled: true,
        strokeColor: "#ffffff",
        strokeWidth: 1,
        strokeOpacity: 30
      }
    },
    {
      id: "lyrics-by-line-1",
      componentId: "lyrics-by-line",
      enabled: true,
      options: {
        height: 60,
        lyricPosition: "middle",
        lyricSize: 80,
        shadowEnabled: true,
        shadowColor: "#ff6b35",
        shadowIntensity: 40
      }
    },
    {
      id: "static-text-1",
      componentId: "static-text",
      enabled: true,
      options: {
        text: "ARTIST",
        y: 2,
        height: 8,
        fontSize: 22,
        fontWeight: 400,
        letterSpacing: 8,
        color: "#aaaaaa",
        textCase: "uppercase",
        textAlign: "center"
      }
    }
  ]
};

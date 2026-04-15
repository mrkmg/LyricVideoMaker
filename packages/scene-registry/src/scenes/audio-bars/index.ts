import type { SceneDefinition } from "@lyric-video-maker/core";

export const audioBarsScene: SceneDefinition = {
  id: "audio-bars",
  name: "Audio Bars",
  description:
    "Dark background with equalizer bars filling the bottom and lyrics floating above. Shows off audio reactivity.",
  source: "built-in",
  readOnly: true,
  components: [
    {
      id: "background-color-1",
      componentId: "background-color",
      enabled: true,
      options: {
        mode: "solid",
        color: "#070b14",
        opacity: 100
      }
    },
    {
      id: "equalizer-1",
      componentId: "equalizer",
      enabled: true,
      options: {
        y: 55,
        height: 45
      }
    },
    {
      id: "lyrics-by-line-1",
      componentId: "lyrics-by-line",
      enabled: true,
      options: {
        height: 55,
        lyricPosition: "middle"
      }
    }
  ]
};

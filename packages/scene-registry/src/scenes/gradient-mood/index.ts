import type { SceneDefinition } from "@lyric-video-maker/core";

export const gradientMoodScene: SceneDefinition = {
  id: "gradient-mood",
  name: "Gradient Mood",
  description: "Rich purple-to-dark gradient with centered lyrics and soft shadow.",
  source: "built-in",
  readOnly: true,
  components: [
    {
      id: "background-color-1",
      componentId: "background-color",
      enabled: true,
      options: {
        mode: "gradient",
        direction: "135deg",
        topColor: "#1a0533",
        topOpacity: 100,
        bottomColor: "#0a1628",
        bottomOpacity: 100
      }
    },
    {
      id: "lyrics-by-line-1",
      componentId: "lyrics-by-line",
      enabled: true,
      options: {
        lyricPosition: "middle",
        shadowEnabled: true,
        shadowIntensity: 70
      }
    }
  ]
};

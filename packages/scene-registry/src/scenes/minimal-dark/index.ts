import type { SceneDefinition } from "@lyric-video-maker/core";

export const minimalDarkScene: SceneDefinition = {
  id: "minimal-dark",
  name: "Minimal Dark",
  description: "Clean white lyrics on a solid dark background. No distractions.",
  source: "built-in",
  readOnly: true,
  components: [
    {
      id: "background-color-1",
      componentId: "background-color",
      enabled: true,
      options: {
        mode: "solid",
        color: "#0a0a0f",
        opacity: 100
      }
    },
    {
      id: "lyrics-by-line-1",
      componentId: "lyrics-by-line",
      enabled: true,
      options: {}
    }
  ]
};

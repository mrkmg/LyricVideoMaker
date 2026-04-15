import type { SceneDefinition } from "@lyric-video-maker/core";

export const boldImpactScene: SceneDefinition = {
  id: "bold-impact",
  name: "Bold Impact",
  description: "Huge centered lyrics with thick outline on pure black. For rap, spoken word, emphasis.",
  source: "built-in",
  readOnly: true,
  components: [
    {
      id: "background-color-1",
      componentId: "background-color",
      enabled: true,
      options: {
        mode: "solid",
        color: "#000000",
        opacity: 100
      }
    },
    {
      id: "lyrics-by-line-1",
      componentId: "lyrics-by-line",
      enabled: true,
      options: {
        lyricSize: 108,
        lyricPosition: "middle",
        borderEnabled: true,
        borderColor: "#ffffff",
        borderThickness: 6,
        shadowEnabled: false
      }
    }
  ]
};

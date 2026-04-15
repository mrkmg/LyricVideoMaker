import type { SceneDefinition } from "@lyric-video-maker/core";

export const photoMemoriesScene: SceneDefinition = {
  id: "photo-memories",
  name: "Photo Memories",
  description:
    "Slideshow background with Ken Burns effect, dark overlay for readability, lyrics at bottom, and a title at top.",
  source: "built-in",
  readOnly: true,
  components: [
    {
      id: "slideshow-1",
      componentId: "slideshow",
      enabled: true,
      options: {
        kenBurnsEnabled: true,
        kenBurnsScale: 15,
        transitionDuration: 2000,
        slideDuration: 8000,
        fitMode: "cover"
      }
    },
    {
      id: "background-color-1",
      componentId: "background-color",
      enabled: true,
      options: {
        mode: "gradient",
        direction: "0deg",
        topColor: "#000000",
        topOpacity: 30,
        bottomColor: "#000000",
        bottomOpacity: 75
      }
    },
    {
      id: "static-text-1",
      componentId: "static-text",
      enabled: true,
      options: {
        text: "Song Title",
        y: 2,
        height: 8,
        fontSize: 28,
        fontWeight: 300,
        color: "#cccccc",
        textAlign: "center"
      }
    },
    {
      id: "lyrics-by-line-1",
      componentId: "lyrics-by-line",
      enabled: true,
      options: {
        lyricPosition: "bottom",
        shadowEnabled: true,
        shadowIntensity: 80
      }
    }
  ]
};

import type { SceneDefinition } from "@lyric-video-maker/core";

export const singleImageLyricsScene: SceneDefinition = {
  id: "single-image-lyrics",
  name: "Single Image Lyrics",
  description: "A full-song lyric video with one background image, optional color wash, and stylable lyric placement.",
  source: "built-in",
  readOnly: true,
  components: [
    {
      id: "background-image-1",
      componentId: "background-image",
      enabled: true,
      options: {}
    },
    {
      id: "background-color-1",
      componentId: "background-color",
      enabled: false,
      options: {}
    },
    {
      id: "lyrics-by-line-1",
      componentId: "lyrics-by-line",
      enabled: true,
      options: {}
    }
  ]
};

import type { SceneDefinition } from "@lyric-video-maker/core";

export const lowerThirdScene: SceneDefinition = {
  id: "lower-third",
  name: "Lower Third",
  description:
    "Professional broadcast style with a semi-transparent bar at the bottom for lyrics and an artist credit at the top.",
  source: "built-in",
  readOnly: true,
  components: [
    {
      id: "background-image-1",
      componentId: "image",
      enabled: true,
      options: {}
    },
    {
      id: "bar-1",
      componentId: "shape",
      enabled: true,
      options: {
        shapeType: "rectangle",
        y: 78,
        height: 22,
        fillColor: "#000000",
        fillOpacity: 75,
        strokeEnabled: false
      }
    },
    {
      id: "lyrics-by-line-1",
      componentId: "lyrics-by-line",
      enabled: true,
      options: {
        y: 78,
        height: 22,
        lyricPosition: "middle",
        lyricSize: 52,
        horizontalPadding: 80
      }
    },
    {
      id: "static-text-1",
      componentId: "static-text",
      enabled: true,
      options: {
        text: "Artist Name",
        y: 2,
        height: 8,
        fontSize: 24,
        fontWeight: 400,
        color: "#ffffff",
        textAlign: "left",
        x: 3,
        width: 50
      }
    }
  ]
};

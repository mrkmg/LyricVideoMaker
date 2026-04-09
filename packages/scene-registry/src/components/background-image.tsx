import React from "react";
import type { SceneComponentDefinition } from "@lyric-video-maker/core";

export interface BackgroundImageOptions {
  imagePath: string;
}

export const backgroundImageComponent: SceneComponentDefinition<BackgroundImageOptions> = {
  id: "background-image",
  name: "Background Image",
  description: "Covers the frame with one full-song image.",
  staticWhenMarkupUnchanged: true,
  options: [{ type: "image", id: "imagePath", label: "Background Image", required: true }],
  defaultOptions: {
    imagePath: ""
  },
  Component: ({ instance, assets }) => {
    const imageUrl = assets.getUrl(instance.id, "imagePath");
    if (!imageUrl) {
      return null;
    }

    return (
      <img
        src={imageUrl}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scale(1.03)"
        }}
      />
    );
  }
};

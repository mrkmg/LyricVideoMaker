import {
  createSceneFileData,
  parseSceneFileData,
  validateSceneComponents,
  validateSceneOptions
} from "../src/scenes";
import { SUPPORTED_FONT_FAMILIES } from "../src/constants";
import type {
  SceneComponentDefinition,
  SerializedSceneDefinition
} from "../src/types";

interface BackgroundImageOptions {
  imagePath: string;
}

const backgroundImageComponent: SceneComponentDefinition<BackgroundImageOptions> = {
  id: "background-image",
  name: "Background Image",
  options: [{ type: "image", id: "imagePath", label: "Background", required: true }],
  defaultOptions: {
    imagePath: ""
  },
  Component: () => null
};

const lyricsComponent: SceneComponentDefinition<{ lyricSize: number; lyricFont: string }> = {
  id: "lyrics-by-line",
  name: "Lyrics by Line",
  options: [
    {
      type: "category",
      id: "lyrics",
      label: "Lyrics",
      options: [
        { type: "number", id: "lyricSize", label: "Lyric Size", defaultValue: 72, min: 12, max: 100 },
        { type: "font", id: "lyricFont", label: "Lyric Font", defaultValue: SUPPORTED_FONT_FAMILIES[0] }
      ]
    }
  ],
  defaultOptions: {
    lyricSize: 72,
    lyricFont: SUPPORTED_FONT_FAMILIES[0]
  },
  Component: () => null
};

const equalizerComponent: SceneComponentDefinition<{
  placement: string;
  barCount: number;
  analysisFps: number;
  sensitivity: number;
  bandDistribution: string;
}> = {
  id: "equalizer",
  name: "Equalizer",
  options: [
    {
      type: "category",
      id: "placement",
      label: "Placement",
      options: [
        {
          type: "select",
          id: "placement",
          label: "Placement",
          defaultValue: "bottom-center",
          options: [
            { label: "Bottom Center", value: "bottom-center" },
            { label: "Top Center", value: "top-center" }
          ]
        }
      ]
    },
    {
      type: "category",
      id: "bars",
      label: "Bars",
      options: [
        { type: "number", id: "barCount", label: "Bar Count", defaultValue: 28, min: 4, max: 64 },
        { type: "number", id: "analysisFps", label: "Analysis FPS", defaultValue: 48, min: 10, max: 120 },
        { type: "number", id: "sensitivity", label: "Sensitivity", defaultValue: 1.4, min: 0.1, max: 4, step: 0.1 },
        {
          type: "select",
          id: "bandDistribution",
          label: "Band Distribution",
          defaultValue: "log",
          options: [
            { label: "Linear", value: "linear" },
            { label: "Log", value: "log" }
          ]
        }
      ]
    }
  ],
  defaultOptions: {
    placement: "bottom-center",
    barCount: 28,
    analysisFps: 48,
    sensitivity: 1.4,
    bandDistribution: "log"
  },
  Component: () => null
};

const scene: SerializedSceneDefinition = {
  id: "test-scene",
  name: "Test Scene",
  source: "built-in",
  readOnly: true,
  components: [
    {
      id: "bg-1",
      componentId: "background-image",
      enabled: true,
      options: {
        imagePath: "cover.png"
      }
    },
    {
      id: "lyrics-1",
      componentId: "lyrics-by-line",
      enabled: true,
      options: {}
    },
    {
      id: "equalizer-1",
      componentId: "equalizer",
      enabled: true,
      options: {}
    }
  ]
};

describe("scene validation", () => {
  it("applies defaults to component options", () => {
    const result = validateSceneOptions(
      lyricsComponent,
      {},
      {
        isFileAccessible: () => true
      }
    );

    expect(result).toEqual({
      lyricSize: 72,
      lyricFont: SUPPORTED_FONT_FAMILIES[0]
    });
  });

  it("applies equalizer defaults from categorized options", () => {
    const result = validateSceneOptions(equalizerComponent, {});

    expect(result).toEqual({
      placement: "bottom-center",
      barCount: 28,
      analysisFps: 48,
      sensitivity: 1.4,
      bandDistribution: "log"
    });
  });

  it("validates a stacked scene with duplicate component types", () => {
    const result = validateSceneComponents(
      {
        ...scene,
        components: [
          ...scene.components,
          {
            id: "lyrics-2",
            componentId: "lyrics-by-line",
            enabled: true,
            options: {
              lyricSize: 64
            }
          }
        ]
      },
      [backgroundImageComponent, lyricsComponent, equalizerComponent],
      {
        isFileAccessible: () => true
      }
    );

    expect(result).toEqual([
      {
        id: "bg-1",
        componentId: "background-image",
        componentName: "Background Image",
        enabled: true,
        options: {
          imagePath: "cover.png"
        }
      },
      {
        id: "lyrics-1",
        componentId: "lyrics-by-line",
        componentName: "Lyrics by Line",
        enabled: true,
        options: {
          lyricSize: 72,
          lyricFont: SUPPORTED_FONT_FAMILIES[0]
        }
      },
      {
        id: "equalizer-1",
        componentId: "equalizer",
        componentName: "Equalizer",
        enabled: true,
        options: {
          placement: "bottom-center",
          barCount: 28,
          analysisFps: 48,
          sensitivity: 1.4,
          bandDistribution: "log"
        }
      },
      {
        id: "lyrics-2",
        componentId: "lyrics-by-line",
        componentName: "Lyrics by Line",
        enabled: true,
        options: {
          lyricSize: 64,
          lyricFont: SUPPORTED_FONT_FAMILIES[0]
        }
      }
    ]);
  });

  it("rejects unknown component ids", () => {
    expect(() =>
      validateSceneComponents(
        {
          ...scene,
          components: [
            {
              id: "unknown-1",
              componentId: "unknown-component",
              enabled: true,
              options: {}
            }
          ]
        },
        [backgroundImageComponent, lyricsComponent, equalizerComponent]
      )
    ).toThrow(/Unknown scene component/);
  });

  it("rejects missing image assets", () => {
    expect(() =>
      validateSceneComponents(scene, [backgroundImageComponent, lyricsComponent, equalizerComponent], {
        isFileAccessible: () => false
      })
    ).toThrow(/does not point to a readable file/);
  });

  it("rejects unsupported fonts", () => {
    expect(() =>
      validateSceneComponents(
        {
          ...scene,
          components: [
            scene.components[0],
            {
              id: "lyrics-1",
              componentId: "lyrics-by-line",
              enabled: true,
              options: {
                lyricFont: "Papyrus"
              }
            }
          ]
        },
        [backgroundImageComponent, lyricsComponent, equalizerComponent],
        {
          isFileAccessible: () => true
        }
      )
    ).toThrow(/not a supported font selection/);
  });

  it("rejects equalizer values outside numeric bounds", () => {
    expect(() =>
      validateSceneOptions(equalizerComponent, {
        barCount: 128
      })
    ).toThrow(/must be at most 64/);
  });

  it("round-trips scene files", () => {
    const parsed = parseSceneFileData(createSceneFileData(scene));

    expect(parsed).toEqual(scene);
  });
});

/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { createLyricRuntime } from "@lyric-video-maker/core";
import {
  backgroundColorComponent,
  backgroundImageComponent,
  equalizerComponent,
  lyricsByLineComponent,
  singleImageLyricsScene
} from "../src";

describe("scene registry components", () => {
  it("renders the background image component with the instance-scoped asset url", () => {
    const getUrl = vi.fn(() => "file:///background.png");

    render(
      backgroundImageComponent.Component({
        instance: {
          id: "bg-1",
          componentId: "background-image",
          componentName: "Background Image",
          enabled: true,
          options: {
            imagePath: "cover.png"
          }
        },
        options: {
          imagePath: "cover.png"
        },
        frame: 0,
        timeMs: 0,
        video: {
          width: 1920,
          height: 1080,
          fps: 30,
          durationMs: 2000,
          durationInFrames: 60
        },
        lyrics: createLyricRuntime([], 0),
        assets: {
          getUrl
        },
        prepared: {}
      })
    );

    expect(document.querySelector("img")).toHaveAttribute("src", "file:///background.png");
    expect(getUrl).toHaveBeenCalledWith("bg-1", "imagePath");
  });

  it("renders the background color gradient component", () => {
    render(
      backgroundColorComponent.Component({
        instance: {
          id: "color-1",
          componentId: "background-color",
          componentName: "Background Color",
          enabled: true,
          options: {}
        },
        options: {
          topColor: "#000000",
          topOpacity: 50,
          bottomColor: "#ffffff",
          bottomOpacity: 75
        },
        frame: 0,
        timeMs: 0,
        video: {
          width: 1920,
          height: 1080,
          fps: 30,
          durationMs: 2000,
          durationInFrames: 60
        },
        lyrics: createLyricRuntime([], 0),
        assets: {
          getUrl: vi.fn()
        },
        prepared: {}
      })
    );

    const gradient = document.querySelector('[style*="linear-gradient"]');
    expect(gradient).toHaveStyle({
      position: "absolute",
      inset: "0"
    });
    expect((gradient as HTMLElement).style.background).toContain("linear-gradient");
  });

  it("renders the lyrics component with fade timing, position, border, and shadow", () => {
    const lyrics = createLyricRuntime(
      [
        {
          index: 1,
          startMs: 1000,
          endMs: 2000,
          text: "Styled line",
          lines: ["Styled line"]
        }
      ],
      1050
    );

    render(
      lyricsByLineComponent.Component({
        instance: {
          id: "lyrics-1",
          componentId: "lyrics-by-line",
          componentName: "Lyrics by Line",
          enabled: true,
          options: {}
        },
        options: {
          lyricSize: 80,
          forceSingleLine: false,
          horizontalPadding: 96,
          lyricFont: "Montserrat",
          lyricColor: "#ffffff",
          fadeInDurationMs: 200,
          fadeInEasing: "linear",
          fadeOutDurationMs: 400,
          fadeOutEasing: "ease-in",
          lyricPosition: "top",
          borderEnabled: true,
          borderColor: "#33ccff",
          borderThickness: 5,
          shadowEnabled: true,
          shadowColor: "#ff0000",
          shadowIntensity: 60
        },
        frame: 31,
        timeMs: 1050,
        video: {
          width: 1920,
          height: 1080,
          fps: 30,
          durationMs: 2000,
          durationInFrames: 60
        },
        lyrics,
        assets: {
          getUrl: vi.fn()
        },
        prepared: {}
      })
    );

    const lyricText = screen.getByText("Styled line");
    const lyricContainer = lyricText.parentElement;

    expect(lyricText).toHaveStyle({
      opacity: "0.25"
    });
    expect((lyricText as HTMLElement).style.webkitTextStroke).toBe("5px #33ccff");
    expect((lyricText as HTMLElement).style.textShadow).toBe(
      "0 4px 12px rgba(255, 0, 0, 0.6), 0 0 1px rgba(255, 0, 0, 0.8), 0 0 14px rgba(255, 0, 0, 0.27)"
    );
    expect((lyricText as HTMLElement).style.padding).toBe("21px");
    expect((lyricText as HTMLElement).style.margin).toBe("");
    expect(lyricContainer).toHaveStyle({
      alignItems: "flex-start",
      padding: "110px 96px 0"
    });
  });

  it("scales lyric measurements for smaller output resolutions", () => {
    const lyrics = createLyricRuntime(
      [
        {
          index: 1,
          startMs: 1000,
          endMs: 2000,
          text: "Scaled line",
          lines: ["Scaled line"]
        }
      ],
      1050
    );

    render(
      lyricsByLineComponent.Component({
        instance: {
          id: "lyrics-1",
          componentId: "lyrics-by-line",
          componentName: "Lyrics by Line",
          enabled: true,
          options: {}
        },
        options: {
          lyricSize: 80,
          forceSingleLine: false,
          horizontalPadding: 96,
          lyricFont: "Montserrat",
          lyricColor: "#ffffff",
          fadeInDurationMs: 200,
          fadeInEasing: "linear",
          fadeOutDurationMs: 400,
          fadeOutEasing: "ease-in",
          lyricPosition: "top",
          borderEnabled: true,
          borderColor: "#33ccff",
          borderThickness: 5,
          shadowEnabled: true,
          shadowColor: "#ff0000",
          shadowIntensity: 60
        },
        frame: 31,
        timeMs: 1050,
        video: {
          width: 1280,
          height: 720,
          fps: 30,
          durationMs: 2000,
          durationInFrames: 60
        },
        lyrics,
        assets: {
          getUrl: vi.fn()
        },
        prepared: {}
      })
    );

    const lyricText = screen.getByText("Scaled line") as HTMLElement;
    const lyricContainer = lyricText.parentElement as HTMLElement;

    expect(lyricText.style.fontSize).toBe("53.3px");
    expect(lyricText.style.webkitTextStroke).toBe("3.3px #33ccff");
    expect(lyricText.style.textShadow).toBe(
      "0 3px 8px rgba(255, 0, 0, 0.6), 0 0 1px rgba(255, 0, 0, 0.8), 0 0 10px rgba(255, 0, 0, 0.27)"
    );
    expect(lyricText.style.padding).toBe("15px");
    expect(lyricContainer).toHaveStyle({
      alignItems: "flex-start",
      padding: "73.3px 64px 0"
    });
  });

  it("builds live DOM lyric frame state with stable text and opacity data", () => {
    const lyrics = createLyricRuntime(
      [
        {
          index: 1,
          startMs: 1000,
          endMs: 2000,
          text: "Styled line",
          lines: ["Styled line"]
        }
      ],
      1050
    );

    const initialState = lyricsByLineComponent.browserRuntime?.getInitialState?.({
      instance: {
        id: "lyrics-1",
        componentId: "lyrics-by-line",
        componentName: "Lyrics by Line",
        enabled: true,
        options: {}
      },
      options: {
        ...lyricsByLineComponent.defaultOptions,
        lyricPosition: "top",
        horizontalPadding: 96,
        lyricFont: "Montserrat"
      },
      video: {
        width: 1920,
        height: 1080,
        fps: 30,
        durationMs: 2000,
        durationInFrames: 60
      },
      lyrics: {
        current: lyrics.current,
        next: lyrics.next
      },
      assets: {
        getUrl: vi.fn()
      },
      prepared: {}
    });

    const frameState = lyricsByLineComponent.browserRuntime?.getFrameState?.({
      instance: {
        id: "lyrics-1",
        componentId: "lyrics-by-line",
        componentName: "Lyrics by Line",
        enabled: true,
        options: {}
      },
      options: {
        ...lyricsByLineComponent.defaultOptions,
        lyricPosition: "top",
        horizontalPadding: 96,
        fadeInDurationMs: 200,
        fadeInEasing: "linear",
        fadeOutDurationMs: 400,
        fadeOutEasing: "ease-in",
        borderEnabled: true,
        borderColor: "#33ccff",
        borderThickness: 5,
        shadowEnabled: true,
        shadowColor: "#ff0000",
        shadowIntensity: 60
      },
      frame: 31,
      timeMs: 1050,
      video: {
        width: 1920,
        height: 1080,
        fps: 30,
        durationMs: 2000,
        durationInFrames: 60
      },
      lyrics: {
        current: lyrics.current,
        next: lyrics.next
      },
      assets: {
        getUrl: vi.fn()
      },
      prepared: {}
    });

    const lyricInitialState = initialState as Record<string, unknown>;
    const lyricFrameState = frameState as Record<string, unknown>;

    expect(lyricInitialState).toMatchObject({
      alignItems: "flex-start",
      padding: "110px 96px 0",
      fontFamily: "\"Montserrat\", sans-serif"
    });
    expect(lyricFrameState).toMatchObject({
      text: "Styled line",
      opacity: 0.25,
      padding: "20px",
      webkitTextStroke: "5px #33ccff"
    });
    expect(String(lyricFrameState.textShadow)).toContain("rgba(255, 0, 0, 0.6)");
  });

  it("scales live DOM lyric state for non-1080p video", () => {
    const lyrics = createLyricRuntime(
      [
        {
          index: 1,
          startMs: 1000,
          endMs: 2000,
          text: "Styled line",
          lines: ["Styled line"]
        }
      ],
      1050
    );

    const initialState = lyricsByLineComponent.browserRuntime?.getInitialState?.({
      instance: {
        id: "lyrics-1",
        componentId: "lyrics-by-line",
        componentName: "Lyrics by Line",
        enabled: true,
        options: {}
      },
      options: {
        ...lyricsByLineComponent.defaultOptions,
        lyricPosition: "top",
        horizontalPadding: 96,
        lyricFont: "Montserrat"
      },
      video: {
        width: 1280,
        height: 720,
        fps: 30,
        durationMs: 2000,
        durationInFrames: 60
      },
      lyrics: {
        current: lyrics.current,
        next: lyrics.next
      },
      assets: {
        getUrl: vi.fn()
      },
      prepared: {}
    });

    const frameState = lyricsByLineComponent.browserRuntime?.getFrameState?.({
      instance: {
        id: "lyrics-1",
        componentId: "lyrics-by-line",
        componentName: "Lyrics by Line",
        enabled: true,
        options: {}
      },
      options: {
        ...lyricsByLineComponent.defaultOptions,
        lyricPosition: "top",
        horizontalPadding: 96,
        fadeInDurationMs: 200,
        fadeInEasing: "linear",
        fadeOutDurationMs: 400,
        fadeOutEasing: "ease-in",
        borderEnabled: true,
        borderColor: "#33ccff",
        borderThickness: 5,
        shadowEnabled: true,
        shadowColor: "#ff0000",
        shadowIntensity: 60
      },
      frame: 31,
      timeMs: 1050,
      video: {
        width: 1280,
        height: 720,
        fps: 30,
        durationMs: 2000,
        durationInFrames: 60
      },
      lyrics: {
        current: lyrics.current,
        next: lyrics.next
      },
      assets: {
        getUrl: vi.fn()
      },
      prepared: {}
    });

    const lyricInitialState = initialState as Record<string, unknown>;
    const lyricFrameState = frameState as Record<string, unknown>;

    expect(lyricInitialState).toMatchObject({
      alignItems: "flex-start",
      padding: "73.3px 64px 0",
      fontFamily: "\"Montserrat\", sans-serif"
    });
    expect(lyricFrameState).toMatchObject({
      text: "Styled line",
      opacity: 0.25,
      fontSize: 48,
      padding: "14px",
      webkitTextStroke: "3.3px #33ccff"
    });
    expect(String(lyricFrameState.textShadow)).toContain("rgba(255, 0, 0, 0.6)");
  });

  it("forces multi-line lyrics onto a single fitted line when enabled", () => {
    const lyrics = createLyricRuntime(
      [
        {
          index: 1,
          startMs: 0,
          endMs: 2000,
          text: "This is a very long lyric line\nthat would normally wrap",
          lines: ["This is a very long lyric line", "that would normally wrap"]
        }
      ],
      500
    );

    render(
      lyricsByLineComponent.Component({
        instance: {
          id: "lyrics-1",
          componentId: "lyrics-by-line",
          componentName: "Lyrics by Line",
          enabled: true,
          options: {}
        },
        options: {
          ...lyricsByLineComponent.defaultOptions,
          lyricSize: 80,
          forceSingleLine: true,
          horizontalPadding: 40
        },
        frame: 15,
        timeMs: 500,
        video: {
          width: 600,
          height: 1080,
          fps: 30,
          durationMs: 2000,
          durationInFrames: 60
        },
        lyrics,
        assets: {
          getUrl: vi.fn()
        },
        prepared: {}
      })
    );

    const lyricText = screen.getByText("This is a very long lyric line that would normally wrap");

    expect(lyricText).toHaveStyle({
      whiteSpace: "nowrap"
    });
    expect(Number.parseFloat((lyricText as HTMLElement).style.fontSize)).toBeLessThan(25);
  });

  it("defines the preset scene as stacked components in the expected order", () => {
    expect(singleImageLyricsScene.components).toEqual([
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
    ]);
  });

  it("prepares equalizer frames from audio analysis", async () => {
    const getSpectrum = vi.fn().mockResolvedValue({
      fps: 30,
      frameCount: 60,
      bandCount: 4,
      values: [
        [0.1, 0.2, 0.3, 0.4],
        [0.4, 0.3, 0.2, 0.1]
      ]
    });

    const prepared = await equalizerComponent.prepare!({
      instance: {
        id: "equalizer-1",
        componentId: "equalizer",
        componentName: "Equalizer",
        enabled: true,
        options: {}
      },
      options: equalizerComponent.defaultOptions,
      video: {
        width: 1920,
        height: 1080,
        fps: 30,
        durationMs: 2000,
        durationInFrames: 60
      },
      lyrics: createLyricRuntime([], 0),
      assets: {
        getPath: vi.fn(),
        getUrl: vi.fn()
      },
      audio: {
        path: "song.mp3",
        getSpectrum
      }
    });

    expect(getSpectrum).toHaveBeenCalledWith({
      bandCount: 28,
      minFrequency: 40,
      maxFrequency: 3200,
      analysisFps: 48,
      sensitivity: 1.4,
      smoothing: 35,
      attackMs: 35,
      releaseMs: 240,
      silenceFloor: 8,
      bandDistribution: "log"
    });
    expect(prepared).toEqual({
      frames: [
        [0.1, 0.2, 0.3, 0.4],
        [0.4, 0.3, 0.2, 0.1]
      ]
    });
  });

  it("exposes the new equalizer defaults", () => {
    expect(equalizerComponent.defaultOptions).toMatchObject({
      graphMode: "bars",
      lineStyle: "stroke",
      colorMode: "gradient"
    });
  });

  it("builds live DOM equalizer state with static layout and per-frame values", () => {
    const initialState = equalizerComponent.browserRuntime?.getInitialState?.({
      instance: {
        id: "equalizer-1",
        componentId: "equalizer",
        componentName: "Equalizer",
        enabled: true,
        options: {}
      },
      options: {
        ...equalizerComponent.defaultOptions,
        placement: "right-center",
        alignment: "end",
        barCount: 4,
        minBarScale: 25,
        maxBarScale: 85,
        layoutMode: "split",
        backgroundPlateEnabled: true,
        backgroundPlateOpacity: 40
      },
      video: {
        width: 1920,
        height: 1080,
        fps: 30,
        durationMs: 2000,
        durationInFrames: 60
      },
      lyrics: {
        current: null,
        next: null
      },
      assets: {
        getUrl: vi.fn()
      },
      prepared: {
        frames: [
          [0.2, 0.4, 0.6, 0.8]
        ]
      }
    });

    const frameState = equalizerComponent.browserRuntime?.getFrameState?.({
      instance: {
        id: "equalizer-1",
        componentId: "equalizer",
        componentName: "Equalizer",
        enabled: true,
        options: {}
      },
      options: {
        ...equalizerComponent.defaultOptions,
        minBarScale: 25,
        maxBarScale: 85,
        barCount: 4
      },
      frame: 1,
      timeMs: 33,
      video: {
        width: 1920,
        height: 1080,
        fps: 30,
        durationMs: 2000,
        durationInFrames: 60
      },
      lyrics: {
        current: null,
        next: null
      },
      assets: {
        getUrl: vi.fn()
      },
      prepared: {
        frames: [
          [0.2, 0.4, 0.6, 0.8],
          [0.8, 0.6, 0.4, 0.2]
        ]
      }
    });

    const equalizerInitialState = initialState as Record<string, unknown>;
    const equalizerFrameState = frameState as Record<string, unknown>;

    expect(equalizerInitialState).toMatchObject({
      isHorizontal: false,
      layoutMode: "split",
      gapSize: 24
    });
    expect(equalizerInitialState.entries).toHaveLength(5);

    const entries = equalizerInitialState.entries as Array<{ type: string; value?: number }>;
    expect(entries[0].type).toBe("bar");
    expect(entries[0].value).toBeCloseTo(0.37);
    expect(entries[1].type).toBe("bar");
    expect(entries[1].value).toBeCloseTo(0.49);
    expect(entries[2].type).toBe("gap");
    expect(entries[3].type).toBe("bar");
    expect(entries[3].value).toBeCloseTo(0.61);
    expect(entries[4].type).toBe("bar");
    expect(entries[4].value).toBeCloseTo(0.73);

    const values = equalizerFrameState.values as number[];
    expect(values).toHaveLength(4);
    expect(values[0]).toBeCloseTo(0.73);
    expect(values[1]).toBeCloseTo(0.61);
    expect(values[2]).toBeCloseTo(0.49);
    expect(values[3]).toBeCloseTo(0.37);
  });

  it("renders the equalizer with placement, plate, and configured bars", () => {
    render(
      equalizerComponent.Component({
        instance: {
          id: "equalizer-1",
          componentId: "equalizer",
          componentName: "Equalizer",
          enabled: true,
          options: {}
        },
        options: {
          ...equalizerComponent.defaultOptions,
          placement: "right-center",
          alignment: "end",
          barCount: 4,
          layoutMode: "split",
          backgroundPlateEnabled: true,
          backgroundPlateOpacity: 40
        },
        frame: 1,
        timeMs: 33,
        video: {
          width: 1920,
          height: 1080,
          fps: 30,
          durationMs: 2000,
          durationInFrames: 60
        },
        lyrics: createLyricRuntime([], 0),
        assets: {
          getUrl: vi.fn()
        },
        prepared: {
          frames: [
            [0.2, 0.4, 0.6, 0.8],
            [0.8, 0.6, 0.4, 0.2]
          ]
        }
      })
    );

    expect(document.querySelector("[data-equalizer-plate]")).toBeTruthy();
    expect(document.querySelectorAll("[data-equalizer-bar]")).toHaveLength(4);
    const track = document.querySelector("[data-equalizer-track]");
    expect(track).toHaveStyle({
      flexDirection: "column"
    });
    const wrapper = track?.parentElement as HTMLElement;
    expect(wrapper.style.right).toBe("24px");
    expect(wrapper.style.bottom).toBe("0px");
    expect(wrapper.style.width).toBe("14%");
    expect(wrapper.style.height).toBe("56%");
  });

  it("builds live DOM equalizer line state with intensity colors", () => {
    const initialState = equalizerComponent.browserRuntime?.getInitialState?.({
      instance: {
        id: "equalizer-line-1",
        componentId: "equalizer",
        componentName: "Equalizer",
        enabled: true,
        options: {}
      },
      options: {
        ...equalizerComponent.defaultOptions,
        graphMode: "line",
        lineStyle: "area",
        colorMode: "intensity",
        barCount: 4
      },
      video: {
        width: 1920,
        height: 1080,
        fps: 30,
        durationMs: 2000,
        durationInFrames: 60
      },
      lyrics: {
        current: null,
        next: null
      },
      assets: {
        getUrl: vi.fn()
      },
      prepared: {
        frames: [
          [0, 0.25, 0.5, 1]
        ]
      }
    });

    const frameState = equalizerComponent.browserRuntime?.getFrameState?.({
      instance: {
        id: "equalizer-line-1",
        componentId: "equalizer",
        componentName: "Equalizer",
        enabled: true,
        options: {}
      },
      options: {
        ...equalizerComponent.defaultOptions,
        graphMode: "line",
        lineStyle: "area",
        colorMode: "intensity",
        barCount: 4
      },
      frame: 0,
      timeMs: 0,
      video: {
        width: 1920,
        height: 1080,
        fps: 30,
        durationMs: 2000,
        durationInFrames: 60
      },
      lyrics: {
        current: null,
        next: null
      },
      assets: {
        getUrl: vi.fn()
      },
      prepared: {
        frames: [
          [0, 0.25, 0.5, 1]
        ]
      }
    });

    const equalizerInitialState = initialState as Record<string, unknown>;
    const equalizerFrameState = frameState as Record<string, unknown>;

    expect(equalizerInitialState).toMatchObject({
      graphMode: "line",
      lineStyle: "area",
      baseline: "bottom"
    });
    expect(equalizerInitialState.values).toEqual([0, 0.25, 0.5, 1]);
    expect(equalizerInitialState.colors).toEqual(["#7de2ff", "#3fc5f4", "#00a8e8", "#fde74c"]);
    expect(equalizerFrameState.colors).toEqual(["#7de2ff", "#3fc5f4", "#00a8e8", "#fde74c"]);
  });

  it("renders the equalizer line graph with area fill", () => {
    render(
      equalizerComponent.Component({
        instance: {
          id: "equalizer-line-1",
          componentId: "equalizer",
          componentName: "Equalizer",
          enabled: true,
          options: {}
        },
        options: {
          ...equalizerComponent.defaultOptions,
          graphMode: "line",
          lineStyle: "area",
          colorMode: "intensity",
          barCount: 4
        },
        frame: 0,
        timeMs: 0,
        video: {
          width: 1920,
          height: 1080,
          fps: 30,
          durationMs: 2000,
          durationInFrames: 60
        },
        lyrics: createLyricRuntime([], 0),
        assets: {
          getUrl: vi.fn()
        },
        prepared: {
          frames: [
            [0, 0.25, 0.5, 1]
          ]
        }
      })
    );

    const lineSvg = document.querySelector("[data-equalizer-line]");
    expect(lineSvg).toBeTruthy();
    expect(document.querySelectorAll("[data-equalizer-bar]")).toHaveLength(0);
    expect(lineSvg?.querySelectorAll("path")).toHaveLength(2);
    expect(lineSvg?.querySelectorAll("stop")).toHaveLength(4);
  });
});

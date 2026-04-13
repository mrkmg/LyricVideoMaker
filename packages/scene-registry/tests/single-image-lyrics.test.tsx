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
      flexDirection: "row"
    });
    const wrapper = track?.parentElement as HTMLElement;
    expect(wrapper.style.left).toBe("0%");
    expect(wrapper.style.top).toBe("0%");
    expect(wrapper.style.width).toBe("100%");
    expect(wrapper.style.height).toBe("100%");
    expect(wrapper.style.transform).toBe("translate(0%, 0%)");
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

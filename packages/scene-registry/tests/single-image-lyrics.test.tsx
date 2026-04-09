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
    expect(lyricContainer).toHaveStyle({
      alignItems: "flex-start",
      padding: "110px 140px 0"
    });
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
});

import { describe, expect, it } from "vitest";
import { validateSceneOptions } from "../src/scenes";
import type { SceneComponentDefinition } from "../src/types";

interface VideoFieldOptions {
  clip: string;
}

const videoComponent: SceneComponentDefinition<VideoFieldOptions> = {
  id: "video-under-test",
  name: "Video Under Test",
  options: [{ type: "video", id: "clip", label: "Clip", required: true }],
  defaultOptions: { clip: "" },
  Component: () => null
};

interface OptionalVideoOptions {
  overlay: string;
}

const optionalVideoComponent: SceneComponentDefinition<OptionalVideoOptions> = {
  id: "video-optional",
  name: "Video Optional",
  options: [{ type: "video", id: "overlay", label: "Overlay" }],
  defaultOptions: { overlay: "" },
  Component: () => null
};

describe("video field validation (T-008 / video-field-type R2)", () => {
  it("missing required video field throws the same category of error as missing image", () => {
    expect(() =>
      validateSceneOptions(videoComponent, { clip: "" }, { isFileAccessible: () => true })
    ).toThrow(/is required/);
  });

  it("undefined required video field throws required error", () => {
    expect(() =>
      validateSceneOptions(videoComponent, {}, { isFileAccessible: () => true })
    ).toThrow(/is required/);
  });

  it("non-existent or inaccessible video path throws validation error", () => {
    expect(() =>
      validateSceneOptions(
        videoComponent,
        { clip: "/definitely/missing.mp4" },
        { isFileAccessible: () => false }
      )
    ).toThrow(/does not point to a readable file/);
  });

  it("accessible video path passes validation", () => {
    const result = validateSceneOptions(
      videoComponent,
      { clip: "/some/valid.mp4" },
      { isFileAccessible: () => true }
    );
    expect(result.clip).toBe("/some/valid.mp4");
  });

  it("optional video field accepts empty value", () => {
    const result = validateSceneOptions(
      optionalVideoComponent,
      {},
      { isFileAccessible: () => true }
    );
    expect(result.overlay).toBe("");
  });

  it("shared file-accessibility helper is called with the video path", () => {
    const calls: string[] = [];
    validateSceneOptions(
      videoComponent,
      { clip: "/shared/helper.mp4" },
      {
        isFileAccessible: (p) => {
          calls.push(p);
          return true;
        }
      }
    );
    expect(calls).toEqual(["/shared/helper.mp4"]);
  });
});

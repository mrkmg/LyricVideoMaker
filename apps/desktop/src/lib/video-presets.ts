export interface VideoSizePreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

export interface FpsPreset {
  id: string;
  label: string;
  fps: number;
}

export const VIDEO_SIZE_PRESETS: VideoSizePreset[] = [
  { id: "4k", label: "4K (3840x2160)", width: 3840, height: 2160 },
  { id: "2k", label: "2K (2560x1440)", width: 2560, height: 1440 },
  { id: "1080", label: "1080p (1920x1080)", width: 1920, height: 1080 },
  { id: "720", label: "720p (1280x720)", width: 1280, height: 720 },
  { id: "1024-square", label: "1024 Square (1024x1024)", width: 1024, height: 1024 }
];

export const FPS_PRESETS: FpsPreset[] = [
  { id: "15", label: "15 fps", fps: 15 },
  { id: "20", label: "20 fps", fps: 20 },
  { id: "30", label: "30 fps", fps: 30 },
  { id: "60", label: "60 fps", fps: 60 }
];

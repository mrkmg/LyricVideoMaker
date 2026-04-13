# Scenes & Components

Lyric Video Maker builds videos from **scenes** composed of **components**. Understanding how these work is key to creating the video you want.

## What is a Scene?

A scene is a saved arrangement of components — a reusable template for your video's visual layout. For example, the built-in "Single Image Lyrics" scene includes a background image, an optional color overlay, and lyrics display.

Scenes can come from three sources:

- **Built-in** — Ship with the app.
- **User** — Scenes you've saved yourself.
- **Plugin** — Added by installed plugins.

You can select a scene from the dropdown in the Scene Editor (click the **Scene** button at the top of the Scene Builder panel). When you pick a different scene and the current scene already has components, a dialog asks how to apply it:

- **Replace** — Swap the entire scene, removing all current components.
- **Add to Existing** — Keep the current scene and append the new scene's components to the stack.

If the current scene has no components the new scene is loaded directly without prompting.

## What is a Component?

A component is a single visual layer in your video. Components stack on top of each other — the first component in the list draws at the back, the last draws in front.

Each component has its own set of configurable options. Click a component in the Scene Builder to view and edit its options in the panel below.

## Built-in Components

### Background Image

Covers the entire frame with a single image for the full duration of the video.

**Options:**
| Option | Description |
|--------|-------------|
| Background Image | Pick an image file (PNG, JPG, WebP) |

### Background Color

Adds a gradient color wash over the full frame. Useful for darkening a background image so lyrics are more readable.

**Options:**
| Option | Default | Description |
|--------|---------|-------------|
| Color Top | `#09090f` | Top edge color |
| Color Top Opacity | 60% | Top color transparency |
| Color Bottom | `#09090f` | Bottom edge color |
| Color Bottom Opacity | 60% | Bottom color transparency |

### Lyrics by Line

The main lyric display component. Shows each subtitle cue one at a time with configurable styling and animations.

**Lyrics options:**
| Option | Default | Description |
|--------|---------|-------------|
| Lyric Size | 72px | Font size (24–180) |
| Force Single Line | Off | Prevent line wrapping |
| Horizontal Padding | 140 | Left/right padding |
| Lyric Font | Roboto | Google Fonts font family |
| Lyric Color | White | Text color |
| Lyric Position | Bottom | Vertical placement (Top / Middle / Bottom) |

**Fade In / Fade Out** (collapsible):
| Option | Default | Description |
|--------|---------|-------------|
| Fade Time | 180ms | Duration of the fade (0–5000ms) |
| Easing | Ease Out / Ease In | Animation curve |

**Border** (collapsible):
| Option | Default | Description |
|--------|---------|-------------|
| Enable Border | Off | Toggle text border |
| Border Color | Black | Border color |
| Border Thickness | 4 | Border width (0–20) |

**Shadow** (collapsible):
| Option | Default | Description |
|--------|---------|-------------|
| Enable Shadow | On | Toggle text shadow |
| Shadow Color | Black | Shadow color |
| Shadow Intensity | 55% | Shadow strength |

### Equalizer

An audio-reactive visualizer that responds to your music in real time. Supports bar and line graph modes.

**Layout:**
| Option | Default | Description |
|--------|---------|-------------|
| Bar Orientation | Horizontal | Direction of the bars |
| Inner Padding | 24 | Padding inside the component |

**Graph:**
| Option | Default | Description |
|--------|---------|-------------|
| Graph Mode | Bars | Bars or Line rendering |
| Line Style | Stroke | Stroke or filled Area (line mode) |
| Line Baseline | Bottom | Where lines anchor from |

**Bars:**
| Option | Default | Description |
|--------|---------|-------------|
| Bar Count | 28 | Number of bars (4–128) |
| Bar Gap | 6 | Space between bars |
| Corner Radius | 999 | Bar corner rounding |
| Min / Max Bar Scale | 12% / 100% | Height range |
| Layout Mode | Mirrored | Single, Mirrored, or Split |
| Growth Direction | Outward | Where bars grow from |

**Audio Response** (collapsible):
| Option | Default | Description |
|--------|---------|-------------|
| Min / Max Frequency | 40 / 3200 Hz | Frequency range to visualize |
| Analysis FPS | 48 | Audio sample rate |
| Sensitivity | 1.4 | Response strength (0.1–4.0) |
| Smoothing | 35% | Frame-to-frame smoothing |
| Attack / Release | 35 / 240ms | Response and decay speed |
| Band Distribution | Log | Linear or logarithmic |

**Colors** (collapsible):
| Option | Default | Description |
|--------|---------|-------------|
| Color Mode | Gradient | Solid, Gradient, or Intensity |
| Primary Color | `#7DE2FF` | Main bar color |
| Secondary Color | `#00A8E8` | Gradient end color |
| Opacity | 85% | Overall transparency |

**Effects** (collapsible):
| Option | Default | Description |
|--------|---------|-------------|
| Enable Glow | On | Glow effect around bars |
| Glow Color | `#7DE2FF` | Glow color |
| Cap Style | Rounded | Square or Rounded bar caps |

### Static Text

Fixed text that stays on screen for the duration (or a timed portion) of the video. Useful for song titles, artist credits, or watermarks.

**Content:**
| Option | Default | Description |
|--------|---------|-------------|
| Text | "Static Text" | The text to display |
| Case | As Typed | Uppercase, lowercase, or Title Case |
| Enable Tokens | Off | Use dynamic text tokens |

**Typography:**
| Option | Default | Description |
|--------|---------|-------------|
| Font Family | Roboto | Google Fonts font |
| Font Size | 72px | Size (8–400) |
| Font Weight | 600 | Boldness (100–900) |
| Letter Spacing | 0 | Character spacing |
| Line Height | 1.15 | Line spacing multiplier |
| Align | Center | Text alignment |

**Color:**
| Option | Default | Description |
|--------|---------|-------------|
| Color | White | Text color |
| Color Mode | Solid | Solid or Gradient fill |

**Box:**
| Option | Default | Description |
|--------|---------|-------------|
| Backdrop Enabled | Off | Background box behind text |
| Backdrop Color | Black | Box color |
| Backdrop Opacity | 60% | Box transparency |
| Backdrop Radius | 12 | Corner rounding |

### Shape

Geometric primitives with fill, stroke, and effects. Useful for decorative elements, dividers, or frames.

**Geometry:**
| Option | Default | Description |
|--------|---------|-------------|
| Shape | Rectangle | Rectangle, Circle, Ellipse, Triangle, Line, or Regular Polygon |
| Polygon Sides | 6 | Sides (3–12) for polygon mode |
| Corner Radius | 0 | Corner rounding (0–200) |

**Fill:**
| Option | Default | Description |
|--------|---------|-------------|
| Fill Enabled | On | Toggle fill |
| Fill Mode | Solid | Solid or Gradient |
| Fill Color | `#4da3ff` | Fill color |
| Fill Opacity | 100% | Fill transparency |

**Stroke:**
| Option | Default | Description |
|--------|---------|-------------|
| Stroke Enabled | Off | Toggle outline |
| Stroke Color | White | Outline color |
| Stroke Width | 2 | Outline thickness |

### Image

A static or positioned image layer. Use it for logos, overlays, or decorative elements.

**Source:**
| Option | Description |
|--------|-------------|
| Image Source | Pick an image (PNG, JPG, WebP) |

**Fit:**
| Option | Default | Description |
|--------|---------|-------------|
| Fit Mode | Contain | Contain, Cover, Fill, or None |
| Preserve Aspect Ratio | On | Maintain proportions |

**Appearance:**
| Option | Default | Description |
|--------|---------|-------------|
| Opacity | 100% | Image transparency |
| Corner Radius | 0 | Corner rounding |

**Effects** include border, tint, shadow, glow, and image filters (grayscale, blur, brightness, contrast, saturation).

### Video

An embedded video clip layer. Use it for animated backgrounds, overlays, or picture-in-picture.

**Source:**
| Option | Default | Description |
|--------|---------|-------------|
| Video Source | — | Pick a video file (MP4, WebM, MOV, MKV) |
| Muted | On | Mute the video's audio |

**Playback:**
| Option | Default | Description |
|--------|---------|-------------|
| Playback Mode | Sync with Song | Sync, Loop, Play Once (Clamp), or Play Once (Hide) |
| Video Start Offset | 0ms | Skip into the video |
| Playback Speed | 1.0x | Speed multiplier (0.1–8.0) |

**Fit:**
| Option | Default | Description |
|--------|---------|-------------|
| Fit Mode | Contain | Contain, Cover, or Fill |
| Corner Radius | 0 | Corner rounding |

**Appearance** and **Effects** are similar to the Image component — opacity, tint, filters, border, shadow, and glow.

## Common Options: Transform & Timing

Most components include two shared option categories:

### Transform

Controls position, size, and rotation within the video frame.

| Option | Default | Description |
|--------|---------|-------------|
| X / Y | 0 | Position offset |
| Width / Height | 100% | Size relative to frame |
| Anchor | Top Left | Reference point for positioning |
| Rotation | 0° | Rotation angle |
| Flip | None | Horizontal or vertical flip |

### Timing

Controls when a component appears and disappears.

| Option | Default | Description |
|--------|---------|-------------|
| Start Time | 0ms | When to show the component |
| End Time | — | When to hide (blank = entire video) |
| Fade In | 0ms | Fade-in duration |
| Fade Out | 0ms | Fade-out duration |

## Working with Components

### Adding a component

Use the **Add component** dropdown in the Scene Builder to choose a component type, then click **Add**.

### Reordering layers

Components render bottom-to-top. The first component in the list is the furthest back. Use the up/down arrow buttons to reorder.

### Saving your scene

After arranging your components the way you like, click the **Scene** button, then **Save as User Scene** to save it as a reusable preset. Saved scenes appear in the scene preset dropdown for future projects.

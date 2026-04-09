import type { ComposerState } from "../composer-types";
import type { FilePickKind } from "../electron-api";
import { FileField } from "./form-fields";

export function SourceFilesPanel({
  composer,
  onPickPath
}: {
  composer: ComposerState;
  onPickPath: (kind: FilePickKind) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Import</p>
          <h2>Source files</h2>
        </div>
        <button className="secondary" onClick={() => onPickPath("output")}>
          Choose output
        </button>
      </div>

      <div className="field-grid">
        <FileField
          label="Song audio"
          value={composer.audioPath}
          buttonLabel="Pick MP3"
          onPick={() => onPickPath("audio")}
        />
        <FileField
          label="Lyric subtitles"
          value={composer.subtitlePath}
          buttonLabel="Pick SRT"
          onPick={() => onPickPath("subtitle")}
        />
        <FileField
          label="Output MP4"
          value={composer.outputPath}
          buttonLabel="Save As"
          onPick={() => onPickPath("output")}
        />
      </div>
    </section>
  );
}

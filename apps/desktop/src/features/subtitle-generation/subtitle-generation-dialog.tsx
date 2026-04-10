import React from "react";
import type {
  StartSubtitleGenerationRequest,
  SubtitleGenerationProgressEvent
} from "../../electron-api";
import { FileField, InfoTip, SelectField } from "../../components/ui/form-fields";

const ALIGNMENT_LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" }
];

const TRANSCRIPTION_LANGUAGE_OPTIONS = [
  { value: "auto", label: "Auto Detect" },
  ...ALIGNMENT_LANGUAGE_OPTIONS
];

export function SubtitleGenerationDialog({
  isOpen,
  request,
  progress,
  canStart,
  isGenerating,
  onRequestChange,
  onPickLyricsText,
  onStart,
  onCancel,
  onDismiss
}: {
  isOpen: boolean;
  request: StartSubtitleGenerationRequest;
  progress: SubtitleGenerationProgressEvent | null;
  canStart: boolean;
  isGenerating: boolean;
  onRequestChange: (request: StartSubtitleGenerationRequest) => void;
  onPickLyricsText: () => void;
  onStart: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
  onDismiss: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  const isAlignment = request.mode === "align";
  const dialogTitle = isGenerating ? "Generating Subtitles" : "Generate Subtitle SRT";
  const languageOptions = isAlignment
    ? ALIGNMENT_LANGUAGE_OPTIONS
    : TRANSCRIPTION_LANGUAGE_OPTIONS;

  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="dialog-card subtitle-dialog-card" role="dialog" aria-modal="true" aria-labelledby="subtitle-dialog-title">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Automatic Subtitles</p>
            <div className="panel-title-row">
              <h2 id="subtitle-dialog-title">{dialogTitle}</h2>
              <InfoTip text="Create an SRT from audio only or align a lyrics TXT file against the song." />
            </div>
          </div>
          {progress ? <span className={`status status-${progress.status}`}>{progress.status}</span> : null}
        </div>

        <div className="dialog-body subtitle-dialog-body">
          <div className="inspector-grid inspector-grid-two">
            <SelectField
              label="Mode"
              helpText="Transcribe audio directly or align a provided lyrics TXT file."
              value={request.mode}
              disabled={isGenerating}
              options={[
                { value: "transcribe", label: "Full Transcription" },
                { value: "align", label: "Alignment" }
              ]}
              onChange={(mode) =>
                onRequestChange({
                  ...request,
                  mode: mode as StartSubtitleGenerationRequest["mode"],
                  language: mode === "align" && request.language === "auto" ? "en" : request.language
                })
              }
            />

            <SelectField
              label="Language"
              helpText={isAlignment ? "Alignment requires the language of the lyrics." : "Use auto detect or force a language."}
              value={request.language}
              disabled={isGenerating}
              options={languageOptions}
              onChange={(language) => onRequestChange({ ...request, language })}
            />
          </div>

          {isAlignment ? (
            <FileField
              label="Lyrics TXT"
              helpText="Each non-empty line is treated as the lyric line to preserve in the generated SRT."
              value={request.lyricsTextPath ?? ""}
              buttonLabel="Pick TXT"
              disabled={isGenerating}
              onPick={onPickLyricsText}
            />
          ) : null}

          {progress ? (
            <>
              <div className="scene-status-card">
                <span className="eyebrow">Status</span>
                <strong>{progress.message}</strong>
                {progress.outputPath ? <p>{progress.outputPath}</p> : null}
                {progress.error ? <p className="history-error">{progress.error}</p> : null}
              </div>
              <div className="progress-track dialog-progress-track">
                <div
                  className="progress-value"
                  style={{ width: `${Math.max(0, Math.min(100, progress.progress))}%` }}
                />
              </div>
            </>
          ) : null}
        </div>

        <div className="dialog-actions">
          {isGenerating ? (
            <button type="button" className="secondary danger" onClick={onCancel}>
              Cancel Generation
            </button>
          ) : (
            <>
              <button type="button" className="secondary" onClick={onDismiss}>
                Close
              </button>
              <button type="button" className="primary" disabled={!canStart} onClick={onStart}>
                Generate SRT
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

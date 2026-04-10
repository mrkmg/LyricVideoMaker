import type { RenderPreviewRequest, RenderPreviewResponse } from "../../../src/electron-api";

export interface PreviewWorkerRenderFrameRequest {
  type: "render-frame";
  requestId: number;
  payload: RenderPreviewRequest;
}

export interface PreviewWorkerDisposeRequest {
  type: "dispose-preview";
  requestId: number;
}

export type PreviewWorkerRequest =
  | PreviewWorkerRenderFrameRequest
  | PreviewWorkerDisposeRequest;

export interface PreviewWorkerSuccessResponse {
  type: "success";
  requestId: number;
  payload: RenderPreviewResponse | null;
}

export interface PreviewWorkerErrorResponse {
  type: "error";
  requestId: number;
  error: {
    message: string;
    stack?: string;
  };
}

export type PreviewWorkerResponse =
  | PreviewWorkerSuccessResponse
  | PreviewWorkerErrorResponse;

import React, { useEffect, useRef, useState } from "react";
import type { PaneLayoutPreferences } from "../electron-api";
import { lyricVideoApp } from "../ipc/lyric-video-app";
import { clamp } from "../lib/clamp";

const SIDEBAR_MIN_WIDTH = 280;
const SIDEBAR_MAX_GUTTER = 540;
const INSPECTOR_MIN_HEIGHT = 250;
const INSPECTOR_MAX_GUTTER = 240;

export type ResizeHandle = "general" | "sidebar" | "inspector";

interface ResizeState {
  handle: ResizeHandle;
  startX: number;
  startY: number;
  startGeneralWidth: number;
  startWidth: number;
  startHeight: number;
}

export interface LayoutResize {
  generalPaneWidth: number;
  sidebarWidth: number;
  inspectorHeight: number;
  isLayoutReady: boolean;
  activeResizeHandle: ResizeHandle | null;
  workspaceRef: React.MutableRefObject<HTMLElement | null>;
  mainPaneRef: React.MutableRefObject<HTMLElement | null>;
  startResize(handle: ResizeHandle, event: React.MouseEvent<HTMLDivElement>): void;
}

interface UseLayoutResizeOptions {
  bootstrapLoaded: boolean;
  initialPaneLayout?: PaneLayoutPreferences;
}

const DEFAULT_PANE_LAYOUT: PaneLayoutPreferences = {
  generalPaneWidth: 360,
  sidebarWidth: 300,
  inspectorHeight: 300
};

export function useLayoutResize({
  bootstrapLoaded,
  initialPaneLayout
}: UseLayoutResizeOptions): LayoutResize {
  const [generalPaneWidth, setGeneralPaneWidth] = useState(360);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [inspectorHeight, setInspectorHeight] = useState(300);
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  const [activeResizeHandle, setActiveResizeHandle] = useState<ResizeHandle | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const mainPaneRef = useRef<HTMLElement | null>(null);
  const resizeStateRef = useRef<ResizeState | null>(null);
  const paneLayoutRef = useRef<PaneLayoutPreferences>(DEFAULT_PANE_LAYOUT);
  const appliedInitialLayoutRef = useRef(false);

  useEffect(() => {
    if (!bootstrapLoaded || appliedInitialLayoutRef.current) {
      return;
    }

    const nextLayout = sanitizeInitialPaneLayout(initialPaneLayout ?? DEFAULT_PANE_LAYOUT);
    paneLayoutRef.current = nextLayout;
    setGeneralPaneWidth(nextLayout.generalPaneWidth);
    setSidebarWidth(nextLayout.sidebarWidth);
    setInspectorHeight(nextLayout.inspectorHeight);
    appliedInitialLayoutRef.current = true;
    setIsLayoutReady(true);
  }, [bootstrapLoaded, initialPaneLayout]);

  useEffect(() => {
    function handlePointerMove(event: MouseEvent) {
      const resizeState = resizeStateRef.current;
      if (!resizeState) {
        return;
      }

      if (resizeState.handle === "general" || resizeState.handle === "sidebar") {
        const containerWidth = workspaceRef.current?.clientWidth ?? window.innerWidth;
        const reservedWidth =
          resizeState.handle === "general"
            ? paneLayoutRef.current.sidebarWidth
            : resizeState.startGeneralWidth;
        const maxWidth = Math.max(SIDEBAR_MIN_WIDTH, containerWidth - reservedWidth - SIDEBAR_MAX_GUTTER);
        const nextWidth = clamp(
          resizeState.startWidth + event.clientX - resizeState.startX,
          SIDEBAR_MIN_WIDTH,
          maxWidth
        );

        if (resizeState.handle === "general") {
          setGeneralPaneWidthValue(nextWidth);
          return;
        }

        setSidebarWidthValue(
          clamp(
            nextWidth,
            SIDEBAR_MIN_WIDTH,
            maxWidth
          )
        );
        return;
      }

      const containerHeight = mainPaneRef.current?.clientHeight ?? window.innerHeight;
      const maxHeight = Math.max(INSPECTOR_MIN_HEIGHT, containerHeight - INSPECTOR_MAX_GUTTER);
      setInspectorHeightValue(
        clamp(
          resizeState.startHeight - (event.clientY - resizeState.startY),
          INSPECTOR_MIN_HEIGHT,
          maxHeight
        )
      );
    }

    function stopResize() {
      const wasResizing = resizeStateRef.current !== null;
      resizeStateRef.current = null;
      setActiveResizeHandle(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (wasResizing) {
        void lyricVideoApp.savePaneLayout(paneLayoutRef.current).catch((error) => {
          console.warn("Failed to save pane layout.", error);
        });
      }
    }

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", stopResize);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", stopResize);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  function startResize(handle: ResizeHandle, event: React.MouseEvent<HTMLDivElement>) {
    resizeStateRef.current = {
      handle,
      startX: event.clientX,
      startY: event.clientY,
      startGeneralWidth: paneLayoutRef.current.generalPaneWidth,
      startWidth:
        handle === "general"
          ? paneLayoutRef.current.generalPaneWidth
          : paneLayoutRef.current.sidebarWidth,
      startHeight: paneLayoutRef.current.inspectorHeight
    };
    setActiveResizeHandle(handle);
    document.body.style.cursor = handle === "inspector" ? "row-resize" : "col-resize";
    document.body.style.userSelect = "none";
  }

  return {
    generalPaneWidth,
    sidebarWidth,
    inspectorHeight,
    isLayoutReady,
    activeResizeHandle,
    workspaceRef,
    mainPaneRef,
    startResize
  };

  function setGeneralPaneWidthValue(value: number) {
    paneLayoutRef.current = {
      ...paneLayoutRef.current,
      generalPaneWidth: value
    };
    setGeneralPaneWidth(value);
  }

  function setSidebarWidthValue(value: number) {
    paneLayoutRef.current = {
      ...paneLayoutRef.current,
      sidebarWidth: value
    };
    setSidebarWidth(value);
  }

  function setInspectorHeightValue(value: number) {
    paneLayoutRef.current = {
      ...paneLayoutRef.current,
      inspectorHeight: value
    };
    setInspectorHeight(value);
  }
}

function sanitizeInitialPaneLayout(panes: PaneLayoutPreferences): PaneLayoutPreferences {
  return {
    generalPaneWidth: clamp(Math.round(panes.generalPaneWidth), SIDEBAR_MIN_WIDTH, 10000),
    sidebarWidth: clamp(Math.round(panes.sidebarWidth), SIDEBAR_MIN_WIDTH, 10000),
    inspectorHeight: clamp(Math.round(panes.inspectorHeight), INSPECTOR_MIN_HEIGHT, 10000)
  };
}

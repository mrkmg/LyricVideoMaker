import React, { useEffect, useRef, useState } from "react";
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
  activeResizeHandle: ResizeHandle | null;
  workspaceRef: React.MutableRefObject<HTMLElement | null>;
  mainPaneRef: React.MutableRefObject<HTMLElement | null>;
  startResize(handle: ResizeHandle, event: React.MouseEvent<HTMLDivElement>): void;
}

export function useLayoutResize(): LayoutResize {
  const [generalPaneWidth, setGeneralPaneWidth] = useState(360);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [inspectorHeight, setInspectorHeight] = useState(300);
  const [activeResizeHandle, setActiveResizeHandle] = useState<ResizeHandle | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const mainPaneRef = useRef<HTMLElement | null>(null);
  const resizeStateRef = useRef<ResizeState | null>(null);

  useEffect(() => {
    function handlePointerMove(event: MouseEvent) {
      const resizeState = resizeStateRef.current;
      if (!resizeState) {
        return;
      }

      if (resizeState.handle === "general" || resizeState.handle === "sidebar") {
        const containerWidth = workspaceRef.current?.clientWidth ?? window.innerWidth;
        const reservedWidth =
          resizeState.handle === "general" ? sidebarWidth : resizeState.startGeneralWidth;
        const maxWidth = Math.max(SIDEBAR_MIN_WIDTH, containerWidth - reservedWidth - SIDEBAR_MAX_GUTTER);
        const nextWidth = clamp(
          resizeState.startWidth + event.clientX - resizeState.startX,
          SIDEBAR_MIN_WIDTH,
          maxWidth
        );

        if (resizeState.handle === "general") {
          setGeneralPaneWidth(nextWidth);
          return;
        }

        setSidebarWidth(
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
      setInspectorHeight(
        clamp(
          resizeState.startHeight - (event.clientY - resizeState.startY),
          INSPECTOR_MIN_HEIGHT,
          maxHeight
        )
      );
    }

    function stopResize() {
      resizeStateRef.current = null;
      setActiveResizeHandle(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
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
      startGeneralWidth: generalPaneWidth,
      startWidth: handle === "general" ? generalPaneWidth : sidebarWidth,
      startHeight: inspectorHeight
    };
    setActiveResizeHandle(handle);
    document.body.style.cursor = handle === "inspector" ? "row-resize" : "col-resize";
    document.body.style.userSelect = "none";
  }

  return {
    generalPaneWidth,
    sidebarWidth,
    inspectorHeight,
    activeResizeHandle,
    workspaceRef,
    mainPaneRef,
    startResize
  };
}

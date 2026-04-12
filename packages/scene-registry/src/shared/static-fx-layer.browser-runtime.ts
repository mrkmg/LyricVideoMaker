export const staticFxLayerBrowserScript = `
window.__registerLiveDomRuntime("static-fx-layer", {
  mount: function(layer, initialState) {
    var container = document.createElement("div");
    if (initialState && initialState.containerStyle) {
      window.__liveDomUtils.applyStyles(container, initialState.containerStyle);
    }
    if (initialState && typeof initialState.html === "string") {
      container.innerHTML = initialState.html;
    }
    if (initialState && typeof initialState.initialOpacity === "number") {
      container.style.opacity = String(initialState.initialOpacity);
    }
    layer.appendChild(container);
    return { container: container };
  },
  update: function(handle, state) {
    if (!handle || !handle.container || !state) {
      return;
    }
    if (typeof state.opacity === "number") {
      handle.container.style.opacity = String(state.opacity);
    }
  }
});
`;

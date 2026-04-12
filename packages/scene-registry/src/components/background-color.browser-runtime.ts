export const backgroundColorBrowserScript = `
window.__registerLiveDomRuntime("background-color", {
  mount: function(layer, initialState) {
    var gradient = document.createElement("div");
    window.__liveDomUtils.applyStyles(gradient, {
      position: "absolute",
      inset: "0",
      background: initialState && initialState.background ? initialState.background : "transparent",
      contain: "paint"
    });
    layer.appendChild(gradient);
    return { gradient: gradient };
  },
  update: function() {}
});
`;

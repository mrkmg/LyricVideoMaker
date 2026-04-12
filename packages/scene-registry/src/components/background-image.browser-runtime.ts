export const backgroundImageBrowserScript = `
window.__registerLiveDomRuntime("background-image", {
  mount: function(layer, initialState) {
    if (!initialState || !initialState.imageUrl) {
      return null;
    }

    var image = document.createElement("img");
    image.src = initialState.imageUrl;
    image.alt = "";
    window.__liveDomUtils.applyStyles(image, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      transform: "scale(1.03)",
      contain: "paint"
    });
    layer.appendChild(image);
    return { image: image };
  },
  update: function() {}
});
`;

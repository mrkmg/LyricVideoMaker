export const lyricsByLineBrowserScript = `
window.__registerLiveDomRuntime("lyrics-by-line", {
  mount: function(layer, initialState) {
    var applyStyles = window.__liveDomUtils.applyStyles;

    var wrapper = document.createElement("div");
    if (initialState && initialState.containerStyle) {
      applyStyles(wrapper, initialState.containerStyle);
    }
    applyStyles(wrapper, {
      display: "flex",
      justifyContent: "center",
      boxSizing: "border-box",
      contain: "layout style",
      alignItems: initialState.alignItems,
      padding: initialState.padding,
      color: initialState.color,
      fontFamily: initialState.fontFamily
    });

    var text = document.createElement("div");
    applyStyles(text, {
      display: "inline-block",
      maxWidth: "100%",
      textAlign: "center",
      fontWeight: "700",
      lineHeight: "1.15",
      letterSpacing: "-0.03em",
      whiteSpace: initialState.whiteSpace,
      willChange: "opacity",
      contain: "layout style",
      opacity: "0"
    });

    wrapper.appendChild(text);
    layer.appendChild(wrapper);
    return { wrapper: wrapper, text: text };
  },
  update: function(handle, state) {
    if (!handle) {
      return;
    }

    if (typeof state.text === "string" && handle.text.textContent !== state.text) {
      handle.text.textContent = state.text;
    }

    if (state.fontSize !== undefined) {
      handle.text.style.fontSize = String(state.fontSize) + "px";
    }

    handle.text.style.padding = state.padding ? String(state.padding) : "0px";
    handle.text.style.textShadow = state.textShadow ? String(state.textShadow) : "none";
    handle.text.style.webkitTextStroke = state.webkitTextStroke ? String(state.webkitTextStroke) : "";
    handle.text.style.opacity = String(state.opacity ?? 0);
  }
});
`;

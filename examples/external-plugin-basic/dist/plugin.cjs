"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/plugin.ts
var plugin_exports = {};
__export(plugin_exports, {
  activate: () => activate
});
module.exports = __toCommonJS(plugin_exports);
var import_plugin_base = require("@lyric-video-maker/plugin-base");
function activate(_host) {
  const { React } = _host;
  const defaultOptions = {
    textColor: "#ffffff",
    backgroundColor: "#111827",
    fontSize: 72
  };
  const options = [
    { id: "textColor", label: "Text color", type: "color", defaultValue: "#ffffff" },
    { id: "backgroundColor", label: "Background color", type: "color", defaultValue: "#111827" },
    {
      id: "fontSize",
      label: "Font size",
      type: "number",
      defaultValue: 72,
      min: 24,
      max: 180,
      step: 1
    }
  ];
  const captionBoxComponent = {
    id: "example.caption-box",
    name: "Caption Box",
    description: "Centered caption box driven by current lyric cue.",
    staticWhenMarkupUnchanged: false,
    options,
    defaultOptions,
    Component({ options: options2, lyrics }) {
      const text = lyrics.current?.text ?? "External caption plugin";
      return React.createElement(
        "div",
        {
          style: {
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: "transparent"
          }
        },
        React.createElement(
          "div",
          {
            style: {
              maxWidth: "80%",
              padding: "28px 42px",
              borderRadius: 8,
              textAlign: "center",
              fontFamily: "Arial, sans-serif",
              fontWeight: 800,
              lineHeight: 1.1,
              color: options2.textColor,
              background: options2.backgroundColor,
              fontSize: options2.fontSize,
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.35)"
            }
          },
          text
        )
      );
    }
  };
  return {
    components: [captionBoxComponent],
    scenes: [
      {
        id: "example.caption-demo",
        name: "Example Caption Demo",
        description: "External plugin scene using the caption box component.",
        source: "plugin",
        readOnly: true,
        components: [
          {
            id: "bg",
            componentId: "image",
            enabled: true,
            modifiers: [],
            options: {
              source: (0, import_plugin_base.createPluginAssetUri)("example.caption-pack", "assets/default-bg.png")
            }
          },
          {
            id: "caption-box-1",
            componentId: "example.caption-box",
            enabled: true,
            modifiers: [],
            options: defaultOptions
          }
        ]
      }
    ]
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate
});

export const equalizerBrowserScript = `
(function() {
  var applyStyles = window.__liveDomUtils.applyStyles;

  function createEqualizerBarDescriptor(handle, entry, initialState, track) {
    if (entry.type === "gap") {
      var gap = document.createElement("div");
      gap.style.flex = "0 0 " + String(initialState.gapSize) + "px";
      track.appendChild(gap);
      return null;
    }

    var bar = document.createElement("div");
    bar.dataset.equalizerBar = "";
    bar.style.position = "relative";
    bar.style.flex = "1";
    if (initialState.isHorizontal) {
      bar.style.height = "100%";
    } else {
      bar.style.width = "100%";
    }

    var descriptor = {
      type: initialState.layoutMode,
      isHorizontal: initialState.isHorizontal,
      growthDirection: initialState.growthDirection,
      fills: []
    };

    if (initialState.layoutMode === "mirrored") {
      if (initialState.isHorizontal) {
        var upper = document.createElement("div");
        applyStyles(upper, {
          position: "absolute",
          left: "0",
          right: "0",
          top: "0",
          bottom: "50%",
          background: entry.color,
          borderRadius: initialState.borderRadius,
          opacity: initialState.opacity,
          boxShadow: initialState.boxShadow,
          transformOrigin: "center bottom",
          willChange: "transform",
          contain: "layout paint style"
        });
        var lower = upper.cloneNode(false);
        lower.style.top = "50%";
        lower.style.bottom = "0";
        lower.style.transformOrigin = "center top";
        bar.appendChild(upper);
        bar.appendChild(lower);
        descriptor.fills.push(upper, lower);
      } else {
        var left = document.createElement("div");
        applyStyles(left, {
          position: "absolute",
          top: "0",
          bottom: "0",
          left: "0",
          right: "50%",
          background: entry.color,
          borderRadius: initialState.borderRadius,
          opacity: initialState.opacity,
          boxShadow: initialState.boxShadow,
          transformOrigin: "right center",
          willChange: "transform",
          contain: "layout paint style"
        });
        var right = left.cloneNode(false);
        right.style.left = "50%";
        right.style.right = "0";
        right.style.transformOrigin = "left center";
        bar.appendChild(left);
        bar.appendChild(right);
        descriptor.fills.push(left, right);
      }
    } else {
      var fill = document.createElement("div");
      applyStyles(fill, {
        position: "absolute",
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
        background: entry.color,
        borderRadius: initialState.borderRadius,
        opacity: initialState.opacity,
        boxShadow: initialState.boxShadow,
        willChange: "transform",
        contain: "layout paint style"
      });

      if (initialState.isHorizontal) {
        fill.style.transformOrigin =
          initialState.growthDirection === "down"
            ? "center top"
            : initialState.growthDirection === "outward"
              ? "center center"
              : "center bottom";
      } else {
        fill.style.transformOrigin =
          initialState.growthDirection === "left"
            ? "right center"
            : initialState.growthDirection === "outward"
              ? "center center"
              : "left center";
      }

      bar.appendChild(fill);
      descriptor.fills.push(fill);
    }

    track.appendChild(bar);
    handle.barDescriptors.push(descriptor);
    return descriptor;
  }

  function setEqualizerDescriptorColor(descriptor, color) {
    if (typeof color !== "string") {
      return;
    }
    for (var i = 0; i < descriptor.fills.length; i++) {
      descriptor.fills[i].style.background = color;
    }
  }

  function applyEqualizerValue(descriptor, value, color) {
    var amplitude = Math.max(0, Math.min(1, Number(value) || 0));
    var transform = descriptor.isHorizontal
      ? "scaleY(" + String(amplitude) + ")"
      : "scaleX(" + String(amplitude) + ")";

    setEqualizerDescriptorColor(descriptor, color);

    for (var i = 0; i < descriptor.fills.length; i++) {
      descriptor.fills[i].style.transform = transform;
    }
  }

  function createEqualizerLineDescriptor(initialState, track) {
    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.dataset.equalizerLine = "";
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");
    applyStyles(svg, initialState.svgStyle || {
      width: "100%",
      height: "100%",
      overflow: "visible"
    });

    var defs = document.createElementNS(svgNS, "defs");
    var gradient = document.createElementNS(svgNS, "linearGradient");
    gradient.setAttribute("id", String(initialState.gradientId || "equalizer-gradient"));
    gradient.setAttribute("gradientUnits", "userSpaceOnUse");
    gradient.setAttribute("x1", String(initialState.gradientAxis?.x1 ?? 0));
    gradient.setAttribute("y1", String(initialState.gradientAxis?.y1 ?? 0));
    gradient.setAttribute("x2", String(initialState.gradientAxis?.x2 ?? 100));
    gradient.setAttribute("y2", String(initialState.gradientAxis?.y2 ?? 0));
    defs.appendChild(gradient);
    svg.appendChild(defs);

    var areaPath = initialState.lineStyle === "area"
      ? document.createElementNS(svgNS, "path")
      : null;
    if (areaPath) {
      areaPath.setAttribute("fill", "url(#" + String(initialState.gradientId) + ")");
      areaPath.style.opacity = String(initialState.areaFillOpacity ?? 0.35);
      areaPath.style.filter = String(initialState.filter || "none");
      svg.appendChild(areaPath);
    }

    var linePath = document.createElementNS(svgNS, "path");
    linePath.setAttribute("fill", "none");
    linePath.setAttribute("stroke", "url(#" + String(initialState.gradientId) + ")");
    linePath.setAttribute("stroke-width", String(initialState.strokeWidth ?? 3));
    linePath.setAttribute("stroke-linecap", String(initialState.strokeLinecap || "round"));
    linePath.setAttribute("stroke-linejoin", String(initialState.strokeLinecap || "round"));
    linePath.style.opacity = String(initialState.opacity ?? 1);
    linePath.style.filter = String(initialState.filter || "none");
    svg.appendChild(linePath);

    track.appendChild(svg);

    return {
      svg: svg,
      gradient: gradient,
      linePath: linePath,
      areaPath: areaPath,
      baseline: initialState.baseline || "bottom"
    };
  }

  function buildEqualizerLineGeometry(values, baseline) {
    var safeValues = Array.isArray(values) && values.length > 0 ? values : [0];
    var points = safeValues.map(function(rawValue, index) {
      var amplitude = Math.max(0, Math.min(1, Number(rawValue) || 0));
      var progress = safeValues.length <= 1 ? 0.5 : index / (safeValues.length - 1);

      switch (baseline) {
        case "top":
          return { x: progress * 100, y: amplitude * 100 };
        case "left":
          return { x: amplitude * 100, y: progress * 100 };
        case "right":
          return { x: 100 - amplitude * 100, y: progress * 100 };
        case "center-horizontal":
          return { x: progress * 100, y: 50 - amplitude * 50 };
        case "center-vertical":
          return { x: 50 + amplitude * 50, y: progress * 100 };
        case "bottom":
        default:
          return { x: progress * 100, y: 100 - amplitude * 100 };
      }
    });

    var linePathStr = points
      .map(function(point, index) {
        return (index === 0 ? "M " : "L ") + point.x.toFixed(3) + " " + point.y.toFixed(3);
      })
      .join(" ");

    var firstPoint = points[0];
    var lastPoint = points[points.length - 1];
    var areaPathStr = linePathStr;

    switch (baseline) {
      case "top":
        areaPathStr += " L " + lastPoint.x.toFixed(3) + " 0 L " + firstPoint.x.toFixed(3) + " 0 Z";
        break;
      case "left":
        areaPathStr += " L 0 " + lastPoint.y.toFixed(3) + " L 0 " + firstPoint.y.toFixed(3) + " Z";
        break;
      case "right":
        areaPathStr += " L 100 " + lastPoint.y.toFixed(3) + " L 100 " + firstPoint.y.toFixed(3) + " Z";
        break;
      case "center-horizontal":
        areaPathStr += " L " + lastPoint.x.toFixed(3) + " 50 L " + firstPoint.x.toFixed(3) + " 50 Z";
        break;
      case "center-vertical":
        areaPathStr += " L 50 " + lastPoint.y.toFixed(3) + " L 50 " + firstPoint.y.toFixed(3) + " Z";
        break;
      case "bottom":
      default:
        areaPathStr += " L " + lastPoint.x.toFixed(3) + " 100 L " + firstPoint.x.toFixed(3) + " 100 Z";
        break;
    }

    return { linePath: linePathStr, areaPath: areaPathStr };
  }

  function updateEqualizerLineGradient(gradient, colors) {
    gradient.textContent = "";
    var safeColors = Array.isArray(colors) && colors.length > 0 ? colors : ["#ffffff"];

    for (var index = 0; index < safeColors.length; index += 1) {
      var stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
      var offset = safeColors.length <= 1 ? 0 : (index / (safeColors.length - 1)) * 100;
      stop.setAttribute("offset", String(offset) + "%");
      stop.setAttribute("stop-color", String(safeColors[index]));
      gradient.appendChild(stop);
    }
  }

  function applyEqualizerLineState(handle, state) {
    var geometry = buildEqualizerLineGeometry(state.values, state.baseline || handle.baseline || "bottom");
    updateEqualizerLineGradient(handle.gradient, state.colors);
    handle.linePath.setAttribute("d", geometry.linePath);
    if (handle.areaPath) {
      handle.areaPath.setAttribute("d", geometry.areaPath);
    }
  }

  window.__registerLiveDomRuntime("equalizer", {
    mount: function(layer, initialState) {
      var wrapper = document.createElement("div");
      applyStyles(wrapper, initialState.wrapperStyle);
      wrapper.style.pointerEvents = "none";
      layer.appendChild(wrapper);

      if (initialState.plateStyle) {
        var plate = document.createElement("div");
        plate.dataset.equalizerPlate = "";
        applyStyles(plate, initialState.plateStyle);
        wrapper.appendChild(plate);
      }

      var track = document.createElement("div");
      track.dataset.equalizerTrack = "";
      applyStyles(track, initialState.trackStyle);
      wrapper.appendChild(track);

      var handle = {
        wrapper: wrapper,
        track: track,
        graphMode: initialState.graphMode || "bars",
        barDescriptors: [],
        lineDescriptor: null
      };

      if (initialState.graphMode === "line") {
        handle.lineDescriptor = createEqualizerLineDescriptor(initialState, track);
        applyEqualizerLineState(handle.lineDescriptor, {
          values: initialState.values,
          colors: initialState.colors,
          baseline: initialState.baseline
        });
      } else {
        for (var i = 0; i < initialState.entries.length; i++) {
          var entry = initialState.entries[i];
          var descriptor = createEqualizerBarDescriptor(handle, entry, initialState, track);
          if (descriptor && entry.type === "bar") {
            applyEqualizerValue(descriptor, entry.value, entry.color);
          }
        }
      }

      return handle;
    },
    update: function(handle, state) {
      if (!handle || !state || !Array.isArray(state.values)) {
        return;
      }

      if (handle.graphMode === "line") {
        if (handle.lineDescriptor) {
          applyEqualizerLineState(handle.lineDescriptor, state);
        }
        return;
      }

      for (var index = 0; index < handle.barDescriptors.length; index += 1) {
        applyEqualizerValue(
          handle.barDescriptors[index],
          state.values[index] ?? 0,
          state.colors?.[index]
        );
      }
    }
  });
})();
`;

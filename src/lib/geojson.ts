import { RgbaDecimal } from "../types";
import { GeoJSONFeature } from "mapbox-gl";
import colorString from "color-string";
import { FillPaint } from "~/types.ts";

const getUniqueLayers = (features: GeoJSONFeature[]) => {
  const uniqueIds = new Set();
  const uniqueFeatures = [];
  for (const feature of features) {
    if (feature.layer === undefined) {
      continue;
    }
    const id = feature.layer.id + feature.properties?.minAlt;
    if (!uniqueIds.has(id)) {
      uniqueIds.add(id);
      uniqueFeatures.push(feature);
    }
  }
  return uniqueFeatures;
};

const comparePolyAlts = (p1: mapboxgl.MapboxGeoJSONFeature, p2: mapboxgl.MapboxGeoJSONFeature) => {
  if (typeof p1.properties?.minAlt === "undefined" && typeof p2.properties?.minAlt === "undefined")
    return 0;
  if (typeof p1.properties?.minAlt === "undefined" && typeof p2.properties?.minAlt !== "undefined")
    return -1;
  if (typeof p1.properties?.minAlt !== "undefined" && typeof p2.properties?.minAlt === "undefined")
    return 1;
  if (p1.properties?.minAlt == p2.properties?.minAlt) {
    return p2.properties?.maxAlt - p1.properties?.maxAlt;
  }
  return p2.properties?.minAlt - p1.properties?.minAlt;
};

const getFillColor = (paint: FillPaint | null | undefined): string => {
  if (paint === null || paint === undefined) {
    return "#4b5563"; // Tailwind default gray-600;
  }
  let c = paint["fill-color"] as unknown as RgbaDecimal;
  let hex = colorString.to.hex(c.r * 255, c.g * 255, c.b * 255, c.a);
  if (hex) {
    return hex;
  } else {
    return "#4b5563";
  }
};

const isTransparentFill = (paint: FillPaint | undefined | null): boolean => {
  if (paint === null || paint === undefined) {
    return true;
  }

  let c = paint["fill-color"] as unknown as RgbaDecimal;
  return c.a === 0;
};

export { getUniqueLayers, comparePolyAlts, getFillColor, isTransparentFill };

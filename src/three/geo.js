import mapboxgl from 'mapbox-gl';

export const getLocalMetersFromLngLat = (originLngLat, lngLat) => {
  const originCoord = mapboxgl.MercatorCoordinate.fromLngLat(originLngLat, 0);
  const currentCoord = mapboxgl.MercatorCoordinate.fromLngLat(lngLat, 0);
  const meterScale = originCoord.meterInMercatorCoordinateUnits();

  // Critical: convert Mercator world-units to meters so Three.js keeps 1 unit = 1 meter.
  return {
    x: (currentCoord.x - originCoord.x) / meterScale,
    z: (originCoord.y - currentCoord.y) / meterScale
  };
};

export const polygonToLocalMeters = (coordinates) => {
  if (!coordinates?.length) return { origin: null, points: [] };
  const origin = coordinates[0];
  const points = coordinates.map((lngLat) => getLocalMetersFromLngLat(origin, lngLat));
  return { origin, points };
};

export const isPointInsidePolygon = (point, polygon) => {
  if (!polygon?.length) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const zi = polygon[i].z;
    const xj = polygon[j].x;
    const zj = polygon[j].z;
    const intersect = zi > point.z !== zj > point.z && point.x < ((xj - xi) * (point.z - zi)) / (zj - zi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

export const snapToGrid = (value, grid = 0.5) => Math.round(value / grid) * grid;

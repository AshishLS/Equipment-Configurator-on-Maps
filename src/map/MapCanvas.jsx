import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from 'mapbox-gl-draw';
import { nanoid } from 'nanoid';
import { useConfiguratorStore, getMapStyleUrl } from '../store/useConfiguratorStore';
import clientConfig from '../config/client-config.json';
import equipmentLibrary from '../config/equipment-library.json';
import { polygonToLocalMeters, getLocalMetersFromLngLat } from '../three/geo';
import { ThreeLayerEngine } from '../three/ThreeLayerEngine';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

export default function MapCanvas() {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const drawRef = useRef(null);
  const engineRef = useRef(null);

  const measureMarkerRef = useRef(null);

  const {
    siteBoundary,
    originLatLng,
    objects,
    terrainEnabled,
    mapStyle,
    measurementActive,
    measurementPoints,
    setSiteBoundary,
    addObject,
    updateObject,
    setMeasurementPoints,
    setMeasurementResult,
    measurementResult
  } = useConfiguratorStore();

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: getMapStyleUrl(clientConfig.defaultStyle),
      center: clientConfig.defaultCenter,
      zoom: clientConfig.defaultZoom,
      pitch: 45,
      antialias: true
    });

    mapRef.current = map;

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true
      }
    });

    drawRef.current = draw;

    map.on('load', () => {
      map.addControl(draw, 'top-left');
      map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.terrain-rgb',
        tileSize: 512,
        maxzoom: 14
      });

      const engine = new ThreeLayerEngine({ map, onObjectUpdate: updateObject });
      engineRef.current = engine;
      map.addLayer(engine.createCustomLayer());
    });

    const handleDrawUpdate = () => {
      const data = draw.getAll();
      const polygon = data.features.find((feature) => feature.geometry.type === 'Polygon');
      if (!polygon) {
        setSiteBoundary(null);
        return;
      }
      const ring = polygon.geometry.coordinates[0].slice(0, -1);
      setSiteBoundary(ring);
    };

    map.on('draw.create', handleDrawUpdate);
    map.on('draw.update', handleDrawUpdate);
    map.on('draw.delete', handleDrawUpdate);

    map.on('click', (event) => {
      if (!measurementActive || !originLatLng) return;
      const nextPoints = [...measurementPoints, [event.lngLat.lng, event.lngLat.lat]].slice(-2);
      setMeasurementPoints(nextPoints);
      if (nextPoints.length === 2) {
        const a = mapboxgl.MercatorCoordinate.fromLngLat(nextPoints[0], 0);
        const b = mapboxgl.MercatorCoordinate.fromLngLat(nextPoints[1], 0);
        const meterScale = a.meterInMercatorCoordinateUnits();
        const distance =
          Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) + Math.pow(a.z - b.z, 2)) / meterScale;
        setMeasurementResult({ distance, midpoint: [(nextPoints[0][0] + nextPoints[1][0]) / 2, (nextPoints[0][1] + nextPoints[1][1]) / 2] });
      } else {
        setMeasurementResult(null);
      }
    });

    return () => {
      engineRef.current?.dispose();
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const style = getMapStyleUrl(mapStyle);
    engineRef.current?.dispose();
    map.setStyle(style);
    map.once('style.load', () => {
      if (!map.getSource('mapbox-dem')) {
        map.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.terrain-rgb',
          tileSize: 512,
          maxzoom: 14
        });
      }
      const engine = new ThreeLayerEngine({ map, onObjectUpdate: updateObject });
      engineRef.current = engine;
      map.addLayer(engine.createCustomLayer());
      if (terrainEnabled) {
        map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.2 });
      }
      if (siteBoundary?.length) {
        const { origin, points } = polygonToLocalMeters(siteBoundary);
        engine.setOrigin(origin);
        engine.setBoundary(points);
        engine.upsertObjects(objects, equipmentLibrary);
      }
    });
  }, [mapStyle]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (terrainEnabled) {
      map.easeTo({ pitch: 60, duration: 800 });
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.2 });
    } else {
      map.setTerrain(null);
      map.easeTo({ pitch: 45, duration: 500 });
    }
  }, [terrainEnabled]);

  useEffect(() => {
    if (!engineRef.current) return;
    const { origin, points } = polygonToLocalMeters(siteBoundary || []);
    engineRef.current.setOrigin(origin);
    engineRef.current.setBoundary(points);
  }, [siteBoundary]);

  useEffect(() => {
    if (!engineRef.current || !siteBoundary?.length) return;
    engineRef.current.upsertObjects(objects, equipmentLibrary);
  }, [objects, siteBoundary]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !originLatLng || measurementPoints.length < 2) {
      engine?.setMeasurementLine(null);
      return;
    }
    engine.setMeasurementLine(measurementPoints.map((p) => getLocalMetersFromLngLat(originLatLng, p)));
  }, [measurementPoints, originLatLng]);


  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (measureMarkerRef.current) {
      measureMarkerRef.current.remove();
      measureMarkerRef.current = null;
    }

    if (!measurementResult?.midpoint) return;

    const element = document.createElement('div');
    element.className = 'rounded bg-black/80 px-2 py-1 text-xs text-white';
    element.textContent = `${measurementResult.distance.toFixed(2)} m`;
    measureMarkerRef.current = new mapboxgl.Marker({ element }).setLngLat(measurementResult.midpoint).addTo(map);
  }, [measurementResult]);

  const addEquipment = (type) => {
    if (!siteBoundary?.length) return;
    addObject({
      id: nanoid(8),
      type,
      x: 1,
      z: 1,
      rotation: 0
    });
  };

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <div className="absolute bottom-4 left-4 z-20 flex gap-2">
        {equipmentLibrary.map((item) => (
          <button
            key={item.id}
            className="rounded bg-slate-800 px-3 py-2 text-xs text-white shadow"
            onClick={() => addEquipment(item.id)}
            type="button"
          >
            Add {item.name}
          </button>
        ))}
        <button
          className="rounded bg-amber-500 px-3 py-2 text-xs text-slate-900"
          onClick={() => engineRef.current?.rotateSelected()}
          type="button"
        >
          Rotate Selected
        </button>
      </div>
    </div>
  );
}

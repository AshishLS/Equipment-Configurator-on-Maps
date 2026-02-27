import { create } from 'zustand';

const MAP_STYLES = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12'
};

export const useConfiguratorStore = create((set) => ({
  siteBoundary: null,
  originLatLng: null,
  objects: [],
  terrainEnabled: false,
  mapStyle: 'streets',
  measurementActive: false,
  measurementPoints: [],
  measurementResult: null,
  setSiteBoundary: (siteBoundary) =>
    set(() => ({
      siteBoundary,
      originLatLng: siteBoundary?.[0] ?? null
    })),
  setObjects: (objects) => set(() => ({ objects })),
  addObject: (object) => set((state) => ({ objects: [...state.objects, object] })),
  updateObject: (id, patch) =>
    set((state) => ({
      objects: state.objects.map((item) => (item.id === id ? { ...item, ...patch } : item))
    })),
  removeObject: (id) =>
    set((state) => ({
      objects: state.objects.filter((item) => item.id !== id)
    })),
  toggleTerrain: () => set((state) => ({ terrainEnabled: !state.terrainEnabled })),
  setMapStyle: (mapStyle) => set(() => ({ mapStyle })),
  toggleMeasurement: () =>
    set((state) => ({
      measurementActive: !state.measurementActive,
      measurementPoints: [],
      measurementResult: null
    })),
  setMeasurementPoints: (measurementPoints) => set(() => ({ measurementPoints })),
  setMeasurementResult: (measurementResult) => set(() => ({ measurementResult })),
  importState: ({ siteBoundary, origin, objects }) =>
    set(() => ({
      siteBoundary: siteBoundary ?? null,
      originLatLng: origin ?? siteBoundary?.[0] ?? null,
      objects: objects ?? []
    }))
}));

export const getMapStyleUrl = (styleKey) => MAP_STYLES[styleKey] ?? MAP_STYLES.streets;

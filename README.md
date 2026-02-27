# OpenPulse Map-Based 3D Configurator Engine

Production-oriented Vite + React engine for map-based geospatial equipment planning using Mapbox GL JS + Three.js custom layers.

## Features

- Mapbox GL JS map centered on Pune with style switching (streets/satellite).
- Three.js rendered inside Mapbox custom layer with a shared WebGL context.
- Optional 3D terrain (`raster-dem`, exaggeration `1.2`) with animated pitch.
- Mapbox Draw polygon workflow for site boundary creation/edit/delete.
- Geospatially accurate local meter coordinate system (`1 Three unit = 1 meter`).
- Config-driven equipment library using placeholder box geometries.
- Drag + rotate equipment with snap to 0.5m grid and polygon boundary checks.
- Measurement tool with real-world meter distance and floating label.
- Zustand-powered shared state.
- JSON import/export for reusable design persistence.
- Multi-tenant ready config folder for future DB/Supabase replacement.

## Project Structure

```txt
src/
  components/
  config/
    client-config.json
    equipment-library.json
  map/
  store/
  three/
```

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment:
   ```bash
   cp .env.example .env
   ```
3. Add your Mapbox token in `.env`:
   ```env
   VITE_MAPBOX_ACCESS_TOKEN=pk....
   ```
4. Run locally:
   ```bash
   npm run dev
   ```

### Dependency Note

- `mapbox-gl-draw` is pinned to `^1.4.3` because `^1.5.0` is not a published npm version.

## Export Schema

```json
{
  "siteBoundary": [[73.8567, 18.5204], [73.857, 18.5206]],
  "origin": [73.8567, 18.5204],
  "objects": [
    {
      "id": "abc123",
      "type": "slide_small",
      "x": 4,
      "z": 2,
      "rotation": 0.785
    }
  ]
}
```

## Notes

- Equipment + client settings are config-driven JSON for future multi-tenant backend loading.
- Critical geospatial conversion math is documented in `src/three/geo.js`.

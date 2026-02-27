import { nanoid } from 'nanoid';
import equipmentLibrary from '../config/equipment-library.json';
import clientConfig from '../config/client-config.json';
import { useConfiguratorStore } from '../store/useConfiguratorStore';

export default function ControlPanel() {
  const {
    siteBoundary,
    originLatLng,
    objects,
    terrainEnabled,
    mapStyle,
    measurementActive,
    measurementResult,
    setMapStyle,
    toggleTerrain,
    toggleMeasurement,
    addObject,
    importState
  } = useConfiguratorStore();

  const exportData = () => {
    const payload = {
      siteBoundary,
      origin: originLatLng,
      objects
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'openpulse-design.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const importData = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        importState(parsed);
      } catch {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <aside className="h-full overflow-auto bg-slate-900 p-5 text-slate-100">
      <h1 className="text-xl font-semibold">{clientConfig.appName}</h1>
      <p className="mt-1 text-xs text-slate-400">Multi-tenant map-based 3D configurator engine</p>

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase text-slate-300">Map Style</h2>
        <div className="flex gap-2">
          {['streets', 'satellite'].map((style) => (
            <button
              key={style}
              className={`rounded px-3 py-2 text-sm ${mapStyle === style ? 'bg-indigo-500 text-white' : 'bg-slate-800'}`}
              onClick={() => setMapStyle(style)}
              type="button"
            >
              {style}
            </button>
          ))}
        </div>
        <button className="w-full rounded bg-slate-800 px-3 py-2 text-left text-sm" onClick={toggleTerrain} type="button">
          Terrain: {terrainEnabled ? 'Enabled' : 'Disabled'}
        </button>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase text-slate-300">Equipment Library</h2>
        <div className="space-y-2">
          {equipmentLibrary.map((item) => (
            <button
              key={item.id}
              className="w-full rounded bg-slate-800 px-3 py-2 text-left text-sm"
              type="button"
              onClick={() =>
                addObject({
                  id: nanoid(8),
                  type: item.id,
                  x: 1,
                  z: 1,
                  rotation: 0
                })
              }
              disabled={!siteBoundary?.length}
            >
              {item.name} ({item.width}m × {item.depth}m × {item.height}m)
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase text-slate-300">Measurement Tool</h2>
        <button className="w-full rounded bg-slate-800 px-3 py-2 text-left text-sm" onClick={toggleMeasurement} type="button">
          {measurementActive ? 'Disable Measurement' : 'Enable Measurement'}
        </button>
        {measurementResult && <p className="text-sm text-emerald-300">Distance: {measurementResult.distance.toFixed(2)} meters</p>}
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase text-slate-300">Design IO</h2>
        <button className="w-full rounded bg-emerald-600 px-3 py-2 text-sm font-medium" onClick={exportData} type="button">
          Export JSON
        </button>
        <label className="block w-full cursor-pointer rounded bg-slate-800 px-3 py-2 text-sm">
          Import JSON
          <input className="hidden" type="file" accept="application/json" onChange={importData} />
        </label>
      </section>

      <section className="mt-6 rounded border border-slate-700 p-3 text-xs text-slate-400">
        <p>Boundary vertices: {siteBoundary?.length ?? 0}</p>
        <p>Origin: {originLatLng ? `${originLatLng[1].toFixed(6)}, ${originLatLng[0].toFixed(6)}` : 'Not set'}</p>
        <p>Objects: {objects.length}</p>
      </section>
    </aside>
  );
}

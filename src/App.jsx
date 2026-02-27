import MapCanvas from './map/MapCanvas';
import ControlPanel from './components/ControlPanel';

export default function App() {
  return (
    <div className="grid h-full w-full grid-cols-5">
      <div className="col-span-3 h-full border-r border-slate-800">
        <MapCanvas />
      </div>
      <div className="col-span-2 h-full">
        <ControlPanel />
      </div>
    </div>
  );
}
